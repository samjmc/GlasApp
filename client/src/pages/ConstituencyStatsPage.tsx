import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, TrendingUp } from "lucide-react";
import Header from "@/components/Header";

interface ConstituencyStats {
  constituency: string;
  userCount: number;
}

export default function ConstituencyStatsPage() {
  const { data: stats = [], isLoading } = useQuery<ConstituencyStats[]>({
    queryKey: ["/api/location/stats/constituencies"],
  });

  const totalUsers = stats.reduce((sum, stat) => sum + stat.userCount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Constituency Statistics
          </h1>
          <p className="text-gray-600">
            User distribution across Irish constituencies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                With location data
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
                {stats[0]?.constituency?.substring(0, 20) || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats[0]?.userCount || 0} users
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Constituencies</CardTitle>
            <CardDescription>
              Complete list of constituencies with user counts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading statistics...</div>
            ) : stats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No location data available yet. Users need to enable location detection.
              </div>
            ) : (
              <div className="grid gap-4">
                {stats.map((stat, index) => (
                  <div key={stat.constituency} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <div className="font-medium">{stat.constituency}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{stat.userCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}