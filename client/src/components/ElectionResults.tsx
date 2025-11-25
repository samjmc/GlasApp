import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Party {
  partyId: number;
  name: string;
  color: string;
  votes: number;
  percentage: number;
  seats: number;
}

interface Constituency {
  constituencyId: number;
  name: string;
  totalSeats: number;
  parties: Party[];
}

interface Election {
  id: number;
  name: string;
  date: string;
  type: string;
  turnout: number;
  description: string;
}

interface ElectionSummary {
  totalVotes: number;
  totalSeats: number;
  parties: Party[];
}

interface ElectionResultsProps {
  electionId?: number;
}

const ElectionResults: React.FC<ElectionResultsProps> = ({ electionId = 1 }) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<number | null>(electionId);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [selectedConstituency, setSelectedConstituency] = useState<string | null>(null);
  const [summary, setSummary] = useState<ElectionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('summary');

  // Fetch available elections
  useEffect(() => {
    const fetchElections = async () => {
      try {
        const response = await fetch('/api/elections');
        const data = await response.json();

        if (data.success) {
          setElections(data.data);
        } else {
          setError('Failed to fetch elections');
        }
      } catch (err) {
        setError('Error connecting to server');
        console.error(err);
      }
    };

    fetchElections();
  }, []);

  // Fetch election data when selected election changes
  useEffect(() => {
    if (!selectedElection) return;

    const fetchElectionData = async () => {
      setLoading(true);
      try {
        // Fetch election results
        const response = await fetch(`/api/elections/${selectedElection}/results`);
        const data = await response.json();

        if (data.success) {
          setConstituencies(data.constituencies);
          
          // Set first constituency as selected by default
          if (data.constituencies.length > 0 && !selectedConstituency) {
            setSelectedConstituency(data.constituencies[0].name);
          }
          
          // Fetch summary data
          const summaryResponse = await fetch(`/api/elections/${selectedElection}/summary`);
          const summaryData = await summaryResponse.json();
          
          if (summaryData.success) {
            setSummary(summaryData.summary);
          }
          
          setError(null);
        } else {
          setError('Failed to fetch election results');
        }
      } catch (err) {
        setError('Error connecting to server');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchElectionData();
  }, [selectedElection]);

  // Handle election selection change
  const handleElectionChange = (value: string) => {
    setSelectedElection(parseInt(value));
  };

  // Handle constituency selection change
  const handleConstituencyChange = (value: string) => {
    setSelectedConstituency(value);
  };

  // Get current constituency data
  const getCurrentConstituency = () => {
    if (!selectedConstituency) return null;
    return constituencies.find(c => c.name === selectedConstituency) || null;
  };

  // Format data for bar chart
  const formatPartyData = (parties: Party[]) => {
    return parties.map(party => ({
      name: party.name,
      votes: party.votes,
      percentage: party.percentage,
      seats: party.seats,
      color: party.color
    }));
  };

  if (loading && elections.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-full" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentConstituency = getCurrentConstituency();
  const currentElection = elections.find(e => e.id === selectedElection);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle>Irish Election Results</CardTitle>
            <CardDescription>
              {currentElection ? currentElection.name : 'Select an election to view results'}
            </CardDescription>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Select
              value={selectedElection?.toString()}
              onValueChange={handleElectionChange}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select Election" />
              </SelectTrigger>
              <SelectContent>
                {elections.map(election => (
                  <SelectItem key={election.id} value={election.id.toString()}>
                    {election.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select
              value={selectedConstituency || ""}
              onValueChange={handleConstituencyChange}
              disabled={activeTab !== 'constituencies' || loading}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select Constituency" />
              </SelectTrigger>
              <SelectContent>
                {constituencies.map(constituency => (
                  <SelectItem key={constituency.name} value={constituency.name}>
                    {constituency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex mb-6">
            <TabsTrigger value="summary" className="flex-1">National Summary</TabsTrigger>
            <TabsTrigger value="constituencies" className="flex-1">Constituency Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-6">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : summary ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-secondary/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Total Seats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{summary.totalSeats}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-secondary/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Total Votes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{summary.totalVotes.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-secondary/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl">Turnout</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">
                        {currentElection?.turnout ? `${currentElection.turnout}%` : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Party Performance</h3>
                  <div className="overflow-x-auto">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart
                        data={formatPartyData(summary.parties)}
                        margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis yAxisId="left" label={{ value: 'Seats', angle: -90, position: 'insideLeft' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Percentage (%)', angle: 90, position: 'insideRight' }} />
                        <Tooltip formatter={(value, name) => [value, name === 'percentage' ? 'Vote %' : name]} />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="seats"
                          name="Seats"
                          fill="#4f46e5"
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="percentage"
                          name="Vote %"
                          fill="#10b981"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">National Results</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-secondary/20">
                          <th className="border p-2 text-left">Party</th>
                          <th className="border p-2 text-right">Seats</th>
                          <th className="border p-2 text-right">Votes</th>
                          <th className="border p-2 text-right">Vote %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.parties.map((party, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-secondary/5' : ''}>
                            <td className="border p-2 flex items-center">
                              <div
                                className="w-4 h-4 rounded-full mr-2"
                                style={{ backgroundColor: party.color }}
                              />
                              {party.name}
                            </td>
                            <td className="border p-2 text-right font-semibold">{party.seats}</td>
                            <td className="border p-2 text-right">{party.votes.toLocaleString()}</td>
                            <td className="border p-2 text-right">{typeof party.percentage === 'number' ? party.percentage.toFixed(1) : party.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <p>No summary data available</p>
            )}
          </TabsContent>
          
          <TabsContent value="constituencies" className="space-y-6">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : currentConstituency ? (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                    <h3 className="text-xl font-semibold">{currentConstituency.name}</h3>
                    <p className="text-muted-foreground">Total Seats: {currentConstituency.totalSeats}</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={formatPartyData(currentConstituency.parties)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [value, name === 'percentage' ? 'Vote %' : name]} />
                      <Legend />
                      <Bar
                        dataKey="percentage"
                        name="Vote %"
                        fill="#10b981"
                      />
                      <Bar
                        dataKey="seats"
                        name="Seats"
                        fill="#4f46e5"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">Constituency Results</h3>
                  <div className="space-y-3">
                    {currentConstituency.parties.map((party, index) => (
                      <div key={index} className="p-4 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                              style={{ backgroundColor: party.color }}
                            >
                              {party.seats > 0 ? party.seats : ''}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-base">{party.name}</span>
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {party.seats} {party.seats === 1 ? 'seat' : 'seats'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-base">{typeof party.percentage === 'number' ? party.percentage.toFixed(1) : party.percentage}%</span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {party.votes.toLocaleString()} votes
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${party.percentage}%`,
                              backgroundColor: party.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    Total valid votes: {currentConstituency.parties.reduce((sum, party) => sum + party.votes, 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <p>Please select a constituency to view results</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ElectionResults;