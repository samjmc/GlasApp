import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { politicalParties } from '@shared/data';
import { politicians } from '@shared/politicianData';
import { 
  policyPledges, 
  partyManifestos, 
  educationalContent, 
  educationBadges 
} from '@shared/educationData';
import PolicyImpactSimulator from '@/components/PolicyImpactSimulator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DimensionExplanationEditor } from '@/components/DimensionExplanationEditor';
import { partyDimensionsData, type PartyDimensions as ImportedPartyDimensions } from '@/data/partyDimensionsData';
import { ChevronDown, ChevronUp, TrendingUp, Shield, CheckCircle, AlertTriangle, Clock, Target, Info, Users, Eye, FileText, ExternalLink, DollarSign, Building, Settings, Vote, BarChart3, Grid3X3, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import PledgeVotingInterface from '@/components/PledgeVotingInterface';
import { ParliamentaryActivity } from '@/components/ParliamentaryActivity';
import { PerformanceScoreBreakdown } from '@/components/PerformanceScoreBreakdown';

// Transparency data for parties - Based on Data Openness, Timeliness, and Granularity metrics
const transparencyData = {
  'ie-ff': {
    score: 4, // 40/100 from the table converted to /10 scale
    indexedScore: 0.40,
    dataOpenness: 1,
    timeliness: 5,
    granularity: 0,
    total: 6,
    evidence: [
      'No donation breakdown on party site—only SIPO PDF summary',
      'Files SIPO returns by deadline',
      'No sub-€200 donor data published (only summary PDF)'
    ]
  },
  'ie-fg': {
    score: 4.7, // 47/100 from the table converted to /10 scale
    indexedScore: 0.47,
    dataOpenness: 2,
    timeliness: 5,
    granularity: 0,
    total: 7,
    evidence: [
      'Publishes a "Donations acceptance" decision-tree PDF, but no machine-readable donor list',
      'Files SIPO returns by deadline',
      'No granular breakdown below statutory thresholds'
    ]
  },
  'ie-sf': {
    score: 4.7, // 47/100 from the table converted to /10 scale
    indexedScore: 0.47,
    dataOpenness: 2,
    timeliness: 5,
    granularity: 0,
    total: 7,
    evidence: [
      'Donation policy published but no published donor lists',
      'Files SIPO returns by deadline',
      'No small-donor details beyond SIPO PDF'
    ]
  },
  'ie-green': {
    score: 6, // 60/100 from the table converted to /10 scale
    indexedScore: 0.60,
    dataOpenness: 4,
    timeliness: 5,
    granularity: 0,
    total: 9,
    evidence: [
      'Constitution & audited accounts PDF on site',
      'Donation "sign-in" portal—no public export',
      'Files SIPO returns by deadline',
      'No sub-€200 donor data published'
    ]
  },
  'ie-labour': {
    score: 5.3, // 53/100 from the table converted to /10 scale
    indexedScore: 0.53,
    dataOpenness: 3,
    timeliness: 5,
    granularity: 0,
    total: 8,
    evidence: [
      'Constitution & Code of Conduct online',
      'No public donor-list export beyond SIPO PDF'
    ]
  },
  'ie-sd': {
    score: 5.3, // 53/100 from the table converted to /10 scale
    indexedScore: 0.53,
    dataOpenness: 3,
    timeliness: 5,
    granularity: 0,
    total: 8,
    evidence: [
      'Constitution & Members\' Code of Conduct published',
      'No public small-donor data beyond SIPO PDF'
    ]
  },
  'ie-pbp': {
    score: 4.7, // 47/100 from the table converted to /10 scale
    indexedScore: 0.47,
    dataOpenness: 2,
    timeliness: 5,
    granularity: 0,
    total: 7,
    evidence: [
      'Statutory SIPO PDF only; no additional data on party site',
      'Files SIPO returns by deadline'
    ]
  },
  'ie-aontu': {
    score: 4.7, // 47/100 from the table converted to /10 scale
    indexedScore: 0.47,
    dataOpenness: 2,
    timeliness: 5,
    granularity: 0,
    total: 7,
    evidence: [
      'Audited accounts PDF via SIPO but not on own site',
      'Files SIPO returns by deadline'
    ]
  },
  'ie-independent-ireland': {
    score: 4, // 40/100 from the table converted to /10 scale
    indexedScore: 0.40,
    dataOpenness: 1,
    timeliness: 5,
    granularity: 0,
    total: 6,
    evidence: [
      'Only statutory PDF in SIPO report; no party-hosted docs',
      'Files SIPO returns by deadline'
    ]
  },
  'ie-irish-freedom': {
    score: 4, // 40/100 from the table converted to /10 scale (assuming same as Independent Ireland)
    indexedScore: 0.40,
    dataOpenness: 1,
    timeliness: 5,
    granularity: 0,
    total: 6,
    evidence: [
      'Only statutory PDF in SIPO report; no party-hosted docs',
      'Files SIPO returns by deadline'
    ]
  }
};

// Corruption Index data for parties (0-100 scale, 0 = most corrupt, 100 = cleanest)
// Based on documented scandals and misconduct events 2020-2025
const corruptionIndexData = {
  'ie-ff': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-fg': {
    score: 0,
    scandals: 3,
    evidence: [
      'Sexual-harassment finding against a TD (2023)',
      'Sen. Martin Conway resignation after intoxication arrest (Jan 2025)',
      'Bar-incident apology & charity donation by a TD (2020)'
    ]
  },
  'ie-sf': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-green': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-labour': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-sd': {
    score: 67,
    scandals: 1,
    evidence: [
      'Suspension & apology by TD Eoin Hayes for financial-disclosure errors (Nov 2024)'
    ]
  },
  'ie-pbp': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-aontu': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-independent-ireland': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  },
  'ie-irish-freedom': {
    score: 100,
    scandals: 0,
    evidence: [
      'No documented misconduct or corruption events in 2020–2025'
    ]
  }
};

// Governance Standards data for parties - Based on Charter Access, Oversight Independence, and Policy Review Cycle
const governanceStandardsData = {
  'ie-ff': {
    score: 20, // 3/15 * 100 = 20%
    charterAccess: 1,
    oversightIndependence: 1,
    policyReviewCycle: 1,
    total: 3,
    evidence: [
      'No party constitution or charter located on official site (search and site navigation)',
      'No independent ethics/disciplinary body beyond generic membership committees',
      'No published revision schedule or reference to a regular document review'
    ]
  },
  'ie-fg': {
    score: 73, // 11/15 * 100 = 73%
    charterAccess: 5,
    oversightIndependence: 3,
    policyReviewCycle: 3,
    total: 11,
    evidence: [
      'Full Constitution PDF available (2014) on party site',
      'Disciplinary Committee established in its rules (Rule 44) but wholly internal',
      'Constitution amendable at Árd Fheis (held regularly) though no strict timetable specified'
    ]
  },
  'ie-sf': {
    score: 27, // 4/15 * 100 = 27%
    charterAccess: 1,
    oversightIndependence: 2,
    policyReviewCycle: 1,
    total: 4,
    evidence: [
      'No standalone "constitution" PDF on official site; only policy/manifesto docs',
      'Party "Ard Chomhairle" exists but no clear independent-oversight mechanism described',
      'No published schedule for document updates'
    ]
  },
  'ie-green': {
    score: 87, // 13/15 * 100 = 87%
    charterAccess: 5,
    oversightIndependence: 3,
    policyReviewCycle: 5,
    total: 13,
    evidence: [
      '2023 Constitution PDF on official site',
      'Elected Executive Committee and Trustees, but no external ethics ombudsman',
      'Constitution explicitly amendable "annually" at Convention'
    ]
  },
  'ie-labour': {
    score: 73, // 11/15 * 100 = 73%
    charterAccess: 5,
    oversightIndependence: 3,
    policyReviewCycle: 3,
    total: 11,
    evidence: [
      '2017 Constitution PDF (amended at Party Conference) available',
      'Code of Conduct exists but no truly independent disciplinary board',
      'Constitution updated at party conferences (infrequent, last in 2017)'
    ]
  },
  'ie-sd': {
    score: 73, // 11/15 * 100 = 73%
    charterAccess: 5,
    oversightIndependence: 3,
    policyReviewCycle: 3,
    total: 11,
    evidence: [
      'Public "Constitution" page on site',
      'Members\' Code of Conduct in place, but no external ethics body',
      'Revision notes present but no formal cycle stated'
    ]
  },
  'ie-pbp': {
    score: 20, // 3/15 * 100 = 20%
    charterAccess: 1,
    oversightIndependence: 1,
    policyReviewCycle: 1,
    total: 3,
    evidence: [
      'No constitution or charter on official site',
      'No independent ethics committee referenced',
      'No schedule for governance-document reviews'
    ]
  },
  'ie-aontu': {
    score: 20, // 3/15 * 100 = 20%
    charterAccess: 1,
    oversightIndependence: 1,
    policyReviewCycle: 1,
    total: 3,
    evidence: [
      'No constitution or charter available on site',
      'No independent disciplinary/oversight body',
      'No documented document-review cycle'
    ]
  },
  'ie-independent-ireland': {
    score: 20, // 3/15 * 100 = 20%
    charterAccess: 1,
    oversightIndependence: 1,
    policyReviewCycle: 1,
    total: 3,
    evidence: [
      'No founding charter on site',
      'No independent disciplinary mechanism',
      'No documented governance-document review process'
    ]
  },
  'ie-irish-freedom': {
    score: 20, // 3/15 * 100 = 20% (assuming same as other smaller parties)
    charterAccess: 1,
    oversightIndependence: 1,
    policyReviewCycle: 1,
    total: 3,
    evidence: [
      'No founding charter on site',
      'No independent disciplinary mechanism',
      'No documented governance-document review process'
    ]
  }
};

