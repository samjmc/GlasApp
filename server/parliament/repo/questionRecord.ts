/**
 * The question record (docs/plans/question-sessions.md): question sessions cut into exchanges,
 * the exchanges the extractor reads, and the record built from what ministers committed to in
 * them. Every rebuild here is derived from stored data, with no model calls.
 */
import { sql } from 'drizzle-orm';
import { questionExchanges, questionParticipation, type QuestionFormat } from '@shared/schema/parliament';
import type { QuestionCommitmentView, QuestionRecordView, TdQuestionRecord } from '@shared/parliamentApi';
import { db, type Db } from '../../db';
import type { DebateSpeech } from '../debateItems/windows';
import { holdsGovernmentOffice, isGovernmentSide } from '../governmentSide';
import { splitExchanges, type SectionTurn } from '../questionItems/exchanges';
import { QUESTION_EXTRACTOR_VERSION } from '../questionItems/prompt';
import { QUESTION_RULES_VERSION, formatFigures, scoreExchanges, type CohortMember, type ExchangeItem, type ExchangeMember, type QuestionParticipationRow } from '../questionItems/rules';
import { governmentOffices } from './debateItems';
import { RECORD_REBUILD_LOCK, chunks, nameFromCode, type Reader } from './util';

const FORMAT_OF_KIND: Record<string, QuestionFormat | null> = { topical_issue: 'topical_issue', leaders_questions: 'leaders_questions', questions: null };

/** Cut every question-session section into exchanges, replacing the table (Q1). */
export async function rebuildQuestionExchanges(database: Db = db): Promise<{ sections: number; exchanges: number }> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${RECORD_REBUILD_LOCK}::bigint)`);
    const speechRes = await tx.execute(sql`
      select s.id section_id, s.date::text date, d.kind, p.position, p.member_code, p.is_presiding, p.word_count
      from politics.debate_sections s
      join politics.debates d on d.id = s.debate_id
      join politics.debate_speeches p on p.section_id = s.id
      where d.kind in ('questions', 'topical_issue', 'leaders_questions')
      order by s.id, p.position`);
    const askerRes = await tx.execute(sql`select section_id, member_code from politics.question_askers order by section_id, question_number`);
    const offices = await governmentOffices(tx);
    const askers = new Map<string, string[]>();
    for (const r of askerRes.rows as Array<{ section_id: string; member_code: string }>) askers.set(r.section_id, [...(askers.get(r.section_id) ?? []), r.member_code]);
    const sections = new Map<string, { date: string; kind: string; turns: SectionTurn[] }>();
    for (const r of speechRes.rows as Array<{ section_id: string; date: string; kind: string; position: number; member_code: string | null; is_presiding: boolean; word_count: number }>) {
      const s = sections.get(r.section_id) ?? { date: r.date, kind: r.kind, turns: [] };
      s.turns.push({
        position: Number(r.position),
        memberCode: r.member_code,
        isPresiding: r.is_presiding,
        inOffice: r.member_code !== null && holdsGovernmentOffice(offices, r.member_code, r.date),
        words: Number(r.word_count),
      });
      sections.set(r.section_id, s);
    }
    const rows = Array.from(sections.entries()).flatMap(([sectionId, s]) => {
      const pqAskers = askers.get(sectionId) ?? [];
      // An oral PQ section is known by its askers in /questions; the rest of `questions` is rapid.
      const format = FORMAT_OF_KIND[s.kind] ?? (pqAskers.length > 0 ? 'oral_pq' : 'rapid');
      return splitExchanges({ sectionId, format, date: s.date, turns: s.turns, pqAskers });
    });
    // Ids are positional, so a q1 read stands only while its exchange keeps the same span and
    // askers. Any other exchange is read again, and until then its items count for nothing.
    const before = await tx.execute(sql`select id, from_position, to_position, askers from politics.question_exchanges`);
    const span = (from: number, to: number, askers: string[]) => JSON.stringify([from, to, askers]);
    const old = new Map((before.rows as Array<{ id: string; from_position: number; to_position: number; askers: string[] }>).map((r) => [r.id, span(r.from_position, r.to_position, r.askers)]));
    const unchanged = rows.filter((x) => old.get(x.id) === span(x.fromPosition, x.toPosition, x.askers)).map((x) => x.id);
    await tx.delete(questionExchanges);
    for (const batch of chunks(rows)) await tx.insert(questionExchanges).values(batch);
    await tx.execute(sql`delete from politics.debate_extraction_runs where extractor_version = ${QUESTION_EXTRACTOR_VERSION} and debate_id <> all(${sql.param(unchanged)}::text[])`);
    return { sections: sections.size, exchanges: rows.length };
  });
}

export interface QuestionUnit {
  id: string;
  /** The format, logged as the unit's kind. */
  kind: string;
  format: QuestionFormat;
  title: string;
  /** Members' words in the exchange: `--limit` compares it with the read's, and it projects the cost. */
  words: number;
}

/** Every exchange, oldest first: what the question extractor reads. */
export async function questionUnits(database: Db = db): Promise<QuestionUnit[]> {
  const res = await database.execute(sql`
    select e.id, e.format, case when coalesce(s.parent_title, '') = '' then s.title else s.parent_title || ': ' || s.title end title,
           coalesce(sum(p.word_count), 0)::int words
    from politics.question_exchanges e
    join politics.debate_sections s on s.id = e.section_id
    left join politics.debate_speeches p on p.section_id = e.section_id and p.position between e.from_position and e.to_position
      and not p.is_presiding and p.member_code is not null
    group by e.id, e.format, e.date, s.title, s.parent_title
    order by e.date, e.id`);
  return (res.rows as Array<{ id: string; format: QuestionFormat; title: string; words: number }>).map((r) => ({ id: r.id, kind: r.format, format: r.format, title: r.title, words: Number(r.words) }));
}

/** One exchange's member speeches in record order, chair excluded, named as debateSpeechesOf names them. */
export async function exchangeSpeechesOf(exchangeId: string, database: Db = db): Promise<DebateSpeech[]> {
  const res = await database.execute(sql`
    select p.id, p.member_code, p.role, p.text, p.word_count, p.date::text date, t.name
    from politics.question_exchanges e
    join politics.debate_speeches p on p.section_id = e.section_id and p.position between e.from_position and e.to_position
    left join politics.tds t on t.member_code = p.member_code
    where e.id = ${exchangeId} and not p.is_presiding and p.member_code is not null
    order by p.position`);
  return (res.rows as Array<{ id: string; member_code: string; role: string | null; text: string; word_count: number; date: string; name: string | null }>).map((r) => {
    const name = r.name ?? nameFromCode(r.member_code);
    return { id: r.id, memberCode: r.member_code, speaker: r.role ? `${name} (${r.role})` : name, date: r.date, text: r.text, wordCount: Number(r.word_count) };
  });
}

/** Exchanges whose q1 read finished: (exchange, format, date, askers, section). */
const readExchanges = sql`(
  select e.* from politics.question_exchanges e
  join politics.debate_extraction_runs r on r.debate_id = e.id and r.extractor_version = ${QUESTION_EXTRACTOR_VERSION} and r.status = 'done'
)`;

/** Members and items of the read exchanges, filtered by `where` on the exchange `e`. */
async function exchangeData(where: ReturnType<typeof sql>, database: Reader): Promise<{ members: ExchangeMember[]; items: Array<ExchangeItem & { quote: string; due: string | null; date: string }> }> {
  const [memberRes, itemRes, tdRes, offices] = await Promise.all([
    database.execute(sql`
      select x.exchange_id, x.format, x.date, x.askers, coalesce(jsonb_object_agg(x.member_code, x.words) filter (where x.member_code is not null), '{}') words
      from (
        select e.id exchange_id, e.format, e.date::text date, e.askers, p.member_code, sum(p.word_count)::int words
        from ${readExchanges} e
        left join politics.debate_speeches p on p.section_id = e.section_id and p.position between e.from_position and e.to_position
          and not p.is_presiding and p.member_code is not null
        where ${where}
        group by e.id, e.format, e.date, e.askers, p.member_code
      ) x
      group by x.exchange_id, x.format, x.date, x.askers`),
    database.execute(sql`
      select e.id exchange_id, e.date::text date, i.member_code, i.kind, i.commitment_type, i.quote, i.due
      from ${readExchanges} e
      join politics.debate_speeches p on p.section_id = e.section_id and p.position between e.from_position and e.to_position
      join politics.debate_items i on i.speech_id = p.id and i.extractor_version = ${QUESTION_EXTRACTOR_VERSION}
      where ${where}
      order by e.id, p.position, i.quote_start`),
    database.execute(sql`select id, member_code, party from politics.tds where member_code is not null`),
    governmentOffices(database),
  ]);
  const tds = new Map((tdRes.rows as Array<{ id: number; member_code: string; party: string | null }>).map((r) => [r.member_code, r]));
  const members: ExchangeMember[] = [];
  for (const r of memberRes.rows as Array<{ exchange_id: string; format: QuestionFormat; date: string; askers: string[]; words: Record<string, number> }>) {
    for (const code of Array.from(new Set([...r.askers, ...Object.keys(r.words)]))) {
      const td = tds.get(code);
      members.push({
        exchangeId: r.exchange_id,
        format: r.format,
        memberCode: code,
        tdId: td?.id ?? null,
        inOffice: holdsGovernmentOffice(offices, code, r.date),
        governmentSide: isGovernmentSide(td?.party ?? null, code, r.date, offices),
        asked: r.askers.includes(code),
        words: r.words[code] ?? 0,
      });
    }
  }
  const items = (itemRes.rows as Array<{ exchange_id: string; date: string; member_code: string; kind: ExchangeItem['kind']; commitment_type: ExchangeItem['commitmentType']; quote: string; due: string | null }>).map((r) => ({
    exchangeId: r.exchange_id,
    memberCode: r.member_code,
    kind: r.kind,
    commitmentType: r.commitment_type,
    quote: r.quote,
    due: r.due,
    date: r.date,
  }));
  return { members, items };
}

/** Rebuild every row of question_participation from the stored q1 items (Q4). */
export async function rebuildQuestionRecord(database: Db = db): Promise<{ rows: number }> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${RECORD_REBUILD_LOCK}::bigint)`);
    const { members, items } = await exchangeData(sql`true`, tx);
    const rows = scoreExchanges(members, items).map((r) => ({
      exchangeId: r.exchangeId,
      memberCode: r.memberCode,
      tdId: r.tdId,
      format: r.format,
      role: (r.inOffice ? 'office' : 'backbench') as 'office' | 'backbench',
      governmentSide: r.governmentSide,
      asked: r.asked,
      secured: r.secured,
      followUps: r.followUps,
      answered: r.answered,
      answerClaims: r.answerClaims,
      answerCommitments: r.answerCommitments,
      points: r.points,
      rulesVersion: QUESTION_RULES_VERSION,
    }));
    await tx.delete(questionParticipation);
    for (const batch of chunks(rows)) await tx.insert(questionParticipation).values(batch);
    return { rows: rows.length };
  });
}

