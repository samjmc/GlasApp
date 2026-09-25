# Glas Politics - System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          USERS                                   │
│                    (Web Browsers)                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTPS
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   FRONTEND (React)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Components (130+)  │  Pages (30+)  │  Contexts (5)      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  TanStack Query  │  Wouter Router  │  State Management   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  Radix UI  │  Tailwind CSS  │  Framer Motion           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ REST API
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                  BACKEND (Express)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Authentication Middleware                    │  │
│  │         (Supabase Auth + Session Management)             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                    API Routes (40+)                      │  │
│  │  ┌───────────┬──────────┬──────────┬──────────────┐     │  │
│  │  │ Auth      │ Quiz     │ Pledges  │ Elections    │     │  │
│  │  │ Routes    │ Routes   │ Routes   │ Routes       │     │  │
│  │  ├───────────┼──────────┼──────────┼──────────────┤     │  │
│  │  │ Party     │ Map      │ AI       │ Community    │     │  │
│  │  │ Routes    │ Routes   │ Routes   │ Routes       │     │  │
│  │  └───────────┴──────────┴──────────┴──────────────┘     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                  Service Layer (12+)                     │  │
│  │  ┌───────────┬──────────┬──────────┬──────────────┐     │  │
│  │  │ Activity  │ Bot      │ Email    │ AI           │     │  │
│  │  │ Tracker   │ Behavior │ Service  │ Analysis     │     │  │
│  │  └───────────┴──────────┴──────────┴──────────────┘     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │              Database Access (Drizzle ORM)               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬──────────────────┐
        │             │             │                  │
┌───────▼─────┐ ┌─────▼─────┐ ┌────▼────────┐ ┌──────▼─────┐
│  Supabase   │ │  OpenAI   │ │  Anthropic  │ │  SendGrid  │
│  PostgreSQL │ │    API    │ │  Claude API │ │   Email    │
│  + Auth     │ │           │ │             │ │  Service   │
│  + Storage  │ └───────────┘ └─────────────┘ └────────────┘
└─────────────┘
```

---

## 🗄️ Database Architecture (Supabase PostgreSQL)

### Core Tables

```
┌──────────────────────────────────────────────────────────────┐
│                        USERS                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ id, username, email, role, profile_image_url, etc.    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────┘
               │
        ┌──────┼──────┬──────────────┬──────────────┐
        │      │      │              │              │
┌───────▼──┐ ┌─▼──────▼─┐ ┌──────────▼─┐ ┌─────────▼────┐
│ USER     │ │  QUIZ    │ │ POLITICAL  │ │ USER         │
│ ACTIVITY │ │ RESULTS  │ │ EVOLUTION  │ │ LOCATIONS    │
└──────────┘ └──────────┘ └────────────┘ └──────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       PARTIES                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ id, name, 8-dimensional scores, rationales, etc.      │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────┘
               │
        ┌──────┼──────┬──────────────┐
        │      │      │              │
┌───────▼──┐ ┌─▼──────▼─┐ ┌──────────▼─────────┐
│ PLEDGES  │ │ ELECTION │ │ PERFORMANCE        │
│          │ │ RESULTS  │ │ SCORES             │
└──────────┘ └──────────┘ └────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   CONSTITUENCIES                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ id, name, county, seats, geo_data, scores, etc.       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────┘
               │
        ┌──────┴──────┬──────────────┐
        │             │              │
┌───────▼──┐ ┌────────▼─┐ ┌──────────▼─┐
│ ELECTION │ │ CANDIDATES│ │ USER       │
│ RESULTS  │ │           │ │ LOCATIONS  │
└──────────┘ └───────────┘ └────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  COMMUNITY FEATURES                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              PROBLEMS                                  │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ id, title, description, category, votes, etc.   │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │              SOLUTIONS                                 │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │ id, problem_id, title, description, votes, etc. │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Table Statistics
- **Total Tables:** 25+
- **User-related:** 8 tables
- **Political Data:** 10 tables
- **Community Features:** 5 tables
- **Voting & Tracking:** 7 tables

---

## 🔐 Authentication Flow

```
┌─────────┐                                    ┌──────────────┐
│ Client  │                                    │   Supabase   │
│ (React) │                                    │     Auth     │
└────┬────┘                                    └──────┬───────┘
     │                                                │
     │  1. Login Request (email, password)           │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  2. Validate credentials                      │
     │                                                │
     │  3. Generate JWT token                        │
     │<──────────────────────────────────────────────┤
     │                                                │
     │  4. Store token in localStorage                │
     │                                                │
     │  5. Attach token to API requests              │
     │     Authorization: Bearer <token>             │
     │                                                │
┌────▼────┐                                    ┌──────▼───────┐
│ Express │                                    │   Supabase   │
│ Backend │                                    │   Database   │
└────┬────┘                                    └──────┬───────┘
     │                                                │
     │  6. Verify JWT token                          │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  7. Get user from token                       │
     │<──────────────────────────────────────────────┤
     │                                                │
     │  8. Attach user to req.user                   │
     │                                                │
     │  9. Process authenticated request             │
     │                                                │
     │  10. Return response                          │
     │                                                │
```

