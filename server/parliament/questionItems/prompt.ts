/**
 * Q2 of docs/plans/question-sessions.md: what the model lists in one question exchange. It judges
 * nothing, and never whether a question was answered; verify.ts checks every quote as for debates.
 */
import type { DebateItemKind } from '@shared/schema/parliament';
import { KIND_DEFINITIONS, QUOTE_RULE, speechBlock } from '../debateItems/prompt';
import type { DebateWindow } from '../debateItems/windows';

/**
 * Its own version, never EXTRACTOR_VERSION: the debate record reads only debate versions, so a
 * question read can never empty it. Bump when this prompt, the kinds or the checks change.
 */
// q1 (2026-10-10): the first question-session extractor.
export const QUESTION_EXTRACTOR_VERSION = 'q1';
/** Replies and concessions are left out: in a two-person exchange every turn is a reply. */
export const QUESTION_KINDS = ['specific_claim', 'question', 'commitment'] as const satisfies readonly DebateItemKind[];

// q1 pilot (100 exchanges, 2026-10-10): with only action/follow_up, about half the "actions" were
// general undertakings ("I will work as hard as possible", "we will continue to progress it"). The
// blind check then found a refusal and an offer to circulate figures read as actions.
const COMMITMENT = `- "commitment": a minister says that they, their Department or the Government WILL do something
  ("I will publish ...", "we will bring forward ...", "I will come back to the Deputy ..."). Not a description of what
  an existing plan already contains. Give "due" if a time is stated, else null, and "commitment_type", one of:
  "action": a SPECIFIC thing someone could later check was done: a named document published, a named law changed,
    a stated sum or number funded or provided, something built or opened, a decision or proposal brought to a named
    body, by a stated time or not ("we are going to amend the Guardianship of Infants Act", "it will go to the
    committee in June", "there will be no reduction in SNA numbers next year");
  "follow_up": the minister or a body will only reply, write, revert, meet or speak with someone, pass on
    information, ask someone, analyse or look into it ("I will revert to the Deputy", "I am happy to meet them",
    "I propose to circulate a tabular statement with the Official Report");
  "general": an undertaking with nothing specific to check ("I will work as hard as possible", "we will continue to
    progress it", "we are committed to ...", "we will do everything we can").
  A statement that something will NOT be done ("I do not intend to publish the drafts") is not a commitment.`;

export function questionPrompt(title: string, window: DebateWindow): string {
  return `
List the items in this exchange of Dáil question time, titled "${title}": a member asks, and a minister answers.

Item kinds:
${KIND_DEFINITIONS.specific_claim}
${KIND_DEFINITIONS.question}
${COMMITMENT}

Rules:
- ${QUOTE_RULE}
- Do not rate, praise or criticise anyone, and do not decide whether a question was answered. An empty list is a normal answer.

Return strict JSON:
{ "items": [ { "speech": "s2", "kind": "commitment", "claim_type": null, "quote": "exact words", "target_speech": null, "target_quote": null, "addressee": null, "due": null, "commitment_type": "action" } ] }

Speeches:
${window.speeches.map((s) => speechBlock(s, 'extract')).join('\n\n')}
`.trim();
}
