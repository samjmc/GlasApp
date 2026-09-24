import { relations } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, date, varchar, decimal, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export quiz types so consumers can import them from "@shared/schema".
export type { QuizQuestion, UserResponse } from "./quizTypes";

// Political compass entity types
/** A political figure with ideological positions on the political compass. */
export interface PoliticalFigure {
  id: string;
  name: string;
  economic: number;
  social: number;
  description: string;
  imageUrl: string;
  distance?: number;
}

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

// Enhanced quiz results table to store multidimensional analysis
/** Drizzle ORM table definition for enhanced quiz results. */
export const quizResults = pgTable("quiz_results", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).references(() => users.id),
  // Original political compass scores
  economicScore: varchar("economic_score", { length: 10 }),
  socialScore: varchar("social_score", { length: 10 }),
  // Enhanced 8-dimensional scores
  economicDimension: decimal("economic_dimension", { precision: 4, scale: 1 }),
  socialDimension: decimal("social_dimension", { precision: 4, scale: 1 }),
  culturalDimension: decimal("cultural_dimension", { precision: 4, scale: 1 }),
  globalismDimension: decimal("globalism_dimension", { precision: 4, scale: 1 }),
  environmentalDimension: decimal("environmental_dimension", { precision: 4, scale: 1 }),
  authorityDimension: decimal("authority_dimension", { precision: 4, scale: 1 }),
  welfareDimension: decimal("welfare_dimension", { precision: 4, scale: 1 }),
  technocraticDimension: decimal("technocratic_dimension", { precision: 4, scale: 1 }),
  // General information
  ideology: varchar("ideology", { length: 100 }),
  description: text("description"),
  shareCode: varchar("share_code", { length: 20 }).unique(),
  isActive: integer("is_active").default(1), // 1 for true, 0 for false
  createdAt: timestamp("created_at").defaultNow(),
  // Additional fields for enhanced political analysis
  detailedAnalysis: text("detailed_analysis"),
  politicalValues: text("political_values"), // Stored as JSON string
  irishContextInsights: text("irish_context_insights"), // Stored as JSON string
}, (table) => [
  index("idx_quiz_results_user_id").on(table.userId),
]);

