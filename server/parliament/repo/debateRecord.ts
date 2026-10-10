/**
 * The debate record (Steps 4–5 of docs/plans/debate-analysis.md): points per member per debate,
 * rebuilt from the stored items by the published rules (../debateItems/rules.ts), and the reads
 * the TD profile and the Dáil record page show. No model calls anywhere in this file.
 */
import { sql } from 'drizzle-orm';
import { debateParticipation, type NewDebateParticipation } from '@shared/schema/parliament';
import type { DebateItemView, DebateRecordParticipant, DebateRecordView, TdDebateRecord } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import { EXTRACTOR_VERSION } from '../debateItems/prompt';
import { namesTarget } from '../debateItems/replies';
import { MIN_DEBATES, RULES_VERSION, SHOWN_KINDS, replyNoPoints, scoreDebates, termFigure, type DebateRole, type Participant, type ScoredItem } from '../debateItems/rules';
import type { GovernmentOffices } from '../debateItems/verify';
import { holdsGovernmentOffice, isGovernmentSide } from '../governmentSide';
import { INDEPENDENT } from '../metrics';
import { governmentOffices } from './debateItems';
import { chunks } from './util';

/** "Paschal-Donohoe.D.2011-03-09" → "Paschal Donohoe", for a member not in tds. */
const nameFromCode = (code: string) => code.split('.')[0]!.replace(/-/g, ' ');

interface ItemRow {
  debate_id: string;
  speech_id: string;
  member_code: string;
  kind: string;
  claim_type: string | null;
  quote: string;
  addressee: string | null;
  due: string | null;
  date: string;
  speaker_name: string | null;
  speaker_party: string | null;
  target_member: string | null;
  target_name: string | null;
  target_party: string | null;
  target_role: string | null;
  quote_start: number;
  quote_end: number;
  /** A reply only: its speech's text, to check that it names its target. */
  speech_text: string | null;
  /** A reply only: whether it is in the debate's last member speech. */
  closing: boolean | null;
}

/** Items of the current extractor version in debates whose run finished, filtered by `where`. */
async function itemRows(where: ReturnType<typeof sql>, database: Db): Promise<ItemRow[]> {
  const res = await database.execute(sql`
    select s.debate_id, i.speech_id, i.member_code, i.kind, i.claim_type, i.quote, i.addressee, i.due, p.date::text date,
           t1.name speaker_name, t1.party speaker_party, tp.member_code target_member, t2.name target_name, t2.party target_party,
           tp.role target_role, i.quote_start, i.quote_end,
           case when i.kind = 'response' then p.text end speech_text,
           case when i.kind = 'response' then i.speech_id = (
             select p2.id from politics.debate_speeches p2 join politics.debate_sections s2 on s2.id = p2.section_id
             where s2.debate_id = s.debate_id and not p2.is_presiding and p2.member_code is not null
             order by s2.date desc, coalesce(substring(s2.id from 'dbsect_([0-9]+)$')::int, 0) desc, p2.position desc limit 1
           ) end closing
    from politics.debate_items i
    join politics.debate_speeches p on p.id = i.speech_id
    join politics.debate_sections s on s.id = p.section_id
    join politics.debate_extraction_runs r on r.debate_id = s.debate_id and r.extractor_version = i.extractor_version and r.status = 'done'
    left join politics.debate_speeches tp on tp.id = i.target_speech_id
    left join politics.tds t1 on t1.member_code = i.member_code
    left join politics.tds t2 on t2.member_code = tp.member_code
    where i.extractor_version = ${EXTRACTOR_VERSION} and ${where}
    order by p.date, s.id, p.position, i.quote_start`);
  return res.rows as unknown as ItemRow[];
}

const crosses = (r: ItemRow, offices: GovernmentOffices) =>
  r.target_member !== null &&
  isGovernmentSide(r.speaker_party, r.member_code, r.date, offices) !== isGovernmentSide(r.target_party, r.target_member, r.date, offices);

/** What the rules need to know about a reply. Every field is false for any other kind. */
function replyFacts(r: ItemRow): Pick<ScoredItem, 'namesTarget' | 'sameParty' | 'closingSpeech'> {
  if (r.kind !== 'response' || r.target_member === null || r.speech_text === null) return { namesTarget: false, sameParty: false, closingSpeech: false };
  return {
    namesTarget: namesTarget({
      speechText: r.speech_text,
      quoteStart: r.quote_start,
      quoteEnd: r.quote_end,
      targetName: r.target_name ?? nameFromCode(r.target_member),
      targetRole: r.target_role,
    }),
    sameParty: r.speaker_party !== null && r.speaker_party === r.target_party && r.speaker_party !== INDEPENDENT,
    closingSpeech: r.closing === true,
  };
}

