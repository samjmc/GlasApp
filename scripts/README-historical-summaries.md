# TD Historical Summaries Generator

This script generates 2-3 sentence historical critiques for each TD's profile page, adding context about their political record and career.

## Features

✅ **Cost-Effective**: Uses Claude Haiku (cheapest model) with batch processing  
✅ **Data-Driven**: Leverages existing database metrics (news sentiment, performance, tenure)  
✅ **Balanced Tone**: Generates neutral, journalistic critiques (not promotional)  
✅ **Batch Processing**: Processes 5 TDs per API call to minimize costs  

## Cost Estimate

- **~229 TDs total** (active members)
- **~46 batches** (5 TDs per batch)
- **Cost per batch**: ~$0.01 USD (Claude Haiku pricing)
- **Total estimated cost**: **~$0.50 USD** 🎉

Compare this to:
- GPT-4: ~$15-20
- Claude Opus: ~$10-12
- GPT-3.5: ~$2-3

## Prerequisites

1. **Anthropic API Key**: Set in `.env` file
   ```bash
   ANTHROPIC_API_KEY=your_key_here
   ```

2. **Database Connection**: Ensure `DATABASE_URL` is set in `.env`

## Usage

### Run the Script

```bash
npm run generate-summaries
```

### What It Does

1. Fetches all active TDs from the database
2. Filters TDs that don't have historical summaries yet
3. Batches them into groups of 5
4. For each batch:
   - Compiles context from existing data (performance scores, news sentiment, tenure, offices held)
   - Sends to Claude Haiku for generation
   - Parses the 2-3 sentence summaries
   - Updates the database

### Example Output

```
🔍 Fetching TDs from database...
📊 Found 229 total TDs
✏️  229 need summaries

📝 Processing batch 1/46...
   TDs: Leo Varadkar, Micheál Martin, Mary Lou McDonald, Eamon Ryan, Ivana Bacik
   ✅ Leo Varadkar: Former Taoiseach and Fine Gael leader...
   ✅ Micheál Martin: Current Tánaiste and Fianna Fáil leader...
   ...

✅ Complete! Updated 229 TD summaries
💰 Estimated cost: ~$0.46 USD (using Claude Haiku)
```

## Example Summaries

The script generates balanced, factual summaries like:

> **Leo Varadkar**: Former Taoiseach and Fine Gael leader who made history as Ireland's first openly gay Taoiseach. His tenure saw strong economic growth but faced criticism over housing policy and healthcare reforms. Known for his direct communication style and progressive social stances while maintaining centre-right economic policies.

> **Pearse Doherty**: Sinn Féin's finance spokesperson and one of the party's most prominent figures. Widely recognized for his sharp questioning of banking executives and detailed budget critiques. Has built a reputation as an effective opposition voice on economic issues, though some critics question the feasibility of his party's spending proposals.

## Safety Features

- **Skips existing summaries**: Won't overwrite unless you modify the filter
- **1-second delays**: Between batches to respect API rate limits
- **Error handling**: Continues processing even if one batch fails
- **Database transactions**: Each update is atomic

## Customization

### Adjust Batch Size

In `generate-td-historical-summaries.ts`:
```typescript
const BATCH_SIZE = 5; // Change to 3 for slower/safer, 10 for faster/cheaper
```

### Regenerate All Summaries

Remove the filter on line 137:
```typescript
// Before (only new TDs):
const tdsNeedingSummaries = tds.filter(td => !td.historical_summary);

// After (regenerate all):
const tdsNeedingSummaries = tds;
```

### Change Model

For even cheaper (but lower quality):
```typescript
model: 'claude-3-haiku-20240307'  // Current
// or
model: 'claude-3-5-haiku-20241022' // Even newer/faster
```

For higher quality (more expensive):
```typescript
model: 'claude-3-5-sonnet-20241022' // Much better quality, ~10x cost
```

## Monitoring

The script outputs detailed progress:
- Current batch number
- TD names being processed
- Preview of generated summaries
- Final cost estimate

## Troubleshooting

### "API key not found"
```bash
# Check your .env file has:
ANTHROPIC_API_KEY=sk-ant-...
```

### "Database connection failed"
```bash
# Check your .env file has valid connection string:
DATABASE_URL=postgresql://...
```

### "Rate limit exceeded"
- Increase the delay between batches (line 169)
- Reduce batch size

### Summaries seem low quality
- Try using `claude-3-5-sonnet` instead (better quality, higher cost)
- Adjust the temperature (line 148) - lower = more consistent, higher = more creative

## Future Enhancements

- [ ] Add manual review/approval workflow
- [ ] Generate controversy flags for contentious TDs
- [ ] Add multi-language support (Irish/English)
- [ ] Include voter feedback in summary generation
- [ ] Track summary quality metrics

























