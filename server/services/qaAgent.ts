import { db } from "../db";
import { unifiedTDScores, tdScores, qaAudits } from "@shared/schema";
import { eq } from "drizzle-orm";

// A simple internal audit to find data mismatches
export async function runInternalAudit() {
    console.log("🕵️ Running Internal Data Audit...");
    const anomalies: string[] = [];

    const unified = await db.select().from(unifiedTDScores);
    const legacy = await db.select().from(tdScores);

    // 1. Check for Missing TDs
    const unifiedNames = new Set(unified.map(u => u.politicianName));
    const legacyNames = new Set(legacy.map(l => l.politicianName));

    legacy.forEach(l => {
        if (!unifiedNames.has(l.politicianName)) {
            anomalies.push(`⚠️ MISSING: ${l.politicianName} exists in Legacy scores but NOT in Unified scores.`);
        }
    });

    // 2. Check for Major Score Discrepancies (Drift)
    // Note: ELO (1500) and Score (50.00) are different scales, so we check purely for direction or existence
    // But we can check if Party matches
    for (const u of unified) {
        const l = legacy.find(x => x.politicianName === u.politicianName);
        if (l) {
            if (u.party !== l.party) {
                anomalies.push(`⚠️ CONFLICT: ${u.politicianName} Party mismatch. Unified: '${u.party}' vs Legacy: '${l.party}'`);
            }
            if (u.constituency !== l.constituency) {
                anomalies.push(`⚠️ CONFLICT: ${u.politicianName} Constituency mismatch. Unified: '${u.constituency}' vs Legacy: '${l.constituency}'`);
            }
        }
    }

    console.log(`🕵️ Audit Complete. Found ${anomalies.length} anomalies.`);
    
    // Save to DB
    try {
        await db.insert(qaAudits).values({
            auditType: "internal_consistency",
            anomaliesFound: anomalies.length,
            report: JSON.stringify(anomalies),
        });
        console.log("✅ Saved Audit Report to DB.");
    } catch (e) {
        console.error("Failed to save Audit Report:", e);
    }

    return anomalies;
}

// Placeholder for External Truth Check (requires Tavily)
export async function runExternalTruthCheck() {
    // Future implementation: Search web for TD status
    return [];
}