/** An item as readers see it; null for a reply the rules do not show. */
function view(r: ItemRow, offices: GovernmentOffices): DebateItemView | null {
  const reply = replyFacts(r);
  if (r.kind === 'response' && (!reply.namesTarget || r.target_member === r.member_code)) return null;
  return {
    kind: r.kind as DebateItemView['kind'],
    claimType: (r.claim_type as DebateItemView['claimType']) ?? null,
    quote: r.quote,
    speaker: r.speaker_name ?? nameFromCode(r.member_code),
    to: r.target_member ? (r.target_name ?? nameFromCode(r.target_member)) : null,
    crossesHouse: r.kind === 'concession' && crosses(r, offices),
    replyNoPoints: r.kind === 'response' ? replyNoPoints(reply) : null,
    addressee: r.addressee,
    due: r.due,
  };
}

const views = (rows: ItemRow[], offices: GovernmentOffices) => rows.map((r) => view(r, offices)).filter((v): v is DebateItemView => v !== null);

/**
 * Rebuild every row of debate_participation from the stored items, in one transaction. Only
 * debates whose run for the current extractor version finished are included: a debate not read
 * yet has no row, rather than a row of zeros.
 */
export async function rebuildDebateRecord(database: Db = db): Promise<{ debates: number; rows: number }> {
  const offices = await governmentOffices(database);
  const res = await database.execute(sql`
    select s.debate_id, p.member_code, max(t.id) td_id, d.first_date::text first_date, count(*)::int speeches, sum(p.word_count)::int words
    from politics.debate_extraction_runs r
    join politics.debates d on d.id = r.debate_id
    join politics.debate_sections s on s.debate_id = d.id
    join politics.debate_speeches p on p.section_id = s.id and not p.is_presiding and p.member_code is not null
    left join politics.tds t on t.member_code = p.member_code
    where r.extractor_version = ${EXTRACTOR_VERSION} and r.status = 'done'
    group by s.debate_id, p.member_code, d.first_date`);
  const participants: Participant[] = (res.rows as Array<{ debate_id: string; member_code: string; td_id: number | null; first_date: string; speeches: number; words: number }>).map(
    (r) => ({
      debateId: r.debate_id,
      memberCode: r.member_code,
      tdId: r.td_id === null ? null : Number(r.td_id),
      role: (holdsGovernmentOffice(offices, r.member_code, r.first_date) ? 'office' : 'backbench') as DebateRole,
      speeches: Number(r.speeches),
      words: Number(r.words),
    }),
  );
  const items: ScoredItem[] = (await itemRows(sql`true`, database)).map((r) => ({
    debateId: r.debate_id,
    speechId: r.speech_id,
    memberCode: r.member_code,
    kind: r.kind as ScoredItem['kind'],
    targetMemberCode: r.target_member,
    crossesHouse: crosses(r, offices),
    ...replyFacts(r),
  }));
  const rows: NewDebateParticipation[] = scoreDebates(participants, items).map((r) => ({ ...r, rulesVersion: RULES_VERSION }));
  await database.transaction(async (tx) => {
    await tx.delete(debateParticipation);
    for (const batch of chunks(rows)) await tx.insert(debateParticipation).values(batch);
  });
  return { debates: new Set(rows.map((r) => r.debateId)).size, rows: rows.length };
}

const shownKinds = sql.raw(SHOWN_KINDS.map((k) => `'${k}'`).join(', '));

/** One debate's record: every member who spoke, most points first, with what they said. */
export async function debateRecord(debateId: string, database: Db = db): Promise<DebateRecordView | null> {
  const head = await database.execute(sql`select id, title, kind, first_date::text first_date, last_date::text last_date from politics.debates where id = ${debateId}`);
  const debate = head.rows[0] as { id: string; title: string; kind: string; first_date: string; last_date: string } | undefined;
  if (!debate) return null;
  const parts = await database.execute(sql`
    select dp.*, t.name, t.party from politics.debate_participation dp left join politics.tds t on t.member_code = dp.member_code
    where dp.debate_id = ${debateId} order by dp.points desc, dp.words desc, dp.member_code`);
  if (parts.rows.length === 0) return null;
  const offices = await governmentOffices(database);
  const items = await itemRows(sql`s.debate_id = ${debateId} and i.kind in (${shownKinds})`, database);
  const participants: DebateRecordParticipant[] = (parts.rows as Array<Record<string, unknown>>).map((r) => ({
    memberCode: r.member_code as string,
    tdId: (r.td_id as number | null) ?? null,
    name: (r.name as string | null) ?? nameFromCode(r.member_code as string),
    party: (r.party as string | null) ?? null,
    role: r.role as DebateRole,
    speeches: Number(r.speeches),
    words: Number(r.words),
    claims: Number(r.claims),
    claimPoints: Number(r.claim_points),
    concessionsReceived: Number(r.concessions_received),
    concessionPoints: Number(r.concession_points),
    replies: Number(r.replies),
    takenUp: Number(r.taken_up),
    takenUpPoints: Number(r.taken_up_points),
    questions: Number(r.questions),
    commitments: Number(r.commitments),
    points: Number(r.points),
    items: views(items.filter((i) => i.member_code === r.member_code), offices),
  }));
  return { debateId, title: debate.title, kind: debate.kind, firstDate: debate.first_date, lastDate: debate.last_date, rulesVersion: RULES_VERSION, participants };
}

