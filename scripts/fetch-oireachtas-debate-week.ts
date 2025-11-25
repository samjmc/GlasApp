import 'dotenv/config';
import axios from 'axios';
import { load, CheerioAPI, Cheerio, Element } from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';

type ArgMap = Record<string, string>;

interface PersonRef {
  id: string;
  name: string | null;
  uri: string | null;
}

interface RoleRef {
  id: string;
  name: string | null;
  uri: string | null;
}

interface QuestionRecord {
  id: string | null;
  askedBy: PersonRef | null;
  askedTo: PersonRef | RoleRef | null;
  text: string;
}

interface SpeechRecord {
  id: string | null;
  speaker: PersonRef | null;
  role: RoleRef | null;
  recordedTime: string | null;
  speakerLabel: string | null;
  paragraphs: string[];
  wordCount: number;
}

interface SectionMetadata {
  debateType: string | null;
  counts: {
    speechCount?: number;
    speakerCount?: number;
    [key: string]: unknown;
  } | null;
  containsDebate: boolean | null;
  parentId: string | null;
}

interface SectionRecord {
  id: string | null;
  title: string | null;
  debateType: string | null;
  recordedTime: string | null;
  containsDebate: boolean | null;
  question: QuestionRecord | null;
  speeches: SpeechRecord[];
  subsections: SectionRecord[];
  metadata: SectionMetadata | null;
}

interface DebateDayRecord {
  date: string | null;
  contextDate: string | null;
  chamber: string | null;
  house: {
    name: string | null;
    code: string | null;
    number: string | null;
  } | null;
  debateType: string | null;
  counts: Record<string, unknown> | null;
  xmlSource: string | null;
  xmlLocalPath: string | null;
  sections: SectionRecord[];
  stats: DebateStats;
}

interface DebateStats {
  sections: number;
  speeches: number;
  uniqueSpeakerIds: string[];
  wordCount: number;
}

interface AggregatedStats {
  totalDays: number;
  daysWithTranscripts: number;
  sections: number;
  speeches: number;
  uniqueSpeakers: number;
  wordCount: number;
}

const API_BASE_URL = 'https://api.oireachtas.ie/v1';
const SCRIPT_VERSION = '2025-11-07-preview';

export async function fetchDebatesForDateRange(params: {
  startDate: string;
  endDate: string;
  chamber?: string;
  persistToSupabase?: boolean;
}): Promise<{
  debatesProcessed: number;
  sectionsSaved: number;
  speechesSaved: number;
}> {
  const { startDate, endDate, chamber = 'dail', persistToSupabase = true } = params;
  
  const supabaseClient = persistToSupabase ? initializeSupabaseClient() : null;
  const outputDir = path.resolve(path.join('data', 'oireachtas', 'samples'));
  const rawDir = path.join(outputDir, 'raw');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });

  const debateRecords = await fetchDebateRecords({ startDate, endDate, chamber, limit: 50 });

  if (debateRecords.length === 0) {
    return { debatesProcessed: 0, sectionsSaved: 0, speechesSaved: 0 };
  }

  const aggregatedRecords: DebateDayRecord[] = [];
  const speakerAccumulator = new Set<string>();
  let totalSections = 0;
  let totalSpeeches = 0;
  let totalWordCount = 0;
  let daysWithTranscripts = 0;

  for (const [index, record] of debateRecords.entries()) {
    const debateRecord = record?.debateRecord;
    if (!debateRecord) continue;

    const xmlUri: string | null = debateRecord.formats?.xml?.uri ?? null;
    if (!xmlUri) {
      console.warn(`   ⚠️  Missing XML for debate on ${debateRecord.date ?? record.contextDate ?? 'unknown date'}`);
      continue;
    }

    const xml = await fetchXmlDocument(xmlUri);
    if (!xml) {
      console.warn(`   ⚠️  Failed to download XML for ${xmlUri}`);
      continue;
    }

    const slug = buildSlug(record, index);
    const xmlPath = path.join(rawDir, `${slug}.xml`);
    await fs.writeFile(xmlPath, xml, 'utf8');

    const sectionMeta = buildSectionMetaMap(record);
    const parsed = parseDebateXml(xml, sectionMeta);

    aggregatedRecords.push({
      date: debateRecord.date ?? null,
      contextDate: record.contextDate ?? null,
      chamber: debateRecord.chamber?.showAs ?? null,
      house: debateRecord.house
        ? {
            name: debateRecord.house.showAs ?? null,
            code: debateRecord.house.houseCode ?? null,
            number: debateRecord.house.houseNo ?? null
          }
        : null,
      debateType: debateRecord.debateType ?? null,
      counts: debateRecord.counts ?? null,
      xmlSource: xmlUri,
      xmlLocalPath: path.relative(process.cwd(), xmlPath),
      sections: parsed.sections,
      stats: parsed.stats
    });

    const aggregatedRecord = aggregatedRecords[aggregatedRecords.length - 1];

    if (supabaseClient) {
      await persistDebateDayToSupabase(supabaseClient, aggregatedRecord, {
        sourceIndex: index,
        scriptVersion: SCRIPT_VERSION
      });
    }

    totalSections += parsed.stats.sections;
    totalSpeeches += parsed.stats.speeches;
    totalWordCount += parsed.stats.wordCount;

    for (const speakerId of parsed.stats.uniqueSpeakerIds) {
      speakerAccumulator.add(speakerId);
    }

    if (parsed.stats.sections > 0) {
      daysWithTranscripts += 1;
    }

    console.log(
      `   ✅ Parsed ${parsed.stats.sections} section(s), ${parsed.stats.speeches} speech(es), ${parsed.stats.wordCount} words for ${debateRecord.date ?? slug}`
    );
  }

  return {
    debatesProcessed: aggregatedRecords.length,
    sectionsSaved: totalSections,
    speechesSaved: totalSpeeches
  };
}

