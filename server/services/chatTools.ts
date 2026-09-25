import { db } from "../db";
import { ilike } from "drizzle-orm";
import {
  parties
} from "@shared/schema";
import type { DivisionVote, TdVote } from "@shared/parliamentApi";
import { questionsAsked, repository as scores, scoredComponents } from "../scoring";
import * as newsRepo from "../news/repository";
import { repository as parliament } from "../parliament";

const VOTE_LABEL: Record<DivisionVote, string> = { ta: 'Tá (Yes)', nil: 'Níl (No)', staon: 'Staon (Abstain)' };

function describeVote(v: TdVote) {
  return {
    date: v.date,
    subject: v.subject,
    debate: v.debateTitle,
    vote: VOTE_LABEL[v.vote],
    outcome: v.outcome,
    voted_with_party: v.withParty,
  };
}

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
      description: "Check how a politician actually voted in Dáil divisions on a bill or topic. Use this when asked 'Did they vote for X?', 'How did they vote on Y?', or any voting-related question. Matches the topic against the division subject and the debate title; supports a date range.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "The full name of the politician."
          },
          topic: {
            type: "string",
            description: "The bill name or a word from it to search for (e.g. 'Finance', 'Planning and Development')."
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
      description: "Get a politician's Dáil record: attendance at votes, votes cast, how often they voted with their party, votes against their party, questions asked and debate participation.",
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
    const isPresiding = found.stats?.isPresiding ?? false;

    // 2. Get Recent News mentions
    const news = (await newsRepo.feedForTd(td.name, 3)).map((a) => ({
      title: a.title,
      summary: a.summary,
      date: a.publishedAt
    }));

    // 3. Dáil record
    const record = await parliament.tdSummary(td.id);

    return JSON.stringify({
      profile: {
        name: td.name,
        party: td.party,
        constituency: td.constituency,
        overall_score: score?.overallScore ?? null,
        rank: score?.nationalRank ?? null
      },
      // Built only from the Oireachtas record. null = not expected or not measurable, never 0.
      scores: {
        holds_the_chair: isPresiding,
        components: scoredComponents({
          questions: questionsAsked(td.questionCountOral, td.questionCountWritten),
          attendancePct: td.attendancePct,
          committeeAttendancePct: td.committeeAttendancePct,
          debate: score?.debateScore ?? null,
          isPresiding
        }),
        pillars: {
          parliamentary: score?.parliamentaryScore ?? null,
          debate: score?.debateScore ?? null
        }
      },
      recent_news: news,
      parliament: record ?? "No Dáil record yet"
    });
  },

  async get_voting_record({ name, topic, startDate, endDate }: { name: string; topic: string; startDate?: string; endDate?: string }) {
    console.log(`Tool: Getting voting record for '${name}' on topic '${topic}'${startDate ? ` from ${startDate}` : ''}${endDate ? ` to ${endDate}` : ''}`);
    
    const found = await scores.findByName(name);
    if (!found) return JSON.stringify({ error: "Politician not found." });

    const needle = topic.trim().toLowerCase();
    const votes = (await parliament.votesOf(found.td.id))
      .filter((v) => (!startDate || v.date >= startDate) && (!endDate || v.date <= endDate))
      .filter((v) => `${v.subject ?? ''} ${v.debateTitle ?? ''}`.toLowerCase().includes(needle))
      .slice(0, 10);

    if (votes.length === 0) {
      return JSON.stringify({
        message: `No Dáil votes found for ${found.td.name} matching '${topic}'${startDate || endDate ? ' in the specified date range' : ''}. Try a word from the bill's title.`,
        votes: []
      });
    }

    return JSON.stringify({
      politician: found.td.name,
      topic: topic,
      date_range: startDate || endDate ? { start: startDate || 'any', end: endDate || 'any' } : 'all time',
      votes_found: votes.length,
      votes: votes.map(describeVote)
    });
  },

  async get_voting_stats({ name }: { name: string }) {
    console.log(`Tool: Getting voting stats for '${name}'`);
    
    const found = await scores.findByName(name);
    if (!found) return JSON.stringify({ error: "Politician not found." });
    const record = await parliament.tdSummary(found.td.id);
    if (!record || record.votesCast === null) {
      return JSON.stringify({ error: "No Dáil voting record available yet." });
    }
    const votes = await parliament.votesOf(found.td.id);

    return JSON.stringify({
      politician: found.td.name,
      is_chair: record.isPresiding,
      attendance_pct: record.attendancePct,
      votes_cast: record.votesCast,
      divisions_held_while_member: record.divisionsEligible,
      breakdown: {
        ta_yes: votes.filter((v) => v.vote === 'ta').length,
        nil_no: votes.filter((v) => v.vote === 'nil').length,
        staon_abstain: votes.filter((v) => v.vote === 'staon').length
      },
      party_line_pct: record.partyLinePct,
      votes_against_party: record.votesAgainstParty,
      questions: { oral: record.questionsOral, written: record.questionsWritten },
      debate_sections_spoken: record.sectionsSpoken
    });
  },

  async get_rebel_votes({ name }: { name: string }) {
    console.log(`Tool: Getting rebel votes for '${name}'`);
    
    const found = await scores.findByName(name);
    if (!found) return JSON.stringify({ error: "Politician not found." });
    const votes = await parliament.votesOf(found.td.id, { againstParty: true, limit: 10 });

    if (votes.length === 0) {
      return JSON.stringify({
        message: `${found.td.name} has no recorded Dáil votes against their party's majority (independents have no party line).`,
        votes: []
      });
    }

    return JSON.stringify({
      politician: found.td.name,
      rebel_votes_found: votes.length,
      note: "Votes where the politician voted differently from their party's majority position.",
      votes: votes.map(describeVote)
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
  }
};


