# Daily Vote Session System Documentation

## Overview

The Daily Vote Session is a gamified user retention feature that presents users with 3 policy issues each day to vote on. It tracks ideological shifts, maintains voting streaks, and provides regional comparisons. The system creates personalized sessions based on user priorities and recent voting history.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend Service](#backend-service)
4. [API Routes](#api-routes)
5. [Frontend Service](#frontend-service)
6. [Frontend Hooks](#frontend-hooks)
7. [User Interface](#user-interface)
8. [Data Flow](#data-flow)
9. [Key Features](#key-features)
10. [Configuration Constants](#configuration-constants)

---

## Architecture Overview

```
User Browser
    │
    ├─► GET /api/daily-session (Fetch/Create Session)
    ├─► POST /api/daily-session/items/:itemId/vote (Record Vote)
    ├─► POST /api/daily-session/complete (Complete Session)
    └─► POST /api/daily-session/explainer (Get Quick Explainer)
    │
    ▼
Express Router (dailySessionRoutes.ts)
    │
    ▼
DailySessionService (dailySessionService.ts)
    │
    ├─► getOrCreateSession() - Fetch existing or create new
    ├─► recordVote() - Record user vote and update ideology
    ├─► completeSession() - Finalize session and generate summary
    └─► createDailySession() - Select 3 policy issues
    │
    ▼
Supabase PostgreSQL
    │
    ├─► daily_sessions (Session metadata)
    ├─► daily_session_items (3 items per session)
    ├─► daily_session_votes (User votes)
    └─► user_ideology_profiles (Ideology tracking)
```

---

## Database Schema

### Tables

#### `daily_sessions`
Tracks each user's daily session.

```sql
- id (bigserial, PK)
- user_id (uuid, FK → auth.users)
- session_date (date) - Unique per user per day
- status (text) - 'pending' | 'completed'
- county (text, nullable)
- constituency (text, nullable)
- streak_count (integer, default 0)
- ideology_axis (text, nullable) - e.g., "Economic", "Social"
- ideology_delta (numeric(6,2), nullable) - Percentage shift
- ideology_direction (text, nullable) - 'left' | 'right' | 'neutral'
- ideology_summary (text, nullable) - Generated summary text
- region_shift_summary (text, nullable) - Regional comparison
- created_at (timestamptz)
- completed_at (timestamptz, nullable)
- UNIQUE(user_id, session_date)
```

#### `daily_session_items`
The 3 policy issues shown in each session.

```sql
- id (bigserial, PK)
- session_id (bigint, FK → daily_sessions)
- article_id (integer, FK → news_articles)
- policy_vote_id (integer, FK → policy_vote_opportunities, nullable)
- policy_dimension (text, nullable) - e.g., "housing", "immigration"
- policy_direction (text, nullable) - 'progressive' | 'conservative' | 'neutral'
- headline (text)
- summary (text, nullable)
- politician_name (text, nullable)
- order_index (integer, default 0)
- created_at (timestamptz)
```

#### `daily_session_votes`
User votes on each item.

```sql
- id (bigserial, PK)
- session_item_id (bigint, FK → daily_session_items)
- user_id (uuid, FK → auth.users)
- rating (integer, 1-5) - 1=Strongly oppose, 5=Strongly support
- impact_score (numeric(6,3)) - Calculated ideology delta
- created_at (timestamptz)
- UNIQUE(session_item_id, user_id)
```

### Row Level Security (RLS)

All tables use RLS policies to ensure users can only:
- View their own sessions, items, and votes
- Insert/update their own sessions and votes
- Session items are visible if they belong to the user's session

---

## Backend Service

**File:** `server/services/dailySessionService.ts`

### Main Class: `DailySessionService`

#### Methods

##### `getOrCreateSession(userId, options, accessToken)`
Fetches existing session for today, or creates a new one.

**Process:**
1. Check for existing session for today
2. If exists and `forceRefresh` is enabled, delete and recreate
3. If no session, call `createDailySession()`:
   - Fetch policy candidates from `policy_vote_opportunities` (preferred) or `news_articles` (fallback)
   - Search windows: 24-hour windows, up to 14 windows back
   - Prioritize based on user's top policy dimensions
   - Select 3 unique articles covering diverse dimensions
4. Return `DailySessionState` with items and vote status

**Returns:** `DailySessionState`
```typescript
{
  status: "pending" | "completed";
  sessionId: number;
  sessionDate: string;
  voteCount: number;
  streakCount: number;
  items: DailySessionItem[];
  completion?: DailySessionCompletion; // Only if completed
}
```

##### `recordVote(userId, sessionItemId, rating, accessToken)`
Records a user's vote on a session item.

**Process:**
1. Validate rating (1-5)
2. Fetch session item and verify session is not completed
3. Infer/validate policy dimension if missing
4. Calculate impact:
   - Convert rating (1-5) to impact (-1 to +1)
   - Apply direction multiplier based on policy_direction
   - Apply learning rate (0.1)
   - Result is ideology delta
5. Sync global vote artifacts:
   - Update `user_policy_votes` table
   - Update `user_policy_vote_responses` if policy_vote_id exists
   - Apply ideology delta to `user_ideology_profiles`
6. Save vote to `daily_session_votes`
7. Return updated session state

**Returns:** Updated `DailySessionState`

##### `completeSession(userId, accessToken)`
Finalizes the session and generates completion summary.

**Process:**
1. Verify all 3 votes are completed
2. Calculate dimension shifts:
   - Load user's ideology vector
   - Compute shifts per dimension
   - Identify dominant shift
3. Calculate streak count (consecutive days)
4. Compute regional shift comparison
5. Build completion summary with:
   - Ideology summary text
   - Dimension shifts array
   - Regional comparison
   - History snapshot (vs previous session)
6. Update session status to "completed"
7. Return `DailySessionCompletion`

**Returns:** `DailySessionCompletion`
```typescript
{
  ideologySummary: string;
  ideologyDelta: number;
  ideologyAxis: string;
  ideologyDirection: "left" | "right" | "neutral";
  regionSummary: string;
  streakCount: number;
  dimensionShifts: DailySessionDimensionShift[];
  historySnapshot?: { /* Previous session comparison */ };
  detailStats?: Array<{ label, value, emoji }>;
}
```

### Helper Functions

#### Policy Dimension Processing
- `normalizePolicyDimension()` - Standardizes dimension names
- `detectDimensionFromText()` - Keyword-based detection
- `resolvePolicyDimensionFromValues()` - Multi-source resolution
- `inferPolicyDimensionForItem()` - Fetches article data and infers dimension

#### Ideology Calculation
- `ratingToImpact(rating)` - Maps 1-5 to -1 to +1
- `directionMultiplier(direction, rating)` - Applies policy direction
- `applyIdeologyDelta()` - Updates user ideology profile with headroom checks
- `summarizeDimensionShifts()` - Calculates shifts across ideology dimensions

#### Candidate Selection
- `fetchOpportunityCandidates()` - Fetches from `policy_vote_opportunities`
- `fetchLegacyPolicyCandidates()` - Fallback to `news_articles`
- `scoreCandidatePriority()` - Scores candidates based on dimension priority
- `deriveDimension()` - Extracts dimension from candidate data
- `derivePolitician()` - Extracts primary politician from stances

#### Regional Analysis
- `computeRegionShift()` - Compares user's county/constituency trends
- `aggregateRegionDimensionScores()` - Aggregates votes by dimension
- `rankDimensions()` - Ranks dimensions by score magnitude

---

## API Routes

**File:** `server/routes/dailySessionRoutes.ts`

### Endpoints

#### `GET /api/daily-session`
Fetches or creates today's session.

**Authentication:** Required  
**Query Params:** `force=true` (optional) - Force refresh session

**Response:**
```json
{
  "success": true,
  "session": DailySessionState,
  "regionCode": "IE"
}
```

#### `POST /api/daily-session/items/:itemId/vote`
Records a vote on a session item.

**Authentication:** Required  
**Body:**
```json
{
  "rating": 1-5
}
```

**Response:**
```json
{
  "success": true,
  "session": DailySessionState,
  "regionCode": "IE"
}
```

#### `POST /api/daily-session/complete`
Completes the session and generates summary.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "summary": DailySessionCompletion,
  "regionCode": "IE"
}
```

#### `POST /api/daily-session/explainer`
Generates AI-powered quick explainer for an issue.

**Authentication:** Required  
**Body:**
```json
{
  "headline": string,
  "summary": string,
  "issueCategory": string,
  "todayIso": string (optional),
  "maxChars": number (optional)
}
```

**Response:**
```json
{
  "success": true,
  "explainer": {
    "one_sentence": string,
    "pros": [string, string],
    "cons": [string, string]
  },
  "cached": boolean
}
```

**Caching:** 24-hour TTL per headline

---

## Frontend Service

**File:** `client/src/services/dailySessionService.ts`

### Functions

#### `fetchDailySession(force?: boolean)`
Fetches today's session state from the API.

#### `submitDailyVote(sessionItemId, rating)`
Submits a vote on a session item.

#### `completeDailySession()`
Completes the session and fetches summary.

#### `getQuickExplainer(params)`
Fetches AI explainer for an issue.

**Authorization:** All requests include Supabase session token in Authorization header.

---

## Frontend Hooks

**File:** `client/src/hooks/useDailySession.ts`

### `useDailySession(enabled)`
React Query hook to fetch session state.

- **Query Key:** `["daily-session-state", regionCode]`
- **Stale Time:** 30 seconds
- **Auto-refetch:** When enabled and regionCode is set

### `useDailySessionVote()`
Mutation hook to submit votes.

- **Optimistic Updates:** Updates query cache on success
- **Error Handling:** Built-in error handling

### `useCompleteDailySession()`
Mutation hook to complete session.

- **Updates:** Session state in cache with completion data
- **Invalidates:** Session query on success

---

## User Interface

**File:** `client/src/pages/DailySessionPage.tsx`

### Flow

1. **Prompt Screen** (`step === "prompt"`)
   - Welcome message
   - Displays current streak
   - "Start" button

2. **Vote Screen** (`step === "vote"`)
   - Shows current item (1 of 3, 2 of 3, etc.)
   - Displays headline, summary, policy dimension
   - Slider control (1-5 rating)
   - "Next issue" or "Reveal my insights" button
   - Celebration animation after vote

3. **Completion Transition** (`isCompletionPending`)
   - Loading state while calculating summary

4. **Payoff Screen** (`step === "payoff"`)
   - Session complete message
   - Streak count
   - Ideology summary text
   - Dimension shifts (top 3)
   - Regional comparison
   - Axis shift visualization (for dominant shift)
   - "See streak boost" button

5. **Streak Boost Screen** (`step === "streakShare"`)
   - Animated streak counter
   - Friend streaks (mock data)
   - Share/Challenge/Connect buttons
   - "Finish" button

### Features

- **Animations:** Framer Motion for smooth transitions
- **Audio:** Piano chord sounds for interactions (Web Audio API)
- **Progress Tracking:** Visual progress indicators
- **Dev Mode:** Skip button to quickly complete sessions in development
- **Responsive:** Mobile-first design with mobile-card components

### Components Used

- `SliderVoteControl` - Rating input (1-5)
- `Button` - UI buttons
- `Toast` - Success/error notifications
- `AnimatePresence` - Smooth transitions between items

---

## Data Flow

### Session Creation Flow

```
1. User navigates to /daily-session
   │
2. Frontend calls useDailySession()
   │
3. GET /api/daily-session
   │
4. Backend: getOrCreateSession()
   ├─► Check for existing session today
   │   │
   │   └─► If exists → Return session state
   │   │
   └─► If not exists → createDailySession()
       ├─► Fetch policy candidates
       │   ├─► Try: policy_vote_opportunities (last 14×24hr windows)
       │   └─► Fallback: news_articles (is_ideological_policy=true)
       │
       ├─► Get user priorities
       │   ├─► Top dimensions from personal_rankings
       │   └─► Recent dimension from vote history
       │
       ├─► Select 3 items
       │   ├─► Prioritize user's preferred dimensions
       │   ├─► Ensure diversity across dimensions
       │   └─► Shuffle and rank by priority
       │
       └─► Insert into database
           ├─► daily_sessions (status: 'pending')
           └─► daily_session_items (3 rows)
```

### Vote Recording Flow

```
1. User adjusts slider and clicks "Next issue"
   │
2. Frontend: submitDailyVote(sessionItemId, rating)
   │
3. POST /api/daily-session/items/:itemId/vote
   │
4. Backend: recordVote()
   ├─► Validate rating (1-5)
   ├─► Fetch session item
   ├─► Infer policy dimension if missing
   ├─► Calculate impact score
   │   ├─► ratingToImpact(rating) → -1 to +1
   │   ├─► directionMultiplier(direction, rating) → ±1
   │   └─► Apply learning rate (0.1) → delta
   │
   ├─► Sync global artifacts
   │   ├─► Update user_policy_votes
   │   ├─► Update user_policy_vote_responses (if applicable)
   │   └─► Apply ideology delta → user_ideology_profiles
   │       ├─► Load current vector
   │       ├─► Check headroom (±10 range)
   │       ├─► Scale delta if near limits
   │       └─► Update and persist
   │
   └─► Save vote → daily_session_votes
       └─► Return updated session state
```

### Completion Flow

```
1. User completes 3rd vote
   │
2. Frontend automatically calls completeDailySession()
   │
3. POST /api/daily-session/complete
   │
4. Backend: completeSession()
   ├─► Verify all 3 votes completed
   ├─► Calculate dimension shifts
   │   ├─► Load user ideology vector
   │   ├─► For each vote:
   │   │   ├─► Map policy dimension → ideology dimension
   │   │   └─► Calculate before/after positions
   │   └─► Identify dominant shift
   │
   ├─► Calculate streak count
   │   ├─► Fetch all completed sessions (ordered by date desc)
   │   ├─► Count consecutive days from today backwards
   │   └─► Update session.streak_count
   │
   ├─► Compute regional shift
   │   ├─► Get user's county/constituency
   │   ├─► Aggregate today's votes by dimension (same region)
   │   ├─► Compare with yesterday's rankings
   │   └─► Generate summary text
   │
   ├─► Build history snapshot
   │   ├─► Fetch previous session metadata
   │   └─► Compare ideology delta, axis, streak
   │
   ├─► Generate completion summary
   │   ├─► Format ideology summary text
   │   ├─► Build dimension shifts array
   │   ├─► Create detail stats
   │   └─► Compile full completion object
   │
   └─► Update session → status: 'completed'
       └─► Return DailySessionCompletion
```

---

## Key Features

### 1. Personalized Issue Selection

- Prioritizes user's top 4 policy dimensions from personal rankings
- Considers recent voting focus
- Ensures diversity across dimensions
- Falls back through time windows (14×24 hours) if needed

### 2. Ideology Tracking

- 8-dimensional ideology model:
  - Economic
  - Social
  - Cultural
  - Authority
  - Environmental (Climate)
  - Welfare
  - Globalism (Borders & World)
  - Technocratic

- Policy dimensions map to ideology dimensions:
  - `economy` → `economic`
  - `housing`, `healthcare` → `welfare`
  - `immigration` → `globalism`
  - `environment` → `environmental`
  - `social_issues` → `social`
  - `justice` → `authority`
  - `education` → `technocratic`

### 3. Impact Calculation

- Rating (1-5) converted to impact (-1 to +1)
- Direction multiplier applies based on policy direction:
  - Progressive policy + high rating = left shift
  - Conservative policy + high rating = right shift
  - Neutral policy = rating > 3 → left, rating < 3 → right
- Learning rate (0.1) prevents rapid shifts
- Headroom checks prevent exceeding ±10 range

### 4. Streak System

- Tracks consecutive days of completed sessions
- Resets if user misses a day
- Displays in UI with fire emoji
- Streak count stored in session metadata

### 5. Regional Comparison

- Requires user to set county or constituency in profile
- Aggregates votes by dimension for same region
- Compares today's rankings vs yesterday
- Shows which dimension is trending in user's area

### 6. History Snapshot

- Compares current session to previous session:
  - Ideology delta change
  - Axis change
  - Streak change
- Provides context for user's progression

### 7. Quick Explainer (AI-Powered)

- Generates pros/cons and summary for issues
- Uses OpenAI/Anthropic services
- 24-hour cache per headline
- Regional context-aware

---

## Configuration Constants

### Policy Selection

```typescript
const DAILY_ITEM_COUNT = 3;              // Number of issues per session
const PRIMARY_WINDOW_HOURS = 24;         // Time window for candidate search
const MAX_FALLBACK_WINDOWS = 14;         // Maximum windows to search back
```

### Ideology Calculation

```typescript
const IDEOLOGY_LEARNING_RATE = 0.1;      // Rate of ideology shift per vote
const IDEOLOGY_RANGE = [-10, 10];        // Valid ideology value range
```

### Policy Dimension Priority

Higher priority = more likely to be selected if user has shown interest:

```typescript
const POLICY_DIMENSION_PRIORITY = {
  economy: 1,        // Highest priority
  housing: 1,
  immigration: 1,
  healthcare: 2,
  environment: 2,
  social_issues: 3,
  justice: 3,
  education: 3,
};
```

### Rating Labels

```typescript
const ratingLabels = {
  1: "Strongly oppose",
  2: "Oppose",
  3: "Neutral",
  4: "Support",
  5: "Strongly support",
};
```

### Development Mode

```typescript
// Set env var to enable auto-reset in dev
DAILY_SESSION_ALWAYS_RESET=true
```

---

## Error Handling

### Common Errors

1. **"No policy issues available"**
   - No eligible articles found in search windows
   - Solution: Check `policy_vote_opportunities` and `news_articles` tables

2. **"Daily session already completed"**
   - User tries to vote after completing
   - Solution: Check session status before allowing votes

3. **"Failed to assemble daily session items"**
   - Not enough unique candidates found
   - Solution: Increase fallback windows or add more articles

4. **"Please complete all votes before finishing"**
   - User tries to complete with < 3 votes
   - Solution: Ensure all votes are recorded before calling complete

---

## Testing

### Manual Testing Flow

1. **Create Session**
   ```
   GET /api/daily-session?force=true
   ```
   Verify: 3 items returned, status="pending"

2. **Record Votes**
   ```
   POST /api/daily-session/items/{itemId}/vote
   Body: { "rating": 4 }
   ```
   Verify: Vote saved, session.voteCount increments

3. **Complete Session**
   ```
   POST /api/daily-session/complete
   ```
   Verify: Summary generated, status="completed", ideology calculated

4. **Check Next Day**
   ```
   GET /api/daily-session
   ```
   Verify: New session created, streak incremented

### Database Checks

```sql
-- Check user's sessions
SELECT * FROM daily_sessions 
WHERE user_id = '<user_id>' 
ORDER BY session_date DESC;

-- Check session items
SELECT * FROM daily_session_items 
WHERE session_id = <session_id> 
ORDER BY order_index;

-- Check votes
SELECT * FROM daily_session_votes 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC;

-- Check ideology profile
SELECT * FROM user_ideology_profiles 
WHERE user_id = '<user_id>';
```

---

## Future Enhancements

1. **Friend Challenges** - Challenge friends to complete sessions
2. **Social Sharing** - Share completion summaries
3. **Advanced Analytics** - Historical trend visualization
4. **Custom Dimensions** - User-defined policy priorities
5. **Batch Voting** - Vote on multiple items at once
6. **Reminder System** - Push notifications for missed days
7. **Leaderboards** - Regional/national streak rankings

---

## Related Files

- **Database Migration:** `supabase/migrations/20251106_create_daily_retention_session.sql`
- **Backend Service:** `server/services/dailySessionService.ts`
- **API Routes:** `server/routes/dailySessionRoutes.ts`
- **Frontend Service:** `client/src/services/dailySessionService.ts`
- **React Hooks:** `client/src/hooks/useDailySession.ts`
- **UI Component:** `client/src/pages/DailySessionPage.tsx`
- **Vote Control:** `client/src/components/votes/SliderVoteControl.tsx`

---

**Last Updated:** 2025-01-27  
**Version:** 1.0

