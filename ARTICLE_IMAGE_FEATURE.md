# Article Image Feature - November 21, 2025

## Overview
Added article images (from RSS feeds or generated images) to the article preview screen in the daily session flow.

## Changes Made

### 1. Backend Updates (`server/services/dailySessionService.ts`)

**Database Query Enhancement:**
- Updated the `news_articles` query to include `image_url` column
- Line 1828: Changed from `select("id, url")` to `select("id, url, image_url")`

**Image URL Mapping:**
- Created `articleImageMap` to store image URLs by article ID
- Populated the map alongside the existing `articleUrlMap`
- Line 1831: Added `articleImageMap.set(article.id, (article as any).image_url ?? null)`

**Item Formatting:**
- Added `imageUrl` field to the formatted items returned to the client
- Line 1913: Added `imageUrl: articleImageMap.get(item.article_id) ?? null`

### 2. TypeScript Interface Updates

**Client Interface (`client/src/services/dailySessionService.ts`):**
```typescript
export interface DailySessionItem {
  // ... existing fields
  articleUrl?: string | null;
  imageUrl?: string | null;  // NEW
  quickExplainer?: DailySessionQuickExplainer;
}
```

### 3. UI Implementation (`client/src/pages/DailySessionPage.tsx`)

**ArticlePreviewScreen Component:**
Added image display between the issue counter and headline:

```typescript
{item.imageUrl && (
  <motion.div
    className="w-full aspect-video rounded-lg overflow-hidden bg-slate-800"
    variants={voteItemVariants}
    custom={animationIndex++}
  >
    <img
      src={item.imageUrl}
      alt={item.headline}
      className="w-full h-full object-cover"
      onError={(e) => {
        // Hide image if it fails to load
        e.currentTarget.style.display = 'none';
      }}
    />
  </motion.div>
)}
```

## Features

### Image Display
- **Aspect Ratio**: 16:9 (aspect-video)
- **Sizing**: Full width of the card
- **Styling**: Rounded corners, slate background
- **Object Fit**: Cover (fills the container while maintaining aspect ratio)

### Progressive Animation
- Image animates in with the same staggered timing as other elements
- Appears after the issue counter, before the headline
- Smooth fade-in and slide-up animation

### Error Handling
- If image fails to load, it's automatically hidden
- No broken image icons or error states shown
- Gracefully degrades to text-only view

### Conditional Rendering
- Only shows if `item.imageUrl` exists
- No empty space or placeholder if no image available
- Maintains clean layout for articles without images

## Visual Flow (Article Preview)

1. Issue counter (e.g., "Issue 1 of 3") ✨
2. **Article image** (16:9, full width) 🖼️ **NEW**
3. Headline (large, bold) 📰
4. Summary (readable text) 📝
5. "Read full article" button 📖
6. Progress + "Vote Opportunity →" button ➡️

## Benefits

1. **Visual Appeal**: Makes the preview more engaging and professional
2. **Context**: Images provide immediate visual context about the article
3. **Recognition**: Users can quickly identify familiar stories
4. **Engagement**: Visual content increases user engagement
5. **Modern Design**: Matches contemporary news app patterns

## Technical Details

### Database
- Source: `news_articles.image_url` column
- Type: `text` (nullable)
- Contains: RSS feed images or AI-generated images

### Performance
- Images load asynchronously
- Error handling prevents layout shift
- No impact on initial page load (progressive enhancement)

### Responsive Design
- Full width on all screen sizes
- Maintains 16:9 aspect ratio
- Scales appropriately for mobile and desktop

## Testing Checklist

- [ ] Images display correctly when available
- [ ] No broken image icons for missing images
- [ ] Animation timing is smooth
- [ ] Error handling works (try invalid URL)
- [ ] Layout looks good with and without images
- [ ] Aspect ratio is maintained
- [ ] Images don't cause scrolling issues
- [ ] Works on mobile (iPhone SE)
- [ ] Works on desktop

## Future Enhancements

Potential improvements:
1. Add loading skeleton/placeholder
2. Implement lazy loading for performance
3. Add image zoom on click
4. Support multiple images (carousel)
5. Add image captions
6. Implement image caching
7. Add blur-up effect for progressive loading


