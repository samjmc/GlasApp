# Transparency/Trustworthiness Score Design

## Concept: "Say vs Do" Consistency

Measures whether TDs act on what they say they care about.

---

## 📊 Proposed Formula (with current data)

```
Transparency = 
  Question-Bill Topic Match (60%) +
  Voting Stability (40%)
```

---

## Component 1: Question-Bill Topic Match (60%)

### How It Works:

**Step 1: Classify Question Topics**
Analyze all questions to determine what issues the TD focuses on:
- Housing
- Healthcare
- Education
- Environment
- Justice
- Economy
- Transport
- Social welfare
- Agriculture
- Foreign affairs

**Step 2: Classify Bills by Topic**
Analyze bills they sponsor for the same topics

**Step 3: Calculate Match Score**
```javascript
For each topic:
  - Questions about topic: X
  - Bills about topic: Y
  - Match score = min(100, (Y / (X/10)) * 100)

Overall = Average of all topic match scores
```

**Example:**
- TD asks 50 housing questions
- TD sponsors 3 housing bills
- Match: 3 / (50/10) = 3/5 = 60% match → good!

**If TD asks lots about housing but sponsors 0 housing bills:**
- Match: 0 / (50/10) = 0% → inconsistent ❌

---

## Component 2: Voting Stability (40%)

### How It Works:

**Track vote changes on similar bills:**

1. Group votes by topic (budget, healthcare, housing, etc.)
2. For each topic, check if they consistently vote Tá or Níl
3. Calculate variance in their voting pattern

```javascript
For each topic:
  votes_ta = count of Tá votes
  votes_nil = count of Níl votes
  total = votes_ta + votes_nil
  
  // Consistent if they vote >80% the same way
  consistency = max(votes_ta, votes_nil) / total
  
Voting Stability = Average consistency across all topics
```

**Example:**
- Housing votes: 8 Tá, 1 Níl → 8/9 = 89% consistent ✅
- Budget votes: 5 Tá, 5 Níl → 5/10 = 50% → flip-flopper ❌

---

## Alternative: Simpler "Questions-Only" Transparency

If the above is too complex, we could use a simpler metric:

```
Transparency = 
  Question Volume (70%) +
  Question Diversity (30%)
```

### Question Volume:
- More questions = more accountability/transparency
- Same calculation as current (questions / 200 benchmark)

### Question Diversity:
- Do they ask about many topics or just one?
- More diverse = more transparent/well-rounded
- Count unique topics mentioned in questions

**This is much easier to implement!**

---

## Which Approach?

### Option A: **Question-Bill Match (Complex but meaningful)**
- Pros: Truly measures "say vs do"
- Cons: Requires AI topic classification for all questions/bills
- Time: 1-2 hours to implement

### Option B: **Question Volume + Diversity (Simple)**
- Pros: Easy to implement with current data
- Cons: Doesn't measure flip-flops
- Time: 15 minutes to implement

### Option C: **Voting Stability Only**
- Pros: Measures flip-flopping directly
- Cons: Doesn't connect to what they say
- Time: 30 minutes to implement

---

## My Recommendation:

Start with **Option B** (simple) now, then enhance to **Option A** later when we add AI topic classification.

**Option B Implementation:**
```typescript
function calculateTransparency(questions: any[]): number {
  // Volume (70%)
  const volumeScore = Math.min(100, (questions.length / 200) * 100);
  
  // Diversity (30%) - count unique topics/keywords
  const topics = new Set<string>();
  const keywords = ['housing', 'health', 'education', 'transport', 
                   'environment', 'justice', 'economy', 'social'];
  
  for (const q of questions) {
    const text = (q.subject || '').toLowerCase();
    keywords.forEach(keyword => {
      if (text.includes(keyword)) topics.add(keyword);
    });
  }
  
  // Score based on diversity (8 topics = 100%)
  const diversityScore = Math.min(100, (topics.size / 8) * 100);
  
  return Math.round(volumeScore * 0.70 + diversityScore * 0.30);
}
```

**Would you like me to implement Option B now, or should we go for the more complex Option A?**



