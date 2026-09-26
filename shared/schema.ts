import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
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
