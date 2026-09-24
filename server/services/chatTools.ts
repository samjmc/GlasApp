import { db } from "../db";
import { supabaseDb } from "../db";
import { sql, desc, eq, ilike, or, and } from "drizzle-orm";
import {
  parties,
  parliamentaryActivity
} from "@shared/schema";
import { eloToPercent, repository as scores } from "../scoring";
import * as newsRepo from "../news/repository";
import { getVotingRecord, getRecentVotes, getVotingStats, getRebelVotes, getVotesByCategory, getPolicyPositions } from "./politicianAgent";

// Define the tools for OpenAI
/** OpenAI function tool definitions for chat tools. */
export const chatToolsDefinition = [
  {
    type: "function",
    function: {
      name: "search_politicians",
      description: "Search for Irish politicians (TDs) by name, party, or constituency to get their specific details.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Name of the politician, party, or constituency to search for (e.g., 'Mary Lou', 'Dublin West', 'Fianna Fail')."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_politician_details",
      description: "Get detailed performance scores, recent news, and activity data for a specific politician. Use search_politicians first if you don't have the exact name.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The exact full name of the politician."
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_voting_record",
      description: "Check how a politician actually voted on specific bills or topics. Use this when asked 'Did you vote for X?', 'How did you vote on Y?', or any voting-related questions. Supports filtering by category (housing, health, economy, foreign_affairs, justice, education, environment, social_welfare, defence, procedural) or by date range.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The full name of the politician."
          },
          topic: {
            type: "string",
            description: "The bill name, topic, category, or keyword to search for. Categories: housing, health, economy, foreign_affairs, justice, education, environment, social_welfare, defence, procedural."
          },
          startDate: {
            type: "string",
            description: "Optional start date filter in YYYY-MM-DD format (e.g., '2024-01-01')."
          },
          endDate: {
            type: "string",
            description: "Optional end date filter in YYYY-MM-DD format (e.g., '2024-12-31')."
          }
        },
        required: ["name", "topic"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_voting_stats",
      description: "Get overall voting statistics for a politician including total votes cast, party loyalty rate, rebel votes count, and breakdown by category (housing, health, economy, etc.).",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The full name of the politician."
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_rebel_votes",
      description: "Get votes where a politician voted against their party's majority position. Useful for questions about independence, breaking party line, or controversial votes.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The full name of the politician."
          }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_recent_political_news",
      description: "Get the latest political news articles, optionally filtered by a topic.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "Optional topic keyword (e.g., 'housing', 'health', 'budget')."
          },
          limit: {
            type: "number",
            description: "Number of articles to return (default 5)."
          }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "compare_positions",
        description: "Compare your position with another politician on a specific topic. Use this when asked 'How do you differ from X?' or 'Do you agree with Y?'.",
        parameters: {
          type: "object",
          properties: {
            other_politician_name: {
              type: "string",
              description: "The full name of the other politician to compare with."
            },
            topic: {
              type: "string",
              description: "The specific topic to compare (e.g. Housing, Health, Budget)."
            }
          },
          required: ["other_politician_name", "topic"]
        }
      }
    },
    {
      type: "function",
    function: {
      name: "get_party_info",
      description: "Get information about a political party including their ideological scores and description.",
      parameters: {
        type: "object",
        properties: {
          partyName: {
            type: "string",
            description: "The name of the political party (e.g., 'Sinn Féin', 'Fine Gael')."
          }
        },
        required: ["partyName"]
      }
    }
  }
];

