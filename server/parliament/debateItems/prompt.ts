/**
 * Step 2 of debate analysis: the model lists items of fixed kinds in a window of speeches, each
 * with a quote copied from the speech. It judges nothing; verify.ts checks every quote.
 */
import { z } from 'zod';
import { debateClaimType, debateItemKind, type DebateClaimType, type DebateItemKind } from '@shared/schema/parliament';
import type { DebateWindow, LabelledSpeech } from './windows';

/** Bump when the prompt, the kinds or the checks change: a new version re-reads every debate. */
// v2 (2026-10-04, after the 50-debate pilot): a question needs a question mark, the claim limit is
// enforced in code, Irish office words ("an tAire") name an addressee, and a commitment must be an
// undertaking, not a description of an existing plan.
// v3 (2026-10-10, after the blind check against two independent markers): each window is read in
// two passes (PASSES); every reference to what an earlier speaker said is a response; a commitment
// includes continuing or reviewing something; the question mark may end the quote's sentence.
export const EXTRACTOR_VERSION = 'v3';
/**
 * Every version the debate record may read, oldest first; EXTRACTOR_VERSION is the last. The record
 * takes each debate's newest finished read among them, so a read of a new version that stops part
 * way (out of credit, 2026-10-10: 149 of 454) never shrinks the record to the debates read so far.
 */
export const EXTRACTOR_VERSIONS = ['v2', 'v3'] as const;
export const QUOTE_MIN_WORDS = 3;
export const QUOTE_MAX_WORDS = 40;
/** The prompt asks for at most this many claims per speech, the most specific first. */
export const MAX_CLAIMS_PER_SPEECH = 5;

/** An item as the model returned it, before verification. */
export interface RawItem {
  speech: string;
  kind: DebateItemKind;
  claimType: DebateClaimType | null;
  quote: string;
  targetSpeech: string | null;
  targetQuote: string | null;
  addressee: string | null;
  due: string | null;
}

export const EXTRACT_SYSTEM =
  'You list what speeches in an Irish parliamentary debate contain, as items of fixed kinds, each with an exact quote. ' +
  'You never judge quality, truth, tone or who is right, and you never translate. Respond ONLY with valid JSON.';

const speechBlock = (s: LabelledSpeech, mark: 'context' | 'extract') => `[${s.label}] (${mark}) ${s.speaker}:\n${s.text}`;

const KIND_DEFINITIONS: Record<DebateItemKind, string> = {
  // v2's wording, kept: a stricter "named source" (names on their own are not claims) showed no gain
  // beyond run-to-run noise in the blind check (2026-10-10).
  specific_claim: `- "specific_claim": the speaker states a specific fact someone could check. "claim_type" is one of:
  "figure" (a number, percentage or amount), "named_source" (a named report, study, Act or body given as a source),
  "cost" (a sum of money), "date" (a specific date or deadline). Not an opinion, a prediction or a general statement.
  At most ${MAX_CLAIMS_PER_SPEECH} per speech: the most specific ones.`,
  response: `- "response": the speaker refers to what ANOTHER speaker said or did EARLIER in these speeches and takes it up:
  answers it, rebuts it, agrees with it or builds on it ("As Deputy X said, ...", "The Minister said ... but ...",
  "Deputy Y asked about ..."). List every such reference. Give "target_speech": that speaker's earlier speech, and
  "target_quote": the point there, copied exactly if you can find it, else null.`,
  concession: `- "concession": the speaker explicitly agrees with or accepts a point made earlier by another speaker
  ("the Deputy is right that ...", "I agree with Deputy X that ...", in any language). Give "target_speech".`,
  // v2's wording; code now accepts a quote whose sentence, not the quote itself, ends with "?".
  question: `- "question": the speaker puts a direct question, ending with a question mark, to a named member or office
  ("Will the Minister ...?"). Not a request or a wish ("I would welcome clarity"). Give "addressee": who it is put to, as the speaker says it.`,
  commitment: `- "commitment": a minister says that they, their Department or the Government WILL do a specific thing, including
  continuing or reviewing something ("I will publish ...", "we will bring forward ...", "I will continue the
  consultation ..."). Not a description of what an existing plan already contains. Give "due" if a time is stated, else null.`,
};

/**
 * v3 reads each window twice: facts, then links. One call asked for all five kinds and, told to
 * list every reply, found fewer claims (the blind check, 2026-10-10: 22 of the markers' shared
 * claims, against 29 for v2 on the same local copy).
 */
export const PASSES = {
  facts: ['specific_claim', 'question', 'commitment'],
  links: ['response', 'concession'],
} as const satisfies Record<string, readonly DebateItemKind[]>;
export type ExtractPass = keyof typeof PASSES;
export const PASS_NAMES = Object.keys(PASSES) as ExtractPass[];

export function extractPrompt(title: string, window: DebateWindow, pass: ExtractPass): string {
  const blocks = [...window.context.map((s) => speechBlock(s, 'context')), ...window.speeches.map((s) => speechBlock(s, 'extract'))];
  const kinds: readonly DebateItemKind[] = PASSES[pass];
  return `
List the items in the speeches marked (extract) below, from a debate of the Dáil titled "${title}".
List ONLY these kinds; other kinds are listed separately.

Item kinds:
${kinds.map((k) => KIND_DEFINITIONS[k]).join('\n')}

Rules:
- Only list items in speeches marked (extract). Speeches marked (context) may only be a "target_speech".
- "quote" is ${QUOTE_MIN_WORDS} to ${QUOTE_MAX_WORDS} words copied EXACTLY from that speech: one continuous passage,
  no ellipsis, no changes, in the language spoken. Never translate Irish.
- Do not rate, praise or criticise anyone, and do not decide who is right. An empty list is a normal answer.

Return strict JSON:
{ "items": [ { "speech": "s3", "kind": "${kinds[0]}", "claim_type": ${kinds[0] === 'specific_claim' ? '"figure"' : 'null'}, "quote": "exact words", "target_speech": ${kinds[0] === 'response' ? '"s1"' : 'null'}, "target_quote": null, "addressee": null, "due": null } ] }

Speeches:
${blocks.join('\n\n')}
`.trim();
}

const replySchema = z.object({ items: z.array(z.unknown()) });
/** Absent, null or blank all mean "none": models often send "" for a field that does not apply. */
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const itemSchema = z.object({
  speech: z.string().trim(),
  kind: z.enum(debateItemKind.enumValues),
  claim_type: z.enum(debateClaimType.enumValues).nullish(),
  quote: z.string(),
  target_speech: optionalText,
  target_quote: optionalText,
  addressee: optionalText,
  due: optionalText,
});

/**
 * Parse the model's reply. Null when it is not `{ items: [...] }`; an entry of the wrong shape
 * is counted in `malformed`, and everything else is checked by verify.ts.
 */
export function parseItems(raw: unknown): { items: RawItem[]; malformed: number } | null {
  const reply = replySchema.safeParse(raw);
  if (!reply.success) return null;
  const items: RawItem[] = [];
  let malformed = 0;
  for (const entry of reply.data.items) {
    const parsed = itemSchema.safeParse(entry);
    if (!parsed.success) {
      malformed++;
      continue;
    }
    const p = parsed.data;
    items.push({
      speech: p.speech,
      kind: p.kind,
      claimType: p.kind === 'specific_claim' ? (p.claim_type ?? null) : null,
      quote: p.quote,
      targetSpeech: p.target_speech,
      targetQuote: p.target_quote,
      addressee: p.addressee,
      due: p.due,
    });
  }
  return { items, malformed };
}
