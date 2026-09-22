import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// `generate` never connects, so it works with a placeholder. `push`, `migrate` and
// `studio` need the real GlasCore connection string.
const url = process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgres://placeholder';

export default defineConfig({
  out: './drizzle',
  schema: './shared/schema/politics.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
  // GlasCore is shared with GlasIntelligence (whose tables are in `public`).
  // Only ever diff or push the schema this app owns.
  schemaFilter: ['politics'],
  verbose: true,
  strict: true,
});
