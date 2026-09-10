import {
  users,
  partySentimentVotes,
  politicalEvolution,
  quizResults,
  emailVerificationTokens,
  type User,
  type InsertUser,
  type UpsertUser,
  type PartySentimentVote,
  type PoliticalEvolution,
  type QuizResult,
} from "@shared/schema";
import {
  type PoliticalEvolutionInput,
  type QuizResultInput,
  type ApiResponse,
} from "@shared/types";
import { db } from "./db";
import { eq, sql, and, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations - updated for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(userData: UpsertUser): Promise<User>;
  createUser(userData: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;

  // Verification operations
  setVerificationCode(id: string, code: string, expiresAt: Date): Promise<void>;
  createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getEmailVerificationToken(token: string): Promise<{userId: string; token: string; expiresAt: Date} | null>;
  deleteEmailVerificationToken(token: string): Promise<void>;

  // Quiz and political evolution operations
  saveQuizResult(result: QuizResultInput): Promise<ApiResponse<QuizResult>>;
  getQuizResultByShareCode(shareCode: string): Promise<QuizResult | null>;
  savePoliticalEvolution(evolution: PoliticalEvolutionInput): Promise<PoliticalEvolution>;
  getPoliticalEvolutionById(id: string): Promise<PoliticalEvolution | null>;
  getPoliticalEvolutionByUserId(userId: string): Promise<PoliticalEvolution[]>;
  updatePoliticalEvolution(id: string, data: Partial<PoliticalEvolutionInput>): Promise<PoliticalEvolution>;
  
  // Party sentiment operations
  upsertPartySentimentVote(userId: string, partyId: string, sentimentScore: number): Promise<PartySentimentVote>;
  getPartySentimentData(partyId: string): Promise<{ trustVotes: number; distrustVotes: number; totalVotes: number; score: number }>;
  getUserPartySentimentVote(userId: string, partyId: string): Promise<PartySentimentVote | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations - updated for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Assign admin role to samjmc3@hotmail.com
    const userDataWithRole = {
      ...userData,
      role: userData.email === 'samjmc3@hotmail.com' ? 'admin' : 'user',
      updatedAt: new Date(),
    };

    const [user] = await db
      .insert(users)
      .values(userDataWithRole)
      .onConflictDoUpdate({
        target: users.id,
        set: userDataWithRole,
      })
      .returning();
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    // Alias for upsertUser - uses same insert logic with conflict resolution
    return this.upsertUser(userData);
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User> {
    if (!db) throw new Error('Database not initialized');
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error(`User ${id} not found`);
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, phoneNumber));
    return user || undefined;
  }

  async setVerificationCode(id: string, code: string, expiresAt: Date): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db
      .update(users)
      .set({
        verificationCode: code,
        verificationExpires: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db
      .insert(emailVerificationTokens)
      .values({
        userId,
        token,
        expiresAt,
      })
      .onConflictDoNothing();
  }

  async getEmailVerificationToken(token: string): Promise<{userId: string; token: string; expiresAt: Date} | null> {
    if (!db) throw new Error('Database not initialized');
    const [record] = await db
      .select({
        userId: emailVerificationTokens.userId,
        token: emailVerificationTokens.token,
        expiresAt: emailVerificationTokens.expiresAt,
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
    return record || null;
  }

  async deleteEmailVerificationToken(token: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
  }

  // Quiz and political evolution operations - stub implementations
  async saveQuizResult(result: QuizResultInput): Promise<ApiResponse<QuizResult>> {
    // TODO: Implement when quiz_results table is available
    console.log('saveQuizResult called with:', result);
    return { success: true, data: result as QuizResult };
  }

  async getQuizResultByShareCode(shareCode: string): Promise<QuizResult | null> {
    // TODO: Implement when quiz_results table is available
    console.log('getQuizResultByShareCode called with:', shareCode);
    return null;
  }

  async savePoliticalEvolution(evolution: PoliticalEvolutionInput): Promise<PoliticalEvolution> {
    try {
      // Use Supabase REST client since Drizzle ORM db is null
      const { supabaseDb } = await import('./db');
      if (!supabaseDb) {
        throw new Error('Database not initialized');
      }

      const { data, error } = await supabaseDb
        .from('political_evolution')
        .insert({
          user_id: evolution.userId,
          economic_score: evolution.economicScore?.toString(),
          social_score: evolution.socialScore?.toString(),
          cultural_score: evolution.culturalScore?.toString(),
          globalism_score: evolution.globalismScore?.toString(),
          environmental_score: evolution.environmentalScore?.toString(),
          authority_score: evolution.authorityScore?.toString(),
          welfare_score: evolution.welfareScore?.toString(),
          technocratic_score: evolution.technocraticScore?.toString(),
          ideology: evolution.ideology || 'Unknown',
          quiz_version: evolution.quizVersion || 'enhanced',
          quiz_result_id: evolution.quizResultId || null,
          notes: evolution.notes || null,
          label: evolution.label || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving political evolution:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error saving political evolution:', error);
      throw error;
    }
  }

  async getPoliticalEvolutionById(id: string): Promise<PoliticalEvolution | null> {
    try {
      const [evolution] = await db
        .select()
        .from(politicalEvolution)
        .where(eq(politicalEvolution.id, parseInt(id)));
      return evolution || null;
    } catch (error) {
      console.error('Error getting political evolution by ID:', error);
      return null;
    }
  }

  async getPoliticalEvolutionByUserId(userId: string): Promise<PoliticalEvolution[]> {
    try {
      const evolutions = await db
        .select()
        .from(politicalEvolution)
        .where(eq(politicalEvolution.userId, userId))
        .orderBy(desc(politicalEvolution.createdAt));
      return evolutions;
    } catch (error) {
      console.error('Error getting political evolution by user ID:', error);
      return [];
    }
  }

  async updatePoliticalEvolution(id: string, data: Partial<PoliticalEvolutionInput>): Promise<PoliticalEvolution> {
    try {
      const [updatedEvolution] = await db
        .update(politicalEvolution)
        .set(data)
        .where(eq(politicalEvolution.id, parseInt(id)))
        .returning();
      return updatedEvolution;
    } catch (error) {
      console.error('Error updating political evolution:', error);
      throw error;
    }
  }

  // Party sentiment operations
  async upsertPartySentimentVote(userId: string, partyId: string, sentimentScore: number): Promise<PartySentimentVote> {
    const [vote] = await db
      .insert(partySentimentVotes)
      .values({
        userId,
        partyId,
        sentimentScore,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [partySentimentVotes.userId, partySentimentVotes.partyId],
        set: {
          sentimentScore,
          updatedAt: new Date(),
        },
      })
      .returning();
    return vote;
  }

  async getPartySentimentData(partyId: string): Promise<{ trustVotes: number; distrustVotes: number; totalVotes: number; score: number }> {
    const votes = await db
      .select({
        sentimentScore: partySentimentVotes.sentimentScore,
      })
      .from(partySentimentVotes)
      .where(eq(partySentimentVotes.partyId, partyId));

    const totalVotes = votes.length;
    const trustVotes = votes.filter(v => v.sentimentScore > 50).length;
    const distrustVotes = votes.filter(v => v.sentimentScore < 50).length;
    
    // Calculate score using the formula: Score = 50 + 50 × (Trust - Distrust) / Max(Total, 1000)
    const netVotes = trustVotes - distrustVotes;
    const maxVotes = Math.max(totalVotes, 1000);
    const score = Math.max(0, Math.min(100, Math.round(50 + (50 * netVotes) / maxVotes)));

    return {
      trustVotes,
      distrustVotes,
      totalVotes,
      score: totalVotes >= 50 ? score : 50, // Return neutral 50 if below minimum threshold
    };
  }

  async getUserPartySentimentVote(userId: string, partyId: string): Promise<PartySentimentVote | undefined> {
    const [vote] = await db
      .select()
      .from(partySentimentVotes)
      .where(and(
        eq(partySentimentVotes.userId, userId),
        eq(partySentimentVotes.partyId, partyId)
      ));
    return vote || undefined;
  }
}

export const storage = new DatabaseStorage();