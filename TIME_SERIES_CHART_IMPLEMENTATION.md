# Ideology Time-Series Chart Implementation

## Summary

I've implemented a weekly time-series chart showing your ideology evolution over time on the My Politics profile page.

## What Was Built

### 1. API Endpoint ✅
**File:** `server/routes/ideologyTimelineRoutes.ts`
**Route:** `GET /api/ideology-timeline/:userId?weeks=12`

**What it does:**
- Fetches your quiz baseline from `political_evolution`
- Gets your current ideology profile from `user_ideology_profiles`
- Groups your completed daily sessions by week
- Calculates interpolated values for each week with activity
- Returns timeline data with all 8 ideology dimensions

**Response format:**
```json
{
  "success": true,
  "timeline": [
    {
      "weekStart": "2025-06-01T00:00:00.000Z",
      "weekLabel": "Quiz",
      "economic": 0.0,
      "social": 1.7,
      "cultural": 8.3,
      "authority": 5.0,
      "environmental": 10.0,
      "welfare": -5.0,
      "globalism": 10.0,
      "technocratic": 5.0
    },
    {
      "weekStart": "2025-11-18T00:00:00.000Z",
      "weekLabel": "Nov 18",
      "economic": 0.5,
      "social": 1.7,
      ...
    }
  ],
  "quizDate": "2025-06-01T15:36:20.935Z"
}
```

### 2. Chart Component ✅
**File:** `client/src/components/IdeologyTimeSeriesChart.tsx`

**Features:**
- **Interactive dimension selection**: Click dimension pills to show/hide lines
- **Beautiful recharts visualization**: Line chart with tooltips and legend
- **Color-coded dimensions**:
  - Economic: Blue (#3B82F6)
  - Social: Purple (#8B5CF6)
  - Cultural: Pink (#EC4899)
  - Authority: Red (#EF4444)
  - Environmental: Green (#10B981)
  - Welfare: Amber (#F59E0B)
  - Globalism: Cyan (#06B6D4)
  - Governance: Indigo (#6366F1)
- **Default view**: Shows Economic, Social, and Authority (most commonly referenced)
- **Responsive design**: Works on mobile and desktop
- **Loading states**: Spinner while fetching data
- **Empty state**: Helpful message if no data yet

### 3. Integration into My Politics Page ✅
**File:** `client/src/pages/MyPoliticsPage.tsx`

**Location:** Right column, above "Your Personal Rankings" table

**Conditional rendering:**
- Only shows if you've completed the enhanced quiz
- Automatically loads your data on page load

## How It Works

### Data Flow
```
1. User loads /my-politics page
2. MyPoliticsPage renders IdeologyTimeSeriesChart with userId
3. Chart fetches from /api/ideology-timeline/:userId
4. API queries:
   - political_evolution (quiz baseline)
   - user_ideology_profiles (current position)
   - daily_sessions (weekly activity)
5. API interpolates weekly positions between baseline and current
6. Chart renders lines with recharts
7. User can toggle dimensions on/off
```

### Current Limitations & Future Enhancements

**Current Implementation:**
- ⚠️ **Interpolated data**: Since we don't store daily snapshots, the chart interpolates between your quiz baseline and current position based on which weeks you had activity
- ✅ **Works now**: Shows your evolution trajectory from quiz → current
- ✅ **Accurate endpoints**: Quiz baseline and current position are exact

**Future Enhancements (if desired):**
1. **Daily snapshots**: Create `user_ideology_snapshots` table to store exact position each day
2. **Hover details**: Show which issues you voted on in a given week
3. **Download data**: Export your evolution as CSV
4. **Compare periods**: "Compare my first month vs. last month"
5. **Milestone markers**: Annotate when you retook the quiz or had major shifts
6. **Smoothing options**: Toggle between interpolated and step-wise visualization

## Testing Instructions

### 1. Navigate to Your Profile
Go to: `http://localhost:5000/my-politics`

### 2. Expected Behavior

**If you've completed the enhanced quiz:**
- Chart appears at the top of the right column
- Shows your quiz baseline as first data point
- Shows your current position as last data point
- If you've completed daily sessions, shows weekly interpolated progress
- Default view shows Economic, Social, and Authority dimensions
- Click dimension pills to toggle other dimensions

**If you haven't completed the quiz:**
- Chart area is empty with message: "Complete the enhanced quiz and some daily sessions to see your ideology evolution over time."

### 3. Interaction Testing
- [ ] Click different dimension pills to show/hide lines
- [ ] Hover over chart points to see tooltip with exact values
- [ ] Verify Y-axis ranges from -10 (progressive) to +10 (conservative)
- [ ] Verify X-axis shows week labels (e.g., "Quiz", "Nov 18", "Nov 25")
- [ ] Verify chart is responsive on mobile

### 4. Data Accuracy Verification
- [ ] First point should match your quiz baseline exactly
- [ ] Last point should match your current ideology profile (visible in left column)
- [ ] Intermediate points should show gradual progression

## API Testing

You can test the API directly:

```bash
# Get your timeline (replace USER_ID with your actual ID)
curl "http://localhost:5000/api/ideology-timeline/21d4a28a-1efa-4640-bd3a-6bbd238fa000?weeks=12"
```

Expected response:
- `success: true`
- `timeline` array with data points
- `quizDate` timestamp

## Files Changed

1. **New Files:**
   - `server/routes/ideologyTimelineRoutes.ts` - API endpoint
   - `client/src/components/IdeologyTimeSeriesChart.tsx` - Chart component
   - `IDEOLOGY_PROFILE_SYSTEM.md` - System documentation
   - `TIME_SERIES_CHART_IMPLEMENTATION.md` - This file

2. **Modified Files:**
   - `server/routes.ts` - Added ideology timeline route
   - `server/services/personalRankingsService.ts` - Fixed column names for quiz data
   - `client/src/pages/MyPoliticsPage.tsx` - Added chart import and component

## Troubleshooting

### Chart not showing?
1. Check browser console for errors
2. Verify you've completed the enhanced quiz
3. Check network tab - should see GET request to `/api/ideology-timeline/:userId`

### Empty chart?
- Complete at least one daily voting session after taking the quiz
- The chart needs at least 2 data points (quiz + 1 session)

### Data looks weird?
- Check your current ideology profile in the left column - last chart point should match
- Check your quiz baseline - first chart point should match values from June 1st quiz

## Next Steps (Optional)

If you'd like me to enhance the chart further, I can add:
1. **Daily snapshots** - Store exact positions daily for perfect accuracy
2. **Event annotations** - Mark significant votes or quiz retakes on the chart
3. **Comparison mode** - Overlay another user or party's ideology for comparison
4. **Download feature** - Export your data as CSV or image
5. **Advanced filtering** - Filter by date range, specific dimensions, etc.

Let me know if you'd like any of these enhancements!


