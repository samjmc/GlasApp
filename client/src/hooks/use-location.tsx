import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface LocationData {
  latitude: number;
  longitude: number;
  constituency?: string;
  county?: string;
  accuracy?: number;
}

interface LocationResult {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
  hasPermission: boolean;
}

export function useLocation(): LocationResult {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const { user } = useAuth();

  const findConstituency = async (lat: number, lng: number): Promise<{ constituency?: string; county?: string }> => {
    try {
      const response = await fetch(`/api/location/constituency?lat=${lat}&lng=${lng}`);
      if (response.ok) {
        const data = await response.json();
        return {
          constituency: data.constituency,
          county: data.county
        };
      }
    } catch (err) {
      console.warn('Failed to determine constituency:', err);
    }
    return {};
  };

  const saveUserLocation = async (locationData: LocationData) => {
    if (!user) return;
    
    try {
      await fetch('/api/users/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          constituency: locationData.constituency,
          county: locationData.county,
          accuracy: locationData.accuracy
        })
      });
    } catch (err) {
      console.warn('Failed to save user location:', err);
    }
  };

  const requestLocation = async (): Promise<void> => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;
      
      // Find constituency based on coordinates
      const { constituency, county } = await findConstituency(latitude, longitude);

      const locationData: LocationData = {
        latitude,
        longitude,
        constituency,
        county,
        accuracy
      };

      setLocation(locationData);
      setHasPermission(true);
      
      // Save to database if user is authenticated
      if (user) {
        await saveUserLocation(locationData);
      }

    } catch (err: any) {
      let errorMessage = 'Failed to get location';
      
      if (err.code === 1) {
        errorMessage = 'Location access denied by user';
      } else if (err.code === 2) {
        errorMessage = 'Location information unavailable';
      } else if (err.code === 3) {
        errorMessage = 'Location request timed out';
      }
      
      setError(errorMessage);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  };

  // Check permission status on mount
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setHasPermission(result.state === 'granted');
      });
    }
  }, []);

  return {
    location,
    loading,
    error,
    requestLocation,
    hasPermission
  };
}