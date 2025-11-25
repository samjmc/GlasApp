# Glas Politics Onboarding System

A comprehensive first-time user experience system that guides new users through the platform and encourages engagement.

## 📁 Components

### 1. OnboardingModal (`OnboardingModal.tsx`)

**Full-screen modal walkthrough** that appears automatically for first-time users.

#### Features:
- ✅ 6-step guided tour of main features
- ✅ Progress bar with current step indicator
- ✅ Beautiful gradient designs with icons
- ✅ CTA for quiz on "Personal Rankings" step
- ✅ Skip/close options
- ✅ Automatically marks onboarding as completed in user metadata

#### When it appears:
- Automatically on first visit after authentication
- Never shows again once dismissed (stored in Supabase user_metadata)

#### Usage:
```tsx
import { OnboardingModal } from '@/components/onboarding';

// In your layout/page component
<OnboardingModal />
```

#### Data Storage:
```typescript
// Stored in Supabase auth.users.user_metadata
{
  has_seen_onboarding: boolean,
  onboarding_completed_at: string | null
}
```

---

### 2. WelcomeBanner (`WelcomeBanner.tsx`)

**Homepage banner** shown to users who've completed onboarding but not the quiz.

#### Features:
- ✅ Eye-catching gradient design
- ✅ Highlights key benefits of taking quiz
- ✅ Prominent "Take Quiz" CTA
- ✅ Dismissible (stored in localStorage)
- ✅ Auto-hides after quiz completion

#### When it appears:
- After onboarding is completed
- Before quiz is completed
- Until user dismisses it

#### Usage:
```tsx
import { WelcomeBanner } from '@/components/onboarding';

<WelcomeBanner />
```

---

### 3. FirstTimeUserTour (`FirstTimeUserTour.tsx`)

**Contextual tooltips** that highlight interface elements with helpful descriptions.

#### Features:
- ✅ Sequential tour of main navigation tabs
- ✅ Positioned tooltips with arrows
- ✅ Pulse animation on target elements
- ✅ Progress indicator
- ✅ One-time display (localStorage)

#### Target Elements:
Must add `data-tour` attributes to elements:
```tsx
<Button data-tour="feed-tab">Feed</Button>
<Button data-tour="rankings-tab">Rankings</Button>
<Button data-tour="my-rankings-tab">My Rankings</Button>
<Button data-tour="map-tab">Constituencies</Button>
```

#### Usage:
```tsx
import { FirstTimeUserTour } from '@/components/onboarding';

<FirstTimeUserTour />
```

---

### 4. Empty States (`EmptyStates.tsx`)

**Beautiful placeholder components** for when content hasn't been created yet.

#### Available Empty States:

##### EmptyQuizState
- Shown when user hasn't completed political quiz
- Large, engaging design with benefits list
- Direct CTA to quiz page

##### EmptyNewsFeedState
- Shown when no news articles exist yet
- Explains the news scraping system
- Lists all features

##### EmptyIdeasState
- Shown when no policy ideas submitted
- Encourages first submission
- Prominent submit button

##### EmptyLocalRepresentativesState
- Shown when location not enabled
- Requests location permission
- Fallback to manual constituency selection

##### EmptyRankingsState
- Three variants: `type="td" | "party" | "personal"`
- Contextual messaging for each ranking type
- CTA for personal rankings (quiz)

##### LoadingState
- Animated skeleton loaders
- Custom message support

#### Usage:
```tsx
import { 
  EmptyQuizState, 
  EmptyNewsFeedState,
  LoadingState 
} from '@/components/onboarding';

// In your component
{isLoading ? (
  <LoadingState message="Loading rankings..." />
) : data.length === 0 ? (
  <EmptyNewsFeedState />
) : (
  <DataList data={data} />
)}
```

---

## 🔄 User Flow

### First Visit (New User)
```
1. User signs up/logs in
   ↓
2. OnboardingModal appears automatically
   - 6-step walkthrough
   - User learns about platform features
   ↓
3. User completes or skips onboarding
   - has_seen_onboarding = true in user_metadata
   ↓
4. FirstTimeUserTour starts
   - Highlights navigation tabs
   - 4 contextual tooltips
   ↓
5. WelcomeBanner appears on homepage
   - Encourages quiz completion
   ↓
6. User takes quiz
   - WelcomeBanner auto-hides
   - Personal rankings unlock
```

### Empty States
Throughout the experience, users see beautiful empty states instead of blank pages:
- **Feed tab**: EmptyNewsFeedState (until articles are scraped)
- **My Rankings**: EmptyQuizState or quiz interface (until completed)
- **Ideas page**: EmptyIdeasState (until first submission)

