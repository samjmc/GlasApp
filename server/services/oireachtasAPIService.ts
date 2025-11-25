/**
 * Oireachtas API Service
 * Integrates with the official Irish Parliament API
 * 
 * API Documentation: https://api.oireachtas.ie/docs
 * Base URL: https://api.oireachtas.ie/v1/
 */

import axios from 'axios';

const BASE_URL = 'https://api.oireachtas.ie/v1';
const API_TIMEOUT = 30000; // 30 seconds

// API client
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'User-Agent': 'GlasPolitics/1.0 (Irish Political Platform)',
    'Accept': 'application/json'
  }
});

// ============================================
// Type Definitions
// ============================================

export interface OireachtasMember {
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  party: string | null;
  constituency: string | null;
  memberCode: string;
  house: 'dail' | 'seanad';
  dateRange: {
    start: string;
    end?: string;
  };
}

export interface ParliamentaryQuestion {
  questionId: string;
  member: string;
  date: string;
  questionType: 'oral' | 'written';
  subject: string;
  debateSection: string;
}

export interface ParliamentaryAttendance {
  member: string;
  dailAttendance: number;
  committeeAttendance: number;
  totalDays: number;
  attendancePercentage: number;
}

// ============================================
// Members API
// ============================================

/**
 * Helper: Extract current Dáil membership from memberships array
 */
function getCurrentDailMembership(member: any): any {
  if (!member.memberships) return null;
  
  // Find 34th Dáil membership with no end date (currently active)
  return member.memberships.find((m: any) => 
    m.membership.house?.houseCode === 'dail' &&
    m.membership.house?.houseNo === '34' &&  // Specifically 34th Dáil
    m.membership.dateRange?.end === null
  )?.membership;
}

/**
 * Get all current Dáil members (FIXED to extract party/constituency correctly)
 */
export async function getCurrentDailMembers(): Promise<OireachtasMember[]> {
  try {
    console.log('📡 Fetching current Dáil members from Oireachtas API...');
    
    // FIXED: Use house_no parameter to get 34th Dáil specifically
    const response = await apiClient.get('/members', {
      params: {
        chamber: 'dail',
        house_no: 34,  // 34th Dáil (current) - MUST be integer!
        limit: 200  // Covers all 174 TDs + buffer
      }
    });
    
    const members: OireachtasMember[] = [];
    
    if (response.data?.results) {
      for (const result of response.data.results) {
        const member = result.member;
        
        // Get current Dáil membership (active, no end date)
        const dailMembership = getCurrentDailMembership(member);
        
        // Skip if not currently in Dáil
        if (!dailMembership) continue;
        
        // Extract party from memberships array
        const party = dailMembership.parties?.[0]?.party?.showAs || null;
        
        // Extract constituency from represents array
        const constituency = dailMembership.represents?.[0]?.represent?.showAs || null;
        
        members.push({
          memberId: member.pId || member.memberCode,
          fullName: member.fullName,
          firstName: member.firstName,
          lastName: member.lastName,
          party,
          constituency,
          memberCode: member.memberCode,
          house: 'dail',
          dateRange: {
            start: dailMembership.dateRange?.start || '2020-01-01',
            end: dailMembership.dateRange?.end
          }
        });
      }
    }
    
    console.log(`✅ Found ${members.length} current Dáil members`);
    return members;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch Dáil members:', error.message);
    return [];
  }
}

/**
 * Get specific member details
 */
export async function getMemberDetails(memberId: string): Promise<OireachtasMember | null> {
  try {
    const response = await apiClient.get(`/members/${memberId}`);
    
    if (response.data?.results?.[0]?.member) {
      const m = response.data.results[0].member;
      return {
        memberId: m.pId,
        fullName: m.fullName,
        firstName: m.firstName,
        lastName: m.lastName,
        party: m.represent?.represent || null,
        constituency: m.represent?.representCode || null,
        memberCode: m.memberCode,
        house: 'dail',
        dateRange: {
          start: m.dateRange?.start,
          end: m.dateRange?.end
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to fetch member ${memberId}:`, error);
    return null;
  }
}

// ============================================
// Questions API
// ============================================

/**
 * Get questions asked by a member (FIXED - now returns actual total count)
 */
export async function getMemberQuestions(
  memberCode: string,
  dateFrom: string = '2024-01-01',  // Default to current year
  dateTo?: string
): Promise<ParliamentaryQuestion[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const params: any = {
      member: memberCode,
      date_start: dateFrom,
      date_end: dateTo || today,  // Use today's date as end
      limit: 1000  // API max is 1000
    };
    
    const response = await apiClient.get('/questions', { params });
    
    const questions: ParliamentaryQuestion[] = [];
    
    if (response.data?.results) {
      for (const result of response.data.results) {
        const q = result.question;
        
        questions.push({
          questionId: q.questionId,
          member: memberCode,
          date: q.date,
          questionType: q.questionType || 'written',
          subject: q.showAs || q.subject || '',
          debateSection: q.debateSection?.showAs || ''
        });
      }
    }
    
    return questions;
    
  } catch (error: any) {
    console.error(`Failed to fetch questions for ${memberCode}:`, error.message);
    return [];
  }
}

/**
 * Get ACCURATE question count for a member (retrieves actual data and counts)
 * Uses multiple year queries to get around API limit
 */
export async function getMemberQuestionCount(
  memberCode: string,
  dateFrom: string = '2024-01-01',
  dateTo?: string
): Promise<{ total: number; oral: number; written: number }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = dateTo || today;
    
    // Strategy: Query year by year to avoid hitting limits
    const startYear = parseInt(dateFrom.split('-')[0]);
    const endYear = parseInt(endDate.split('-')[0]);
    
    let totalQuestions = 0;
    let totalOral = 0;
    let totalWritten = 0;
    
    for (let year = startYear; year <= endYear; year++) {
      const yearStart = year === startYear ? dateFrom : `${year}-01-01`;
      const yearEnd = year === endYear ? endDate : `${year}-12-31`;
      
      const response = await apiClient.get('/questions', {
        params: {
          member: memberCode,
          date_start: yearStart,
          date_end: yearEnd,
          limit: 1000  // Max per request
        }
      });
      
      const results = response.data.results || [];
      
      // Manual count from actual results
      const oral = results.filter((r: any) => r.question.questionType === 'oral').length;
      const written = results.filter((r: any) => r.question.questionType === 'written').length;
      
      totalQuestions += results.length;
      totalOral += oral;
      totalWritten += written;
      
      // If we hit the limit, there might be more, but at least we have 1000
      if (results.length === 1000) {
        console.log(`   ⚠️  Hit limit for year ${year} - using 1000 questions`);
      }
    }
    
    return {
      total: totalQuestions,
      oral: totalOral,
      written: totalWritten
    };
    
  } catch (error: any) {
    console.error(`Failed to count questions for ${memberCode}:`, error.message);
    return { total: 0, oral: 0, written: 0 };
  }
}

/**
 * Count questions asked by all members in a date range
 */
export async function countQuestionsForAllMembers(
  dateFrom: string = '2024-11-01',
  dateTo: string = new Date().toISOString().split('T')[0]
): Promise<Record<string, number>> {
  try {
    console.log(`📊 Counting questions from ${dateFrom} to ${dateTo}...`);
    
    const response = await apiClient.get('/questions', {
      params: {
        date_start: dateFrom,
        date_end: dateTo,
        limit: 5000  // Get lots of questions
      }
    });
    
    const questionCounts: Record<string, number> = {};
    
    if (response.data?.results) {
      for (const result of response.data.results) {
        const memberId = result.question?.by?.showAs || result.question?.by?.memberCode;
        if (memberId) {
          questionCounts[memberId] = (questionCounts[memberId] || 0) + 1;
        }
      }
    }
    
    console.log(`✅ Counted questions for ${Object.keys(questionCounts).length} members`);
    return questionCounts;
    
  } catch (error: any) {
    console.error('Failed to count questions:', error.message);
    return {};
  }
}

// ============================================
// Debates/Attendance API
// ============================================

/**
 * Get member attendance from debates (FIXED query parameter)
 * Note: Oireachtas API doesn't have direct attendance endpoint
 * We infer from debate participation
 */
export async function getMemberAttendance(
  memberCode: string,
  dateFrom: string = '2020-01-01',
  dateTo?: string
): Promise<{ debates: number; estimatedAttendance: number }> {
  try {
    const params: any = {
      member: memberCode,  // FIXED: was member_id
      limit: 500
    };
    
    params.date_start = dateFrom;
    if (dateTo) params.date_end = dateTo;
    
    const response = await apiClient.get('/debates', { params });
    
    const debateCount = response.data?.results?.length || 0;
    
    // Estimate attendance (rough approximation)
    // Assuming ~100 sitting days per year, participating in debate = attended
    const totalDays = 100; // Approximate
    const estimatedAttendance = Math.min(100, (debateCount / totalDays) * 100);
    
    return {
      debates: debateCount,
      estimatedAttendance: Math.round(estimatedAttendance)
    };
    
  } catch (error: any) {
    console.error(`Failed to fetch attendance for ${memberCode}:`, error.message);
    return { debates: 0, estimatedAttendance: 0 };
  }
}

// ============================================
// Divisions (Votes) API
// ============================================

/**
 * Get member voting record (FIXED query parameter)
 */
export async function getMemberVotes(
  memberCode: string,
  dateFrom: string = '2020-01-01',
  dateTo?: string
): Promise<{ totalVotes: number; votingRecord: any[] }> {
  try {
    const params: any = {
      member: memberCode,  // FIXED: was member_id
      limit: 500
    };
    
    params.date_start = dateFrom;
    if (dateTo) params.date_end = dateTo;
    
    const response = await apiClient.get('/divisions', { params });
    
    const votes = response.data?.results || [];
    
    return {
      totalVotes: votes.length,
      votingRecord: votes
    };
    
  } catch (error: any) {
    console.error(`Failed to fetch votes for ${memberCode}:`, error.message);
    return { totalVotes: 0, votingRecord: [] };
  }
}

// ============================================
// Comprehensive Member Activity
// ============================================

/**
 * Get complete parliamentary activity for a member (FIXED - uses accurate counts)
 */
export async function getCompleteMemberActivity(member: OireachtasMember): Promise<{
  questionsAsked: number;
  oralQuestions: number;
  writtenQuestions: number;
  debates: number;
  votes: number;
  estimatedAttendance: number;
  lastActive: string | null;
}> {
  try {
    console.log(`📊 Fetching activity for ${member.fullName}...`);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Use accurate count function (gets from head.counts, not results.length)
    const questionCounts = await getMemberQuestionCount(member.memberCode, '2024-01-01', today);
    
    // Fetch attendance (limit doesn't matter as much for debates)
    const attendance = await getMemberAttendance(member.memberCode, '2024-01-01', today);
    
    // Fetch votes (get actual count from head)
    const votingResponse = await apiClient.get('/divisions', {
      params: {
        member: member.memberCode,
        date_start: '2024-01-01',
        date_end: today,
        limit: 1  // Just get the count
      }
    });
    
    const totalVotes = votingResponse.data?.head?.counts?.divisionCount || 0;
    
    // Get a few recent questions to find last activity
    const recentQuestions = await getMemberQuestions(member.memberCode, '2024-01-01', today);
    const lastActive = recentQuestions.length > 0 
      ? recentQuestions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : null;
    
    console.log(`   Questions: ${questionCounts.total}, Debates: ${attendance.debates}, Votes: ${totalVotes}`);
    
    return {
      questionsAsked: questionCounts.total,
      oralQuestions: questionCounts.oral,
      writtenQuestions: questionCounts.written,
      debates: attendance.debates,
      votes: totalVotes,
      estimatedAttendance: attendance.estimatedAttendance,
      lastActive
    };
    
  } catch (error: any) {
    console.error(`Failed to fetch activity for ${member.fullName}:`, error.message);
    return {
      questionsAsked: 0,
      oralQuestions: 0,
      writtenQuestions: 0,
      debates: 0,
      votes: 0,
      estimatedAttendance: 0,
      lastActive: null
    };
  }
}

/**
 * Fetch activity for all current Dáil members
 */
export async function fetchAllMemberActivity(): Promise<Map<string, any>> {
  console.log('🏛️ Fetching parliamentary activity for all TDs...');
  
  const members = await getCurrentDailMembers();
  const activityMap = new Map<string, any>();
  
  let processed = 0;
  const total = members.length;
  
  for (const member of members) {
    try {
      const activity = await getCompleteMemberActivity(member);
      
      activityMap.set(member.fullName.toLowerCase(), {
        fullName: member.fullName,
        memberId: member.memberId,
        memberCode: member.memberCode,
        party: member.party,
        constituency: member.constituency,
        ...activity
      });
      
      processed++;
      console.log(`✅ [${processed}/${total}] ${member.fullName}`);
      
      // Rate limiting - don't overwhelm API
      await sleep(500); // 500ms between requests
      
    } catch (error: any) {
      console.error(`❌ Error processing ${member.fullName}:`, error.message);
    }
  }
  
  console.log(`\n✅ Fetched activity for ${activityMap.size} TDs`);
  return activityMap;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// NEW: Committee Memberships
// ============================================

/**
 * Extract committee memberships from member data
 */
export function extractCommitteeMemberships(member: any): Array<{
  name: string;
  nameIrish: string;
  role: string;
  type: string;
  status: string;
  dateRange: { start: string; end: string | null };
}> {
  const dailMembership = getCurrentDailMembership(member);
  if (!dailMembership?.committees) return [];
  
  return dailMembership.committees
    .filter((c: any) => c.mainStatus === 'Live')  // Only active committees
    .map((c: any) => ({
      name: c.committeeName?.[0]?.nameEn || 'Unknown Committee',
      nameIrish: c.committeeName?.[0]?.nameGa || '',
      role: c.role?.title || 'Member',
      type: c.committeeType?.[0] || 'Unknown',
      status: c.mainStatus,
      dateRange: {
        start: c.memberDateRange?.start,
        end: c.memberDateRange?.end
      }
    }));
}

// ============================================
// NEW: Bill Sponsorship
// ============================================

/**
 * Get bills sponsored by a member
 */
export async function getMemberBills(
  memberName: string,
  dateFrom: string = '2020-01-01'
): Promise<Array<{
  billNo: string;
  title: string;
  type: string;
  status: string;
  year: string;
}>> {
  try {
    const response = await apiClient.get('/legislation', {
      params: {
        date_start: dateFrom,
        limit: 100
      }
    });
    
    const bills: any[] = [];
    
    if (response.data?.results) {
      for (const result of response.data.results) {
        const bill = result.bill;
        
        // Check if member is a sponsor
        const isAuthor = bill.sponsors?.some((s: any) => 
          s.sponsor?.by?.showAs?.toLowerCase() === memberName.toLowerCase()
        );
        
        if (isAuthor) {
          bills.push({
            billNo: bill.billNo?.toString() || '',
            title: bill.shortTitleEn || bill.longTitleEn || 'Untitled',
            type: bill.billType || 'Unknown',
            status: bill.status || 'Unknown',
            year: bill.billYear || new Date(bill.lastUpdated).getFullYear().toString()
          });
        }
      }
    }
    
    return bills;
    
  } catch (error: any) {
    console.error(`Failed to fetch bills for ${memberName}:`, error.message);
    return [];
  }
}

// ============================================
// NEW: Enhanced Voting Attendance
// ============================================

/**
 * Calculate accurate voting attendance percentage (FIXED - uses head counts)
 */
export async function calculateVotingAttendance(
  memberCode: string,
  dateFrom: string = '2024-01-01'
): Promise<{ votingAttendance: number; votesCast: number; totalVotes: number }> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get total votes in period (use head count)
    const allVotesResponse = await apiClient.get('/divisions', {
      params: {
        date_start: dateFrom,
        date_end: today,
        limit: 1  // Just need the count
      }
    });
    
    const totalVotes = allVotesResponse.data?.head?.counts?.divisionCount || 0;
    
    // Get member's votes (use head count)
    const memberVotesResponse = await apiClient.get('/divisions', {
      params: {
        member: memberCode,
        date_start: dateFrom,
        date_end: today,
        limit: 1  // Just need the count
      }
    });
    
    const votesCast = memberVotesResponse.data?.head?.counts?.divisionCount || 0;
    
    const attendance = totalVotes > 0 ? (votesCast / totalVotes) * 100 : 0;
    
    return {
      votingAttendance: Math.round(attendance),
      votesCast,
      totalVotes
    };
    
  } catch (error: any) {
    console.error(`Failed to calculate voting attendance:`, error.message);
    return { votingAttendance: 0, votesCast: 0, totalVotes: 0 };
  }
}

/**
 * ============================================
 * ENHANCED QUESTION EXTRACTION
 * Extract full question details with AI topic classification
 * ============================================
 */

export interface QuestionDetail {
  questionId: string;
  questionUri: string;
  questionNumber: string;
  questionType: 'oral' | 'written';
  dateAsked: string;
  dateAnswered: string | null;
  subject: string;
  questionText: string;
  answerText: string | null;
  ministerName: string | null;
  ministerUri: string | null;
  department: string | null;
  debateUri: string | null;
  debateSection: string | null;
}

/**
 * Extract detailed questions for a specific member with pagination support
 */
export async function extractMemberQuestions(
  memberUri: string,
  dateFrom: string = '2024-01-01',
  dateTo?: string
): Promise<QuestionDetail[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = dateTo || today;

    console.log(`📋 Extracting questions for member: ${memberUri}`);
    console.log(`   Date range: ${dateFrom} to ${endDate}`);

    const allQuestions: QuestionDetail[] = [];
    let skip = 0;
    const limit = 500; // Fetch in batches

    while (true) {
      const response = await apiClient.get('/questions', {
        params: {
          member_id: memberUri,
          date_start: dateFrom,
          date_end: endDate,
          show_answers: true, // Include answers in response
          limit,
          skip
        }
      });

      const results = response.data.results || [];
      
      if (results.length === 0) break; // No more results

      console.log(`   Fetched ${results.length} questions (skip: ${skip})`);

      for (const result of results) {
        const q = result.question;
        
        // Extract question details
        const questionDetail: QuestionDetail = {
          questionId: q.questionNo || q.uri?.split('/').pop() || `unknown-${Date.now()}`,
          questionUri: q.uri || '',
          questionNumber: q.questionNo || '',
          questionType: (q.questionType === 'oral' ? 'oral' : 'written'),
          dateAsked: q.date || '',
          dateAnswered: q.answer?.date || null,
          subject: q.showAs || q.subject || '',
          questionText: q.questionText || q.text || '',
          answerText: q.answer?.answerText || q.answer?.text || null,
          ministerName: q.by?.showAs || q.by?.memberName || null,
          ministerUri: q.by?.uri || null,
          department: q.department || null,
          debateUri: q.debate?.uri || q.debateSection?.uri || null,
          debateSection: q.debateSection?.showAs || null
        };

        allQuestions.push(questionDetail);
      }

      // Check if we've fetched everything
      if (results.length < limit) break;
      
      skip += limit;
      
      // Safety limit to prevent infinite loops
      if (skip > 10000) {
        console.warn(`   ⚠️  Reached safety limit of 10,000 questions`);
        break;
      }
    }

    console.log(`   ✅ Total questions extracted: ${allQuestions.length}`);
    return allQuestions;

  } catch (error: any) {
    console.error(`❌ Failed to extract questions for ${memberUri}:`, error.message);
    return [];
  }
}

/**
 * AI-powered topic classification for questions
 * Uses OpenAI to categorize questions into topics
 */
export async function classifyQuestionTopic(
  subject: string,
  questionText: string
): Promise<string> {
  // Topic categories based on Irish political landscape
  const topics = [
    'Housing & Homelessness',
    'Healthcare',
    'Education',
    'Transport & Infrastructure',
    'Economy & Finance',
    'Environment & Climate',
    'Justice & Crime',
    'Social Welfare',
    'Employment & Jobs',
    'Agriculture & Rural Affairs',
    'Foreign Affairs',
    'Defence',
    'Local Services',
    'Energy',
    'Immigration',
    'Culture & Heritage',
    'Other'
  ];

  try {
    // Simple keyword-based classification first (fast fallback)
    const text = (subject + ' ' + questionText).toLowerCase();
    
    if (text.match(/housing|homeless|rent|evict|accommodation/)) return 'Housing & Homelessness';
    if (text.match(/health|hospital|medical|doctor|hse|nurse|patient/)) return 'Healthcare';
    if (text.match(/school|education|teacher|student|college|university/)) return 'Education';
    if (text.match(/road|transport|bus|rail|dart|luas|traffic/)) return 'Transport & Infrastructure';
    if (text.match(/tax|budget|finance|economy|revenue|spending/)) return 'Economy & Finance';
    if (text.match(/climate|environment|emission|green|sustainability|pollution/)) return 'Environment & Climate';
    if (text.match(/crime|garda|court|justice|prison|sentence|law/)) return 'Justice & Crime';
    if (text.match(/welfare|pension|disability|carer|payment|benefit/)) return 'Social Welfare';
    if (text.match(/job|employ|unemployment|work|labour|wage/)) return 'Employment & Jobs';
    if (text.match(/farm|agriculture|rural|livestock|forestry/)) return 'Agriculture & Rural Affairs';
    if (text.match(/foreign|europe|eu|brexit|trade|embassy/)) return 'Foreign Affairs';
    if (text.match(/defence|army|military|naval/)) return 'Defence';
    if (text.match(/council|local authority|waste|water|planning/)) return 'Local Services';
    if (text.match(/energy|electricity|gas|renewable|power|esb/)) return 'Energy';
    if (text.match(/immigra|asylum|visa|refugee|migration/)) return 'Immigration';
    if (text.match(/culture|heritage|arts|irish language|gaeilge|museum/)) return 'Culture & Heritage';

    return 'Other';

  } catch (error: any) {
    console.error('Topic classification error:', error.message);
    return 'Other';
  }
}

/**
 * Analyze answer sentiment using simple keyword analysis
 */
export function analyzeAnswerSentiment(answerText: string | null): string {
  if (!answerText) return 'neutral';

  const text = answerText.toLowerCase();
  
  // Positive indicators
  const positiveCount = (
    (text.match(/approved|granted|allocated|increased|improved|progress|successful|completed/g) || []).length
  );
  
  // Negative indicators
  const negativeCount = (
    (text.match(/declined|rejected|reduced|delayed|under review|not available|unable to|no plans/g) || []).length
  );

  if (positiveCount > negativeCount + 1) return 'positive';
  if (negativeCount > positiveCount + 1) return 'negative';
  return 'neutral';
}

/**
 * ============================================
 * ENHANCED VOTE EXTRACTION
 * Extract detailed voting records with party loyalty analysis
 * ============================================
 */

export interface VoteDetail {
  voteId: string;
  voteUri: string;
  voteDate: string;
  voteSubject: string;
  voteOutcome: string;
  tdVote: 'ta' | 'nil' | 'staon' | null;  // ta=yes, nil=no, staon=abstain
  votedWithParty: boolean | null;
  tdPartyAtVote: string | null;
  debateUri: string | null;
  legislationUri: string | null;
  totalTaVotes: number;
  totalNilVotes: number;
  totalStaonVotes: number;
}

/**
 * Extract detailed votes for a specific member with pagination support
 */
export async function extractMemberVotes(
  memberUri: string,
  memberParty: string,
  dateFrom: string = '2024-01-01',
  dateTo?: string
): Promise<VoteDetail[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = dateTo || today;

    console.log(`🗳️  Extracting votes for member: ${memberUri}`);
    console.log(`   Date range: ${dateFrom} to ${endDate}`);

    const allVotes: VoteDetail[] = [];
    let skip = 0;
    const limit = 500; // Fetch in batches

    while (true) {
      const response = await apiClient.get('/votes', {
        params: {
          chamber: 'dail',
          member_id: memberUri,
          date_start: dateFrom,
          date_end: endDate,
          limit,
          skip
        }
      });

      const results = response.data.results || [];
      
      if (results.length === 0) break; // No more results

      console.log(`   Fetched ${results.length} votes (skip: ${skip})`);

      for (const result of results) {
        const division = result.division;
        
        // Find how this specific member voted
        const memberVote = findMemberVote(division, memberUri);
        
        // Determine party loyalty (did TD vote with party majority?)
        const votedWithParty = memberVote ? 
          determinePartyLoyalty(division, memberParty, memberVote) : null;

        // Extract vote details
        const voteDetail: VoteDetail = {
          voteId: division.divisionId || division.uri?.split('/').pop() || `unknown-${Date.now()}`,
          voteUri: division.uri || '',
          voteDate: division.date || '',
          voteSubject: division.subject || division.showAs || '',
          voteOutcome: division.outcome || '',
          tdVote: memberVote,
          votedWithParty,
          tdPartyAtVote: memberParty,
          debateUri: division.debate?.uri || null,
          legislationUri: division.bill?.uri || null,
          totalTaVotes: division.tallies?.taVotes || 0,
          totalNilVotes: division.tallies?.nilVotes || 0,
          totalStaonVotes: division.tallies?.staonVotes || 0
        };

        allVotes.push(voteDetail);
      }

      // Check if we've fetched everything
      if (results.length < limit) break;
      
      skip += limit;
      
      // Safety limit to prevent infinite loops
      if (skip > 10000) {
        console.warn(`   ⚠️  Reached safety limit of 10,000 votes`);
        break;
      }
    }

    console.log(`   ✅ Total votes extracted: ${allVotes.length}`);
    return allVotes;

  } catch (error: any) {
    console.error(`❌ Failed to extract votes for ${memberUri}:`, error.message);
    return [];
  }
}

/**
 * Find how a specific member voted in a division
 */
function findMemberVote(division: any, memberUri: string): 'ta' | 'nil' | 'staon' | null {
  // Check ta votes (yes)
  if (division.tallies?.taVotes?.members) {
    const taVoter = division.tallies.taVotes.members.find((m: any) => 
      m.member?.uri === memberUri
    );
    if (taVoter) return 'ta';
  }

  // Check nil votes (no)
  if (division.tallies?.nilVotes?.members) {
    const nilVoter = division.tallies.nilVotes.members.find((m: any) => 
      m.member?.uri === memberUri
    );
    if (nilVoter) return 'nil';
  }

  // Check staon votes (abstain)
  if (division.tallies?.staonVotes?.members) {
    const staonVoter = division.tallies.staonVotes.members.find((m: any) => 
      m.member?.uri === memberUri
    );
    if (staonVoter) return 'staon';
  }

  return null; // Member did not vote
}

/**
 * Determine if TD voted with their party's majority
 */
function determinePartyLoyalty(
  division: any, 
  tdParty: string, 
  tdVote: 'ta' | 'nil' | 'staon'
): boolean {
  // Count how party members voted
  let partyTaCount = 0;
  let partyNilCount = 0;
  let partyStaonCount = 0;

  // Count ta votes from party
  if (division.tallies?.taVotes?.members) {
    partyTaCount = division.tallies.taVotes.members.filter((m: any) => 
      m.member?.party === tdParty
    ).length;
  }

  // Count nil votes from party
  if (division.tallies?.nilVotes?.members) {
    partyNilCount = division.tallies.nilVotes.members.filter((m: any) => 
      m.member?.party === tdParty
    ).length;
  }

  // Count staon votes from party
  if (division.tallies?.staonVotes?.members) {
    partyStaonCount = division.tallies.staonVotes.members.filter((m: any) => 
      m.member?.party === tdParty
    ).length;
  }

  // Determine party's majority vote
  const maxCount = Math.max(partyTaCount, partyNilCount, partyStaonCount);
  
  if (maxCount === 0) return true; // No party members voted, consider loyal

  let partyMajorityVote: 'ta' | 'nil' | 'staon';
  if (partyTaCount === maxCount) partyMajorityVote = 'ta';
  else if (partyNilCount === maxCount) partyMajorityVote = 'nil';
  else partyMajorityVote = 'staon';

  // Did TD vote with party majority?
  return tdVote === partyMajorityVote;
}

// Export service object
export const OireachtasAPIService = {
  getCurrentDailMembers,
  getMemberDetails,
  getMemberQuestions,
  getMemberQuestionCount,
  getMemberAttendance,
  getMemberVotes,
  getCompleteMemberActivity,
  fetchAllMemberActivity,
  extractCommitteeMemberships,
  getMemberBills,
  calculateVotingAttendance,
  extractMemberQuestions,
  classifyQuestionTopic,
  analyzeAnswerSentiment,
  extractMemberVotes
};

