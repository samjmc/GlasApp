import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { MultipleChoiceVoteControl } from "@/components/votes/MultipleChoiceVoteControl";
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

/** The policy question under a news article: answer it, then see how others answered. */
export function PolicyVotePrompt({ articleId, policyVote }: PolicyVotePromptProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

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

  return (
    <Card className="mx-auto w-full max-w-[400px] space-y-4 border-emerald-500/40 bg-gradient-to-br from-emerald-900/20 via-gray-900/30 to-gray-900/10 p-4 sm:max-w-none sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80 sm:text-sm">Policy Vote</h4>
          <p className="mt-1 text-sm font-medium text-white sm:text-base">{policyVote.question}</p>
          {policyVote.topic && (
            <Badge variant="outline" className="mt-2 border-emerald-500/40 text-[11px] text-emerald-200">
              {policyVote.topic.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {typeof policyVote.confidence === "number" && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-emerald-300/70">Confidence</div>
            <div className="text-sm font-bold text-emerald-200">{(policyVote.confidence * 100).toFixed(0)}%</div>
          </div>
        )}
      </div>

      {policyVote.rationale && (
        <div className="flex gap-2 text-sm text-emerald-100/80">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
          <p>{policyVote.rationale}</p>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-4 backdrop-blur-sm sm:p-5">
        <MultipleChoiceVoteControl
          options={policyVote.options}
          selectedOption={myVote}
          onSelect={(optionKey) => void handleVote(optionKey)}
          disabled={isSubmitting}
        />
      </div>

      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowResults(!showResults)}
          className="flex h-8 w-full items-center justify-between px-2 text-xs text-gray-400 hover:bg-white/5 hover:text-gray-300"
        >
          <span>View Community Votes ({tally.total})</span>
          {showResults ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden pt-2 pb-1"
          >
            {options.map(([key, label]) => {
              const count = tally.byOption[key] ?? 0;
              const percentage = tally.total === 0 ? 0 : Math.round((count / tally.total) * 100);
              return (
                <div key={key} className="mb-2 space-y-1 last:mb-0">
                  <div className="flex justify-between gap-3 text-xs text-gray-400">
                    <span>{label}</span>
                    <span className="whitespace-nowrap">
                      {percentage}% · {count}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-1.5 bg-gray-800" />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="rounded-md border border-red-800/60 bg-red-900/40 p-2 text-xs text-red-300">{error}</div>
      )}
    </Card>
  );
}