---

## 🔄 Data Flow - Quiz and Ideology

One model for users, TDs and parties. Full design: `docs/architecture/ideology-matching.md`.

1. The client shows the one question bank (`shared/quiz.ts`) and sends answer choices only:
   `POST /api/quiz`. Anyone can take it.
2. The server scores it (`server/quiz`). A signed-in result is saved to `politics.quiz_results`
   and the user's profile is recomputed; an anonymous result is returned and not saved.
3. A user's profile = their latest quiz plus every policy vote (`server/voting`).
   A TD's profile = party baseline plus stance evidence from articles (and later debates) in
   `politics.td_ideology_evidence`. A party = the mean of its TDs. All live in
   `politics.ideology_profiles` and rebuild with `npm run ideology -- --recalculate`.
4. Matches (`/api/ideology/me/matches`, public `POST /api/ideology/matches`) use one alignment formula.

## 🗺️ Feature Modules

### Quiz and Ideology Modules
```
shared/ideology.ts   the 8 dimensions, −10..+10, + = right-coded pole on every one
shared/quiz.ts       the question bank (25 questions, one dimension each)
server/quiz/         scoring (server-side only) and the ideology label
server/ideology/     model (weighted mean + prior), sources, alignment, party baselines
server/routes/quiz.ts, server/routes/ideology.ts
```

### Party Matching Module
```
party-matching/
├── Matching (server/ideology/alignment.ts)
│   ├── Party = mean of its TDs' profiles
│   ├── Weighted linear distance, 0..100
│   └── Optional per-dimension weights (0..3)
│
├── Pledge Tracking
│   ├── Promise database
│   ├── Fulfillment scoring
│   └── Evidence tracking
│
└── User Preferences
    ├── Category ranking
    ├── Importance voting
    └── Personalized weights
```

### Electoral Mapping Module
```
electoral-mapping/
├── Constituency Data
│   ├── 43 constituencies
│   ├── GeoJSON boundaries
│   └── Demographic data
│
├── Interactive Maps
│   ├── Leaflet integration
│   ├── User heatmaps
│   └── Zoom/pan controls
│
├── Comparison Tools
│   ├── Side-by-side view
│   ├── Statistical comparison
│   └── Trend analysis
│
└── Predictions
    ├── AI-powered trends
    ├── Historical patterns
    └── Confidence scores
```

### Community Module
```
community/
├── Problems Platform
│   ├── Problem submission
│   ├── Voting system
│   └── Status tracking
│
├── Solutions Platform
│   ├── Nested under problems
│   ├── Detailed descriptions
│   └── Voting/ranking
│
├── Ideas Board (Legacy)
│   ├── Legacy system
│   └── Migration to Problems/Solutions
│
└── Engagement Tracking
    ├── User activity
    ├── Contribution history
    └── Reputation system
```

---

## 🔌 External Integrations

```
┌─────────────────────────────────────────────────────────────┐
│                    Glas Politics Backend                     │
└─────────────────────────────────────────────────────────────┘
           │         │         │         │         │
           │         │         │         │         │
┌──────────▼───┐ ┌──▼─────┐ ┌─▼──────┐ ┌▼────────┐ ┌▼────────┐
│  Supabase    │ │ OpenAI │ │Anthropic│ │SendGrid │ │ Twilio  │
│              │ │        │ │         │ │         │ │         │
│ - Database   │ │ - GPT-4│ │ - Claude│ │ - Email │ │ - SMS   │
│ - Auth       │ │ - API  │ │ - API   │ │ - API   │ │ - Verify│
│ - Storage    │ │        │ │         │ │         │ │         │
│ - Realtime   │ │        │ │         │ │         │ │         │
└──────────────┘ └────────┘ └─────────┘ └─────────┘ └─────────┘
```

### Integration Details

**Supabase**
- PostgreSQL database with connection pooling
- Authentication with JWT
- File storage for uploads
- Real-time subscriptions (future)
- Row Level Security policies

**OpenAI**
- GPT-4 for complex analysis
- Embeddings for semantic search (future)
- Completion for text generation
- Moderation for content safety

