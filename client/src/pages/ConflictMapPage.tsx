import { useState } from "react";
import { Helmet } from "react-helmet";
import ConflictTrackingMap from "@/components/ConflictTrackingMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const ConflictMapPage = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Helmet>
        <title>Global Conflict Tracker | Glas Politics</title>
        <meta name="description" content="Interactive map showing real-time tracking of major global conflicts and geopolitical tensions" />
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Global Conflict Tracker</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Monitor and understand major conflicts and geopolitical tensions around the world
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg shadow-md flex items-center">
            <span className="inline-block w-3 h-3 rounded-full bg-red-400 mr-2 animate-pulse"></span>
            <span className="font-medium">Live Updates</span>
          </div>
        </div>
        
        {/* Introduction Card */}
        <Card className="bg-white dark:bg-gray-800 shadow-md">
          <CardContent className="p-6">
            <p className="mb-4">
              The Global Conflict Tracker provides a comprehensive overview of ongoing conflicts, civil wars, 
              territorial disputes, and other significant geopolitical tensions worldwide. This interactive 
              tool allows you to visualize conflict hotspots and access detailed information about each situation.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="flex items-start">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                    <path d="M12 2a10 10 0 1 0 10 10H12V2Z"/>
                    <path d="M21 12a9 9 0 0 0-9-9v9h9Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Real-time Data</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Updated daily from international monitoring organizations and official sources
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Detailed Insights</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Access comprehensive information including casualty statistics and conflict dynamics
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400">
                    <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
                    <polyline points="10 22 12 16 14 22"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Interactive Map</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Zoom into specific regions or filter by conflict type and intensity
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Conflict Map */}
        <div className="h-[800px]">
          <ConflictTrackingMap height={750} />
        </div>
        
        {/* Additional Context */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="bg-white dark:bg-gray-800 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Understanding Conflict Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-red-500 mr-2"></div>
                  <div>
                    <h3 className="font-medium mb-1">Active Conflicts</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Ongoing military engagements with regular fighting and casualties
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-orange-500 mr-2"></div>
                  <div>
                    <h3 className="font-medium mb-1">Escalating Situations</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Conflicts showing increased violence or territorial expansion
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-green-500 mr-2"></div>
                  <div>
                    <h3 className="font-medium mb-1">De-escalating Situations</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Conflicts with active peace processes or decreasing violence
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-blue-500 mr-2"></div>
                  <div>
                    <h3 className="font-medium mb-1">Frozen Conflicts</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Disputes with ceasefire agreements but unresolved political issues
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-gray-800 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold">Data Sources & Methodology</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Our conflict data is compiled from multiple reputable sources and updated regularly to ensure accuracy.
                Key sources include:
              </p>
              
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                  <span>United Nations peacekeeping mission reports and situation updates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                  <span>International Crisis Group conflict tracking database</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                  <span>Human Rights Watch and Amnesty International reports</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                  <span>Regional organizations (EU, AU, ASEAN) reports</span>
                </li>
                <li className="flex items-start">
                  <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                  <span>Verified media reports and governmental statements</span>
                </li>
              </ul>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Our intensity ratings (1-10) are based on a combined assessment of casualty rates, geographical spread, 
                  infrastructure damage, population displacement, and international involvement.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConflictMapPage;