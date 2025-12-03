import OpenAI from "openai";
import * as cheerio from "cheerio";
import { z } from "zod";
import { db } from "../db";
import { shadowCabinetAnalyses } from "@shared/schema";

// --- TYPES ---

export interface AgentReport {
    agentName: string;
    content: string;
    status: "pending" | "thinking" | "completed" | "failed";
    icon: string;
}

export interface CabinetAnalysis {
    articleTitle: string;
    articleUrl: string;
    managerDecision: {
        agents_to_deploy: string[];
        reasoning: string;
    };
    protocolOverrides: string[];
    reports: AgentReport[];
    finalVerdict: string;
    futuristTimeline?: string;
    timestamp: Date;
}

// --- CONFIG ---

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
let openai: OpenAI;

function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

// --- PROMPTS (The Brains) ---

const MANAGER_PROMPT = `
You are the 'Investigation Manager' (Level 9).
Your job is to assemble the best team to analyze an article.
You have the following specialists:
1. "Data Auditor" (Checks stats & methodology - Can Search Web)
2. "Media Critic" (Checks framing & bias)
3. "Vision Analyst" (Checks charts & maps for visual bias)
4. "Paradox Hunter" (Checks for counter-intuitive sociological truths)
5. "Follow-the-Money" (Checks for financial incentives/lobbying)
6. "History Teacher" (Checks for recurring crises/amnesia journalism)
7. "Bill Reader" (Checks actual legislative text vs media spin)
8. "Economist" (Checks fiscal impact, supply/demand, inflation)
9. "Political Strategist" (Checks coalition stability, polling, election cycles)
10. "Futurist" (Synthesizes predictions into a timeline)
11. "Systems Thinker" (Checks CROSS-DOMAIN friction: e.g. Housing vs Immigration vs Energy)

INPUT: Article Title + Content Chunks + Image List.
DECISION RULES:
- ALWAYS deploy "Data Auditor" if there are numbers/stats.
- ALWAYS deploy "Media Critic" if there are political quotes.
- If "Housing" AND "Immigration/Population" -> Deploy Systems Thinker.
- If "Energy" AND "Data Centers" -> Deploy Systems Thinker.
- If "Healthcare" AND "Aging Population" -> Deploy Systems Thinker.
- If "Budget", "Tax", "Inflation", "Ban", "Rent", "Price" -> Deploy Economist.
- If "Sinn Féin", "Fine Gael", "Minister", "Election", "Poll" -> Deploy Political Strategist.
- If predictive -> Deploy Futurist.

Output a JSON object:
{
  "agents_to_deploy": ["Data Auditor", "Media Critic", "Systems Thinker", "Economist", "Political Strategist"],
  "reasoning": "Article discusses Housing plan, quotes Sinn Féin (Strategist needed), and proposes Eviction Ban (Economist needed)."
}
`;

const SYSTEMS_THINKER_PROMPT = `
You are the 'Systems Thinker' agent.
Your job is to find the MATH that doesn't add up between different government departments.

LOOK FOR:
1. **Supply vs Demand Mismatches:**
   - Does the Housing Plan (Dept of Housing) account for the Immigration Plan (Dept of Justice)?
   - Does the Energy Plan (Dept of Energy) account for the Industrial Strategy (Dept of Enterprise)?

2. **Resource Constraints:**
   - Water, Electricity, Land, Labour.
   - If a policy demands X, where does X come from?

3. **The "Balloon Effect":**
   - If you squeeze a problem here (e.g. Rent Caps), where does it bulge out? (e.g. Homelessness).

TASK:
- Identify the "Siloed Policy" in the article.
- Search for the "Invisible Constraint" (e.g. search "Ireland immigration stats 2025" if reading about housing).
- Calculate the friction.
`;

