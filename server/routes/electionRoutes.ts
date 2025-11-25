import { Router, Request, Response } from 'express';
import { db } from '../db';
import { elections, electionResults, constituencies, parties } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { cached, TTL } from '../services/cacheService';

const router = Router();

// Get all elections (with caching - election data rarely changes)
router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const allElections = await cached(
      'elections:all',
      TTL.ONE_DAY,
      async () => await db.select().from(elections).orderBy(desc(elections.date))
    );
    
    res.status(200).json({
      success: true,
      data: allElections
    });
  } catch (error) {
    next(error);
  }
});

// Get election results by election ID (with caching)
router.get('/:electionId/results', async (req: Request, res: Response, next) => {
  try {
    const electionId = parseInt(req.params.electionId);
    
    if (isNaN(electionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }
    
    // Cache election results (they don't change)
    const resultsData = await cached(
      `election:${electionId}:results`,
      TTL.ONE_WEEK,
      async () => {
        // Get election details first
        const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
        
        if (!election) {
          return null;
        }
        
        // Get all results for this election with constituency and party details
        const results = await db
          .select({
            resultId: electionResults.id,
            electionId: electionResults.electionId,
            constituencyId: electionResults.constituencyId,
            constituencyName: constituencies.name,
            constituencySeats: constituencies.seats,
            partyId: electionResults.partyId,
            partyName: parties.name,
            partyColor: parties.color,
            votes: electionResults.votes,
            percentage: electionResults.percentage,
            seats: electionResults.seats
          })
          .from(electionResults)
          .innerJoin(constituencies, eq(electionResults.constituencyId, constituencies.id))
          .innerJoin(parties, eq(electionResults.partyId, parties.id))
          .where(eq(electionResults.electionId, electionId))
          .orderBy(constituencies.name, desc(electionResults.seats), desc(electionResults.percentage));
        
        // Group results by constituency
        const resultsByConstituency: any = {};
        
        results.forEach(result => {
          if (!resultsByConstituency[result.constituencyName]) {
            resultsByConstituency[result.constituencyName] = {
              constituencyId: result.constituencyId,
              name: result.constituencyName,
              totalSeats: result.constituencySeats,
              parties: []
            };
          }
          
          resultsByConstituency[result.constituencyName].parties.push({
            partyId: result.partyId,
            name: result.partyName,
            color: result.partyColor,
            votes: result.votes,
            percentage: result.percentage,
            seats: result.seats
          });
        });
        
        return {
          election: {
            id: election.id,
            name: election.name,
            date: election.date,
            type: election.type,
            turnout: election.turnout,
            description: election.description
          },
          constituencies: Object.values(resultsByConstituency)
        };
      }
    );
    
    if (!resultsData) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }
    
    res.status(200).json({
      success: true,
      ...resultsData
    });
  } catch (error) {
    next(error);
  }
});

// Get election results by constituency
router.get('/:electionId/constituency/:constituencyId', async (req: Request, res: Response) => {
  try {
    const electionId = parseInt(req.params.electionId);
    const constituencyId = parseInt(req.params.constituencyId);
    
    if (isNaN(electionId) || isNaN(constituencyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or constituency ID'
      });
    }
    
    // Get election details
    const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
    
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }
    
    // Get constituency details
    const [constituency] = await db.select().from(constituencies).where(eq(constituencies.id, constituencyId));
    
    if (!constituency) {
      return res.status(404).json({
        success: false,
        message: 'Constituency not found'
      });
    }
    
    // Get results for this constituency in this election
    const results = await db
      .select({
        resultId: electionResults.id,
        partyId: electionResults.partyId,
        partyName: parties.name,
        partyColor: parties.color,
        votes: electionResults.votes,
        percentage: electionResults.percentage,
        seats: electionResults.seats
      })
      .from(electionResults)
      .innerJoin(parties, eq(electionResults.partyId, parties.id))
      .where(eq(electionResults.electionId, electionId))
      .where(eq(electionResults.constituencyId, constituencyId))
      .orderBy(desc(electionResults.seats), desc(electionResults.percentage));
    
    const partyResults = results.map(result => ({
      partyId: result.partyId,
      name: result.partyName,
      color: result.partyColor,
      votes: result.votes,
      percentage: result.percentage,
      seats: result.seats
    }));
    
    res.status(200).json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        date: election.date
      },
      constituency: {
        id: constituency.id,
        name: constituency.name,
        totalSeats: constituency.seats,
        parties: partyResults
      }
    });
  } catch (error) {
    console.error('Error fetching constituency results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch constituency results'
    });
  }
});

