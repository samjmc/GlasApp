import {
  users,
  partySentimentVotes,
  politicalEvolution,
  quizResults,
  emailVerificationTokens,
  twoFactorTokens,
  phoneVerificationTokens,
  userActivity,
  type User,
  type InsertUser,
  type UpsertUser,
  type PartySentimentVote,
  type PoliticalEvolution,
  type QuizResult,
  type EmailVerificationToken,
  type InsertEmailVerificationToken,
} from "@shared/schema";
import {
  type PoliticalEvolutionInput,
  type QuizResultInput,
  type ApiResponse,
} from "@shared/types";
import { db } from "./db";
import { eq, sql, and, desc, lte, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

// Interface for storage operations
export interface IStorage {
  // User operations - updated for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(userData: UpsertUser): Promise<User>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: string | number, updates: Record<string, any>): Promise<User>;
  getUserByUsername(username: string | null | undefined): Promise<User | undefined>;
  getUserByEmail(email: string | null | undefined): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string | null | undefined): Promise<User | undefined>;

  // Verification operations
  setVerificationCode(userId: string | number, code: string, expiresAt: Date): Promise<void>;
  createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
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

  // NOTE: createUser, updateUser, getUserByUsername, getUserByEmail,
  // getUserByPhoneNumber, setVerificationCode, createEmailVerificationToken,
  // getEmailVerificationToken, and deleteEmailVerificationToken are implemented
  // further below (with JSDoc) — that implementation matches the actual call
  // signatures used by server/services/authService.ts and
  // server/routes/authRoutes.ts (object-arg createEmailVerificationToken,
  // numeric-or-string userId, null-safe lookups). Removed the duplicate,
  // incompatible-signature versions that used to live here to resolve the
  // rebase conflict between main and test-gate-fix.

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

  /**
   * Create a 2FA token for a user.
   * Used for email verification, login, or password reset flows.
   *
   * @param userId - User ID (from auth system)
   * @param token - 6-digit token code
   * @param type - Token type: 'email_verification', 'login', 'password_reset'
   * @param expiresAt - When token expires
   * @returns Created token record with id, userId, token, type, expiresAt, used, createdAt
   */
  // 2FA Token operations
  async create2FAToken(userId: string, token: string, type: string, expiresAt: Date): Promise<any> {
    if (!db) throw new Error('Database not initialized');
    const [result] = await db
      .insert(twoFactorTokens)
      .values({
        userId,
        token,
        type,
        expiresAt,
      })
      .returning();
    return result;
  }

  /**
   * Retrieve a valid (non-expired, unused) 2FA token.
   * Returns null if token not found, expired, already used, or code mismatch.
   *
   * @param userId - User ID
   * @param code - Token code to verify
   * @param type - Token type to match
   * @returns Token record if valid and non-expired; null otherwise
   */
  async get2FAToken(userId: string, code: string, type: string): Promise<any> {
    if (!db) throw new Error('Database not initialized');
    const now = new Date();
    const [result] = await db
      .select()
      .from(twoFactorTokens)
      .where(
        and(
          eq(twoFactorTokens.userId, userId),
          eq(twoFactorTokens.token, code),
          eq(twoFactorTokens.type, type),
          gte(twoFactorTokens.expiresAt, now),
          eq(twoFactorTokens.used, false)
        )
      );
    return result || null;
  }

  /**
   * Mark a 2FA token as used (consumed).
   * Prevents replay attacks by invalidating token after successful verification.
   *
   * @param tokenId - Token record ID
   */
  async mark2FATokenAsUsed(tokenId: number): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db
      .update(twoFactorTokens)
      .set({ used: true })
      .where(eq(twoFactorTokens.id, tokenId));
  }

  /**
   * Verify phone number via token code.
   * Marks token as used and updates user.phoneVerified flag if code is valid.
   *
   * @param userId - User ID
   * @param code - Verification code (6 digits)
   * @returns true if verification succeeded; false if code invalid, expired, or already used
   */
  // Phone verification operations
  async verifyUserPhone(userId: string, code: string): Promise<boolean> {
    if (!db) throw new Error('Database not initialized');
    const now = new Date();
    const [token] = await db
      .select()
      .from(phoneVerificationTokens)
      .where(
        and(
          eq(phoneVerificationTokens.userId, userId),
          eq(phoneVerificationTokens.token, code),
          gte(phoneVerificationTokens.expiresAt, now),
          eq(phoneVerificationTokens.used, false)
        )
      );

    if (token) {
      // Mark token as used
      await db
        .update(phoneVerificationTokens)
        .set({ used: true })
        .where(eq(phoneVerificationTokens.id, token.id));

      // Update user's phone_verified status
      await db
        .update(users)
        .set({ phoneVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return true;
    }
    return false;
  }

  /**
   * Retrieve user activity history starting from a given date.
   * Returns activity records sorted by creation date (newest first).
   * Used for tracking quiz completions, votes, quiz saves, etc.
   *
   * @param userId - User ID
   * @param startDate - Earliest date to retrieve activities from
   * @returns Array of activity records; empty array if none found
   */
  // Activity tracking operations
  async getUserActivityHistory(userId: string, startDate: Date): Promise<any[]> {
    if (!db) throw new Error('Database not initialized');
    const activities = await db
      .select()
      .from(userActivity)
      .where(
        and(
          eq(userActivity.userId, userId),
          lte(userActivity.createdAt, startDate)
        )
      )
      .orderBy(desc(userActivity.createdAt));
    return activities;
  }

  /**
   * Retrieve all users with role='bot'.
   * Used for bot behavior tracking and multi-agent scoring systems.
   *
   * @returns Array of bot user records
   */
  // Bot operations
  async getBotUsers(): Promise<User[]> {
    if (!db) throw new Error('Database not initialized');
    const bots = await db
      .select()
      .from(users)
      .where(eq(users.role, 'bot'));
    return bots;
  }

  /**
   * Retrieve a user by their username. Used for registration uniqueness checks and login lookup.
   */
  async getUserByUsername(username: string | null | undefined): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    if (!username) return undefined;
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  /**
   * Retrieve a user by their email address. Used for registration uniqueness checks.
   */
  async getUserByEmail(email: string | null | undefined): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  /**
   * Create a new user record. Generates the primary key since the users table has no default id generator.
   */
  async createUser(userData: InsertUser): Promise<User> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db
      .insert(users)
      .values({ id: randomUUID(), ...userData })
      .returning();
    return user;
  }

  /**
   * Update arbitrary fields on an existing user record (e.g. profile edits, verification flags).
   */
  async updateUser(id: string | number, updates: Record<string, any>): Promise<User> {
    if (!db) throw new Error('Database not initialized');
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, String(id)))
      .returning();
    return user;
  }

  /**
   * Retrieve a user by their phone number. Used to prevent duplicate phone registration.
   */
  async getUserByPhoneNumber(phoneNumber: string | null | undefined): Promise<User | undefined> {
    if (!db) throw new Error('Database not initialized');
    if (!phoneNumber) return undefined;
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user || undefined;
  }

  /**
   * Store a phone/SMS verification code and its expiration time on the user record.
   */
  async setVerificationCode(userId: string | number, code: string, expiresAt: Date): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db
      .update(users)
      .set({ verificationCode: code, verificationExpires: expiresAt, updatedAt: new Date() })
      .where(eq(users.id, String(userId)));
  }

  /**
   * Create an email verification token for a newly registered user.
   */
  async createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    if (!db) throw new Error('Database not initialized');
    const [token] = await db
      .insert(emailVerificationTokens)
      .values(data)
      .returning();
    return token;
  }

  /**
   * Retrieve an email verification token record by its token string.
   */
  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    if (!db) throw new Error('Database not initialized');
    const [result] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
    return result || undefined;
  }

  /**
   * Delete an email verification token after it has been used or has expired.
   */
  async deleteEmailVerificationToken(token: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));
  }
}

export const storage = new DatabaseStorage();