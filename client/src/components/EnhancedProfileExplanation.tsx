import React, { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from "@shared/ideology";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/pulse/Segmented";
import { useToast } from "@/components/ui/use-toast";
import { defaultWeights, type DimensionWeights } from "@/lib/ideologyApi";
import { storeWeights } from "@/lib/quizStorage";
import PartyMatchResults from "./PartyMatchResults";

interface EnhancedProfileExplanationProps {
  dimensions: IdeologyVector;
  /** Match weights, 0..3 per dimension. Owned by the page so they survive tab switches. */
  weights: DimensionWeights;
  onWeightsChange: (weights: DimensionWeights) => void;
}

// Type for API response
interface CompleteAnalysis {
  profile_analysis?: string;
  ideology?: string;
  description?: string;
  beliefs?: string[] | Record<string, unknown>;
  tensions?: string[];
  issue_positions?: Record<string, string | undefined>;
}

const WEIGHT_OPTIONS = [
  { value: "0.5", label: "Less" },
  { value: "1", label: "Normal" },
  { value: "2", label: "More" },
];

const cardClass = "flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5";

/** Party matches, match weights, and the AI write-up of the profile. */
const EnhancedProfileExplanation: React.FC<EnhancedProfileExplanationProps> = ({ dimensions, weights, onWeightsChange }) => {
  const [analysisData, setAnalysisData] = useState<CompleteAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const weightsChanged = IDEOLOGY_DIMENSIONS.some((d) => weights[d] !== 1);

  const saveWeights = () => {
    storeWeights(weights);
    toast({
      title: "Weights saved",
      description: "We will use these weights next time too.",
      duration: 3000,
    });
  };

  const fetchAnalysisData = async (dims: IdeologyVector, wts: Partial<DimensionWeights> = {}) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/enhanced-profile/complete-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimensions: dims, weights: wts }),
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

  // Only load on mount — weight changes update the party matches, not this write-up.
  useEffect(() => {
    void fetchAnalysisData(dimensions, weights || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleRegenerate = (event: Event) => {
      const detail = (event as CustomEvent<{ weights?: Record<string, number> }>).detail;
      if (detail?.weights) void fetchAnalysisData(dimensions, detail.weights);
    };
    window.addEventListener("regenerate-analysis", handleRegenerate);
    return () => window.removeEventListener("regenerate-analysis", handleRegenerate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions]);

  return (
    <>
      {/* Matches need no AI, so an analysis failure must not hide them. */}
      <PartyMatchResults dimensions={dimensions} weights={weights} />

      <section className={cardClass}>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-[22px] font-bold">What matters most?</h2>
          <p className="text-[13px] text-muted-foreground">Weight a dimension up or down. Your matches follow.</p>
        </div>
        <ul className="flex flex-col gap-0.5 md:grid md:grid-cols-2 md:gap-x-6">
          {IDEOLOGY_DIMENSIONS.map((dim: IdeologyDimension) => (
            <li key={dim} className="flex min-h-[52px] items-center justify-between gap-2">
              <span className="text-[15px] font-bold">{DIMENSION_POLES[dim].label}</span>
              <Segmented
                size="sm"
                label={`Weight for ${DIMENSION_POLES[dim].label}`}
                options={WEIGHT_OPTIONS}
                value={String(weights[dim])}
                onChange={(v) => onWeightsChange({ ...weights, [dim]: Number(v) })}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/15 px-3 py-2.5">
          <span role="status" className="text-[13px] font-bold text-primary">
            {weightsChanged ? "Matches updated for your weights" : "All dimensions count the same"}
          </span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={() => onWeightsChange(defaultWeights())} disabled={!weightsChanged}>
              <RotateCcw aria-hidden="true" />
              Reset weights
            </Button>
            <Button variant="secondary" onClick={saveWeights}>
              <Save aria-hidden="true" />
              Save weights
            </Button>
          </span>
        </div>
      </section>

      <section className={cardClass} data-enhanced-profile-container="true">
        <h2 className="font-display text-[22px] font-bold">What your answers say</h2>
        {isLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
            <Skeleton className="mt-2 h-20 w-full rounded-xl" />
          </div>
        ) : errorMessage || !analysisData ? (
          <>
            <p role="alert" className="text-sm text-destructive">
              We could not write your analysis. {errorMessage}
            </p>
            <Button variant="outline" className="w-fit" onClick={() => void fetchAnalysisData(dimensions, weights || {})}>
              Try again
            </Button>
          </>
        ) : (
          <AnalysisBody data={analysisData} />
        )}
      </section>
    </>
  );
};

function AnalysisBody({ data }: { data: CompleteAnalysis }) {
  const summary = data.profile_analysis || data.description || "";
  const beliefs: string[] = Array.isArray(data.beliefs)
    ? data.beliefs
    : data.beliefs && typeof data.beliefs === "object"
      ? Object.values(data.beliefs).map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      : [];
  const tensions = Array.isArray(data.tensions) ? data.tensions : [];
  const positions = Object.entries(data.issue_positions ?? {}).filter((e): e is [string, string] => Boolean(e[1]));

  if (!summary && beliefs.length === 0 && tensions.length === 0 && positions.length === 0) {
    return <p className="text-sm text-muted-foreground">No analysis came back for this result.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {summary && <p className="text-[15px] leading-relaxed">{summary}</p>}

      {positions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Likely positions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {positions.map(([issue, position]) => (
              <div key={issue} className="rounded-xl bg-elevated p-3">
                <p className="text-sm font-bold capitalize">{issue.replace(/_/g, " ")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{position}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {beliefs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Core beliefs</h3>
          <ul className="flex flex-col gap-2">
            {beliefs.map((belief, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {belief}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tensions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Where your views pull apart</h3>
          <ul className="flex flex-col gap-2">
            {tensions.map((tension, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden="true" />
                {tension}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EnhancedProfileExplanation;