async function main(): Promise<void> {
  const argMap = parseArgs(process.argv.slice(2));

  const { startDate, endDate } = resolveDateRange(argMap);
  const chamber = argMap.chamber ?? 'dail';
  const limit = Number(argMap.limit ?? 50);
  const outputDir = path.resolve(argMap.output ?? path.join('data', 'oireachtas', 'samples'));
  const rawDir = path.join(outputDir, 'raw');
  const persistSupabase = shouldPersistToSupabase(argMap);
  const supabaseClient = persistSupabase ? initializeSupabaseClient() : null;

  console.log('📅 Fetching Oireachtas debates');
  console.log(`   Chamber: ${chamber}`);
  console.log(`   Date range: ${startDate} → ${endDate}`);
  console.log('');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });

  const debateRecords = await fetchDebateRecords({ startDate, endDate, chamber, limit });

  if (debateRecords.length === 0) {
    console.warn('⚠️  No debates found for the specified range.');
    return;
  }

  console.log(`📦 Found ${debateRecords.length} debate record(s)`);

  const aggregatedRecords: DebateDayRecord[] = [];
  const speakerAccumulator = new Set<string>();
  let totalSections = 0;
  let totalSpeeches = 0;
  let totalWordCount = 0;
  let daysWithTranscripts = 0;

  for (const [index, record] of debateRecords.entries()) {
    const debateRecord = record?.debateRecord;
    if (!debateRecord) {
      continue;
    }

    const xmlUri: string | null = debateRecord.formats?.xml?.uri ?? null;

    if (!xmlUri) {
      console.warn(`   ⚠️  Missing XML for debate on ${debateRecord.date ?? record.contextDate ?? 'unknown date'}`);
      continue;
    }

    const xml = await fetchXmlDocument(xmlUri);

    if (!xml) {
      console.warn(`   ⚠️  Failed to download XML for ${xmlUri}`);
      continue;
    }

    const slug = buildSlug(record, index);
    const xmlPath = path.join(rawDir, `${slug}.xml`);
    await fs.writeFile(xmlPath, xml, 'utf8');

    const sectionMeta = buildSectionMetaMap(record);
    const parsed = parseDebateXml(xml, sectionMeta);

    aggregatedRecords.push({
      date: debateRecord.date ?? null,
      contextDate: record.contextDate ?? null,
      chamber: debateRecord.chamber?.showAs ?? null,
      house: debateRecord.house
        ? {
            name: debateRecord.house.showAs ?? null,
            code: debateRecord.house.houseCode ?? null,
            number: debateRecord.house.houseNo ?? null
          }
        : null,
      debateType: debateRecord.debateType ?? null,
      counts: debateRecord.counts ?? null,
      xmlSource: xmlUri,
      xmlLocalPath: path.relative(process.cwd(), xmlPath),
      sections: parsed.sections,
      stats: parsed.stats
    });

    const aggregatedRecord = aggregatedRecords[aggregatedRecords.length - 1];

    if (supabaseClient) {
      await persistDebateDayToSupabase(supabaseClient, aggregatedRecord, {
        sourceIndex: index,
        scriptVersion: SCRIPT_VERSION
      });
    }

    totalSections += parsed.stats.sections;
    totalSpeeches += parsed.stats.speeches;
    totalWordCount += parsed.stats.wordCount;

    for (const speakerId of parsed.stats.uniqueSpeakerIds) {
      speakerAccumulator.add(speakerId);
    }

    if (parsed.stats.sections > 0) {
      daysWithTranscripts += 1;
    }

    console.log(
      `   ✅ Parsed ${parsed.stats.sections} section(s), ${parsed.stats.speeches} speech(es), ${parsed.stats.wordCount} words for ${debateRecord.date ?? slug}`
    );
  }

  const aggregatedStats: AggregatedStats = {
    totalDays: debateRecords.length,
    daysWithTranscripts,
    sections: totalSections,
    speeches: totalSpeeches,
    uniqueSpeakers: speakerAccumulator.size,
    wordCount: totalWordCount
  };

  const outputPayload = {
    chamber,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    totalRecords: debateRecords.length,
    aggregatedStats,
    debates: aggregatedRecords
  };

  const fileName = `debates_${chamber}_${startDate}_${endDate}.json`;
  const outputPath = path.join(outputDir, fileName);
  await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2), 'utf8');

  console.log('');
  console.log('📄 Output summary');
  console.log(`   File: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`   Debate records: ${aggregatedRecords.length}`);
  console.log(`   Sections parsed: ${totalSections}`);
  console.log(`   Speeches parsed: ${totalSpeeches}`);
  console.log(`   Unique speakers: ${speakerAccumulator.size}`);
  console.log(`   Word count (approx): ${totalWordCount}`);
  console.log('');
  console.log('✅ Sample week fetch complete.');
}

interface DebateFetchParams {
  startDate: string;
  endDate: string;
  chamber: string;
  limit: number;
}

async function fetchDebateRecords(params: DebateFetchParams): Promise<any[]> {
  const { startDate, endDate, chamber, limit } = params;
  const records: any[] = [];
  let skip = 0;

  while (true) {
    const response = await axios.get(`${API_BASE_URL}/debates`, {
      params: {
        date_start: startDate,
        date_end: endDate,
        chamber,
        limit,
        skip
      },
      timeout: 30000,
      headers: {
        'User-Agent': 'GlasPolitics/1.0 (DebateSampler)',
        Accept: 'application/json'
      }
    });

    const headCount = response.data?.head?.counts?.debateCount ?? 0;
    const results: any[] = response.data?.results ?? [];

    records.push(...results);
    skip += results.length;

    if (skip >= headCount || results.length === 0) {
      break;
    }
  }

  return records;
}

async function fetchXmlDocument(uri: string): Promise<string | null> {
  try {
    const response = await axios.get(uri, {
      responseType: 'text',
      timeout: 30000,
      headers: {
        'User-Agent': 'GlasPolitics/1.0 (DebateSampler)',
        Accept: 'application/xml'
      }
    });

    return typeof response.data === 'string' ? response.data : String(response.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ XML download failed: ${message}`);
    return null;
  }
}

