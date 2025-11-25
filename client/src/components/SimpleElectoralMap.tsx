import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface SimpleElectoralMapProps {
  height?: number;
}

// Ireland's constituencies (electoral districts)
const constituencies = [
  { id: 'carlow-kilkenny', name: 'Carlow–Kilkenny', seats: 5, province: 'Leinster' },
  { id: 'cavan-monaghan', name: 'Cavan–Monaghan', seats: 5, province: 'Ulster' },
  { id: 'clare', name: 'Clare', seats: 4, province: 'Munster' },
  { id: 'cork-east', name: 'Cork East', seats: 4, province: 'Munster' },
  { id: 'cork-north-central', name: 'Cork North-Central', seats: 4, province: 'Munster' },
  { id: 'cork-north-west', name: 'Cork North-West', seats: 3, province: 'Munster' },
  { id: 'cork-south-central', name: 'Cork South-Central', seats: 4, province: 'Munster' },
  { id: 'cork-south-west', name: 'Cork South-West', seats: 3, province: 'Munster' },
  { id: 'donegal', name: 'Donegal', seats: 5, province: 'Ulster' },
  { id: 'dublin-bay-north', name: 'Dublin Bay North', seats: 5, province: 'Leinster' },
  { id: 'dublin-bay-south', name: 'Dublin Bay South', seats: 4, province: 'Leinster' },
  { id: 'dublin-central', name: 'Dublin Central', seats: 4, province: 'Leinster' },
  { id: 'dublin-fingal', name: 'Dublin Fingal', seats: 5, province: 'Leinster' },
  { id: 'dublin-mid-west', name: 'Dublin Mid-West', seats: 4, province: 'Leinster' },
  { id: 'dublin-north-west', name: 'Dublin North-West', seats: 3, province: 'Leinster' },
  { id: 'dublin-rathdown', name: 'Dublin Rathdown', seats: 3, province: 'Leinster' },
  { id: 'dublin-south-central', name: 'Dublin South-Central', seats: 4, province: 'Leinster' },
  { id: 'dublin-south-west', name: 'Dublin South-West', seats: 5, province: 'Leinster' },
  { id: 'dublin-west', name: 'Dublin West', seats: 4, province: 'Leinster' },
  { id: 'dun-laoghaire', name: 'Dún Laoghaire', seats: 4, province: 'Leinster' },
  { id: 'galway-east', name: 'Galway East', seats: 3, province: 'Connacht' },
  { id: 'galway-west', name: 'Galway West', seats: 5, province: 'Connacht' },
  { id: 'kerry', name: 'Kerry', seats: 5, province: 'Munster' },
  { id: 'kildare-north', name: 'Kildare North', seats: 4, province: 'Leinster' },
  { id: 'kildare-south', name: 'Kildare South', seats: 4, province: 'Leinster' },
  { id: 'laois-offaly', name: 'Laois–Offaly', seats: 5, province: 'Leinster' },
  { id: 'limerick-city', name: 'Limerick City', seats: 4, province: 'Munster' },
  { id: 'limerick-county', name: 'Limerick County', seats: 3, province: 'Munster' },
  { id: 'longford-westmeath', name: 'Longford–Westmeath', seats: 4, province: 'Leinster' },
  { id: 'louth', name: 'Louth', seats: 5, province: 'Leinster' },
  { id: 'mayo', name: 'Mayo', seats: 4, province: 'Connacht' },
  { id: 'meath-east', name: 'Meath East', seats: 3, province: 'Leinster' },
  { id: 'meath-west', name: 'Meath West', seats: 3, province: 'Leinster' },
  { id: 'roscommon-galway', name: 'Roscommon–Galway', seats: 3, province: 'Connacht' },
  { id: 'sligo-leitrim', name: 'Sligo–Leitrim', seats: 4, province: 'Connacht' },
  { id: 'tipperary', name: 'Tipperary', seats: 5, province: 'Munster' },
  { id: 'waterford', name: 'Waterford', seats: 4, province: 'Munster' },
  { id: 'wexford', name: 'Wexford', seats: 5, province: 'Leinster' },
  { id: 'wicklow', name: 'Wicklow', seats: 5, province: 'Leinster' }
];

