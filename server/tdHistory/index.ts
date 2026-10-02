/**
 * TD history (docs/plans/td-history.md): a background for each TD copied word for word from one
 * Wikipedia revision. Per TD:
 *   find the revision (≥ 72 h old) → skip if unchanged → its HTML → source text (risky sections
 *   cut) → summary (the lead's first sentences, no model) → the model CHOOSES passages → verify
 *   (each passage must be in the source) → save.
 * Every failure writes nothing and is reported (R4).
 */
import type { CompleteJson } from '../voting/service';
import { choosePassages } from './choose';
import { saveHistory, type HistoryRow, type HistoryTd } from './repository';
import { htmlToSource, leadSummary } from './source';
import { emptyRejects, verifyPassages, type PassageReject } from './verify';
import { findRevision, revisionHtml, revisionUrl } from './wikipedia';

export { deleteHistory, historyCandidates, storedRevisions } from './repository';
export { fetchSitelinks } from '../parliament/sources/wikidata';

export type Outcome =
  | { kind: 'saved'; passages: number; rejected: Record<PassageReject, number>; row: HistoryRow }
  | { kind: 'unchanged' | 'missing' | 'disambiguation' | 'no_summary' | 'model_failed' };

export interface ResearchDeps {
  complete: CompleteJson;
  /** The model name recorded on the row. */
  model: string | null;
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
  now?: Date;
  /** The revision already stored for this TD; equal means skip. */
  storedRevision?: number;
  force?: boolean;
  /** Write nothing; still return what would be saved. */
  dryRun?: boolean;
  /** Called between the two Wikipedia requests, to keep to 1 request a second. */
  pause?: () => Promise<void>;
}

export async function researchTd(td: HistoryTd, title: string, deps: ResearchDeps): Promise<Outcome> {
  const now = deps.now ?? new Date();
  const fetcher = deps.fetcher ?? fetch;
  const revision = await findRevision(title, now, fetcher);
  if (revision === 'missing' || revision === 'disambiguation') return { kind: revision };
  if (!deps.force && deps.storedRevision === revision.revisionId) return { kind: 'unchanged' };

  await deps.pause?.();
  const source = htmlToSource(await revisionHtml(revision.revisionId, fetcher));
  const summary = leadSummary(source.lead);
  if (!summary) return { kind: 'no_summary' };

  const chosen = await choosePassages(td.name, source.text, deps.complete);
  if (chosen === null) return { kind: 'model_failed' };
  const { accepted, rejected } = verifyPassages(source.text, summary, chosen);

  const row: HistoryRow = {
    tdId: td.id,
    summary,
    passages: accepted,
    sourceUrl: revisionUrl(revision.revisionId),
    sourceTitle: revision.title,
    sourceRevision: revision.revisionId,
    retrievedAt: now,
    model: deps.model,
  };
  if (!deps.dryRun) await saveHistory(row);
  return { kind: 'saved', passages: accepted.length, rejected, row };
}

export { emptyRejects, type PassageReject };