/** How many recent debates the TD profile lists. */
const RECENT_DEBATES = 10;

/** A TD's record over the term, against TDs in the same role; NULL when they took part in no debate read yet. */
export async function tdDebateRecord(tdId: number, database: Db = db): Promise<TdDebateRecord | null> {
  const td = (await database.execute(sql`select member_code from politics.tds where id = ${tdId}`)).rows[0] as { member_code: string | null } | undefined;
  if (!td?.member_code) return null;
  const code = td.member_code;
  const [mineRes, everyoneRes, recentRes] = await Promise.all([
    database.execute(sql`
      select role, count(*)::int debates, sum(points)::int points, sum(claims)::int claims, sum(claim_points)::int claim_points,
             sum(concessions_received)::int concessions_received, sum(concession_points)::int concession_points,
             sum(replies)::int replies, sum(taken_up)::int taken_up, sum(taken_up_points)::int taken_up_points,
             sum(questions)::int questions, sum(commitments)::int commitments
      from politics.debate_participation where member_code = ${code} group by role`),
    database.execute(sql`select member_code, role, count(*)::int debates, sum(points)::int points from politics.debate_participation group by 1, 2`),
    database.execute(sql`
      select dp.debate_id, d.title, d.kind, d.last_date::text date, dp.points from politics.debate_participation dp join politics.debates d on d.id = dp.debate_id
      where dp.member_code = ${code} order by d.last_date desc, d.id desc limit ${RECENT_DEBATES}`),
  ]);
  const mine = mineRes.rows as Array<Record<string, number | string>>;
  const figure = termFigure(
    mine.map((r) => ({ role: r.role as DebateRole, debates: Number(r.debates), points: Number(r.points) })),
    (everyoneRes.rows as Array<{ member_code: string; role: DebateRole; debates: number; points: number }>).map((r) => ({
      memberCode: r.member_code,
      role: r.role,
      debates: Number(r.debates),
      points: Number(r.points),
    })),
  );
  if (!figure) return null;
  const sum = (field: string) => mine.reduce((n, r) => n + Number(r[field]), 0);

  const recent = recentRes.rows as Array<{ debate_id: string; title: string; kind: string; date: string; points: number }>;
  const offices = await governmentOffices(database);
  const ids = recent.map((r) => r.debate_id);
  const items = ids.length
    ? await itemRows(
        sql`s.debate_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) and i.kind in (${shownKinds}) and (i.member_code = ${code} or (i.kind in ('concession', 'response') and tp.member_code = ${code}))`,
        database,
      )
    : [];
  return {
    rulesVersion: RULES_VERSION,
    role: figure.figure.role,
    debates: figure.figure.debates,
    points: figure.figure.points,
    pointsPerDebate: figure.figure.pointsPerDebate === null ? null : Math.round(figure.figure.pointsPerDebate * 10) / 10,
    cohortP75: figure.cohortP75 === null ? null : Math.round(figure.cohortP75 * 10) / 10,
    cohortSize: figure.cohortSize,
    minDebates: MIN_DEBATES,
    totals: {
      claims: sum('claims'),
      claimPoints: sum('claim_points'),
      concessionsReceived: sum('concessions_received'),
      concessionPoints: sum('concession_points'),
      replies: sum('replies'),
      takenUp: sum('taken_up'),
      takenUpPoints: sum('taken_up_points'),
      questions: sum('questions'),
      commitments: sum('commitments'),
    },
    recent: recent.map((r) => ({
      debateId: r.debate_id,
      title: r.title,
      kind: r.kind,
      date: r.date,
      points: Number(r.points),
      items: views(items.filter((i) => i.debate_id === r.debate_id && i.member_code === code), offices),
      toThem: views(items.filter((i) => i.debate_id === r.debate_id && i.member_code !== code && i.target_member === code && (i.kind === 'concession' || i.kind === 'response')), offices),
    })),
  };
}