// Implementation of the tools
/** Implementations of the chat tool functions. */
export const chatToolsImplementation = {
  async search_politicians({ query }: { query: string }) {
    console.log(`Tool: Searching politicians for '${query}'`);
    const results = (await scores.search(query, 5)).map(({ td, score }) => ({
      name: td.name,
      party: td.party,
      constituency: td.constituency,
      overallScore: score?.overallScore ?? null
    }));

    return JSON.stringify(results);
  },

  async get_politician_details({ name }: { name: string }) {
    console.log(`Tool: Getting details for '${name}'`);
    
    // 1. Get Scores
    const found = await scores.findByName(name);
    if (!found) {
      return JSON.stringify({ error: "Politician not found." });
    }
    const td = found.td;
    const score = found.score;

    // 2. Get Recent News mentions
    const news = (await newsRepo.feedForTd(td.name, 3)).map((a) => ({
      title: a.title,
      summary: a.summary,
      date: a.publishedAt,
      sentiment: a.sentiment
    }));

    // 3. Get Activity Stats
    const activity = await db.select()
      .from(parliamentaryActivity)
      .where(ilike(parliamentaryActivity.politicianName, name))
      .limit(1);

    // 4. Get Voting Stats
    const votingStats = await getVotingStats(name);

    return JSON.stringify({
      profile: {
        name: td.name,
        party: td.party,
        constituency: td.constituency,
        overall_score: score?.overallScore ?? null,
        rank: score?.nationalRank ?? null
      },
      scores: {
        transparency: eloToPercent(score?.transparencyElo),
        effectiveness: eloToPercent(score?.effectivenessElo),
        integrity: eloToPercent(score?.integrityElo),
        consistency: eloToPercent(score?.consistencyElo)
      },
      recent_news: news,
      parliamentary_activity: activity[0] || "No recent activity data",
      voting_stats: votingStats
    });
  },

  async get_voting_record({ name, topic, startDate, endDate }: { name: string; topic: string; startDate?: string; endDate?: string }) {
    console.log(`Tool: Getting voting record for '${name}' on topic '${topic}'${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}`);
    
    const filters = {
      ...(startDate && { startDate }),
      ...(endDate && { endDate })
    };
    
    const votes = await getVotingRecord(name, topic, 10, Object.keys(filters).length > 0 ? filters : undefined);
    
    if (votes.length === 0) {
      return JSON.stringify({ 
        message: `No votes found for ${name} matching '${topic}'${startDate || endDate ? ' in the specified date range' : ''}. They may not have voted on this specific topic, or try a different keyword or category (housing, health, economy, etc.).`,
        votes: [],
        available_categories: ['housing', 'health', 'economy', 'foreign_affairs', 'justice', 'education', 'environment', 'social_welfare', 'defence', 'procedural']
      });
    }

    return JSON.stringify({
      politician: name,
      topic: topic,
      date_range: startDate || endDate ? { start: startDate || 'any', end: endDate || 'any' } : 'all time',
      votes_found: votes.length,
      votes: votes.map(v => ({
        date: v.date,
        subject: v.subject,
        description: v.description,
        vote: v.vote === 'ta' ? 'Tá (Yes)' : v.vote === 'nil' ? 'Níl (No)' : 'Staon (Abstain)',
        outcome: v.outcome,
        category: v.category,
        voted_with_party: v.votedWithParty,
        rebel_vote: v.isRebelVote
      }))
    });
  },

  async get_voting_stats({ name }: { name: string }) {
    console.log(`Tool: Getting voting stats for '${name}'`);
    
    const stats = await getVotingStats(name);
    
    if (!stats) {
      return JSON.stringify({ error: "Politician not found or no voting data available." });
    }

    return JSON.stringify({
      politician: name,
      total_votes_cast: stats.totalVotes,
      breakdown: {
        ta_yes: stats.taVotes,
        nil_no: stats.nilVotes,
        staon_abstain: stats.staonVotes
      },
      party_loyalty_rate: `${stats.partyLoyaltyRate}%`,
      rebel_votes: stats.rebelVotes,
      votes_by_category: stats.votesByCategory
    });
  },

  async get_rebel_votes({ name }: { name: string }) {
    console.log(`Tool: Getting rebel votes for '${name}'`);
    
    const votes = await getRebelVotes(name, 10);
    
    if (votes.length === 0) {
      return JSON.stringify({ 
        message: `${name} has no recorded votes against their party line. They have consistently voted with their party.`,
        votes: []
      });
    }

    return JSON.stringify({
      politician: name,
      rebel_votes_found: votes.length,
      note: "These are votes where the politician voted differently from their party's majority position.",
      votes: votes.map(v => ({
        date: v.date,
        subject: v.subject,
        description: v.description,
        vote: v.vote === 'ta' ? 'Tá (Yes)' : v.vote === 'nil' ? 'Níl (No)' : 'Staon (Abstain)',
        outcome: v.outcome,
        category: v.category
      }))
    });
  },

  async get_recent_political_news({ topic, limit = 5 }: { topic?: string; limit?: number }) {
    console.log(`Tool: Getting news for topic '${topic || 'general'}'`);
    
    if (!db) {
      return JSON.stringify({ error: "Database not available" });
    }

    const results = (await newsRepo.searchRecent(topic, Math.min(Math.max(limit, 1), 20))).map((a) => ({
      title: a.title,
      summary: a.summary,
      date: a.publishedAt,
      source: a.source
    }));
    return JSON.stringify(results);
  },

  async get_party_info({ partyName }: { partyName: string }) {
    console.log(`Tool: Getting party info for '${partyName}'`);
    
    if (!db) {
      return JSON.stringify({ error: "Database not available" });
    }

    const party = await db.select()
      .from(parties)
      .where(ilike(parties.name, `%${partyName}%`))
      .limit(1);

    if (party.length === 0) return JSON.stringify({ error: "Party not found" });

    return JSON.stringify(party[0]);
  },

  async compare_positions({ other_politician_name, topic }: { other_politician_name: string; topic: string }) {
    console.log(`Tool: Comparing with '${other_politician_name}' on '${topic}'`);
    
    const { data: otherTd } = await supabaseDb
        .from('td_scores')
        .select('id, party, politician_name')
        .ilike('politician_name', other_politician_name)
        .single();
        
    if (!otherTd) return JSON.stringify({ error: `Politician '${other_politician_name}' not found.` });

    const positions = await getPolicyPositions(otherTd.politician_name, topic);
    const votes = await getVotingRecord(otherTd.politician_name, topic, 5);
    
    return JSON.stringify({
        other_politician: otherTd.politician_name,
        party: otherTd.party,
        topic: topic,
        policy_summary: positions.length > 0 ? positions[0].position_summary : "No structured policy summary available.",
        recent_relevant_votes: votes.map(v => ({
            date: v.date,
            subject: v.subject,
            vote: v.vote === 'ta' ? 'Tá (Yes)' : v.vote === 'nil' ? 'Níl (No)' : 'Staon (Abstain)',
            description: v.description
        }))
    });
  }
};


