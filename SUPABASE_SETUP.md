# Supabase Migration Setup Guide

This guide will walk you through migrating your Glas Politics application from Replit infrastructure to Supabase.

---

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in project details:
   - **Name:** Glas Politics (or your preferred name)
   - **Database Password:** Choose a strong password (save this!)
   - **Region:** Choose closest to Ireland (e.g., `eu-west-1` or `eu-west-2`)
   - **Pricing Plan:** Start with Free tier (can upgrade later)
5. Click **"Create new project"**
6. Wait for project to be provisioned (2-3 minutes)

---

## Step 2: Get Supabase Credentials

Once your project is ready:

### Get Database Connection String

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Under **Connection string**, select **URI** tab
3. Copy the connection string (it looks like this):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you set in Step 1

### Get Direct Connection String (for migrations)

1. Still in **Settings** → **Database**
2. Under **Connection string**, select **Direct Connection** tab
3. Copy this string (looks like):
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```

### Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL:** `https://[PROJECT-REF].supabase.co`
   - **anon public key:** Long string starting with `eyJ...`
   - **service_role key:** Long string starting with `eyJ...` (⚠️ Keep this secret!)

---

## Step 3: Create .env File

1. In your project root, copy the `.env.template` file:
   ```bash
   cp .env.template .env
   ```

2. Open `.env` and fill in your Supabase credentials:

   ```env
   # Database - From Step 2
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   DIRECT_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   
   # Supabase API - From Step 2
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_ANON_KEY=eyJ... (your anon key)
   SUPABASE_SERVICE_ROLE_KEY=eyJ... (your service role key)
   
   # Session Secret - Generate a random string
   SESSION_SECRET=your-super-secret-session-key-at-least-32-chars-long
   
   # Add your existing API keys
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   SENDGRID_API_KEY=SG....
   # ... etc
   ```

3. **Generate a session secret:**
   ```bash
   # On Linux/Mac
   openssl rand -base64 32
   
   # On Windows (PowerShell)
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
   
   # Or use any random 32+ character string
   ```

4. Save the file

⚠️ **Important:** Never commit `.env` to git! It should already be in `.gitignore`.

---

## Step 4: Install Dependencies

Install the Supabase client libraries:

```bash
npm install @supabase/supabase-js
```

This has already been added to the project setup.

---

## Step 5: Run Database Migrations

Now we'll create the database schema in Supabase:

1. **Generate migration (if schema changed):**
   ```bash
   npm run db:generate
   ```

2. **Push schema to Supabase:**
   ```bash
   npm run db:push
   ```
   
   This will create all the tables defined in `shared/schema.ts` in your Supabase database.

3. **Verify in Supabase Dashboard:**
   - Go to **Table Editor** in Supabase Dashboard
   - You should see all your tables:
     - `users`
     - `quiz_results`
     - `parties`
     - `pledges`
     - etc.

---

## Step 6: Update Database Connection

You have two options:

### Option A: Switch to Supabase (Recommended)

1. Rename `server/db.ts` to `server/db.old.ts` (backup)
2. Rename `server/db.supabase.ts` to `server/db.ts`
3. Test the connection:
   ```bash
   npm run dev
   ```

### Option B: Keep Both (for gradual migration)

You can import from `server/db.supabase.ts` in new code while keeping old code working.

---

## Step 7: Update Authentication

### Backend Setup

The new auth system is in `server/auth/supabaseAuth.ts`. To use it:

1. **Update your route imports:**
   
   **Before:**
   ```typescript
   import { isAuthenticated } from "./replitAuth";
   ```
   
   **After:**
   ```typescript
   import { isAuthenticated } from "./auth/supabaseAuth";
   ```

2. **Update route protection:**
   
   Routes stay the same! The middleware signature is compatible:
   ```typescript
   app.get("/api/protected", isAuthenticated, async (req, res) => {
     // req.user is now the Supabase user
     const user = req.user;
     res.json({ user });
   });
   ```

### Frontend Setup

1. **Install Supabase client in frontend:**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create Supabase client:**
   
   Create `client/src/lib/supabase.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

3. **Update AuthContext:**
   
   Modify `client/src/contexts/AuthContext.tsx` to use Supabase auth instead of Replit auth.
   (See the detailed implementation in the refactoring plan)

4. **Add environment variables:**
   
   Add to `.env`:
   ```env
   VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ... (your anon key)
   ```

---

## Step 8: Test the Migration

### Test Database Connection

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Check console for:
   ```
   ✅ Database connection healthy
   ```

### Test Authentication

1. Try logging in with an existing user
2. Try creating a new user
3. Check that protected routes work
4. Verify user data in Supabase Dashboard → **Authentication** → **Users**

### Test Queries

Run some basic queries to ensure data access works:
- Load quiz questions
- Save quiz results
- Fetch party data
- Load constituency information

---

## Step 9: Data Migration (If Needed)

If you have existing data in Replit DB:

### Option A: Manual Export/Import

1. **Export from Replit:**
   ```bash
   # Create a script to export data
   npm run export-data
   ```

2. **Import to Supabase:**
   ```bash
   # Use psql or Supabase SQL Editor
   psql $DATABASE_URL < data-export.sql
   ```

### Option B: Programmatic Migration

Create a migration script:
```typescript
// scripts/migrate-data.ts
import { oldDb } from './old-db-connection';
import { db } from './server/db';

async function migrateData() {
  // Fetch from old DB
  const users = await oldDb.query('SELECT * FROM users');
  
  // Insert into Supabase
  for (const user of users.rows) {
    await db.insert(schema.users).values(user);
  }
}

migrateData();
```

### Option C: Use Supabase CLI

If you have a PostgreSQL dump:
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref [YOUR-PROJECT-REF]

# Restore database
supabase db reset
```

---

## Step 10: Enable Supabase Features

### Row Level Security (RLS)

For better security, enable RLS on sensitive tables:

1. Go to **Table Editor** in Supabase
2. Select a table (e.g., `users`)
3. Click **"Add RLS policy"**
4. Example policies:

   ```sql
   -- Users can only read their own data
   CREATE POLICY "Users can view own data"
     ON users FOR SELECT
     USING (auth.uid() = id);
   
   -- Users can update their own profile
   CREATE POLICY "Users can update own profile"
     ON users FOR UPDATE
     USING (auth.uid() = id);
   ```

### Realtime (Optional)

Enable realtime for live updates:

1. Go to **Database** → **Replication**
2. Enable replication for tables you want to be realtime
3. Use in your frontend:
   ```typescript
   const channel = supabase
     .channel('quiz-results')
     .on('postgres_changes', 
       { event: 'INSERT', schema: 'public', table: 'quiz_results' },
       (payload) => console.log('New result:', payload)
     )
     .subscribe();
   ```

### Storage (Optional)

If you need file uploads:

1. Go to **Storage** in Supabase
2. Create a bucket (e.g., `user-uploads`)
3. Set policies for who can upload/download
4. Use in your app:
   ```typescript
   const { data, error } = await supabase.storage
     .from('user-uploads')
     .upload('avatar.png', file);
   ```

---

## Troubleshooting

### "Cannot connect to database"

- ✅ Check that DATABASE_URL is correct
- ✅ Verify your database password
- ✅ Ensure your IP isn't blocked (Supabase allows all by default)
- ✅ Check if project is paused (free tier pauses after inactivity)

### "Authentication failed"

- ✅ Verify SUPABASE_ANON_KEY is correct
- ✅ Check that SUPABASE_URL matches your project
- ✅ Ensure token is being sent in Authorization header

### "Migration failed"

- ✅ Use DIRECT_URL instead of DATABASE_URL for migrations
- ✅ Check for conflicting table names
- ✅ Verify schema syntax is correct

### "RLS policy blocking query"

- ✅ Temporarily disable RLS to test
- ✅ Check policy conditions match your query
- ✅ Use service_role key for admin operations (server-side only!)

---

## Performance Tips

### Connection Pooling

Supabase uses PgBouncer for connection pooling. For best performance:

- Use **Transaction mode** pooling (port 6543) for migrations
- Use **Session mode** pooling (port 5432) for app connections

### Indexes

Add indexes for frequently queried columns:

```sql
-- In Supabase SQL Editor
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX idx_pledges_party_id ON pledges(party_id);
```

### Query Optimization

Use the **Query Performance** tab in Supabase to identify slow queries.

---

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Never commit `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Enable RLS on all tables with user data
- [ ] Use `SUPABASE_ANON_KEY` in frontend only
- [ ] Use `SUPABASE_SERVICE_ROLE_KEY` on backend only
- [ ] Enable email verification for new users
- [ ] Set up rate limiting on auth endpoints
- [ ] Enable 2FA for admin users
- [ ] Regular security audits via Supabase Dashboard

---

## Next Steps

After successful migration:

1. ✅ Update environment variables in production
2. ✅ Deploy to production environment
3. ✅ Monitor for errors (Supabase has built-in logging)
4. ✅ Set up backups (automatic in Supabase)
5. ✅ Configure alerting for downtime
6. ✅ Remove old Replit auth code
7. ✅ Update documentation

---

## Support

- **Supabase Docs:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **Drizzle ORM Docs:** https://orm.drizzle.team/docs/overview

---

**Created:** October 24, 2025  
**Last Updated:** October 24, 2025  
**Version:** 1.0