// Historical quiz results to track changes over time
// ARCHIVED 2026-09-14 (Phase 2B schema cleanup): the only code path that reads/writes this
// table (server/services/quizResultsService.ts, via server/routes/profileHistoryRoutes.ts)
// is never mounted in server/routes.ts and has zero live callers in client/src or server.
// The live quiz-history feature (/api/quiz-history, server/routes/quiz/index.ts) uses a
// separate raw-SQL "quiz_history" table via quizHistoryService.ts, not this Drizzle table.
// Physical table renamed to archived_quiz_results_history (see migrations/); the exported
// TS symbol name is kept unchanged so any existing (dead) code referencing it still compiles.
/** Drizzle ORM table definition for archived quiz result history. */
export const quizResultsHistory = pgTable("archived_quiz_results_history", {
  id: serial("id").primaryKey(),
  originalResultId: integer("original_result_id").references(() => quizResults.id),
  userId: varchar("user_id", { length: 100 }).references(() => users.id),
  // Original political compass scores
  economicScore: varchar("economic_score", { length: 10 }),
  socialScore: varchar("social_score", { length: 10 }),
  // Enhanced 8-dimensional scores
  economicDimension: decimal("economic_dimension", { precision: 4, scale: 1 }),
  socialDimension: decimal("social_dimension", { precision: 4, scale: 1 }),
  culturalDimension: decimal("cultural_dimension", { precision: 4, scale: 1 }),
  globalismDimension: decimal("globalism_dimension", { precision: 4, scale: 1 }),
  environmentalDimension: decimal("environmental_dimension", { precision: 4, scale: 1 }),
  authorityDimension: decimal("authority_dimension", { precision: 4, scale: 1 }),
  welfareDimension: decimal("welfare_dimension", { precision: 4, scale: 1 }),
  technocraticDimension: decimal("technocratic_dimension", { precision: 4, scale: 1 }),
  // General information
  ideology: varchar("ideology", { length: 100 }),
  description: text("description"),
  archivedAt: timestamp("archived_at").defaultNow(),
  // AI analysis data
  detailedAnalysis: text("detailed_analysis"),
  politicalValues: text("political_values"), // Stored as JSON string
  irishContextInsights: text("irish_context_insights"), // Stored as JSON string
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

// Political Evolution table
/** Drizzle ORM table definition for political evolution tracking. */
export const politicalEvolution = pgTable("political_evolution", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  economicScore: decimal("economic_score", { precision: 5, scale: 2 }).notNull(),
  socialScore: decimal("social_score", { precision: 5, scale: 2 }).notNull(),
  culturalScore: decimal("cultural_score", { precision: 5, scale: 2 }),
  globalismScore: decimal("globalism_score", { precision: 5, scale: 2 }),
  environmentalScore: decimal("environmental_score", { precision: 5, scale: 2 }),
  authorityScore: decimal("authority_score", { precision: 5, scale: 2 }),
  welfareScore: decimal("welfare_score", { precision: 5, scale: 2 }),
  technocraticScore: decimal("technocratic_score", { precision: 5, scale: 2 }),
  ideology: text("ideology").notNull(),
  quizVersion: text("quiz_version").default("basic"),
  quizResultId: integer("quiz_result_id").references(() => quizResults.id),
  notes: text("notes"),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  quizResults: many(quizResults),
  quizResultsHistory: many(quizResultsHistory),
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

/** Drizzle relations for the quizResults table. */
export const quizResultsRelations = relations(quizResults, ({ one, many }) => ({
  user: one(users, {
    fields: [quizResults.userId],
    references: [users.id],
  }),
  history: many(quizResultsHistory),
}));

/** Drizzle relations for the quizResultsHistory table. */
export const quizResultsHistoryRelations = relations(quizResultsHistory, ({ one }) => ({
  user: one(users, {
    fields: [quizResultsHistory.userId],
    references: [users.id],
  }),
  originalResult: one(quizResults, {
    fields: [quizResultsHistory.originalResultId],
    references: [quizResults.id],
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
/** Zod insert-schema for creating a quiz result record. */
export const insertQuizResultSchema = createInsertSchema(quizResults).omit({ id: true, createdAt: true });
/** Zod insert-schema for creating a quiz result history record. */
export const insertQuizResultHistorySchema = createInsertSchema(quizResultsHistory).omit({ id: true, archivedAt: true });
/** Zod insert-schema for creating a political evolution record. */
export const insertPoliticalEvolutionSchema = createInsertSchema(politicalEvolution).omit({ id: true, createdAt: true });
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

export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = z.infer<typeof insertQuizResultSchema>;

export type QuizResultHistory = typeof quizResultsHistory.$inferSelect;
export type InsertQuizResultHistory = z.infer<typeof insertQuizResultHistorySchema>;

export type PoliticalEvolution = typeof politicalEvolution.$inferSelect;
export type InsertPoliticalEvolution = z.infer<typeof insertPoliticalEvolutionSchema>;

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

// Problems table for top-level issues
/** Drizzle ORM table definition for problems. */
export const problems = pgTable("problems", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  isOfficial: boolean("is_official").default(false),
  isAdminOnly: boolean("is_admin_only").default(true),
  tags: text("tags"), // JSON array as text
  status: varchar("status", { length: 20 }).default("active"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  voteScore: integer("vote_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Solutions table for nested solutions under problems
/** Drizzle ORM table definition for solutions. */
export const solutions = pgTable("solutions", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id").notNull().references(() => problems.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  fullDescription: text("full_description"),
  userId: varchar("user_id", { length: 100 }).notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  isOfficial: boolean("is_official").default(false),
  isAdminOnly: boolean("is_admin_only").default(true),
  tags: text("tags"), // JSON array as text
  status: varchar("status", { length: 20 }).default("active"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  voteScore: integer("vote_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Legacy ideas table (keeping for migration compatibility)
/** Drizzle ORM table definition for legacy ideas. */
export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  fullDescription: text("full_description"),
  category: varchar("category", { length: 50 }).notNull(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  author: varchar("author", { length: 100 }).notNull(),
  isOfficial: boolean("is_official").default(false),
  isAdminOnly: boolean("is_admin_only").default(true),
  tags: text("tags"), // JSON array as text
  status: varchar("status", { length: 20 }).default("active"),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  voteScore: integer("vote_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Problem votes table for user voting on problems
/** Drizzle ORM table definition for problem votes. */
export const problemVotes = pgTable("problem_votes", {
  id: serial("id").primaryKey(),
  problemId: integer("problem_id").notNull().references(() => problems.id),
  userId: varchar("user_id", { length: 100 }).notNull(),
  voteType: varchar("vote_type", { length: 10 }).notNull(), // 'up' or 'down'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.problemId, table.userId), // One vote per user per problem
]);

// Solution votes table for user voting on solutions
/** Drizzle ORM table definition for solution votes. */
export const solutionVotes = pgTable("solution_votes", {
  id: serial("id").primaryKey(),
  solutionId: integer("solution_id").notNull().references(() => solutions.id),
  userId: varchar("user_id", { length: 100 }).notNull(),
  voteType: varchar("vote_type", { length: 10 }).notNull(), // 'up' or 'down'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.solutionId, table.userId), // One vote per user per solution
]);

// Legacy idea votes table (keeping for compatibility)
/** Drizzle ORM table definition for idea votes. */
export const ideaVotes = pgTable("idea_votes", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  voteType: varchar("vote_type", { length: 10 }).notNull(), // 'up' or 'down'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.ideaId, table.userId), // One vote per user per idea
]);

// Schema exports for problems and solutions
/** Zod insert-schema for creating a problem record. */
export const insertProblemSchema = createInsertSchema(problems).omit({ id: true, createdAt: true, updatedAt: true });
/** Zod insert-schema for creating a solution record. */
export const insertSolutionSchema = createInsertSchema(solutions).omit({ id: true, createdAt: true, updatedAt: true });
/** Zod insert-schema for creating a problem vote record. */
export const insertProblemVoteSchema = createInsertSchema(problemVotes).omit({ id: true, createdAt: true });
/** Zod insert-schema for creating a solution vote record. */
export const insertSolutionVoteSchema = createInsertSchema(solutionVotes).omit({ id: true, createdAt: true });

export type InsertProblem = z.infer<typeof insertProblemSchema>;
export type InsertSolution = z.infer<typeof insertSolutionSchema>;
export type InsertProblemVote = z.infer<typeof insertProblemVoteSchema>;
export type InsertSolutionVote = z.infer<typeof insertSolutionVoteSchema>;
export type SelectProblem = typeof problems.$inferSelect;
export type SelectSolution = typeof solutions.$inferSelect;
export type SelectProblemVote = typeof problemVotes.$inferSelect;
export type SelectSolutionVote = typeof solutionVotes.$inferSelect;

// Legacy schema exports (keeping for compatibility)
/** Zod insert-schema for creating an idea record. */
export const insertIdeaSchema = createInsertSchema(ideas).omit({ id: true, createdAt: true, updatedAt: true });
/** Zod insert-schema for creating an idea vote record. */
export const insertIdeaVoteSchema = createInsertSchema(ideaVotes).omit({ id: true, createdAt: true });

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type InsertIdeaVote = z.infer<typeof insertIdeaVoteSchema>;
export type SelectIdea = typeof ideas.$inferSelect;
export type SelectIdeaVote = typeof ideaVotes.$inferSelect;

// PARLIAMENTARY ACTIVITY (From Oireachtas API)
// Real-time parliamentary data
// ============================================

/** Drizzle ORM table definition for parliamentary activity. */
export const parliamentaryActivity = pgTable("parliamentary_activity", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).unique().notNull(),
  memberId: varchar("member_id", { length: 100 }),
  memberCode: varchar("member_code", { length: 100 }),
  party: varchar("party", { length: 100 }),
  constituency: varchar("constituency", { length: 100 }),
  
  // Activity metrics
  questionsAsked: integer("questions_asked").default(0),
  oralQuestions: integer("oral_questions").default(0),
  writtenQuestions: integer("written_questions").default(0),
  debates: integer("debates").default(0),
  votes: integer("votes").default(0),
  estimatedAttendance: integer("estimated_attendance").default(0),
  
  // Metadata
  lastActive: timestamp("last_active"),
  dataSource: varchar("data_source", { length: 50 }).default("oireachtas_api"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_parliamentary_politician").on(table.politicianName),
  index("idx_parliamentary_updated").on(table.updatedAt),
]);

/** Zod insert-schema for creating a parliamentary activity record. */
export const insertParliamentaryActivitySchema = createInsertSchema(parliamentaryActivity).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type ParliamentaryActivity = typeof parliamentaryActivity.$inferSelect;
export type InsertParliamentaryActivity = z.infer<typeof insertParliamentaryActivitySchema>;

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