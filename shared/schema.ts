import { relations } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, date, varchar, decimal, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** A political party with ideological positions on the political compass. */
export interface PoliticalParty {
  id: string;
  name: string;
  country: string;
  economic: number;
  social: number;
  description: string;
  color: string;
}

// Users table - updated for Replit Auth compatibility
/** Drizzle ORM table definition for user accounts. */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(), // Replit user ID
  username: varchar("username", { length: 100 }).unique(),
  password: varchar("password", { length: 100 }),
  email: varchar("email", { length: 100 }).unique(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  county: varchar("county", { length: 50 }),
  bio: text("bio"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  phoneVerified: boolean("phone_verified").default(false),
  role: varchar("role", { length: 20 }).default("user"), // 'user', 'bot', 'admin'
  emailVerified: boolean("email_verified").default(false),
  verificationCode: varchar("verification_code", { length: 255 }),
  verificationExpires: timestamp("verification_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User preferences table for profile/geo data split
/** Drizzle ORM table definition for user preferences. */
export const userPreferences = pgTable("user_preferences", {
  userId: varchar("user_id", { length: 100 }).primaryKey().references(() => users.id, { onDelete: "cascade" }),
  county: varchar("county", { length: 50 }),
  bio: text("bio"),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table for Replit Auth
/** Drizzle ORM table definition for user sessions. */
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export type UpsertUser = typeof users.$inferInsert;

// User locations table for constituency tracking
/** Drizzle ORM table definition for user locations. */
export const userLocations = pgTable("user_locations", {
  id: serial("id").primaryKey(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  constituency: varchar("constituency", { length: 100 }),
  county: varchar("county", { length: 50 }),
  accuracy: integer("accuracy"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User activity tracking table
/** Drizzle ORM table definition for user activity tracking. */
export const userActivity = pgTable("user_activity", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // voted_poll, created_post, completed_quiz, etc.
  metadata: text("metadata"), // JSON string for flexible data storage
  ipAddress: varchar("ip_address", { length: 45 }), // For geolocation tracking
  userAgent: text("user_agent"), // Browser/device info
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_activity_user_id").on(table.userId),
]);

// Email verification tokens table
/** Drizzle ORM table definition for email verification tokens. */
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Phone verification tokens table
/** Drizzle ORM table definition for phone verification tokens. */
export const phoneVerificationTokens = pgTable("phone_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  token: varchar("token", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Two-factor authentication tokens table
/** Drizzle ORM table definition for two-factor authentication tokens. */
export const twoFactorTokens = pgTable("two_factor_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  token: varchar("token", { length: 6 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'email_verification', 'login', 'password_reset'
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Political parties table with 8-dimensional scoring
/** Drizzle ORM table definition for political parties. */
export const parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  abbreviation: varchar("abbreviation", { length: 20 }),
  color: varchar("color", { length: 20 }).notNull(),
  logo: text("logo"),
  description: text("description"),
  
  // Traditional 2D positioning (legacy)
  economicPosition: decimal("economic_position", { precision: 3, scale: 1 }),
  socialPosition: decimal("social_position", { precision: 3, scale: 1 }),
  
  // Enhanced 8-dimensional scoring
  economicScore: decimal("economic_score", { precision: 3, scale: 1 }),
  socialScore: decimal("social_score", { precision: 3, scale: 1 }),
  culturalScore: decimal("cultural_score", { precision: 3, scale: 1 }),
  globalismScore: decimal("globalism_score", { precision: 3, scale: 1 }),
  environmentalScore: decimal("environmental_score", { precision: 3, scale: 1 }),
  authorityScore: decimal("authority_score", { precision: 3, scale: 1 }),
  welfareScore: decimal("welfare_score", { precision: 3, scale: 1 }),
  technocraticScore: decimal("technocratic_score", { precision: 3, scale: 1 }),
  
  // Scoring rationales as JSON strings
  dimensionRationales: text("dimension_rationales"),
  
  // Additional party info
  foundedYear: integer("founded_year"),
  website: text("website"),
});

// Constituencies table
/** Drizzle ORM table definition for constituencies. */
export const constituencies = pgTable("constituencies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  county: varchar("county", { length: 50 }).notNull(),
  seats: integer("seats").notNull(),
  population: integer("population"),
  registeredVoters: integer("registered_voters"),
  geoData: text("geo_data"),
  economicScore: decimal("economic_score", { precision: 3, scale: 1 }),
  socialScore: decimal("social_score", { precision: 3, scale: 1 }),
});

// Elections table
/** Drizzle ORM table definition for elections. */
export const elections = pgTable("elections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  date: timestamp("date").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // general, local, european, etc.
  turnout: decimal("turnout", { precision: 5, scale: 2 }), // percentage
  description: text("description"),
});

// Election results table (stores results by constituency and party)
/** Drizzle ORM table definition for election results. */
export const electionResults = pgTable("election_results", {
  id: serial("id").primaryKey(),
  electionId: integer("election_id").notNull().references(() => elections.id),
  constituencyId: integer("constituency_id").notNull().references(() => constituencies.id),
  partyId: integer("party_id").notNull().references(() => parties.id),
  votes: integer("votes").notNull(),
  percentage: decimal("percentage", { precision: 5, scale: 2 }).notNull(),
  seats: integer("seats").notNull(),
  firstPreference: integer("first_preference"),
});

// Candidates table
/** Drizzle ORM table definition for candidates. */
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  partyId: integer("party_id").references(() => parties.id),
  constituencyId: integer("constituency_id").references(() => constituencies.id),
  electionId: integer("election_id").references(() => elections.id),
  elected: varchar("elected", { length: 5 }).default("false"),
  votes: integer("votes"),
  position: integer("position"), // final position after count
});

// Party sentiment votes table
/** Drizzle ORM table definition for party sentiment votes. */
export const partySentimentVotes = pgTable("party_sentiment_votes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  partyId: varchar("party_id", { length: 50 }).notNull(),
  sentimentScore: integer("sentiment_score").notNull(), // 0-100 scale
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userPartyUnique: unique("user_party_sentiment_unique").on(table.userId, table.partyId),
}));

export type PartySentimentVote = typeof partySentimentVotes.$inferSelect;

// Relations
/** Drizzle relations for the users table. */
export const usersRelations = relations(users, ({ many }) => ({
  emailVerificationTokens: many(emailVerificationTokens),
  twoFactorTokens: many(twoFactorTokens),
}));

/** Drizzle relations for the emailVerificationTokens table. */
export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

/** Drizzle relations for the twoFactorTokens table. */
export const twoFactorTokensRelations = relations(twoFactorTokens, ({ one }) => ({
  user: one(users, {
    fields: [twoFactorTokens.userId],
    references: [users.id],
  }),
}));

/** Drizzle relations for the parties table. */
export const partiesRelations = relations(parties, ({ many }) => ({
  electionResults: many(electionResults),
  candidates: many(candidates),
}));

/** Drizzle relations for the constituencies table. */
export const constituenciesRelations = relations(constituencies, ({ many }) => ({
  electionResults: many(electionResults),
  candidates: many(candidates),
}));

/** Drizzle relations for the elections table. */
export const electionsRelations = relations(elections, ({ many }) => ({
  electionResults: many(electionResults),
  candidates: many(candidates),
}));

/** Drizzle relations for the electionResults table. */
export const electionResultsRelations = relations(electionResults, ({ one }) => ({
  election: one(elections, {
    fields: [electionResults.electionId],
    references: [elections.id],
  }),
  constituency: one(constituencies, {
    fields: [electionResults.constituencyId],
    references: [constituencies.id],
  }),
  party: one(parties, {
    fields: [electionResults.partyId],
    references: [parties.id],
  }),
}));

/** Drizzle relations for the candidates table. */
export const candidatesRelations = relations(candidates, ({ one }) => ({
  party: one(parties, {
    fields: [candidates.partyId],
    references: [parties.id],
  }),
  constituency: one(constituencies, {
    fields: [candidates.constituencyId],
    references: [constituencies.id],
  }),
  election: one(elections, {
    fields: [candidates.electionId],
    references: [elections.id],
  }),
}));

// Zod schemas for validation
/** Zod insert-schema for creating a user record. */
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true }).extend({
  latitude: z.number().optional().transform(val => val?.toString()),
  longitude: z.number().optional().transform(val => val?.toString())
});
/** Zod insert-schema for creating a user activity record. */
export const insertUserActivitySchema = createInsertSchema(userActivity).omit({ id: true, createdAt: true });
/** Zod insert-schema for creating an email verification token record. */
export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({ id: true, createdAt: true });
/** Zod insert-schema for creating a two-factor token record. */
export const insertTwoFactorTokenSchema = createInsertSchema(twoFactorTokens).omit({ id: true, createdAt: true });
/** Zod insert-schema for creating a party record. */
export const insertPartySchema = createInsertSchema(parties).omit({ id: true });
/** Zod insert-schema for creating a constituency record. */
export const insertConstituencySchema = createInsertSchema(constituencies).omit({ id: true });
/** Zod insert-schema for creating an election record. */
export const insertElectionSchema = createInsertSchema(elections).omit({ id: true });
/** Zod insert-schema for creating an election result record. */
export const insertElectionResultSchema = createInsertSchema(electionResults).omit({ id: true });
/** Zod insert-schema for creating a candidate record. */
export const insertCandidateSchema = createInsertSchema(candidates);

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserActivity = typeof userActivity.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = z.infer<typeof insertEmailVerificationTokenSchema>;

export type TwoFactorToken = typeof twoFactorTokens.$inferSelect;
export type InsertTwoFactorToken = z.infer<typeof insertTwoFactorTokenSchema>;

export type Party = typeof parties.$inferSelect;
export type InsertParty = z.infer<typeof insertPartySchema>;

export type Constituency = typeof constituencies.$inferSelect;
export type InsertConstituency = z.infer<typeof insertConstituencySchema>;

export type Election = typeof elections.$inferSelect;
export type InsertElection = z.infer<typeof insertElectionSchema>;

export type ElectionResult = typeof electionResults.$inferSelect;
export type InsertElectionResult = z.infer<typeof insertElectionResultSchema>;

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

// User location schema
/** Zod insert-schema for creating a user location record. */
export const insertUserLocationSchema = createInsertSchema(userLocations);
export type UserLocation = typeof userLocations.$inferSelect;
export type InsertUserLocation = z.infer<typeof insertUserLocationSchema>;

// ============================================
// SHADOW CABINET (Level 10 Agent System)
// ============================================

/** Drizzle ORM table definition for shadow cabinet analyses. */
export const shadowCabinetAnalyses = pgTable("shadow_cabinet_analyses", {
  id: serial("id").primaryKey(),
  articleTitle: text("article_title").notNull(),
  articleUrl: text("article_url").notNull(),
  
  // The Team
  deployedAgents: text("deployed_agents"), // JSON array ["Economist", "Strategist"]
  managerReasoning: text("manager_reasoning"),
  protocolOverrides: text("protocol_overrides"), // JSON array
  
  // The Outputs
  finalVerdict: text("final_verdict"),
  futuristTimeline: text("futurist_timeline"),
  agentReports: text("agent_reports"), // JSON string of full reports
  
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert-schema for creating a shadow cabinet analysis record. */
export const insertShadowCabinetAnalysisSchema = createInsertSchema(shadowCabinetAnalyses).omit({ 
  id: true, 
  createdAt: true 
});

export type ShadowCabinetAnalysis = typeof shadowCabinetAnalyses.$inferSelect;
export type InsertShadowCabinetAnalysis = z.infer<typeof insertShadowCabinetAnalysisSchema>;

// ============================================
// QA AUDITS (System Health)
// ============================================

/** Drizzle ORM table definition for QA audits. */
export const qaAudits = pgTable("qa_audits", {
  id: serial("id").primaryKey(),
  auditType: text("audit_type").notNull(), // 'internal_consistency', 'external_truth'
  anomaliesFound: integer("anomalies_found").default(0),
  report: text("report"), // JSON string of anomalies
  createdAt: timestamp("created_at").defaultNow(),
});

/** Zod insert-schema for creating a QA audit record. */
export const insertQaAuditSchema = createInsertSchema(qaAudits).omit({ 
  id: true, 
  createdAt: true 
});

export type QaAudit = typeof qaAudits.$inferSelect;
export type InsertQaAudit = z.infer<typeof insertQaAuditSchema>;