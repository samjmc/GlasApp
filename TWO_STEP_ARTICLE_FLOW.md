# Two-Step Article Flow - November 21, 2025

## Overview
Split the daily session voting experience into two distinct steps to reduce scrolling and improve mobile UX.

## Changes Made

### 1. New Sub-Step System
Added `VoteSubStep` type with two states:
- **"preview"**: Shows article headline, summary, and link
- **"question"**: Shows the voting question and controls

### 2. New ArticlePreviewScreen Component
A dedicated screen that displays:
- Issue number (e.g., "Issue 1 of 3")
- Article headline (large, bold)
- Article summary (readable text)
- Link to full article (if available)
- Progress indicator
- "Continue to Question" button

**Benefits:**
- Content fits on one screen without scrolling
- User can read the article context first
- Clean, focused presentation
- Optional link to read full article

### 3. Updated VoteScreen Component
Simplified to focus on the voting action:
- Removed duplicate headline and summary
- Added "Back to article" button (top-left)
- Shows only the voting question and controls
- More compact, fits better on mobile

### 4. Flow Logic
```
User starts session
  ↓
For each article:
  1. ArticlePreviewScreen (voteSubStep = "preview")
     - Show headline, summary, link
     - User taps "Continue to Question"
  2. VoteScreen (voteSubStep = "question")
     - Show voting question
     - User selects answer
     - User taps "Submit" or "Next"
  ↓
Next article (resets to preview)
  ↓
Session complete
```

### 5. State Management
- Added `voteSubStep` state to track current sub-step
- Resets to "preview" when moving to a new article
- Allows user to go back to preview from question

## User Experience Improvements

### Before
- Single long screen with:
  - Headline
  - Summary
  - Question
  - Vote controls
- Required scrolling on mobile
- Information overload

### After
- **Step 1 (Preview)**:
  - Just the article content
  - Clear, readable layout
  - No scrolling needed
  - "Continue" CTA

- **Step 2 (Question)**:
  - Just the voting question
  - Vote controls
  - No scrolling needed
  - Can go back if needed

## Mobile-First Benefits

1. **No Scrolling**: Each screen fits comfortably on mobile
2. **Tap-Based Navigation**: Simple "Continue" and "Back" buttons
3. **Progressive Disclosure**: Show information when needed
4. **Reduced Cognitive Load**: One task per screen
5. **Better Engagement**: More interactive, less overwhelming

## Technical Details

### Files Modified
- `client/src/pages/DailySessionPage.tsx`
  - Added `VoteSubStep` type
  - Added `voteSubStep` state
  - Created `ArticlePreviewScreen` component
  - Updated `VoteScreen` component
  - Modified rendering logic

### Key Components

**ArticlePreviewScreen Props:**
```typescript
{
  item: DailySessionItem;
  totalItems: number;
  currentIndex: number;
  completedCount: number;
  onNext: () => void;
  onSkip?: () => void;
  isDevMode?: boolean;
}
```

**VoteScreen New Props:**
```typescript
{
  // ... existing props
  onBack?: () => void; // NEW: Navigate back to preview
}
```

## Animation
- Both screens use the same `voteCardVariants` for consistency
- Smooth transitions between preview and question
- Maintains the polished feel of the app

## Testing Checklist

- [ ] Preview screen shows article content clearly
- [ ] "Continue to Question" button works
- [ ] Question screen shows voting controls
- [ ] "Back to article" button works
- [ ] Progress indicator is accurate
- [ ] No scrolling required on mobile (iPhone SE)
- [ ] Animations are smooth
- [ ] Article link opens in new tab (if present)
- [ ] Dev skip button still works

## Future Enhancements

Potential improvements:
1. Add article images to preview screen
2. Show estimated reading time
3. Add "Quick Facts" or key points
4. Swipe gestures to navigate between steps
5. Remember user's position if they leave and return


