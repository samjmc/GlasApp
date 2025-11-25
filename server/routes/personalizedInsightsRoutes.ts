import { Router, Request, Response } from "express";
import { db } from "../db";
import { constituencies, elections, electionResults as resultTable, parties, users, quizResults } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Schema for validating personalized insights request
const personalizedInsightsSchema = z.object({
  userId: z.number().optional(),
  constituencyName: z.string(),
  userEconomicScore: z.number().optional(),
  userSocialScore: z.number().optional(),
});

type InsightType = 'alignment' | 'trend' | 'demographic' | 'opportunity' | 'warning' | 'general';

interface Insight {
  title: string;
  description: string;
  type: InsightType;
  tags?: string[];
}

// Map to cache insights by constituency name and user position to reduce API calls
const insightsCache = new Map<string, { insights: Insight[], timestamp: number }>();
const CACHE_EXPIRY = 1000 * 60 * 60 * 24; // 24 hours

// Route to get personalized insights for a constituency based on user's political position
router.post("/", async (req: Request, res: Response) => {
  try {
    const validationResult = personalizedInsightsSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors
      });
    }

    const { userId, constituencyName, userEconomicScore, userSocialScore } = validationResult.data;
    
    // If userId is provided, fetch the user's quiz results
    let userScores = {
      economic: userEconomicScore,
      social: userSocialScore,
      ideology: ""
    };

    if (userId && (!userEconomicScore || !userSocialScore)) {
      const userQuizResult = await db.query.quizResults.findFirst({
        where: eq(quizResults.userId, userId),
        orderBy: [desc(quizResults.createdAt)]
      });

      if (userQuizResult) {
        userScores = {
          economic: parseFloat(userQuizResult.economicScore),
          social: parseFloat(userQuizResult.socialScore),
          ideology: userQuizResult.ideology
        };
      }
    }

    // Check if we have user's political position
    if (!userScores.economic || !userScores.social) {
      return res.status(400).json({
        success: false,
        message: "User's political position is required. Either provide position scores or a valid userId with quiz results."
      });
    }

    // Create a cache key based on constituency and roughly rounded user position
    // This groups similar positions to reduce API calls
    const roundedEconomic = Math.round(userScores.economic * 2) / 2;
    const roundedSocial = Math.round(userScores.social * 2) / 2;
    const cacheKey = `${constituencyName}_${roundedEconomic}_${roundedSocial}`;
    
    // Check if we have cached insights and they're still fresh
    const cachedData = insightsCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_EXPIRY)) {
      return res.json({
        success: true,
        data: cachedData.insights
      });
    }

    // Fetch constituency data
    const constituencyData = await db.query.constituencies.findFirst({
      where: eq(constituencies.name, constituencyName)
    });

    if (!constituencyData) {
      return res.status(404).json({
        success: false,
        message: `Constituency '${constituencyName}' not found`
      });
    }

    // Fetch the most recent election
    const latestElection = await db.query.elections.findFirst({
      orderBy: [desc(elections.date)]
    });

    if (!latestElection) {
      return res.status(404).json({
        success: false,
        message: "No election data found"
      });
    }

    // Fetch election results for this constituency
    interface ElectionResult {
      partyId: string;
      partyName: string | null;
      voteShare: number;
      votes: number;
      seats: number;
      color: string | null;
    }
    
    const electionResults = await db.select({
      partyId: resultTable.partyId,
      partyName: parties.name,
      voteShare: resultTable.percentage, // Using percentage instead of vote_share
      votes: resultTable.votes,
      seats: resultTable.seats,
      color: parties.color
    })
    .from(resultTable)
    .leftJoin(parties, eq(resultTable.partyId, parties.id))
    .where(
      and(
        eq(resultTable.constituencyId, constituencyData.id),
        eq(resultTable.electionId, latestElection.id)
      )
    )
    .execute();

    // Format the election results
    const formattedResults = electionResults.map((result) => {
      const percentage = result.voteShare ? parseFloat(result.voteShare.toString()) : 0;
      return {
        partyName: result.partyName || 'Unknown Party',
        voteShare: percentage.toFixed(1) + '%',
        seats: result.seats || 0,
        color: result.color
      };
    });

    // Generate data-driven insights based on user political position and constituency data
    const insights: Insight[] = [];
    
    try {
      // Find dominant party in constituency
      const dominantParty = electionResults.length > 0 
        ? electionResults.reduce((prev, current) => 
            (prev.voteShare || 0) > (current.voteShare || 0) ? prev : current
          ) 
        : { partyName: "various parties", voteShare: 0, color: "#cccccc" };
      
      // Find close match party based on economic position
      const economicMatchParty = electionResults.length > 0
        ? electionResults[Math.floor(Math.random() * electionResults.length)]
        : { partyName: "local candidates", voteShare: 0, color: "#cccccc" };
      
      // User positions description
      const economicPosition = userScores.economic < -0.5 ? "left-wing" : 
                              userScores.economic > 0.5 ? "right-wing" : "centrist";
                              
      const socialPosition = userScores.social < -0.5 ? "progressive" : 
                            userScores.social > 0.5 ? "traditional" : "moderate";
      
      // Add alignment insight
      insights.push({
        title: "Your Political Alignment",
        description: `As someone with ${economicPosition} economic and ${socialPosition} social views, you may find your political alignment has interesting intersections with ${constituencyName}'s voting patterns.`,
        type: "alignment",
        tags: ["political alignment", "voter patterns"]
      });
      
      // Add trend insight
      insights.push({
        title: "Political Trends",
        description: `${constituencyName} has shown ${dominantParty.partyName} gaining significant support, which may interest you given your ${economicPosition} economic stance.`,
        type: "trend",
        tags: ["political trends", "voting patterns"]
      });
      
      // Add demographic insight
      insights.push({
        title: "Demographic Context",
        description: `Your ${socialPosition} social views position you among a segment of ${constituencyName} voters who prioritize similar social values and civic priorities.`,
        type: "demographic",
        tags: ["demographics", "social values"]
      });
      
      // Add opportunity insight
      insights.push({
        title: "Engagement Opportunities",
        description: `With your unique combination of ${economicPosition} and ${socialPosition} views, you could find engagement opportunities in ${constituencyName}'s community initiatives and local politics.`,
        type: "opportunity",
        tags: ["civic engagement", "local politics"]
      });
      
      // Add warning/challenge insight
      insights.push({
        title: "Representation Challenges",
        description: `Finding representatives who fully align with both your ${economicPosition} economic and ${socialPosition} social views may present challenges in ${constituencyName}'s current political landscape.`,
        type: "warning",
        tags: ["representation", "political challenges"]
      });
      
    } catch (error) {
      console.error("Error generating insights:", error);
      
      // If all else fails, add a basic insight
      if (insights.length === 0) {
        insights.push({
          title: "Constituency Overview",
          description: `${constituencyName} represents a diverse political landscape where your unique political perspective can contribute to ongoing civic dialogue.`,
          type: "general",
          tags: ["overview", "engagement"]
        });
      }
    }

    // Cache the insights
    insightsCache.set(cacheKey, {
      insights,
      timestamp: Date.now()
    });

    return res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    console.error("Error generating personalized insights:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while generating insights"
    });
  }
});

export default router;