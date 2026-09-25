import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, Loader2, Vote } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { MultipleChoiceVoteControl } from "@/components/votes/MultipleChoiceVoteControl";
import { cn } from "@/lib/utils";
import {
  castArticleVote,
  fetchArticleVote,
  type QuestionTally,
} from "@/services/dailySessionService";

/** The question as the news feed passes it to the card. */
export interface PolicyVoteData {
  id: number;
  question: string;
  options: Record<string, string>;
  domain?: string;
  topic?: string;
  confidence?: number | null;
  rationale?: string | null;
}

interface PolicyVotePromptProps {
  articleId: number;
  policyVote: PolicyVoteData;
}

const EMPTY_TALLY: QuestionTally = { total: 0, byOption: {} };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Please try again in a moment.");

/** The policy question under a news article: answer it in one tap, then see how others answered. */
export function PolicyVotePrompt({ articleId, policyVote }: PolicyVotePromptProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [tally, setTally] = useState<QuestionTally>(EMPTY_TALLY);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchArticleVote(articleId)
      .then((view) => {
        if (!active) return;
        setTally(view.tally);
        setMyVote(view.myVote);
      })
      .catch((err: unknown) => active && setError(messageOf(err)));
    return () => {
      active = false;
    };
  }, [articleId, isAuthenticated]);

  const handleVote = async (optionKey: string) => {
    if (!isAuthenticated) {
      toast({
        title: "Log in to vote",
        description: "Your answers shape your TD and party matches. Please sign in first.",
        action: (
          <ToastAction altText="Log in" onClick={() => navigate("/login")}>
            Log in
          </ToastAction>
        ),
      });
      return;
    }
    if (optionKey === myVote) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await castArticleVote(policyVote.id, optionKey);
      setTally(result.tally);
      setMyVote(result.myVote);
      toast({ title: "Vote recorded", description: "Thanks! Your answer will shape your profile." });
    } catch (err: unknown) {
      setError(messageOf(err));
      toast({ title: "Could not save vote", description: messageOf(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const options = Object.entries(policyVote.options ?? {});
  const resultsId = `policy-vote-results-${policyVote.id}`;

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-elevated p-3 sm:p-4" aria-label="Policy vote">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Vote className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-primary">
            Your stance{policyVote.topic ? ` · ${policyVote.topic.replace(/_/g, " ")}` : ""}
          </p>
          <p className="text-[15px] font-bold leading-snug">{policyVote.question}</p>
        </div>
      </div>

      <MultipleChoiceVoteControl
        size="sm"
        label={policyVote.question}
        options={policyVote.options}
        selectedOption={myVote}
        onSelect={(optionKey) => void handleVote(optionKey)}
        disabled={isSubmitting}
      />

      {isSubmitting && (
        <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving your answer…
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowResults(!showResults)}
        aria-expanded={showResults}
        aria-controls={resultsId}
        className="flex min-h-11 items-center justify-between rounded-lg px-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>
          How others answered · {tally.total} vote{tally.total === 1 ? "" : "s"}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showResults && "rotate-180")} aria-hidden="true" />
      </button>

      {showResults && (
        <div id={resultsId} className="flex flex-col gap-2.5">
          {tally.total === 0 ? (
            <p className="text-[13px] text-muted-foreground">No votes yet. Be the first to answer.</p>
          ) : (
            options.map(([key, label]) => {
              const count = tally.byOption[key] ?? 0;
              const percentage = Math.round((count / tally.total) * 100);
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className={cn(key === myVote ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</span>
                    <span className="whitespace-nowrap font-semibold tabular-nums">
                      {percentage}% · {count}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-card">
                    <div
                      className={cn("h-full rounded-full", key === myVote ? "bg-primary" : "bg-muted-foreground")}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
