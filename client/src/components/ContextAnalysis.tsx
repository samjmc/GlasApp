import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IdeologyVector } from "@shared/ideology";

interface ContextAnalysisProps {
  dimensions: IdeologyVector;
  userLocation?: string;
}

interface IssueAnalysisItem {
  issue?: string;
  stance?: string;
  percentile?: number;
  description?: string;
}

// Response type for the context analysis API
interface ContextAnalysisResponse {
  historical_alignments?: Array<{
    era?: string;
    movement?: string;
    period: string;
    alignment?: string;
    alignment_score?: number;
    description: string;
    key_similarities?: string[];
    key_differences?: string[];
  }>;
  regional_analysis?: Array<{
    region: string;
    alignment: string;
    description: string;
  }>;
  issue_analysis?: Array<string | IssueAnalysisItem>;
  trending_issues?: Array<string | { issue: string; [key: string]: unknown }>;
}

const tileClass = "flex flex-col gap-2 rounded-xl bg-elevated p-3.5";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-input p-4 text-sm text-muted-foreground">{children}</p>;
}

/** Where the profile sits in history, in other places, and on current issues (AI-written). */
const ContextAnalysis: React.FC<ContextAnalysisProps> = ({ dimensions, userLocation }) => {
  const [analysisData, setAnalysisData] = useState<ContextAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchContextAnalysis = async (dims: IdeologyVector) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/enhanced-profile/context-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimensions: dims, userLocation }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      const data = await response.json();
      if (!data.success || !data.data) throw new Error("Invalid API response format");
      setAnalysisData(data.data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchContextAnalysis(dimensions);
    const handleRegenerate = () => void fetchContextAnalysis(dimensions);
    window.addEventListener("regenerate-analysis", handleRegenerate);
    return () => window.removeEventListener("regenerate-analysis", handleRegenerate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);

  const header = (
    <div className="flex flex-col gap-0.5">
      <h2 className="font-display text-[22px] font-bold">Your views in context</h2>
      <p className="text-[13px] text-muted-foreground">Where your profile sits in history, in other places, and on current issues.</p>
    </div>
  );

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5" data-context-analysis-container="true" aria-busy="true">
        {header}
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </section>
    );
  }

  if (errorMessage || !analysisData) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5" data-context-analysis-container="true">
        {header}
        <p role="alert" className="text-sm text-destructive">
          We could not load this analysis. {errorMessage}
        </p>
        <Button variant="outline" className="w-fit" onClick={() => void fetchContextAnalysis(dimensions)}>
          Try again
        </Button>
      </section>
    );
  }

  const { historical_alignments = [], regional_analysis = [], issue_analysis = [], trending_issues = [] } = analysisData;

  // Strongest views first (furthest percentile from 50).
  const sortedIssues = (Array.isArray(issue_analysis) ? issue_analysis : [])
    .map((issue): IssueAnalysisItem => (typeof issue === "string" ? { description: issue } : { ...issue }))
    .sort((a, b) => Math.abs((b.percentile ?? 50) - 50) - Math.abs((a.percentile ?? 50) - 50));

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5" data-context-analysis-container="true">
      {header}
      <Tabs defaultValue="historical" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="historical">History</TabsTrigger>
          <TabsTrigger value="regional">Places</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        <TabsContent value="historical" className="flex flex-col gap-2.5 pt-3">
          {historical_alignments.length === 0 ? (
            <Empty>No historical comparison came back for this result.</Empty>
          ) : (
            historical_alignments.map((a, index) => (
              <article key={index} className={tileClass}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-bold">{a.era || a.movement}</h3>
                  <Badge variant="outline" className="shrink-0">
                    {a.period}
                  </Badge>
                </div>
                {typeof a.alignment_score === "number" && (
                  <div className="flex items-center gap-2 text-[13px]">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-input" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${a.alignment_score}%` }} />
                    </div>
                    <span className="font-bold tabular-nums">{a.alignment_score}% alike</span>
                  </div>
                )}
                {a.alignment && <span className="text-[13px] font-semibold text-muted-foreground">{a.alignment} alignment</span>}
                <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                {!!a.key_similarities?.length && (
                  <BulletList title="Alike" items={a.key_similarities} dot="bg-primary" />
                )}
                {!!a.key_differences?.length && <BulletList title="Different" items={a.key_differences} dot="bg-warn" />}
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="regional" className="flex flex-col gap-2.5 pt-3">
          {regional_analysis.length === 0 ? (
            <Empty>No regional comparison came back for this result.</Empty>
          ) : (
            regional_analysis.map((region, index) => (
              <article key={index} className={tileClass}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-bold">{region.region}</h3>
                  <Badge variant={region.alignment === "Strong" ? "success" : "secondary"} className="shrink-0">
                    {region.alignment}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{region.description}</p>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="issues" className="flex flex-col gap-2.5 pt-3">
          {sortedIssues.length === 0 ? (
            <Empty>No issue analysis came back for this result.</Empty>
          ) : (
            sortedIssues.map((issue, index) => (
              <article key={index} className={tileClass}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-bold">{issue.issue || `Issue ${index + 1}`}</h3>
                  {issue.stance && (
                    <Badge variant="secondary" className="shrink-0">
                      {issue.stance}
                    </Badge>
                  )}
                </div>
                {typeof issue.percentile === "number" && (
                  <span className="text-[13px] font-semibold text-primary">
                    Stronger views than about {issue.percentile}% of people
                  </span>
                )}
                {issue.description && <p className="text-sm leading-relaxed text-muted-foreground">{issue.description}</p>}
              </article>
            ))
          )}
          {trending_issues.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <h3 className="text-[13px] font-semibold text-muted-foreground">Issues to follow</h3>
              <div className="flex flex-wrap gap-2">
                {trending_issues.map((issue, index) => (
                  <Badge key={index} variant="outline">
                    {typeof issue === "string" ? issue : String(issue.issue)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};

function BulletList({ title, items, dot }: { title: string; items: string[]; dot: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-[13px] font-bold">{title}</h4>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-muted-foreground">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ContextAnalysis;