// Get party performance across all constituencies for an election
router.get('/:electionId/party/:partyId', async (req: Request, res: Response) => {
  try {
    const electionId = parseInt(req.params.electionId);
    const partyId = parseInt(req.params.partyId);
    
    if (isNaN(electionId) || isNaN(partyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election or party ID'
      });
    }
    
    // Get election details
    const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
    
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }
    
    // Get party details
    const [party] = await db.select().from(parties).where(eq(parties.id, partyId));
    
    if (!party) {
      return res.status(404).json({
        success: false,
        message: 'Party not found'
      });
    }
    
    // Get results for this party in this election
    const results = await db
      .select({
        resultId: electionResults.id,
        constituencyId: electionResults.constituencyId,
        constituencyName: constituencies.name,
        votes: electionResults.votes,
        percentage: electionResults.percentage,
        seats: electionResults.seats
      })
      .from(electionResults)
      .innerJoin(constituencies, eq(electionResults.constituencyId, constituencies.id))
      .where(eq(electionResults.electionId, electionId))
      .where(eq(electionResults.partyId, partyId))
      .orderBy(desc(electionResults.percentage));
    
    // Calculate summary statistics
    const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);
    const totalSeats = results.reduce((sum, result) => sum + result.seats, 0);
    const avgPercentage = results.length > 0 
      ? results.reduce((sum, result) => sum + Number(result.percentage), 0) / results.length
      : 0;
    
    const constituencyResults = results.map(result => ({
      constituencyId: result.constituencyId,
      name: result.constituencyName,
      votes: result.votes,
      percentage: result.percentage,
      seats: result.seats
    }));
    
    res.status(200).json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        date: election.date
      },
      party: {
        id: party.id,
        name: party.name,
        color: party.color,
        summary: {
          totalVotes,
          totalSeats,
          avgPercentage: parseFloat(avgPercentage.toFixed(2)),
          constituenciesContested: results.length
        },
        constituencies: constituencyResults
      }
    });
  } catch (error) {
    console.error('Error fetching party results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch party results'
    });
  }
});

// Get national summary for an election
router.get('/:electionId/summary', async (req: Request, res: Response) => {
  try {
    const electionId = parseInt(req.params.electionId);
    
    if (isNaN(electionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid election ID'
      });
    }
    
    // Get election details
    const [election] = await db.select().from(elections).where(eq(elections.id, electionId));
    
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }
    
    // Get national summary by party
    const partySummary = await db
      .select({
        partyId: parties.id,
        partyName: parties.name,
        partyColor: parties.color,
        totalVotes: sql<number>`SUM(${electionResults.votes})`,
        totalSeats: sql<number>`SUM(${electionResults.seats})`,
        avgPercentage: sql<number>`AVG(${electionResults.percentage})`,
        constituenciesContested: sql<number>`COUNT(DISTINCT ${electionResults.constituencyId})`
      })
      .from(electionResults)
      .innerJoin(parties, eq(electionResults.partyId, parties.id))
      .where(eq(electionResults.electionId, electionId))
      .groupBy(parties.id, parties.name, parties.color)
      .orderBy(desc(sql<number>`SUM(${electionResults.seats})`), desc(sql<number>`SUM(${electionResults.votes})`));
    
    const totalVotes = partySummary.reduce((sum, party) => sum + party.totalVotes, 0);
    const totalSeats = partySummary.reduce((sum, party) => sum + party.totalSeats, 0);
    
    const partyResults = partySummary.map(party => ({
      partyId: party.partyId,
      name: party.partyName,
      color: party.partyColor,
      votes: party.totalVotes,
      seats: party.totalSeats,
      percentage: parseFloat((party.totalVotes / totalVotes * 100).toFixed(2)),
      avgPercentage: typeof party.avgPercentage === 'number' ? parseFloat(party.avgPercentage.toFixed(2)) : party.avgPercentage,
      constituenciesContested: party.constituenciesContested
    }));
    
    res.status(200).json({
      success: true,
      election: {
        id: election.id,
        name: election.name,
        date: election.date,
        type: election.type,
        turnout: election.turnout,
        description: election.description
      },
      summary: {
        totalVotes,
        totalSeats,
        parties: partyResults
      }
    });
  } catch (error) {
    console.error('Error fetching election summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch election summary'
    });
  }
});

export default router;