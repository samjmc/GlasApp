/**
 * The party page's Ideology tab, from GET /api/ideology/party/:name and its /answers. Pure, so it
 * is unit-tested; the page stays thin.
 */
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyDimension } from "@shared/ideology";
import type { ManifestoCitation, PartyAnswers, PartyIdeology } from "@shared/ideologyMatch";
import { QUIZ_QUESTIONS } from "@shared/quiz";
import { describePosition } from "@/lib/ideologyDisplay";

export interface IdeologyRow {
  dimension: IdeologyDimension;
  label: string;
  negative: string;
  positive: string;
  value: number;
  /** "Strongly Expand welfare"; null when the party has no position on it. */
  description: string | null;
  measured: boolean;
  /** The manifesto's weight in this dimension's position, 0..1. */
  manifestoShare: number;
}

export interface ManifestoAnswerRow {
  questionId: number;
  question: string;
  answer: string;
  rationale: string;
  citations: ManifestoCitation[];
}

export interface PartyIdeologyView {
  rows: IdeologyRow[];
  /** What the position is made from: "3 TDs" or "3 TDs + manifesto". */
  source: string;
  manifesto: { answeredCount: number; askedCount: number } | null;
  /** The questions the manifesto answered, with the answer it gave. */
  answers: ManifestoAnswerRow[];
}

/** "1 TD", "4 TDs + manifesto". */
export function partySource(tdCount: number, hasManifesto: boolean): string {
  return `${tdCount} TD${tdCount === 1 ? "" : "s"}${hasManifesto ? " + manifesto" : ""}`;
}

const QUESTIONS = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));

/** null = the party has no position yet: the empty state. */
export function partyIdeologyView(profile: PartyIdeology | null, answers: PartyAnswers | null): PartyIdeologyView | null {
  if (!profile) return null;
  const rows = IDEOLOGY_DIMENSIONS.map((dimension): IdeologyRow => {
    const value = profile.vector[dimension];
    const measured = profile.measured.includes(dimension);
    return {
      dimension,
      ...DIMENSION_POLES[dimension],
      value,
      description: measured ? describePosition(dimension, value) : null,
      measured,
      manifestoShare: profile.manifesto?.coverage[dimension] ?? 0,
    };
  });
  const answered = (answers?.answers ?? []).flatMap((a): ManifestoAnswerRow[] => {
    const question = QUESTIONS.get(a.questionId);
    const answer = a.answered && a.answerIndex !== null ? question?.answers[a.answerIndex] : undefined;
    if (!question || !answer) return [];
    return [{ questionId: a.questionId, question: question.text, answer: answer.text, rationale: a.rationale, citations: a.citations }];
  });
  const position = answers?.position;
  return {
    rows,
    source: partySource(profile.tdCount, profile.manifesto !== null),
    manifesto: position ? { answeredCount: position.answeredCount, askedCount: position.askedCount } : null,
    answers: answered,
  };
}
