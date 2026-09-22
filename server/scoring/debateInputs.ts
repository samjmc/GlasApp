/**
 * The debate pillar's input. Debate scoring is its own subsystem, not yet rebuilt, and
 * writes `public.td_debate_running_scores` keyed by the TD id. This adapter reads that
 * one column; the debate rebuild replaces the implementation.
 */
import { supabaseDb } from '../db';

/** td id → performance score (0–1 or 0–100; the rollup normalises). */
export async function loadDebateScores(): Promise<Map<number, number>> {
  const scores = new Map<number, number>();
  if (!supabaseDb) return scores;
  const { data, error } = await supabaseDb.from('td_debate_running_scores').select('td_id, performance_score');
  if (error) {
    console.warn('Debate scores unavailable; scoring without the debate pillar:', error.message);
    return scores;
  }
  for (const row of (data ?? []) as Array<{ td_id: number; performance_score: number | string | null }>) {
    const v = Number(row.performance_score);
    if (Number.isFinite(v)) scores.set(row.td_id, v);
  }
  return scores;
}
