/**
 * The robot run's ONE change to the app: who a bearer token belongs to. Importing this file does
 * nothing; installRobotSignIn replaces `supabase.auth.getUser` on the object that
 * server/auth/index.ts calls per request, in the robot process only, and only on a `_robots`
 * database. Nothing in the app imports it (signIn.test.ts checks that statically).
 *
 * `email_confirmed_at` is never set, so no robot can become an admin through ADMIN_EMAILS.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertRobotDatabase } from './guards';

export const ROBOT_TOKEN_PREFIX = 'robot-';

export interface RobotProfile {
  county: string;
  constituency: string;
}

/** robot-<n> → the user the app sees; anything else is an unknown token. */
export function robotUser(token: string, profileFor: (n: number) => RobotProfile) {
  const match = /^robot-(\d{1,6})$/.exec(token);
  if (!match) return null;
  const id = `${ROBOT_TOKEN_PREFIX}${match[1]}`;
  const { county, constituency } = profileFor(Number(match[1]));
  return {
    id,
    email: `${id}@robots.invalid`,
    app_metadata: {},
    user_metadata: { region_code: 'IE', county, constituency },
  };
}

export function installRobotSignIn(
  supabase: Pick<SupabaseClient, 'auth'>,
  currentDatabase: string | undefined,
  profileFor: (n: number) => RobotProfile,
): void {
  assertRobotDatabase(currentDatabase);
  const getUser = async (token?: string) => {
    const user = token ? robotUser(token, profileFor) : null;
    return user ? { data: { user }, error: null } : { data: { user: null }, error: new Error('not a robot token') };
  };
  (supabase.auth as unknown as { getUser: typeof getUser }).getUser = getUser;
}
