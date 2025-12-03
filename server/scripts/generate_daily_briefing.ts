import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { runShadowCabinet, fetchTopPoliticalNews, type CabinetAnalysis } from "../services/shadowCabinet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const rootPath = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(rootPath, '.env') });

async function generateMarkdown(analyses: CabinetAnalysis[]) {
    const date = new Date().toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    let md = `# 🏛️ The Glas Morning Briefing\n**Date:** ${date}\n\n`;
    md += `> *"Don't just read the news. Decode it."* - The Shadow Cabinet\n\n---\n\n`;

    for (const analysis of analyses) {
        md += `## 📰 ${analysis.articleTitle}\n`;
        md += `🔗 [Read Original](${analysis.articleUrl})\n\n`;

        md += `### 🚨 The Protocol Triggered\n`;
        if (analysis.protocolOverrides.length > 0) {
            analysis.protocolOverrides.forEach(p => md += `- ⚠️ **${p}**\n`);
        } else {
            md += `- No automatic triggers. Manager discretion used.\n`;
        }
        md += `\n`;

        md += `### 🧠 The Verdict\n${analysis.finalVerdict}\n\n`;

        if (analysis.futuristTimeline) {
            md += `### 🔮 The Future Timeline\n${analysis.futuristTimeline}\n\n`;
        }

        md += `### 📂 Cabinet Reports\n`;
        for (const report of analysis.reports) {
            if (report.agentName === "Futurist" || report.status === "failed") continue; // Skip Futurist here as it's above
            
            md += `**${report.icon} ${report.agentName}**\n`;
            // Indent the content for cleaner reading
            md += `> ${report.content.replace(/\n/g, '\n> ')}\n\n`;
        }

        md += `---\n\n`;
    }

    return md;
}

async function main() {
    console.log("🚀 Starting Daily Briefing Generator...");
    
    const urls = await fetchTopPoliticalNews();
    console.log(`Found ${urls.length} stories to analyze.`);

    const analyses: CabinetAnalysis[] = [];

    for (const url of urls) {
        try {
            console.log(`\nAnalyze: ${url}`);
            const analysis = await runShadowCabinet(url);
            if (analysis) analyses.push(analysis);
        } catch (error) {
            console.error(`Failed to analyze ${url}:`, error);
        }
    }

    if (analyses.length === 0) {
        console.log("No analyses completed.");
        return;
    }

    const markdown = await generateMarkdown(analyses);
    
    const filename = `Daily_Briefing_${new Date().toISOString().split('T')[0]}.md`;
    const outputPath = path.join(rootPath, filename);
    
    fs.writeFileSync(outputPath, markdown);
    console.log(`\n✅ Briefing generated successfully: ${outputPath}`);
}

main();