const ECONOMIST_PROMPT = `
You are the 'Economist' agent.
Your job is to apply the lens of "The Seen vs The Unseen" (Bastiat).

CORE MENTAL MODELS:
1. **Opportunity Cost:**
   - If the article says "Govt spends €1B on X," you must ask: "What was NOT funded because of this?"
   - Where did the money come from? (Tax, Debt, Inflation).

2. **Second-Order Effects:**
   - Policy: "Rent Caps." -> First Order: "Cheaper rent." -> Second Order: "Landlords sell up, Supply drops."
   - Always predict the UNINTENDED consequence.

3. **Incentive Structures:**
   - "Show me the incentive, and I will show you the outcome."
   - Does this policy encourage bad behavior? (e.g. Does bail-out money encourage risky investing?)

TASK:
- Identify the Economic Fallacy in the article.
- Search for data on the *real* costs (Debt service cost, Inflation rate).
`;

const STRATEGIST_PROMPT = `
You are the 'Political Strategist' agent.
Your job is to read the "Game Theory" behind the news.

CORE MENTAL MODELS:
1. **The "Dead Cat" Strategy:**
   - Is this shocking story being released *today* to distract from a worse story? (e.g. Bad poll numbers).

2. **Cui Bono (Who Benefits?):**
   - Who specifically wins from this narrative? (A specific Minister? A Union? A Corporate Donor?).

3. **Voter Segmentation:**
   - Who is this quote FOR?
   - "Tough on crime" = For older, suburban voters.
   - "Climate action" = For younger, urban voters.
   - Identify the target audience.

4. **The "Trial Balloon":**
   - Is this a "leak" to test public reaction before making it official policy?

TASK:
- Decode the political maneuver.
- Search for recent polling data or scandals that explain *timing*.
`;

const FUTURIST_PROMPT = `
You are the 'Futurist' agent.
Your job is NOT to critique the article, but to PREDICT the outcome.
Synthesize the other agents' reports into a Timeline.

Output Format:
## 🔮 The Future Timeline
- **Short Term (1-4 weeks):** [What happens next? Protests? Poll dip?]
- **Medium Term (3-6 months):** [Implementation hurdles? Unintended consequences?]
- **Long Term (1-2 years):** [Structural change? Reversal of policy?]
`;

const FOLLOW_MONEY_PROMPT = `
You are the 'Follow-the-Money' agent.
Your job is to find the financial incentive.
- Who benefits from this narrative?
- Are there NGOs, Developers, or Lobbyists mentioned?
- Search for funding sources or government contracts if suspicious.
Use 'search_web' to find "Company X lobbying" or "NGO Y funding".
`;

const HISTORY_TEACHER_PROMPT = `
You are the 'History Teacher' agent.
Your job is to cure "Amnesia Journalism".
- Has this "New Crisis" happened before?
- Search for similar headlines from 5, 10, or 20 years ago.
- Contextualize: "This is the 5th time in a decade this 'emergency' has been declared."
Use 'search_web' to find archived news.
`;

const BILL_READER_PROMPT = `
You are the 'Bill Reader' agent.
Your job is to ignore the spin and find the LEGISLATION.
- If the article says "The Hate Speech Bill will ban memes," search for the ACTUAL TEXT.
- Verify if the specific clause exists.
- Quote the legislation to prove/disprove the claim.
Use 'search_web' to find "Oireachtas Bill text".
`;

const VISION_ANALYST_PROMPT = `
You are the 'Vision Analyst' (Level 4).
Your job is to be a **Forensic Data Detective**. 
Assume every chart or map is trying to MANIPULATE the reader.

Scrutinize the images provided:
1. **Color Manipulation:** Is 'red' used to imply danger in safe areas? Is the color scale misleading?
2. **Axis Truncation:** Does the Y-axis start at 0? If not, call it out as a lie.
3. **Map Bias:** Is this just a population density map? Are geographically large but empty areas dominating the visual?
4. **Data Cherry-Picking:** Does the visual match the text claims, or does it show something else?

OUTPUT RULES:
- If you find nothing wrong, state: "No visual manipulation detected."
- If you find potential bias, be BRUTALLY specific. Use words like "Misleading," "Alarmist," "Distorted."
- Quote the visual feature that is lying (e.g., "The use of dark red for 5% creates a false sense of crisis").

Output a "Visual Analysis Report".
`;

const PARADOX_HUNTER_PROMPT = `
You are the 'Paradox Hunter' (Level 6).
Your job is to identify **Inverse Correlations** and **Sociological Paradoxes** that simpler agents miss.

KEY LOGIC TO APPLY:
- **The Reporting Paradox:** High reported crime/violence often means HIGH TRUST in police/society, not high danger. (e.g. Sweden vs Afghanistan).
- **The Diagnosis Paradox:** High rates of disease often mean BETTER screening, not sicker people.
- **The Freedom Paradox:** High rates of protest often mean MORE democracy, not instability.

TASK:
Read the article. If it ranks countries/regions based on negative stats (crime, violence, etc.), ask yourself:
"Is this a map of Danger, or a map of Awareness?"

Output a "Sociological Reality Check".
`;

const DATA_AUDITOR_PROMPT = `
You are the 'Data Auditor' (Level 3).
Your job is to catch Statistical Lying. You are a cynical Statistician.

CORE LOGICAL FALLACIES TO CHECK:
1. **The Missing Denominator:**
   - "1000 more people are homeless!" -> Is the population bigger? What is the *percentage*?
   - Always ask: "Per Capita?"

2. **Base Rate Neglect:**
   - "Crime up 100%!" -> Did it go from 1 to 2?
   - Contextualize the raw numbers.

3. **Selection Bias:**
   - "80% of people agree." -> Who did they ask? (Twitter poll vs Census).

4. **Correlation != Causation:**
   - Just because X happened after Y, doesn't mean Y caused X.

TASK:
- Extract every number/claim.
- Use 'search_web' to find the RAW DATA (CSO, Eurostat).
- Verify if the article's interpretation matches the raw data.
`;

const MEDIA_CRITIC_PROMPT = `
You are the 'Media Critic'.
Your job is to deconstruct the **Linguistic Engineering** of the article.

CORE MANIPULATION TECHNIQUES:
1. **Passive Voice Distancing:**
   - "Mistakes were made" (Hides the culprit).
   - "Violence erupted" (Hides who started it).
   - DEMAND active voice: "Who did it?"

2. **The "But" Erasure:**
   - Headlines: "Economy Grows, BUT Inequality Worsens."
   - The part after "BUT" is the narrative they want you to believe.

3. **Opinion as Fact:**
   - Watch for adjectives: "The *controversial* bill," "The *disgraced* TD."
   - Who decided they were disgraced? Is that a fact or a label?

4. **Framing & Priming:**
   - Are they calling it a "spending bill" (sounds costly) or an "investment" (sounds profitable)?

TASK:
- Quote the specific biased sentences.
- Explain the manipulative technique being used.
`;

const EDITOR_PROMPT = `
You are the 'Senior Editor'.
Synthesize reports from your team into a "Glas Context Check".
Make sure to include the Futurist's prediction if available.
`;

// --- HELPERS ---

async function searchTavily(query: string) {
    console.log(`🔎 Searching Tavily for: "${query}"`);
    if (!TAVILY_API_KEY) return "Search unavailable.";
    
    try {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: true,
                max_results: 3
            })
        });
        const data = await response.json();
        return JSON.stringify(data.results || "No results found.");
    } catch (error) {
        return "Search failed.";
    }
}

async function runVisionAgent(imageUrls: string[], articleContext: string) {
    console.log(`👁️ Vision Analyst is looking at ${imageUrls.length} images...`);
    
    const content: any[] = [
        { type: "text", text: `Analyze these images in the context of this article:\n${articleContext.slice(0, 500)}...` }
    ];

    for (const url of imageUrls) {
        content.push({
            type: "image_url",
            image_url: { url: url }
        });
    }

    const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: VISION_ANALYST_PROMPT },
            { role: "user", content: content }
        ],
        max_tokens: 500
    });
    
    return completion.choices[0].message.content;
}

async function runLevel3Agent(agentName: string, systemPrompt: string, input: string) {
    console.log(`🤖 Agent '${agentName}' (Level 3) is thinking...`);
    const tools = [{
        type: "function",
        function: {
            name: "search_web",
            description: "Search the internet.",
            parameters: {
                type: "object",
                properties: { query: { type: "string" } },
                required: ["query"]
            }
        }
    }];

    const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: input }];
    const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        tools: tools as any,
        tool_choice: "auto"
    });

    const responseMsg = completion.choices[0].message;
    if (responseMsg.tool_calls) {
        messages.push(responseMsg as any);
        for (const toolCall of responseMsg.tool_calls) {
            if (toolCall.function.name === "search_web") {
                const args = JSON.parse(toolCall.function.arguments);
                const searchResult = await searchTavily(args.query);
                messages.push({ role: "tool", tool_call_id: toolCall.id, content: searchResult } as any);
            }
        }
        const second = await getOpenAI().chat.completions.create({ model: "gpt-4o", messages: messages as any });
        return second.choices[0].message.content || "No response";
    }
    return responseMsg.content || "No response";
}

async function runStandardAgent(agentName: string, systemPrompt: string, input: string) {
    console.log(`🤖 Agent '${agentName}' is thinking...`);
    const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: input }]
    });
    return completion.choices[0].message.content || "No response";
}

async function runManager(articleTitle: string, articleText: string, imageUrls: string[]) {
    console.log(`👔 Manager is assembling the team...`);
    
    const length = articleText.length;
    const head = articleText.slice(0, 500);
    const middle = articleText.slice(Math.floor(length / 2) - 250, Math.floor(length / 2) + 250);
    const tail = articleText.slice(length - 500, length);
    
    const input = `
    Article Title: ${articleTitle}
    
    --- HEAD ---
    ${head}
    
    --- MIDDLE ---
    ${middle}
    
    --- TAIL ---
    ${tail}
    
    Image Count: ${imageUrls.length}
    Image URLs: ${imageUrls.join(', ')}
    `;
    
    const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: MANAGER_PROMPT }, { role: "user", content: input }],
        response_format: { type: "json_object" }
    });
    
    return JSON.parse(completion.choices[0].message.content || "{}");
}

export async function fetchArticleContent(url: string): Promise<{ title: string, content: string, imageUrls: string[] } | null> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const title = $('h1').first().text().trim() || $('title').text().trim();
        
        const imageUrls: string[] = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('http')) {
                if (!src.includes('icon') && !src.includes('logo') && !src.includes('pixel')) {
                    imageUrls.push(src);
                }
            }
        });

        $('script, style, nav, header, footer, .ad, .social-share').remove();
        let content = $('article').text().trim();
        if (content.length < 200) content = $('main').text().trim();
        if (content.length < 200) content = $('p').map((i, el) => $(el).text()).get().join('\n\n');
        
        return { title, content: content.slice(0, 15000), imageUrls: imageUrls.slice(0, 5) };
    } catch (error) {
        console.error("Error fetching article:", error);
        return null;
    }
}

// --- NEWS FETCHER ---

export async function fetchTopPoliticalNews(): Promise<string[]> {
    try {
        console.log("Fetching top political news from RTE...");
        const response = await fetch("https://www.rte.ie/news/politics/", {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const urls: string[] = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/news/politics/20') && !urls.includes(href) && urls.length < 3) {
                // RTE relative paths
                const fullUrl = href.startsWith('http') ? href : `https://www.rte.ie${href}`;
                urls.push(fullUrl);
            }
        });
        
        // Fallback if RTE fails or structure changes, just return manual list for now to ensure robustness
        if (urls.length === 0) {
            console.log("Scraping failed, using fallback URLs.");
            return [
                "https://www.rte.ie/news/politics/2025/1128/1546360-homeless-figures/",
            ];
        }

        return [...new Set(urls)].slice(0, 3);
    } catch (error) {
        console.error("Error fetching news:", error);
        return [];
    }
}

// --- MAIN SERVICE ---

