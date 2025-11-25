import { relations } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, date, varchar, decimal, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - updated for Replit Auth compatibility
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

// Session storage table for Replit Auth
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
export const userLocations = pgTable("user_locations", {
  id: serial("id").primaryKey(),
  firebaseUid: varchar("firebase_uid", { length: 100 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  constituency: varchar("constituency", { length: 100 }),
  county: varchar("county", { length: 50 }),
  accuracy: integer("accuracy"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User activity tracking table
export const userActivity = pgTable("user_activity", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // voted_poll, created_post, completed_quiz, etc.
  metadata: text("metadata"), // JSON string for flexible data storage
  ipAddress: varchar("ip_address", { length: 45 }), // For geolocation tracking
  userAgent: text("user_agent"), // Browser/device info
  createdAt: timestamp("created_at").defaultNow(),
});

// Email verification tokens table
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull().references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Phone verification tokens table
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
});

// Historical quiz results to track changes over time
export const quizResultsHistory = pgTable("quiz_results_history", {
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
export const elections = pgTable("elections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  date: timestamp("date").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // general, local, european, etc.
  turnout: decimal("turnout", { precision: 5, scale: 2 }), // percentage
  description: text("description"),
});

// Election results table (stores results by constituency and party)
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

// Pledge tracking table
export const pledges = pgTable("pledges", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull().references(() => parties.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  electionYear: integer("election_year").notNull(),
  targetDate: timestamp("target_date"),
  status: varchar("status", { length: 50 }).default("active"), // active, completed, failed, ongoing
  scoreType: varchar("score_type", { length: 20 }).notNull(), // fulfillment, advocacy
  score: decimal("score", { precision: 5, scale: 2 }).default("0"), // 0-100 score
  evidence: text("evidence"),
  sourceUrl: text("source_url"),
  defaultWeight: decimal("default_weight", { precision: 5, scale: 2 }).default("0"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pledge actions table (tracks specific actions taken on pledges)
export const pledgeActions = pgTable("pledge_actions", {
  id: serial("id").primaryKey(),
  pledgeId: integer("pledge_id").notNull().references(() => pledges.id),
  actionType: varchar("action_type", { length: 100 }).notNull(), // bill_introduced, vote_cast, speech_made, etc.
  description: text("description").notNull(),
  actionDate: timestamp("action_date").notNull(),
  impactScore: decimal("impact_score", { precision: 4, scale: 2 }).default("0"), // 0-10 impact rating
  sourceUrl: text("source_url"),
  evidenceDetails: text("evidence_details"), // JSON string for flexible data
  createdAt: timestamp("created_at").defaultNow(),
});

// Party performance scores table
export const partyPerformanceScores = pgTable("party_performance_scores", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull().references(() => parties.id),
  scoreType: varchar("score_type", { length: 50 }).notNull(), // performance, trustworthiness
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).notNull(),
  pledgeFulfillmentScore: decimal("pledge_fulfillment_score", { precision: 5, scale: 2 }),
  policyConsistencyScore: decimal("policy_consistency_score", { precision: 5, scale: 2 }),
  parliamentaryActivityScore: decimal("parliamentary_activity_score", { precision: 5, scale: 2 }),
  integrityScore: decimal("integrity_score", { precision: 5, scale: 2 }),
  transparencyScore: decimal("transparency_score", { precision: 5, scale: 2 }),
  factualAccuracyScore: decimal("factual_accuracy_score", { precision: 5, scale: 2 }),
  publicAccountabilityScore: decimal("public_accountability_score", { precision: 5, scale: 2 }),
  conflictAvoidanceScore: decimal("conflict_avoidance_score", { precision: 5, scale: 2 }),
  governmentStatus: varchar("government_status", { length: 20 }).notNull(), // government, opposition, coalition
  calculatedAt: timestamp("calculated_at").defaultNow(),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
});

// Pledge voting tables
export const pledgeCategoryWeights = pgTable("pledge_category_weights", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 255 }).notNull().unique(),
  defaultWeight: decimal("default_weight", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userCategoryVotes = pgTable("user_category_votes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userCategoryUnique: unique("user_category_unique").on(table.userId, table.category),
}));

export const userPledgeVotes = pgTable("user_pledge_votes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  pledgeId: integer("pledge_id").notNull().references(() => pledges.id),
  category: varchar("category", { length: 255 }).notNull(),
  importanceScore: integer("importance_score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userPledgeUnique: unique("user_pledge_unique").on(table.userId, table.pledgeId),
}));

// New simplified category ranking table
export const userCategoryRankings = pgTable("user_category_rankings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }).notNull(),
  rank: integer("rank").notNull(), // 1 = highest importance, 4 = lowest importance
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userCategoryRankUnique: unique("user_category_rank_unique").on(table.userId, table.category),
}));

// Party sentiment votes table
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

// Performance scores table
export const performanceScores = pgTable("performance_scores", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull().unique(),
  overallScore: integer("overall_score").notNull(), // 0-100 scale
  legislativeProductivity: integer("legislative_productivity").notNull(),
  parliamentaryEngagement: integer("parliamentary_engagement").notNull(),
  constituencyService: integer("constituency_service").notNull(),
  publicMediaImpact: integer("public_media_impact").notNull(),
  billsSponsored: integer("bills_sponsored").default(0),
  questionsAsked: integer("questions_asked").default(0),
  voteAttendance: integer("vote_attendance").default(0),
  committeeContributions: varchar("committee_contributions", { length: 255 }),
  debatesSpoken: integer("debates_spoken").default(0),
  clinicsHeld: integer("clinics_held").default(0),
  caseworkResolutionRate: integer("casework_resolution_rate").default(0),
  localProjectsSecured: integer("local_projects_secured").default(0),
  pressMentions: integer("press_mentions").default(0),
  socialMediaEngagement: integer("social_media_engagement").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PledgeCategoryWeight = typeof pledgeCategoryWeights.$inferSelect;
export type UserCategoryVote = typeof userCategoryVotes.$inferSelect;
export type UserPledgeVote = typeof userPledgeVotes.$inferSelect;
export type UserCategoryRanking = typeof userCategoryRankings.$inferSelect;
export type PartySentimentVote = typeof partySentimentVotes.$inferSelect;
export type PerformanceScore = typeof performanceScores.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  quizResults: many(quizResults),
  quizResultsHistory: many(quizResultsHistory),
  emailVerificationTokens: many(emailVerificationTokens),
  twoFactorTokens: many(twoFactorTokens),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

export const twoFactorTokensRelations = relations(twoFactorTokens, ({ one }) => ({
  user: one(users, {
    fields: [twoFactorTokens.userId],
    references: [users.id],
  }),
}));

export const quizResultsRelations = relations(quizResults, ({ one, many }) => ({
  user: one(users, {
    fields: [quizResults.userId],
    references: [users.id],
  }),
  history: many(quizResultsHistory),
}));

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

export const partiesRelations = relations(parties, ({ many }) => ({
  electionResults: many(electionResults),
  candidates: many(candidates),
  pledges: many(pledges),
  performanceScores: many(partyPerformanceScores),
}));

export const constituenciesRelations = relations(constituencies, ({ many }) => ({
  electionResults: many(electionResults),
  candidates: many(candidates),
}));

export const electionsRelations = relations(elections, ({ many }) => ({
  electionResults: many(electionResults),
  candidates: many(candidates),
}));

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

export const pledgesRelations = relations(pledges, ({ one, many }) => ({
  party: one(parties, {
    fields: [pledges.partyId],
    references: [parties.id],
  }),
  actions: many(pledgeActions),
}));

export const pledgeActionsRelations = relations(pledgeActions, ({ one }) => ({
  pledge: one(pledges, {
    fields: [pledgeActions.pledgeId],
    references: [pledges.id],
  }),
}));

export const partyPerformanceScoresRelations = relations(partyPerformanceScores, ({ one }) => ({
  party: one(parties, {
    fields: [partyPerformanceScores.partyId],
    references: [parties.id],
  }),
}));

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
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true }).extend({
  latitude: z.number().optional().transform(val => val?.toString()),
  longitude: z.number().optional().transform(val => val?.toString())
});
export const insertUserActivitySchema = createInsertSchema(userActivity).omit({ id: true, createdAt: true });
export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({ id: true, createdAt: true });
export const insertTwoFactorTokenSchema = createInsertSchema(twoFactorTokens).omit({ id: true, createdAt: true });
export const insertQuizResultSchema = createInsertSchema(quizResults).omit({ id: true, createdAt: true });
export const insertQuizResultHistorySchema = createInsertSchema(quizResultsHistory).omit({ id: true, archivedAt: true });
export const insertPoliticalEvolutionSchema = createInsertSchema(politicalEvolution).omit({ id: true, createdAt: true });
export const insertPartySchema = createInsertSchema(parties).omit({ id: true });
export const insertConstituencySchema = createInsertSchema(constituencies).omit({ id: true });
export const insertElectionSchema = createInsertSchema(elections).omit({ id: true });
export const insertElectionResultSchema = createInsertSchema(electionResults).omit({ id: true });
export const insertCandidateSchema = createInsertSchema(candidates);
export const insertPledgeSchema = createInsertSchema(pledges).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertPledgeActionSchema = createInsertSchema(pledgeActions).omit({ id: true, createdAt: true });
export const insertPartyPerformanceScoreSchema = createInsertSchema(partyPerformanceScores).omit({ id: true, calculatedAt: true, validFrom: true });

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