// Irish counties
const counties = [
  { name: 'Antrim', province: 'Ulster' },
  { name: 'Armagh', province: 'Ulster' },
  { name: 'Carlow', province: 'Leinster' },
  { name: 'Cavan', province: 'Ulster' },
  { name: 'Clare', province: 'Munster' },
  { name: 'Cork', province: 'Munster' },
  { name: 'Derry', province: 'Ulster' },
  { name: 'Donegal', province: 'Ulster' },
  { name: 'Down', province: 'Ulster' },
  { name: 'Dublin', province: 'Leinster' },
  { name: 'Fermanagh', province: 'Ulster' },
  { name: 'Galway', province: 'Connacht' },
  { name: 'Kerry', province: 'Munster' },
  { name: 'Kildare', province: 'Leinster' },
  { name: 'Kilkenny', province: 'Leinster' },
  { name: 'Laois', province: 'Leinster' },
  { name: 'Leitrim', province: 'Connacht' },
  { name: 'Limerick', province: 'Munster' },
  { name: 'Longford', province: 'Leinster' },
  { name: 'Louth', province: 'Leinster' },
  { name: 'Mayo', province: 'Connacht' },
  { name: 'Meath', province: 'Leinster' },
  { name: 'Monaghan', province: 'Ulster' },
  { name: 'Offaly', province: 'Leinster' },
  { name: 'Roscommon', province: 'Connacht' },
  { name: 'Sligo', province: 'Connacht' },
  { name: 'Tipperary', province: 'Munster' },
  { name: 'Tyrone', province: 'Ulster' },
  { name: 'Waterford', province: 'Munster' },
  { name: 'Westmeath', province: 'Leinster' },
  { name: 'Wexford', province: 'Leinster' },
  { name: 'Wicklow', province: 'Leinster' }
];

// Irish provinces
const provinces = [
  { name: 'Connacht', counties: 5, color: 'bg-green-100 dark:bg-green-900' },
  { name: 'Leinster', counties: 12, color: 'bg-blue-100 dark:bg-blue-900' },
  { name: 'Munster', counties: 6, color: 'bg-pink-100 dark:bg-pink-900' },
  { name: 'Ulster', counties: 9, color: 'bg-amber-100 dark:bg-amber-900' }
];

