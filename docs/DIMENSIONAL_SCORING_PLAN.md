# Dimensional Scoring Implementation Plan

## Current Status

### What We Have ✅
- **Questions data**: Oral + Written questions with full text
- **Voting data**: All Dáil divisions with individual votes (Tá/Níl/Staon)
- **Legislation data**: Bills sponsored (primary/secondary)
- **News data**: Articles with sentiment analysis
- **Debates data**: System-wide topics and activity (no individual attribution)

### What We're Calculating Now
1. **Overall Score**: Weighted average (40% news, 30% parliamentary, 15% constituency, 10% legislative, 5% trust)
2. **Parliamentary Activity**: 60% questions + 40% attendance (WORKING WELL)
3. **News Impact**: From scraped articles (WORKING)
4. **Dimensional ELOs**: Static legacy values from old news data (NEEDS FIX)

---

## 🎯 Proposed Dimensional Score Calculations

### 1. Transparency Score (0-100)
**Definition:** How accessible and accountable the TD is to the public

**Components:**
```typescript
Transparency = 
  Questions Asked (70%) +
  Question Response Rate (20%) +
  Written Questions Ratio (10%)
```

**Calculation:**
- **Questions Asked (70%):**
  - Benchmark: 200 questions = 100%
  - Score = min(100, (totalQuestions / 200) * 100)
  
- **Question Response Rate (20%):**
  - Check if `date_answered` is populated
  - Response rate = (answered / total) * 100
  
- **Written Questions Ratio (10%):**
  - Written questions show deeper research
  - Ratio = (written / (oral + written)) * 100
  - Bonus for high written question usage

**Data Available:** ✅ All in `td_questions` table

---

### 2. Effectiveness Score (0-100)
**Definition:** How productive the TD is in parliamentary work

**Components:**
```typescript
Effectiveness = 
  Voting Attendance (40%) +
  Legislative Activity (30%) +
  Question Impact (20%) +
  Committee Work (10%)
```

**Calculation:**
- **Voting Attendance (40%):**
  - Benchmark: 95% = 100%
  - Already calculated ✅
  
- **Legislative Activity (30%):**
  - Bills sponsored (primary sponsor = 3x weight, secondary = 1x)
  - Benchmark: 3 bills = 100%
  - Score = min(100, ((primary * 3 + secondary) / 3) * 100)
  
- **Question Impact (20%):**
  - Questions that get answered = more effective
  - Questions with longer answers = more substantive
  - Calculate: avg answer length * response rate
  
- **Committee Work (10%):**
  - Currently no data ❌
  - Could track from debate topics mentioning committees
  - Default to 50 for now

**Data Available:** ✅ Votes, ✅ Legislation, ✅ Questions

---

### 3. Consistency Score (0-100)
**Definition:** How aligned the TD is with their party's positions

**Components:**
```typescript
Consistency = 
  Party Voting Alignment (80%) +
  Question Topic Consistency (20%)
```

**Calculation:**
- **Party Voting Alignment (80%):**
  - For each vote, check if TD voted with party majority
  - Calculate: (votes with party / total votes) * 100
  - This is VERY valuable data!
  
- **Question Topic Consistency (20%):**
  - Analyze if TD focuses on specific policy areas
  - Use question topic classifications
  - Higher score = more focused on specific issues

**Data Available:** ✅ All votes with party affiliation

---

### 4. Constituency Service Score (0-100)
**Definition:** How much the TD focuses on local constituency issues

**Components:**
```typescript
Constituency Service = 
  Local Issue Questions (60%) +
  Adjournment Debates (30%) +
  Local Legislation (10%)
```

**Calculation:**
- **Local Issue Questions (60%):**
  - Analyze question text for constituency name mentions
  - Questions about local services (housing, transport, health)
  - Keywords: constituency name, local town names, "my constituency"
  
- **Adjournment Debates (30%):**
  - Track debate topics that mention constituency
  - Currently limited data ⚠️
  
- **Local Legislation (10%):**
  - Bills that specifically benefit constituency
  - Analyze bill titles for local references

**Data Available:** ⚠️ Partial - need text analysis of questions

---

### 5. Integrity Score (0-100)
**Definition:** Public perception and scandal/achievement tracking

**Components:**
```typescript
Integrity = 
  News Sentiment (80%) +
  Voting Independence (20%)
```

**Calculation:**
- **News Sentiment (80%):**
  - Current news-based approach ✅
  - Positive stories vs negative stories ratio
  