function parseDebateXml(xml: string, metaMap: Map<string, SectionMetadata>): {
  sections: SectionRecord[];
  stats: DebateStats;
} {
  const $ = load(xml, { xmlMode: true, decodeEntities: true });
  const references = buildReferences($);
  const topSections: SectionRecord[] = [];

  $('debateBody > debateSection').each((_, element) => {
    topSections.push(parseSection($, $(element), references, metaMap));
  });

  const stats = summariseSections(topSections);

  return {
    sections: topSections,
    stats
  };
}

function parseSection(
  $: CheerioAPI,
  section: Cheerio<Element>,
  refs: References,
  metaMap: Map<string, SectionMetadata>
): SectionRecord {
  const id = section.attr('eId') ?? null;
  const meta = id ? metaMap.get(id) ?? null : null;

  const { title, recordedTime } = extractHeading(section);
  const question = extractQuestion($, section, refs);
  const speeches = extractSpeeches($, section, refs);
  const subsections: SectionRecord[] = [];

  section.children('debateSection').each((_, child) => {
    subsections.push(parseSection($, $(child), refs, metaMap));
  });

  return {
    id,
    title,
    debateType: meta?.debateType ?? null,
    recordedTime,
    containsDebate: meta?.containsDebate ?? null,
    question,
    speeches,
    subsections,
    metadata: meta
  };
}

function extractHeading(section: Cheerio<Element>): { title: string | null; recordedTime: string | null } {
  const heading = section.children('heading').first();
  if (!heading || heading.length === 0) {
    return { title: null, recordedTime: null };
  }

  const clone = heading.clone();
  const recordedTime = clone.find('recordedTime').attr('time') ?? null;
  clone.find('recordedTime').remove();

  const titleText = normaliseWhitespace(clone.text());

  return {
    title: titleText || null,
    recordedTime
  };
}

function extractQuestion(
  $: CheerioAPI,
  section: Cheerio<Element>,
  refs: References
): QuestionRecord | null {
  const question = section.children('question').first();
  if (!question || question.length === 0) {
    return null;
  }

  const id = question.attr('eId') ?? null;
  const askedBy = resolvePerson(refs, question.attr('by'));
  const askedTo = resolveRoleOrPerson(refs, question.attr('to'));

  const paragraphTexts = question
    .find('p')
    .map((_, el) => normaliseWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  return {
    id,
    askedBy,
    askedTo,
    text: paragraphTexts.join('\n\n')
  };
}

function extractSpeeches(
  $: CheerioAPI,
  section: Cheerio<Element>,
  refs: References
): SpeechRecord[] {
  const speeches: SpeechRecord[] = [];

  section.children('speech').each((_, el) => {
    const speech = $(el);
    const paragraphs = speech
      .find('p')
      .map((__, p) => normaliseWhitespace($(p).text()))
      .get()
      .filter(Boolean);

    const wordCount = paragraphs.reduce((count, para) => count + countWords(para), 0);
    const fromNode = speech.children('from').first();
    const speakerLabel = fromNode.length ? normaliseWhitespace(stripRecordedTime(fromNode)) : null;
    const recordedTime = fromNode.find('recordedTime').attr('time') ?? null;

    speeches.push({
      id: speech.attr('eId') ?? null,
      speaker: resolvePerson(refs, speech.attr('by')),
      role: resolveRole(refs, speech.attr('as')),
      recordedTime,
      speakerLabel,
      paragraphs,
      wordCount
    });
  });

  return speeches;
}

function stripRecordedTime(node: Cheerio<Element>): string {
  const clone = node.clone();
  clone.find('recordedTime').remove();
  return clone.text();
}

function summariseSections(sections: SectionRecord[]): DebateStats {
  let sectionCount = 0;
  let speechCount = 0;
  let wordCount = 0;
  const speakerSet = new Set<string>();

  const walk = (section: SectionRecord) => {
    sectionCount += 1;
    for (const speech of section.speeches) {
      speechCount += 1;
      wordCount += speech.wordCount;
      if (speech.speaker?.id) {
        speakerSet.add(speech.speaker.id);
      }
    }
    for (const child of section.subsections) {
      walk(child);
    }
  };

  sections.forEach(walk);

  return {
    sections: sectionCount,
    speeches: speechCount,
    uniqueSpeakerIds: Array.from(speakerSet),
    wordCount
  };
}

interface References {
  persons: Map<string, PersonRef>;
  roles: Map<string, RoleRef>;
}

function buildReferences($: CheerioAPI): References {
  const persons = new Map<string, PersonRef>();
  const roles = new Map<string, RoleRef>();

  $('meta > references > TLCPerson').each((_, el) => {
    const node = $(el);
    const eId = node.attr('eId');
    if (!eId) return;
    const key = normaliseRefKey(eId);
    persons.set(key, {
      id: eId,
      name: node.attr('showAs') ?? null,
      uri: node.attr('href') ?? null
    });
  });

  $('meta > references > TLCRole').each((_, el) => {
    const node = $(el);
    const eId = node.attr('eId');
    if (!eId) return;
    const key = normaliseRefKey(eId);
    roles.set(key, {
      id: eId,
      name: node.attr('showAs') ?? null,
      uri: node.attr('href') ?? null
    });
  });

  return { persons, roles };
}

function buildSectionMetaMap(record: any): Map<string, SectionMetadata> {
  const map = new Map<string, SectionMetadata>();
  const sections: any[] = record?.debateRecord?.debateSections ?? [];

  for (const item of sections) {
    const section = item?.debateSection;
    if (!section?.debateSectionId) continue;
    const id: string = section.debateSectionId;
    map.set(id, {
      debateType: section.debateType ?? null,
      counts: section.counts ?? null,
      containsDebate: typeof section.containsDebate === 'boolean' ? section.containsDebate : null,
      parentId: section.parentDebateSection?.debateSectionId ?? null
    });
  }

  return map;
}

function resolvePerson(refs: References, rawId: string | undefined): PersonRef | null {
  if (!rawId) return null;
  const ref = refs.persons.get(normaliseRefKey(rawId));
  return ref ?? null;
}

function resolveRole(refs: References, rawId: string | undefined): RoleRef | null {
  if (!rawId) return null;
  const ref = refs.roles.get(normaliseRefKey(rawId));
  return ref ?? null;
}

function resolveRoleOrPerson(refs: References, rawId: string | undefined): RoleRef | PersonRef | null {
  if (!rawId) return null;
  const key = normaliseRefKey(rawId);
  return refs.roles.get(key) ?? refs.persons.get(key) ?? null;
}

function normaliseRefKey(value: string): string {
  return value.startsWith('#') ? value : `#${value}`;
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function countWords(value: string): number {
  if (!value) return 0;
  return value.split(/\s+/).filter(Boolean).length;
}

function parseArgs(argv: string[]): ArgMap {
  const result: ArgMap = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const clean = arg.slice(2);
    const [key, explicitValue] = clean.split('=');

    if (explicitValue !== undefined) {
      result[key] = explicitValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = 'true';
    }
  }

  return result;
}

function resolveDateRange(argMap: ArgMap): { startDate: string; endDate: string } {
  const today = new Date();
  const defaultEnd = formatDate(today);

  const startFromArgs = argMap.start ?? argMap.startDate;
  const endFromArgs = argMap.end ?? argMap.endDate;

  let endDate = endFromArgs ?? defaultEnd;

  let startDate: string;

  if (startFromArgs) {
    startDate = startFromArgs;
  } else {
    const start = new Date(endDate);
    if (Number.isNaN(start.getTime())) {
      throw new Error(`Invalid end date provided: ${endDate}`);
    }
    start.setDate(start.getDate() - 6);
    startDate = formatDate(start);
  }

  if (!isValidDate(startDate)) {
    throw new Error(`Invalid start date: ${startDate}`);
  }

  if (!isValidDate(endDate)) {
    throw new Error(`Invalid end date: ${endDate}`);
  }

  if (new Date(startDate) > new Date(endDate)) {
    throw new Error(`Start date ${startDate} cannot be after end date ${endDate}`);
  }

  return { startDate, endDate };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isValidDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function buildSlug(record: any, index: number): string {
  const date = record?.debateRecord?.date ?? record?.contextDate ?? 'unknown-date';
  const houseCode = record?.debateRecord?.house?.houseCode ?? 'unknown';
  const type = record?.debateRecord?.debateType ?? 'debate';
  const base = `${houseCode}_${date}_${type}_${index}`;
  return base.replace(/[^A-Za-z0-9_-]+/g, '-');
}

function shouldPersistToSupabase(argMap: ArgMap): boolean {
  const flag = argMap.supabase ?? argMap.persist;
  if (!flag) return false;
  if (flag === 'false' || flag === '0' || flag.toLowerCase?.() === 'no') return false;
  return true;
}

function initializeSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistence.');
    return null;
  }

  console.log('🔐 Persisting debate data to Supabase...');

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });
}

interface PersistOptions {
  sourceIndex: number;
  scriptVersion: string;
}

interface FlattenedSection {
  id: string;
  sectionCode: string | null;
  parentId: string | null;
  parentSectionCode: string | null;
  path: string;
  title: string | null;
  debateType: string | null;
  recordedTime: string | null;
  containsDebate: boolean | null;
  speechCount: number;
  wordCount: number;
  orderIndex: number;
  metadata: any;
  original: SectionRecord;
  isNew: boolean;
}

async function persistDebateDayToSupabase(
  client: SupabaseClient,
  record: DebateDayRecord,
  options: PersistOptions
): Promise<void> {
  const { sourceIndex, scriptVersion } = options;
  const debateDate = record.date ?? record.contextDate;
  const chamberCode = record.house?.code ?? record.chamber ?? 'unknown';

  if (!debateDate) {
    console.warn('⚠️  Skipping Supabase persistence due to missing debate date.');
    return;
  }

  if (!record.xmlSource) {
    console.warn('⚠️  Skipping Supabase persistence due to missing XML source URI.');
    return;
  }

  const dayPayload = {
    chamber: chamberCode,
    date: debateDate,
    title: record.debateType ?? record.chamber ?? null,
    source_xml_uri: record.xmlSource,
    storage_path: record.xmlLocalPath ?? null,
    section_count: record.stats.sections,
    speech_count: record.stats.speeches,
    word_count: record.stats.wordCount,
    ingest_context: {
      script: 'fetch-oireachtas-debate-week.ts',
      version: scriptVersion,
      sourceIndex,
      generatedAt: new Date().toISOString()
    }
  };

  const { data: dayRows, error: dayError } = await client
    .from('debate_days')
    .upsert(dayPayload, { onConflict: 'chamber,date,source_xml_uri' })
    .select();

  if (dayError) {
    throw new Error(`Failed to upsert debate day (${debateDate}): ${dayError.message}`);
  }

  const dayRow = dayRows?.[0];
  if (!dayRow) {
    throw new Error('Supabase did not return a debate_day row after upsert.');
  }

  const dayId: string = dayRow.id;

  const { data: existingSectionRows, error: existingSectionError } = await client
    .from('debate_sections')
    .select('id, section_code')
    .eq('debate_day_id', dayId);

  if (existingSectionError) {
    throw new Error(`Failed to load existing sections for day ${dayId}: ${existingSectionError.message}`);
  }

  const existingSectionIdByCode = new Map<string, string>();
  for (const row of existingSectionRows ?? []) {
    if (row.section_code) {
      existingSectionIdByCode.set(row.section_code, row.id);
    }
  }

  const flatSections = flattenSections(record.sections, {
    dayId,
    sectionIdByCode: existingSectionIdByCode
  });

  if (flatSections.length > 0) {
    const sectionChunks = chunkArray(flatSections, 250);
    for (const chunk of sectionChunks) {
      const rows = chunk.map((section) => ({
        id: section.id,
        debate_day_id: dayId,
        section_code: section.sectionCode,
        title: section.title,
        debate_type: section.debateType,
        recorded_time: section.recordedTime,
        parent_section_id: section.parentId,
        contains_debate: section.containsDebate,
        speech_count: section.speechCount,
        word_count: section.wordCount,
        order_index: section.orderIndex,
        metadata: section.metadata ? { ...section.metadata, sourcePath: section.path } : { sourcePath: section.path }
      }));

      const { error: upsertError } = await client.from('debate_sections').upsert(rows, { onConflict: 'id' });
      if (upsertError) {
        throw new Error(`Failed to upsert debate sections: ${upsertError.message}`);
      }
    }
  }

  const existingSectionIdsForSpeeches = flatSections.filter((section) => !section.isNew).map((section) => section.id);
  const existingSpeechIdByCode = new Map<string, string>();

  if (existingSectionIdsForSpeeches.length > 0) {
    const sectionIdChunks = chunkArray(existingSectionIdsForSpeeches, 200);
    for (const chunk of sectionIdChunks) {
      const { data: speechData, error: speechError } = await client
        .from('debate_speeches')
        .select('id, section_id, speech_code')
        .in('section_id', chunk);

      if (speechError) {
        throw new Error(`Failed to load existing speeches: ${speechError.message}`);
      }

      for (const row of speechData ?? []) {
        if (row.speech_code) {
          existingSpeechIdByCode.set(buildSpeechKey(row.section_id, row.speech_code), row.id);
        }
      }
    }
  }

  const speechRows: any[] = [];
  for (const section of flatSections) {
    const sectionSpeeches = section.original.speeches;
    if (!sectionSpeeches?.length) continue;

    sectionSpeeches.forEach((speech, index) => {
      const speechCode = speech.id ?? null;
      const speechKey = speechCode ? buildSpeechKey(section.id, speechCode) : buildSpeechKey(section.id, `index:${index}`);
      const existingSpeechId = speechCode ? existingSpeechIdByCode.get(speechKey) ?? null : null;
      const speechId = existingSpeechId ?? deterministicUuid(section.id, speechCode ?? `index:${index}`);

      if (speechCode && !existingSpeechIdByCode.has(speechKey)) {
        existingSpeechIdByCode.set(speechKey, speechId);
      }

      speechRows.push({
        id: speechId,
        section_id: section.id,
        speech_code: speechCode,
        speaker_oireachtas_id: speech.speaker?.id ?? null,
        speaker_name: speech.speaker?.name ?? speech.speakerLabel ?? null,
        speaker_party: null,
        speaker_role: speech.role?.name ?? null,
        recorded_time: speech.recordedTime,
        paragraphs: speech.paragraphs,
        word_count: speech.wordCount,
        metadata: {
          speakerUri: speech.speaker?.uri ?? null,
          roleId: speech.role?.id ?? null,
          roleUri: speech.role?.uri ?? null,
          speakerLabel: speech.speakerLabel ?? null,
          paragraphCount: speech.paragraphs.length,
          sourcePath: section.path
        }
      });
    });
  }

  if (speechRows.length > 0) {
    const speechChunks = chunkArray(speechRows, 500);
    for (const chunk of speechChunks) {
      const { error: upsertError } = await client.from('debate_speeches').upsert(chunk, { onConflict: 'id' });
      if (upsertError) {
        throw new Error(`Failed to upsert debate speeches: ${upsertError.message}`);
      }
    }
  }

  // Pre-create summarisation tasks for sections containing debate content
  const sectionsNeedingSummary = flatSections.filter((section) => section.containsDebate && section.wordCount > 0);
  if (sectionsNeedingSummary.length > 0) {
    const sectionIds = sectionsNeedingSummary.map((section) => section.id);

    const { data: summaryRows, error: summaryError } = await client
      .from('debate_section_summaries')
      .select('section_id, status')
      .in('section_id', sectionIds);

    if (summaryError) {
      throw new Error(`Failed to load existing summaries: ${summaryError.message}`);
    }

    const completedSummaryIds = new Set<string>();
    for (const row of summaryRows ?? []) {
      if (row.status === 'complete') {
        completedSummaryIds.add(row.section_id);
      }
    }

    const { data: existingTasks, error: taskError } = await client
      .from('debate_section_tasks')
      .select('id, section_id, status, task_type')
      .eq('task_type', 'section_summary')
      .in('section_id', sectionIds);

    if (taskError) {
      throw new Error(`Failed to load existing summary tasks: ${taskError.message}`);
    }

    const activeTaskSectionIds = new Set<string>();
    const failedTaskSectionIds: string[] = [];

    for (const task of existingTasks ?? []) {
      if (task.status === 'pending' || task.status === 'processing' || task.status === 'complete') {
        activeTaskSectionIds.add(task.section_id);
      } else if (task.status === 'failed') {
        failedTaskSectionIds.push(task.section_id);
      }
    }

    if (failedTaskSectionIds.length > 0) {
      const { error: resetError } = await client
        .from('debate_section_tasks')
        .update({
          status: 'pending',
          attempts: 0,
          last_attempted_at: null
        })
        .eq('task_type', 'section_summary')
        .in('section_id', failedTaskSectionIds);

      if (resetError) {
        throw new Error(`Failed to reset failed summary tasks: ${resetError.message}`);
      }

      failedTaskSectionIds.forEach((id) => activeTaskSectionIds.add(id));
    }

    const taskRows = sectionsNeedingSummary
      .filter((section) => !completedSummaryIds.has(section.id) && !activeTaskSectionIds.has(section.id))
      .map((section) => ({
        id: randomUUID(),
        section_id: section.id,
        task_type: 'section_summary',
        status: 'pending',
        priority: 5,
        attempts: 0,
        payload: {
          sectionCode: section.sectionCode,
          debateDayId: dayId,
          wordCount: section.wordCount
        }
      }));

    if (taskRows.length > 0) {
      const taskChunks = chunkArray(taskRows, 500);
      for (const chunk of taskChunks) {
        const { error: upsertError } = await client.from('debate_section_tasks').insert(chunk);
        if (upsertError) {
          throw new Error(`Failed to enqueue summarisation tasks: ${upsertError.message}`);
        }
      }
    }
  }

  console.log(
    `   📡 Supabase persisted: ${chamberCode} ${debateDate} (${flatSections.length} sections, ${speechRows.length} speeches)`
  );
}

interface FlattenContext {
  dayId: string;
  sectionIdByCode: Map<string, string>;
}

interface ParentContext {
  id: string;
  sectionCode: string | null;
  path: string;
}

function flattenSections(sections: SectionRecord[], context: FlattenContext): FlattenedSection[] {
  const flatSections: FlattenedSection[] = [];

  const visit = (sectionList: SectionRecord[], parent: ParentContext | null) => {
    sectionList.forEach((section, index) => {
      const sectionCode = section.id ?? null;
      const baseKey = sectionCode ?? `idx:${index}`;
      const path = parent ? `${parent.path}/${baseKey}` : baseKey;
      const existingId = sectionCode ? context.sectionIdByCode.get(sectionCode) ?? null : null;
      const id = existingId ?? deterministicUuid(context.dayId, path);

      if (sectionCode && !context.sectionIdByCode.has(sectionCode)) {
        context.sectionIdByCode.set(sectionCode, id);
      }

      const speechCount = section.speeches.length;
      const wordCount = section.speeches.reduce((acc, speech) => acc + speech.wordCount, 0);
      const metadata = buildSectionMetadata(section, parent?.sectionCode ?? null);

      const flat: FlattenedSection = {
        id,
        sectionCode,
        parentId: parent?.id ?? null,
        parentSectionCode: parent?.sectionCode ?? null,
        path,
        title: section.title,
        debateType: section.debateType,
        recordedTime: section.recordedTime,
        containsDebate: section.containsDebate,
        speechCount,
        wordCount,
        orderIndex: flatSections.length + 1,
        metadata,
        original: section,
        isNew: !existingId
      };

      flatSections.push(flat);

      if (section.subsections?.length) {
        visit(section.subsections, { id, sectionCode, path });
      }
    });
  };

  visit(sections, null);

  return flatSections;
}

function buildSectionMetadata(section: SectionRecord, parentSectionCode: string | null): any {
  return {
    question: section.question
      ? {
          id: section.question.id,
          askedBy: section.question.askedBy,
          askedTo: section.question.askedTo,
          text: section.question.text
        }
      : null,
    counts: section.metadata?.counts ?? null,
    parentSectionCode,
    rawDebateType: section.metadata?.debateType ?? section.debateType ?? null
  };
}

function deterministicUuid(...parts: Array<string | number | null | undefined>): string {
  const normalised = parts.map((part) => (part ?? '')).join('|');
  const hash = createHash('sha256').update(normalised).digest('hex');
  return formatHashToUuid(hash);
}

function buildSpeechKey(sectionId: string, speechCode: string): string {
  return `${sectionId}::${speechCode}`;
}

function formatHashToUuid(hash: string): string {
  const sanitized = hash.padEnd(32, '0');
  return `${sanitized.slice(0, 8)}-${sanitized.slice(8, 12)}-${sanitized.slice(12, 16)}-${sanitized.slice(16, 20)}-${sanitized.slice(
    20,
    32
  )}`;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

main().catch((error) => {
  console.error('❌ Debate fetch failed:', error);
  process.exitCode = 1;
});


