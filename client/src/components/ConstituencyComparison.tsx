import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import MultiSelectConstituencies from './MultiSelectConstituencies';
import ConstituencyMap from './ConstituencyMap';

interface ConstituencyComparisonProps {
  constituencies: ConstituencyData[];
}

interface ConstituencyData {
  name: string;
  nameIrish?: string;
  seats: number;
  parties: {
    name: string;
    votes: number;
    seats: number;
    color: string;
    percent: number;
  }[];
  turnout: number;
  economicScore?: number;
  socialScore?: number;
  issues?: {
    [key: string]: {
      support: number;
      opposition: number;
    };
  };
}

const ConstituencyComparison: React.FC<ConstituencyComparisonProps> = ({ constituencies }) => {
  const [activeTab, setActiveTab] = useState('parties');
  const [selectedConstituencies, setSelectedConstituencies] = useState<string[]>([]);
  const [selectedIssue, setSelectedIssue] = useState('housing');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constituencyData, setConstituencyData] = useState<Record<string, ConstituencyData>>({});

  // Key issues for comparing constituencies
  const issues = [
    { id: 'housing', name: 'Housing Crisis' },
    { id: 'healthcare', name: 'Healthcare Reform' },
    { id: 'climate', name: 'Climate Action' },
    { id: 'economy', name: 'Economic Policy' },
    { id: 'education', name: 'Education Funding' },
    { id: 'immigration', name: 'Immigration Policy' }
  ];

  // Load available constituencies
  useEffect(() => {
    if (constituencies.length > 0) {
      // Set first three constituencies as selected by default
      if (constituencies.length >= 3) {
        setSelectedConstituencies([
          constituencies[0].name, 
          constituencies[1].name,
          constituencies[2].name
        ]);
      } else if (constituencies.length >= 2) {
        setSelectedConstituencies([constituencies[0].name, constituencies[1].name]);
      }
      
      // Set up constituency data
      const data: Record<string, ConstituencyData> = {};
      constituencies.forEach(constituency => {
        data[constituency.name] = constituency;
      });
      setConstituencyData(data);
      
      // Log how many constituencies we have
      console.log(`Loaded ${constituencies.length} constituencies for comparison`);
    }
  }, [constituencies]);

  // Calculate the max value for proper scaling
  const getMaxPartyPercent = () => {
    let max = 0;
    Object.values(constituencyData).forEach(constituency => {
      constituency.parties.forEach(party => {
        if (party.percent > max) max = party.percent;
      });
    });
    return Math.ceil(max / 10) * 10; // Round up to nearest 10
  };

  // Calculate max issue support/opposition
  const getMaxIssueValue = () => {
    let max = 0;
    Object.values(constituencyData).forEach(constituency => {
      if (constituency.issues && constituency.issues[selectedIssue]) {
        const issue = constituency.issues[selectedIssue];
        if (issue.support > max) max = issue.support;
        if (issue.opposition > max) max = issue.opposition;
      }
    });
    return Math.ceil(max / 10) * 10; // Round up to nearest 10
  };

  // Render party comparison
  const renderPartyComparison = () => {
    if (selectedConstituencies.length === 0) {
      return (
        <Alert>
          <AlertDescription>
            Please select at least one constituency to view party data.
          </AlertDescription>
        </Alert>
      );
    }

    // Get all unique parties across ALL constituencies for color consistency
    const allParties = new Set<string>();
    Object.values(constituencyData).forEach(constituency => {
      constituency.parties.forEach(party => {
        allParties.add(party.name);
      });
    });

    const maxPercent = getMaxPartyPercent();

    // Create a color legend for all parties
    const partyColors = Array.from(allParties).map(partyName => {
      // Find the first occurrence of this party to get its color
      let color = "#CCCCCC"; // Default color
      for (const constituency of Object.values(constituencyData)) {
        const party = constituency.parties.find(p => p.name === partyName);
        if (party) {
          color = party.color;
          break;
        }
      }
      return { name: partyName, color };
    });

    return (
      <div className="space-y-4">
        {/* Party color legend */}
        <div className="mb-4 p-3 border rounded-md bg-background/50">
          <h4 className="font-medium mb-2">Party Color Legend</h4>
          <div className="flex flex-wrap gap-2">
            {partyColors.map(party => (
              <div key={party.name} className="flex items-center gap-1.5 text-sm">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: party.color }}
                />
                <span>{party.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Percentages shown represent vote share from the most recent election
          </p>
        </div>

        {Array.from(allParties).map(partyName => (
          <div key={partyName} className="space-y-1">
            <div className="font-medium">{partyName}</div>
            <div className="grid grid-cols-1 gap-2">
              {selectedConstituencies.map(constituencyName => {
                const constituency = constituencyData[constituencyName];
                const party = constituency?.parties.find(p => p.name === partyName);
                
                return (
                  <div key={constituencyName} className="flex items-center space-x-2">
                    <div className="w-32 text-sm">{constituencyName}</div>
                    {party ? (
                      <>
                        <div className="bg-gray-200 dark:bg-gray-600 h-3 rounded-full overflow-hidden flex-1">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${(party.percent / maxPercent) * 100}%`,
                              backgroundColor: party.color
                            }}
                          />
                        </div>
                        <div className="w-12 text-sm text-right">{party.percent}%</div>
                        <div className="w-12 text-sm text-right">{party.seats} seats</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">No data</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render issues comparison
  const renderIssuesComparison = () => {
    if (selectedConstituencies.length === 0) {
      return (
        <Alert>
          <AlertDescription>
            Please select at least one constituency to view issue data.
          </AlertDescription>
        </Alert>
      );
    }

    const maxValue = getMaxIssueValue();

    return (
      <div className="space-y-4">
        <div className="mb-4 p-3 border rounded-md bg-background/50">
          <h4 className="font-medium mb-2">Issues Legend</h4>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Support</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Opposition</span>
            </div>
          </div>
        </div>
      
        <div className="flex space-x-2 mb-4">
          <Select value={selectedIssue} onValueChange={setSelectedIssue}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select an issue" />
            </SelectTrigger>
            <SelectContent>
              {issues.map(issue => (
                <SelectItem key={issue.id} value={issue.id}>
                  {issue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-6">
          <div>
            <div className="font-medium mb-2">Support for {issues.find(i => i.id === selectedIssue)?.name || selectedIssue}</div>
            {selectedConstituencies.map(constituencyName => {
              const constituency = constituencyData[constituencyName];
              const issueData = constituency?.issues?.[selectedIssue];
              
              return (
                <div key={`${constituencyName}-support`} className="flex items-center space-x-2 mb-2">
                  <div className="w-32 text-sm">{constituencyName}</div>
                  {issueData ? (
                    <>
                      <Progress 
                        value={(issueData.support / maxValue) * 100} 
                        className="h-3 bg-green-500" 
                      />
                      <div className="w-12 text-sm text-right">{issueData.support}%</div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">No data</div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <div className="font-medium mb-2">Opposition to {issues.find(i => i.id === selectedIssue)?.name || selectedIssue}</div>
            {selectedConstituencies.map(constituencyName => {
              const constituency = constituencyData[constituencyName];
              const issueData = constituency?.issues?.[selectedIssue];
              
              return (
                <div key={`${constituencyName}-opposition`} className="flex items-center space-x-2 mb-2">
                  <div className="w-32 text-sm">{constituencyName}</div>
                  {issueData ? (
                    <>
                      <Progress 
                        value={(issueData.opposition / maxValue) * 100} 
                        className="h-3 bg-red-500" 
                      />
                      <div className="w-12 text-sm text-right">{issueData.opposition}%</div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">No data</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render economic/social comparison
  const renderPoliticalComparison = () => {
    if (selectedConstituencies.length === 0) {
      return (
        <Alert>
          <AlertDescription>
            Please select at least one constituency to view political data.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6">


        
        {/* User Comparison Section */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold mb-4">User Political Alignment</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This section compares the political positions of constituency residents who have taken the political quiz.
          </p>
          
          {selectedConstituencies.map(constituencyName => (
            <div key={`${constituencyName}-user-comparison`} className="mb-8">
              <h4 className="font-medium text-sm mb-3">{constituencyName} - Political Compass</h4>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                <div className="space-y-8">
                  <div className="text-center text-xs text-muted-foreground mb-2">Progressive</div>
                  
                  <div className="flex">
                    <div className="text-xs text-muted-foreground mr-2 self-center">Left</div>
                    
                    <div className="flex-1 relative h-48 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      {/* Center lines */}
                      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gray-400" />
                      <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-400" />
                      
                      {/* Economic-Social positions quadrant visualization */}
                      
                      {/* Constituency Position */}
                      {constituencyData[constituencyName]?.economicScore !== undefined && constituencyData[constituencyName]?.socialScore !== undefined && (
                        <div 
                          className="absolute w-4 h-4 bg-blue-500 rounded-full"
                          style={{
                            left: `calc(${((constituencyData[constituencyName].economicScore! + 10) / 20) * 100}% - 8px)`,
                            top: `calc(${((constituencyData[constituencyName].socialScore! + 10) / 20) * 100}% - 8px)`,
                            zIndex: 20
                          }}
                        />
                      )}
                      
                      {/* User Average Position (placeholder for now) */}
                      <div 
                        className="absolute w-4 h-4 bg-red-500 rounded-full opacity-40"
                        style={{
                          left: `calc(50% - 8px)`,
                          top: `calc(50% - 8px)`,
                          zIndex: 10
                        }}
                      />
                      
                      {/* Quadrant labels */}
                      <div className="absolute top-1 left-1 text-[10px] text-muted-foreground">Left-Progressive</div>
                      <div className="absolute top-1 right-1 text-[10px] text-muted-foreground text-right">Right-Progressive</div>
                      <div className="absolute bottom-1 left-1 text-[10px] text-muted-foreground">Left-Conservative</div>
                      <div className="absolute bottom-1 right-1 text-[10px] text-muted-foreground text-right">Right-Conservative</div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground ml-2 self-center">Right</div>
                  </div>
                  
                  <div className="text-center text-xs text-muted-foreground mt-2">Conservative</div>
                  
                  <div className="flex items-center justify-center text-sm text-muted-foreground">
                    <div className="flex items-center mr-4">
                      <div className="w-3 h-3 bg-blue-500 mr-1 rounded-full"></div>
                      <span>Constituency Position</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 opacity-40 mr-1 rounded-full"></div>
                      <span>Users (no data yet)</span>
                    </div>
                  </div>
                  
                  {constituencyData[constituencyName]?.economicScore !== undefined && constituencyData[constituencyName]?.socialScore !== undefined && (
                    <div className="text-sm text-center space-y-2">
                      <p>Constituency Score: <span className="font-medium">{constituencyData[constituencyName].economicScore > 0 ? '+' : ''}{constituencyData[constituencyName].economicScore.toFixed(1)}</span> Economic, <span className="font-medium">{constituencyData[constituencyName].socialScore > 0 ? '+' : ''}{constituencyData[constituencyName].socialScore.toFixed(1)}</span> Social</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>How it's calculated:</strong> Constituency position is based on election results and party alignments. 
                        The blue dot shows where this constituency falls on the political compass based on voting patterns. 
                        The red dot will represent the average political position of users from this constituency who have taken the quiz.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Constituencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select multiple constituencies to compare their political landscapes.
              </p>
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <MultiSelectConstituencies 
                    constituencies={constituencies}
                    selectedConstituencies={selectedConstituencies}
                    onChange={setSelectedConstituencies}
                  />
                  
                  {/* Constituency Map */}
                  <div className="mt-5">
                    <p className="text-sm text-muted-foreground mb-2">
                      Click on a constituency in the map to select it.
                    </p>
                    <ConstituencyMap 
                      selectedConstituencies={selectedConstituencies}
                      constituencyData={constituencyData}
                      onConstituencySelect={(name) => {
                        if (selectedConstituencies.includes(name)) {
                          // Remove if already selected
                          setSelectedConstituencies(selectedConstituencies.filter(c => c !== name));
                        } else {
                          // Add if not selected yet (up to a reasonable limit)
                          if (selectedConstituencies.length < 5) {
                            setSelectedConstituencies([...selectedConstituencies, name]);
                          }
                        }
                      }}
                    />
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-[#ffff00]"></div>
                        <span>3 Seats</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-[#e188e1]"></div>
                        <span>4 Seats</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-[#ff5555]"></div>
                        <span>5 Seats</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Comparison View</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="parties">Parties</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="political">Political</TabsTrigger>
              </TabsList>
              
              <TabsContent value="parties" className="space-y-4">
                {renderPartyComparison()}
              </TabsContent>
              
              <TabsContent value="issues" className="space-y-4">
                {renderIssuesComparison()}
              </TabsContent>
              
              <TabsContent value="political" className="space-y-4">
                {renderPoliticalComparison()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConstituencyComparison;