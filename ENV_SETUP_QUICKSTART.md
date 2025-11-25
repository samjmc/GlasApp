# Environment Setup - Quick Start

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Save your database password!

### Step 2: Get Your Credentials

In Supabase Dashboard:

**Database URL (Settings → Database):**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**API Keys (Settings → API):**
- Project URL: `https://[PROJECT-REF].supabase.co`
- Anon key: `eyJ...` (copy this)
- Service role key: `eyJ...` (copy this, keep secret!)

### Step 3: Create .env File

Create a `.env` file in your project root:

```bash
# Windows PowerShell
Copy-Item .env.template .env

# Mac/Linux
cp .env.template .env
```

### Step 4: Fill in Required Values

Open `.env` and add these **minimum required** values:

```env
# Supabase Database
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# Session Secret (generate random string)
SESSION_SECRET=your-random-32-character-string-here

# AI Keys (add your existing keys)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email (add your existing keys)
SENDGRID_API_KEY=SG....

# Environment
NODE_ENV=development
```

### Step 5: Install & Run

```bash
# Install dependencies
npm install

# Push database schema to Supabase
npm run db:push:supabase

# Start development server
npm run dev
```

### Step 6: Verify

Open http://localhost:5000 and check console for:
```
✅ Database connection healthy
```

---

## 🔑 Where to Get API Keys

### Supabase (Required)
- Website: https://supabase.com
- Dashboard → Your Project → Settings → API
- You need: URL, Anon Key, Service Role Key

### OpenAI (Required for AI features)
- Website: https://platform.openai.com
- Dashboard → API Keys → Create new secret key
- You need: API key starting with `sk-`

### Anthropic/Claude (Required for AI features)
- Website: https://console.anthropic.com
- Settings → API Keys → Create key
- You need: API key starting with `sk-ant-`

### SendGrid (Required for emails)
- Website: https://sendgrid.com
- Settings → API Keys → Create API Key
- You need: API key starting with `SG.`

### Twilio (Optional - for SMS)
- Website: https://twilio.com
- Console → Account → API credentials
- You need: Account SID, Auth Token, Phone Number

---

## 🛠️ Troubleshooting

### "Cannot connect to database"
✅ Check DATABASE_URL is correct  
✅ Verify password doesn't have special characters (or escape them)  
✅ Ensure Supabase project isn't paused

### "Missing environment variable"
✅ Make sure .env file is in project root  
✅ Restart dev server after changing .env  
✅ Check variable name spelling

### "Invalid API key"
✅ Copy entire key (they're long!)  
✅ No extra spaces before/after  
✅ Keys start with correct prefix (sk-, SG., etc.)

---

## 📋 Environment Variable Checklist

**Required for Basic Functionality:**
- [x] DATABASE_URL
- [x] SUPABASE_URL
- [x] SUPABASE_ANON_KEY
- [x] SUPABASE_SERVICE_ROLE_KEY
- [x] SESSION_SECRET
- [x] NODE_ENV

**Required for AI Features:**
- [ ] OPENAI_API_KEY
- [ ] ANTHROPIC_API_KEY

**Required for Email:**
- [ ] SENDGRID_API_KEY
- [ ] SENDGRID_FROM_EMAIL

**Optional:**
- [ ] TWILIO_ACCOUNT_SID (for SMS)
- [ ] TWILIO_AUTH_TOKEN
- [ ] RECAPTCHA_SECRET_KEY (for bot protection)
- [ ] VITE_MAPBOX_ACCESS_TOKEN (for maps)

---

## 🔐 Security Best Practices

1. **Never commit .env file** - Already in .gitignore ✅
2. **Use different keys for dev/production**
3. **Keep service_role key on backend only**
4. **Rotate keys periodically**
5. **Use HTTPS in production**

---

## 📝 Quick Commands

```bash
# Check if .env is loaded
npm run dev
# (Look for environment variable errors)

# Test database connection
npm run db:studio
# (Opens Drizzle Studio to browse database)

# Push schema changes
npm run db:push:supabase

# View all environment variables (debugging)
# Add this to your code temporarily:
console.log(process.env);
```

---

## ✨ Next Steps

After setup:
1. ✅ Database connected
2. ⏩ Follow `SUPABASE_SETUP.md` for complete migration
3. ⏩ Follow `REFACTORING_PLAN.md` for code improvements

---

**Need detailed help?** See `SUPABASE_SETUP.md`  
**Want to understand the refactoring?** See `REFACTORING_PLAN.md`  
**Want a full overview?** See `MIGRATION_SUMMARY.md`



