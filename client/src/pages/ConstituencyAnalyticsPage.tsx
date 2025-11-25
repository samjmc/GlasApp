import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Users, MapPin, TrendingUp } from "lucide-react";
import Header from "@/components/Header";

interface ConstituencyStats {
  constituency: string;
  userCount: number;
}

interface ConstituencyUser {
  firebaseUid: string;
  constituency: string;
  county: string;
  createdAt: string;
}

export default function ConstituencyAnalyticsPage() {
  const [selectedConstituency, setSelectedConstituency] = useState<string>("");

  // Fetch constituency statistics
  const { data: stats = [], isLoading: statsLoading } = useQuery<ConstituencyStats[]>({
    queryKey: ["/api/location/stats/constituencies"],
  });

  // Fetch users in selected constituency
  const { data: constituencyUsers = [], isLoading: usersLoading } = useQuery<ConstituencyUser[]>({
    queryKey: ["/api/location/users/by-constituency", selectedConstituency],
    enabled: !!selectedConstituency,
  });

  const totalUsers = stats.reduce((sum, stat) => sum + stat.userCount, 0);
  const topConstituencies = stats.slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Constituency Analytics
          </h1>
          <p className="text-gray-600">
            Analyze user distribution across Irish constituencies
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all constituencies
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Constituencies</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.length}</div>
                  <p className="text-xs text-muted-foreground">
                    With registered users
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Top Constituency</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {topConstituencies[0]?.constituency || "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {topConstituencies[0]?.userCount || 0} users
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top Constituencies Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Constituencies by User Count</CardTitle>
                <CardDescription>
                  Distribution of users across constituencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-muted-foreground">Loading analytics...</div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topConstituencies}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="constituency" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="userCount" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-6">
            {/* Constituency Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Constituency Analysis</CardTitle>
                <CardDescription>
                  Select a constituency to view detailed user information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedConstituency} onValueChange={setSelectedConstituency}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a constituency" />
                  </SelectTrigger>
                  <SelectContent>
                    {stats.map((stat) => (
                      <SelectItem key={stat.constituency} value={stat.constituency}>
                        {stat.constituency} ({stat.userCount} users)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Selected Constituency Details */}
            {selectedConstituency && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {selectedConstituency}
                  </CardTitle>
                  <CardDescription>
                    {constituencyUsers.length} registered users in this constituency
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-8">Loading user data...</div>
                  ) : (
                    <div className="space-y-4">
                      {constituencyUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No users found in this constituency
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {constituencyUsers.map((user, index) => (
                            <div key={user.firebaseUid} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="space-y-1">
                                <div className="text-sm font-medium">
                                  User #{index + 1}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {user.firebaseUid.substring(0, 8)}...
                                </div>
                                {user.county && (
                                  <Badge variant="outline" className="text-xs">
                                    {user.county}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Registered: {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}