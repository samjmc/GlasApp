import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeafletIrelandMap from '../components/LeafletIrelandMap';
import { ElectoralDistrictsPage } from '../pages/ElectoralDistrictsPage';
import { constituencyData } from '../assets/constituency-simplified';
import { ElectoralDistrictDetailView } from '../components/ElectoralDistrictDetailView';

const UnifiedMapPage: React.FC = () => {
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  
  return (
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Ireland Interactive Maps</h1>
      
      <Tabs defaultValue="provinces" className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="provinces">Provinces & Counties</TabsTrigger>
          <TabsTrigger value="electoral">Electoral Districts</TabsTrigger>
          <TabsTrigger value="interactive">Interactive</TabsTrigger>
        </TabsList>
        
        {/* Provinces and Counties Tab */}
        <TabsContent value="provinces" className="mt-0">
          <Card>
            <CardHeader className="bg-blue-700 text-white p-4">
              <CardTitle>Ireland Provinces and Counties</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LeafletIrelandMap height={600} />
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Electoral Districts Tab */}
        <TabsContent value="electoral" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card className="shadow-lg">
                <CardHeader className="bg-blue-700 text-white p-4">
                  <CardTitle>Electoral Constituencies</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <LeafletIrelandMap 
                    height={500} 
                    initialTab="electoral"
                    onConstituencySelect={(name) => setSelectedConstituency(name)}
                  />
                </CardContent>
              </Card>
            </div>
            
            <div>
              {selectedConstituency && constituencyData[selectedConstituency] ? (
                <ElectoralDistrictDetailView 
                  constituencyName={selectedConstituency}
                  constituencyData={constituencyData[selectedConstituency]}
                />
              ) : (
                <Card className="shadow-lg">
                  <CardHeader className="bg-blue-700 text-white p-4">
                    <CardTitle>Constituency Information</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 text-center">
                    <div className="py-12">
                      <h3 className="text-xl font-medium mb-2">Select a constituency</h3>
                      <p className="text-gray-600">
                        Click on any constituency on the map to view detailed information.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="mt-4">
                <Card className="shadow-lg">
                  <CardHeader className="bg-blue-700 text-white p-4">
                    <CardTitle>General Election Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-r pr-4">
                        <h3 className="text-lg font-medium mb-1">Constituencies</h3>
                        <span className="text-2xl font-bold">43</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium mb-1">Total Seats</h3>
                        <span className="text-2xl font-bold">174</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Interactive Map Tab */}
        <TabsContent value="interactive" className="mt-0">
          <Card>
            <CardHeader className="bg-blue-700 text-white p-4">
              <CardTitle>Interactive Ireland Map</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <LeafletIrelandMap height={500} interactive={true} initialTab="all" />
                </div>
                <div>
                  <Card className="shadow-lg">
                    <CardHeader className="bg-blue-700 text-white p-4">
                      <CardTitle>Map Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <p className="mb-4">Interactive features:</p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>Click on counties or constituencies for details</li>
                        <li>Zoom in/out to explore different regions</li>
                        <li>Toggle between county and electoral views</li>
                        <li>Hover over areas to see basic information</li>
                      </ul>
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-lg mt-4">
                    <CardHeader className="bg-blue-700 text-white p-4">
                      <CardTitle>Data Sources</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <p>Map data is based on:</p>
                      <ul className="list-disc pl-5 mt-2">
                        <li>OpenStreetMap</li>
                        <li>Irish Electoral Commission</li>
                        <li>Central Statistics Office</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnifiedMapPage;