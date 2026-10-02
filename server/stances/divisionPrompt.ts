/**
 * What a Dáil division meant and which daily-vote option it states, asked of a model in two
 * calls (docs/plans/quiz-improvements/01c §3.2–3.3). Pure: the PROPOSAL blocks, the choice of
 * debate excerpts, the prompts and the parses. The calls, the checks (divisionVerify.ts) and the
 * storage live elsewhere. The model writes no axis numbers: a vector only ever comes from the
 * option it picks, fixed when the question was made.
 *
 * The prompts name no party at all: not how each party voted, not a speaker's party or office,
 * not a bill's source or sponsor, not the government. With them, the model could read the
 * proposal by who made it, and the audit (which compares the match with the lobbies' party
 * baselines) would only be checking the model against itself.
 */
import { z } from 'zod';
import { DIVISION_KINDS, type DivisionKind } from '@shared/divisionMeaning';
import { POLICY_DOMAINS } from '../constants/policyTopics';
import type { DivisionContext } from '../parliament';

/** Stored on every reading; bump when the meaning prompt changes what a reading means. */
export const MEANING_PROMPT_VERSION = 1;
/** Stored on every match; bump when the match prompt changes. */
export const MATCH_PROMPT_VERSION = 1;
/** Debate excerpts per prompt. */
export const SPEECH_CONTEXT_CHARS = 12_000;
/** PROPOSAL blocks per prompt. */
export const PROPOSAL_CHARS = 8_000;
/** One moved motion or amendment: its "I move" paragraph and what follows in the same speech. */
export const MOVED_TEXT_CHARS = 3_000;
/** Paragraphs kept after each "I move" paragraph in the excerpts: the motion's text and the first reply. */
const AFTER_MOTION = 2;
const OPENING_SPEECHES = 2;
const OPENING_CHARS = 600;
const CLOSING_SPEECHES = 3;

export type ContextSpeech = DivisionContext['speeches'][number];

// ---------------------------------------------------------------------------
// PROPOSAL blocks: the text that was put, the only place a quote may come from
// ---------------------------------------------------------------------------

/** Q = the question as recorded, B = a bill's long title, M = a motion moved, A = an amendment moved. */
export type BlockKind = 'Q' | 'B' | 'M' | 'A';

export interface ProposalBlock {
  /** Q, B1, M1, A1 … */
  label: string;
  kind: BlockKind;
  text: string;
}

const MOTION = /^I move\b/i;
/** The Standing Orders formula for moving an amendment. This reads procedure, not meaning. */
const MOVES_AMENDMENT = /^I move\b[^:]*\bamendments?\b/i;

const paragraphsOf = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * The labelled blocks of what was put, in document order, within `budget` characters:
 *
 *   Q      the division's subject as recorded (often only "Amendment put")
 *   B1…    each linked bill's long title (no source, no sponsor)
 *   M1…    each "I move" paragraph that names no amendment, with the paragraphs after it IN THE
 *          SAME SPEECH up to the next "I move", whole paragraphs, at most MOVED_TEXT_CHARS
 *   A1…    the same for each "I move amendment(s) …" paragraph
 *
 * Q and B come first; then M and A blocks, the nearest the vote first for a placed division
 * (`sectionPosition` set), else the earliest. A block that does not fit is left out whole.
 */
export function proposalBlocks(context: Pick<DivisionContext, 'division' | 'bills' | 'speeches'>, budget = PROPOSAL_CHARS): ProposalBlock[] {
  const fixed: Array<{ kind: 'Q' | 'B'; text: string }> = [];
  const subject = context.division.subject?.trim();
  if (subject) fixed.push({ kind: 'Q', text: subject });
  for (const bill of context.bills) fixed.push({ kind: 'B', text: bill.longTitle ?? bill.shortTitle });

  const moved: Array<{ kind: 'M' | 'A'; text: string }> = [];
  for (const speech of context.speeches) {
    const ps = paragraphsOf(speech.text);
    for (let j = 0; j < ps.length; j++) {
      if (!MOTION.test(ps[j]!)) continue;
      const parts = [ps[j]!];
      let used = ps[j]!.length;
      for (let k = j + 1; k < ps.length && !MOTION.test(ps[k]!); k++) {
        if (used + 2 + ps[k]!.length > MOVED_TEXT_CHARS) break;
        parts.push(ps[k]!);
        used += 2 + ps[k]!.length;
      }
      moved.push({ kind: MOVES_AMENDMENT.test(ps[j]!) ? 'A' : 'M', text: parts.join('\n\n') });
    }
  }

  let used = 0;
  const fits = (text: string) => {
    if (used + text.length > budget) return false;
    used += text.length;
    return true;
  };
  const keptFixed = fixed.filter((b) => fits(b.text));
  const order = context.division.sectionPosition !== null ? moved.map((_, i) => i).reverse() : moved.map((_, i) => i);
  const keptMoved = new Set(order.filter((i) => fits(moved[i]!.text)));

  const counts: Record<BlockKind, number> = { Q: 0, B: 0, M: 0, A: 0 };
  const label = (kind: BlockKind) => (kind === 'Q' ? 'Q' : `${kind}${++counts[kind]}`);
  return [...keptFixed, ...moved.filter((_, i) => keptMoved.has(i))].map((b) => ({ label: label(b.kind), kind: b.kind, text: b.text }));
}

const renderBlocks = (blocks: ProposalBlock[]) => blocks.map((b) => `[${b.label}] ${b.text}`).join('\n\n');

// ---------------------------------------------------------------------------
// Call 1: the meaning
// ---------------------------------------------------------------------------

const DOMAIN_KEYS = Object.keys(POLICY_DOMAINS);

export const MEANING_SYSTEM_PROMPT = `
You read one recorded vote (a division) of Dáil Éireann and say what a Tá (yes) vote supported. You never rate, praise or criticise anyone, and you give no scores.

How Dáil questions are put:
- "Amendment put" / "That amendment No. X be made": division_kind "amendment"; Tá = for the amendment.
- "That the words proposed to be deleted stand": division_kind "words_stand"; Tá = keep the original motion and reject the countermotion.
- "That the motion, as amended, be agreed to": division_kind "as_amended".
- "That the Bill do now pass" / "That the Bill be now read a Second Time" and other stages: division_kind "bill_stage"; Tá = for the Bill.
- A motion put as moved: division_kind "motion"; Tá = for the motion.
- Motions on the adjournment, the order of business, the schedule or a guillotine: division_kind "procedural" and procedural true.
- Confidence motions: division_kind "confidence".
- If you cannot tell which question was put: division_kind "unclear".

The PROPOSAL lists the text that was put, in labelled blocks: Q is the question as recorded, B a bill's long title, M a motion moved, A an amendment moved. The EXCERPTS are from the debate, for context only.
Code the policy content of the proposal; do not infer it from who proposed it.

Rules:
- "quote_block" is the label of ONE PROPOSAL block, and "quote" is 8 to 60 words copied EXACTLY from that block, one continuous passage, no ellipsis, that states what a Tá vote supported.
- "policy_domains": one or two of these keys: ${DOMAIN_KEYS.join(', ')}.
- "confidence" (0..1) is how sure you are what a Tá vote supported.

Return strict JSON:
{ "procedural": false, "division_kind": "${DIVISION_KINDS.join('|')}", "ta_means": "one sentence: what a Tá vote supported", "quote_block": "A1", "quote": "exact words from that block", "policy_domains": ["housing"], "confidence": 0.8 }
`.trim();

type Tallied = { outcome: string | null; taCount: number; nilCount: number; staonCount: number };
const tally = (d: Tallied) => `${d.outcome ?? 'outcome not recorded'} (Tá ${d.taCount}, Níl ${d.nilCount}, Staon ${d.staonCount})`;

/**
 * The division and where it sits, the PROPOSAL blocks, then the debate excerpts. Only the
 * whole-House tallies; no party, no bill source or sponsor.
 */
export function divisionUserPrompt(context: DivisionContext, blocks: ProposalBlock[] = proposalBlocks(context)): string {
  const { division: d, siblings, index, speeches } = context;
  const placed = d.sectionPosition !== null;
  // With no located position, a division that is alone in its section is most likely the
  // question put at the end of the debate, so the closing speeches say most about it.
  // A placed division's speeches end at the vote, so the motions nearest it come first.
  const alone = !placed && siblings.length === 1;
  const excerpts = selectSpeechContext(speeches, SPEECH_CONTEXT_CHARS, alone, placed);
  return [
    `Date: ${d.date}`,
    `Question: ${d.subject ?? 'not recorded'}`,
    `Debate: ${d.debateTitle ?? 'not recorded'}`,
    `Outcome: ${tally(d)}`,
    '',
    `This is division ${index} of ${siblings.length} in this debate:`,
    ...siblings.map((s, k) => `${k + 1}. ${s.subject ?? 'Question'}: ${tally(s)}${k + 1 === index ? '  <- this division' : ''}`),
    '',
    'PROPOSAL (quote only from here):',
    blocks.length ? renderBlocks(blocks) : 'No proposal text is recorded.',
    '',
    'EXCERPTS (debate record, in order):',
    excerpts || 'No debate record is available for this division.',
  ].join('\n');
}

export interface MeaningReply {
  procedural: boolean;
  divisionKind: DivisionKind;
  taMeans: string;
  quoteBlock: string;
  quote: string;
  policyDomains: string[];
  confidence: number;
}

const meaningSchema = z.object({
  procedural: z.boolean().optional(),
  division_kind: z.enum(DIVISION_KINDS),
  ta_means: z.string().optional(),
  quote_block: z.string().optional(),
  quote: z.string().optional(),
  policy_domains: z.array(z.string()).optional(),
  confidence: z.number().finite().optional(),
});

const parseJson = (content: string | null): unknown => {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};
const unit = (value: number | undefined) => Math.min(1, Math.max(0, value ?? 0));

/** The model's JSON → a meaning reply. Null on bad JSON or a wrong shape (an unknown kind included). */
export function parseMeaning(content: string | null): MeaningReply | null {
  const parsed = meaningSchema.safeParse(parseJson(content));
  if (!parsed.success) return null;
  const v = parsed.data;
  return {
    procedural: v.procedural === true,
    divisionKind: v.division_kind,
    taMeans: (v.ta_means ?? '').trim(),
    quoteBlock: (v.quote_block ?? '').trim(),
    quote: v.quote ?? '',
    policyDomains: (v.policy_domains ?? []).map((d) => d.trim().toLowerCase()),
    confidence: unit(v.confidence),
  };
}

// ---------------------------------------------------------------------------
// Call 2: the match
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  id: number;
  question: string;
  options: Array<{ key: string; label: string }>;
}

export const MATCH_SYSTEM_PROMPT = `
You match what a recorded Dáil vote supported to the answer of a daily-vote question that it states, if any. You never infer or guess. Respond ONLY with valid JSON.

Rules:
- Choose a question and an answer ONLY when what a Tá vote supported itself states that choice. When no question's answer is clearly stated, use null.
- Never infer an answer from who proposed the motion or how parties voted.
- Give a Níl answer only when voting against the proposal itself states one of that question's answers; else null. It must differ from the Tá answer.
- "confidence" (0..1) is how sure you are that the Tá answer is stated.

Return strict JSON:
{ "question_id": 123, "ta_option": "option_b", "nil_option": null, "confidence": 0.8, "reason": "one sentence" }
`.trim();

export function matchUserPrompt(meaning: { taMeans: string; quote: string; divisionKind: DivisionKind }, candidates: MatchCandidate[]): string {
  return [
    `What a Tá vote supported: ${meaning.taMeans}`,
    `The proposal's words: ${JSON.stringify(meaning.quote)}`,
    `Kind of question: ${meaning.divisionKind}`,
    '',
    'Candidate questions:',
    ...candidates.map((c) => [`- question_id ${c.id}: ${c.question}`, ...c.options.map((o) => `    ${o.key}: ${o.label}`)].join('\n')),
  ].join('\n');
}

export interface MatchReply {
  questionId: number | null;
  taOption: string | null;
  nilOption: string | null;
  confidence: number;
  reason: string;
}

const matchSchema = z.object({
  question_id: z.number().int().nullable(),
  ta_option: z.string().nullable().optional(),
  nil_option: z.string().nullable().optional(),
  confidence: z.number().finite().optional(),
  reason: z.string().optional(),
});

/** The model's JSON → a match reply. Null on bad JSON or a wrong shape. */
export function parseMatch(content: string | null): MatchReply | null {
  const parsed = matchSchema.safeParse(parseJson(content));
  if (!parsed.success) return null;
  const v = parsed.data;
  return {
    questionId: v.question_id,
    taOption: v.ta_option ?? null,
    nilOption: v.nil_option ?? null,
    confidence: unit(v.confidence),
    reason: (v.reason ?? '').trim(),
  };
}

// ---------------------------------------------------------------------------
// Debate excerpts
// ---------------------------------------------------------------------------

const PUTS_QUESTION = /\b(question|amendment)/i;

/** The speaker's name only: a party or an office (a minister's) would say who proposed what. */
function speakerLabel(s: ContextSpeech): string {
  return s.name ?? 'Unnamed speaker';
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
 * Within 1 and 2, the earliest come first; with `nearestEnd` (the speeches end at the vote),
 * the latest do, so a long debate cannot crowd out the motion actually put.
 * A paragraph that does not fit is skipped whole; the rendered string never exceeds `budget`.
 */
export function selectSpeechContext(speeches: ContextSpeech[], budget = SPEECH_CONTEXT_CHARS, withClosing = false, nearestEnd = false): string {
  const paragraphs = speeches.map((s) => paragraphsOf(s.text));
  const flat = paragraphs.flatMap((ps, i) => ps.map((text, j) => ({ i, j, text })));

  // Selected paragraphs in priority order: key → characters kept (Infinity = all).
  const picked = new Map<string, { i: number; j: number; cap: number }>();
  const pick = (i: number, j: number, cap = Number.POSITIVE_INFINITY) => {
    const key = `${i}:${j}`;
    const had = picked.get(key);
    if (!had) picked.set(key, { i, j, cap });
    else had.cap = Math.max(had.cap, cap);
  };

  const inOrder = <T>(items: T[]) => (nearestEnd ? [...items].reverse() : items);
  const motions = flat.flatMap((p, k) => (MOTION.test(p.text) ? [k] : []));
  for (const k of inOrder(motions)) for (const q of flat.slice(k, k + 1 + AFTER_MOTION)) pick(q.i, q.j);
  const putsQuestion = speeches.flatMap((s, i) => (s.isPresiding && PUTS_QUESTION.test(s.text) ? [i] : []));
  for (const i of inOrder(putsQuestion)) paragraphs[i]!.forEach((_, j) => pick(i, j));
  const members = speeches.map((s, i) => ({ s, i })).filter(({ s }) => !s.isPresiding);
  for (const { i } of members.slice(0, OPENING_SPEECHES)) {
    let left = OPENING_CHARS;
    for (let j = 0; j < paragraphs[i]!.length && left > 0; j++) {
      pick(i, j, left);
      left -= paragraphs[i]![j]!.length;
    }
  }
  if (withClosing) for (const { i } of members.slice(-CLOSING_SPEECHES)) paragraphs[i]!.forEach((_, j) => pick(i, j));

  const SEPARATOR = '\n\n';
  const kept: Array<{ i: number; j: number; block: string }> = [];
  let used = 0;
  for (const { i, j, cap } of Array.from(picked.values())) {
    const text = paragraphs[i]![j]!;
    const block = `${speakerLabel(speeches[i]!)}: ${text.length > cap ? `${text.slice(0, cap)}…` : text}`;
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