const SimpleElectoralMap: React.FC<SimpleElectoralMapProps> = ({ height = 600 }) => {
  const [activeTab, setActiveTab] = useState<'constituencies' | 'counties' | 'provinces'>('constituencies');
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter constituencies based on search query and/or selected province
  const filteredConstituencies = constituencies.filter(constituency => {
    const matchesSearch = searchQuery === '' || 
      constituency.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvince = !selectedProvince || constituency.province === selectedProvince;
    return matchesSearch && matchesProvince;
  });

  // Filter counties based on search query and/or selected province
  const filteredCounties = counties.filter(county => {
    const matchesSearch = searchQuery === '' || 
      county.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvince = !selectedProvince || county.province === selectedProvince;
    return matchesSearch && matchesProvince;
  });

  const handleProvinceClick = (provinceName: string) => {
    setSelectedProvince(selectedProvince === provinceName ? null : provinceName);
  };

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-md overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Ireland Electoral Map</CardTitle>
          <Badge variant="outline" className="ml-2">
            Interactive
          </Badge>
        </div>
        <CardDescription>
          Explore Ireland's electoral divisions, counties, and provinces
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue="constituencies" 
          className="w-full" 
          onValueChange={(v) => {
            setActiveTab(v as any);
            setSelectedProvince(null);
            setSearchQuery('');
          }}
          value={activeTab}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="constituencies">Electoral Constituencies</TabsTrigger>
            <TabsTrigger value="counties">Counties</TabsTrigger>
            <TabsTrigger value="provinces">Provinces</TabsTrigger>
          </TabsList>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Province filter */}
          {activeTab !== 'provinces' && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 my-auto">Filter by province:</span>
              {provinces.map((province) => (
                <button
                  key={province.name}
                  onClick={() => handleProvinceClick(province.name)}
                  className={`px-3 py-1 text-sm font-medium rounded-full transition-colors
                    ${selectedProvince === province.name
                      ? `${province.color} text-gray-900 dark:text-white`
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {province.name}
                </button>
              ))}
              {selectedProvince && (
                <button
                  onClick={() => setSelectedProvince(null)}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
          
          <TabsContent value="constituencies" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ireland has 39 Dáil constituencies that elect 160 TDs (members of parliament).
            </div>
            
            <div style={{ height: `${height - 220}px`, overflowY: 'auto' }} className="pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConstituencies.map((constituency) => (
                  <div key={constituency.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow dark:border-gray-700">
                    <h3 className="font-bold">{constituency.name}</h3>
                    <div className="mt-1 text-sm">
                      <div className="flex justify-between">
                        <span>Seats:</span>
                        <span className="font-medium">{constituency.seats}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Province:</span>
                        <span className={`font-medium rounded px-2 ${
                          constituency.province === 'Connacht' ? 'bg-green-100 dark:bg-green-900' :
                          constituency.province === 'Leinster' ? 'bg-blue-100 dark:bg-blue-900' :
                          constituency.province === 'Munster' ? 'bg-pink-100 dark:bg-pink-900' :
                          'bg-amber-100 dark:bg-amber-900'
                        }`}>{constituency.province}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredConstituencies.length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                  No constituencies match your search criteria.
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="counties" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ireland has 32 counties across the island, with 26 in the Republic of Ireland and 6 in Northern Ireland.
            </div>
            
            <div style={{ height: `${height - 220}px`, overflowY: 'auto' }} className="pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredCounties.map((county) => (
                  <div key={county.name} className="border rounded-lg p-4 hover:shadow-md transition-shadow dark:border-gray-700">
                    <h3 className="font-bold">{county.name}</h3>
                    <div className="mt-1 text-sm">
                      <div className="flex justify-between">
                        <span>Province:</span>
                        <span className={`font-medium rounded px-2 ${
                          county.province === 'Connacht' ? 'bg-green-100 dark:bg-green-900' :
                          county.province === 'Leinster' ? 'bg-blue-100 dark:bg-blue-900' :
                          county.province === 'Munster' ? 'bg-pink-100 dark:bg-pink-900' :
                          'bg-amber-100 dark:bg-amber-900'
                        }`}>{county.province}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredCounties.length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                  No counties match your search criteria.
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="provinces" className="mt-0">
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              Ireland has four historic provinces: Connacht (west), Leinster (east), Munster (south), and Ulster (north).
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {provinces.map((province) => (
                <div 
                  key={province.name} 
                  className={`${province.color} rounded-lg p-6 hover:shadow-lg transition-shadow`}
                >
                  <h3 className="text-xl font-bold">{province.name}</h3>
                  <p className="mt-2">
                    {province.name === 'Connacht' && 'Located in western Ireland, historically comprising counties Galway, Leitrim, Mayo, Roscommon, and Sligo.'}
                    {province.name === 'Leinster' && 'Located in eastern Ireland, including Dublin, it is the most populous province with 12 counties.'}
                    {province.name === 'Munster' && 'Located in southern Ireland, comprising counties Clare, Cork, Kerry, Limerick, Tipperary, and Waterford.'}
                    {province.name === 'Ulster' && 'Located in northern Ireland, with 3 counties in the Republic and 6 in Northern Ireland.'}
                  </p>
                  <div className="mt-4 flex justify-between">
                    <div>
                      <span className="font-medium">Total Counties:</span> {province.counties}
                    </div>
                    <button 
                      onClick={() => {
                        setActiveTab('counties');
                        setSelectedProvince(province.name);
                      }}
                      className="text-sm font-medium underline hover:no-underline"
                    >
                      View Counties
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 border-t pt-4 border-gray-200 dark:border-gray-700">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Ireland_location_provinces.svg/640px-Ireland_location_provinces.svg.png" 
                alt="Map of Irish provinces" 
                className="mx-auto max-w-full h-auto rounded-lg shadow-md" 
                style={{ maxHeight: '300px' }}
              />
              <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                Map of Ireland's four provinces
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          Data sourced from Electoral Commission Ireland and the Central Statistics Office.
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleElectoralMap;