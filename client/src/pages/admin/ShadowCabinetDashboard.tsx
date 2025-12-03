import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
    Loader2, Search, ShieldAlert, TrendingUp, Users, 
    AlertTriangle, CheckCircle, Activity, 
    Brain, Gavel, Scale, Briefcase, 
    Microscope, Megaphone, Vote, FileText,
    DollarSign, History, Eye, Radar, Lock
} from "lucide-react";

interface Analysis {
  id: number;
  articleTitle: string;
  articleUrl: string;
  deployedAgents: string; // JSON
  managerReasoning: string;
  finalVerdict: string;
  createdAt: string;
}

interface QaAudit {
    id: number;
    auditType: string;
    anomaliesFound: number;
    report: string;
    createdAt: string;
}

interface Agent {
    name: string;
    role: string;
    icon: any;
    status: "active" | "idle" | "deploying";
}

interface AgentTeam {
    id: string;
    name: string;
    description: string;
    agents: Agent[];
}

const TEAMS: AgentTeam[] = [
    {
        id: "shadow-cabinet",
        name: "The Shadow Cabinet",
        description: "Elite multi-agent system for deep political analysis and narrative deconstruction.",
        agents: [
            { name: "The Manager", role: "Team Dispatcher", icon: Users, status: "active" },
            { name: "Data Auditor", role: "Fact Checker", icon: Microscope, status: "active" },
            { name: "Media Critic", role: "Bias Detector", icon: Megaphone, status: "active" },
            { name: "Vision Analyst", role: "Image Forensics", icon: Eye, status: "active" },
            { name: "Paradox Hunter", role: "Sociological Logic", icon: Brain, status: "active" },
            { name: "Follow-the-Money", role: "Financial Incentives", icon: DollarSign, status: "active" },
            { name: "History Teacher", role: "Context Provider", icon: History, status: "active" },
            { name: "Bill Reader", role: "Legislative Analysis", icon: FileText, status: "active" },
            { name: "The Economist", role: "Market Impact", icon: TrendingUp, status: "active" },
            { name: "Political Strategist", role: "Machiavellian Tactics", icon: Radar, status: "active" },
            { name: "The Futurist", role: "Predictive Modeling", icon: Activity, status: "active" },
            { name: "Systems Thinker", role: "Cross-Domain Loops", icon: Scale, status: "active" },
        ]
    },
    {
        id: "campaign-architects",
        name: "Campaign Architects",
        description: "Election strategy and voter sentiment optimization engine.",
        agents: [
            { name: "Campaign Manager", role: "Strategy Lead", icon: Briefcase, status: "idle" },
            { name: "Voter Profiler", role: "Demographic Analysis", icon: Users, status: "idle" },
            { name: "Message Crafter", role: "Speech Writer", icon: Megaphone, status: "idle" },
            { name: "Opponent Researcher", role: "Dirt Digger", icon: Search, status: "idle" },
            { name: "The Pollster", role: "Sentiment Simulation", icon: Vote, status: "idle" },
        ]
    },
    {
        id: "policy-forge",
        name: "The Policy Forge",
        description: "Robust legislative drafting and impact assessment laboratory.",
        agents: [
            { name: "Policy Director", role: "Vision Setter", icon: Brain, status: "idle" },
            { name: "Constitutional Lawyer", role: "Legal Compliance", icon: Gavel, status: "idle" },
            { name: "Stakeholder Simulator", role: "Public Reaction", icon: Users, status: "idle" },
            { name: "Budget Office", role: "Cost Analysis", icon: DollarSign, status: "idle" },
            { name: "Plain English Translator", role: "Communication", icon: FileText, status: "idle" },
        ]
    },
    {
        id: "newsroom",
        name: "The Newsroom",
        description: "24/7 automated content generation and investigative journalism.",
        agents: [
            { name: "Editor-in-Chief", role: "Tone & Direction", icon: Lock, status: "idle" },
            { name: "Investigative Reporter", role: "Deep Dives", icon: Search, status: "idle" },
            { name: "Fact Checker", role: "Verification", icon: CheckCircle, status: "idle" },
            { name: "Headline Optimizer", role: "Engagement", icon: TrendingUp, status: "idle" },
            { name: "Social Media Manager", role: "Distribution", icon: Megaphone, status: "idle" },
        ]
    }
];