export type Pledge = typeof pledges.$inferSelect;
export type InsertPledge = z.infer<typeof insertPledgeSchema>;

export type PledgeAction = typeof pledgeActions.$inferSelect;
export type InsertPledgeAction = z.infer<typeof insertPledgeActionSchema>;

export type PartyPerformanceScore = typeof partyPerformanceScores.$inferSelect;
export type InsertPartyPerformanceScore = z.infer<typeof insertPartyPerformanceScoreSchema>;

// User location schema
export const insertUserLocationSchema = createInsertSchema(userLocations);
export type UserLocation = typeof userLocations.$inferSelect;
export type InsertUserLocation = z.infer<typeof insertUserLocationSchema>;

// Problems table for top-level issues
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
export const insertProblemSchema = createInsertSchema(problems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSolutionSchema = createInsertSchema(solutions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProblemVoteSchema = createInsertSchema(problemVotes).omit({ id: true, createdAt: true });
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
export const insertIdeaSchema = createInsertSchema(ideas).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIdeaVoteSchema = createInsertSchema(ideaVotes).omit({ id: true, createdAt: true });

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type InsertIdeaVote = z.infer<typeof insertIdeaVoteSchema>;
export type SelectIdea = typeof ideas.$inferSelect;
export type SelectIdeaVote = typeof ideaVotes.$inferSelect;

// ============================================================================
// NEWS SCORING SYSTEM TABLES
// Automated news aggregation, scoring, and TD performance tracking
// ============================================================================

// News articles table
export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 100 }).notNull(),
  publishedDate: timestamp("published_date").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  
  // TD linkage
  politicianName: varchar("politician_name", { length: 255 }),
  constituency: varchar("constituency", { length: 100 }),
  party: varchar("party", { length: 100 }),
  
  // AI Analysis results
  storyType: varchar("story_type", { length: 50 }), // scandal, achievement, policy_work, etc.
  sentiment: varchar("sentiment", { length: 20 }), // very_positive, positive, neutral, negative, very_negative
  impactScore: decimal("impact_score", { precision: 4, scale: 2 }), // -10.00 to +10.00
  
  // Dimensional impacts
  transparencyImpact: decimal("transparency_impact", { precision: 4, scale: 2 }),
  effectivenessImpact: decimal("effectiveness_impact", { precision: 4, scale: 2 }),
  integrityImpact: decimal("integrity_impact", { precision: 4, scale: 2 }),
  consistencyImpact: decimal("consistency_impact", { precision: 4, scale: 2 }),
  constituencyServiceImpact: decimal("constituency_service_impact", { precision: 4, scale: 2 }),
  
  // AI analysis details
  aiSummary: text("ai_summary"),
  aiReasoning: text("ai_reasoning"),
  keyQuotes: text("key_quotes"), // JSON array
  
  // Processing status
  processed: boolean("processed").default(false),
  scoreApplied: boolean("score_applied").default(false),
  needsReview: boolean("needs_review").default(false), // Flag for human review
  credibilityScore: decimal("credibility_score", { precision: 3, scale: 2 }).default("0.8"),
  
  // AI model info
  analyzedBy: varchar("analyzed_by", { length: 50 }), // 'claude', 'gpt4', 'both'
  crossChecked: boolean("cross_checked").default(false),
  
  // Image URL for frontend display
  imageUrl: text("image_url"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_news_politician").on(table.politicianName),
  index("idx_news_date").on(table.publishedDate),
  index("idx_news_processed").on(table.processed),
]);

