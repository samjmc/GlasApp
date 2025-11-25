import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  MessageSquareQuote, 
  Users, 
  TrendingUp, 
  Award,
  Clock,
  Target
} from 'lucide-react';

interface ParliamentaryActivityData {
  fullName: string;
  surname: string;
  questionsAsked: number;
  memberId: string;
  party: string;
  dailAttendance: number;
  otherAttendance: number;
  attendancePercentage: number;
  totalPossibleDays: number;
}

interface ParliamentaryActivityProps {
  politicianName?: string;
  partyId?: string;
  activityData?: ParliamentaryActivityData;
  showComparison?: boolean;
}

export function ParliamentaryActivity({ 
  politicianName, 
  partyId, 
  activityData,
  showComparison = false 
}: ParliamentaryActivityProps) {
  
  // Calculate activity metrics
  const getActivityRating = (attendance: number, questions: number) => {
    const attendanceScore = (attendance / 29) * 50; // 50% weight for attendance
    const questionScore = Math.min((questions / 100) * 50, 50); // 50% weight for questions, capped
    return Math.round(attendanceScore + questionScore);
  };

  const getAttendanceLevel = (percentage: number) => {
    if (percentage >= 90) return { level: 'Excellent', color: 'bg-green-500', textColor: 'text-green-700' };
    if (percentage >= 80) return { level: 'Good', color: 'bg-blue-500', textColor: 'text-blue-700' };
    if (percentage >= 70) return { level: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { level: 'Poor', color: 'bg-red-500', textColor: 'text-red-700' };
  };

  const getQuestionActivity = (questions: number) => {
    if (questions >= 200) return { level: 'Very Active', color: 'bg-green-500', textColor: 'text-green-700' };
    if (questions >= 100) return { level: 'Active', color: 'bg-blue-500', textColor: 'text-blue-700' };
    if (questions >= 50) return { level: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { level: 'Low', color: 'bg-red-500', textColor: 'text-red-700' };
  };

  if (!activityData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Parliamentary Activity
          </CardTitle>
          <CardDescription>
            No parliamentary activity data available for this representative
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const attendanceLevel = getAttendanceLevel(activityData.attendancePercentage);
  const questionLevel = getQuestionActivity(activityData.questionsAsked);
  const activityRating = getActivityRating(activityData.dailAttendance, activityData.questionsAsked);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Parliamentary Activity
        </CardTitle>
        <CardDescription>
          Performance metrics for {activityData.fullName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Activity Score */}
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">{activityRating}/100</div>
                <p className="text-sm text-muted-foreground">Overall Activity Score</p>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Attendance</span>
                  </div>
                  <div className="text-2xl font-bold">{activityData.attendancePercentage}%</div>
                  <Badge 
                    variant="secondary" 
                    className={`mt-1 ${attendanceLevel.textColor} bg-opacity-20`}
                  >
                    {attendanceLevel.level}
                  </Badge>
                </div>
                
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Questions</span>
                  </div>
                  <div className="text-2xl font-bold">{activityData.questionsAsked}</div>
                  <Badge 
                    variant="secondary" 
                    className={`mt-1 ${questionLevel.textColor} bg-opacity-20`}
                  >
                    {questionLevel.level}
                  </Badge>
                </div>
              </div>

              {/* Attendance Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Dáil Attendance</span>
                  <span className="text-sm text-muted-foreground">
                    {activityData.dailAttendance}/{activityData.totalPossibleDays} days
                  </span>
                </div>
                <Progress value={activityData.attendancePercentage} className="h-2" />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="details">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {/* Detailed Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Dáil Attendance</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{activityData.dailAttendance} days</div>
                      <div className="text-sm text-muted-foreground">
                        {activityData.attendancePercentage}% of possible
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Community Engagement</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{activityData.otherAttendance} days</div>
                      <div className="text-sm text-muted-foreground">
                        Additional activities
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4" />
                      <span className="font-medium">Parliamentary Questions</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{activityData.questionsAsked}</div>
                      <div className="text-sm text-muted-foreground">
                        Questions submitted
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      <span className="font-medium">Total Engagement</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {activityData.dailAttendance + activityData.otherAttendance} days
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Combined activity
                      </div>
                    </div>
                  </div>
                </div>

                {/* Party Information */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="h-4 w-4" />
                    <span className="font-medium">Party Affiliation</span>
                  </div>
                  <div className="text-sm">
                    <Badge variant="outline">{activityData.party}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ParliamentaryActivity;