/**
 * Q4 of docs/plans/question-sessions.md: the published rules that turn checked question-session
 * items into points. Pure. Code gives every point; the model only found and quoted the items.
 *
 * Rules q1 (2026-10-10):
 *   an `action` commitment made in      +2 for each asker of the exchange, once per exchange, only
 *   reply to your question              when the asker is on the other side of the House: a
 *                                       government backbencher's question answered with an
 *                                       announcement is not a commitment secured from the government
 *   a `follow_up` (a reply, a letter,   shown, no points
 *   a meeting) or a `general`
 *   undertaking ("we will continue")
 *   claims and commitments in a         shown for office holders, never scored or ranked
 *   minister's answers
 *
 * A TD's figure is per format and never pooled: exchanges that secured a commitment per 10 asked,
 * for oral PQs and Topical Issues only, against the 75th percentile of backbenchers with at least
 * MIN_EXCHANGES of that format. Leaders' Questions (party leaders only) and rapid sessions are shown.
 */
import type { CommitmentType, DebateItemKind, QuestionFormat } from '@shared/schema/parliament';
import { percentile } from '../metrics';

export const QUESTION_RULES_VERSION = 'q1';
export const SECURED_POINTS = 2;
export const MIN_EXCHANGES = 10;
export const COHORT_PERCENTILE = 0.75;
/** The formats a term figure is given for. */
export const FIGURE_FORMATS: readonly QuestionFormat[] = ['oral_pq', 'topical_issue'];

export interface ExchangeMember {
  exchangeId: string;
  format: QuestionFormat;
  memberCode: string;
  tdId: number | null;
  /** Held government office on the exchange's day. */
  inOffice: boolean;
  /** On the government side that day (governmentSide.ts). */
  governmentSide: boolean;
  asked: boolean;
  /** Spoke in the exchange (an asker of a grouped question may not have). */
  spoke: boolean;
}

export interface ExchangeItem {
  exchangeId: string;
  memberCode: string;
  kind: DebateItemKind;
  commitmentType: CommitmentType | null;
}

export interface QuestionParticipationRow extends ExchangeMember {
  secured: number;
  followUps: number;
  answered: boolean;
  answerClaims: number;
  answerCommitments: number;
  points: number;
}

export function scoreExchanges(members: ExchangeMember[], items: ExchangeItem[]): QuestionParticipationRow[] {
  const byExchange = new Map<string, ExchangeItem[]>();
  for (const i of items) byExchange.set(i.exchangeId, [...(byExchange.get(i.exchangeId) ?? []), i]);
  const office = new Set(members.filter((m) => m.inOffice).map((m) => `${m.exchangeId}\u0000${m.memberCode}`));
  const byOffice = (i: ExchangeItem) => office.has(`${i.exchangeId}\u0000${i.memberCode}`);

  return members.map((m) => {
    const here = byExchange.get(m.exchangeId) ?? [];
    // Only an office holder's commitment is one the government made.
    const actions = here.filter((i) => i.kind === 'commitment' && i.commitmentType === 'action' && byOffice(i));
    const followUps = here.filter((i) => i.kind === 'commitment' && i.commitmentType === 'follow_up' && byOffice(i));
    const asker = m.asked && !m.inOffice;
    const answered = m.inOffice && m.spoke;
    const mine = here.filter((i) => i.memberCode === m.memberCode);
    const secured = asker ? actions.length : 0;
    return {
      ...m,
      secured,
      followUps: asker ? followUps.length : 0,
      answered,
      answerClaims: answered ? mine.filter((i) => i.kind === 'specific_claim').length : 0,
      answerCommitments: answered ? mine.filter((i) => i.kind === 'commitment' && i.commitmentType === 'action').length : 0,
      points: secured > 0 && !m.governmentSide ? SECURED_POINTS : 0,
    };
  });
}

export interface FormatFigure {
  format: QuestionFormat;
  asked: number;
  /** Exchanges that secured at least one `action` commitment. */
  securedExchanges: number;
  points: number;
  followUps: number;
  /** Secured exchanges per 10 asked; null below MIN_EXCHANGES or outside FIGURE_FORMATS. */
  perTen: number | null;
  cohortP75: number | null;
  cohortSize: number;
}

/** A backbencher's figures per format, each against backbenchers with at least MIN_EXCHANGES of it. */
export function formatFigures(mine: QuestionParticipationRow[], everyone: QuestionParticipationRow[]): FormatFigure[] {
  const askedRows = (rows: QuestionParticipationRow[]) => rows.filter((r) => r.asked && !r.inOffice);
  const rate = (rows: QuestionParticipationRow[]) => (10 * rows.filter((r) => r.secured > 0).length) / rows.length;
  const formats = Array.from(new Set(askedRows(mine).map((r) => r.format)));
  return formats.map((format) => {
    const rows = askedRows(mine).filter((r) => r.format === format);
    const scored = FIGURE_FORMATS.includes(format);
    const byMember = new Map<string, QuestionParticipationRow[]>();
    for (const r of askedRows(everyone).filter((x) => x.format === format)) byMember.set(r.memberCode, [...(byMember.get(r.memberCode) ?? []), r]);
    const cohort = Array.from(byMember.values()).filter((xs) => xs.length >= MIN_EXCHANGES).map(rate);
    return {
      format,
      asked: rows.length,
      securedExchanges: rows.filter((r) => r.secured > 0).length,
      points: rows.reduce((n, r) => n + r.points, 0),
      followUps: rows.reduce((n, r) => n + r.followUps, 0),
      perTen: scored && rows.length >= MIN_EXCHANGES ? Math.round(rate(rows) * 10) / 10 : null,
      cohortP75: scored && cohort.length > 0 ? Math.round(percentile(cohort, COHORT_PERCENTILE) * 10) / 10 : null,
      cohortSize: scored ? cohort.length : 0,
    };
  });
}
