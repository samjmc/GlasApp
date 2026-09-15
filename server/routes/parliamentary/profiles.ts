/**
 * Parliamentary Profiles Routes
 * Provides detailed TD information including gender, offices, committees, history
 * Includes both enhanced TD profiles and party analytics
 */

import { Router } from 'express';
import { supabaseDb } from '../../db.js';
import { asyncHandler } from '../../middleware/errorHandler';
import { formatSuccess, formatError, ErrorCodes } from '../../utils/responseFormatters';

const router = Router();

/**
 * Calculate seniority based on first elected date
 */
function calculateSeniority(firstElectedDate: string | null): string | null {
  if (!firstElectedDate) return null;

  const years = new Date().getFullYear() - new Date(firstElectedDate).getFullYear();
  if (years >= 20) return 'Veteran (20+ years)';
  if (years >= 10) return 'Senior (10-20 years)';
  if (years >= 5) return 'Experienced (5-10 years)';
  return 'Junior (0-5 years)';
}

/**
 * GET /api/parliamentary/profiles/td/by-name/:name - Get TD by name
 */
router.get('/td/by-name/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const decodedName = decodeURIComponent(name);

  if (!supabaseDb) {
    return res.status(503).json(
      formatError('DATABASE_ERROR', ErrorCodes.DATABASE_ERROR)
    );
  }

  const { data: td, error } = await supabaseDb
    .from('td_scores')
    .select('*')
    .ilike('politician_name', decodedName)
    .single();

  if (error) throw error;

  if (!td) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'TD not found')
    );
  }

  const seniority = calculateSeniority(td.first_elected_date);

  const profile = {
    id: td.id,
    politician_name: td.politician_name,
    party: td.party,
    constituency: td.constituency,
    gender: td.gender,
    wikipediaTitle: td.wikipedia_title,
    memberCode: td.member_code,

    // Performance metrics
    overall_elo: td.overall_elo,
    news_elo: td.news_elo,
    parliamentary_elo: td.parliamentary_elo,
    legislative_elo: td.legislative_elo,
    constituency_work_elo: td.constituency_work_elo,
    public_trust_elo: td.public_trust_elo,
    transparency_elo: td.transparency_elo,
    effectiveness_elo: td.effectiveness_elo,
    integrity_elo: td.integrity_elo,
    consistency_elo: td.consistency_elo,
    constituency_service_elo: td.constituency_service_elo,

    // Stats
    total_stories: td.total_stories,
    positive_stories: td.positive_stories,
    negative_stories: td.negative_stories,
    questions_asked: td.questions_asked,
    attendance_percentage: td.attendance_percentage,
    confidence_score: td.confidence_score,
    data_sources_count: td.data_sources_count,
    national_rank: td.national_rank,
    constituency_rank: td.constituency_rank,
    party_rank: td.party_rank,

    // Committee & offices
    committees: td.committee_memberships || [],
    offices: td.offices || [],

    // Dates & seniority
    firstElectedDate: td.first_elected_date,
    currentTermStart: td.current_term_start,
    yearsInDail: td.first_elected_date ?
      new Date().getFullYear() - new Date(td.first_elected_date).getFullYear() : null,
    seniority,

    // History
    membershipHistory: td.membership_history || [],

    // Meta
    hasProfileImage: td.has_profile_image,
    lastUpdated: td.last_updated
  };

  res.json(formatSuccess(profile, { entity: 'td_profile' }));
}));

/**
 * GET /api/parliamentary/profiles/td/:id - Get enhanced TD profile by ID
 */
router.get('/td/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!supabaseDb) {
    return res.status(503).json(
      formatError('DATABASE_ERROR', ErrorCodes.DATABASE_ERROR)
    );
  }

  const { data: td, error } = await supabaseDb
    .from('td_scores')
    .select('*')
    .eq('id', parseInt(id))
    .single();

  if (error) throw error;

  if (!td) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'TD not found')
    );
  }

  const seniority = calculateSeniority(td.first_elected_date);

  const profile = {
    id: td.id,
    name: td.politician_name,
    party: td.party,
    constituency: td.constituency,
    gender: td.gender,
    wikipediaTitle: td.wikipedia_title,
    memberCode: td.member_code,

    // Performance metrics
    overallScore: td.overall_elo,
    newsImpact: td.news_impact_score,
    publicRating: td.public_trust_rating,

    // Committee & offices
    committees: td.committee_memberships || [],
    offices: td.offices || [],

    // Dates & seniority
    firstElectedDate: td.first_elected_date,
    currentTermStart: td.current_term_start,
    yearsInDail: td.first_elected_date ?
      new Date().getFullYear() - new Date(td.first_elected_date).getFullYear() : null,
    seniority,

    // History
    membershipHistory: td.membership_history || [],

    // Meta
    hasProfileImage: td.has_profile_image,
    lastUpdated: td.last_updated
  };

  res.json(formatSuccess(profile, { entity: 'td_profile' }));
}));

/**
 * GET /api/parliamentary/profiles/td/:id/summary - Get quick TD summary for drilldown
 */
router.get('/td/:id/summary', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!supabaseDb) {
    return res.status(503).json(
      formatError('DATABASE_ERROR', ErrorCodes.DATABASE_ERROR)
    );
  }

  const { data: td, error } = await supabaseDb
    .from('td_scores')
    .select(`
      id,
      politician_name,
      party,
      constituency,
      gender,
      offices,
      committee_memberships,
      first_elected_date,
      overall_elo,
      wikipedia_title
    `)
    .eq('id', parseInt(id))
    .single();

  if (error) throw error;

  if (!td) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'TD not found')
    );
  }

  const summary = {
    id: td.id,
    name: td.politician_name,
    party: td.party,
    constituency: td.constituency,
    gender: td.gender,
    score: td.overall_elo,

    // Quick stats
    officeCount: (td.offices || []).length,
    committeeCount: (td.committee_memberships || []).length,
    yearsInDail: td.first_elected_date ?
      new Date().getFullYear() - new Date(td.first_elected_date).getFullYear() : null,

    // Top office
    topOffice: (td.offices && td.offices.length > 0) ? td.offices[0] : null,

    // Top committee
    topCommittee: (td.committee_memberships && td.committee_memberships.length > 0)
      ? td.committee_memberships[0].name : null,

    wikipediaTitle: td.wikipedia_title
  };

  res.json(formatSuccess(summary, { entity: 'td_summary' }));
}));

/**
 * GET /api/parliamentary/profiles/party/:name - Get party details
 */
router.get('/party/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;

  if (!supabaseDb) {
    return res.status(503).json(
      formatError('DATABASE_ERROR', ErrorCodes.DATABASE_ERROR)
    );
  }

  const { data: members, error } = await supabaseDb
    .from('td_scores')
    .select('*')
    .ilike('party', name);

  if (error) throw error;

  if (!members || members.length === 0) {
    return res.status(404).json(
      formatError('ENTITY_NOT_FOUND', 'Party not found')
    );
  }

  // Calculate party stats
  const totalMembers = members.length;
  const maleCount = members.filter(m => m.gender === 'male').length;
  const femaleCount = members.filter(m => m.gender === 'female').length;
  const femalePercentage = totalMembers > 0 ? ((femaleCount / totalMembers) * 100).toFixed(1) : '0';

  // Count offices
  const ministers = members.filter(m =>
    m.offices && Array.isArray(m.offices) && m.offices.some((o: string) => o.includes('Minister'))
  ).length;

  const chairs = members.filter(m =>
    m.offices && Array.isArray(m.offices) && m.offices.some((o: string) => o.includes('Chair'))
  ).length;

  // Average performance
  const avgScore = members.reduce((sum, m) => sum + (m.overall_elo || 0), 0) / totalMembers;

  // Committee participation
  const allCommittees = new Set<string>();
  members.forEach(m => {
    if (m.committee_memberships && Array.isArray(m.committee_memberships)) {
      m.committee_memberships.forEach((c: any) => {
        allCommittees.add(c.name || c);
      });
    }
  });

  // Constituency breakdown
  const constituencyCount = new Set(members.map(m => m.constituency)).size;

  const partyProfile = {
    name,
    size: totalMembers,

    // Gender diversity
    genderBreakdown: {
      male: maleCount,
      female: femaleCount,
      femalePercentage: parseFloat(femalePercentage)
    },

    // Government positions
    positions: {
      ministers,
      committeeChairs: chairs,
      total: ministers + chairs
    },

    // Performance
    averageScore: Math.round(avgScore),

    // Representation
    constituenciesRepresented: constituencyCount,
    committeesActive: allCommittees.size,

    // Members
    members: members.map(m => ({
      id: m.id,
      name: m.politician_name,
      constituency: m.constituency,
      score: m.overall_elo,
      offices: m.offices || [],
      committees: m.committee_memberships || []
    }))
  };

  res.json(formatSuccess(partyProfile, { entity: 'party_profile' }));
}));

/**
 * GET /api/parliamentary/profiles/parties/analytics - Get all parties analytics
 */
router.get('/parties/analytics', asyncHandler(async (req, res) => {
  if (!supabaseDb) {
    return res.status(503).json(
      formatError('DATABASE_ERROR', ErrorCodes.DATABASE_ERROR)
    );
  }

  const { data: allTDs, error } = await supabaseDb
    .from('td_scores')
    .select('party, gender, offices, committee_memberships, overall_elo, constituency');

  if (error) throw error;

  // Group by party
  const partyMap = new Map<string, any[]>();

  (allTDs || []).forEach(td => {
    const party = td.party || 'Independent';
    if (!partyMap.has(party)) {
      partyMap.set(party, []);
    }
    partyMap.get(party)!.push(td);
  });

  // Build analytics for each party
  const parties = Array.from(partyMap.entries()).map(([name, members]) => {
    const totalMembers = members.length;
    const femaleCount = members.filter(m => m.gender === 'female').length;
    const femalePercentage = ((femaleCount / totalMembers) * 100).toFixed(1);

    const ministers = members.filter(m =>
      m.offices && m.offices.some((o: string) => o.includes('Minister'))
    ).length;

    const avgScore = members.reduce((sum, m) => sum + (m.overall_elo || 0), 0) / totalMembers;

    return {
      name,
      size: totalMembers,
      femaleCount,
      femalePercentage: parseFloat(femalePercentage),
      ministers,
      averageScore: Math.round(avgScore)
    };
  });

  // Sort by size
  parties.sort((a, b) => b.size - a.size);

  res.json(formatSuccess(parties, { totalTDs: allTDs?.length || 0 }));
}));

export default router;
