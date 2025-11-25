# Daily Session Ideology Dimension Balance

## Issue
The daily session was heavily skewed toward certain dimensions (especially "authority"/justice questions), with other ideology dimensions getting little to no coverage. The "cultural" dimension had zero coverage.

**Example from database (last 7 days):**
- Justice (authority): 7 votes (47%)
- Healthcare (welfare): 2 votes  
- Environment: 2 votes
- Economy: 1 vote
- **Cultural: 0 votes** ❌

## User Requirement
With 3 votes/day × 7 days = 21 votes per week, each of the 8 ideology dimensions should get **2-3 votes per week** for balanced coverage:
- economic
- social
- cultural
- authority
- environmental
- welfare
- globalism
- technocratic

## Changes Made

### 1. New Balance Tracking Function
Added `getIdeologyDimensionBalance()` that:
- Tracks which ideology dimensions have been covered in the past 7 days
- Returns dimensions sorted by priority (least covered first)
- Logs coverage stats for debugging

### 2. Updated Selection Algorithm
Modified `createDailySession()` to:
- **Prioritize underrepresented dimensions** when selecting daily items
- Give "balance boost" to candidates that cover rarely-tested dimensions
- Track used ideology dimensions to avoid repetition within a session
- Try to select from underrepresented dimensions first, fall back to any dimension if needed

### 3. Added Cultural Dimension Support
Previously, the "cultural" ideology dimension had **no policy dimension mappings**, so it was never tested!

**New mappings added:**
```typescript
const POLICY_DIMENSION_TO_IDEOLOGY = {
  // ... existing mappings ...
  culture: "cultural",     // NEW
  identity: "cultural",    // NEW - national identity
  tradition: "cultural",   // NEW - traditional values
};
```

**New keywords added:**
- culture, cultural, heritage, language, irish, gaelic, gaeltacht, arts, music, literature, history
- identity, national, nationalism, patriotism, sovereignty
- tradition, traditional, values, family values, religious, church

### 4. Console Logging
Added detailed logging to track:
- Ideology dimension coverage over past 7 days
- Which dimension each selected item covers
- Balance decisions made during selection

## How It Works

### Before (Unbalanced)
```
1. Pick user's top 4 priority dimensions
2. Fill remaining slots randomly
3. Result: Heavy skew toward certain dimensions
```

### After (Balanced)
```
1. Check which ideology dimensions are underrepresented (last 7 days)
2. For each of the 3 daily items:
   - Try to pick from least-covered dimensions first
   - Give "balance boost" to underrepresented dimensions
   - Track which dimensions have been used
3. Result: More even distribution across all 8 dimensions
```

## Expected Outcome

Over a 7-day period (21 votes):
- Each dimension gets 2-3 votes ✓
- No dimension dominates (was seeing 7/15 = 47% for justice)
- Cultural dimension now included ✓
- Better diversity while still considering user preferences

## Testing

To see the balancing in action:
1. Check console logs when creating daily session:
   ```
   📊 Ideology dimension coverage (last 7 days): economic:2, social:1, cultural:0, authority:4, ...
   ✓ Selected item: policy_dim=culture, ideology_dim=cultural
   ✓ Selected item: policy_dim=environment, ideology_dim=environmental
   ✓ Selected item: policy_dim=immigration, ideology_dim=globalism
   ```

2. Query database to verify balance:
   ```sql
   SELECT 
     policy_dimension,
     COUNT(*) as count
   FROM daily_session_items
   WHERE created_at >= NOW() - INTERVAL '7 days'
   GROUP BY policy_dimension
   ORDER BY count DESC;
   ```

## Files Changed
- `server/services/dailySessionService.ts`
  - Added `getIdeologyDimensionBalance()` function (lines ~810-860)
  - Updated `createDailySession()` selection algorithm (lines ~1570-1650)
  - Added cultural dimension mappings (lines 139-151)
  - Added cultural keywords (lines 291-317, 350-391)