- **Voting Independence (20%):**
  - Occasions where TD votes against party on conscience issues
  - Shows independent thought vs party line
  - Calculate: (independent votes / total votes) * modifier

**Data Available:** ✅ News data, ✅ Voting data

---

## 🚀 Implementation Priority

### Phase 1: Core Dimensions (NOW)
1. ✅ **Transparency**: Questions-based (EASY - have all data)
2. ✅ **Effectiveness**: Attendance + Legislation (MEDIUM - have all data)
3. ✅ **Consistency**: Party voting alignment (MEDIUM - have all data)

### Phase 2: Advanced (LATER)
4. ⚠️ **Constituency Service**: Text analysis of questions (HARD - needs NLP)
5. ✅ **Integrity**: Keep current news-based approach (DONE)

---

## 📝 Implementation Steps

### Step 1: Create new scoring functions
```typescript
// server/utils/dimensionalScoring.ts

export function calculateTransparencyScore(td: {
  totalQuestions: number;
  questionsAnswered: number;
  writtenQuestions: number;
  oralQuestions: number;
}): number {
  const questionScore = Math.min(100, (td.totalQuestions / 200) * 100);
  const responseRate = td.totalQuestions > 0 
    ? (td.questionsAnswered / td.totalQuestions) * 100 
    : 0;
  const writtenRatio = (td.totalQuestions > 0)
    ? (td.writtenQuestions / td.totalQuestions) * 100
    : 0;
  
  return Math.round(
    questionScore * 0.70 +
    responseRate * 0.20 +
    writtenRatio * 0.10
  );
}

export function calculateEffectivenessScore(td: {
  attendancePercentage: number;
  billsPrimarySponsored: number;
  billsSecondarySponsored: number;
  questionsAnswered: number;
  avgAnswerLength: number;
}): number {
  // Attendance (40%)
  const attendanceScore = Math.min(100, (td.attendancePercentage / 95) * 100);
  
  // Legislative (30%)
  const legislativeActivity = (td.billsPrimarySponsored * 3) + td.billsSecondarySponsored;
  const legislativeScore = Math.min(100, (legislativeActivity / 3) * 100);
  
  // Question Impact (20%)
  const avgAnswerScore = Math.min(100, (td.avgAnswerLength / 1000) * 100); // 1000 chars = good
  const impactScore = (avgAnswerScore + (td.questionsAnswered > 0 ? 50 : 0)) / 2;
  
  // Committee (10%) - default to 50 for now
  const committeeScore = 50;
  
  return Math.round(
    attendanceScore * 0.40 +
    legislativeScore * 0.30 +
    impactScore * 0.20 +
    committeeScore * 0.10
  );
}

export function calculateConsistencyScore(votes: {
  tdVote: string;
  partyMajorityVote: string;
}[]): number {
  if (votes.length === 0) return 50;
  
  const alignedVotes = votes.filter(v => v.tdVote === v.partyMajorityVote).length;
  return Math.round((alignedVotes / votes.length) * 100);
}
```

### Step 2: Update score calculation script
```typescript
// scripts/calculate-dimensional-scores.ts

// For each TD:
// 1. Fetch all their questions
// 2. Count answered vs unanswered
// 3. Count oral vs written
// 4. Fetch all their bills
// 5. Fetch all their votes with party context
// 6. Calculate each dimensional score
// 7. Update td_scores table
```

### Step 3: Database updates
```sql
-- Add new columns to td_scores
ALTER TABLE td_scores
  ADD COLUMN transparency_score INTEGER DEFAULT 50,
  ADD COLUMN effectiveness_score INTEGER DEFAULT 50,
  ADD COLUMN consistency_score INTEGER DEFAULT 50,
  ADD COLUMN constituency_service_score INTEGER DEFAULT 50,
  ADD COLUMN integrity_score INTEGER DEFAULT 50;

-- Keep the _elo columns for backward compatibility
```

---

## 🎯 Expected Results

After implementation, each TD will have accurate dimensional scores like:

**Example: Michael Cahill**
- **Transparency**: 95/100 (217 questions, high response rate)
- **Effectiveness**: 88/100 (97% attendance, bills sponsored)
- **Consistency**: 92/100 (votes with party 92% of time)
- **Constituency Service**: 60/100 (estimated from question topics)
- **Integrity**: 46/100 (from news sentiment)

These scores will be:
1. ✅ Based on REAL data (not static)
2. ✅ Relative to peers (percentile-based)
3. ✅ Updated with each extraction
4. ✅ Meaningful to users




