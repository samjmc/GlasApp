import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PLEDGE_CATEGORIES } from "@shared/pledges";
import { CATEGORY_LABELS, pledgesApi, type PledgeCategory } from "@/services/pledgesApi";

/** The policy areas offered for ranking: everything except the catch-all. */
const RANKABLE = PLEDGE_CATEGORIES.filter((c) => c !== "other");

/**
 * Rank the policy areas that matter most to you. Your ranking weights the "weighted by
 * priorities" delivery rate; signed-out visitors see everyone's combined ranking.
 */
export function PledgePriorities() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const priorities = useQuery({ queryKey: ["/api/pledges/priorities"], queryFn: pledgesApi.priorities });
  const [order, setOrder] = useState<PledgeCategory[]>([...RANKABLE]);

  // Start from the caller's saved ranking, then the community's, then the default order.
  useEffect(() => {
    const view = priorities.data;
    if (!view) return;
    const base = view.mine ?? [...RANKABLE].sort((a, b) => (view.community[b] ?? 0) - (view.community[a] ?? 0));
    setOrder([...base, ...RANKABLE.filter((c) => !base.includes(c))]);
  }, [priorities.data]);

  const save = useMutation({
    mutationFn: () => pledgesApi.savePriorities(order),
    onSuccess: () => {
      toast({ title: "Priorities saved", description: "Party delivery rates now use your ranking." });
      queryClient.invalidateQueries({ queryKey: ["/api/pledges/priorities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pledges/parties"] });
    },
    onError: () => toast({ title: "Could not save your ranking", description: "Please try again.", variant: "destructive" }),
  });

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setOrder(next);
  };

  const rankers = priorities.data?.rankers ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold tracking-tight">What matters most to you?</CardTitle>
        <CardDescription>
          Order these policy areas, most important first.{" "}
          {rankers > 0 ? `${rankers} ${rankers === 1 ? "person has" : "people have"} ranked them so far.` : "Nobody has ranked them yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ol className="flex flex-col gap-1.5">
          {order.map((category, index) => (
            <li key={category} className="flex items-center gap-2 rounded-xl bg-elevated py-1 pl-3 pr-1">
              <span className="w-6 font-display text-sm font-bold text-muted-foreground">{index + 1}</span>
              <span className="flex-1 text-sm font-semibold">{CATEGORY_LABELS[category]}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move ${CATEGORY_LABELS[category]} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Move ${CATEGORY_LABELS[category]} down`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
        {isAuthenticated ? (
          <Button onClick={() => save.mutate()} disabled={save.isPending} aria-busy={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {save.isPending ? "Saving…" : "Save my ranking"}
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link href="/login">Sign in to save my ranking</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
