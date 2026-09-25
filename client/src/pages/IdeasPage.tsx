import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Flame, Lightbulb, Loader2, MessageSquarePlus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/pulse/EmptyState";
import { Segmented } from "@/components/pulse/Segmented";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Solution {
  id: number;
  problemId: number;
  title: string;
  description: string;
  fullDescription?: string;
  author: string;
  isOfficial: boolean;
  tags?: string[];
  upvotes: number;
  downvotes: number;
  voteScore: number;
  userVoteType: string | null;
  isNew: boolean;
  isTrending: boolean;
  createdAt: string;
}

interface Problem {
  id: number;
  title: string;
  description: string;
  category: string;
  author: string;
  isOfficial: boolean;
  isAdminOnly: boolean;
  tags?: string[];
  upvotes: number;
  downvotes: number;
  voteScore: number;
  userVoteType: string | null;
  isNew: boolean;
  isTrending: boolean;
  createdAt: string;
  solutions: Solution[];
}

type VoteType = "up" | "down";
type Sort = "top" | "new";

const ISSUE_CATEGORIES = [
  { id: "immigration", name: "Immigration", description: "Immigration policy, integration, border control and refugee support." },
  { id: "housing", name: "Housing", description: "Affordability, the rental market, social housing and building." },
  { id: "healthcare", name: "Healthcare", description: "Public health services, waiting lists, mental health and access to care." },
  { id: "economy", name: "Economy", description: "Growth, jobs, tax, business and public finances." },
  { id: "environment", name: "Environment", description: "Climate action, renewable energy and protecting nature." },
  { id: "cost-of-living", name: "Cost of living", description: "Prices, energy bills, food and everyday costs for Irish households." },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });

export default function IdeasPage() {
  const [selectedCategory, setSelectedCategory] = useState("immigration");
  const [sort, setSort] = useState<Sort>("top");
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const category = ISSUE_CATEGORIES.find((c) => c.id === selectedCategory) ?? ISSUE_CATEGORIES[0];

  const { data: problems, isLoading, isError, isFetching, refetch } = useQuery<Problem[]>({
    queryKey: ["/api/problems", selectedCategory],
    queryFn: () => apiRequest<Problem[]>({ method: "GET", path: `/api/problems/${selectedCategory}` }),
    enabled: !!selectedCategory,
  });

  const onVoteError = (error: unknown) =>
    toast({
      variant: "destructive",
      title: "Vote not saved",
      description: error instanceof Error ? error.message : "Please try again.",
    });

  const problemVoteMutation = useMutation({
    mutationFn: ({ problemId, voteType }: { problemId: number; voteType: VoteType }) =>
      apiRequest({ method: "POST", path: "/api/problems/vote/problem", body: { problemId, voteType } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/problems", selectedCategory] }),
    onError: onVoteError,
  });

  const solutionVoteMutation = useMutation({
    mutationFn: ({ solutionId, voteType }: { solutionId: number; voteType: VoteType }) =>
      apiRequest({ method: "POST", path: "/api/problems/vote/solution", body: { solutionId, voteType } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/problems", selectedCategory] }),
    onError: onVoteError,
  });

  const requireSignIn = () => {
    if (isAuthenticated) return true;
    toast({
      title: "Sign in to vote",
      description: "Your votes help rank Ireland's biggest problems.",
      action: (
        <ToastAction altText="Log in" onClick={() => navigate("/login")}>
          Log in
        </ToastAction>
      ),
    });
    return false;
  };

  const sorted = [...(Array.isArray(problems) ? problems : [])].sort((a, b) =>
    sort === "top" ? b.voteScore - a.voteScore : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-col gap-5 py-2">
      <PageHeader
        title="Ideas for Ireland"
        description="Vote on the country's biggest problems and the fixes proposed for them."
        right={
          <Button asChild size="lg">
            <Link href="/contact">
              <MessageSquarePlus />
              Post a problem
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1" role="group" aria-label="Category">
          {ISSUE_CATEGORIES.map((c) => {
            const on = c.id === selectedCategory;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedCategory(c.id)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-foreground text-background" : "bg-elevated text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <Segmented
          label="Sort problems"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: "top", label: "Top" },
            { value: "new", label: "Newest" },
          ]}
        />
      </div>

      <p className="text-sm text-muted-foreground">{category.description}</p>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading problems">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="We could not load these problems"
          action={
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isFetching ? "Loading…" : "Try again"}
            </Button>
          }
        >
          Something went wrong on our side. Try again in a moment.
        </EmptyState>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={`No problems yet for ${category.name.toLowerCase()}`}
          action={
            <Button asChild variant="outline">
              <Link href="/contact">Suggest one</Link>
            </Button>
          }
        >
          We are still collecting the key issues in this area. Tell us what should be on the list.
        </EmptyState>
      ) : (
        <ol className="flex flex-col gap-3">
          {sorted.map((problem, index) => (
            <li key={problem.id}>
              <ProblemCard
                problem={problem}
                categoryName={category.name}
                rank={sort === "top" ? index + 1 : null}
                votePending={problemVoteMutation.isPending && problemVoteMutation.variables?.problemId === problem.id}
                pendingSolutionId={solutionVoteMutation.isPending ? solutionVoteMutation.variables?.solutionId ?? null : null}
                onVote={(voteType) => requireSignIn() && problemVoteMutation.mutate({ problemId: problem.id, voteType })}
                onSolutionVote={(solutionId, voteType) =>
                  requireSignIn() && solutionVoteMutation.mutate({ solutionId, voteType })
                }
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function VoteControl({
  score,
  userVote,
  onVote,
  disabled,
  pending = false,
  label,
  size = "md",
}: {
  score: number;
  userVote: string | null;
  onVote: (v: VoteType) => void;
  disabled: boolean;
  /** This vote is being saved: show a spinner in place of the score. */
  pending?: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  const btn = cn(
    "flex items-center justify-center rounded-lg transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" ? "h-11 w-11" : "h-11 w-11 sm:h-9 sm:w-9"
  );
  return (
    <div className="flex shrink-0 flex-col items-center rounded-xl bg-elevated p-0.5">
      <button
        type="button"
        aria-label={`Upvote ${label}`}
        aria-pressed={userVote === "up"}
        disabled={disabled}
        onClick={() => onVote("up")}
        className={cn(btn, userVote === "up" ? "text-primary" : "text-muted-foreground")}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
      <span
        className={cn("flex items-center justify-center font-display font-bold tabular-nums", size === "md" ? "h-7 text-lg" : "h-5 text-sm")}
        aria-live="polite"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Saving vote</span>
          </>
        ) : (
          score
        )}
      </span>
      <button
        type="button"
        aria-label={`Downvote ${label}`}
        aria-pressed={userVote === "down"}
        disabled={disabled}
        onClick={() => onVote("down")}
        className={cn(btn, userVote === "down" ? "text-warn" : "text-muted-foreground")}
      >
        <ChevronDown className="h-5 w-5" />
      </button>
    </div>
  );
}

function ProblemCard({
  problem,
  categoryName,
  rank,
  votePending,
  pendingSolutionId,
  onVote,
  onSolutionVote,
}: {
  problem: Problem;
  categoryName: string;
  rank: number | null;
  votePending: boolean;
  pendingSolutionId: number | null;
  onVote: (v: VoteType) => void;
  onSolutionVote: (solutionId: number, v: VoteType) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = problem.solutions.length;
  const solutionsId = `problem-${problem.id}-solutions`;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {rank !== null && rank <= 3 && <Badge>#{rank}</Badge>}
            <Badge variant="secondary">{categoryName}</Badge>
            {problem.isNew && <Badge variant="outline">New</Badge>}
            {problem.isTrending && (
              <Badge variant="warn">
                <Flame className="mr-1 h-3 w-3" aria-hidden="true" />
                Top issue
              </Badge>
            )}
          </div>
          <h2 className="font-display text-xl font-bold leading-snug">{problem.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{problem.description}</p>
          <p className="text-xs text-muted-foreground">
            {problem.author} · {formatDate(problem.createdAt)}
          </p>
        </div>
        <VoteControl
          score={problem.voteScore}
          userVote={problem.userVoteType}
          onVote={onVote}
          disabled={votePending}
          pending={votePending}
          label={problem.title}
        />
      </div>

      {count > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={solutionsId}
          className="flex min-h-11 items-center justify-between rounded-lg bg-elevated px-3 text-sm font-bold transition-colors hover:bg-accent"
        >
          {count} solution{count === 1 ? "" : "s"}
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </button>
      ) : (
        <p className="text-[13px] text-muted-foreground">No solutions proposed yet.</p>
      )}

      {open && (
        <ul id={solutionsId} className="flex flex-col gap-2">
          {[...problem.solutions]
            .sort((a, b) => b.voteScore - a.voteScore)
            .map((solution) => (
              <li key={solution.id} className="flex gap-3 rounded-xl border p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-[15px] font-bold">{solution.title}</h3>
                    {solution.isOfficial && (
                      <Badge variant="outline">
                        <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
                        AI-generated
                      </Badge>
                    )}
                    {solution.isNew && <Badge variant="outline">New</Badge>}
                    {solution.isTrending && <Badge variant="warn">Trending</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{solution.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {solution.author} · {formatDate(solution.createdAt)}
                  </p>
                </div>
                <VoteControl
                  size="sm"
                  score={solution.voteScore}
                  userVote={solution.userVoteType}
                  onVote={(v) => onSolutionVote(solution.id, v)}
                  disabled={pendingSolutionId === solution.id}
                  pending={pendingSolutionId === solution.id}
                  label={solution.title}
                />
              </li>
            ))}
        </ul>
      )}
    </article>
  );
}