---

## 🎨 Design Principles

### Visual Consistency
- Gradient backgrounds (emerald/teal/purple/blue)
- Icon-first design (Lucide icons)
- Card-based layouts with shadows
- Dark mode support

### Accessibility
- Semantic HTML
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader friendly

### User Psychology
- Progress indicators (motivation)
- Clear benefits statements
- Low-friction CTAs
- Skippable but valuable

---

## 🛠️ Technical Implementation

### State Management
- **Onboarding Status**: Supabase `user_metadata`
  ```typescript
  has_seen_onboarding: boolean
  onboarding_completed_at: ISO string | null
  ```

- **Tour Status**: localStorage
  ```javascript
  hasSeenInterfaceTour: "true"
  welcomeBannerDismissed: "true"
  ```

- **Quiz Completion**: Database query
  ```sql
  SELECT id FROM user_quiz_results WHERE user_id = ?
  ```

### Integration Points

#### Homepage (`HomePage.tsx`)
```tsx
import { 
  OnboardingModal, 
  WelcomeBanner, 
  FirstTimeUserTour 
} from '@/components/onboarding';

export default function HomePage() {
  return (
    <>
      <OnboardingModal />
      <FirstTimeUserTour />
      
      <QuickStatsBar />
      
      <div className="max-w-6xl mx-auto">
        <WelcomeBanner />
        {/* Rest of homepage */}
      </div>
    </>
  );
}
```

#### News Feed
```tsx
import { EmptyNewsFeedState, LoadingState } from '@/components/onboarding';

{isLoading ? (
  <LoadingState message="Loading latest political news..." />
) : articles.length === 0 ? (
  <EmptyNewsFeedState />
) : (
  <ArticleList articles={articles} />
)}
```

#### Personal Rankings
```tsx
import { EmptyRankingsState } from '@/components/onboarding';

if (!hasCompletedQuiz) {
  return <EmptyRankingsState type="personal" />;
}
```

---

## 📊 Tracking & Analytics

### Events to Track (Future)
- `onboarding_started`
- `onboarding_completed`
- `onboarding_skipped`
- `tour_started`
- `tour_completed`
- `quiz_cta_clicked`
- `empty_state_cta_clicked`

### Metrics to Monitor
- % of new users completing onboarding
- % completing quiz after onboarding
- Average time to first quiz completion
- Empty state CTA click rates

---

## 🚀 Future Enhancements

### High Priority
- [ ] Add onboarding progress to user profile
- [ ] A/B test different onboarding copy
- [ ] Video tutorials on key steps
- [ ] Personalized onboarding based on user role

### Medium Priority
- [ ] Onboarding checklist widget
- [ ] Gamification (badges for completing steps)
- [ ] Contextual help bubbles
- [ ] Keyboard shortcuts tour

### Low Priority
- [ ] Interactive product tour (Shepherd.js/Intro.js)
- [ ] Onboarding email sequence
- [ ] User satisfaction survey after onboarding

---

## 🐛 Troubleshooting

### Onboarding Modal Not Showing
1. Check user is authenticated (`isAuthenticated = true`)
2. Verify `has_seen_onboarding` is false in user_metadata
3. Check console for Supabase errors
4. Ensure modal isn't being blocked by z-index issues

### Welcome Banner Not Hiding After Quiz
1. Verify quiz completion creates `user_quiz_results` record
2. Check user_id matches auth user
3. Clear localStorage and test again

### Tour Tooltips Misaligned
1. Ensure target elements have `data-tour` attributes
2. Check if elements exist when tour starts (timing issue)
3. Verify viewport size isn't causing overflow

### Empty States Not Showing
1. Check loading state is false
2. Verify data array is empty
3. Ensure component is imported correctly

---

## 📝 Contributing

When adding new onboarding features:

1. **Follow the design system** (gradients, icons, card layouts)
2. **Add data-tour attributes** to new key UI elements
3. **Update this README** with new components
4. **Test on mobile** (responsive design is critical)
5. **Check dark mode** (all components must support it)
6. **Add skip/dismiss options** (never force users through flows)

---

## 📚 Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [User Metadata in Supabase](https://supabase.com/docs/guides/auth/auth-deep-dive/auth-user-management)
- [Lucide Icons](https://lucide.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

**Last Updated**: November 4, 2025  
**Maintained By**: Glas Politics Team  
**Version**: 1.0.0






