export default function ShadowCabinetDashboard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [qaHistory, setQaHistory] = useState<QaAudit[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
    fetchQaHistory();
  }, []);

  const fetchHistory = async () => {
    try {
        const res = await fetch("/api/shadow/history");
        const data = await res.json();
        if (Array.isArray(data)) {
            setHistory(data);
        } else {
            console.error("Expected array for history but got:", data);
            setHistory([]);
        }
    } catch (e) {
        console.error(e);
        setHistory([]);
    }
  };

  const fetchQaHistory = async () => {
    try {
        const res = await fetch("/api/shadow/qa-history");
        const data = await res.json();
        if (Array.isArray(data)) {
            setQaHistory(data);
        } else {
            console.error("Expected array for QA history but got:", data);
            setQaHistory([]);
        }
    } catch (e) {
        console.error(e);
        setQaHistory([]);
    }
  };

  const handleAnalyze = async () => {
    if (!url) return;
    setLoading(true);
    toast({ title: "Deploying Shadow Cabinet...", description: "This may take up to 60 seconds." });
    
    try {
        const res = await fetch("/api/shadow/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        });
        
        if (!res.ok) throw new Error("Failed");
        
        toast({ title: "Analysis Complete", description: "The Cabinet has spoken." });
        setUrl("");
        fetchHistory();
    } catch (e) {
        toast({ title: "Error", description: "Failed to analyze article.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <ShieldAlert className="h-8 w-8 text-primary" />
                Shadow Cabinet War Room
            </h1>
            <p className="text-muted-foreground">Level 10 Agentic Surveillance System</p>
        </div>
        <div className="flex gap-4">
            <Badge variant="outline" className="px-4 py-1 flex gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                System Online
            </Badge>
            <Badge variant="secondary" className="px-4 py-1">Admin Access Only</Badge>
        </div>
      </div>

      <Tabs defaultValue="shadow-cabinet" className="w-full">
        <TabsList className="w-full flex justify-start overflow-x-auto">
            {TEAMS.map(team => (
                <TabsTrigger key={team.id} value={team.id} className="min-w-[150px]">
                    {team.name}
                </TabsTrigger>
            ))}
            <TabsTrigger value="system-health" className="ml-auto">System Health</TabsTrigger>
        </TabsList>

        {TEAMS.map(team => (
            <TabsContent key={team.id} value={team.id} className="space-y-8 mt-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold">{team.name}</h2>
                    <p className="text-muted-foreground">{team.description}</p>
                </div>

                {/* Agent Roster */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {team.agents.map((agent) => (
                        <Card key={agent.name} className="relative overflow-hidden border-muted/60">
                            <div className={`absolute top-0 left-0 w-1 h-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}></div>
                            <CardHeader className="p-4 pb-2">
                                <div className="flex justify-between items-start">
                                    <agent.icon className={`h-6 w-6 ${agent.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <Badge variant={agent.status === 'active' ? 'default' : 'outline'} className="text-[10px] px-1 h-5">
                                        {agent.status}
                                    </Badge>
                                </div>
                                <CardTitle className="text-sm font-bold mt-2">{agent.name}</CardTitle>
                                <CardDescription className="text-xs">{agent.role}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>

                {/* Team Specific Tools */}
                {team.id === "shadow-cabinet" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Action Area */}
                        <Card className="border-primary/50">
                            <CardHeader>
                                <CardTitle>Manual Deployment</CardTitle>
                                <CardDescription>Paste a URL to instantly deploy the Cabinet.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex gap-4">
                                <Input 
                                    placeholder="https://www.rte.ie/news/..." 
                                    value={url} 
                                    onChange={(e) => setUrl(e.target.value)}
                                    disabled={loading}
                                />
                                <Button onClick={handleAnalyze} disabled={loading || !url} className="w-40">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    Analyze
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Live Feed */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold">Recent Intelligence</h2>
                                <Badge variant="outline">{history.length} Operations</Badge>
                            </div>
                            <div className="grid gap-4">
                                {history.map((item) => (
                                    <Card key={item.id} className="overflow-hidden">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-lg">
                                                    <a href={item.articleUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                                        {item.articleTitle}
                                                    </a>
                                                </CardTitle>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {JSON.parse(item.deployedAgents || "[]").map((agent: string) => (
                                                    <Badge key={agent} variant="secondary">{agent}</Badge>
                                                ))}
                                            </div>
                                            <div className="bg-muted/50 p-4 rounded-md text-sm whitespace-pre-line">
                                                {item.finalVerdict?.slice(0, 300)}...
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {team.id !== "shadow-cabinet" && (
                    <Card className="border-dashed">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <div className="flex justify-center mb-4">
                                {team.agents.length > 0 
                                    ? <Users className="h-12 w-12 opacity-20" />
                                    : <Lock className="h-12 w-12 opacity-20" />
                                }
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Team Offline</h3>
                            <p>This agent team is currently in development or standby mode.</p>
                            <Button variant="outline" className="mt-4" disabled>Initialize Team</Button>
                        </CardContent>
                    </Card>
                )}
            </TabsContent>
        ))}

        <TabsContent value="system-health" className="space-y-6 mt-6">
            <h2 className="text-xl font-semibold">Weekly QA Audits</h2>
            {qaHistory.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No audits found. Run the scheduler to generate reports.</div>
            )}
            {qaHistory.map(audit => (
                <Card key={audit.id} className={audit.anomaliesFound > 0 ? "border-yellow-500/50" : "border-green-500/50"}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            {audit.anomaliesFound > 0 ? <AlertTriangle className="text-yellow-500 h-5 w-5"/> : <CheckCircle className="text-green-500 h-5 w-5"/>}
                            Internal Audit Report
                            <Badge variant={audit.anomaliesFound > 0 ? "destructive" : "default"} className="ml-auto">
                                {audit.anomaliesFound} Anomalies
                            </Badge>
                        </CardTitle>
                        <CardDescription>{new Date(audit.createdAt).toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {JSON.parse(audit.report || "[]").map((anomaly: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-300">
                                    <span>•</span>
                                    <span>{anomaly}</span>
                                </div>
                            ))}
                            {JSON.parse(audit.report || "[]").length === 0 && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded">
                                    <CheckCircle className="h-4 w-4" />
                                    All systems nominal. Data integrity verified.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}