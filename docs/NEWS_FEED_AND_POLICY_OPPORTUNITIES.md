# News Article Feed and Policy Vote Opportunities System

## Overview

This document explains how Irish political news articles are scraped, analyzed, summarized, and converted into policy vote opportunities for users to engage with. The system automatically processes articles daily to extract TD impacts, generate AI summaries, and create voting opportunities.

## Table of Contents

1. [News Article Scraping](#news-article-scraping)
2. [Article Analysis & Summarization](#article-analysis--summarization)
3. [TD Extraction & Scoring](#td-extraction--scoring)
4. [Policy Vote Opportunity Creation](#policy-vote-opportunity-creation)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)

---

## News Article Scraping

### Sources

**File:** `server/services/newsScraperService.ts`

The system scrapes from multiple Irish news sources:

#### RSS Feed Sources (Primary)
- **The Irish Times** - Credibility: 0.95, Bias: +0.10 (slight pro-establishment)
- **RTE News** - Credibility: 0.95, Bias: +0.15 (state broadcaster, pro-government)
- **Irish Independent** - Credibility: 0.85, Bias: +0.08 (slight pro-establishment)
- **The Journal** - Credibility: 0.90, Bias: 0.0 (generally balanced)
- **Irish Examiner** - Credibility: 0.85, Bias: 0.0 (balanced)

#### Custom Scrapers (No RSS)
- **Gript Media** - Custom web scraper (`server/services/customScrapers/griptScraper.ts`)
- **The Ditch** - Custom web scraper (`server/services/customScrapers/ditchScraper.ts`)

### Scraping Process

#### 1. RSS Feed Fetching
```typescript
fetchRSSFeed(feedUrl, sourceName, credibility)
```

**Process:**
- Parses RSS feed using `rss-parser` library
- Extracts article metadata:
  - Title
  - URL
  - Publication date
  - Content snippet/description
  - Image URL (from enclosure or content)
- Normalizes URLs (removes query params/hashes)
- Filters by date (lookback window)

**Rate Limiting:** 1 second delay between RSS feeds

#### 2. Full Content Scraping
```typescript
scrapeArticleContent(url)
```

**Process:**
- Fetches full HTML from article URL
- Parses with Cheerio
- Extracts main content using selectors:
  - `article`
  - `.article-content`
  - `.story-content`
  - `.entry-content`
  - `[itemprop="articleBody"]`
  - `.article-body`
  - `main` (fallback)
- Removes unwanted elements (scripts, styles, nav, ads, etc.)
- Cleans whitespace

**Used For:** Gript and The Ditch articles (RSS only provides titles)

#### 3. Political Content Filtering
```typescript
filterPoliticalArticles(articles)
```

**Two-Stage Filter:**

**Stage 1: Keyword Matching**
- Searches for Irish political keywords:
  - TD names, titles (Taoiseach, Tánaiste, Minister)
  - Political terms (Dáil, Oireachtas, constituency)
  - Party names (Fianna Fáil, Fine Gael, Sinn Féin, etc.)
  - Policy terms (budget, legislation, referendum)

**Stage 2: AI Classification** (for non-keyword matches)
- Uses `TopicClassificationService` to analyze articles
- Requires `isPolitical: true`, `confidence >= 0.55`, `relevance >= 0.4`
- Only classifies articles that didn't match keywords

**Purpose:** Reduce AI costs by filtering before analysis

### Deduplication

- Checks database for existing URLs before processing
- Uses normalized URL as unique key
- Skips articles already stored

---

## Article Analysis & Summarization

### AI Analysis Service

**File:** `server/services/aiNewsAnalysisService.ts`

The system uses OpenAI GPT-4o-mini to analyze articles for TD impacts.

#### Analysis Process

```typescript
analyzeArticle(article, politician, options)
```

**Steps:**

1. **Primary Analysis** (`analyzeArticleWithOpenAI`)
   - Uses GPT-4o-mini (fast, cost-effective)
   - Temperature: 0.3 (consistent results)
   - JSON response format

2. **Cross-Checking** (Optional, for high-impact stories)
   - If `crossCheck: true` and `impact_score > 6`
   - Runs second analysis
   - Compares results
   - Flags disagreements (>3 point difference) for review
   - Averages scores if they agree

3. **Bias Protection** (For positive articles)
   - Detects opposition advocacy vs announcements
   - Applies critical analysis to counter media spin
   - Reduces scores for announcements (70% reduction)
   - Blends with critical perspective (40% optimistic, 60% critical)

#### Analysis Output

```typescript
interface ArticleAnalysis {
  // Story Classification
  story_type: 'scandal' | 'achievement' | 'policy_work' | 'controversy' | 'constituency_service' | 'neutral';
  sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  
  // Process Scores (0-100) - HOW they do their job
  transparency_score: number | null;      // How open/honest
  effectiveness_score: number | null;     // Did they deliver?
  integrity_score: number | null;         // Any ethical issues?
  consistency_score: number | null;       // Flip-flopped?
  
  // Reasoning (from AI)
  transparency_reasoning?: string;
  effectiveness_reasoning?: string;
  integrity_reasoning?: string;
  consistency_reasoning?: string;
  
  // Impact Scores (-10 to +10) - Converted from process scores
  transparency_impact: number | null;
  effectiveness_impact: number | null;
  integrity_impact: number | null;
  consistency_impact: number | null;
  impact_score: number;  // Average of dimensional impacts
  
  // Policy Classification
  is_ideological_policy: boolean;
  policy_direction?: 'progressive' | 'conservative' | 'centrist' | 'technical';
  
  // TD Policy Stance (for user voting)
  td_policy_stance?: {
    stance: 'support' | 'oppose' | 'neutral' | 'unclear';
    strength: number;  // 1-5
    evidence: string;  // Quote showing stance
    policy_topic: string;
  };
  
  // Summaries
  summary: string;  // 2-4 sentence neutral summary
  reasoning: string;  // Why scored this way
  key_quotes: string[];
  
  // Historical Context (Flip-flop detection)
  historical_context?: {
    hasFlipFlop: boolean;
    flipFlopSeverity: 'major' | 'moderate' | 'minor' | 'none';
    flipFlopDetails: string;
    suspiciousTiming: boolean;
    needsHumanReview: boolean;
  };
  
  // Bias Protection
  is_announcement: boolean;
  is_opposition_advocacy: boolean;
  critical_analysis?: {
    critical_impact: number;
    downsides: string[];
    reality_check: string;
    exaggeration_detected: boolean;
  };
  bias_adjustments?: {
    announcement_reduction: number;
    critical_blend: number;
    source_bias_adjustment: number;
    final_adjusted_impact: number;
  };
}
```

#### Scoring Rules

**TRUTH-SEEKING PRINCIPLE:** Score PROCESS, not POLICY

- ✅ Score: How transparent, effective, consistent, ethical they were
- ❌ Don't Score: Whether their policies are good/bad (users decide!)

**Transparency (0-100):**
- 90-100: Proactively disclosed everything, complete openness
- 70-89: Clearly explained, mostly open
- 50-69: Basic info, some questions dodged
- 30-49: Vague, evasive, hiding something
- 0-29: Lying, deliberately deceptive

**Effectiveness (0-100):**
- 90-100: Fully delivered on promise, verifiable results
- 70-89: Delivered most of it, minor delays
- 50-69: Partially delivered, significant delays
- 30-49: Failed to deliver most, broken promises
- 0-29: Complete failure, all talk no action

**Integrity (0-100):**
- 90-100: No conflicts, completely ethical
- 70-89: Minor concerns, mostly clean
- 50-69: Questionable decisions, borderline
- 30-49: Clear conflicts, ethics violations
- 0-29: Blatant corruption, criminal behavior

**Consistency (0-100):**
- 90-100: Completely consistent, kept word
- 70-89: Mostly consistent, minor shifts
- 50-69: Some inconsistencies, contradictions
- 30-49: Major flip-flops, hypocrisy
- 0-29: Complete reversal, betrayed principles

#### Flip-Flop Detection

**Against Party Position:**
- Compares TD's stance to their party's established position
- Detects deviations:
  - Major: 8+ points away
  - Moderate: 5-7 points
  - Minor: 3-4 points
  - None: within 3 points

**Suspicious Timing:**
- Flags if TD changes position after riots/violence
- Detects knee-jerk reactions vs principled evolution

**Penalties:**
- Major flip-flop: -40 to consistency score
- Moderate: -20
- Minor: -5

---

## TD Extraction & Scoring

### AI-Powered TD Extraction

**File:** `server/services/aiNewsAnalysisService.ts`

**Function:** `extractRelevantTDsFromArticle()`

**Why AI?** Much smarter than keyword matching:
- Detects title-only references ("Tánaiste said...")
- Identifies indirect references ("Government announced...")
- Finds multiple TDs affected by policy
- Understands context vs simple mentions

**Process:**
1. AI analyzes article title + content
2. Extracts TD names (direct mentions)
3. Maps titles to TDs (e.g., "Tánaiste" → Simon Harris)
4. Matches extracted names to database TDs
5. Returns array with confidence scores

**Fallback:** If AI fails, uses keyword extraction (`TDExtractionService`)

### ELO Scoring

**File:** `server/services/eloScoringService.ts`

**How It Works:**
- Standard ELO rating system (like chess)
- Each TD starts at 1500
- Scores update based on article impacts
- Time decay: Older stories matter less
- Source credibility weighting

**Dimensions:**
- Overall ELO
- Transparency ELO
- Effectiveness ELO
- Integrity ELO
- Consistency ELO
- Constituency Service ELO

**Score Calculation:**
```typescript
newScore = oldScore + (impact * credibility * timeDecay * K)
```

Where:
- `impact`: -10 to +10 from analysis
- `credibility`: 0.75 to 0.95 based on source
- `timeDecay`: 1.0 (today) to ~0.5 (30 days old)
- `K`: 32 (standard ELO constant)

---

## Policy Vote Opportunity Creation

### Service Overview

**File:** `server/services/policyOpportunityService.ts`

**Purpose:** Converts news articles into voter engagement opportunities by:
1. Classifying if article is policy-related
2. Generating a voting question
3. Creating answer options
4. Mapping options to ideology vectors

### Generation Process

**Function:** `PolicyOpportunityService.generateAndSave()`

#### Step 1: LLM Classification

**Prompt:** Classifies if article can become a policy question

**Input:**
- Article title
- Article content (first 2000 chars)
- Source name

**Output:**
```typescript
{
  should_create: boolean;
  confidence: number;  // 0-1
  policy_domain: PolicyDomain | 'other';
  policy_topic: string;  // e.g., "housing", "immigration"
  question: string;  // "Should the Government ...?"
  answer_options: string[];  // ["Yes - do more", "No - current is sufficient"]
  rationale?: string;
  source_hint?: string;
}
```

**Policy Domains:**
- `housing`
- `health`
- `economy`
- `taxation`
- `climate`
- `immigration`
- `justice`
- `education`
- `foreign_policy`
- `humanitarian_aid`
- `infrastructure`
- `agriculture`
- `technology`
- `other`

**Decision Logic:**
- `should_create: true` if article presents a policy choice
- Even if no TD is named (general policy question)
- Skips pure gossip/celebrity news

#### Step 2: Question & Options Generation

**Question Format:**
- Always centered on Government policy choice
- Neutral language (no partisan bias)
- YES/NO style preferred
- Example: "Should the Government increase asylum seeker accommodation capacity?"

**Answer Options:**
- Default: ["Yes – the Government should do more", "No – the current approach is sufficient"]
- Or custom options from LLM
- Typically 2-3 options
- Mapped to keys: `option_a`, `option_b`, `option_c`

#### Step 3: Ideology Vector Mapping

**Function:** `callLLMForOptionVectors()`

**Purpose:** Maps each answer option to 8-dimensional ideology space

**8 Ideology Dimensions:**
- `economic` (market vs collective)
- `social` (traditional vs progressive)
- `cultural` (nationalism vs multiculturalism)
- `authority` (authoritarian vs libertarian)
- `environmental` (pro-business vs pro-climate)
- `welfare` (increase vs decrease welfare)
- `globalism` (global integration vs national preservation)
- `technocratic` (expert-led vs populist)

**Vector Values:**
- Range: -2 to +2 per dimension
- Negative = left/progressive/global integration
- Positive = right/conservative/national preservation
- 0 = no change on that axis

**Example:**
```json
{
  "option_a": {
    "ideology_delta": {
      "economic": -1.2,
      "social": -0.5,
      "cultural": -0.3,
      "authority": 0.0,
      "environmental": 1.1,
      "welfare": -0.4,
      "globalism": -0.9,
      "technocratic": 0.2
    },
    "confidence": 0.85,
    "weight": 1.2
  }
}
```

#### Step 4: Database Storage

**Table:** `policy_vote_opportunities`

```sql
{
  id: bigserial,
  article_id: integer (FK),
  policy_domain: text,
  policy_topic: text,
  question_text: text,
  answer_options: jsonb,  // { "option_a": "...", "option_b": "..." }
  default_alignment: jsonb,  // Optional: pre-aligned party positions
  confidence: numeric,
  rationale: text,
  source_hint: text,
  created_at: timestamptz
}
```

**Related Table:** `policy_vote_option_vectors`

Stores ideology delta vectors for each option:
```sql
{
  policy_vote_id: bigint (FK),
  option_key: text,  // "option_a", "option_b", etc.
  economic: numeric,  // -2 to +2
  social: numeric,
  cultural: numeric,
  authority: numeric,
  environmental: numeric,
  welfare: numeric,
  globalism: numeric,
  technocratic: numeric,
  weight: numeric,  // 0.1-3.0
  confidence: numeric  // 0-1
}
```

### Policy Stance Harvesting

**Function:** `PolicyStanceHarvester.extractFromArticle()`

**Purpose:** Extracts TD positions on policies from articles

**Creates:** `td_policy_stances` table entries
```sql
{
  article_id: integer,
  politician_name: text,
  policy_dimension: text,  // "housing", "immigration", etc.
  stance: text,  // "support", "oppose", "neutral"
  stance_strength: integer,  // 1-5
  evidence: text,  // Quote from article
  policy_topic: text
}
```

**Used For:**
- Daily vote session candidate selection
- Personal rankings (users see TD stances)
- Policy comparison tools

---

## Data Flow

### Daily News Scraping Job

**File:** `server/jobs/dailyNewsScraper.ts`

**Scheduled:** Daily at 6:00 AM Irish time

**Process:**

```
1. Fetch All News Sources
   ├─► RSS feeds (Irish Times, RTE, Journal, etc.)
   ├─► Custom scrapers (Gript, The Ditch)
   └─► Rate limiting (1-2s between requests)
   ↓
2. Filter Political Content
   ├─► Keyword matching (fast)
   └─► AI classification (for edge cases)
   ↓
3. Extract Full Content (Gript/Ditch only)
   ├─► Web scraping for articles < 200 chars
   └─► Parse with Cheerio
   ↓
4. Extract Relevant TDs (AI-Powered)
   ├─► AI analyzes each article
   ├─► Identifies relevant TDs
   └─► Matches to database
   ↓
5. Analyze TD Impacts
   ├─► For each TD-article pair:
   │   ├─► AI analysis (GPT-4o-mini)
   │   ├─► Cross-check if high-impact
   │   ├─► Calculate process scores
   │   ├─► Apply bias protection
   │   └─► Detect flip-flops
   └─► Rate limiting (2s between analyses)
   ↓
6. Update TD Scores
   ├─► Calculate ELO changes
   ├─► Apply time decay
   ├─► Weight by source credibility
   └─► Update database
   ↓
7. Generate Policy Opportunities
   ├─► For each article:
   │   ├─► LLM classifies policy relevance
   │   ├─► Generates question & options
   │   ├─► Maps options to ideology vectors
   │   └─► Extracts TD stances
   └─► Target: 33% of articles have opportunities
   ↓
8. Save to Database
   ├─► news_articles (article data)
   ├─► article_td_scores (TD impacts)
   ├─► td_scores (updated ELOs)
   ├─► td_score_history (score changes)
   ├─► policy_vote_opportunities (voting questions)
   ├─► policy_vote_option_vectors (ideology mappings)
   └─► td_policy_stances (TD positions)
```

### Coverage Targets

- **Policy Opportunities:** 33% of articles should have voting opportunities
- **Top-Up Logic:** If below target, generates opportunities for recent articles without them

---

## Database Schema

### Core Tables

#### `news_articles`
Stores scraped articles with AI analysis:
```sql
- id (bigserial, PK)
- url (text, UNIQUE)
- title (text)
- content (text)
- source (text)
- published_date (timestamptz)
- image_url (text)  // AI-generated or RSS image
- politician_name (text, nullable)
- constituency (text, nullable)
- party (text, nullable)
- ai_summary (text)  // 2-4 sentence summary
- ai_reasoning (text)
- story_type (text)
- sentiment (text)
- impact_score (numeric)  // -10 to +10
- transparency_score (numeric, 0-100)
- effectiveness_score (numeric, 0-100)
- integrity_score (numeric, 0-100)
- consistency_score (numeric, 0-100)
- is_ideological_policy (boolean)
- policy_direction (text)
- is_opposition_advocacy (boolean)
- processed (boolean)
- score_applied (boolean)
- credibility_score (numeric)
- created_at (timestamptz)
```

#### `article_td_scores`
TD-specific impacts from articles:
```sql
- id (bigserial, PK)
- article_id (integer, FK)
- politician_name (text)
- impact_score (numeric)
- transparency_score (numeric)
- effectiveness_score (numeric)
- integrity_score (numeric)
- consistency_score (numeric)
- transparency_reasoning (text)
- effectiveness_reasoning (text)
- integrity_reasoning (text)
- consistency_reasoning (text)
- story_type (text)
- sentiment (text)
- flip_flop_detected (text)
- flip_flop_explanation (text)
- suspicious_timing (boolean)
- needs_review (boolean)
- elo_change (numeric)
- old_overall_elo (numeric)
- new_overall_elo (numeric)
- ai_reasoning (text)
- is_opposition_advocacy (boolean)
- UNIQUE(article_id, politician_name)
```

#### `td_scores`
Current ELO scores for all TDs:
```sql
- id (bigserial, PK)
- politician_name (text, UNIQUE)
- constituency (text)
- party (text)
- overall_elo (numeric)
- transparency_elo (numeric)
- effectiveness_elo (numeric)
- integrity_elo (numeric)
- consistency_elo (numeric)
- constituency_service_elo (numeric)
- total_stories (integer)
- positive_stories (integer)
- negative_stories (integer)
- neutral_stories (integer)
- is_active (boolean)
- last_updated (timestamptz)
```

#### `policy_vote_opportunities`
Voting questions created from articles:
```sql
- id (bigserial, PK)
- article_id (integer, FK, UNIQUE)
- policy_domain (text)
- policy_topic (text)
- question_text (text)
- answer_options (jsonb)  // { "option_a": "...", "option_b": "..." }
- default_alignment (jsonb, nullable)
- confidence (numeric)
- rationale (text, nullable)
- source_hint (text, nullable)
- created_at (timestamptz)
```

#### `policy_vote_option_vectors`
Ideology mappings for answer options:
```sql
- policy_vote_id (bigint, FK)
- option_key (text)  // "option_a", "option_b", etc.
- economic (numeric)  // -2 to +2
- social (numeric)
- cultural (numeric)
- authority (numeric)
- environmental (numeric)
- welfare (numeric)
- globalism (numeric)
- technocratic (numeric)
- weight (numeric)  // 0.1-3.0
- confidence (numeric)  // 0-1
- updated_at (timestamptz)
- UNIQUE(policy_vote_id, option_key)
```

#### `td_policy_stances`
TD positions on policies extracted from articles:
```sql
- id (bigserial, PK)
- article_id (integer, FK)
- politician_name (text)
- policy_dimension (text)
- stance (text)  // "support", "oppose", "neutral"
- stance_strength (integer)  // 1-5
- evidence (text)  // Quote from article
- policy_topic (text)
```

---

## API Endpoints

### News Feed Routes

**File:** `server/routes/newsFeedRoutes.ts`

#### `GET /api/news-feed`
Fetch news articles with optional sorting.

**Query Parameters:**
- `limit` (default: 20)
- `offset` (default: 0)
- `sort` (options: `recent`, `score`, `highest`, `today`)

**Response:**
```json
{
  "success": true,
  "articles": [
    {
      "id": 123,
      "title": "...",
      "source": "The Irish Times",
      "sourceLogoUrl": "...",
      "publishedDate": "2025-01-27T10:00:00Z",
      "imageUrl": "...",
      "aiSummary": "2-4 sentence summary...",
      "url": "...",
      "impactScore": 7,
      "storyType": "achievement",
      "sentiment": "positive",
      "hasPolicyOpportunity": true,
      "policyVote": {
        "id": 456,
        "question": "Should the Government...?",
        "options": {
          "option_a": "Yes - do more",
          "option_b": "No - current is sufficient"
        },
        "domain": "housing",
        "topic": "social_housing"
      },
      "affectedTDs": [
        {
          "name": "Simon Harris",
          "impactScore": 7,
          "transparencyScore": 85,
          "storyType": "policy_work"
        }
      ]
    }
  ],
  "total": 150,
  "has_more": true,
  "last_updated": "2025-01-27T12:00:00Z",
  "sort": "recent",
  "regionCode": "IE"
}
```

**Sort Options:**
- `recent`: Latest articles first (default)
- `score`: Articles with TD impacts or policy opportunities
- `highest`: Highest impact articles from last 200
- `today`: Biggest impact article from today (or last 7 days)

#### `POST /api/news-feed/save`
Save article from external source (Python aggregator).

**Body:**
```json
{
  "url": "...",
  "title": "...",
  "content": "...",
  "source": "...",
  "publishedDate": "...",
  "aiSummary": "...",
  "credibilityScore": 0.85
}
```

#### `GET /api/news-feed/td/:name`
Get recent news articles for a specific TD.

**Query Parameters:**
- `limit` (default: 3)

---

## Key Features

### 1. Automated Daily Updates

- Runs every morning at 6 AM
- Processes all Irish political news
- Updates TD scores automatically
- Creates new voting opportunities

### 2. Multi-Source Coverage

- 6+ major Irish news sources
- Mix of establishment and critical media
- Balanced perspective with source bias tracking

### 3. AI-Powered Analysis

- Extracts TDs intelligently (not just keywords)
- Analyzes impacts with process-focused scoring
- Detects flip-flops and hypocrisy
- Applies bias protection to counter spin

### 4. Policy Engagement

- Converts articles into voting questions
- Maps options to ideology space
- Enables user voting on current policies
- Feeds into daily vote sessions

### 5. Transparency

- Every score change linked to source article
- Full audit trail in `td_score_history`
- Users can see reasoning for each score
- Public verification of all claims

---

## Cost Estimates

### Daily Operation (100 articles with TD mentions)

- **Claude Analysis:** $0.015 × 100 = **$1.50**
- **GPT-4 Cross-Check (20%):** $0.03 × 20 = **$0.60**
- **Policy Opportunity Generation:** $0.01 × 100 = **$1.00**
- **Option Vector Mapping:** $0.005 × 33 = **$0.17**
- **Total Daily:** ~**$3.27**
- **Monthly:** ~**$98**

### Cost Reduction Strategies

1. Pre-filter with keywords (avoid AI for non-political)
2. Only cross-check high-impact stories
3. Cache similar article patterns
4. Batch process articles
5. Skip articles without substantial TD mentions

---

## Quality Controls

### Bias Prevention

1. **Source Diversity** - Mix of left/right/center media
2. **Same Criteria** - All TDs judged identically
3. **Process Scoring** - Not policy judgment
4. **Critical Analysis** - Counters media spin
5. **Opposition Advocacy** - Detected and protected

### Accuracy Assurance

1. **Cross-Checking** - High-impact stories verified twice
2. **Confidence Scores** - Low confidence flagged for review
3. **Manual Review Queue** - Disagreements sent to humans
4. **Flip-Flop Detection** - Major deviations flagged
5. **Audit Trail** - Every score change has source proof

### Gaming Prevention

1. **Source Credibility** - Established sources weighted higher
2. **Time Decay** - Old stories matter less over time
3. **Multiple Models** - Agreement required for high scores
4. **Public Verification** - Users can challenge scores
5. **Deduplication** - Same story only counted once

---

## Future Enhancements

1. **Real-Time Updates** - WebSocket notifications for new articles
2. **User Feedback** - "Do you agree with this score?" voting
3. **TD Responses** - TDs can comment on their scores
4. **Trend Analysis** - Historical score trends visualization
5. **Predictive Scoring** - Estimate future impacts
6. **Multilingual** - Support for Irish language articles
7. **Video Analysis** - Extract from video news clips
8. **Social Media** - Track TD Twitter/Instagram activity

---

## Related Files

- **News Scraping:** `server/services/newsScraperService.ts`
- **Daily Job:** `server/jobs/dailyNewsScraper.ts`
- **AI Analysis:** `server/services/aiNewsAnalysisService.ts`
- **TD Extraction:** `server/services/tdExtractionService.ts`
- **ELO Scoring:** `server/services/eloScoringService.ts`
- **Policy Opportunities:** `server/services/policyOpportunityService.ts`
- **API Routes:** `server/routes/newsFeedRoutes.ts`
- **Schema:** `shared/news-schema.ts`

---

**Last Updated:** 2025-01-27  
**Version:** 1.0

