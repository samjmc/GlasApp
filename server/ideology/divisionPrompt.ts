/**
 * What a Dáil division meant, asked of a model. Pure: the prompts, the choice of debate
 * excerpts, and the parse. The model call and the storage of readings live elsewhere.
 *
 * The prompt never gives how each party voted. With it, the model could code the
 * government-vs-opposition split instead of the proposal, and an audit that compares the
 * reading with the lobbies' party baselines would only be checking the model against itself.
 */
import { z } from 'zod';
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { DIVISION_KINDS, type DivisionKind } from '@shared/divisionMeaning';
import type { DivisionContext } from '../parliament';
import type { PartialVector } from './model';

/** Stored on every reading; bump it when the prompt changes what a reading means. */
export const DIVISION_PROMPT_VERSION = 1;
/** The lean scale the model answers on (0 = no signal). */
export const DIVISION_LEAN_MAX = 2;
/** Debate excerpts per prompt. */
export const SPEECH_CONTEXT_CHARS = 12_000;
/** Paragraphs kept after each "I move" paragraph: the motion's text and the first reply. */
const AFTER_MOTION = 2;
const OPENING_SPEECHES = 2;
const OPENING_CHARS = 600;
const CLOSING_SPEECHES = 3;

export interface DivisionClassification {
  /** One sentence: what a Tá vote supported. */
  taMeans: string;
  divisionKind: DivisionKind;
  procedural: boolean;
  freeVote: boolean;
  policyTopic: string | null;
  /** ±2 per dimension; a dimension absent says nothing. */
  taLean: PartialVector;
  nilLean: PartialVector;
  /** 0..1: how much a Níl vote says about the voter (low when it only rejects on process). */
  nilWeight: number;
  /** 0..1: how much the division reveals about ideology. */
  salience: number;
  /** 0..1: how sure the reading is of what Tá meant. */
  confidence: number;
  reasoning: string;
}

export type ContextSpeech = DivisionContext['speeches'][number];

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const leanTemplate = `{ ${IDEOLOGY_DIMENSIONS.map((d) => `"${d}": 0`).join(', ')} }`;

export const DIVISION_SYSTEM_PROMPT = `
You read one recorded vote (a division) of Dáil Éireann and say what a Tá (yes) vote and a Níl (no) vote supported, on eight ideology axes.

Axes. Each lean is −2..+2, and 0 means the vote says nothing about that axis. + is always the right-coded pole:
${IDEOLOGY_DIMENSIONS.map((d) => `- ${d}: −2 = ${DIMENSION_POLES[d].negative}, +2 = ${DIMENSION_POLES[d].positive}`).join('\n')}

How Dáil questions are put:
- "Amendment put": Tá = for the amendment; Níl = against it.
- "That the words proposed to be deleted stand": Tá = keep the original motion and reject the countermotion; Níl = for the countermotion.
- "That the Bill do now pass" / "That the Bill be now read a Second Time": Tá = for the Bill.
- Motions on the adjournment, the order of business, the schedule or a guillotine are procedural: set procedural to true and every lean to 0.
- Confidence motions are about the Government, not a policy: give them low salience.

Code the policy content of the proposal; do not infer it from who proposed it.
When Níl only rejects on process grounds (e.g. the Government voting down an opposition amendment as premature, costly or badly drafted), keep nil_lean as the position a Níl vote expresses and set nil_weight low (0–0.3).
Set free_vote to true only if the debate shows the parties did not whip the vote.

Return strict JSON:
{
  "ta_means": "one sentence: what a Tá vote supported",
  "division_kind": "${DIVISION_KINDS.join('|')}",
  "procedural": false,
  "free_vote": false,
  "policy_topic": "short_topic_slug",
  "ta_lean": ${leanTemplate},
  "nil_lean": ${leanTemplate},
  "nil_weight": 1,
  "salience": 0.5,
  "confidence": 0.5,
  "reasoning": "two or three sentences"
}
nil_weight, salience and confidence are 0..1. confidence is how sure you are what Tá meant.
`.trim();