**Anthropic (Claude)**
- Advanced reasoning tasks
- Context-aware analysis
- Irish political context understanding
- Cross-reference with OpenAI (planned)

**SendGrid/Resend**
- Transactional emails
- Verification emails
- Password resets
- Notification emails

**Twilio**
- SMS verification
- Two-factor authentication
- Notification alerts

---

## 🚀 Performance Considerations

### Caching Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                      Cache Layers                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Browser Cache                                             │
│    - Static assets (images, CSS, JS)                        │
│    - Service Worker (future)                                │
├─────────────────────────────────────────────────────────────┤
│ 2. React Query Cache                                        │
│    - API responses                                          │
│    - Stale-while-revalidate                                 │
│    - 5-minute default TTL                                   │
├─────────────────────────────────────────────────────────────┤
│ 3. Server Memory Cache                                      │
│    - Frequently accessed data                               │
│    - Quiz questions                                         │
│    - Party positions                                        │
├─────────────────────────────────────────────────────────────┤
│ 4. Database Query Cache                                     │
│    - Supabase built-in                                      │
│    - Prepared statements                                    │
│    - Connection pooling                                     │
└─────────────────────────────────────────────────────────────┘
```

### Database Optimization
- Indexes on frequently queried columns
- Connection pooling (PgBouncer)
- Query result caching
- Optimized joins
- Pagination for large datasets

### Frontend Optimization
- Code splitting by route
- Lazy loading components
- Image optimization (WebP)
- Tree shaking unused code
- Minification & compression

---

## 🔒 Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Transport Layer                                          │
│    - HTTPS only                                             │
│    - TLS 1.3                                                │
│    - Certificate pinning                                    │
├─────────────────────────────────────────────────────────────┤
│ 2. Authentication                                           │
│    - JWT tokens                                             │
│    - Token expiration                                       │
│    - Refresh token rotation                                 │
│    - 2FA support                                            │
├─────────────────────────────────────────────────────────────┤
│ 3. Authorization                                            │
│    - Role-based access control                              │
│    - Row Level Security (RLS)                               │
│    - API key restrictions                                   │
├─────────────────────────────────────────────────────────────┤
│ 4. Input Validation                                         │
│    - Zod schema validation                                  │
│    - SQL injection prevention                               │
│    - XSS protection                                         │
│    - CSRF tokens                                            │
├─────────────────────────────────────────────────────────────┤
│ 5. Rate Limiting                                            │
│    - API endpoint throttling                                │
│    - Login attempt limits                                   │
│    - reCAPTCHA for forms                                    │
├─────────────────────────────────────────────────────────────┤
│ 6. Data Protection                                          │
│    - Password hashing (bcrypt)                              │
│    - Encrypted environment variables                        │
│    - Secure session storage                                 │
│    - No sensitive data in logs                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Monitoring & Observability

```
Application Events
        │
        ├──> Error Tracking (Sentry - planned)
        │    - Exception capture
        │    - Stack traces
        │    - User context
        │
        ├──> Performance Monitoring
        │    - API response times
        │    - Database query duration
        │    - Page load metrics
        │
        ├──> Logging
        │    - Structured logs
        │    - Request/response logging
        │    - Database query logs
        │
        └──> Analytics (Supabase)
             - User activity
             - Feature usage
             - Conversion tracking
```

---

## 🔄 Deployment Architecture

```
┌─────────────┐
│   GitHub    │
│ Repository  │
└──────┬──────┘
       │
       │ Push to main
       │
┌──────▼──────┐
│   CI/CD     │
│  Pipeline   │
│ (GitHub     │
│  Actions)   │
└──────┬──────┘
       │
       ├──> Lint & Type Check
       ├──> Run Tests
       ├──> Build Application
       │
┌──────▼──────────────────────────────────────────┐
│           Deployment Platform                    │
│          (Vercel / Railway)                     │
│  ┌────────────────────────────────────────────┐│
│  │  Frontend Build (Static)                   ││
│  │  - Vite optimized bundle                   ││
│  │  - CDN distribution                        ││
│  │  - Edge caching                            ││
│  └────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────┐│
│  │  Backend Server (Node.js)                  ││
│  │  - Express API                             ││
│  │  - Serverless functions                    ││
│  │  - Auto-scaling                            ││
│  └────────────────────────────────────────────┘│
└─────────────────────┬─────────────────────────┬──┘
                      │                         │
              ┌───────▼───────┐        ┌────────▼────────┐
              │   Supabase    │        │  External APIs  │
              │  (Database)   │        │  (OpenAI, etc)  │
              └───────────────┘        └─────────────────┘
```

---

**Last Updated:** October 24, 2025  
**Version:** 1.0



