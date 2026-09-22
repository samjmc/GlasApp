/**
 * Supabase clients. Auth only — application data goes through Drizzle (`server/db.ts`).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const) {
  if (!process.env[key]) throw new Error(`${key} must be set. See .env.example.`);
}

/** Anon-key client. Used to verify access tokens presented by callers. */
export const supabase: SupabaseClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: false },
});

/**
 * Service-role client. Manages Auth users (role assignment, account deletion).
 * Never use it to read or write application tables — that is Drizzle's job, and the
 * service role bypasses every policy.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Replace a user's `user_metadata`. Self-editable data; never authorisation. */
export async function updateUserMetadata(userId: string, metadata: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: metadata });
  if (error) throw new Error(`Update metadata failed: ${error.message}`);
}

/** Remove the Auth user. Application rows are deleted by the caller first. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Delete user failed: ${error.message}`);
}
