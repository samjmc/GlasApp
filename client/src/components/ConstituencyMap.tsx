import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/constituency-popup.css';
import ReactDOMServer from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import ConstituencyStoryPopup from './ConstituencyStoryPopup';

// Fix Leaflet icon issue in browsers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Define types for constituencies
interface ConstituencyMapProps {
  selectedConstituencies: string[];
  onConstituencySelect: (constituency: string) => void;
  constituencyData?: Record<string, any>; // Optional constituency data with party information
}

// Define constituency boundary data (simplified for this example)
// In a real application, you would load a GeoJSON file with proper boundaries
const constituencyCoordinates: Record<string, [number, number]> = {
  "Carlow–Kilkenny": [52.6477, -7.2561],
  "Cavan–Monaghan": [54.0736, -7.0731],
  "Clare": [52.9054, -8.9806],
  "Cork East": [52.1358, -8.1453],
  "Cork North-Central": [51.9114, -8.4608],
  "Cork North-West": [52.1304, -8.9648],
  "Cork South-Central": [51.8821, -8.4853],
  "Cork South-West": [51.5464, -9.2710],
  "Donegal": [54.9040, -8.1093],
  "Dublin Bay North": [53.3862, -6.1837],
  "Dublin Bay South": [53.3340, -6.2489],
  "Dublin Central": [53.3485, -6.2658],
  "Dublin Fingal": [53.4828, -6.2197],
  "Dublin Mid-West": [53.3199, -6.4359],
  "Dublin North-West": [53.3901, -6.2893],
  "Dublin Rathdown": [53.2788, -6.2393],
  "Dublin South-Central": [53.3212, -6.3159],
  "Dublin South-West": [53.2827, -6.3720],
  "Dublin West": [53.3861, -6.3737],
  "Dún Laoghaire": [53.2929, -6.1339],
  "Galway East": [53.2980, -8.5243],
  "Galway West": [53.2707, -9.0568],
  "Kerry": [52.1546, -9.5669],
  "Kildare North": [53.2522, -6.6644],
  "Kildare South": [53.0894, -6.7860],
  "Laois–Offaly": [53.1020, -7.3320],
  "Limerick City": [52.6638, -8.6267],
  "Longford–Westmeath": [53.5275, -7.5938],
  "Louth": [53.9508, -6.5405],
  "Mayo": [53.8544, -9.3049],
  "Meath East": [53.6519, -6.5721],
  "Meath West": [53.6800, -6.8724],
  "Roscommon–Galway": [53.6274, -8.1929],
  "Sligo-Leitrim": [54.1403, -8.4961],
  "Tipperary": [52.6746, -7.9254],
  "Waterford": [52.2593, -7.1101],
  "Wexford": [52.4739, -6.5586],
  "Wicklow": [52.9807, -6.0446]
};

// Color coding based on the number of seats (similar to the image)
const getColorBySeatCount = (name: string) => {
  // This is a placeholder - in a real app you would use real data
  // For now we're randomly assigning colors
  const seatGroups = {
    3: '#ffff00', // Yellow for 3 seats
    4: '#e188e1', // Purple for 4 seats
    5: '#ff5555'  // Red for 5 seats
  };
  
  // Simplified assignment for demonstration
  const seat = [
    "Cork North-West", "Dublin Rathdown", "Meath East", "Meath West", 
    "Roscommon–Galway", "Sligo-Leitrim"
  ].includes(name) ? 3 : 
    ["Clare", "Cork East", "Cork North-Central", "Cork South-Central", 
     "Dublin Bay South", "Dublin Central", "Dublin Mid-West", "Dublin South-Central", 
     "Dublin West", "Galway East", "Kildare North", "Kildare South", "Limerick City", 
     "Longford–Westmeath", "Waterford"].includes(name) ? 4 : 5;
    
  return seatGroups[seat as keyof typeof seatGroups];
};

