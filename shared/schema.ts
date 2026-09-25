import { relations } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, date, varchar, decimal, index, unique } from "drizzle-orm/pg-core";
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

// User activity tracking table
/** Drizzle ORM table definition for user activity tracking. */
export const userActivity = pgTable("user_activity", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 100 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(), // voted_poll, created_post, completed_quiz, etc.
  metadata: text("metadata"), // JSON string for flexible data storage
  ipAddress: varchar("ip_address", { length: 45 }), // For geolocation tracking
  userAgent: text("user_agent"), // Browser/device info
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_activity_user_id").on(table.userId),
]);

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
/** Zod insert-schema for creating a user activity record. */
export const insertUserActivitySchema = createInsertSchema(userActivity).omit({ id: true, createdAt: true });
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
export type UserActivity = typeof userActivity.$inferSelect;
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;

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