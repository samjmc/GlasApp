# Voting Records Guide: How to Get TD Voting Records

## Current Status

✅ **27,088 votes** already in database (from 2024-01-17 to 2025-10-21)  
✅ **Vote extraction scripts** exist  
⚠️ **No automated job** for regular updates (needs to be created)

## How Voting Records Are Currently Fetched

### Manual Scripts Available

1. **`scripts/bulk-extract-votes.ts`** - Bulk extraction of all votes
2. **`scripts/extract-votes-2024-2025.ts`** - Extract votes for 2024-2025
3. **`scripts/extract-votes-for-missing-tds.ts`** - Fill in missing TD votes

### API Service Available

**`server/services/oireachtasAPIService.ts`** has:
- `extractMemberVotes(memberUri, memberParty, dateFrom, dateTo)` - Extract votes for specific TD
- Uses Oireachtas API: `https://api.oireachtas.ie/v1/votes`

## Data Source: Oireachtas API

### Endpoint
```
GET https://api.oireachtas.ie/v1/votes
```

### Parameters
- `chamber: 'dail'` - Dáil votes only
- `date_start: 'YYYY-MM-DD'` - Start date
- `date_end: 'YYYY-MM-DD'` - End date
- `limit: 500` - Results per page
- `skip: 0` - Pagination offset
- `member_id: uri` - Optional: filter by member

### Response Format
```json
{
  "results": [
    {
      "division": {
        "divisionId": "123",
        "uri": "/ie/oireachtas/division/...",
        "date": "2025-01-15",
        "subject": "Budget 2025",
        "outcome": "Carried",
        "tallies": {
          "taVotes": {
            "tally": 85,
            "members": [
              {
                "member": {
                  "uri": "/ie/oireachtas/member/id/...",
                  "showAs": "Simon Harris",
                  "party": "Fine Gael"
                }
              }
            ]
          },
          "nilVotes": {
            "tally": 45,
            "members": [...]
          },
          "staonVotes": {
            "tally": 2,
            "members": [...]
          }
        }
      }
    }
  ]
}
```

## Current Database Structure

### `td_votes` Table
- `id`: Primary key
- `td_id`: Reference to td_scores
- `vote_id`: Unique vote identifier
- `vote_uri`: Oireachtas API URI
- `vote_date`: Date of vote
- `vote_subject`: Subject/topic of vote
- `vote_outcome`: "Carried", "Defeated", etc.
- `td_vote`: "Ta" (aye), "Nil" (nay), "Staon" (abstain)
- `voted_with_party`: Boolean (did TD vote with party majority?)
- `td_party_at_vote`: Party at time of vote
- `debate_uri`: Link to debate (if applicable)
- `legislation_uri`: Link to bill/legislation (if applicable)
- `total_ta_votes`: Total aye votes
- `total_nil_votes`: Total nay votes
- `total_staon_votes`: Total abstentions

## How to Fetch New Votes

### Option 1: Manual Bulk Extraction

```bash
# Run bulk extraction script
npx tsx scripts/bulk-extract-votes.ts

# This will:
# - Fetch all votes from 2024-01-01 to today
# - Extract individual TD votes from each division
# - Calculate party loyalty
# - Insert into td_votes table
```

### Option 2: Extract Recent Votes Only

Create a script to fetch votes from last N days:

```typescript
// Extract votes from last 30 days
const dateFrom = new Date();
dateFrom.setDate(dateFrom.getDate() - 30);
const dateTo = new Date().toISOString().split('T')[0];
```

### Option 3: Automated Daily Job (Recommended)

Create a scheduled job that runs daily to fetch new votes.

## Recommended: Create Automated Vote Fetcher

### Benefits:
1. ✅ Keep voting records up-to-date automatically
2. ✅ Ensure ideology scoring uses latest votes
3. ✅ Track TD positions in real-time
4. ✅ No manual intervention needed

### Implementation:

Create `server/jobs/dailyVoteFetcher.ts` that:
1. Gets latest vote date from database
2. Fetches votes since that date (or last 7 days as fallback)
3. Extracts individual TD votes
4. Calculates party loyalty
5. Inserts into `td_votes` table
6. Returns statistics

## Integration with Ideology Analysis

Once votes are in `td_votes` table:

```typescript
// Our debate ideology analysis service automatically processes them
import { analyzeVoteRecord } from './services/debateIdeologyAnalysisService';

// Process a vote
await analyzeVoteRecord(voteId); // Uses voting record for ideology analysis
```

## Current Vote Extraction Process

### Step-by-Step (from `bulk-extract-votes.ts`):

1. **Load TDs from database** (`td_scores` table)
2. **Create lookup maps** (by URI, by name)
3. **Fetch ALL divisions** from Oireachtas API (`/votes` endpoint)
4. **For each division:**
   - Extract vote tallies (Ta, Nil, Staon)
   - Match each voter to TD in database
   - Calculate party loyalty (did TD vote with party majority?)
   - Insert into `td_votes` table
5. **Calculate statistics** (party loyalty rates, etc.)

### Key Functions:

```typescript
// Extract member votes (from oireachtasAPIService.ts)
extractMemberVotes(memberUri, memberParty, dateFrom, dateTo)

// Find member vote in division
findMemberVote(division, memberUri) // Returns 'ta' | 'nil' | 'staon' | null

// Determine party loyalty
determinePartyLoyalty(division, tdParty, tdVote) // Returns boolean
```

## Recommended Approach

### For Initial Setup (Historical Votes):

Run bulk extraction script:
```bash
npx tsx scripts/bulk-extract-votes.ts
```

This fetches all votes from 2024-01-01 to today.

### For Regular Updates (Daily):

**Create automated job** that:
1. Runs daily (cron job or scheduled task)
2. Fetches votes from last 7 days (or since last update)
3. Inserts new votes only
4. Updates any changed votes

### For New Votes (Real-time):

**Create endpoint or job** that:
1. Runs after parliament sessions
2. Fetches votes from last 24 hours
3. Processes immediately
4. Updates TD ideology profiles

## Vote Extraction Service

I'll create an automated vote fetcher service that:

1. ✅ Checks for new votes (since last update)
2. ✅ Fetches from Oireachtas API
3. ✅ Extracts individual TD votes
4. ✅ Calculates party loyalty
5. ✅ Inserts into database
6. ✅ Returns statistics

This will integrate with the debate ideology analysis system.

## Next Steps

1. ✅ **Vote extraction scripts exist** - Can run manually
2. ⏳ **Create automated vote fetcher job** - For regular updates
3. ⏳ **Integrate with ideology analysis** - Already done ✅
4. ⏳ **Set up scheduled job** - Daily/weekly updates

---

**Status:** Voting records available, extraction scripts exist, automated job needed  
**Next:** Create automated vote fetcher job for regular updates