// TD Scores table (ELO-style ratings)
export const tdScores = pgTable("td_scores", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull().unique(),
  constituency: varchar("constituency", { length: 100 }).notNull(),
  party: varchar("party", { length: 100 }),
  
  // Overall ELO score
  overallElo: integer("overall_elo").default(1500).notNull(),
  
  // Dimensional ELO scores
  transparencyElo: integer("transparency_elo").default(1500).notNull(),
  effectivenessElo: integer("effectiveness_elo").default(1500).notNull(),
  integrityElo: integer("integrity_elo").default(1500).notNull(),
  consistencyElo: integer("consistency_elo").default(1500).notNull(),
  constituencyServiceElo: integer("constituency_service_elo").default(1500).notNull(),
  
  // Statistics
  totalStories: integer("total_stories").default(0).notNull(),
  positiveStories: integer("positive_stories").default(0).notNull(),
  negativeStories: integer("negative_stories").default(0).notNull(),
  neutralStories: integer("neutral_stories").default(0).notNull(),
  
  // Rankings
  nationalRank: integer("national_rank"),
  constituencyRank: integer("constituency_rank"),
  partyRank: integer("party_rank"),
  
  // Week-over-week change
  weeklyEloChange: integer("weekly_elo_change").default(0),
  monthlyEloChange: integer("monthly_elo_change").default(0),
  
  // Metadata
  imageUrl: text("image_url"),
  bio: text("bio"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_td_constituency").on(table.constituency),
  index("idx_td_overall_elo").on(table.overallElo),
]);

// Score history for tracking changes over time
export const tdScoreHistory = pgTable("td_score_history", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull(),
  articleId: integer("article_id"), // References news_articles.id
  
  // Score changes
  oldOverallElo: integer("old_overall_elo").notNull(),
  newOverallElo: integer("new_overall_elo").notNull(),
  eloChange: integer("elo_change").notNull(),
  
  // What caused the change
  dimensionAffected: varchar("dimension_affected", { length: 50 }),
  impactScore: decimal("impact_score", { precision: 4, scale: 2 }),
  storyType: varchar("story_type", { length: 50 }),
  
  // Metadata
  articleUrl: text("article_url"),
  articleTitle: text("article_title"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_history_politician").on(table.politicianName),
  index("idx_history_date").on(table.createdAt),
]);

// News sources configuration
export const newsSources = pgTable("news_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  url: text("url").notNull(),
  rssFeed: text("rss_feed"),
  scrapingEnabled: boolean("scraping_enabled").default(true),
  credibilityScore: decimal("credibility_score", { precision: 3, scale: 2 }).default("0.8"),
  politicalBias: varchar("political_bias", { length: 20 }), // 'left', 'center', 'right', 'neutral'
  constituency: varchar("constituency", { length: 100 }), // null for national news
  lastScraped: timestamp("last_scraped"),
  articlesProcessed: integer("articles_processed").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scraping jobs log
export const scrapingJobs = pgTable("scraping_jobs", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'daily_scrape', 'manual_scrape', etc.
  status: varchar("status", { length: 20 }).notNull(), // 'running', 'completed', 'failed'
  
  // Results
  articlesFound: integer("articles_found").default(0),
  articlesProcessed: integer("articles_processed").default(0),
  tdsMentioned: integer("tds_mentioned").default(0),
  scoresUpdated: integer("scores_updated").default(0),
  
  // Error tracking
  errors: text("errors"), // JSON array of errors
  
  // Performance
  durationMs: integer("duration_ms"),
  
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Zod schemas for validation
export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({ id: true, createdAt: true, fetchedAt: true });
export const insertTDScoreSchema = createInsertSchema(tdScores).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertTDScoreHistorySchema = createInsertSchema(tdScoreHistory).omit({ id: true, createdAt: true });
export const insertNewsSourceSchema = createInsertSchema(newsSources).omit({ id: true, createdAt: true });
export const insertScrapingJobSchema = createInsertSchema(scrapingJobs).omit({ id: true, startedAt: true });

// TypeScript types
export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;

export type TDScore = typeof tdScores.$inferSelect;
export type InsertTDScore = z.infer<typeof insertTDScoreSchema>;

export type TDScoreHistory = typeof tdScoreHistory.$inferSelect;
export type InsertTDScoreHistory = z.infer<typeof insertTDScoreHistorySchema>;

export type NewsSource = typeof newsSources.$inferSelect;
export type InsertNewsSource = z.infer<typeof insertNewsSourceSchema>;

export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;

// ============================================
// UNIFIED TD SCORING SYSTEM
// Comprehensive 0-100 scale scoring
// ============================================

// Unified TD Scores table (main authoritative scores)
export const unifiedTDScores = pgTable("unified_td_scores", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).unique().notNull(),
  constituency: varchar("constituency", { length: 100 }).notNull(),
  party: varchar("party", { length: 100 }),
  
  // PRIMARY SCORES (0-100 scale) - What users see
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).default("50.00").notNull(),
  newsScore: decimal("news_score", { precision: 5, scale: 2 }).default("50.00"),
  parliamentaryScore: decimal("parliamentary_score", { precision: 5, scale: 2 }).default("50.00"),
  constituencyScore: decimal("constituency_score", { precision: 5, scale: 2 }).default("50.00"),
  publicTrustScore: decimal("public_trust_score", { precision: 5, scale: 2 }).default("50.00"),
  
  // Dimensional scores (0-100 each)
  transparencyScore: decimal("transparency_score", { precision: 5, scale: 2 }).default("50.00"),
  effectivenessScore: decimal("effectiveness_score", { precision: 5, scale: 2 }).default("50.00"),
  integrityScore: decimal("integrity_score", { precision: 5, scale: 2 }).default("50.00"),
  consistencyScore: decimal("consistency_score", { precision: 5, scale: 2 }).default("50.00"),
  constituencyServiceScore: decimal("constituency_service_score", { precision: 5, scale: 2 }).default("50.00"),
  
  // Legacy ELO scores (backward compatibility)
  overallElo: integer("overall_elo").default(1500),
  transparencyElo: integer("transparency_elo").default(1500),
  effectivenessElo: integer("effectiveness_elo").default(1500),
  integrityElo: integer("integrity_elo").default(1500),
  consistencyElo: integer("consistency_elo").default(1500),
  constituencyServiceElo: integer("constituency_service_elo").default(1500),
  
  // Rankings
  nationalRank: integer("national_rank"),
  constituencyRank: integer("constituency_rank"),
  partyRank: integer("party_rank"),
  
  // Trends
  weeklyChange: decimal("weekly_change", { precision: 5, scale: 2 }).default("0.00"),
  monthlyChange: decimal("monthly_change", { precision: 5, scale: 2 }).default("0.00"),
  trend: varchar("trend", { length: 20 }).default("stable"),
  
  // Statistics
  totalStories: integer("total_stories").default(0),
  positiveStories: integer("positive_stories").default(0),
  negativeStories: integer("negative_stories").default(0),
  neutralStories: integer("neutral_stories").default(0),
  questionsAsked: integer("questions_asked").default(0),
  attendancePercentage: decimal("attendance_percentage", { precision: 5, scale: 2 }),
  committeeParticipations: integer("committee_participations").default(0),
  billsProposed: integer("bills_proposed").default(0),
  billsPassed: integer("bills_passed").default(0),
  clinicsHeld: integer("clinics_held").default(0),
  casesResolved: integer("cases_resolved").default(0),
  
  // Quality indicators
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).default("0.50"),
  dataSourcesCount: integer("data_sources_count").default(0),
  lastNewsUpdate: timestamp("last_news_update"),
  lastParliamentaryUpdate: timestamp("last_parliamentary_update"),
  lastUserRatingUpdate: timestamp("last_user_rating_update"),
  
  // Metadata
  lastCalculated: timestamp("last_calculated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_unified_scores_overall").on(table.overallScore),
  index("idx_unified_scores_constituency").on(table.constituency),
  index("idx_unified_scores_party").on(table.party),
  index("idx_unified_scores_rank").on(table.nationalRank),
]);