// Trustworthiness Tab Content Component
const TrustworthinessTabContent = ({ selectedPartyId }: { selectedPartyId: string }) => {
  const partyTransparency = transparencyData[selectedPartyId as keyof typeof transparencyData];
  const partyCorruption = corruptionIndexData[selectedPartyId as keyof typeof corruptionIndexData];
  const partyGovernance = governanceStandardsData[selectedPartyId as keyof typeof governanceStandardsData];
  
  // State for drill-down details
  const [showTransparencyDetails, setShowTransparencyDetails] = useState(false);
  const [showCorruptionDetails, setShowCorruptionDetails] = useState(false);
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);
  const [showGovernanceDetails, setShowGovernanceDetails] = useState(false);
  
  // State for public sentiment voting
  const [sentimentValue, setSentimentValue] = useState(50);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  
  // Fetch party sentiment data
  const { data: sentimentData, refetch: refetchSentiment } = useQuery({
    queryKey: ['/api/party-sentiment', selectedPartyId],
    queryFn: async () => {
      const response = await fetch(`/api/party-sentiment/${selectedPartyId}`);
      if (!response.ok) throw new Error('Failed to fetch sentiment data');
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedPartyId,
  });

  // Fetch user's existing vote
  const { data: userVote, refetch: refetchUserVote } = useQuery({
    queryKey: ['/api/party-sentiment/user', selectedPartyId],
    queryFn: async () => {
      const response = await fetch(`/api/party-sentiment/user/${selectedPartyId}`);
      if (!response.ok) {
        if (response.status === 401) return null; // Not authenticated
        throw new Error('Failed to fetch user vote');
      }
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedPartyId,
  });

  // Update sentiment value when user vote is loaded
  useEffect(() => {
    if (userVote) {
      setSentimentValue(userVote.sentimentScore);
    }
  }, [userVote]);

  // Submit vote function
  const submitVote = async () => {
    setIsSubmittingVote(true);
    try {
      const response = await fetch('/api/party-sentiment/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyId: selectedPartyId,
          sentimentScore: sentimentValue,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit vote');
      }

      // Set vote submitted state immediately for instant feedback
      setVoteSubmitted(true);
      
      // Refetch data after successful vote to update the breakdown
      await Promise.all([refetchSentiment(), refetchUserVote()]);
      
      // Reset the thanks state after 3 seconds
      setTimeout(() => {
        setVoteSubmitted(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting vote:', error);
    } finally {
      setIsSubmittingVote(false);
    }
  };
  
  // Calculate overall trustworthiness score (weighted average of 4 metrics)
  const calculateOverallTrustScore = () => {
    if (!partyTransparency && !partyCorruption && !partyGovernance) return 50;
    
    const transparencyScore = partyTransparency ? partyTransparency.score * 10 : 50;
    const corruptionScore = partyCorruption ? partyCorruption.score : 50;
    const publicSentimentScore = 50; // Neutral baseline for Public Sentiment until votes are cast
    const governanceScore = partyGovernance ? partyGovernance.score : 50;
    
    // Weighted average: Transparency 30%, Corruption Index 30%, Public Sentiment 25%, Governance 15%
    return Math.round((transparencyScore * 0.3) + (corruptionScore * 0.3) + (publicSentimentScore * 0.25) + (governanceScore * 0.15));
  };
  
  const overallTrustScore = calculateOverallTrustScore();
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };


  
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center rounded-full w-32 h-32 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 mb-4">
          <span className={`text-4xl font-bold ${getScoreColor(overallTrustScore)}`}>
            {overallTrustScore}%
          </span>
        </div>
        <h3 className="text-xl font-semibold">Trustworthiness Rating</h3>
        <p className="text-gray-600 dark:text-gray-400">Based on transparency, corruption index, financial disclosure, and governance</p>
      </div>

      {/* Four Trustworthiness Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Transparency */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showTransparencyDetails ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setShowTransparencyDetails(!showTransparencyDetails)}
        >
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${partyTransparency ? getScoreColor(partyTransparency.score * 10) : 'text-gray-400'}`}>
              {partyTransparency ? `${partyTransparency.score * 10}%` : 'N/A'}
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Transparency</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Financial disclosure and openness
              {showTransparencyDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
        
        {/* Corruption Index */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showCorruptionDetails ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setShowCorruptionDetails(!showCorruptionDetails)}
        >
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${partyCorruption ? getScoreColor(partyCorruption.score) : 'text-gray-400'}`}>
              {partyCorruption ? `${partyCorruption.score}%` : 'N/A'}
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Corruption Index</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Freedom from scandals and misconduct
              {showCorruptionDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
        
        {/* Public Sentiment */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showFinancialDetails ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setShowFinancialDetails(!showFinancialDetails)}
        >
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${getScoreColor(50)}`}>
              50%
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Public Sentiment</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Community trust ratings
              {showFinancialDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
        
        {/* Governance Standards */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showGovernanceDetails ? 'ring-2 ring-purple-500' : ''}`}
          onClick={() => setShowGovernanceDetails(!showGovernanceDetails)}
        >
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${partyGovernance ? getScoreColor(partyGovernance.score) : 'text-gray-400'}`}>
              {partyGovernance ? `${partyGovernance.score}%` : 'N/A'}
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Governance Standards</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Charter, oversight, and review processes
              {showGovernanceDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Detail Sections */}
      {showTransparencyDetails && partyTransparency && (
        <Card className="border-2 border-blue-200 mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              Transparency Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(partyTransparency.score * 10)}`}>
                  {partyTransparency.total}/15
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Score</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(partyTransparency.score * 10)}`}>
                  {Math.round(partyTransparency.score * 10)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transparency Score</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className={`text-lg font-bold ${partyTransparency.dataOpenness >= 3 ? 'text-green-600' : partyTransparency.dataOpenness >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {partyTransparency.dataOpenness}/5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Data Openness</div>
                <div className="text-xs text-gray-500">Public accessibility</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className={`text-lg font-bold ${partyTransparency.timeliness >= 4 ? 'text-green-600' : partyTransparency.timeliness >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {partyTransparency.timeliness}/5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Timeliness</div>
                <div className="text-xs text-gray-500">Filing deadlines</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className={`text-lg font-bold ${partyTransparency.granularity >= 3 ? 'text-green-600' : partyTransparency.granularity >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {partyTransparency.granularity}/5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Granularity</div>
                <div className="text-xs text-gray-500">Detail level</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Supporting Evidence
              </h4>
              <div className="space-y-2">
                {partyTransparency.evidence.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
              <strong>Weight in Overall Score:</strong> 30% | <strong>Scoring:</strong> Data Openness (0-5), Timeliness (0-5), Granularity (0-5). Total /15 converted to 0-100% scale.
            </div>
          </CardContent>
        </Card>
      )}

      {showCorruptionDetails && partyCorruption && (
        <Card className="border-2 border-orange-200 mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Corruption Index Breakdown
            </CardTitle>
            <CardDescription>
              Analysis of documented scandals and misconduct events (2020-2025)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(partyCorruption.score)}`}>
                  {partyCorruption.score}/100
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Corruption Index</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${partyCorruption.scandals === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {partyCorruption.scandals}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Documented Scandals</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assessment</div>
                <Badge className={getScoreBadge(partyCorruption.score)}>
                  {partyCorruption.score === 100 ? 'Clean Record' : 
                   partyCorruption.score >= 67 ? 'Minor Issues' : 'Significant Concerns'}
                </Badge>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Evidence & Documentation
              </h4>
              <div className="space-y-2">
                {partyCorruption.evidence.map((item: string, index: number) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    {partyCorruption.scandals === 0 ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
              <strong>Weight in Overall Score:</strong> 30% | <strong>Scale:</strong> 0 = most corrupt, 100 = cleanest record. Based on verified incidents 2020-2025.
            </div>
          </CardContent>
        </Card>
      )}

      {showGovernanceDetails && partyGovernance && (
        <Card className="border-2 border-purple-200 mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              Governance Standards Breakdown
            </CardTitle>
            <CardDescription>
              Assessment of charter access, oversight independence, and policy review cycles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(partyGovernance.score)}`}>
                  {partyGovernance.total}/15
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Score</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(partyGovernance.score)}`}>
                  {partyGovernance.score}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Governance Score</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className={`text-lg font-bold ${partyGovernance.charterAccess >= 4 ? 'text-green-600' : partyGovernance.charterAccess >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {partyGovernance.charterAccess}/5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Charter Access</div>
                <div className="text-xs text-gray-500">Constitution availability</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className={`text-lg font-bold ${partyGovernance.oversightIndependence >= 4 ? 'text-green-600' : partyGovernance.oversightIndependence >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {partyGovernance.oversightIndependence}/5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Oversight Independence</div>
                <div className="text-xs text-gray-500">Ethics & disciplinary bodies</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className={`text-lg font-bold ${partyGovernance.policyReviewCycle >= 4 ? 'text-green-600' : partyGovernance.policyReviewCycle >= 3 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {partyGovernance.policyReviewCycle}/5
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Policy Review Cycle</div>
                <div className="text-xs text-gray-500">Regular update schedule</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Supporting Evidence
              </h4>
              <div className="space-y-2">
                {partyGovernance.evidence.map((item: string, index: number) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    {partyGovernance.score >= 70 ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : partyGovernance.score >= 50 ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    )}
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
              <strong>Weight in Overall Score:</strong> 15% | <strong>Formula:</strong> (Charter Access + Oversight Independence + Policy Review) / 15 × 100
            </div>
          </CardContent>
        </Card>
      )}

      {showFinancialDetails && (
        <Card className="border-2 border-green-200 mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              Public Sentiment Analysis
            </CardTitle>
            <CardDescription>
              Community trust ratings using weighted voting system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(sentimentData?.score || 50)}`}>
                  {sentimentData?.score || 50}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Current Score</div>
                <div className="text-xs text-gray-500">{sentimentData?.totalVotes >= 50 ? 'Live scoring' : 'Neutral baseline'}</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vote Status</div>
                <Badge className={sentimentData?.totalVotes >= 50 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                  {sentimentData?.totalVotes >= 50 ? 'Active Scoring' : 'Awaiting Votes'}
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-600">
                  {sentimentData?.totalVotes || 0} / 50
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Votes {sentimentData?.totalVotes >= 50 ? 'Cast' : 'Needed'}</div>
                <div className="text-xs text-gray-500">{sentimentData?.totalVotes >= 50 ? 'Threshold met' : 'Minimum threshold'}</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Vote className="h-4 w-4" />
                Cast Your Vote
              </h4>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-red-600">Distrust</span>
                  <span className="text-sm font-medium text-gray-600">Neutral (50)</span>
                  <span className="text-sm font-medium text-green-600">Trust</span>
                </div>
                <div className="relative">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={sentimentValue}
                    onChange={(e) => setSentimentValue(parseInt(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-red-200 via-gray-200 to-green-200 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #fecaca 0%, #e5e7eb 50%, #bbf7d0 100%)'
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-sm font-medium">Current: {sentimentValue}</span>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <button 
                    onClick={submitVote}
                    disabled={isSubmittingVote || voteSubmitted}
                    className={`px-4 py-2 text-white rounded text-sm transition-all duration-200 ${
                      voteSubmitted 
                        ? 'bg-green-500 cursor-not-allowed' 
                        : isSubmittingVote
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    } disabled:opacity-75`}
                  >
                    {voteSubmitted ? 'Thanks!' : isSubmittingVote ? 'Submitting...' : userVote ? 'Update Vote' : 'Submit Vote'}
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Voting Breakdown
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-center">
                  <div className="text-lg font-bold text-red-600">{sentimentData?.distrustVotes || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Distrust Votes</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-center">
                  <div className="text-lg font-bold text-green-600">{sentimentData?.trustVotes || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Trust Votes</div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
              <div className="mb-1">
                <strong>Formula:</strong> Score = 50 + 50 × (Trust - Distrust) / Max(Total, 1000)
              </div>
              <div className="mb-1">
                <strong>Minimum Threshold:</strong> 50 votes required for live scoring
              </div>
              <div>
                <strong>Weight in Overall Score:</strong> 25% | Community-driven trust assessment with Bayesian dampening for low-vote scenarios
              </div>
            </div>
          </CardContent>
        </Card>
      )}


    </div>
  );
};

// Parliamentary Activity Section Component
const ParliamentaryActivitySection = ({ politicianName }: { politicianName: string }) => {
  const { data: activityData, isLoading } = useQuery({
    queryKey: ['/api/parliamentary-activity/politician', politicianName],
    queryFn: async () => {
      const response = await fetch(`/api/parliamentary-activity/politician/${encodeURIComponent(politicianName)}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch parliamentary activity');
      }
      const result = await response.json();
      return result.data;
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!activityData) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2">Parliamentary Activity</h4>
        <p className="text-xs text-gray-500">No parliamentary activity data available</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Parliamentary Activity</h4>
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{activityData.attendancePercentage}%</div>
            <div className="text-gray-600">Attendance</div>
            <div className="text-gray-500">{activityData.dailAttendance}/29 days</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{activityData.questionsAsked}</div>
            <div className="text-gray-600">Questions</div>
            <div className="text-gray-500">Asked in Dáil</div>
          </div>
        </div>
        {activityData.otherAttendance > 0 && (
          <div className="text-center text-xs border-t pt-2">
            <div className="text-sm font-medium">{activityData.otherAttendance} community days</div>
            <div className="text-gray-500">Additional engagement</div>
          </div>
        )}
      </div>
    </div>
  );
};

// Interface for party dimensions
interface PartyDimensions {
  party: string;
  economic: number;
  social: number;
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
}

// Interface for dimension explanations
interface DimensionExplanation {
  economic?: string;
  social?: string;
  cultural?: string;
  globalism?: string;
  environmental?: string;
  authority?: string;
  welfare?: string;
  technocratic?: string;
}

// Interface for party performance metrics
interface PartyPerformanceMetrics {
  partyId: number;
  partyName: string;
  governmentStatus: 'government' | 'opposition' | 'coalition';
  overallPerformanceScore: number;
  overallTrustworthinessScore: number;
  pledgeFulfillmentScore: number;
  policyConsistencyScore: number;
  parliamentaryActivityScore: number;
  integrityScore: number;
  transparencyScore: number;
  factualAccuracyScore: number;
  publicAccountabilityScore: number;
  conflictAvoidanceScore: number;
}

// Performance Tab Content Component with Expandable Pledge Fulfillment
const PerformanceTabContent = ({ selectedPartyId }: { selectedPartyId: string }) => {
  const [showPledgeDetails, setShowPledgeDetails] = useState(false);
  const [showParliamentaryDetails, setShowParliamentaryDetails] = useState(false);
  const [showPollingDetails, setShowPollingDetails] = useState(false);
  
  // Map party IDs to database IDs
  const getPartyDatabaseId = (partyId: string) => {
    const mapping: Record<string, string> = {
      'ie-sf': '1',      // Sinn Féin
      'ie-fg': '2',      // Fine Gael
      'ie-ff': '3',      // Fianna Fáil
      'ie-labour': '4',  // Labour Party
      'ie-green': '5',   // Green Party
      'ie-sd': '6',      // Social Democrats
      'ie-pbp': '7',     // People Before Profit
      'ie-aontu': '8',   // Aontú
      'ie-solidarity': '9', // Solidarity
      'ie-independent-ireland': '10' // Independent Ireland
    };
    return mapping[partyId] || '1';
  };

  const partyDbId = getPartyDatabaseId(selectedPartyId);
  
  // Fetch pledges for the selected party
  const { data: pledgesData, isLoading: pledgesLoading } = useQuery({
    queryKey: ['/api/pledges/party', partyDbId],
    queryFn: async () => {
      const response = await fetch(`/api/pledges/party/${partyDbId}`);
      if (!response.ok) throw new Error('Failed to fetch pledges');
      const result = await response.json();
      return result.data;
    },
    enabled: !!partyDbId,
  });

  // Fetch individual pledge weighted performance for the selected party
  const { data: weightedPerformanceData } = useQuery({
    queryKey: ['/api/pledge-weighting/weighted-performance', partyDbId],
    queryFn: async () => {
      const response = await fetch(`/api/pledge-weighting/weighted-performance/${partyDbId}`);
      if (!response.ok) throw new Error('Failed to fetch weighted performance');
      const result = await response.json();
      return result.data;
    },
    enabled: !!partyDbId,
  });

  // Fetch party parliamentary activity score
  const { data: partyActivityData } = useQuery({
    queryKey: ['/api/parliamentary-activity/party', selectedPartyId, 'score'],
    queryFn: async () => {
      const response = await fetch(`/api/parliamentary-activity/party/${selectedPartyId}/score`);
      if (!response.ok) throw new Error('Failed to fetch party activity score');
      const result = await response.json();
      return result.data;
    },
    enabled: !!selectedPartyId,
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Identify government parties (only FF and FG)
  const isGovernmentParty = (partyId: string) => {
    return partyId === 'ie-ff' || partyId === 'ie-fg';
  };

  // Identify newer parties without sufficient policy consistency history
  const isNewerParty = (partyId: string) => {
    return partyId === 'ie-aontu' || partyId === 'ie-independent-ireland';
  };

  // Calculate pledge fulfillment average - both main display and drill-down use same calculation
  const calculateAverageScore = () => {
    if (!pledgesData || pledgesData.length === 0) return 0;
    return pledgesData.reduce((sum: number, item: any) => sum + parseFloat(item.pledge.score), 0) / pledgesData.length;
  };

  // Only show pledge fulfillment score for government parties
  const pledgeFulfillmentScore = isGovernmentParty(selectedPartyId) ? Math.round(calculateAverageScore()) : null;

  // Calculate efficiency score (impact per TD) - Current party affiliations from Oireachtas API
  const tdCounts: Record<string, number> = {
    'ie-ff': 48,     // Fianna Fáil
    'ie-sf': 39,     // Sinn Féin
    'ie-fg': 38,     // Fine Gael
    'ie-independent': 17, // Independent TDs
    'ie-labour': 11, // Labour Party
    'ie-sd': 11,     // Social Democrats
    'ie-independent-ireland': 4, // Independent Ireland
    'ie-pbp': 3,     // People Before Profit-Solidarity
    'ie-aontu': 2,   // Aontú (Tóibín, Lawless)
    'ie-green': 1,   // Green Party
    'ie-irish-freedom': 0 // Irish Freedom Party (no current TDs)
  };

  // Get polling data for the selected party
  const getPollingData = () => {
    const pollingData: Record<string, { jan2024: number; mar2025: number; change: number; name: string }> = {
      'ie-fg': { jan2024: 20.0, mar2025: 17.0, change: -3.0, name: 'Fine Gael' },
      'ie-ff': { jan2024: 17.0, mar2025: 22.0, change: +5.0, name: 'Fianna Fáil' },
      'ie-sf': { jan2024: 25.0, mar2025: 22.0, change: -3.0, name: 'Sinn Féin' },
      'ie-sd': { jan2024: 6.0, mar2025: 7.0, change: +1.0, name: 'Social Democrats' },
      'ie-labour': { jan2024: 4.0, mar2025: 4.0, change: 0.0, name: 'Labour Party' },
      'ie-green': { jan2024: 4.0, mar2025: 3.0, change: -1.0, name: 'Green Party' },
      'ie-pbp': { jan2024: 3.0, mar2025: 3.0, change: 0.0, name: 'People Before Profit' },
      'ie-aontu': { jan2024: 3.0, mar2025: 4.0, change: +1.0, name: 'Aontú' },
      'ie-independent-ireland': { jan2024: 3.0, mar2025: 4.0, change: +1.0, name: 'Independent Ireland' },
      'ie-irish-freedom': { jan2024: 0.0, mar2025: 0.0, change: 0.0, name: 'Irish Freedom Party' }
    };
    return pollingData[selectedPartyId] || { jan2024: 0, mar2025: 0, change: 0, name: 'Unknown' };
  };

  const pollingData = getPollingData();

  // Convert polling change to standardized 0-100 score
  const getPollingScore = () => {
    const change = pollingData.change;
    // Convert -10 to +10 range to 0-100 scale
    // -10pp = 0, 0pp = 50, +10pp = 100
    const score = Math.max(0, Math.min(100, 50 + (change * 5)));
    return Math.round(score);
  };

  const pollingScore = getPollingScore();

  // Policy Consistency data
  const policyConsistencyData: Record<string, { score: number; summary: string; details: string }> = {
    'ie-sd': {
      score: 90,
      summary: "Consistent red-lines on key policies with zero coalition compromises",
      details: "The SocDems pledged red-lines on Sláintecare, affordable homes, climate targets, disability rights and childcare—and, crucially, have yet to end up in a coalition that forces them to water these down. Their voting record shows zero high-profile U-turns, simply because they haven't been in government. That steadfast 'never join a government without these five aims' stance has been consistent since launch."
    },
    'ie-sf': {
      score: 75,
      summary: "Strong manifesto alignment but some inconsistencies on coalition and social issues",
      details: "SF's manifesto targets on housing, health services and social justice are ambitious, but two glaring inconsistencies hurt their score. First, Mary Lou McDonald has repeatedly ruled out coalition with FF/FG—and yet recent statements suggest she might warm to pragmatism if it gets her a seat of power. Second, SF claimed full backing for abortion rights but famously abstained on a key 2021 Stormont vote restricting access for fetal abnormalities."
    },
    'ie-green': {
      score: 65,
      summary: "Bold climate commitments undermined by government compromises",
      details: "The Greens talk a bold climate game—no LNG, no backtracking on fracking—but when push came to shove in government, they let an LNG-friendly Planning Bill sail through, under the excuse of 'energy security.' Internal rebels (like Neasa Hourigan) even got suspended for voting on progressive housing amendments; at least dissent shows principle, but unity was sacrificed."
    },
    'ie-labour': {
      score: 60,
      summary: "Major coalition compromises damaged trustworthiness on key pledges",
      details: "Labour's 'Frankfurt's Way or Labour's Way' pledge to renegotiate the EU-IMF deal was trumpeted in 2011… then promptly ignored once they were in coalition, leaving a permanent stain on their trustworthiness. They've also backed successive budgets that cut public services they once vowed to protect."
    },
    'ie-fg': {
      score: 50,
      summary: "Centre-right consistency marred by water charges and planning compromises",
      details: "FG's centre-right manifesto boasts on economic stewardship, housing fixes and social liberalism, yet they've repeatedly been caught trying to sneak water charges back in through confidence-and-supply deals with FF. And despite green noise, they supported a Planning Bill that doesn't explicitly ban LNG terminals."
    },
    'ie-ff': {
      score: 45,
      summary: "Pragmatic flexibility often comes at cost of policy consistency",
      details: "FF's chameleon-like pragmatism lets them adapt to voter whims—sometimes admired, often derided. They, too, were in on the water charges back-door manoeuvre, betraying earlier promises to abolish them for good. It's hard to fault them for flexibility… but when every policy is up for grabs, consistency takes a hit."
    }
  };

  const getCurrentPolicyData = () => {
    if (isNewerParty(selectedPartyId)) {
      return null; // Return null for newer parties without sufficient history
    }
    const defaultData = { score: 50, summary: "No consistency data available", details: "Insufficient voting history for robust scoring." };
    return policyConsistencyData[selectedPartyId] || defaultData;
  };

  const policyData = getCurrentPolicyData();
  const [showPolicyDetails, setShowPolicyDetails] = useState(false);

  // Calculate overall performance score - only return when real data is available
  const calculateOverallPerformance = () => {
    // Don't calculate if parliamentary activity data hasn't loaded yet
    if (!partyActivityData?.activityScore) {
      return null;
    }

    const pillars = [];
    let pillarCount = 0;
    
    // Pillar 1: Pledge Fulfillment (only for government parties)
    if (isGovernmentParty(selectedPartyId) && pledgeFulfillmentScore !== null) {
      pillars.push(pledgeFulfillmentScore);
      pillarCount++;
    }
    
    // Pillar 2: Policy Consistency (not for newer parties)
    if (policyData !== null) {
      pillars.push(policyData.score);
      pillarCount++;
    }
    
    // Pillar 3: Parliamentary Activity (only when real data is available)
    if (partyActivityData?.activityScore) {
      pillars.push(partyActivityData.activityScore);
      pillarCount++;
    }
    
    // Pillar 4: Polling Score (always available)
    pillars.push(pollingScore);
    pillarCount++;
    
    // Calculate average based on available pillars
    const sum = pillars.reduce((acc, score) => acc + score, 0);
    const overallScore = Math.round(sum / pillarCount);
    return overallScore;
  };

  const overallPerformanceScore = calculateOverallPerformance();

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center rounded-full w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 mb-4">
          {overallPerformanceScore !== null ? (
            <span className={`text-4xl font-bold ${getScoreColor(overallPerformanceScore as number)}`}>
              {overallPerformanceScore}%
            </span>
          ) : (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          )}
        </div>
        <h3 className="text-xl font-semibold">Overall Performance Rating</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Aggregated score from pledge fulfillment, policy consistency, parliamentary activity, and polling trends
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Expandable Pledge Fulfillment Card */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showPledgeDetails ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setShowPledgeDetails(!showPledgeDetails)}
        >
          <CardContent className="p-4 text-center">
            {(() => {
              const scoreColor = pledgeFulfillmentScore !== null ? getScoreColor(pledgeFulfillmentScore) : 'text-gray-500';
              return (
                <div className={`text-2xl font-bold ${scoreColor}`}>
                  {pledgeFulfillmentScore ?? 'N/A'}
                </div>
              );
            })()}
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Pledge Fulfillment</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Election promise delivery
              {showPledgeDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
        
        {/* Expandable Policy Consistency Card */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showPolicyDetails ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setShowPolicyDetails(!showPolicyDetails)}
        >
          <CardContent className="p-4 text-center">
            {(() => {
              const scoreColor = policyData !== null ? getScoreColor(policyData.score) : 'text-gray-500';
              return (
                <div className={`text-2xl font-bold ${scoreColor}`}>
                  {policyData !== null ? policyData.score : 'N/A'}
                </div>
              );
            })()}
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Policy Consistency</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Alignment with stated positions
              {showPolicyDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
        
        {/* Expandable Parliamentary Activity Card */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showParliamentaryDetails ? 'ring-2 ring-purple-500' : ''}`}
          onClick={() => setShowParliamentaryDetails(!showParliamentaryDetails)}
        >
          <CardContent className="p-4 text-center">
            {partyActivityData?.activityScore ? (
              <div className={`text-2xl font-bold ${getScoreColor(partyActivityData.activityScore)}`}>
                {partyActivityData.activityScore}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-400">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
              </div>
            )}
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Parliamentary Activity</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Attendance & Questions Asked
              {showParliamentaryDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
        
        {/* Expandable Polling Data Card */}
        <Card 
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${showPollingDetails ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setShowPollingDetails(!showPollingDetails)}
        >
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${pollingData.change > 0 ? 'text-green-600' : pollingData.change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {pollingData.change > 0 ? '+' : ''}{pollingData.change}pp
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Polling Change</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              Jan 2024 → Mar 2025
              {showPollingDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Expandable Pledge Details */}
      {showPledgeDetails && (
        <div className="mt-6 animate-in slide-in-from-top-5 duration-300">
          <PledgeDetailsSection 
            pledgesData={pledgesData} 
            pledgesLoading={pledgesLoading}
            getScoreColor={getScoreColor}
            getScoreBadge={getScoreBadge}
            formatDate={formatDate}
          />
        </div>
      )}
      
      {/* Expandable Policy Consistency Details */}
      {showPolicyDetails && (
        <div className="mt-6 animate-in slide-in-from-top-5 duration-300">
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Policy Consistency Analysis
              </CardTitle>
              <CardDescription>
                {policyData !== null 
                  ? "Assessment of alignment between stated positions and actual voting records"
                  : "Insufficient voting history for newer parties to assess policy consistency"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {policyData !== null ? (() => {
                const data = policyData; // Type assertion for TypeScript
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getScoreColor(data.score)}`}>
                          {data.score}/100
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Consistency Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Assessment Level
                        </div>
                        <Badge className={getScoreBadge(data.score)}>
                          {data.score >= 80 ? 'Highly Consistent' : 
                           data.score >= 60 ? 'Moderately Consistent' : 'Inconsistent'}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Summary</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                          {data.summary}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Detailed Analysis</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {data.details}
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
                      <strong>Methodology:</strong> Scores based on comparison of manifesto commitments, 
                      campaign pledges, and actual Dáil voting records. Coalition compromises and 
                      policy reversals negatively impact consistency ratings.
                    </div>
                  </>
                );
              })() : (
                <div className="text-center py-8">
                  <div className="text-3xl font-bold text-gray-500 mb-2">N/A</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">No Data Available</div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 max-w-md mx-auto">
                    {isNewerParty(selectedPartyId) 
                      ? "This party was established recently and lacks sufficient parliamentary voting history to assess policy consistency patterns."
                      : "Insufficient data available to assess policy consistency for this party."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Expandable Parliamentary Activity Details */}
      {showParliamentaryDetails && (
        <div className="mt-6 animate-in slide-in-from-top-5 duration-300">
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Parliamentary Activity Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Attendance Score</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-purple-600">
                      {partyActivityData?.attendanceScore || 50}
                    </span>
                    <span className="text-sm text-gray-600">
                      {partyActivityData?.averageAttendance || 50}% attendance rate
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Weight: 60% of overall score
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Questions Score</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-600">
                      {partyActivityData?.questionsScore || 50}
                    </span>
                    <span className="text-sm text-gray-600">
                      {partyActivityData?.questionsPerTD || 0} per TD
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Weight: 40% of overall score
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Additional Metrics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Questions Asked:</span>
                    <span className="font-medium ml-2">{partyActivityData?.questionsAsked || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Number of TDs:</span>
                    <span className="font-medium ml-2">{partyActivityData?.tdCount || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
                <strong>Methodology:</strong> Parliamentary activity combines attendance rates (60%) with 
                questions per TD (40%). Attendance reflects commitment to parliamentary duties, while 
                questions per TD measures active engagement in holding government accountable. 
                {partyActivityData?.weighting && ` Current weighting: ${partyActivityData.weighting}`}
                <br /><br />
                <strong>Data Period:</strong> 1st January 2025 to 30th April 2025
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Expandable Polling Details */}
      {showPollingDetails && (
        <div className="mt-6 animate-in slide-in-from-top-5 duration-300">
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Polling Data Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Jan 2024</h4>
                  <div className="text-2xl font-bold text-blue-600">
                    {pollingData.jan2024}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    RED C Research
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                  <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">Mar 2025</h4>
                  <div className="text-2xl font-bold text-green-600">
                    {pollingData.mar2025}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Business Post RED C
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg text-center ${
                  pollingData.change > 0 
                    ? 'bg-green-50 dark:bg-green-900/20' 
                    : pollingData.change < 0 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : 'bg-gray-50 dark:bg-gray-900/20'
                }`}>
                  <h4 className={`font-semibold mb-2 ${
                    pollingData.change > 0 
                      ? 'text-green-700 dark:text-green-300' 
                      : pollingData.change < 0 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>Net Change</h4>
                  <div className={`text-2xl font-bold ${
                    pollingData.change > 0 
                      ? 'text-green-600' 
                      : pollingData.change < 0 
                      ? 'text-red-600' 
                      : 'text-gray-600'
                  }`}>
                    {pollingData.change > 0 ? '+' : ''}{pollingData.change}pp
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    14-month period
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-gray-600 dark:text-gray-400">
                <strong>Sources:</strong> January 2024 data from RED C Research Business Post poll. 
                March 2025 data from Business Post RED C Opinion Poll Report. Polling data reflects 
                voter intention at time of survey and may not represent actual election results.
                <br /><br />
                <strong>Methodology:</strong> Both polls used representative samples of Irish adults 
                with standard margin of error ±3%. Independent Ireland data includes separate polling 
                from The Sun Ireland for March 2025 figures.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mt-4">
        <h4 className="font-medium text-sm mb-2">About This Rating</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Performance metrics are based on objective data including voting records, 
          parliamentary attendance, policy implementation tracking, and independent evaluations. 
          {isGovernmentParty(selectedPartyId) 
            ? ' Government parties (Fianna Fáil & Fine Gael) are evaluated on four metrics: pledge fulfillment, policy consistency, parliamentary activity, and polling trends.' 
            : isNewerParty(selectedPartyId)
            ? ' Newer parties (Aontú & Independent Ireland) are evaluated on two metrics: parliamentary activity and polling trends. Pledge fulfillment and policy consistency are marked N/A due to insufficient historical data.'
            : ' Opposition parties are evaluated on three metrics: policy consistency, parliamentary activity, and polling trends. Pledge fulfillment is marked N/A as they are not responsible for implementing government policy.'}
          Scores are updated quarterly based on new data.
        </p>
      </div>
      {/* Pledge Voting Interface */}
      <PledgeVotingInterface 
        partyId={getPartyDatabaseId(selectedPartyId)}
        onWeightedScoreChange={(score) => {
          // Update the overall performance display with weighted score
          console.log('Weighted score updated:', score);
        }}
      />
    </div>
  );
};

// Pledge Details Section Component
const PledgeDetailsSection = ({ pledgesData, pledgesLoading, getScoreColor, getScoreBadge, formatDate }: any) => {
  if (pledgesLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading pledge data...</p>
      </div>
    );
  }

  if (!pledgesData || pledgesData.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Pledges Available</h3>
        <p className="text-gray-600">
          No pledge data is currently available for this party.
        </p>
      </div>
    );
  }

  const totalPledges = pledgesData.length;
  // Use same calculation as main display
  const averageScore = pledgesData.reduce((sum: number, item: any) => sum + parseFloat(item.pledge.score), 0) / totalPledges;

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          Detailed Pledge Breakdown
        </CardTitle>
        <CardDescription>
          Individual pledge performance and progress tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalPledges}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Pledges</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(Math.round(averageScore))}`}>
              {Math.round(averageScore)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Average Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {pledgesData.filter((item: any) => parseFloat(item.pledge.score) >= 80).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">High Performance</div>
          </div>
        </div>

        {/* Pledges List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {pledgesData.map((item: any, index: number) => {
            const pledge = item.pledge;
            const actions = item.actions || [];
            
            return (
              <Card key={pledge.id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-base mb-1">{pledge.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {pledge.description}
                      </CardDescription>
                    </div>
                    <Badge className={getScoreBadge(pledge.score)}>
                      {pledge.score}% Complete
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>{pledge.score}%</span>
                    </div>
                    <Progress value={parseFloat(pledge.score)} className="h-2" />
                  </div>

                  {/* Category and Date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3 text-blue-500" />
                      <span className="capitalize">{pledge.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span>{formatDate(pledge.lastUpdated)}</span>
                    </div>
                  </div>

                  {/* Evidence */}
                  {pledge.evidence && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                      <div className="font-medium mb-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Evidence
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">
                        {pledge.evidence}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Original Pledge Fulfillment Tab Component (kept for reference)
const PledgeFulfillmentTab = ({ selectedPartyId }: { selectedPartyId: string }) => {
  // Map party IDs to database IDs
  const getPartyDatabaseId = (partyId: string) => {
    const mapping: Record<string, string> = {
      'ie-sf': '1',      // Sinn Féin
      'ie-fg': '2',      // Fine Gael
      'ie-ff': '3',      // Fianna Fáil
      'ie-labour': '4',  // Labour Party
      'ie-green': '5',   // Green Party
      'ie-sd': '6',      // Social Democrats
      'ie-pbp': '7',     // People Before Profit
      'ie-aontu': '8',   // Aontú
      'ie-solidarity': '9', // Solidarity
      'ie-independent-ireland': '10' // Independent Ireland
    };
    return mapping[partyId] || '1';
  };

  const partyDbId = getPartyDatabaseId(selectedPartyId);
  
  // Fetch pledges for the selected party
  const { data: pledgesData, isLoading: pledgesLoading, error } = useQuery({
    queryKey: ['/api/pledges/party', partyDbId],
    queryFn: async () => {
      const response = await fetch(`/api/pledges/party/${partyDbId}`);
      if (!response.ok) throw new Error('Failed to fetch pledges');
      const result = await response.json();
      return result.data;
    },
    enabled: !!partyDbId,
  });

  const getScoreColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 80) return 'text-green-600';
    if (numScore >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 80) return 'bg-green-100 text-green-800';
    if (numScore >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (pledgesLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading pledge data...</p>
      </div>
    );
  }

  if (error || !pledgesData || pledgesData.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Pledges Available</h3>
        <p className="text-gray-600">
          No pledge data is currently available for this party.
        </p>
      </div>
    );
  }

  const totalPledges = pledgesData.length;
  const averageScore = pledgesData.reduce((sum: number, item: any) => sum + parseFloat(item.pledge.score), 0) / totalPledges;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalPledges}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Pledges</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getScoreColor(Math.round(averageScore).toString())}`}>
              {Math.round(averageScore)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Average Score</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {pledgesData.filter((item: any) => parseFloat(item.pledge.score) >= 80).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">High Performance</div>
          </div>
        </div>
      </div>

      {/* Pledges List */}
      <div className="space-y-4">
        {pledgesData.map((item: any, index: number) => {
          const pledge = item.pledge;
          const actions = item.actions || [];
          
          return (
            <Card key={pledge.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{pledge.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {pledge.description}
                    </CardDescription>
                  </div>
                  <Badge className={getScoreBadge(pledge.score)}>
                    {pledge.score}% Complete
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{pledge.score}%</span>
                  </div>
                  <Progress value={parseFloat(pledge.score)} className="h-2" />
                </div>

                {/* Category and Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Category:</span>
                    <span className="capitalize">{pledge.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Last Updated:</span>
                    <span>{formatDate(pledge.lastUpdated)}</span>
                  </div>
                </div>

                {/* Evidence */}
                {pledge.evidence && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Evidence & Progress
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {pledge.evidence}
                    </p>
                  </div>
                )}

                {/* Recent Actions */}
                {actions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Recent Actions</h4>
                    <div className="space-y-2">
                      {actions.slice(0, 3).map((action: any) => (
                        <div key={action.id} className="text-sm bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                          <div className="font-medium capitalize">{action.actionType.replace('_', ' ')}</div>
                          <div className="text-gray-600 dark:text-gray-400 text-xs">
                            {formatDate(action.actionDate)}
                          </div>
                          {action.description && (
                            <div className="text-gray-700 dark:text-gray-300 mt-1">
                              {action.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm">
        <h4 className="font-medium mb-2">About These Scores</h4>
        <p className="text-gray-600 dark:text-gray-400">
          Pledge fulfillment scores are based on objective assessment of policy implementation, 
          legislative progress, and delivery of campaign commitments. Scores are updated regularly 
          based on government reports, parliamentary records, and independent verification.
        </p>
      </div>
    </div>
  );
};

// Party Performance Section Component
const PartyPerformanceSection = () => {
  const [selectedPartyForPerformance, setSelectedPartyForPerformance] = useState<string>('2'); // Default to Fine Gael

  // Get party performance data using individual pledge weights
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['/api/pledge-weighting/weighted-performance', selectedPartyForPerformance],
    queryFn: async () => {
      const response = await fetch(`/api/pledge-weighting/weighted-performance/${selectedPartyForPerformance}`);
      if (!response.ok) throw new Error('Failed to fetch weighted performance data');
      const result = await response.json();
      return result.data;
    },
  });

  // Get legacy performance data for trustworthiness scores
  const { data: trustworthinessData } = useQuery({
    queryKey: ['/api/pledges/performance', selectedPartyForPerformance],
    queryFn: async () => {
      const response = await fetch(`/api/pledges/performance/${selectedPartyForPerformance}`);
      if (!response.ok) throw new Error('Failed to fetch performance data');
      const result = await response.json();
      return result.data as PartyPerformanceMetrics;
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getGovernmentStatusBadge = (status: string) => {
    switch (status) {
      case 'government':
        return 'bg-blue-100 text-blue-800';
      case 'coalition':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatGovernmentStatus = (status: string) => {
    switch (status) {
      case 'government':
        return 'Government Party';
      case 'coalition':
        return 'Coalition Partner';
      default:
        return 'Opposition Party';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Party Performance & Trustworthiness Analysis
          </CardTitle>
          <CardDescription>
            Real-time scoring based on pledge fulfillment, parliamentary activity, and accountability metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Select Party</label>
            <Select value={selectedPartyForPerformance} onValueChange={setSelectedPartyForPerformance}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Choose a party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">
                  <div className="flex items-center gap-2">
                    <span>Fianna Fáil</span>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                      In Government
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="2">
                  <div className="flex items-center gap-2">
                    <span>Fine Gael</span>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                      In Government
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="4">Green Party</SelectItem>
                <SelectItem value="1">Sinn Féin</SelectItem>
                <SelectItem value="5">Labour Party</SelectItem>
                <SelectItem value="6">Social Democrats</SelectItem>
                <SelectItem value="7">People Before Profit</SelectItem>
                <SelectItem value="8">Aontú</SelectItem>
                <SelectItem value="9">Independent Ireland</SelectItem>
                <SelectItem value="10">Irish Freedom Party</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {performanceLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading performance data...</p>
            </div>
          ) : performanceData ? (
            <div className="space-y-6">
              {/* Party Header */}
              <div className="border rounded-lg p-4 bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold">
                    {selectedPartyForPerformance === '2' ? 'Fine Gael' : 
                     selectedPartyForPerformance === '3' ? 'Fianna Fáil' : 
                     selectedPartyForPerformance === '1' ? 'Sinn Féin' :
                     selectedPartyForPerformance === '4' ? 'Green Party' :
                     selectedPartyForPerformance === '5' ? 'Labour Party' :
                     selectedPartyForPerformance === '6' ? 'Social Democrats' :
                     selectedPartyForPerformance === '7' ? 'People Before Profit' :
                     selectedPartyForPerformance === '8' ? 'Aontú' :
                     selectedPartyForPerformance === '9' ? 'Independent Ireland' :
                     selectedPartyForPerformance === '10' ? 'Irish Freedom Party' : 'Selected Party'}
                  </h3>
                  <Badge className={trustworthinessData ? getGovernmentStatusBadge(trustworthinessData.governmentStatus) : 'bg-gray-100 text-gray-800'}>
                    {trustworthinessData ? formatGovernmentStatus(trustworthinessData.governmentStatus) : 'Loading...'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {selectedPartyForPerformance === '1' ? 'Advocacy Score (Individual Pledge Weights)' : 'Weighted Performance (Individual Pledge Weights)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${getScoreColor(performanceData.weightedScore)}`}>
                        {performanceData.weightedScore.toFixed(1)}%
                      </span>
                      <Badge className={getScoreBadge(performanceData.weightedScore)}>
                        {performanceData.weightedScore >= 80 ? 'Excellent' : 
                         performanceData.weightedScore >= 60 ? 'Good' : 'Needs Improvement'}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {performanceData.weightedPledgeCount} weighted pledges of {performanceData.pledgeCount} total
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-medium">Trustworthiness</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${trustworthinessData ? getScoreColor(trustworthinessData.overallTrustworthinessScore) : 'text-gray-400'}`}>
                        {trustworthinessData ? trustworthinessData.overallTrustworthinessScore : 'N/A'}%
                      </span>
                      <Badge className={trustworthinessData ? getScoreBadge(trustworthinessData.overallTrustworthinessScore) : 'bg-gray-100 text-gray-800'}>
                        {trustworthinessData ? (trustworthinessData.overallTrustworthinessScore >= 80 ? 'Highly Trustworthy' : 
                         trustworthinessData.overallTrustworthinessScore >= 60 ? 'Trustworthy' : 'Trust Issues') : 'Loading...'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Pledge Breakdown */}
              <div className="mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {selectedPartyForPerformance === '1' ? 'Individual Pledge Advocacy Breakdown' : 'Individual Pledge Performance Breakdown'}
                    </CardTitle>
                    <CardDescription>
                      {selectedPartyForPerformance === '1' ? 
                        'Each advocacy effort is weighted by importance. Shows influence and pressure on government policy.' : 
                        'Each pledge is weighted by importance. Total weight: {performanceData.totalWeight}%'
                      }
                    </CardDescription>
                    
                    {/* Pledge Interpretation Guidelines */}
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <strong className="text-blue-900 dark:text-blue-100">How to interpret pledge percentages:</strong>
                          <ul className="mt-1 space-y-1 text-blue-800 dark:text-blue-200">
                            <li>• <strong>0%</strong> means no delivery so far</li>
                            <li>• <strong>1–49%</strong> indicates planning or partial steps</li>
                            <li>• <strong>50–99%</strong> indicates substantial delivery of key elements</li>
                            <li>• <strong>100%</strong> means the pledge milestone for 2024–25 has been met</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Category Breakdown */}
                      {Object.entries(performanceData.categoryBreakdown || {}).map(([category, data]: [string, any]) => (
                        <div key={category} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-lg">{category}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">Weight: {data.totalWeight}%</span>
                              <Badge className={getScoreBadge(data.averageScore)}>
                                {data.averageScore.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {data.pledges?.map((pledge: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                <span className="flex-1">{pledge.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500">Weight: {pledge.weight}%</span>
                                  <span className={`font-medium ${getScoreColor(pledge.score)}`}>
                                    {pledge.score}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Performance Metrics
                    </CardTitle>
                    <CardDescription>
                      {trustworthinessData && (trustworthinessData.governmentStatus === 'government' || trustworthinessData.governmentStatus === 'coalition') 
                        ? 'Based on policy delivery and implementation'
                        : 'Based on advocacy efforts and parliamentary activity'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">
                          {performanceData.governmentStatus === 'government' || performanceData.governmentStatus === 'coalition' 
                            ? 'Pledge Fulfillment' 
                            : 'Advocacy Effectiveness'
                          }
                        </span>
                        <span className={`font-semibold ${getScoreColor(performanceData.pledgeFulfillmentScore)}`}>
                          {performanceData.pledgeFulfillmentScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.pledgeFulfillmentScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Policy Consistency</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.policyConsistencyScore)}`}>
                          {performanceData.policyConsistencyScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.policyConsistencyScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Parliamentary Activity</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.parliamentaryActivityScore)}`}>
                          {performanceData.parliamentaryActivityScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.parliamentaryActivityScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Integrity</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.integrityScore)}`}>
                          {performanceData.integrityScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.integrityScore} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Trustworthiness Metrics
                    </CardTitle>
                    <CardDescription>
                      Accountability, transparency and public trust indicators
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Transparency</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.transparencyScore)}`}>
                          {performanceData.transparencyScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.transparencyScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Factual Accuracy</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.factualAccuracyScore)}`}>
                          {performanceData.factualAccuracyScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.factualAccuracyScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Public Accountability</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.publicAccountabilityScore)}`}>
                          {performanceData.publicAccountabilityScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.publicAccountabilityScore} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Conflict Avoidance</span>
                        <span className={`font-semibold ${getScoreColor(performanceData.conflictAvoidanceScore)}`}>
                          {performanceData.conflictAvoidanceScore}%
                        </span>
                      </div>
                      <Progress value={performanceData.conflictAvoidanceScore} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Methodology Note */}
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-800 mb-1">Scoring Methodology</h4>
                      <div className="text-sm text-amber-700 space-y-1">
                        <p><strong>Government Parties:</strong> Scored on actual policy implementation and pledge fulfillment</p>
                        <p><strong>Opposition Parties:</strong> Scored on advocacy effectiveness and policy promotion efforts</p>
                        <p><strong>Trustworthiness:</strong> Based on transparency, factual accuracy, and public accountability across all parties</p>
                        <p className="mt-2 italic">Scores are updated regularly based on parliamentary activity and public records</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No performance data available for this party</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Trust Score Breakdown Component
const TrustScoreBreakdown = ({ politicianName }: { politicianName: string }) => {
  const { data: trustData, isLoading } = useQuery({
    queryKey: [`/api/trust-scores/politician/${politicianName}`],
    enabled: !!politicianName,
  });

  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-sm text-gray-500">Loading trust breakdown...</div>
      </div>
    );
  }

  if (!trustData || typeof trustData !== 'object' || trustData === null || !('success' in trustData) || !(trustData as any).success || !('data' in trustData) || !(trustData as any).data) {
    return (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-sm text-gray-500">No detailed trust data available</div>
      </div>
    );
  }

  const trust = (trustData as any).data;

  // Use actual scores from the database for each TD
  const flipFlopScore = trust.flip_flops_score || 0;
  const consistencyScore = trust.consistency_score || 0;
  const reliabilityScore = trust.reliability_score || 0;
  const corruptionScore = trust.corruption_cleanliness_score || 0;
  const overallScore = trust.overall_trust_score || 0;

  return (
    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
      <h4 className="text-sm font-semibold mb-3 text-green-800 dark:text-green-200">Trust Score Breakdown</h4>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{flipFlopScore}/100</div>
          <div className="text-xs text-green-700 dark:text-green-300">Flip-Flops</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{consistencyScore}/100</div>
          <div className="text-xs text-green-700 dark:text-green-300">Consistency</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{reliabilityScore}/100</div>
          <div className="text-xs text-green-700 dark:text-green-300">Reliability</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{corruptionScore}/100</div>
          <div className="text-xs text-green-700 dark:text-green-300">Corruption Clean</div>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">🔄 Flip-Flops ({flipFlopScore}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">{trust.flip_flops_notes || 'No notes available'}</div>
        </div>
        
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">🧭 Consistency ({consistencyScore}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">{trust.consistency_notes || 'No notes available'}</div>
        </div>
        
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">⚡ Reliability ({reliabilityScore}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">{trust.reliability_notes || 'No notes available'}</div>
        </div>
        
        <div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">🛡️ Corruption & Integrity ({corruptionScore}/100)</div>
          <div className="text-gray-600 dark:text-gray-400">{trust.corruption_notes || 'No notes available'}</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{overallScore}/100</div>
          <div className="text-xs text-green-700 dark:text-green-300">Overall Trust Score</div>
        </div>
      </div>
    </div>
  );
};

// Component for displaying most trustworthy politicians
const TopTrustworthyPoliticians = ({ onPoliticianClick }: { onPoliticianClick?: (name: string) => void }) => {
  const [topPoliticians, setTopPoliticians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopTrustworthy = async () => {
      try {
        const response = await fetch('/api/trust-scores/top-trustworthy?limit=10');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTopPoliticians(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching top trustworthy politicians:', error);
      }
      setLoading(false);
    };

    fetchTopTrustworthy();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-300 rounded"></div>
                <div className="h-3 w-24 bg-gray-300 rounded"></div>
              </div>
            </div>
            <div className="h-8 w-16 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{topPoliticians.length} TDs assessed</span>
      </div>
      
      <div className="space-y-3">
        {topPoliticians.map((politician, index) => {
          const party = politicalParties.find(p => p.id === politician.party_id);
          return (
            <div 
              key={politician.politician_name}
              className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer"
              onClick={() => {
                if (onPoliticianClick) {
                  onPoliticianClick(politician.politician_name);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-green-600 w-8">#{index + 1}</span>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party?.color || "#888" }}></div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 hover:text-green-600 transition-colors">{politician.politician_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {party?.name || "Independent"} • {politician.constituency}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{politician.overall_trust_score}%</div>
                <div className="text-xs text-green-700 dark:text-green-300">Trust Score</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {topPoliticians.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No trust score data available
        </div>
      )}
    </div>
  );
};

// Component for displaying least trustworthy politicians
const LeastTrustworthyPoliticians = ({ onPoliticianClick }: { onPoliticianClick?: (name: string) => void }) => {
  const [bottomPoliticians, setBottomPoliticians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeastTrustworthy = async () => {
      try {
        const response = await fetch('/api/trust-scores/least-trustworthy?limit=10');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setBottomPoliticians(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching least trustworthy politicians:', error);
      }
      setLoading(false);
    };

    fetchLeastTrustworthy();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-300 rounded"></div>
                <div className="h-3 w-24 bg-gray-300 rounded"></div>
              </div>
            </div>
            <div className="h-8 w-16 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{bottomPoliticians.length} TDs assessed</span>
      </div>
      
      <div className="space-y-3">
        {bottomPoliticians.map((politician, index) => {
          const party = politicalParties.find(p => p.id === politician.party_id);
          return (
            <div 
              key={politician.politician_name}
              className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
              onClick={() => {
                if (onPoliticianClick) {
                  onPoliticianClick(politician.politician_name);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-red-600 w-8">#{index + 1}</span>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party?.color || "#888" }}></div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 hover:text-red-600 transition-colors">{politician.politician_name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {party?.name || "Independent"} • {politician.constituency}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">{politician.overall_trust_score}%</div>
                <div className="text-xs text-red-700 dark:text-red-300">Trust Score</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {bottomPoliticians.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No trust score data available
        </div>
      )}
    </div>
  );
};

// Component for displaying top performing politicians
const TopPerformersList = ({ onPoliticianClick }: { onPoliticianClick?: (name: string) => void }) => {
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopPerformers = async () => {
      try {
        const response = await fetch('/api/performance-scores/top-performers');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTopPerformers(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching top performers:', error);
      }
      setLoading(false);
    };

    fetchTopPerformers();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-300 rounded"></div>
                <div className="h-3 w-24 bg-gray-300 rounded"></div>
              </div>
            </div>
            <div className="h-8 w-16 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">

        <span className="text-sm text-gray-500">{topPerformers.length} TDs assessed</span>
      </div>
      
      <div className="space-y-3">
        {topPerformers.map((politician, index) => {
          // Find politician data to get party and constituency info
          const politicianData = politicians.find(p => p.name === politician.politicianName);
          const party = politicalParties.find(p => p.id === politicianData?.partyId);
          return (
            <div 
              key={politician.politicianName}
              className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
              onClick={() => {
                if (onPoliticianClick) {
                  onPoliticianClick(politician.politicianName);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-blue-600 w-8">#{index + 1}</span>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party?.color || "#888" }}></div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 hover:text-blue-600 transition-colors">{politician.politicianName}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {party?.name || "Independent"} • {politicianData?.constituency || "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{politician.overallScore}%</div>
                <div className="text-xs text-blue-700 dark:text-blue-300">Performance</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {topPerformers.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No performance score data available
        </div>
      )}
    </div>
  );
};

// Component for displaying lowest performing politicians
const LowPerformersList = ({ onPoliticianClick }: { onPoliticianClick?: (name: string) => void }) => {
  const [lowPerformers, setLowPerformers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLowPerformers = async () => {
      try {
        const response = await fetch('/api/performance-scores/lowest-performers');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setLowPerformers(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching low performers:', error);
      }
      setLoading(false);
    };

    fetchLowPerformers();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300"></div>
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-300 rounded"></div>
                <div className="h-3 w-24 bg-gray-300 rounded"></div>
              </div>
            </div>
            <div className="h-8 w-16 bg-gray-300 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">

        <span className="text-sm text-gray-500">{lowPerformers.length} TDs assessed</span>
      </div>
      
      <div className="space-y-3">
        {lowPerformers.map((politician, index) => {
          // Find politician data to get party and constituency info
          const politicianData = politicians.find(p => p.name === politician.politicianName);
          const party = politicalParties.find(p => p.id === politicianData?.partyId);
          return (
            <div 
              key={politician.politicianName}
              className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors cursor-pointer"
              onClick={() => {
                if (onPoliticianClick) {
                  onPoliticianClick(politician.politicianName);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-orange-600 w-8">#{index + 1}</span>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party?.color || "#888" }}></div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200 hover:text-orange-600 transition-colors">{politician.politicianName}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {party?.name || "Independent"} • {politicianData?.constituency || "Unknown"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">{politician.overallScore}%</div>
                <div className="text-xs text-orange-700 dark:text-orange-300">Performance</div>
              </div>
            </div>
          );
        })}
      </div>
      
      {lowPerformers.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          No performance score data available
        </div>
      )}
    </div>
  );
};

const EducationPage = () => {
  const [selectedCountry, setSelectedCountry] = useState<string>("ireland");
  const [earnedPoints, setEarnedPoints] = useState<number>(0);
  const [completedContent, setCompletedContent] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("parties");
  
  // State for collapsible sections
  const [showMostTrusted, setShowMostTrusted] = useState<boolean>(true);
  const [showLeastTrusted, setShowLeastTrusted] = useState<boolean>(true);
  const [showTopPerformers, setShowTopPerformers] = useState<boolean>(true);
  const [showLowPerformers, setShowLowPerformers] = useState<boolean>(true);

  // Function to handle party click from dashboard
  const handlePartyClick = (partyId: string) => {
    // Map dashboard party IDs to dropdown values based on trustworthiness mapping
    const partyIdMapping: Record<string, string> = {
      '1': 'ie-sf',     // Sinn Féin
      '2': 'ie-fg',     // Fine Gael  
      '3': 'ie-ff',     // Fianna Fáil
      '4': 'ie-labour', // Labour Party
      '5': 'ie-green',  // Green Party
      '6': 'ie-sd',     // Social Democrats
      '7': 'ie-pbp',    // People Before Profit
      '8': 'ie-aontu'   // Aontú
    };
    
    const mappedPartyId = partyIdMapping[partyId] || partyId;
    setSelectedPartyId(mappedPartyId);
    setActiveTab("parties");
    
    // Slight delay to ensure the tab switch and filter are set before scrolling
    setTimeout(() => {
      const partiesSection = document.getElementById('parties-section');
      if (partiesSection) {
        partiesSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Function to handle politician click from dashboard
  const handlePoliticianClick = (politicianName: string) => {
    // Switch to politicians tab and filter by name
    setActiveTab("politicians");
    setNameSearchFilter(politicianName);
    // Slight delay to ensure the tab switch and filter are set before scrolling
    setTimeout(() => {
      const politiciansSection = document.getElementById('politicians-section');
      if (politiciansSection) {
        politiciansSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Dashboard data queries - now using server-side API for consistency
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/dashboard-metrics'],
    staleTime: 1 * 60 * 1000, // 1 minute to ensure fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: true // Always fetch fresh data on mount
  });
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedPoliticianId, setSelectedPoliticianId] = useState<string | null>(null);
  const [selectedTrustPolitician, setSelectedTrustPolitician] = useState<string | null>(null);
  const [selectedPerformancePolitician, setSelectedPerformancePolitician] = useState<string | null>(null);
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string | null>(null);
  const [selectedConstituencyFilter, setSelectedConstituencyFilter] = useState<string | null>(null);
  const [electionStatusFilter, setElectionStatusFilter] = useState<string>("elected");
  const [nameSearchFilter, setNameSearchFilter] = useState<string>("");
  const [showAllPoliticians, setShowAllPoliticians] = useState<boolean>(false);
  const [politiciansViewMode, setPoliticiansViewMode] = useState<'boxes' | 'bars'>('boxes');
  const [trustScores, setTrustScores] = useState<Record<string, number>>({});
  const [trustScoresLoading, setTrustScoresLoading] = useState<Record<string, boolean>>({});
  const [performanceScores, setPerformanceScores] = useState<Record<string, number>>({});
  const [performanceScoresLoading, setPerformanceScoresLoading] = useState<Record<string, boolean>>({});
  
  // Dashboard collapsible sections state
  const [showTopPerformance, setShowTopPerformance] = useState<boolean>(true);
  const [showTopTrust, setShowTopTrust] = useState<boolean>(true);

  // Reset "Show All" state when filters change
  useEffect(() => {
    setShowAllPoliticians(false);
  }, [selectedPartyFilter, selectedConstituencyFilter, electionStatusFilter, nameSearchFilter]);

  // Fetch trust scores for politicians in parallel batches
  useEffect(() => {
    const fetchTrustScores = async () => {
      // Filter to only Irish politicians to reduce unnecessary requests
      const irishPoliticians = politicians.filter(p => p.partyId?.startsWith("ie-"));
      
      const loadingStates: Record<string, boolean> = {};
      
      // Set only Irish politicians as loading
      for (const politician of irishPoliticians) {
        loadingStates[politician.name] = true;
      }
      setTrustScoresLoading(loadingStates);
      
      // Process in parallel batches of 10 to avoid overwhelming the server
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < irishPoliticians.length; i += batchSize) {
        batches.push(irishPoliticians.slice(i, i + batchSize));
      }
      
      const scores: Record<string, number> = {};
      
      for (const batch of batches) {
        // Process each batch in parallel
        const batchPromises = batch.map(async (politician) => {
          try {
            const response = await fetch(`/api/trust-scores/politician/${encodeURIComponent(politician.name)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                scores[politician.name] = data.data.overall_trust_score;
              }
            }
          } catch (error) {
            // Silently handle errors - will use default score
          }
          
          // Mark this politician as no longer loading
          setTrustScoresLoading(prev => ({
            ...prev,
            [politician.name]: false
          }));
        });
        
        // Wait for this batch to complete before starting the next
        await Promise.all(batchPromises);
        
        // Update scores incrementally as batches complete
        setTrustScores(prev => ({ ...prev, ...scores }));
      }
    };
    
    fetchTrustScores();
  }, []);

  // Fetch performance scores for politicians in parallel batches
  useEffect(() => {
    const fetchPerformanceScores = async () => {
      // Filter to only Irish politicians to reduce unnecessary requests
      const irishPoliticians = politicians.filter(p => p.partyId?.startsWith("ie-"));
      
      const loadingStates: Record<string, boolean> = {};
      
      // Set only Irish politicians as loading
      for (const politician of irishPoliticians) {
        loadingStates[politician.name] = true;
      }
      setPerformanceScoresLoading(loadingStates);
      
      // Process in parallel batches of 10 to avoid overwhelming the server
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < irishPoliticians.length; i += batchSize) {
        batches.push(irishPoliticians.slice(i, i + batchSize));
      }
      
      const scores: Record<string, number> = {};
      
      for (const batch of batches) {
        // Process each batch in parallel
        const batchPromises = batch.map(async (politician) => {
          try {
            const response = await fetch(`/api/performance-scores/politician/${encodeURIComponent(politician.name)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                scores[politician.name] = data.data.overallScore;
              }
            }
          } catch (error) {
            // Silently handle errors - will use default score
          }
          
          // Mark this politician as no longer loading
          setPerformanceScoresLoading(prev => ({
            ...prev,
            [politician.name]: false
          }));
        });
        
        // Wait for this batch to complete before starting the next
        await Promise.all(batchPromises);
        
        // Update scores incrementally as batches complete
        setPerformanceScores(prev => ({ ...prev, ...scores }));
      }
    };
    
    fetchPerformanceScores();
  }, []);
  const [primaryDimension, setPrimaryDimension] = useState<string>("economic");
  const [secondaryDimension, setSecondaryDimension] = useState<string>("social");
  const [showAllDimensions, setShowAllDimensions] = useState<boolean>(false);
  const [partyDimensions, setPartyDimensions] = useState<Record<string, PartyDimensions>>({});
  const [dimensionExplanations, setDimensionExplanations] = useState<Record<string, DimensionExplanation>>({});
  const [isExplanationEditorOpen, setIsExplanationEditorOpen] = useState<boolean>(false);
  
  // Load party dimensions and their explanations from the database
  useEffect(() => {
    const loadPartyData = async () => {
      // Create a default dimensions map
      let dimensionsMap: Record<string, PartyDimensions> = {
        'ie-sf': {
          party: 'Sinn Féin',
          economic: -6,
          social: -6,
          cultural: -3,
          globalism: -3,
          environmental: 4,
          authority: 1,
          welfare: 7,
          technocratic: -5
        },
        'ie-fg': {
          party: 'Fine Gael',
          economic: 2,
          social: 2,
          cultural: 3,
          globalism: 6,
          environmental: 1,
          authority: 4,
          welfare: 2,
          technocratic: 5
        },
        'ie-ff': {
          party: 'Fianna Fáil',
          economic: 1,
          social: 1,
          cultural: 2,
          globalism: 4,
          environmental: 2,
          authority: 2,
          welfare: 3,
          technocratic: 3
        },
        'ie-labour': {
          party: 'Labour Party',
          economic: -4,
          social: -6,
          cultural: -5,
          globalism: 8,
          environmental: 6,
          authority: -3,
          welfare: 8,
          technocratic: 2
        },
        'ie-green': {
          party: 'Green Party',
          economic: -2,
          social: -5,
          cultural: -6,
          globalism: 7,
          environmental: 10,
          authority: -2,
          welfare: 6,
          technocratic: 7
        },
        'ie-sd': {
          party: 'Social Democrats',
          economic: -5,
          social: -8,
          cultural: -7,
          globalism: 9,
          environmental: 7,
          authority: -4,
          welfare: 9,
          technocratic: 6
        },
        'ie-pbp': {
          party: 'People Before Profit',
          economic: -9,
          social: -10,
          cultural: -10,
          globalism: -1,
          environmental: 5,
          authority: -8,
          welfare: 10,
          technocratic: -9
        },
        'ie-aontu': {
          party: 'Aontú',
          economic: -2,
          social: 7,
          cultural: 8,
          globalism: -7,
          environmental: -3,
          authority: 6,
          welfare: 5,
          technocratic: -4
        },
        'ie-independent-ireland': {
          party: 'Independent Ireland',
          economic: 3,
          social: 6,
          cultural: 8,
          globalism: -6,
          environmental: -5,
          authority: 6,
          welfare: 1,
          technocratic: -3
        },
        'ie-irish-freedom': {
          party: 'Irish Freedom Party',
          economic: 7,
          social: 9,
          cultural: 10,
          globalism: -10,
          environmental: -8,
          authority: 7,
          welfare: -3,
          technocratic: -6
        }
      };
      
      console.log('Loaded party dimensions:', dimensionsMap);
      console.log('Sinn Féin data:', dimensionsMap['ie-sf']);
      setPartyDimensions(dimensionsMap);
      
      try {
        // Load explanation data for all parties from the database
        const loadExplanations = async () => {
          // Start with default explanations (will be used if database access fails)
          const defaultExplanations: Record<string, DimensionExplanation> = {
            'ie-sf': {
              economic: "Advocates for left-leaning economic policies, including increased public spending and wealth redistribution.",
              social: "Supports progressive social policies including LGBTQ+ rights and liberal social reforms.",
              cultural: "Promotes Irish cultural identity while supporting diversity and integration.",
              environmental: "Emphasizes environmental protection with moderate climate policies.",
              globalism: "Takes a nationalist position on many issues while supporting EU membership.",
              authority: "Favors decentralization of power and community-based decision making.",
              welfare: "Strongly supports expanded social welfare programs and public services.",
              technocratic: "Balances democratic processes with limited expert-led decision making."
            },
            'ie-fg': {
              economic: "Promotes center-right economic policies with focus on business growth and fiscal discipline.",
              social: "Holds moderately conservative views on social issues while adapting to changing societal norms.",
              cultural: "Balances traditional Irish values with modern European identity.",
              environmental: "Supports gradual environmental reforms with focus on economic balance.",
              globalism: "Strongly pro-European and internationalist in outlook.",
              authority: "Favors centralized governance with moderate state authority.",
              welfare: "Supports basic welfare provisions while emphasizing personal responsibility.",
              technocratic: "Values expert-led governance in many policy areas."
            },
            'ie-pbp': {
              economic: "Advocates for anti-capitalist policies, including nationalization of key industries and wealth redistribution."
            }
          };
          
          // Set initial state with default explanations
          setDimensionExplanations(defaultExplanations);
          
          // For each party in our dimensions map, try to load stored explanations from the database
          const explanationsMap: Record<string, DimensionExplanation> = {};
          for (const partyId in dimensionsMap) {
            try {
              const response = await fetch(`/api/dimension-explanations/${partyId}`);
              
              if (response.ok) {
                const data = await response.json();
                explanationsMap[partyId] = data;
              } else {
                // If no database entry exists, use the default explanations
                explanationsMap[partyId] = defaultExplanations[partyId] || {};
              }
            } catch (error) {
              console.error(`Error loading explanations for party ${partyId}:`, error);
              // Use defaults if loading fails
              explanationsMap[partyId] = defaultExplanations[partyId] || {};
            }
          }
          
          // Update state with loaded explanations
          setDimensionExplanations(explanationsMap);
        };
        
        // Execute the async function to load explanations
        loadExplanations();
      } catch (error) {
        console.error("Error in loading explanations:", error);
      }
    };
    
    loadPartyData();
  }, []);
  
  // Irish party polling rankings (most recent polls as of May 2025)
  const partyRankings = {
    'ie-sf': 1,   // Sinn Féin
    'ie-fg': 2,   // Fine Gael
    'ie-ff': 3,   // Fianna Fáil
    'ie-green': 4, // Green Party
    'ie-sd': 5,    // Social Democrats
    'ie-labour': 6, // Labour Party
    'ie-pbp': 7,   // People Before Profit
    'ie-aontu': 8,  // Aontú
    'ie-independent-ireland': 9, // Independent Ireland
    'ie-irish-freedom': 10 // Irish Freedom Party
  };
  
  // Filter parties by selected country and sort by polling rank
  const filteredParties = politicalParties
    .filter(party => party.country === selectedCountry)
    .sort((a, b) => {
      // Only sort Irish parties
      if (selectedCountry === 'ireland') {
        return (partyRankings[a.id as keyof typeof partyRankings] || 999) - (partyRankings[b.id as keyof typeof partyRankings] || 999);
      }
      return 0;
    });
  
  // Get pledges for the selected party
  const partyPledges = selectedPartyId 
    ? policyPledges.filter(pledge => pledge.partyId === selectedPartyId)
    : [];
    
  // Get manifestos for the selected party
  const partyManifesto = selectedPartyId
    ? partyManifestos.find(manifesto => manifesto.partyId === selectedPartyId)
    : null;
  
  // Mark content as completed and earn points
  const completeContent = (contentId: string, points: number) => {
    if (!completedContent.includes(contentId)) {
      setCompletedContent([...completedContent, contentId]);
      setEarnedPoints(earnedPoints + points);
    }
  };

  // Save updated dimension explanations to local state and database
  const handleSaveExplanations = async (partyId: string, newExplanations: DimensionExplanation) => {
    try {
      // Update local state first for immediate UI feedback
      setDimensionExplanations(prev => ({
        ...prev,
        [partyId]: newExplanations
      }));
      
      // Save to database
      const response = await fetch(`/api/dimension-explanations/${partyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newExplanations),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save explanations to database');
      }
      
      console.log(`Saved explanations for party ${partyId} to database successfully`);
    } catch (error) {
      console.error('Error saving explanations:', error);
      alert('There was a problem saving your changes. Please try again.');
    }
  };

  // Component for displaying top active TDs by question count  
  const TopActiveTDsList = () => {
    const { data: topTDsResponse, isLoading, error } = useQuery<any>({
      queryKey: ['/api/top-tds-by-questions'],
      enabled: true,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    if (isLoading) {
      return (
        <div className="text-center py-4 text-gray-500">Loading TD activity data...</div>
      );
    }

    if (error || !topTDsResponse?.success || !topTDsResponse?.data) {
      return (
        <div className="text-center py-4 text-gray-500">No TD activity data available</div>
      );
    }

    return (
      <>
        {topTDsResponse.data.map((td: any, index: number) => (
          <div key={index} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg mt-[6px] mb-[6px]">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {td.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{td.name}</span>
                <span className="text-xs text-gray-500">{td.party} • {td.constituency}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-orange-600 font-semibold">
                {td.questionsAsked} questions
              </span>
              <div className="text-xs text-gray-500">
                {td.attendancePercentage}% attendance
              </div>
            </div>
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {selectedPartyId && (
        <DimensionExplanationEditor
          partyId={selectedPartyId}
          partyName={politicalParties.find(p => p.id === selectedPartyId)?.name || "Selected Party"}
          explanations={dimensionExplanations[selectedPartyId] || {}}
          onSave={handleSaveExplanations}
          open={isExplanationEditorOpen}
          onOpenChange={setIsExplanationEditorOpen}
        />
      )}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Political Education Centre</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Expand your knowledge of politics, learn about parties and their policies, and track how well they've kept their promises.
        </p>
      </div>
      {/* Summary Dashboard */}
      <Card className="mb-8">
        <CardHeader>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="parties" className="w-full">
            <TabsList className="grid w-full grid-cols-3 gap-2 h-auto p-2">
              <TabsTrigger value="parties" className="text-xs sm:text-sm font-medium px-3 py-2 whitespace-nowrap">🏛️ Party Rankings</TabsTrigger>
              <TabsTrigger value="politician-trust" className="text-xs sm:text-sm font-medium px-3 py-2 whitespace-nowrap">🛡️ Politician Trust</TabsTrigger>
              <TabsTrigger value="politician-performance" className="text-xs sm:text-sm font-medium px-3 py-2 whitespace-nowrap">🏆 Politician Performance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="parties" className="space-y-8 mt-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">🏛️ Political Party Rankings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive assessment of Irish political parties based on performance metrics and trustworthiness</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Performance Parties */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-blue-700 dark:text-blue-300 flex items-center">
                    🏆 Highest Performing Parties
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-2 h-6 w-6 p-0"
                      onClick={() => setShowTopPerformance(!showTopPerformance)}
                    >
                      {showTopPerformance ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </h3>
                  {showTopPerformance && (
                    <div className="space-y-3">
                      {dashboardLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg animate-pulse">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                              <div className="h-4 w-24 bg-gray-300 rounded"></div>
                            </div>
                            <div className="h-6 w-12 bg-gray-300 rounded"></div>
                          </div>
                        ))
                      ) : (
                        dashboardData && typeof dashboardData === 'object' && 'data' in dashboardData && 
                        dashboardData.data && typeof dashboardData.data === 'object' && 'performance' in dashboardData.data && 
                        Array.isArray(dashboardData.data.performance) && dashboardData.data.performance.length > 0 ? (
                          dashboardData.data.performance
                            .sort((a: any, b: any) => b.overallScore - a.overallScore)
                            .slice(0, 5)
                            .map((party: any, index: number) => (
                              <div 
                                key={party.partyId} 
                                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                onClick={() => handlePartyClick(party.partyId)}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-blue-600 w-6">#{index + 1}</span>
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party.color }}></div>
                                  <span className="text-sm font-medium">{party.name}</span>
                                </div>
                                <span className="text-lg font-bold text-blue-600">{party.overallScore}%</span>
                              </div>
                            ))
                        ) : (
                          <div className="text-center py-4 text-gray-500">Loading authentic performance data...</div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Top Trustworthiness Parties */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-green-700 dark:text-green-300 flex items-center">
                    🛡️ Most Trustworthy Parties
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-2 h-6 w-6 p-0"
                      onClick={() => setShowTopTrust(!showTopTrust)}
                    >
                      {showTopTrust ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </h3>
                  {showTopTrust && (
                    <div className="space-y-3">
                      {dashboardLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg animate-pulse">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                              <div className="h-4 w-24 bg-gray-300 rounded"></div>
                            </div>
                            <div className="h-6 w-12 bg-gray-300 rounded"></div>
                          </div>
                        ))
                      ) : dashboardData && (dashboardData as any)?.data?.trustworthiness && (dashboardData as any).data.trustworthiness.length > 0 ? (
                        (dashboardData as any).data.trustworthiness
                          .sort((a: any, b: any) => (b.overallTrustworthiness || 0) - (a.overallTrustworthiness || 0))
                          .slice(0, 5)
                          .map((party: any, index: number) => (
                            <div 
                              key={party.partyId} 
                              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                              onClick={() => handlePartyClick(party.partyId)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-green-600 w-6">#{index + 1}</span>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: party.color }}></div>
                                <span className="text-sm font-medium">{party.name}</span>
                              </div>
                              <span className="text-lg font-bold text-green-600">{party.overallTrustworthiness}%</span>
                            </div>
                          ))
                      ) : (
                        <div className="text-center py-4 text-gray-500">No trustworthiness data available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="politician-trust" className="space-y-8 mt-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">🛡️ Politician Trust Rankings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Individual TDs ranked based on reliability, consistency, integrity and U-turns on policy or ideology (data as of June 2025).</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Most Trusted TDs */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-green-700 dark:text-green-300">🛡️ Most Trusted TDs</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setShowMostTrusted(!showMostTrusted)}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${showMostTrusted ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                  {showMostTrusted && (
                    <TopTrustworthyPoliticians onPoliticianClick={handlePoliticianClick} />
                  )}
                </div>

                {/* Least Trusted TDs */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">🚨 Least Trusted TDs</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setShowLeastTrusted(!showLeastTrusted)}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${showLeastTrusted ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                  {showLeastTrusted && (
                    <LeastTrustworthyPoliticians onPoliticianClick={handlePoliticianClick} />
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="politician-performance" className="space-y-8 mt-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">🏆 Politician Performance Rankings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Individual TDs ranked by legislative productivity, parliamentary engagement, constituency service and public & media impact (data as of June 2025).</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Performers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">🏆 Top Performing TDs</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setShowTopPerformers(!showTopPerformers)}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${showTopPerformers ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                  {showTopPerformers && (
                    <TopPerformersList onPoliticianClick={handlePoliticianClick} />
                  )}
                </div>

                {/* Low Performers */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-300">📉 Low Performing TDs</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setShowLowPerformers(!showLowPerformers)}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${showLowPerformers ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                  {showLowPerformers && (
                    <LowPerformersList onPoliticianClick={handlePoliticianClick} />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 text-center">
              Data updated weekly • Performance based on pledge fulfillment, parliamentary activity, and authentic trust assessments
            </p>
          </div>
        </CardContent>
      </Card>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-3">
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="politicians">Politicians</TabsTrigger>
          <TabsTrigger value="learn">Learn</TabsTrigger>
        </TabsList>

        
        {/* Politicians Tab */}
        <TabsContent value="politicians" id="politicians-section">
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Political Figures</CardTitle>
                <CardDescription>
                  Find politicians by party affiliation or constituency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="md:col-span-2 lg:col-span-1">
                    <label className="text-sm font-medium mb-2 block">Search by Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter politician's name..."
                        value={nameSearchFilter}
                        onChange={(e) => setNameSearchFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                      />
                      {nameSearchFilter && (
                        <button
                          onClick={() => setNameSearchFilter("")}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Filter by Party</label>
                    <Select 
                      value={selectedPartyFilter || "all"} 
                      onValueChange={(value) => setSelectedPartyFilter(value === "all" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All parties" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All parties</SelectItem>
                        {filteredParties.map(party => (
                          <SelectItem key={party.id} value={party.id}>
                            <div className="flex items-center">
                              <div 
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: party.color }}
                              ></div>
                              {party.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Filter by Constituency</label>
                    <Select 
                      value={selectedConstituencyFilter || "all"} 
                      onValueChange={(value) => setSelectedConstituencyFilter(value === "all" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All constituencies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All constituencies</SelectItem>
                        {Array.from(new Set(politicians.map(p => p.constituency).filter(Boolean))).sort().map(constituency => (
                          <SelectItem key={constituency} value={constituency!}>
                            {constituency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Election Status</label>
                    <Select 
                      value={electionStatusFilter} 
                      onValueChange={(value) => setElectionStatusFilter(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="elected">Currently Elected</SelectItem>
                        <SelectItem value="not-elected">Not Currently Elected</SelectItem>
                        <SelectItem value="all">All Politicians</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>



            {/* Politicians Display */}
            <div className="space-y-6">
              {(() => {
                // Apply all filters in one step
                const filteredPoliticians = politicians.filter(politician => {
                  // Must have Irish party ID
                  if (!politician.partyId || !politician.partyId.startsWith("ie-")) {
                    return false;
                  }
                  
                  // Apply name search filter
                  if (nameSearchFilter.trim()) {
                    const searchTerm = nameSearchFilter.toLowerCase().trim();
                    const politicianName = politician.name.toLowerCase();
                    if (!politicianName.includes(searchTerm)) {
                      return false;
                    }
                  }
                  
                  // Apply party filter
                  if (selectedPartyFilter && selectedPartyFilter !== "all" && politician.partyId !== selectedPartyFilter) {
                    return false;
                  }
                  
                  // Apply constituency filter
                  if (selectedConstituencyFilter && selectedConstituencyFilter !== "all" && politician.constituency !== selectedConstituencyFilter) {
                    return false;
                  }
                  
                  // Apply election status filter
                  if (electionStatusFilter === "elected" && !politician.currentlyElected) {
                    return false;
                  }
                  if (electionStatusFilter === "not-elected" && politician.currentlyElected) {
                    return false;
                  }
                  
                  return true;
                });
                
                // Limit displayed politicians based on showAll state
                const displayedPoliticians = showAllPoliticians ? filteredPoliticians : filteredPoliticians.slice(0, 9);
                const hasMorePoliticians = filteredPoliticians.length > 9;
                
                // Debug: log the actual politicians being displayed
                console.log('Displayed politicians:', displayedPoliticians.map(p => ({
                  name: p.name,
                  party: p.partyId,
                  constituency: p.constituency
                })));
                
                return (
                  <>
                    {/* Results count and view toggle */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Showing {displayedPoliticians.length} of {filteredPoliticians.length} politicians
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={politiciansViewMode === 'boxes' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPoliticiansViewMode('boxes')}
                          className="h-7 px-2"
                        >
                          <Grid3X3 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={politiciansViewMode === 'bars' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPoliticiansViewMode('bars')}
                          className="h-7 px-2"
                        >
                          <List className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Politicians display - conditional based on view mode */}
                    {politiciansViewMode === 'boxes' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                        {displayedPoliticians.map((politician) => {
                  const party = politicalParties.find(p => p.id === politician.partyId);
                  // Use actual scores from database, fallback only if not available
                  const performanceScore = performanceScores[politician.name];
                  const isPerformanceScoreLoading = performanceScoresLoading[politician.name];
                  const trustScore = trustScores[politician.name];
                  const isTrustScoreLoading = trustScoresLoading[politician.name];
                  
                  return (
                    <Card key={politician.id} className={`relative overflow-hidden hover:shadow-lg transition-all duration-200 ${politician.currentlyElected ? 'ring-2 ring-green-400 bg-green-50/30 dark:bg-green-900/10' : ''}`}>
                      <div 
                        className="h-2" 
                        style={{ backgroundColor: party?.color || "#888" }}
                      ></div>
                      {politician.currentlyElected && (
                        <div className="absolute top-4 right-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                          Currently Elected
                        </div>
                      )}
                      <CardContent className="p-3 sm:p-4 lg:p-6">
                        <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <Avatar className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 border border-gray-200">
                            <AvatarImage src={politician.imageUrl} alt={politician.name} />
                            <AvatarFallback className="text-xs sm:text-sm font-medium">
                              {politician.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 
                              className="font-semibold text-base sm:text-lg mb-1 leading-tight"
                              style={{ 
                                wordBreak: 'break-word',
                                hyphens: 'auto',
                                lineHeight: '1.2'
                              }}
                            >
                              {politician.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {politician.title}
                            </p>
                            <div className="flex items-center mb-2">
                              <div 
                                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mr-2" 
                                style={{ backgroundColor: party?.color || "#888" }}
                              ></div>
                              <span className="text-[10px] sm:text-xs text-gray-500">{party?.name || "Independent"}</span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-gray-500">{politician.constituency}</p>
                          </div>
                        </div>
                        
                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div 
                            className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors min-h-[80px] flex flex-col justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Close trust breakdown if open
                              if (selectedTrustPolitician === politician.name) {
                                setSelectedTrustPolitician(null);
                              }
                              setSelectedPerformancePolitician(
                                selectedPerformancePolitician === politician.name ? null : politician.name
                              );
                            }}
                          >
                            {isPerformanceScoreLoading ? (
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            ) : (
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                                {performanceScore ? `${performanceScore}%` : 'N/A'}
                              </div>
                            )}
                            <div className="text-xs text-blue-700 dark:text-blue-300 mb-1">Performance</div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center">
                              {selectedPerformancePolitician === politician.name ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </div>
                          </div>
                          <div 
                            className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md text-center cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors min-h-[80px] flex flex-col justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Close performance breakdown if open
                              if (selectedPerformancePolitician === politician.name) {
                                setSelectedPerformancePolitician(null);
                              }
                              setSelectedTrustPolitician(
                                selectedTrustPolitician === politician.name ? null : politician.name
                              );
                            }}
                          >
                            {isTrustScoreLoading ? (
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center justify-center mb-1">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                              </div>
                            ) : (
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                                {trustScore ? `${trustScore}%` : 'N/A'}
                              </div>
                            )}
                            <div className="text-xs text-green-700 dark:text-green-300 mb-1">Trust</div>
                            <div className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center">
                              {selectedTrustPolitician === politician.name ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Performance Score Breakdown */}
                        {selectedPerformancePolitician === politician.name && (
                          <PerformanceScoreBreakdown politicianName={politician.name} />
                        )}
                        
                        {/* Trust Score Breakdown */}
                        {selectedTrustPolitician === politician.name && (
                          <TrustScoreBreakdown politicianName={politician.name} />
                        )}
                        
                        {/* Top Policy Preview */}
                        <div>
                          <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Key Focus</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                            {politician.signature_policies[0] || "No specific policy focus listed"}
                          </p>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPoliticianId(
                                selectedPoliticianId === politician.id ? null : politician.id
                              );
                            }}
                          >
                            {selectedPoliticianId === politician.id ? 'Hide Details' : 'See More Details'}
                          </Button>
                        </div>
                        
                        {/* Expanded Details */}
                        {selectedPoliticianId === politician.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-5 duration-200">
                            <div className="space-y-4">
                              {/* Bio */}
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Biography</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {politician.bio}
                                </p>
                              </div>
                              
                              {/* All Signature Policies */}
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Signature Policies</h4>
                                <div className="flex flex-wrap gap-2">
                                  {politician.signature_policies.map((policy, index) => (
                                    <span 
                                      key={index}
                                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-full"
                                    >
                                      {policy}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              
                              {/* Political Positioning */}
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Political Position</h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex justify-between">
                                    <span>Economic:</span>
                                    <span className="font-medium">
                                      {politician.economic > 0 ? `+${politician.economic}` : politician.economic}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Social:</span>
                                    <span className="font-medium">
                                      {politician.social > 0 ? `+${politician.social}` : politician.social}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Parliamentary Activity */}
                              <ParliamentaryActivitySection politicianName={politician.name} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                        })}
                      </div>
                    ) : (
                      // Horizontal bars view
                      (<div className="space-y-4">
                        {displayedPoliticians.map((politician) => {
                          const party = politicalParties.find(p => p.id === politician.partyId);
                          const performanceScore = performanceScores[politician.name];
                          const isPerformanceScoreLoading = performanceScoresLoading[politician.name];
                          const trustScore = trustScores[politician.name];
                          const isTrustScoreLoading = trustScoresLoading[politician.name];
                          
                          return (
                            <Card key={politician.id} className={`hover:shadow-md transition-all duration-200 relative ${politician.currentlyElected ? 'ring-2 ring-green-400 bg-green-50/30 dark:bg-green-900/10' : ''}`}>
                              {politician.currentlyElected && (
                                <Badge className="absolute top-1 right-1 bg-green-500 text-white text-[8px] px-1 py-0 z-10 font-medium">
                                  E
                                </Badge>
                              )}
                              <CardContent className="p-2 sm:p-3">
                                <div className="flex items-center gap-2 sm:gap-4">
                                  {/* Left side - Avatar and Name - Responsive width */}
                                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-[240px] sm:max-w-[300px] lg:w-80">
                                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-gray-200 shrink-0">
                                      <AvatarImage src={politician.imageUrl} alt={politician.name} />
                                      <AvatarFallback className="text-xs font-medium">
                                        {politician.name.split(' ').map(n => n[0]).join('')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        <h3 
                                          className="font-semibold sm:text-base cursor-pointer hover:text-blue-600 transition-colors text-[12px]"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPoliticianId(
                                              selectedPoliticianId === politician.id ? null : politician.id
                                            );
                                          }}
                                          style={{ 
                                            wordBreak: 'break-word',
                                            hyphens: 'auto',
                                            lineHeight: '1.2'
                                          }}
                                        >
                                          {politician.name}
                                        </h3>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Middle section - Performance and Trust - Responsive */}
                                  <div className="flex items-center gap-3 sm:gap-6 lg:gap-8 shrink-0">
                                    {/* Performance Score Column */}
                                    <div className="flex flex-col items-center gap-1 w-16 sm:w-20 lg:w-24">
                                      <span className="text-[10px] sm:text-xs font-medium text-center">Perf</span>
                                      <div className="flex items-center gap-1 sm:gap-2 w-full">
                                        <div className="w-10 sm:w-12 lg:w-16 bg-gray-200 rounded-full h-1.5 sm:h-2 relative">
                                          {isPerformanceScoreLoading ? (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <div className="animate-spin rounded-full h-1 w-1 border-b border-blue-600"></div>
                                            </div>
                                          ) : (
                                            <div 
                                              className="bg-blue-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                                              style={{ width: `${performanceScore || 0}%` }}
                                            ></div>
                                          )}
                                        </div>
                                        <span 
                                          className="text-[10px] sm:text-xs font-bold text-blue-600 w-6 sm:w-8 text-center cursor-pointer hover:underline shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Close trust breakdown if open
                                            if (selectedTrustPolitician === politician.name) {
                                              setSelectedTrustPolitician(null);
                                            }
                                            setSelectedPerformancePolitician(
                                              selectedPerformancePolitician === politician.name ? null : politician.name
                                            );
                                          }}
                                        >
                                          {performanceScore ? `${performanceScore}%` : 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Trust Score Column */}
                                    <div className="flex flex-col items-center gap-1 w-16 sm:w-20 lg:w-24">
                                      <span className="text-[10px] sm:text-xs font-medium text-center">Trust</span>
                                      <div className="flex items-center gap-1 sm:gap-2 w-full">
                                        <div className="w-10 sm:w-12 lg:w-16 bg-gray-200 rounded-full h-1.5 sm:h-2 relative">
                                          {isTrustScoreLoading ? (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                              <div className="animate-spin rounded-full h-1 w-1 border-b border-green-600"></div>
                                            </div>
                                          ) : (
                                            <div 
                                              className="bg-green-600 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                                              style={{ width: `${trustScore || 0}%` }}
                                            ></div>
                                          )}
                                        </div>
                                        <span 
                                          className="text-[10px] sm:text-xs font-bold text-green-600 w-6 sm:w-8 text-center cursor-pointer hover:underline shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Close performance breakdown if open
                                            if (selectedPerformancePolitician === politician.name) {
                                              setSelectedPerformancePolitician(null);
                                            }
                                            setSelectedTrustPolitician(
                                              selectedTrustPolitician === politician.name ? null : politician.name
                                            );
                                          }}
                                        >
                                          {trustScore ? `${trustScore}%` : 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Party and Constituency on far right */}
                                  <div className="text-right shrink-0 min-w-0">
                                    <div className="flex items-center justify-end gap-1 text-xs text-gray-600 dark:text-gray-400">
                                      <div 
                                        className="w-2 h-2 rounded-full" 
                                        style={{ backgroundColor: party?.color || "#888" }}
                                      ></div>
                                      <span className="truncate max-w-20">{party?.name || "Independent"}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {politician.constituency}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Expanded details for horizontal view */}
                                {selectedPerformancePolitician === politician.name && (
                                  <div className="mt-4 pt-4 border-t">
                                    <PerformanceScoreBreakdown politicianName={politician.name} />
                                  </div>
                                )}
                                
                                {selectedTrustPolitician === politician.name && (
                                  <div className="mt-4 pt-4 border-t">
                                    <TrustScoreBreakdown politicianName={politician.name} />
                                  </div>
                                )}
                                
                                {/* Expanded Details - triggered by clicking on politician name */}
                                {selectedPoliticianId === politician.id && (
                                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-5 duration-200">
                                    <div className="space-y-4">
                                      {/* Bio */}
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">Biography</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                          {politician.bio}
                                        </p>
                                      </div>
                                      
                                      {/* All Signature Policies */}
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">Signature Policies</h4>
                                        <div className="flex flex-wrap gap-2">
                                          {politician.signature_policies.map((policy, index) => (
                                            <span 
                                              key={index}
                                              className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-full"
                                            >
                                              {policy}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      {/* Political Positioning */}
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">Political Position</h4>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div className="flex justify-between">
                                            <span>Economic:</span>
                                            <span className="font-medium">
                                              {politician.economic > 0 ? `+${politician.economic}` : politician.economic}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Social:</span>
                                            <span className="font-medium">
                                              {politician.social > 0 ? `+${politician.social}` : politician.social}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Parliamentary Activity */}
                                      <ParliamentaryActivitySection politicianName={politician.name} />
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>)
                    )}
                    {/* Show All button */}
                    {hasMorePoliticians && !showAllPoliticians && (
                      <div className="text-center mt-6">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowAllPoliticians(true)}
                          className="px-8"
                        >
                          Show All {filteredPoliticians.length} Politicians
                        </Button>
                      </div>
                    )}
                    {/* Show Less button */}
                    {showAllPoliticians && hasMorePoliticians && (
                      <div className="text-center mt-6">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowAllPoliticians(false)}
                          className="px-8"
                        >
                          Show Less
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </TabsContent>
        
        {/* Parties Tab */}
        <TabsContent value="parties" id="parties-section">
          <div className="grid grid-cols-1 gap-6">
            <Card className="col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle>Party Details</CardTitle>
                  <CardDescription>
                    {selectedPartyId 
                      ? politicalParties.find(p => p.id === selectedPartyId)?.name 
                      : 'Select a party to view details'}
                  </CardDescription>
                </div>
                <div className="w-[180px]">
                  <Select 
                    value={selectedPartyId || ""} 
                    onValueChange={(value) => setSelectedPartyId(value || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select party" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Government parties first - ordered as Fianna Fáil, Fine Gael */}
                      {['ie-ff', 'ie-fg'].map(govPartyId => {
                        const party = filteredParties.find(p => p.id === govPartyId);
                        if (!party) return null;
                        return (
                          <SelectItem key={party.id} value={party.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: party.color }}
                              ></div>
                              <span>{party.name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border-green-200 ml-1">
                                Gov
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                      {/* Opposition parties */}
                      {filteredParties.filter(party => !['ie-ff', 'ie-fg'].includes(party.id)).map(party => (
                        <SelectItem key={party.id} value={party.id}>
                          <div className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: party.color }}
                            ></div>
                            {party.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {selectedPartyId ? (
                  <div>
                    <Tabs defaultValue="detail">
                      <TabsList className="grid w-full grid-cols-3 mb-4 text-xs sm:text-sm">
                        <TabsTrigger value="detail">Detail</TabsTrigger>
                        <TabsTrigger value="performance">Performance</TabsTrigger>
                        <TabsTrigger value="trustworthiness">Trustworthiness</TabsTrigger>
                      </TabsList>
                      
                      {/* Party Detail Tab */}
                      <TabsContent value="detail">
                        <div className="space-y-6">
                          {/* Main dimensions are now fixed as Economic and Social */}
                          
                          {/* Political Position */}
                          <div className="mb-6">
                            <div className="mb-2">
                              <h3 className="text-lg font-semibold">Political Position</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="inline-block">
                                      <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                        Economic {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].economic})` : ''}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                      {selectedPartyId && dimensionExplanations[selectedPartyId]?.economic 
                                        ? dimensionExplanations[selectedPartyId].economic
                                        : "No explanation available for this dimension"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                  {/* Center marker */}
                                  <div 
                                    className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                  ></div>
                                  
                                  {/* Party position marker */}
                                  {selectedPartyId && partyDimensions[selectedPartyId] && (
                                    <div
                                      className="absolute top-0 bottom-0 rounded-full bg-blue-500 h-full"
                                      style={{ 
                                        width: '16px', 
                                        left: `${((partyDimensions[selectedPartyId].economic + 10) / 20) * 100}%`,
                                        transform: 'translateX(-50%)'
                                      }}
                                    ></div>
                                  )}
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                  <span>Left</span>
                                  <span>Right</span>
                                </div>
                              </div>
                              <div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="inline-block">
                                      <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                        Social {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].social})` : ''}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                      {selectedPartyId && dimensionExplanations[selectedPartyId]?.social 
                                        ? dimensionExplanations[selectedPartyId].social
                                        : "No explanation available for this dimension"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                  {/* Center marker */}
                                  <div 
                                    className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                  ></div>
                                  
                                  {/* Party position marker */}
                                  {selectedPartyId && partyDimensions[selectedPartyId] && (
                                    <div
                                      className="absolute top-0 bottom-0 rounded-full bg-red-500 h-full"
                                      style={{ 
                                        width: '16px', 
                                        left: `${((partyDimensions[selectedPartyId].social + 10) / 20) * 100}%`,
                                        transform: 'translateX(-50%)'
                                      }}
                                    ></div>
                                  )}
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                  <span>Progressive</span>
                                  <span>Conservative</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex justify-center mt-4">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowAllDimensions(prev => !prev)}
                                className="text-xs"
                              >
                                {showAllDimensions ? "Hide Additional Dimensions" : "Show All Dimensions"}
                              </Button>
                            </div>
                            
                            {showAllDimensions && (
                              <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="inline-block">
                                        <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                          Cultural {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].cultural})` : ''}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                        {selectedPartyId && dimensionExplanations[selectedPartyId]?.cultural 
                                          ? dimensionExplanations[selectedPartyId].cultural
                                          : "No explanation available for this dimension"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                    {/* Center marker */}
                                    <div 
                                      className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                    ></div>
                                    
                                    {/* Party position marker */}
                                    {selectedPartyId && partyDimensions[selectedPartyId] && (
                                      <div
                                        className="absolute top-0 bottom-0 rounded-full bg-green-500 h-full"
                                        style={{ 
                                          width: '16px', 
                                          left: `${((partyDimensions[selectedPartyId].cultural + 10) / 20) * 100}%`,
                                          transform: 'translateX(-50%)'
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>Progressive</span>
                                    <span>Traditional</span>
                                  </div>
                                </div>
                                <div>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="inline-block">
                                        <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                          Globalism {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].globalism})` : ''}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                        {selectedPartyId && dimensionExplanations[selectedPartyId]?.globalism 
                                          ? dimensionExplanations[selectedPartyId].globalism
                                          : "No explanation available for this dimension"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                    {/* Center marker */}
                                    <div 
                                      className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                    ></div>
                                    
                                    {/* Party position marker */}
                                    {selectedPartyId && partyDimensions[selectedPartyId] && (
                                      <div
                                        className="absolute top-0 bottom-0 rounded-full bg-amber-500 h-full"
                                        style={{ 
                                          width: '16px', 
                                          left: `${((partyDimensions[selectedPartyId].globalism + 10) / 20) * 100}%`,
                                          transform: 'translateX(-50%)'
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>Nationalist</span>
                                    <span>Globalist</span>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="inline-block">
                                        <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                          Environmental {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].environmental})` : ''}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                        {selectedPartyId && dimensionExplanations[selectedPartyId]?.environmental 
                                          ? dimensionExplanations[selectedPartyId].environmental
                                          : "No explanation available for this dimension"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                    <div 
                                      className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                    ></div>
                                    {/* Party position marker */}
                                    {selectedPartyId && partyDimensions[selectedPartyId] && (
                                      <div
                                        className="absolute top-0 bottom-0 rounded-full bg-emerald-500 h-full"
                                        style={{ 
                                          width: '16px', 
                                          left: `${((partyDimensions[selectedPartyId].environmental + 10) / 20) * 100}%`,
                                          transform: 'translateX(-50%)'
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>Prioritize Economy</span>
                                    <span>Prioritize Environment</span>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="inline-block">
                                        <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                          Authority {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].authority})` : ''}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                        {selectedPartyId && dimensionExplanations[selectedPartyId]?.authority 
                                          ? dimensionExplanations[selectedPartyId].authority
                                          : "No explanation available for this dimension"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                    <div 
                                      className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                    ></div>
                                    {/* Party position marker */}
                                    {selectedPartyId && partyDimensions[selectedPartyId] && (
                                      <div
                                        className="absolute top-0 bottom-0 rounded-full bg-indigo-500 h-full"
                                        style={{ 
                                          width: '16px', 
                                          left: `${((partyDimensions[selectedPartyId].authority + 10) / 20) * 100}%`,
                                          transform: 'translateX(-50%)'
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>Libertarian</span>
                                    <span>Authoritarian</span>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="inline-block">
                                        <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                          Welfare {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].welfare})` : ''}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                        {selectedPartyId && dimensionExplanations[selectedPartyId]?.welfare 
                                          ? dimensionExplanations[selectedPartyId].welfare
                                          : "No explanation available for this dimension"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                    <div 
                                      className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                    ></div>
                                    {/* Party position marker */}
                                    {selectedPartyId && partyDimensions[selectedPartyId] && (
                                      <div
                                        className="absolute top-0 bottom-0 rounded-full bg-purple-500 h-full"
                                        style={{ 
                                          width: '16px', 
                                          left: `${((partyDimensions[selectedPartyId].welfare + 10) / 20) * 100}%`,
                                          transform: 'translateX(-50%)'
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>Limited Support</span>
                                    <span>Strong Safety Net</span>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="inline-block">
                                        <span className="text-sm font-medium cursor-help border-b border-dotted border-gray-400">
                                          Governance {selectedPartyId && partyDimensions[selectedPartyId] ? `(${partyDimensions[selectedPartyId].technocratic})` : ''}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-md bg-white dark:bg-gray-800 p-2 text-sm shadow-lg">
                                        {selectedPartyId && dimensionExplanations[selectedPartyId]?.technocratic 
                                          ? dimensionExplanations[selectedPartyId].technocratic
                                          : "No explanation available for this dimension"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <div className="relative h-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                    <div 
                                      className="absolute top-0 bottom-0 left-1/2 bg-gray-500 w-1 transform -translate-x-1/2"
                                    ></div>
                                    {/* Party position marker */}
                                    {selectedPartyId && partyDimensions[selectedPartyId] && (
                                      <div
                                        className="absolute top-0 bottom-0 rounded-full bg-cyan-500 h-full"
                                        style={{ 
                                          width: '16px', 
                                          left: `${((partyDimensions[selectedPartyId].technocratic + 10) / 20) * 100}%`,
                                          transform: 'translateX(-50%)'
                                        }}
                                      ></div>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs mt-1">
                                    <span>Democratic</span>
                                    <span>Technocratic</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Key Policies Section */}
                          <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-2">Key Policies</h3>
                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                              <p className="text-sm">
                                {filteredParties.find(p => p.id === selectedPartyId)?.description}
                              </p>
                            </div>
                          </div>
                          
                          {partyManifesto && (
                            <div className="mb-6">
                              <h3 className="text-lg font-semibold mb-2">
                                {partyManifesto.title || `${partyManifesto.partyName} - ${partyManifesto.electionYear}`}
                              </h3>
                              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mb-4">
                                <h4 className="font-medium text-sm text-gray-500 dark:text-gray-400 mb-2">
                                  AI Summary
                                </h4>
                                <p className="text-sm">
                                  {partyManifesto.aiSummary || partyManifesto.summary}
                                </p>
                              </div>
                              <h4 className="font-medium mb-2">Key Points</h4>
                              <ul className="space-y-2">
                                {partyManifesto.keyPoints?.map((point: string, index: number) => (
                                  <li key={index} className="flex items-start">
                                    <span className="mr-2 text-green-500">•</span>
                                    <span className="text-sm">{point}</span>
                                  </li>
                                )) || (
                                  <li className="text-sm text-gray-500">No policy details available</li>
                                )}
                              </ul>
                            </div>
                          )}
                          
                          {partyManifesto && (
                            <div className="mt-6 text-center">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => completeContent(`read-manifesto-${selectedPartyId}`, 15)}
                              >
                                Mark as Read (+15 points)
                              </Button>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      {/* Performance Tab */}
                      <TabsContent value="performance">
                        <PerformanceTabContent selectedPartyId={selectedPartyId} />
                      </TabsContent>
                      
                      {/* Trustworthiness Tab */}
                      <TabsContent value="trustworthiness">
                        <TrustworthinessTabContent selectedPartyId={selectedPartyId} />
                      </TabsContent>
                      
                      {/* Policy Simulator Tab */}
                      <TabsContent value="simulator">
                        <div className="space-y-4">
                          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md mb-4">
                            <h3 className="text-lg font-semibold mb-2">Policy Impact Simulator</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              See how this party's policies would affect various socioeconomic metrics if implemented fully.
                            </p>
                            
                            <PolicyImpactSimulator 
                              partyId={selectedPartyId} 
                              onCompletion={() => completeContent(`simulator-${selectedPartyId}`, 20)}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Select a party from the list to view detailed information
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Policy Tracking Tab */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>Policy Implementation Tracking</CardTitle>
              <CardDescription>
                See how well political parties have fulfilled their campaign promises
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Select a Party:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {filteredParties.map(party => (
                    <Button
                      key={party.id}
                      variant={selectedPartyId === party.id ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setSelectedPartyId(party.id)}
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: party.color }}
                      ></div>
                      <span className="truncate">{party.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              {selectedPartyId ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    {politicalParties.find(p => p.id === selectedPartyId)?.name} - Policy Pledges
                  </h3>
                  {partyPledges.length > 0 ? (
                    <div className="space-y-6">
                      {partyPledges.map(pledge => (
                        <div key={pledge.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold">{pledge.title}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {pledge.description}
                              </p>
                            </div>
                            <Badge variant={
                              pledge.fulfilled >= 75 ? "default" :
                              pledge.fulfilled >= 40 ? "secondary" : "destructive"
                            }>
                              {pledge.fulfilled}% Fulfilled
                            </Badge>
                          </div>
                          <Progress value={pledge.fulfilled} className="h-2 mb-3" />
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
                            <strong>Evidence:</strong> {pledge.evidence}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No policy pledges available for this party
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a party to view their policy implementation record
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Policy Simulator Tab */}
        <TabsContent value="simulator">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Policy Impact Simulator</CardTitle>
              <CardDescription>
                Explore how different policy approaches might affect various aspects of Irish society
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Adjust the sliders to see how changes in government policy could impact different social, 
                  economic, and environmental outcomes. This interactive tool allows you to experiment with 
                  different policy approaches and view potential impacts across various aspects of society.
                </p>
                
                <PolicyImpactSimulator />
                
                <div className="mt-8 bg-muted rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2">About This Simulator</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    This model is based on simplified assumptions about policy interactions and is intended for 
                    educational purposes. Real-world policy outcomes are influenced by countless factors including 
                    global economic conditions, historical context, and complex societal dynamics.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Each policy slider represents a spectrum from market-driven approaches (left) to state-managed 
                    approaches (right). The simulator calculates potential impacts based on weighted relationships 
                    between policies and outcomes.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => completeContent("policy-simulator-used", 20)}
                  >
                    Mark as Completed (+20 points)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Learn Tab */}
        <TabsContent value="learn">
          <Card>
            <CardHeader>
              <CardTitle>Educational Content</CardTitle>
              <CardDescription>
                Learn about political systems, ideologies, and history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Learning Materials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {educationalContent.map(content => (
                    <Card key={content.id} className="overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-2 text-white text-xs uppercase tracking-wider font-bold">
                        {content.category}
                      </div>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-semibold">{content.title}</h3>
                          <Badge variant="outline">{content.difficulty}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {content.description}
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <Badge variant="secondary" className="text-xs">
                              {content.category}
                            </Badge>
                          </div>
                          <div className="text-green-600 font-medium text-sm">
                            +{content.points} pts
                          </div>
                        </div>
                        <Button
                          className="w-full mt-4"
                          variant={completedContent.includes(content.id) ? "outline" : "default"}
                          onClick={() => completeContent(content.id, content.points)}
                          disabled={completedContent.includes(content.id)}
                        >
                          {completedContent.includes(content.id) ? "Completed" : "Start Learning"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* User Learning Progress - Moved to bottom */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Your Learning Progress</CardTitle>
          <CardDescription>
            Complete educational content to earn points and badges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">Experience Points</p>
              <p className="text-2xl font-bold">{earnedPoints}</p>
            </div>
            <div className="flex space-x-2">
              {Object.entries(educationBadges).slice(0, 3).map(([key, badge]) => (
                <div key={key} className="text-center" title={badge.description}>
                  <div className="text-2xl mb-1">{badge.icon}</div>
                  <div className="text-xs">{badge.name}</div>
                </div>
              ))}
            </div>
          </div>
          <Progress value={(completedContent.length / educationalContent.length) * 100} className="h-2" />
          <p className="text-xs text-right mt-1">
            {completedContent.length} of {educationalContent.length} completed
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EducationPage;