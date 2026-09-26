# 🇮🇪 Glas Politics

An advanced Irish political analysis platform providing multidimensional political quizzes, party matching, pledge tracking, and electoral insights.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Setup](#-environment-setup)
- [Documentation](#-documentation)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## ✨ Features

### 🗳️ Political Quiz System
- **8-Dimensional Scoring:** Economic, Social, Cultural, Globalism, Environmental, Authority, Welfare, Technocratic
- **Party Matching Algorithm:** Find which Irish parties align with your views
- **Historical Tracking:** See how your political views evolve over time
- **Share Results:** Generate shareable links for quiz results
- **AI-Powered Insights:** Get personalized analysis of your political profile

### 🗺️ Electoral Mapping
- **Interactive Maps:** Explore Irish constituencies with detailed boundaries
- **User Heatmaps:** Visualize political leanings across Ireland
- **Constituency Comparison:** Compare constituencies side-by-side
- **Trend Predictions:** AI-powered electoral trend analysis

### 📊 Pledge Tracking
- **Party Pledges Database:** Track what parties promised
- **Fulfillment Scoring:** Rate how well parties keep their promises
- **User Voting:** Vote on pledge importance
- **Category Rankings:** Prioritize what matters most to you

### 🏛️ Parliamentary Activity
- **TD Performance Metrics:** Track politician effectiveness
- **Trust Scores:** Community-driven trustworthiness ratings
- **Parliamentary Engagement:** Monitor Dáil participation
- **Question Activity:** See who's asking questions in parliament

### 💡 Community Features
- **Daily Policy Votes:** Vote on a few policy questions each day
- **User Engagement:** Track community activity

### 🤖 AI Integration
- **OpenAI Analysis:** Advanced political insights
- **Anthropic Claude:** Enhanced contextual understanding
- **Quiz Assistance:** AI-powered quiz explanations
- **Personalized Insights:** Custom analysis for your constituency

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Wouter** - Lightweight routing
- **TanStack Query** - Data fetching & caching
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **Leaflet** - Interactive maps

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Database toolkit
- **Supabase** - PostgreSQL + Auth + Storage
- **Zod** - Schema validation

### Services
- **Supabase** - Database, Auth, Storage
- **OpenAI** - GPT-4 for analysis
- **Anthropic** - Claude for insights
- **SendGrid/Resend** - Email delivery
- **Twilio** - SMS verification

### DevOps
- **Vite** - Build tool
- **ESBuild** - Bundler
- **Drizzle Kit** - Database migrations
- **Git** - Version control

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)
- API keys for AI services (optional for basic features)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/glas-politics.git
cd glas-politics

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with the GlasCore connection string and keys

# Apply the database migrations (creates the `politics` schema)
npm run db:migrate

# Populate TDs from the Oireachtas roster (scoring needs this)
npm run sync-tds

# Start development server
npm run dev
```

Visit http://localhost:5000 to see the app!

---

## 🔐 Environment Setup

The database is the **GlasCore** Supabase project, shared with GlasIntelligence. GlasApp's
tables live in their own Postgres schema, `politics`, defined in `shared/schema/politics.ts`
and applied with Drizzle migrations from `drizzle/`. Server code talks to Postgres directly
through Drizzle (`server/db.ts`); Supabase is used for Auth.

Every variable, with comments, is in [`.env.example`](.env.example). The essentials:

```env
DATABASE_URL=postgresql://...        # GlasCore Postgres
SUPABASE_URL=https://...             # Auth
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=                      # required in production
LLM_API_KEY=                         # DeepSeek: all chat AI (news ranking, TD scoring panel)
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL_NAME=deepseek-flash
OPENAI_API_KEY=                      # embeddings only (debate search)
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [docs/auth.md](docs/auth.md) | Authentication: the one mechanism, the guards, the profile |
| [docs/scoring.md](docs/scoring.md) | How TDs are scored: model, pipeline, tables, API |
| [docs/security/](docs/security/) | Security audits |

---

## 📁 Project Structure

```
glas-politics/
├── client/                 # Frontend React application
│   └── src/
│       ├── components/     # Reusable UI components (130+)
│       ├── pages/          # Page components (30+)
│       ├── contexts/       # React contexts for state
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utilities & configurations
│       ├── services/       # API service layer
│       └── types/          # TypeScript type definitions
│
├── server/                 # Backend Express application
│   ├── routes/             # API route handlers (40+)
│   ├── services/           # Business logic services
│   ├── middleware/         # Express middleware
│   ├── auth/               # Authentication logic
│   ├── db.ts              # Database connection
│   └── index.ts           # Server entry point
│
├── shared/                 # Shared code between client/server
│   ├── schema.ts          # Database schema (Drizzle)
│   ├── types.ts           # Shared TypeScript types
│   └── data/              # Shared data files
│
├── migrations/             # Database migrations
├── public/                 # Static assets
├── scripts/               # Utility scripts
└── docs/                  # Documentation
```

---

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run check            # TypeScript type checking

# Database
npm run db:push          # Push schema to database
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio (DB GUI)

# Build & Deploy
npm run build            # Build for production
npm run start            # Run production server
```

### Development Workflow

1. **Make changes** to code
2. **Type check** with `npm run check`
3. **Test locally** with `npm run dev`
4. **Commit changes** with descriptive message
5. **Push to repository**

### Database Changes

1. **Modify schema** in `shared/schema.ts`
2. **Generate migration** with `npm run db:generate`
3. **Review migration** in `migrations/` folder
4. **Apply migration** with `npm run db:push`
5. **Test changes** thoroughly

---

## 🌐 Deployment

### Recommended Platforms

- **Vercel** (easiest) - Zero config deployment
- **Railway** - Full-stack deployment
- **Fly.io** - Global edge deployment
- **Render** - Free tier available

### Environment Variables

Make sure to set all required environment variables in your deployment platform:
- Copy from `.env`
- Set `NODE_ENV=production`
- Use production API keys
- Enable HTTPS

### Build Command
```bash
npm run build
```

### Start Command
```bash
npm start
```

---

## 🧪 Testing

Currently being set up. Planned coverage:

- **Unit Tests:** Vitest for services & utilities
- **Integration Tests:** Supertest for API endpoints
- **E2E Tests:** Playwright for user flows

### Priority Test Areas
1. Authentication flows
2. Quiz scoring logic
3. Party matching algorithm
4. Pledge tracking calculations
5. Database operations

---

## 🔄 Migration Status

Currently migrating from **Replit infrastructure** to **Supabase**.

### ✅ Completed
- [x] Environment configuration templates
- [x] Supabase database setup files
- [x] Supabase auth implementation
- [x] Frontend Supabase client
- [x] Documentation created
- [x] Refactoring plan outlined

### ⏳ In Progress
- [ ] Database migration
- [ ] Auth system update
- [ ] Route consolidation
- [ ] Service layer creation
- [ ] Performance optimization

See [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) for details.

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit changes** (`git commit -m 'Add AmazingFeature'`)
4. **Push to branch** (`git push origin feature/AmazingFeature`)
5. **Open Pull Request**

### Code Style
- Use TypeScript
- Follow existing patterns
- Add comments for complex logic
- Update documentation

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Irish Political Data:** Various public sources
- **UI Components:** Radix UI team
- **Mapping Data:** OpenStreetMap contributors
- **AI Services:** OpenAI & Anthropic

---

## 📞 Contact

- **Website:** [glaspolitics.ie](https://glaspolitics.ie) (coming soon)
- **Issues:** [GitHub Issues](https://github.com/yourusername/glas-politics/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/glas-politics/discussions)

---

## 🗺️ Roadmap

### Q4 2024
- [x] Initial project setup
- [x] Core quiz functionality
- [x] Basic party matching
- [ ] Complete Supabase migration
- [ ] Production deployment

### Q1 2025
- [ ] Mobile app (React Native)
- [ ] Real-time features
- [ ] Advanced analytics dashboard
- [ ] API documentation
- [ ] Public API access

### Q2 2025
- [ ] Internationalization (Irish language)
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Advanced caching

### Future
- [ ] Local council integration
- [ ] European Parliament data
- [ ] Historical election data
- [ ] Citizen journalism features

---

## 📊 Current Statistics

- **Database Tables:** 25+
- **API Endpoints:** 100+
- **React Components:** 130+
- **Pages:** 30+
- **Political Parties Tracked:** 10+
- **Constituencies:** 43
- **Quiz Questions:** 50+

---

## 🎯 Core Goals

1. **Educate** - Help citizens understand Irish politics
2. **Engage** - Increase political participation
3. **Empower** - Give voice to citizen concerns
4. **Inform** - Provide data-driven insights
5. **Connect** - Build community around civic engagement

---

**Made with ❤️ for Irish democracy**

---

*Last updated: October 24, 2025*