// Unified Score History table
export const unifiedScoreHistory = pgTable("unified_score_history", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull(),
  
  // Changes
  oldOverallScore: decimal("old_overall_score", { precision: 5, scale: 2 }).notNull(),
  newOverallScore: decimal("new_overall_score", { precision: 5, scale: 2 }).notNull(),
  scoreChange: decimal("score_change", { precision: 5, scale: 2 }).notNull(),
  
  // Trigger
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  triggerId: integer("trigger_id"),
  primaryComponent: varchar("primary_component", { length: 50 }),
  componentChange: decimal("component_change", { precision: 5, scale: 2 }),
  
  // Snapshot
  newsScore: decimal("news_score", { precision: 5, scale: 2 }),
  parliamentaryScore: decimal("parliamentary_score", { precision: 5, scale: 2 }),
  constituencyScore: decimal("constituency_score", { precision: 5, scale: 2 }),
  publicTrustScore: decimal("public_trust_score", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_score_history_politician").on(table.politicianName, table.createdAt),
  index("idx_score_history_date").on(table.createdAt),
]);

// User TD Ratings table
export const userTDRatings = pgTable("user_td_ratings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  politicianName: varchar("politician_name", { length: 255 }).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  category: varchar("category", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("unique_user_politician_rating").on(table.userId, table.politicianName, table.category),
  index("idx_user_ratings_politician").on(table.politicianName),
  index("idx_user_ratings_user").on(table.userId),
]);