const toRow = (r: Record<string, unknown>): QuestionParticipationRow => ({
  exchangeId: r.exchange_id as string,
  format: r.format as QuestionFormat,
  memberCode: r.member_code as string,
  tdId: (r.td_id as number | null) ?? null,
  inOffice: r.role === 'office',
  governmentSide: r.government_side as boolean,
  asked: r.asked as boolean,
  words: 0, // not stored: `answered` is
  secured: Number(r.secured),
  followUps: Number(r.follow_ups),
  answered: r.answered as boolean,
  answerClaims: Number(r.answer_claims),
  answerCommitments: Number(r.answer_commitments),
  points: Number(r.points),
});

/** How many recent exchanges with a commitment the TD profile lists. */
const RECENT_EXCHANGES = 10;

async function namesOf(codes: string[], database: Db): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const res = await database.execute(sql`select member_code, name from politics.tds where member_code in (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`);
  return new Map((res.rows as Array<{ member_code: string; name: string }>).map((r) => [r.member_code, r.name]));
}

/** A TD's question record; NULL when they neither asked nor answered in an exchange read yet. */
export async function tdQuestionRecord(tdId: number, database: Db = db): Promise<TdQuestionRecord | null> {
  const td = (await database.execute(sql`select member_code from politics.tds where id = ${tdId}`)).rows[0] as { member_code: string | null } | undefined;
  if (!td?.member_code) return null;
  const code = td.member_code;
  const [mineRes, everyoneRes] = await Promise.all([
    database.execute(sql`select * from politics.question_participation where member_code = ${code}`),
    // The cohort as counts per member and format (thousands of rows otherwise, on every view).
    database.execute(sql`
      select format, count(*)::int asked, (count(*) filter (where secured > 0))::int secured
      from politics.question_participation
      where asked and role = 'backbench' and not government_side
      group by member_code, format`),
  ]);
  const mine = (mineRes.rows as Array<Record<string, unknown>>).map(toRow);
  // Nothing to show for a TD who only spoke (a supplementary, an interjection), or asked only
  // while in office: the figures count a backbencher's questions and an office holder's answers.
  if (!mine.some((r) => (r.asked && !r.inOffice) || r.answered)) return null;
  const answered = mine.filter((r) => r.answered);
  // The exchanges they asked where a minister committed to something, newest first.
  const askedIds = mine.filter((r) => r.asked && (r.secured > 0 || r.followUps > 0)).map((r) => r.exchangeId);
  const recentRows = askedIds.length
    ? ((
        await database.execute(sql`
          select e.id, e.date::text date, s.title
          from politics.question_exchanges e
          join politics.debate_sections s on s.id = e.section_id
          where e.id in (${sql.join(askedIds.map((id) => sql`${id}`), sql`, `)})
          order by e.date desc, coalesce(substring(e.section_id from 'dbsect_([0-9]+)$')::int, 0) desc, e.from_position desc
          limit ${RECENT_EXCHANGES}`)
      ).rows as Array<{ id: string; date: string; title: string }>)
    : [];
  const recentIds = recentRows.map((r) => r.id);
  const recent = recentIds.length
    ? await exchangeData(sql`e.id in (${sql.join(recentIds.map((id) => sql`${id}`), sql`, `)})`, database)
    : { members: [], items: [] };
  const names = await namesOf(Array.from(new Set(recent.items.map((i) => i.memberCode))), database);
  const commitmentsOf = (exchangeId: string): QuestionCommitmentView[] => {
    const office = new Set(recent.members.filter((m) => m.exchangeId === exchangeId && m.inOffice).map((m) => m.memberCode));
    return recent.items
      .filter((i) => i.exchangeId === exchangeId && i.kind === 'commitment' && i.commitmentType !== null && office.has(i.memberCode))
      .map((i) => ({ quote: i.quote, minister: names.get(i.memberCode) ?? nameFromCode(i.memberCode), type: i.commitmentType!, due: i.due }));
  };
  return {
    rulesVersion: QUESTION_RULES_VERSION,
    formats: formatFigures(mine, everyoneRes.rows as unknown as CohortMember[]),
    answers: answered.length
      ? {
          answered: answered.length,
          withClaim: answered.filter((r) => r.answerClaims > 0).length,
          withCommitment: answered.filter((r) => r.answerCommitments > 0).length,
        }
      : null,
    recent: recentRows.map(({ id, date, title }) => {
      const row = mine.find((r) => r.exchangeId === id)!;
      return { exchangeId: id, date, title, format: row.format, points: row.points, commitments: commitmentsOf(id) };
    }),
  };
}

/** One question section's exchanges, with who asked and what ministers committed to; NULL when none was read. */
export async function questionRecord(sectionId: string, database: Db = db): Promise<QuestionRecordView | null> {
  const { members, items } = await exchangeData(sql`e.section_id = ${sectionId}`, database);
  if (members.length === 0) return null;
  const scored = scoreExchanges(members, items);
  const names = await namesOf(Array.from(new Set(members.map((m) => m.memberCode))), database);
  const exchangeIds = Array.from(new Set(members.map((m) => m.exchangeId))).sort((a, b) => Number(a.split('#')[1]) - Number(b.split('#')[1]));
  return {
    sectionId,
    rulesVersion: QUESTION_RULES_VERSION,
    format: members[0]!.format,
    exchanges: exchangeIds.map((id) => {
      const here = scored.filter((r) => r.exchangeId === id);
      const office = new Set(here.filter((r) => r.inOffice).map((r) => r.memberCode));
      return {
        exchangeId: id,
        askers: here.filter((r) => r.asked).map((r) => ({ memberCode: r.memberCode, tdId: r.tdId, name: names.get(r.memberCode) ?? nameFromCode(r.memberCode), points: r.points })),
        commitments: items
          .filter((i) => i.exchangeId === id && i.kind === 'commitment' && i.commitmentType !== null && office.has(i.memberCode))
          .map((i) => ({ quote: i.quote, minister: names.get(i.memberCode) ?? nameFromCode(i.memberCode), type: i.commitmentType!, due: i.due })),
      };
    }),
  };
}
