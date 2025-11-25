import { defineConfig } from "drizzle-kit";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please add your Supabase connection string to .env");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Use DATABASE_URL for connection pooling
    // For migrations, Supabase recommends using the direct connection
    // You can set DIRECT_URL in .env for better migration performance
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
  // Supabase-specific configuration
  migrations: {
    table: "drizzle_migrations",
    schema: "public",
  }
});