// Score calculation log
export const scoreCalculationLog = pgTable("score_calculation_log", {
  id: serial("id").primaryKey(),
  calculationType: varchar("calculation_type", { length: 50 }).notNull(),
  tdsAffected: integer("tds_affected").default(0),
  status: varchar("status", { length: 20 }).notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  dbQueries: integer("db_queries"),
  apiCalls: integer("api_calls"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Component weights configuration
export const scoreComponentWeights = pgTable("score_component_weights", {
  id: serial("id").primaryKey(),
  componentName: varchar("component_name", { length: 50 }).unique().notNull(),
  weight: decimal("weight", { precision: 3, scale: 2 }).notNull(),
  description: text("description"),
  active: boolean("active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas for unified scoring
export const insertUnifiedTDScoreSchema = createInsertSchema(unifiedTDScores).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  lastCalculated: true 
});

export const insertUnifiedScoreHistorySchema = createInsertSchema(unifiedScoreHistory).omit({ 
  id: true, 
  createdAt: true 
});

export const insertUserTDRatingSchema = createInsertSchema(userTDRatings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// TypeScript types
export type UnifiedTDScore = typeof unifiedTDScores.$inferSelect;
export type InsertUnifiedTDScore = z.infer<typeof insertUnifiedTDScoreSchema>;

export type UnifiedScoreHistory = typeof unifiedScoreHistory.$inferSelect;
export type InsertUnifiedScoreHistory = z.infer<typeof insertUnifiedScoreHistorySchema>;

export type UserTDRating = typeof userTDRatings.$inferSelect;
export type InsertUserTDRating = z.infer<typeof insertUserTDRatingSchema>;

// ============================================
// PARLIAMENTARY ACTIVITY (From Oireachtas API)
// Real-time parliamentary data
// ============================================

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

export const insertParliamentaryActivitySchema = createInsertSchema(parliamentaryActivity).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type ParliamentaryActivity = typeof parliamentaryActivity.$inferSelect;
export type InsertParliamentaryActivity = z.infer<typeof insertParliamentaryActivitySchema>;

// ============================================
// TD HISTORICAL BASELINES (AI-Generated Starting Points)
// AI researches each TD and assigns fair baseline
// ============================================

export const tdHistoricalBaselines = pgTable("td_historical_baselines", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).unique().notNull(),
  
  // Baseline scoring
  baselineModifier: decimal("baseline_modifier", { precision: 4, scale: 2 }).notNull().default("1.00"),
  baselineScore0_100: integer("baseline_score_0_100"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  
  // Categorization
  category: varchar("category", { length: 50 }), // severe_issues, moderate_issues, etc.
  
  // AI Analysis
  historicalSummary: text("historical_summary"),
  keyFindings: text("key_findings"), // JSON string
  reasoning: text("reasoning"),
  controversiesNoted: text("controversies_noted"), // JSON string
  dataQuality: text("data_quality"), // JSON string
  
  // Metadata
  researchDate: date("research_date"),
  analyzedBy: varchar("analyzed_by", { length: 50 }).default("claude"),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  reviewNotes: text("review_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_historical_baselines_politician").on(table.politicianName),
  index("idx_historical_baselines_category").on(table.category),
  index("idx_historical_baselines_modifier").on(table.baselineModifier),
  index("idx_historical_baselines_research_date").on(table.researchDate),
]);

export const insertTdHistoricalBaselineSchema = createInsertSchema(tdHistoricalBaselines).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type TdHistoricalBaseline = typeof tdHistoricalBaselines.$inferSelect;
export type InsertTdHistoricalBaseline = z.infer<typeof insertTdHistoricalBaselineSchema>;

// ============================================
// POLICY PROMISES (Bias Protection - Promise Tracking)
// Tracks announcements and verifies delivery
// ============================================

export const policyPromises = pgTable("policy_promises", {
  id: serial("id").primaryKey(),
  politicianName: varchar("politician_name", { length: 255 }).notNull(),
  promiseText: text("promise_text").notNull(),
  promiseType: varchar("promise_type", { length: 50 }),
  
  // Announcement
  announcedDate: date("announced_date").notNull(),
  sourceArticleId: integer("source_article_id"),
  initialScoreGiven: integer("initial_score_given"),
  
  // Promise details
  promisedAmount: varchar("promised_amount", { length: 100 }),
  promisedQuantity: varchar("promised_quantity", { length: 100 }),
  promisedOutcome: text("promised_outcome"),
  promisedTimeline: varchar("promised_timeline", { length: 100 }),
  
  // Target
  targetDate: date("target_date"),
  targetMetrics: text("target_metrics"),
  
  // Actual delivery
  actualAmount: varchar("actual_amount", { length: 100 }),
  actualQuantity: varchar("actual_quantity", { length: 100 }),
  actualOutcome: text("actual_outcome"),
  deliveryDate: date("delivery_date"),
  
  // Outcome
  status: varchar("status", { length: 20 }).default("pending"),
  outcomeVerifiedDate: date("outcome_verified_date"),
  outcomeScore: integer("outcome_score"),
  
  // Verification
  verificationSources: text("verification_sources"),
  verificationEvidence: text("verification_evidence"),
  verifiedBy: varchar("verified_by", { length: 50 }),
  
  // Follow-up
  lastChecked: date("last_checked"),
  nextCheckDate: date("next_check_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_policy_promises_politician").on(table.politicianName),
  index("idx_policy_promises_status").on(table.status),
  index("idx_policy_promises_target_date").on(table.targetDate),
  index("idx_policy_promises_next_check").on(table.nextCheckDate),
]);

export const insertPolicyPromiseSchema = createInsertSchema(policyPromises).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type PolicyPromise = typeof policyPromises.$inferSelect;
export type InsertPolicyPromise = z.infer<typeof insertPolicyPromiseSchema>;