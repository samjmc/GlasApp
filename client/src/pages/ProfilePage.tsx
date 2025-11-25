import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { PoliticalEvolution } from '@shared/schema';
import PoliticalEvolutionAnalysis from '@/components/PoliticalEvolutionAnalysis';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SMSNotificationForm } from '@/components/SMSNotificationForm';

const ProfilePage = () => {
  const { user, isLoading: authLoading, isAuthenticated, updateProfile, logout, deleteAccount } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    county: '',
    bio: '',
  });
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Fetch political evolution data
  const { data: evolutionResponse, isLoading: evolutionLoading } = useQuery({
    queryKey: ['/api/political-evolution'],
    enabled: isAuthenticated,
  });
  
  const evolutionData = React.useMemo(() => {
    if (evolutionResponse?.data && Array.isArray(evolutionResponse.data)) {
      return evolutionResponse.data;
    }
    if (evolutionResponse && Array.isArray(evolutionResponse)) {
      return evolutionResponse;
    }
    return [];
  }, [evolutionResponse]);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        county: user.county || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  // No longer redirecting to login page - we'll display a login section instead

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };



  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await fetch('/api/auth/upload-profile-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Profile picture updated",
          description: "Your profile picture has been successfully updated"
        });
        // Refresh user data to show new image
        window.location.reload();
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive"
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!updateProfile) {
      toast({
        title: 'Update Failed',
        description: 'Profile update function not available',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateProfile(formData);
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    if (logout) {
      logout();
    } else {
      window.location.href = '/api/logout';
    }
    navigate('/');
  };

  const handleAccountDeletion = async () => {
    if (!deleteAccount) {
      toast({
        title: 'Deletion unavailable',
        description: 'Account deletion is not currently available. Please contact support.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(
      'Deleting your account will permanently remove all personal data, political opinions, quiz history, and saved preferences. This action cannot be undone. Do you wish to continue?'
    );

    if (!confirmed) {
      return;
    }

    setDeleteAccountError(null);
    setIsDeletingAccount(true);

    try {
      await deleteAccount();
      toast({
        title: 'Account deleted',
        description: 'Your account and associated data have been removed.',
      });
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account. Please try again.';
      setDeleteAccountError(message);
      toast({
        title: 'Deletion failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // List of Irish counties
  const irishCounties = [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry',
    'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare',
    'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth',
    'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo',
    'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
  ];

  // Format evolution data for chart
  const chartData = (evolutionData && Array.isArray(evolutionData)) ? evolutionData.map((record: PoliticalEvolution) => ({
    date: new Date(record.createdAt).toLocaleDateString(),
    economic: typeof record.economicScore === 'string' 
      ? parseFloat(record.economicScore) 
      : Number(record.economicScore),
    social: typeof record.socialScore === 'string' 
      ? parseFloat(record.socialScore) 
      : Number(record.socialScore),
    cultural: record.culturalScore 
      ? (typeof record.culturalScore === 'string' ? parseFloat(record.culturalScore) : Number(record.culturalScore))
      : null,
    globalism: record.globalismScore 
      ? (typeof record.globalismScore === 'string' ? parseFloat(record.globalismScore) : Number(record.globalismScore))
      : null,
    environmental: record.environmentalScore 
      ? (typeof record.environmentalScore === 'string' ? parseFloat(record.environmentalScore) : Number(record.environmentalScore))
      : null,
    authority: record.authorityScore 
      ? (typeof record.authorityScore === 'string' ? parseFloat(record.authorityScore) : Number(record.authorityScore))
      : null,
    welfare: record.welfareScore 
      ? (typeof record.welfareScore === 'string' ? parseFloat(record.welfareScore) : Number(record.welfareScore))
      : null,
    technocratic: record.technocraticScore 
      ? (typeof record.technocraticScore === 'string' ? parseFloat(record.technocraticScore) : Number(record.technocraticScore))
      : null,
    label: record.label || undefined
  })) : [];

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p>Loading profile...</p>
      </div>
    );
  }

  // Show login pane if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex justify-center items-center py-12">
        <Card className="max-w-md w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Login Required</CardTitle>
            <CardDescription className="text-center">
              Please log in to view your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="w-full"
            >
              Log In
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Button variant="link" className="p-0" onClick={() => window.location.href = '/api/login'}>
                Register here
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 px-4">
      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="political-evolution">Political Evolution</TabsTrigger>
          <TabsTrigger value="saved-content">Saved Content</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">My Profile</CardTitle>
                <CardDescription>
                  View and manage your personal information
                </CardDescription>
              </div>
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.profileImageUrl || ''} alt={user?.username} />
                  <AvatarFallback>
                    {user?.firstName ? user.firstName.charAt(0) : user?.username?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProfileImageUpload}
                    />
                  </label>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">User Information</h3>
                <Button 
                  variant="outline" 
                  onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                >
                  {isEditing ? 'Save' : 'Edit Profile'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      value={user?.username || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      value={user?.email || ''}
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName"
                      name="firstName" 
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName"
                      name="lastName" 
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="county">County</Label>
                  {isEditing ? (
                    <Select 
                      value={formData.county} 
                      onValueChange={(value) => handleSelectChange('county', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your county" />
                      </SelectTrigger>
                      <SelectContent>
                        {irishCounties.map(county => (
                          <SelectItem key={county} value={county}>
                            {county}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      id="county" 
                      value={formData.county}
                      disabled
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea 
                    id="bio"
                    name="bio" 
                    value={formData.bio}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    rows={4}
                    placeholder={isEditing ? "Tell us about yourself..." : "No bio provided"}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
            </CardFooter>
          </Card>

          <Card className="mt-6 border border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Delete Account & Data</CardTitle>
              <CardDescription>
                Permanently remove your Glas Politics account, political opinions, quiz history, and saved preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deleteAccountError && (
                <Alert variant="destructive">
                  <AlertTitle>Deletion failed</AlertTitle>
                  <AlertDescription>{deleteAccountError}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                This action is irreversible. We will remove your Supabase Auth account and scrub personal data from all analytics tables. You can create a new account later, but your historical insights will not be recoverable.
              </p>
            </CardContent>
            <CardFooter className="justify-between flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Need a copy of your data first? Contact{' '}
                <a href="mailto:privacy@glaspolitics.ie" className="text-primary underline">
                  privacy@glaspolitics.ie
                </a>
              </div>
              <Button
                variant="destructive"
                onClick={handleAccountDeletion}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? 'Deleting account...' : 'Delete my account'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="political-evolution">
          <Card>
            <CardHeader>
              <CardTitle>Political Evolution</CardTitle>
              <CardDescription>
                Track how your political views have evolved over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evolutionLoading ? (
                <div className="h-60 flex items-center justify-center">
                  <p>Loading your political evolution data...</p>
                </div>
              ) : chartData && chartData.length > 0 ? (
                <div className="space-y-6">
                  {/* Main Evolution Chart */}
                  <div className="h-[600px]">
                    <h4 className="text-sm font-medium mb-4">Your Political Journey Over Time</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 50, left: 20, bottom: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis 
                          dataKey="date" 
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval={0}
                          fontSize={11}
                        />
                        <YAxis 
                          domain={[-10, 10]} 
                          fontSize={11}
                          tickCount={11}
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload || !payload.length) return null;
                            
                            const dimensionNames: Record<string, string> = {
                              economic: 'Economic',
                              social: 'Social',
                              cultural: 'Cultural',
                              globalism: 'Globalism',
                              environmental: 'Environmental',
                              authority: 'Authority',
                              welfare: 'Welfare',
                              technocratic: 'Technocratic'
                            };

                            // Sort payload by value (highest to lowest)
                            const sortedPayload = [...payload]
                              .filter(item => item.value !== null && item.value !== undefined)
                              .sort((a, b) => Number(b.value) - Number(a.value));

                            return (
                              <div className="bg-card border border-border rounded-md p-3 shadow-lg">
                                <p className="font-medium mb-2">{`Date: ${label}`}</p>
                                {sortedPayload.map((item, index) => (
                                  <div key={index} className="flex items-center gap-2 text-sm">
                                    <div 
                                      className="w-3 h-0.5" 
                                      style={{ backgroundColor: item.color }}
                                    />
                                    <span className="font-medium">
                                      {dimensionNames[item.dataKey as string] || item.dataKey}:
                                    </span>
                                    <span>{Number(item.value).toFixed(1)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ 
                            paddingTop: '30px',
                            fontSize: '12px'
                          }}
                          iconType="line"
                          layout="horizontal"
                          align="center"
                          verticalAlign="bottom"
                        />
                        
                        {/* Core Dimensions */}
                        <Line 
                          type="monotone" 
                          dataKey="economic" 
                          name="Economic"
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="social" 
                          name="Social"
                          stroke="#10b981" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        
                        {/* Extended Dimensions */}
                        <Line 
                          type="monotone" 
                          dataKey="cultural" 
                          name="Cultural"
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="globalism" 
                          name="Globalism"
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="environmental" 
                          name="Environmental"
                          stroke="#22c55e" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="authority" 
                          name="Authority"
                          stroke="#ef4444" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="welfare" 
                          name="Welfare"
                          stroke="#06b6d4" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="technocratic" 
                          name="Technocratic"
                          stroke="#ec4899" 
                          strokeWidth={2}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Latest Scores Summary */}
                  <div className="border rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3">Latest Political Profile</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {chartData[chartData.length - 1] && Object.entries(chartData[chartData.length - 1])
                        .filter(([key]) => !['date', 'label'].includes(key))
                        .map(([dimension, score]) => {
                          const dimensionNames: Record<string, string> = {
                            economic: 'Economic',
                            social: 'Social', 
                            cultural: 'Cultural',
                            globalism: 'Globalism',
                            environmental: 'Environmental',
                            authority: 'Authority',
                            welfare: 'Welfare',
                            technocratic: 'Technocratic'
                          };
                          const numScore = Number(score);
                          const isPositive = numScore > 0;
                          
                          return (
                            <div key={dimension} className="flex flex-col items-center p-2 bg-muted rounded">
                              <span className="font-medium">{dimensionNames[dimension]}</span>
                              <span className={`text-lg font-bold ${isPositive ? 'text-blue-600' : 'text-yellow-600'}`}>
                                {numScore > 0 ? '+' : ''}{numScore.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <PoliticalEvolutionAnalysis evolutionData={evolutionData} />

                  {/* Scale Reference */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">Scale Reference (-10 to +10):</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      <p>Economic: Left (-) to Right (+)</p>
                      <p>Social: Progressive (-) to Conservative (+)</p>
                      <p>Cultural: Multicultural (-) to Traditional (+)</p>
                      <p>Globalism: Nationalist (-) to Internationalist (+)</p>
                      <p>Environmental: Industrial (-) to Ecological (+)</p>
                      <p>Authority: Libertarian (-) to Authoritarian (+)</p>
                      <p>Welfare: Individual (-) to Communitarian (+)</p>
                      <p>Governance: Populist (-) to Technocratic (+)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center gap-4">
                  <p>No political evolution data available yet.</p>
                  <div className="flex gap-2">
                    <Button onClick={() => navigate('/enhanced-quiz')}>
                      Take the quiz to track your political position
                    </Button>
                    {/* Check if quiz results exist and show link to results */}
                    {typeof window !== 'undefined' && localStorage.getItem('multidimensionalQuizResults') && (
                      <Button variant="outline" onClick={() => navigate('/enhanced-results')}>
                        View My Quiz Results
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved-content">
          <Card>
            <CardHeader>
              <CardTitle>Saved Content</CardTitle>
              <CardDescription>
                Articles, parties, and politicians you've saved
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-40 flex items-center justify-center">
                <p>You haven't saved any content yet.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>SMS Notifications</CardTitle>
                <CardDescription>
                  Send political updates and alerts via SMS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SMSNotificationForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Manage your notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Election Reminders</h4>
                      <p className="text-sm text-gray-500">Receive notifications about upcoming elections</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="election-reminders" className="sr-only">Election Reminders</Label>
                      <Switch id="election-reminders" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Policy Vote Alerts</h4>
                      <p className="text-sm text-gray-500">Get updates when major policy votes happen</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="policy-votes" className="sr-only">Policy Vote Alerts</Label>
                      <Switch id="policy-votes" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Local Political Events</h4>
                      <p className="text-sm text-gray-500">Be notified of political events in your area</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="local-events" className="sr-only">Local Political Events</Label>
                      <Switch id="local-events" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;