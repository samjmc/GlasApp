import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  MessageSquareQuote, 
  Users, 
  TrendingUp, 
  Award,
  Crown,
  BarChart3,
  Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { politicalParties } from '@shared/data';

interface ParliamentaryStats {
  totalMembers: number;
  totalQuestions: number;
  averageQuestions: number;
  averageAttendance: number;
  averageOtherAttendance: number;
  topQuestionAsker: {
    name: string;
    questions: number;
    party: string;
  };
  topAttendee: {
    name: string;
    attendance: number;
    party: string;
  };
}

interface PartyStats {
  totalMembers: number;
  averageQuestions: number;
  averageAttendance: number;
  averageOtherAttendance: number;
  totalQuestions: number;
  topQuestionAsker: {
    name: string;
    questions: number;
  };
  topAttendee: {
    name: string;
    attendance: number;
  };
  members: Array<{
    name: string;
    questionsAsked: number;
    attendancePercentage: number;
    dailAttendance: number;
    otherAttendance: number;
  }>;
}

export function ParliamentaryDashboard() {
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');

  // Fetch overall parliamentary statistics
  const { data: overallStats, isLoading: overallLoading } = useQuery<ParliamentaryStats>({
    queryKey: ['/api/parliamentary-activity/stats'],
    queryFn: async () => {
      const response = await fetch('/api/parliamentary-activity/stats');
      if (!response.ok) throw new Error('Failed to fetch parliamentary stats');
      const result = await response.json();
      return result.data;
    },
  });

  // Fetch party-specific statistics
  const { data: partyStats, isLoading: partyLoading } = useQuery<PartyStats>({
    queryKey: ['/api/parliamentary-activity/party', selectedPartyId],
    queryFn: async () => {
      const response = await fetch(`/api/parliamentary-activity/party/${selectedPartyId}/stats`);
      if (!response.ok) throw new Error('Failed to fetch party stats');
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedPartyId,
  });

  const getAttendanceLevel = (percentage: number) => {
    if (percentage >= 90) return { level: 'Excellent', color: 'bg-green-500' };
    if (percentage >= 80) return { level: 'Good', color: 'bg-blue-500' };
    if (percentage >= 70) return { level: 'Fair', color: 'bg-yellow-500' };
    return { level: 'Poor', color: 'bg-red-500' };
  };

  const getQuestionActivity = (questions: number) => {
    if (questions >= 200) return { level: 'Very Active', color: 'bg-green-500' };
    if (questions >= 100) return { level: 'Active', color: 'bg-blue-500' };
    if (questions >= 50) return { level: 'Moderate', color: 'bg-yellow-500' };
    return { level: 'Low', color: 'bg-red-500' };
  };

  const filteredParties = politicalParties.filter(party => party.country === 'ireland');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Parliamentary Activity Dashboard</h2>
        <p className="text-muted-foreground">
          Real-time performance metrics for TDs based on attendance and parliamentary engagement
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">National Overview</TabsTrigger>
          <TabsTrigger value="parties">Party Analysis</TabsTrigger>
          <TabsTrigger value="leaderboards">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {overallLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total TDs Tracked</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overallStats?.totalMembers || 0}</div>
                  <p className="text-xs text-muted-foreground">Active members with data</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overallStats?.averageAttendance || 0}%</div>
                  <Progress value={overallStats?.averageAttendance || 0} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">Out of 29 sitting days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Questions Asked</CardTitle>
                  <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{overallStats?.totalQuestions?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Avg: {overallStats?.averageQuestions || 0} per TD
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {overallStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    Most Active Questioner
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{overallStats.topQuestionAsker.name}</div>
                    <Badge variant="secondary">{overallStats.topQuestionAsker.party}</Badge>
                    <div className="text-2xl font-bold text-green-600">
                      {overallStats.topQuestionAsker.questions} questions
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    Best Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{overallStats.topAttendee.name}</div>
                    <Badge variant="secondary">{overallStats.topAttendee.party}</Badge>
                    <div className="text-2xl font-bold text-blue-600">
                      {overallStats.topAttendee.attendance}% attendance
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="parties">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Party Performance Analysis</CardTitle>
                <CardDescription>
                  Select a party to view detailed performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a party" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredParties.map(party => (
                      <SelectItem key={party.id} value={party.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: party.color }}
                          ></div>
                          {party.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedPartyId && (
              <>
                {partyLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-24 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                ) : partyStats ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold">{partyStats.totalMembers}</div>
                          <p className="text-sm text-muted-foreground">TDs with data</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold">{partyStats.averageAttendance}%</div>
                          <p className="text-sm text-muted-foreground">Avg attendance</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold">{partyStats.averageQuestions}</div>
                          <p className="text-sm text-muted-foreground">Avg questions</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl font-bold">{partyStats.totalQuestions}</div>
                          <p className="text-sm text-muted-foreground">Total questions</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Top Performers</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Most Questions</h4>
                            <div className="flex justify-between items-center">
                              <span>{partyStats.topQuestionAsker.name}</span>
                              <Badge variant="outline">{partyStats.topQuestionAsker.questions}</Badge>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Best Attendance</h4>
                            <div className="flex justify-between items-center">
                              <span>{partyStats.topAttendee.name}</span>
                              <Badge variant="outline">{partyStats.topAttendee.attendance}%</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Party Members</CardTitle>
                          <CardDescription>
                            All {partyStats.totalMembers} TDs with activity data
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {partyStats.members.map((member, index) => (
                              <div key={index} className="flex justify-between items-center text-sm p-2 bg-muted rounded">
                                <span className="font-medium">{member.name}</span>
                                <div className="flex gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {member.attendancePercentage}% att
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {member.questionsAsked} q
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">No data available for selected party</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaderboards">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquareQuote className="h-5 w-5" />
                  Top Question Askers
                </CardTitle>
                <CardDescription>
                  TDs asking the most parliamentary questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                  <p>Detailed leaderboards coming soon</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Attendance Champions
                </CardTitle>
                <CardDescription>
                  TDs with the highest attendance rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2" />
                  <p>Detailed leaderboards coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ParliamentaryDashboard;