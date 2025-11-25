import express from 'express';
import { supabaseDb } from '../../db.js';
import { normalizeConstituencyName } from '../../utils/constituencyNormalizer.js';

const router = express.Router();

/**
 * GET /api/parliamentary/constituencies/summary
 * Returns all constituencies with aggregated TD data for the map
 */
router.get('/constituencies/summary', async (req, res) => {
  try {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    // Get all TDs with their constituency info (exclude Unknown constituency - likely Senators)
    const { data: tds, error: tdError } = await supabaseDb
      .from('td_scores')
      .select('id, politician_name, party, constituency, overall_score, gender')
      .eq('is_active', true)
      .neq('constituency', 'Unknown')
      .not('constituency', 'is', null)
      .order('overall_score', { ascending: false });

    if (tdError) {
      console.error('Error fetching TDs:', tdError);
      throw tdError;
    }

    if (!tds || tds.length === 0) {
      return res.json({ 
        success: true, 
        constituencies: [],
        message: 'No TDs found in database'
      });
    }

    // Group TDs by constituency (with normalization)
    const constituencyMap = new Map<string, any[]>();
    
    tds.forEach(td => {
      const rawConstituency = td.constituency;
      const constituency = normalizeConstituencyName(rawConstituency) || 'Unknown';
      
      if (!constituencyMap.has(constituency)) {
        constituencyMap.set(constituency, []);
      }
      constituencyMap.get(constituency)!.push(td);
    });

    // Build constituency summaries
    const constituencies = Array.from(constituencyMap.entries()).map(([name, tdList]) => {
      // Party breakdown
      const partyCount = new Map<string, number>();
      tdList.forEach(td => {
        const party = td.party || 'Unknown';
        partyCount.set(party, (partyCount.get(party) || 0) + 1);
      });

      const leadingParty = Array.from(partyCount.entries())
        .sort(([, a], [, b]) => b - a)[0];

      // Gender breakdown
      const maleCount = tdList.filter(td => td.gender?.toLowerCase() === 'male').length;
      const femaleCount = tdList.filter(td => td.gender?.toLowerCase() === 'female').length;
      const unknownGender = tdList.length - maleCount - femaleCount;

      // Average score
      const validScores = tdList.filter(td => td.overall_score != null);
      const avgScore = validScores.length > 0
        ? Math.round(validScores.reduce((sum, td) => sum + td.overall_score, 0) / validScores.length)
        : 50;

      // Government representation (simplified - check if any ministers)
      const hasGovernment = tdList.some(td => 
        ['Fianna Fáil', 'Fine Gael', 'Green Party'].includes(td.party)
      );

      return {
        name,
        tdCount: tdList.length,
        leadingParty: leadingParty?.[0] || 'Unknown',
        leadingPartyCount: leadingParty?.[1] || 0,
        averageScore: avgScore,
        parties: Array.from(partyCount.entries()).map(([party, count]) => ({
          party,
          count,
          percentage: Math.round((count / tdList.length) * 100)
        })).sort((a, b) => b.count - a.count),
        genderBreakdown: {
          male: maleCount,
          female: femaleCount,
          unknown: unknownGender,
          femalePercentage: tdList.length > 0 
            ? Math.round((femaleCount / tdList.length) * 100) 
            : 0
        },
        governmentRepresentation: hasGovernment ? 'Government' : 'Opposition',
        tds: tdList.map(td => ({
          id: td.id,
          name: td.politician_name,
          party: td.party,
          score: td.overall_score,
          gender: td.gender
        })).sort((a, b) => (b.score || 0) - (a.score || 0))
      };
    });

    // Sort by name
    constituencies.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      constituencies,
      totalConstituencies: constituencies.length,
      totalTDs: tds.length
    });

  } catch (error: any) {
    console.error('Error fetching constituency summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch constituency summary',
      error: error.message
    });
  }
});

/**
 * GET /api/parliamentary/constituencies
 * Returns list of all unique constituencies
 */
router.get('/constituencies', async (req, res) => {
  try {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    const { data: tds, error } = await supabaseDb
      .from('td_scores')
      .select('constituency')
      .neq('constituency', 'Unknown')
      .not('constituency', 'is', null)
      .order('constituency');

    if (error) throw error;

    // Get unique constituencies
    const constituencies = [...new Set(tds?.map(td => td.constituency).filter(Boolean))];

    res.json({
      success: true,
      constituencies: constituencies.map(name => ({ name })),
      count: constituencies.length
    });

  } catch (error: any) {
    console.error('Error fetching constituencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch constituencies',
      error: error.message
    });
  }
});

/**
 * GET /api/parliamentary/constituency/:name
 * Returns detailed info for a specific constituency
 */
router.get('/constituency/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const decodedName = decodeURIComponent(name);

    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    const { data: tds, error } = await supabaseDb
      .from('td_scores')
      .select('*')
      .ilike('constituency', decodedName)
      .order('overall_score', { ascending: false });

    if (error) throw error;

    if (!tds || tds.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Constituency "${decodedName}" not found`
      });
    }

    // Calculate constituency stats
    const partyBreakdown = new Map<string, number>();
    tds.forEach(td => {
      const party = td.party || 'Unknown';
      partyBreakdown.set(party, (partyBreakdown.get(party) || 0) + 1);
    });

    const avgScore = tds.reduce((sum, td) => sum + (td.overall_score || 0), 0) / tds.length;

    // Gender breakdown
    const maleCount = tds.filter(td => td.gender?.toLowerCase() === 'male').length;
    const femaleCount = tds.filter(td => td.gender?.toLowerCase() === 'female').length;
    const unknownGender = tds.length - maleCount - femaleCount;

    res.json({
      success: true,
      constituency: {
        name: decodedName,
        tdCount: tds.length,
        averageScore: Math.round(avgScore),
        partyBreakdown: Array.from(partyBreakdown.entries()).map(([party, count]) => ({
          party,
          count,
          percentage: Math.round((count / tds.length) * 100)
        })),
        genderBreakdown: {
          male: maleCount,
          female: femaleCount,
          unknown: unknownGender,
          femalePercentage: tds.length > 0 
            ? Math.round((femaleCount / tds.length) * 100) 
            : 0
        },
        tds: tds.map(td => ({
          id: td.id,
          name: td.politician_name,
          party: td.party,
          score: td.overall_score,
          gender: td.gender,
          committees: td.committee_memberships || [],
          offices: td.offices || []
        }))
      }
    });

  } catch (error: any) {
    console.error('Error fetching constituency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch constituency details',
      error: error.message
    });
  }
});

export default router;
