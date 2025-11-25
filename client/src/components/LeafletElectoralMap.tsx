import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ELECTION_RESULTS, PARTY_COLORS } from '../assets/election-results';

// Define the interface for constituency data
interface Constituency {
  name: string;
  seats: number;
  coordinates: number[][];
  outgoingTDs: {
    name: string;
    party: string;
  }[];
}

interface LeafletElectoralMapProps {
  onConstituencySelect: (name: string) => void;
  width?: string;
  height?: string;
}

const LeafletElectoralMap: React.FC<LeafletElectoralMapProps> = ({
  onConstituencySelect,
  width = '100%',
  height = '500px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [activeConstituency, setActiveConstituency] = useState<string | null>(null);

  // Sample constituencies data for Ireland
  const constituencies: Constituency[] = [
    {
      name: 'Dublin Central',
      seats: 4,
      coordinates: [
        [53.36, -6.26],
        [53.36, -6.24],
        [53.34, -6.24],
        [53.34, -6.26],
        [53.36, -6.26]
      ],
      outgoingTDs: [
        { name: 'Mary Lou McDonald', party: 'Sinn Féin' },
        { name: 'Paschal Donohoe', party: 'Fine Gael' },
        { name: 'Neasa Hourigan', party: 'Green Party' },
        { name: 'Gary Gannon', party: 'Social Democrats' }
      ]
    },
    {
      name: 'Dublin Bay North',
      seats: 5,
      coordinates: [
        [53.38, -6.24],
        [53.38, -6.18],
        [53.34, -6.18],
        [53.34, -6.24],
        [53.38, -6.24]
      ],
      outgoingTDs: [
        { name: 'Richard Bruton', party: 'Fine Gael' },
        { name: 'Aodhán Ó Ríordáin', party: 'Labour Party' },
        { name: 'Denise Mitchell', party: 'Sinn Féin' },
        { name: 'Cian O\'Callaghan', party: 'Social Democrats' },
        { name: 'Seán Haughey', party: 'Fianna Fáil' }
      ]
    },
    {
      name: 'Dublin Bay South',
      seats: 4,
      coordinates: [
        [53.34, -6.26],
        [53.34, -6.22],
        [53.32, -6.22],
        [53.32, -6.26],
        [53.34, -6.26]
      ],
      outgoingTDs: [
        { name: 'Eamon Ryan', party: 'Green Party' },
        { name: 'Jim O\'Callaghan', party: 'Fianna Fáil' },
        { name: 'Chris Andrews', party: 'Sinn Féin' },
        { name: 'Ivana Bacik', party: 'Labour Party' }
      ]
    },
    {
      name: 'Cork East',
      seats: 4,
      coordinates: [
        [52.1, -8.2],
        [52.1, -7.8],
        [51.8, -7.8],
        [51.8, -8.2],
        [52.1, -8.2]
      ],
      outgoingTDs: [
        { name: 'David Stanton', party: 'Fine Gael' },
        { name: 'Sean Sherlock', party: 'Labour Party' },
        { name: 'Pat Buckley', party: 'Sinn Féin' },
        { name: 'James O\'Connor', party: 'Fianna Fáil' }
      ]
    },
    {
      name: 'Cork North-West',
      seats: 3,
      coordinates: [
        [52.2, -9.0],
        [52.2, -8.2],
        [51.8, -8.2],
        [51.8, -9.0],
        [52.2, -9.0]
      ],
      outgoingTDs: [
        { name: 'Michael Creed', party: 'Fine Gael' },
        { name: 'Michael Moynihan', party: 'Fianna Fáil' },
        { name: 'Aindrias Moynihan', party: 'Fianna Fáil' }
      ]
    }
  ];

  // Function to get the dominant party color for a constituency
  const getConstituencyColor = (constituencyName: string): string => {
    const partyCount: Record<string, number> = {};
    let maxCount = 0;
    let dominantParty = 'Other';

    // Count the occurrences of each party in the constituency
    for (let i = 1; i <= 5; i++) {
      const key = `${constituencyName}${i}`;
      if (ELECTION_RESULTS[key]) {
        const party = ELECTION_RESULTS[key];
        partyCount[party] = (partyCount[party] || 0) + 1;
        
        if (partyCount[party] > maxCount) {
          maxCount = partyCount[party];
          dominantParty = party;
        }
      }
    }

    return PARTY_COLORS[dominantParty] || PARTY_COLORS['Other'];
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize the map if it hasn't been initialized yet
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([53.3, -7.5], 7);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      // Create a layer group for constituencies
      const constituencyLayer = L.layerGroup().addTo(mapRef.current);

      // Add constituencies to the map
      constituencies.forEach((constituency) => {
        const color = getConstituencyColor(constituency.name);
        
        // Create a polygon for the constituency
        const polygon = L.polygon(constituency.coordinates as [number, number][], {
          color: '#333',
          weight: 1,
          fillColor: color,
          fillOpacity: 0.7
        }).addTo(constituencyLayer);

        // Add a label to the polygon
        const center = polygon.getBounds().getCenter();
        L.marker(center, {
          icon: L.divIcon({
            className: 'constituency-label',
            html: `<div style="background-color: rgba(255,255,255,0.7); padding: 2px 5px; border-radius: 3px; font-size: 12px; font-weight: bold;">${constituency.name}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10]
          })
        }).addTo(constituencyLayer);

        // Add a tooltip to show constituency name on hover
        polygon.bindTooltip(`
          <div style="text-align: center;">
            <strong>${constituency.name}</strong>
            <br>
            ${constituency.seats} seats
          </div>
        `, { 
          permanent: false, 
          direction: 'center'
        });

        // Add click handler to show constituency details
        polygon.on('click', () => {
          setActiveConstituency(constituency.name);
          onConstituencySelect(constituency.name);
        });
      });
    }

    // Clean up the map when the component unmounts
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onConstituencySelect]);

  return (
    <div className="leaflet-electoral-map" style={{ width: width, height: height, position: 'relative' }}>
      <div 
        ref={mapContainerRef} 
        className="map-container" 
        style={{ width: '100%', height: '100%' }}
      ></div>
      <style>
        {`
          .constituency-label {
            z-index: 1000;
            pointer-events: none;
            white-space: nowrap;
            text-align: center;
          }
        `}
      </style>
    </div>
  );
};

export default LeafletElectoralMap;