const ConstituencyMap: React.FC<ConstituencyMapProps> = ({ 
  selectedConstituencies, 
  onConstituencySelect,
  constituencyData = {}
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markers = useRef<Record<string, L.CircleMarker>>({});
  const [activePopup, setActivePopup] = useState<L.Popup | null>(null);

  // Function to create an interactive popup that will be rendered with React
  const createInteractivePopup = (name: string) => {
    // Create popup with custom class for styling
    const popup = L.popup({
      className: 'constituency-story-popup',
      maxWidth: 200,
      closeButton: false,
      closeOnClick: true,
      autoClose: true
    });
    
    // Create a div for React to render into
    const container = document.createElement('div');
    container.className = 'constituency-popup-container';
    popup.setContent(container);
    
    return popup;
  };

  useEffect(() => {
    if (mapRef.current && !leafletMap.current) {
      // Initialize the map
      leafletMap.current = L.map(mapRef.current).setView([53.3498, -7.9084], 7);
      
      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(leafletMap.current);

      // Add constituency markers
      Object.entries(constituencyCoordinates).forEach(([name, coords]) => {
        const color = getColorBySeatCount(name);
        
        // Create a circle marker for each constituency
        const marker = L.circleMarker([coords[0], coords[1]], {
          radius: 10,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        })
          .addTo(leafletMap.current!)
          .bindTooltip(name, { permanent: false, direction: 'top' })
          .on('click', (e) => {
            // Toggle selection for the constituency when clicked
            onConstituencySelect(name);
          })
          .on('mouseover', (e) => {
            // Highlight the marker on hover
            e.target.setStyle({ 
              weight: 3, 
              color: '#ff3300',
              fillOpacity: 1
            });

            // Close any existing popup first
            leafletMap.current?.closePopup();
            
            // Create and open a new popup
            const popup = createInteractivePopup(name);
            popup.setLatLng(e.target.getLatLng());
            popup.openOn(leafletMap.current!);
            setActivePopup(popup);
            
            // After popup is added to the map, we can render React into it
            const container = popup.getElement()?.querySelector('.constituency-popup-container');
            if (container) {
              try {
                // Get constituency data
                const partyData = constituencyData[name]?.parties || [];
                
                // Filter out parties with no data (0% or undefined percent)
                const filteredPartyData = partyData.filter((party: any) => 
                  party.percent !== undefined && party.percent > 0
                );
                
                // Create React root and render
                const root = createRoot(container);
                root.render(
                  <ConstituencyStoryPopup 
                    constituencyName={name}
                    partyData={filteredPartyData}
                    onClose={() => {
                      leafletMap.current?.closePopup();
                      setActivePopup(null);
                    }}
                    showStoryByDefault={true}
                  />
                );
              } catch (error) {
                console.error("Error rendering constituency popup:", error);
              }
            }
            
            // Add mouseout event to the popup element itself to close when mouse leaves
            const popupElement = popup.getElement();
            if (popupElement) {
              popupElement.addEventListener('mouseleave', () => {
                leafletMap.current?.closePopup();
                setActivePopup(null);
              });
            }
          })
          .on('mouseout', (e) => {
            // Reset the marker style if not selected
            if (!selectedConstituencies.includes(name)) {
              e.target.setStyle({ 
                weight: 2, 
                color: '#fff',
                fillOpacity: 0.8
              });
            }
            
            // Let the popup stay open when interacting with it
            // This allows users to click buttons within the popup
          });
        
        markers.current[name] = marker;
      });
      
      // Close popup when clicking on map background (not on markers)
      leafletMap.current.on('click', () => {
        if (activePopup) {
          leafletMap.current?.closePopup(activePopup);
          setActivePopup(null);
        }
      });
    }

    // Update marker styles based on selection
    Object.entries(markers.current).forEach(([name, marker]) => {
      if (selectedConstituencies.includes(name)) {
        marker.setStyle({ weight: 3, color: '#ff3300' });
      } else {
        marker.setStyle({ weight: 2, color: '#fff' });
      }
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [selectedConstituencies, onConstituencySelect, constituencyData]);

  return (
    <div className="w-full h-[736px] rounded-lg overflow-hidden border border-gray-300 mt-4 relative z-10">
      <div ref={mapRef} className="w-full h-full"></div>
    </div>
  );
};

export default ConstituencyMap;