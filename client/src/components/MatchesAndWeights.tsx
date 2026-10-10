import React from "react";
import { RotateCcw, Save } from "lucide-react";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyDimension, type IdeologyVector } from "@shared/ideology";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/pulse/Segmented";
import { useToast } from "@/components/ui/use-toast";
import { defaultWeights, type DimensionWeights } from "@/lib/ideologyApi";
import { storeWeights } from "@/lib/quizStorage";
import PartyMatchResults from "./PartyMatchResults";

interface MatchesAndWeightsProps {
  dimensions: IdeologyVector;
  /** Match weights, 0..3 per dimension. Owned by the page so they survive tab switches. */
  weights: DimensionWeights;
  onWeightsChange: (weights: DimensionWeights) => void;
}

const WEIGHT_OPTIONS = [
  { value: "0.5", label: "Less" },
  { value: "1", label: "Normal" },
  { value: "2", label: "More" },
];

const cardClass = "flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5";

/** Party matches, and the weights that change them. */
const MatchesAndWeights: React.FC<MatchesAndWeightsProps> = ({ dimensions, weights, onWeightsChange }) => {
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

  return (
    <>
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
    </>
  );
};

export default MatchesAndWeights;