type Tallied = { outcome: string | null; taCount: number; nilCount: number; staonCount: number };
const tally = (d: Tallied) => `${d.outcome ?? 'outcome not recorded'} (Tá ${d.taCount}, Níl ${d.nilCount}, Staon ${d.staonCount})`;

function billLine(b: DivisionContext['bills'][number]): string {
  const sponsor = b.primarySponsor ? `; primary sponsor ${b.primarySponsor.label}${b.primarySponsor.party ? `, ${b.primarySponsor.party}` : ''}` : '';
  return `- ${b.shortTitle} (${b.source} bill${sponsor})${b.longTitle ? `: ${b.longTitle}` : ''}`;
}

/** The division, where it sits, the bills and the government, then the debate excerpts. Only the whole-House tallies. */
export function divisionUserPrompt(context: DivisionContext): string {
  const { division: d, siblings, index, bills, government, speeches } = context;
  // With no located position, a division that is alone in its section is most likely the
  // question put at the end of the debate, so the closing speeches say most about it.
  const alone = d.sectionPosition === null && siblings.length === 1;
  const excerpts = selectSpeechContext(speeches, SPEECH_CONTEXT_CHARS, alone);
  return [
    `Date: ${d.date}`,
    `Question: ${d.subject ?? 'not recorded'}`,
    `Debate: ${d.debateTitle ?? 'not recorded'}`,
    `Outcome: ${tally(d)}`,
    '',
    `This is division ${index} of ${siblings.length} in this debate:`,
    ...siblings.map((s, k) => `${k + 1}. ${s.subject ?? 'Question'}: ${tally(s)}${k + 1 === index ? '  <- this division' : ''}`),
    '',
    'Bills in this debate:',
    ...(bills.length ? bills.map(billLine) : ['none recorded']),
    '',
    `Government parties: ${government.parties.join(', ') || 'none recorded'}`,
    `Independent ministers: ${government.independents.join(', ') || 'none'}`,
    '',
    'Debate record (excerpts, in order):',
    excerpts || 'No debate record is available for this division.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Debate excerpts
// ---------------------------------------------------------------------------

const MOTION = /^I move\b/i;
const PUTS_QUESTION = /\b(question|amendment)/i;

function speakerLabel(s: ContextSpeech): string {
  return `${s.name ?? 'Unnamed speaker'}${s.party ? ` (${s.party})` : ''}${s.role ? `, ${s.role}` : ''}`;
}

/**
 * The excerpts that say most about what was voted on, within `budget` characters, in
 * document order. Paragraphs are kept in this priority until the budget is spent:
 *
 *   1. every "I move …" paragraph and the next two (the motion's text, the first reply)
 *   2. chair speeches that put a question or an amendment
 *   3. the opening 600 characters of the first two member speeches
 *   4. with `withClosing`, the last three member speeches
 *
 * A paragraph that does not fit is skipped whole; the rendered string never exceeds `budget`.
 */
export function selectSpeechContext(speeches: ContextSpeech[], budget = SPEECH_CONTEXT_CHARS, withClosing = false): string {
  const paragraphs = speeches.map((s) => s.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean));
  const flat = paragraphs.flatMap((ps, i) => ps.map((text, j) => ({ i, j, text })));

  // Selected paragraphs in priority order: key → characters kept (Infinity = all).
  const picked = new Map<string, { i: number; j: number; cap: number }>();
  const pick = (i: number, j: number, cap = Number.POSITIVE_INFINITY) => {
    const key = `${i}:${j}`;
    const had = picked.get(key);
    if (!had) picked.set(key, { i, j, cap });
    else had.cap = Math.max(had.cap, cap);
  };

  flat.forEach((p, k) => {
    if (MOTION.test(p.text)) for (const q of flat.slice(k, k + 1 + AFTER_MOTION)) pick(q.i, q.j);
  });
  speeches.forEach((s, i) => {
    if (s.isPresiding && PUTS_QUESTION.test(s.text)) paragraphs[i].forEach((_, j) => pick(i, j));
  });
  const members = speeches.map((s, i) => ({ s, i })).filter(({ s }) => !s.isPresiding);
  for (const { i } of members.slice(0, OPENING_SPEECHES)) {
    let left = OPENING_CHARS;
    for (let j = 0; j < paragraphs[i].length && left > 0; j++) {
      pick(i, j, left);
      left -= paragraphs[i][j].length;
    }
  }
  if (withClosing) for (const { i } of members.slice(-CLOSING_SPEECHES)) paragraphs[i].forEach((_, j) => pick(i, j));

  const SEPARATOR = '\n\n';
  const kept: Array<{ i: number; j: number; block: string }> = [];
  let used = 0;
  for (const { i, j, cap } of Array.from(picked.values())) {
    const text = paragraphs[i][j];
    const block = `${speakerLabel(speeches[i])}: ${text.length > cap ? `${text.slice(0, cap)}…` : text}`;
    const cost = block.length + (kept.length ? SEPARATOR.length : 0);
    if (used + cost > budget) continue;
    kept.push({ i, j, block });
    used += cost;
  }
  return kept
    .sort((a, b) => a.i - b.i || a.j - b.j)
    .map((k) => k.block)
    .join(SEPARATOR);
}

// ---------------------------------------------------------------------------
// Parsing model output. Unusable output returns null rather than a guess.
// ---------------------------------------------------------------------------

const leanSchema = z.record(z.unknown());
const classificationSchema = z.object({
  ta_lean: leanSchema,
  nil_lean: z.unknown().optional(),
  ta_means: z.unknown().optional(),
  division_kind: z.unknown().optional(),
  procedural: z.unknown().optional(),
  free_vote: z.unknown().optional(),
  policy_topic: z.unknown().optional(),
  nil_weight: z.unknown().optional(),
  salience: z.unknown().optional(),
  confidence: z.unknown().optional(),
  reasoning: z.unknown().optional(),
});

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finiteOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const unit = (value: unknown, fallback: number) => clamp(finiteOrNull(value) ?? fallback, 0, 1);
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Known dimensions with a finite number, clamped to ±2. Anything else is left out. */
function leanOf(raw: Record<string, unknown>): PartialVector {
  const out: PartialVector = {};
  for (const d of IDEOLOGY_DIMENSIONS) {
    const value = finiteOrNull(raw[d]);
    if (value !== null) out[d] = clamp(value, -DIVISION_LEAN_MAX, DIVISION_LEAN_MAX);
  }
  return out;
}

const opposite = (lean: PartialVector): PartialVector =>
  Object.fromEntries(Object.entries(lean).map(([d, x]) => [d, x === 0 ? 0 : -x])) as PartialVector;

const isKind = (value: unknown): value is DivisionKind => typeof value === 'string' && (DIVISION_KINDS as readonly string[]).includes(value);

/**
 * The model's JSON → a reading. Null on bad JSON or a missing `ta_lean`. A missing
 * `nil_lean` is the opposite of `ta_lean`; confidence and salience left unstated are 0,
 * so they give no evidence rather than a guessed one.
 */
export function parseDivisionClassification(content: string | null): DivisionClassification | null {
  if (!content) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  const parsed = classificationSchema.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  const taLean = leanOf(v.ta_lean);
  const nil = leanSchema.safeParse(v.nil_lean);
  return {
    taMeans: text(v.ta_means),
    divisionKind: isKind(v.division_kind) ? v.division_kind : 'other',
    procedural: v.procedural === true,
    freeVote: v.free_vote === true,
    policyTopic: text(v.policy_topic) || null,
    taLean,
    nilLean: nil.success ? leanOf(nil.data) : opposite(taLean),
    nilWeight: unit(v.nil_weight, 1),
    salience: unit(v.salience, 0),
    confidence: unit(v.confidence, 0),
    reasoning: text(v.reasoning),
  };
}