export async function runShadowCabinet(url: string): Promise<CabinetAnalysis | null> {
    const article = await fetchArticleContent(url);
    if (!article) return null;

    console.log(`\nStarting Shadow Cabinet Analysis for: "${article.title}"`);

    // 1. Manager Decides
    const decision = await runManager(article.title, article.content, article.imageUrls);
    let activeAgents = new Set<string>(decision.agents_to_deploy);
    const protocolOverrides: string[] = [];

    // 2. THE PROTOCOL (Overrides)
    if (article.content.match(/\d+(\.\d+)?%|\d{1,3}(,\d{3})*|€|\$/)) {
        if (!activeAgents.has("Data Auditor")) {
            activeAgents.add("Data Auditor");
            protocolOverrides.push("Data Auditor (Numbers Detected)");
        }
    }

    const politicalKeywords = ["Sinn Féin", "Fianna Fáil", "Fine Gael", "Social Democrats", "Labour", "Aontú", "PBP", "Minister", "TD", "Taoiseach", "Tánaiste", "Election", "Poll", "Vote"];
    if (politicalKeywords.some(keyword => article.content.includes(keyword))) {
        if (!activeAgents.has("Political Strategist")) {
            activeAgents.add("Political Strategist");
            protocolOverrides.push("Political Strategist (Political Entities Detected)");
        }
    }

    const economicKeywords = ["Inflation", "Budget", "Tax", "Rent", "Price", "Cost", "Economy", "GDP", "Debt", "Recession", "Market", "Supply", "Demand"];
    if (economicKeywords.some(keyword => article.content.includes(keyword))) {
        if (!activeAgents.has("Economist")) {
            activeAgents.add("Economist");
            protocolOverrides.push("Economist (Economic Terms Detected)");
        }
    }

    const legalKeywords = ["Bill", "Act", "Legislation", "Amendment", "Constitution", "Law"];
    if (legalKeywords.some(keyword => article.content.includes(keyword))) {
        if (!activeAgents.has("Bill Reader")) {
            activeAgents.add("Bill Reader");
            protocolOverrides.push("Bill Reader (Legal Terms Detected)");
        }
    }
    
    if (article.imageUrls.length > 0) {
        if (!activeAgents.has("Vision Analyst")) {
             activeAgents.add("Vision Analyst");
             protocolOverrides.push("Vision Analyst (Images Detected)");
        }
    }

    const futureKeywords = ["Plan", "Strategy", "Target", "Goal", "2030", "2050", "Future", "Predict", "Forecast", "Warning", "Risk"];
    if (futureKeywords.some(k => article.content.includes(k))) {
        if (!activeAgents.has("Futurist")) {
             activeAgents.add("Futurist");
             protocolOverrides.push("Futurist (Future Keywords Detected)");
        }
    }

    // 3. Execution
    const promises: Promise<any>[] = [];
    const reports: AgentReport[] = [];

    const addReport = async (name: string, icon: string, task: Promise<string>) => {
        try {
            const content = await task;
            reports.push({ agentName: name, content, status: "completed", icon });
        } catch (e) {
            reports.push({ agentName: name, content: "Failed to analyze.", status: "failed", icon });
        }
    };

    if (activeAgents.has("Data Auditor")) addReport("Data Auditor", "📊", runLevel3Agent("Data Auditor", DATA_AUDITOR_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Media Critic")) addReport("Media Critic", "🧐", runStandardAgent("Media Critic", MEDIA_CRITIC_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Vision Analyst") && article.imageUrls.length > 0) addReport("Vision Analyst", "👁️", runVisionAgent(article.imageUrls, article.content));
    if (activeAgents.has("Paradox Hunter")) addReport("Paradox Hunter", "🧩", runStandardAgent("Paradox Hunter", PARADOX_HUNTER_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Follow-the-Money")) addReport("Follow-the-Money", "💰", runLevel3Agent("Follow-the-Money", FOLLOW_MONEY_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("History Teacher")) addReport("History Teacher", "📜", runLevel3Agent("History Teacher", HISTORY_TEACHER_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Bill Reader")) addReport("Bill Reader", "⚖️", runLevel3Agent("Bill Reader", BILL_READER_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Economist")) addReport("Economist", "📉", runLevel3Agent("Economist", ECONOMIST_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Political Strategist")) addReport("Political Strategist", "♟️", runLevel3Agent("Political Strategist", STRATEGIST_PROMPT, `Analyze: ${article.content}`));
    if (activeAgents.has("Systems Thinker")) addReport("Systems Thinker", "⚙️", runLevel3Agent("Systems Thinker", SYSTEMS_THINKER_PROMPT, `Analyze: ${article.content}`));

    // Wait for reports to finish BEFORE running Futurist/Editor
    // (Note: original script ran promises in parallel but waited for them before Futurist)
    // Since addReport pushes to promises array? No, addReport awaits internally inside the function? 
    // No, I need to push the promise returned by addReport to a list.
    
    const agentTasks: Promise<void>[] = [];
    
    const taskRunner = async (name: string, icon: string, fn: () => Promise<string>) => {
        try {
            const content = await fn();
            reports.push({ agentName: name, content, status: "completed", icon });
        } catch (e) {
            reports.push({ agentName: name, content: "Error", status: "failed", icon });
        }
    };

    if (activeAgents.has("Data Auditor")) agentTasks.push(taskRunner("Data Auditor", "📊", () => runLevel3Agent("Data Auditor", DATA_AUDITOR_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Media Critic")) agentTasks.push(taskRunner("Media Critic", "🧐", () => runStandardAgent("Media Critic", MEDIA_CRITIC_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Vision Analyst") && article.imageUrls.length > 0) agentTasks.push(taskRunner("Vision Analyst", "👁️", () => runVisionAgent(article.imageUrls, article.content)));
    if (activeAgents.has("Paradox Hunter")) agentTasks.push(taskRunner("Paradox Hunter", "🧩", () => runStandardAgent("Paradox Hunter", PARADOX_HUNTER_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Follow-the-Money")) agentTasks.push(taskRunner("Follow-the-Money", "💰", () => runLevel3Agent("Follow-the-Money", FOLLOW_MONEY_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("History Teacher")) agentTasks.push(taskRunner("History Teacher", "📜", () => runLevel3Agent("History Teacher", HISTORY_TEACHER_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Bill Reader")) agentTasks.push(taskRunner("Bill Reader", "⚖️", () => runLevel3Agent("Bill Reader", BILL_READER_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Economist")) agentTasks.push(taskRunner("Economist", "📉", () => runLevel3Agent("Economist", ECONOMIST_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Political Strategist")) agentTasks.push(taskRunner("Political Strategist", "♟️", () => runLevel3Agent("Political Strategist", STRATEGIST_PROMPT, `Analyze: ${article.content}`)));
    if (activeAgents.has("Systems Thinker")) agentTasks.push(taskRunner("Systems Thinker", "⚙️", () => runLevel3Agent("Systems Thinker", SYSTEMS_THINKER_PROMPT, `Analyze: ${article.content}`)));

    await Promise.all(agentTasks);

    // 4. Futurist
    let futuristTimeline = undefined;
    if (activeAgents.has("Futurist")) {
        const futuristInput = `
        ARTICLE: ${article.title}
        REPORTS FROM EXPERTS:
        ${reports.map(r => `--- ${r.agentName} ---\n${r.content}`).join('\n\n')}
        `;
        futuristTimeline = await runStandardAgent("Futurist", FUTURIST_PROMPT, futuristInput);
        reports.push({ agentName: "Futurist", content: futuristTimeline, status: "completed", icon: "🔮" });
    }

    // 5. Final Verdict
    const editorInput = `
    ARTICLE: ${article.title}
    REPORTS:
    ${reports.map(r => `--- ${r.agentName} ---\n${r.content}`).join('\n\n')}
    `;
    const verdict = await runStandardAgent("Senior Editor", EDITOR_PROMPT, editorInput);

    const analysisResult: CabinetAnalysis = {
        articleTitle: article.title,
        articleUrl: url,
        managerDecision: {
            agents_to_deploy: decision.agents_to_deploy,
            reasoning: decision.reasoning
        },
        protocolOverrides,
        reports,
        finalVerdict: verdict,
        futuristTimeline,
        timestamp: new Date()
    };

    // Save to DB
    try {
        await db.insert(shadowCabinetAnalyses).values({
            articleTitle: analysisResult.articleTitle,
            articleUrl: analysisResult.articleUrl,
            deployedAgents: JSON.stringify(analysisResult.managerDecision.agents_to_deploy),
            managerReasoning: analysisResult.managerDecision.reasoning,
            protocolOverrides: JSON.stringify(analysisResult.protocolOverrides),
            finalVerdict: analysisResult.finalVerdict,
            futuristTimeline: analysisResult.futuristTimeline,
            agentReports: JSON.stringify(analysisResult.reports),
        });
        console.log("✅ Saved analysis to database.");
    } catch (error) {
        console.error("Failed to save analysis to DB:", error);
    }

    return analysisResult;
}
