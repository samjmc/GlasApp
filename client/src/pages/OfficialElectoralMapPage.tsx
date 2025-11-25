import React, { useState } from 'react';
import OfficialElectoralMap from '../components/OfficialElectoralMap';
import { ELECTION_RESULTS, PARTY_COLORS } from '../assets/election-results';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

const OfficialElectoralMapPage: React.FC = () => {
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Get election results for a constituency
  const getConstituencyResults = (constituencyName: string) => {
    const results: Record<string, number> = {};
    const candidateCount: Record<string, string[]> = {}; // Party -> candidate names
    
    // Look for results with our constituency name
    for (let i = 1; i <= 5; i++) {
      const key = `${constituencyName}${i}`;
      if (ELECTION_RESULTS[key]) {
        const party = ELECTION_RESULTS[key];
        // Count seats per party
        results[party] = (results[party] || 0) + 1;
        
        // Track candidate names (for future implementation)
        if (!candidateCount[party]) {
          candidateCount[party] = [];
        }
        candidateCount[party].push(`Candidate ${i}`); // Placeholder, would be actual names in real data
      }
    }
    
    return { results, candidateCount };
  };

  // Handle constituency selection
  const handleConstituencySelect = (name: string) => {
    console.log('Selected constituency:', name);
    setSelectedConstituency(name);
  };

  // Calculate total seats for the selected constituency
  const getTotalSeats = (constituencyName: string) => {
    if (!constituencyName) return 0;
    
    let count = 0;
    for (let i = 1; i <= 5; i++) {
      const key = `${constituencyName}${i}`;
      if (ELECTION_RESULTS[key]) {
        count++;
      }
    }
    return count || 3; // Default to 3 if no data found
  };

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-green-800 mb-2">Irish Electoral Constituencies</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          Explore Ireland's electoral constituencies with accurate boundary data from the Electoral Commission.
          Click on a constituency to view detailed information including election results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main map area - takes up more space */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">Interactive Electoral Map</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Responsive container height: 50vh on mobile, 600px on desktop */}
              <div className="h-[50vh] min-h-[400px] lg:h-[600px] w-full">
                <OfficialElectoralMap 
                  onConstituencySelect={handleConstituencySelect} 
                  height="100%"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Information panel */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle>
                {selectedConstituency ? (
                  <span className="text-xl font-bold">{selectedConstituency}</span>
                ) : (
                  <span className="text-lg text-gray-500">Select a constituency</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedConstituency ? (
                <Tabs defaultValue="overview" onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="results">Election Results</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview" className="pt-4">
                    <div className="text-sm">
                      <div className="grid grid-cols-2 mb-3">
                        <span className="font-medium">County:</span>
                        <span>{selectedConstituency.split(' ')[0]}</span>
                      </div>
                      <div className="grid grid-cols-2 mb-3">
                        <span className="font-medium">Number of Seats:</span>
                        <span>{getTotalSeats(selectedConstituency)}</span>
                      </div>
                      <div className="grid grid-cols-2 mb-3">
                        <span className="font-medium">Last Election:</span>
                        <span>2023</span>
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="mt-4">
                        <h3 className="font-semibold mb-2">About This Constituency</h3>
                        <p className="text-gray-600 text-sm">
                          {selectedConstituency} is one of Ireland's electoral constituencies, 
                          represented in Dáil Éireann, the lower house of the Irish parliament.
                          The constituency boundaries are based on the 2023 Electoral Commission revision.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="results" className="pt-4">
                    <div>
                      <h3 className="font-semibold mb-3">Last Election Results</h3>
                      <div className="space-y-3">
                        {Object.entries(getConstituencyResults(selectedConstituency).results).map(([party, seats]) => (
                          <div key={party} className="flex items-center">
                            <div 
                              className="w-4 h-4 rounded-full mr-2" 
                              style={{ backgroundColor: PARTY_COLORS[party] || '#888' }}
                            ></div>
                            <span className="text-sm font-medium flex-grow">{party}</span>
                            <span className="text-sm">{seats} {seats === 1 ? 'seat' : 'seats'}</span>
                          </div>
                        ))}
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <div className="text-xs text-gray-500 mt-2">
                        <p>Electoral data updated as of last general election.</p>
                        <p className="mt-1">Source: Electoral Commission</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-700 mb-1">No Constituency Selected</h3>
                  <p className="text-gray-500 text-sm">
                    Click on a constituency on the map to view its details and election results.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend card */}
          <Card className="shadow-lg mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Map Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(PARTY_COLORS).map(([party, color]) => (
                  <div key={party} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: color }}
                    ></div>
                    <span>{party}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Colors represent the dominant party in each constituency
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OfficialElectoralMapPage;