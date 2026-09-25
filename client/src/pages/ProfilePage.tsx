import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemeChoice } from '@/contexts/ThemeContext';
import { useRegion } from '@/hooks/useRegion';
import { REGION_LIST } from '@shared/region-config';
import { useQuery } from '@tanstack/react-query';
import { apiUpload } from '@/lib/queryClient';
import { fetchMyQuizResults } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { Camera, Loader2, TrendingUp } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SMSNotificationForm } from '@/components/SMSNotificationForm';
import { Segmented } from '@/components/pulse/Segmented';
import { EmptyState } from '@/components/pulse/EmptyState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Match my device' },
];

const ProfilePage = () => {
  const { user, isLoading: authLoading, isAuthenticated, updateProfile, logout, deleteAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { regionCode, selectRegion } = useRegion();
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Fetch the signed-in user's saved quiz results (newest first)
  const { data: quizResults, isLoading: quizResultsLoading } = useQuery({
    queryKey: queryKeys.quiz.mine(user?.id),
    queryFn: () => fetchMyQuizResults(),
    enabled: isAuthenticated && !!user,
  });

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

      const result = await apiUpload('/api/profile/image', formData);

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

    setIsSavingProfile(true);
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
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await logout?.();
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

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  // Show login pane if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl font-bold">Login required</CardTitle>
            <CardDescription className="text-center">
              Please log in to view your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Button asChild className="w-full">
              <Link href="/login">Log in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const first = formData.firstName.trim();
  const last = formData.lastName.trim();
  const initials = (first.charAt(0) + last.charAt(0)).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" description="Manage your profile, alerts and data." />

      <Tabs defaultValue="profile">
        <TabsList className="mb-2 flex w-full overflow-x-auto no-scrollbar sm:w-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="political-evolution">Political evolution</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl">My profile</CardTitle>
                <CardDescription>
                  View and manage your personal information
                </CardDescription>
              </div>
              <div className="relative shrink-0">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={user?.profileImageUrl || ''} alt={user?.username} />
                  <AvatarFallback className="bg-elevated font-display font-bold">
                    {initials || user?.username?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label
                    aria-label="Change photo"
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-elevated text-foreground transition-colors hover:bg-accent"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">User information</h3>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isSavingProfile ? 'Saving…' : isEditing ? 'Save' : 'Edit profile'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
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
                Sign out
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-warn/50">
            <CardHeader>
              <CardTitle className="text-warn">Delete account &amp; data</CardTitle>
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
            <CardFooter className="flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="text-sm text-muted-foreground">
                Need a copy of your data first? Contact{' '}
                <a href="mailto:privacy@glaspolitics.ie" className="text-primary underline">
                  privacy@glaspolitics.ie
                </a>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" disabled={isDeletingAccount}>
                    {isDeletingAccount && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isDeletingAccount ? 'Deleting account…' : 'Delete my account'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deleting your account will permanently remove all personal data, political opinions, quiz history,
                      and saved preferences. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAccountDeletion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl">Appearance</CardTitle>
                <CardDescription>Choose how Glas Politics looks on this device.</CardDescription>
              </div>
              <Segmented
                label="Theme"
                options={THEME_OPTIONS}
                value={theme}
                onChange={setTheme}
                className="shrink-0"
              />
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl">Region</CardTitle>
                <CardDescription>Which parliament you follow. Saved to your account.</CardDescription>
              </div>
              <Segmented
                label="Region"
                options={REGION_LIST.map((r) => ({ value: r.code, label: r.status === "live" ? r.shortName : `${r.shortName} · preview` }))}
                value={regionCode ?? "IE"}
                onChange={(code) => void selectRegion(code)}
                className="shrink-0"
              />
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="political-evolution">
          <Card>
            <CardHeader>
              <CardTitle>Political evolution</CardTitle>
              <CardDescription>
                Track how your political views have evolved over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quizResultsLoading ? (
                <div className="flex h-60 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                </div>
              ) : quizResults && quizResults.length > 0 ? (
                <div className="space-y-6">
                  {quizResults.map((result, index) => (
                    <div key={result.id ?? index} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{result.ideology}</h4>
                          <p className="text-xs text-muted-foreground">
                            {result.createdAt ? new Date(result.createdAt).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                        {IDEOLOGY_DIMENSIONS.map((dimension) => {
                          const score = result.vector[dimension];
                          const isPositive = score > 0;
                          return (
                            <div key={dimension} className="flex flex-col items-center gap-1 rounded-lg bg-elevated p-2">
                              <span className="font-medium">{DIMENSION_POLES[dimension].label}</span>
                              <span className={`font-display text-lg font-bold ${isPositive ? 'text-primary' : 'text-warn'}`}>
                                {score > 0 ? '+' : ''}{score.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <Button variant="outline" onClick={() => navigate('/quiz/results')}>
                    View my quiz results
                  </Button>
                </div>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No political evolution data yet"
                  action={<Button onClick={() => navigate('/quiz')}>Take the quiz</Button>}
                >
                  Take the ideology quiz to start tracking your political position over time.
                </EmptyState>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>SMS notifications</CardTitle>
              <CardDescription>Get political updates and alerts by text message.</CardDescription>
            </CardHeader>
            <CardContent>
              <SMSNotificationForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;
