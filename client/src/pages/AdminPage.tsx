import React, { useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Settings, 
  FileText, 
  Activity, 
  Shield, 
  Save, 
  RefreshCw,
  Calendar,
  Link,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  X
} from "lucide-react";

interface Pledge {
  id: number;
  partyId: number;
  title: string;
  description: string;
  category: string;
  electionYear: number;
  targetDate?: string;
  status: string;
  scoreType: string;
  score: string;
  evidence?: string;
  sourceUrl?: string;
  lastUpdated: string;
  createdAt: string;
}

interface PledgeAction {
  id: number;
  pledgeId: number;
  actionType: string;
  description: string;
  actionDate: string;
  impactScore: string;
  sourceUrl?: string;
  evidenceDetails?: string;
  createdAt: string;
}

const AdminPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form states
  const [pledgeForm, setPledgeForm] = useState({
    partyId: '',
    title: '',
    description: '',
    category: '',
    electionYear: new Date().getFullYear(),
    targetDate: '',
    sourceUrl: ''
  });

  const [actionForm, setActionForm] = useState({
    pledgeId: '',
    actionType: '',
    description: '',
    actionDate: new Date().toISOString().split('T')[0],
    impactScore: '5',
    sourceUrl: '',
    evidenceDetails: ''
  });

  const [selectedPartyForManagement, setSelectedPartyForManagement] = useState<string>('2');
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);
  const [viewingPledge, setViewingPledge] = useState<Pledge | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: '',
    targetDate: '',
    sourceUrl: '',
    score: '',
    evidence: ''
  });

  // Get pledges for selected party
  const { data: pledges, isLoading: pledgesLoading } = useQuery({
    queryKey: ['/api/pledges/party', selectedPartyForManagement],
    queryFn: async () => {
      const response = await fetch(`/api/pledges/party/${selectedPartyForManagement}`);
      if (!response.ok) throw new Error('Failed to fetch pledges');
      const result = await response.json();
      return result.data;
    },
  });

  // Create pledge mutation
  const createPledgeMutation = useMutation({
    mutationFn: async (pledgeData: any) => {
      const response = await fetch('/api/pledges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pledgeData)
      });
      if (!response.ok) throw new Error('Failed to create pledge');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pledge created successfully" });
      setPledgeForm({
        partyId: '',
        title: '',
        description: '',
        category: '',
        electionYear: new Date().getFullYear(),
        targetDate: '',
        sourceUrl: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pledges/party'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Update pledge mutation
  const updatePledgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/pledges/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update pledge');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pledge updated successfully" });
      setEditingPledge(null);
      queryClient.invalidateQueries({ queryKey: ['/api/pledges/party'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Delete pledge mutation
  const deletePledgeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/pledges/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete pledge');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pledge deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/pledges/party'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Create action mutation
  const createActionMutation = useMutation({
    mutationFn: async (actionData: any) => {
      const response = await fetch(`/api/pledges/${actionData.pledgeId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData)
      });
      if (!response.ok) throw new Error('Failed to create action');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Action recorded successfully" });
      setActionForm({
        pledgeId: '',
        actionType: '',
        description: '',
        actionDate: new Date().toISOString().split('T')[0],
        impactScore: '5',
        sourceUrl: '',
        evidenceDetails: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pledges'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  // Recalculate scores mutation
  const recalculateScoresMutation = useMutation({
    mutationFn: async (partyId: string) => {
      const response = await fetch(`/api/pledges/performance/${partyId}/recalculate`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to recalculate scores');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Performance scores recalculated" });
      queryClient.invalidateQueries({ queryKey: ['/api/pledges'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const handleCreatePledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeForm.partyId || !pledgeForm.title || !pledgeForm.description) {
      toast({ 
        title: "Error", 
        description: "Please fill in all required fields", 
        variant: "destructive" 
      });
      return;
    }
    
    // Convert data types to match schema expectations
    const pledgeData = {
      ...pledgeForm,
      partyId: parseInt(pledgeForm.partyId),
      electionYear: Number(pledgeForm.electionYear),
      targetDate: pledgeForm.targetDate || undefined
    };
    
    createPledgeMutation.mutate(pledgeData);
  };

  const handleCreateAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionForm.pledgeId || !actionForm.actionType || !actionForm.description) {
      toast({ 
        title: "Error", 
        description: "Please fill in all required fields", 
        variant: "destructive" 
      });
      return;
    }
    
    // Convert data types to match schema expectations
    const actionData = {
      ...actionForm,
      pledgeId: parseInt(actionForm.pledgeId),
      impactScore: parseFloat(actionForm.impactScore)
    };
    
    createActionMutation.mutate(actionData);
  };

  // Helper functions
  const handleEditPledge = (pledge: Pledge) => {
    setEditingPledge(pledge);
    setEditForm({
      title: pledge.title,
      description: pledge.description,
      category: pledge.category,
      targetDate: pledge.targetDate ? pledge.targetDate.split('T')[0] : '',
      sourceUrl: pledge.sourceUrl || '',
      score: pledge.score,
      evidence: pledge.evidence || ''
    });
  };

  const handleUpdatePledge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPledge) return;
    
    updatePledgeMutation.mutate({
      id: editingPledge.id,
      data: editForm
    });
  };

  const handleDeletePledge = (pledgeId: number) => {
    if (confirm('Are you sure you want to delete this pledge? This action cannot be undone.')) {
      deletePledgeMutation.mutate(pledgeId);
    }
  };

  const handleViewPledge = (pledge: Pledge) => {
    setViewingPledge(pledge);
  };

  const getPartyName = (partyId: number) => {
    const parties: Record<number, string> = {
      1: 'Sinn Féin',
      2: 'Fine Gael',
      3: 'Fianna Fáil',
      4: 'Labour Party',
      5: 'Green Party',
      6: 'Social Democrats',
      7: 'People Before Profit',
      8: 'Aontú',
      9: 'Solidarity',
      10: 'Independent Ireland'
    };
    return parties[partyId] || 'Unknown Party';
  };

  const getScoreColor = (score: string) => {
    const numScore = parseInt(score);
    if (numScore >= 80) return 'text-green-600';
    if (numScore >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const parties = [
    { id: '1', name: 'Sinn Féin' },
    { id: '2', name: 'Fine Gael' },
    { id: '3', name: 'Fianna Fáil' },
    { id: '4', name: 'Labour Party' },
    { id: '5', name: 'Green Party' },
    { id: '6', name: 'Social Democrats' },
    { id: '7', name: 'People Before Profit' },
    { id: '8', name: 'Aontú' },
    { id: '9', name: 'Solidarity' },
    { id: '10', name: 'Independent Ireland' }
  ];

  const actionTypes = [
    'legislation_passed',
    'policy_implemented',
    'budget_allocated',
    'bill_introduced',
    'committee_work',
    'ministerial_statement',
    'parliamentary_question',
    'private_members_bill',
    'motion_tabled',
    'public_campaign',
    'media_interview',
    'dail_speech',
    'press_release',
    'social_media_campaign'
  ];

  const categories = [
    'Housing',
    'Healthcare',
    'Education',
    'Economy',
    'Environment',
    'Social Welfare',
    'Immigration',
    'Justice',
    'Defence',
    'Foreign Affairs',
    'Transport',
    'Agriculture',
    'Technology'
  ];

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pledge Tracking Admin</h1>
          <p className="text-muted-foreground">Manage political pledges, actions, and performance scores</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          <Shield className="h-4 w-4 mr-1" />
          Admin Access
        </Badge>
      </div>

      <Tabs defaultValue="pledges" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pledges" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Pledges
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Management
          </TabsTrigger>
          <TabsTrigger value="scores" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Scores
          </TabsTrigger>
        </TabsList>

        {/* Pledges Tab */}
        <TabsContent value="pledges" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Pledge Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New Pledge
                </CardTitle>
                <CardDescription>
                  Add a new political pledge to track
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePledge} className="space-y-4">
                  <div>
                    <Label htmlFor="party">Party *</Label>
                    <Select 
                      value={pledgeForm.partyId} 
                      onValueChange={(value) => setPledgeForm({...pledgeForm, partyId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select party" />
                      </SelectTrigger>
                      <SelectContent>
                        {parties.map(party => (
                          <SelectItem key={party.id} value={party.id}>
                            {party.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={pledgeForm.title}
                      onChange={(e) => setPledgeForm({...pledgeForm, title: e.target.value})}
                      placeholder="e.g., Build 50,000 new homes"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={pledgeForm.description}
                      onChange={(e) => setPledgeForm({...pledgeForm, description: e.target.value})}
                      placeholder="Detailed description of the pledge..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select 
                        value={pledgeForm.category} 
                        onValueChange={(value) => setPledgeForm({...pledgeForm, category: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="electionYear">Election Year</Label>
                      <Input
                        id="electionYear"
                        type="number"
                        value={pledgeForm.electionYear}
                        onChange={(e) => setPledgeForm({...pledgeForm, electionYear: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="targetDate">Target Date</Label>
                    <Input
                      id="targetDate"
                      type="date"
                      value={pledgeForm.targetDate}
                      onChange={(e) => setPledgeForm({...pledgeForm, targetDate: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="sourceUrl">Source URL</Label>
                    <Input
                      id="sourceUrl"
                      type="url"
                      value={pledgeForm.sourceUrl}
                      onChange={(e) => setPledgeForm({...pledgeForm, sourceUrl: e.target.value})}
                      placeholder="https://..."
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createPledgeMutation.isPending}
                  >
                    {createPledgeMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Pledge
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Recent Pledges */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Pledges</CardTitle>
                <CardDescription>
                  Latest pledges added to the system
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pledgesLoading ? (
                  <div className="text-center py-4">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Loading pledges...</p>
                  </div>
                ) : pledges && pledges.length > 0 ? (
                  <div className="space-y-3">
                    {pledges.slice(0, 5).map((pledge: any) => (
                      <div key={pledge.pledge.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{pledge.pledge.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {pledge.pledge.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {pledge.partyName} • {pledge.pledge.electionYear}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">Score:</span>
                          <Progress value={parseFloat(pledge.pledge.score)} className="h-1 flex-1" />
                          <span className="text-xs font-medium">{pledge.pledge.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No pledges found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Record Pledge Action
              </CardTitle>
              <CardDescription>
                Track actions taken on existing pledges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAction} className="space-y-4 max-w-2xl">
                <div>
                  <Label htmlFor="pledgeSelect">Select Pledge *</Label>
                  <Select 
                    value={actionForm.pledgeId} 
                    onValueChange={(value) => setActionForm({...actionForm, pledgeId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a pledge" />
                    </SelectTrigger>
                    <SelectContent>
                      {pledges && pledges.map((pledge: any) => (
                        <SelectItem key={pledge.pledge.id} value={pledge.pledge.id.toString()}>
                          <div className="flex flex-col">
                            <span>{pledge.pledge.title}</span>
                            <span className="text-xs text-muted-foreground">{pledge.partyName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="actionType">Action Type *</Label>
                  <Select 
                    value={actionForm.actionType} 
                    onValueChange={(value) => setActionForm({...actionForm, actionType: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action type" />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypes.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="actionDescription">Description *</Label>
                  <Textarea
                    id="actionDescription"
                    value={actionForm.description}
                    onChange={(e) => setActionForm({...actionForm, description: e.target.value})}
                    placeholder="Describe what action was taken..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="actionDate">Action Date</Label>
                    <Input
                      id="actionDate"
                      type="date"
                      value={actionForm.actionDate}
                      onChange={(e) => setActionForm({...actionForm, actionDate: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="impactScore">Impact Score (1-10)</Label>
                    <Input
                      id="impactScore"
                      type="number"
                      min="1"
                      max="10"
                      value={actionForm.impactScore}
                      onChange={(e) => setActionForm({...actionForm, impactScore: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="actionSourceUrl">Source URL</Label>
                  <Input
                    id="actionSourceUrl"
                    type="url"
                    value={actionForm.sourceUrl}
                    onChange={(e) => setActionForm({...actionForm, sourceUrl: e.target.value})}
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <Label htmlFor="evidenceDetails">Evidence Details</Label>
                  <Textarea
                    id="evidenceDetails"
                    value={actionForm.evidenceDetails}
                    onChange={(e) => setActionForm({...actionForm, evidenceDetails: e.target.value})}
                    placeholder="Additional evidence or context..."
                    rows={2}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={createActionMutation.isPending}
                  className="w-full"
                >
                  {createActionMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Record Action
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Management Tab */}
        <TabsContent value="management" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Party Selection</CardTitle>
                <CardDescription>
                  Choose party to manage pledges and view statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedPartyForManagement} 
                  onValueChange={setSelectedPartyForManagement}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map(party => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>
                  Overview of pledge tracking data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pledges && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Pledges:</span>
                      <span className="font-medium">{pledges.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Active Pledges:</span>
                      <span className="font-medium">
                        {pledges.filter((p: any) => p.pledge.status === 'active').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Average Score:</span>
                      <span className="font-medium">
                        {pledges.length > 0 
                          ? Math.round(pledges.reduce((acc: number, p: any) => acc + parseFloat(p.pledge.score), 0) / pledges.length)
                          : 0}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pledge Management Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Pledge Management
              </CardTitle>
              <CardDescription>
                View, edit, and delete pledges for {getPartyName(parseInt(selectedPartyForManagement))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pledgesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pledges && pledges.length > 0 ? (
                <div className="space-y-4">
                  {pledges.map((pledgeData: any) => {
                    const pledge = pledgeData.pledge;
                    return (
                      <Card key={pledge.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{pledge.title}</h3>
                                <Badge variant={pledge.status === 'active' ? 'default' : 'secondary'}>
                                  {pledge.status}
                                </Badge>
                                <Badge variant="outline" className={getScoreColor(pledge.score)}>
                                  {pledge.score}% {pledge.scoreType}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {pledge.description}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {pledge.category}
                                </span>
                                {pledge.targetDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Target: {new Date(pledge.targetDate).toLocaleDateString()}
                                  </span>
                                )}
                                <span>Updated: {new Date(pledge.lastUpdated).toLocaleDateString()}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewPledge(pledge)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditPledge(pledge)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeletePledge(pledge.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No pledges found for {getPartyName(parseInt(selectedPartyForManagement))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scores Tab */}
        <TabsContent value="scores" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Score Management
              </CardTitle>
              <CardDescription>
                Recalculate performance and trustworthiness scores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select 
                  value={selectedPartyForManagement} 
                  onValueChange={setSelectedPartyForManagement}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map(party => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={() => recalculateScoresMutation.mutate(selectedPartyForManagement)}
                  disabled={recalculateScoresMutation.isPending}
                  variant="outline"
                >
                  {recalculateScoresMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Recalculate Scores
                    </>
                  )}
                </Button>
              </div>

              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-1">Score Calculation Info</h4>
                      <div className="text-sm text-amber-700 space-y-1">
                        <p>Scores are automatically recalculated when new actions are added</p>
                        <p>Manual recalculation updates all performance metrics for the selected party</p>
                        <p>Government parties: scored on policy delivery • Opposition parties: scored on advocacy efforts</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Pledge Modal */}
      <Dialog open={!!viewingPledge} onOpenChange={() => setViewingPledge(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pledge Details
            </DialogTitle>
            <DialogDescription>
              Detailed view of pledge information and progress
            </DialogDescription>
          </DialogHeader>
          
          {viewingPledge && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">{viewingPledge.title}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{getPartyName(viewingPledge.partyId)}</Badge>
                  <Badge variant={viewingPledge.status === 'active' ? 'default' : 'secondary'}>
                    {viewingPledge.status}
                  </Badge>
                  <Badge variant="outline" className={getScoreColor(viewingPledge.score)}>
                    {viewingPledge.score}% {viewingPledge.scoreType}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <p className="text-sm text-muted-foreground">{viewingPledge.category}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Election Year</Label>
                  <p className="text-sm text-muted-foreground">{viewingPledge.electionYear}</p>
                </div>
                {viewingPledge.targetDate && (
                  <div>
                    <Label className="text-sm font-medium">Target Date</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(viewingPledge.targetDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(viewingPledge.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground mt-1">{viewingPledge.description}</p>
              </div>

              {viewingPledge.evidence && (
                <div>
                  <Label className="text-sm font-medium">Evidence</Label>
                  <p className="text-sm text-muted-foreground mt-1">{viewingPledge.evidence}</p>
                </div>
              )}

              {viewingPledge.sourceUrl && (
                <div>
                  <Label className="text-sm font-medium">Source</Label>
                  <a 
                    href={viewingPledge.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    <Link className="h-3 w-3" />
                    View Source
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Pledge Modal */}
      <Dialog open={!!editingPledge} onOpenChange={() => setEditingPledge(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Pledge
            </DialogTitle>
            <DialogDescription>
              Update pledge information and progress details
            </DialogDescription>
          </DialogHeader>
          
          {editingPledge && (
            <form onSubmit={handleUpdatePledge} className="space-y-4">
              <div>
                <Label htmlFor="editTitle">Title *</Label>
                <Input
                  id="editTitle"
                  value={editForm.title}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  placeholder="Pledge title..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="editDescription">Description *</Label>
                <Textarea
                  id="editDescription"
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  placeholder="Detailed description of the pledge..."
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editCategory">Category</Label>
                  <Input
                    id="editCategory"
                    value={editForm.category}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                    placeholder="e.g., Housing, Healthcare"
                  />
                </div>

                <div>
                  <Label htmlFor="editTargetDate">Target Date</Label>
                  <Input
                    id="editTargetDate"
                    type="date"
                    value={editForm.targetDate}
                    onChange={(e) => setEditForm({...editForm, targetDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editScore">Current Score (%)</Label>
                  <Input
                    id="editScore"
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.score}
                    onChange={(e) => setEditForm({...editForm, score: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="editSourceUrl">Source URL</Label>
                  <Input
                    id="editSourceUrl"
                    type="url"
                    value={editForm.sourceUrl}
                    onChange={(e) => setEditForm({...editForm, sourceUrl: e.target.value})}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="editEvidence">Evidence</Label>
                <Textarea
                  id="editEvidence"
                  value={editForm.evidence}
                  onChange={(e) => setEditForm({...editForm, evidence: e.target.value})}
                  placeholder="Evidence of progress or delivery..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingPledge(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePledgeMutation.isPending}>
                  {updatePledgeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Pledge
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </ProtectedRoute>
  );
};

export default AdminPage;