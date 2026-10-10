import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { installRobotSignIn, robotUser } from './signIn';

const ROOT = path.resolve(__dirname, '../../..');
const profile = () => ({ county: 'Cork', constituency: 'Cork South-Central' });

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}
const APP = [...sourceFiles('server'), ...sourceFiles('shared'), ...sourceFiles('client/src')];
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('robot sign-in swap', () => {
  it('maps robot-<n> to a robot user who can never be an admin', () => {
    const user = robotUser('robot-12', profile)!;
    expect(user).toMatchObject({ id: 'robot-12', email: 'robot-12@robots.invalid', user_metadata: { region_code: 'IE', county: 'Cork' } });
    expect(user).not.toHaveProperty('email_confirmed_at');
    expect(user.app_metadata).toEqual({});
    for (const token of ['robot-', 'robot-x', 'e2e.fake.token', 'robot-12 ', 'robot-1234567']) expect(robotUser(token, profile), token).toBeNull();
  });

  it('installs only on a _robots database, and then answers per token', async () => {
    const supabase = { auth: { getUser: async () => ({ data: { user: { id: 'real' } }, error: null }) } };
    expect(() => installRobotSignIn(supabase as never, 'postgres', profile)).toThrow(/refusing/);
    expect((await supabase.auth.getUser()).data.user).toEqual({ id: 'real' });

    installRobotSignIn(supabase as never, 'postgres_robots', profile);
    const getUser = supabase.auth.getUser as unknown as (token?: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    expect((await getUser('robot-3')).data.user?.id).toBe('robot-3');
    const unknown = await getUser('someone');
    expect(unknown.data.user).toBeNull();
    expect(unknown.error).toBeInstanceOf(Error);
  });

  it('is reachable only from the robot runner, never from the app', () => {
    expect(APP.length).toBeGreaterThan(100);
    // Only the runner imports the swap.
    const importers = APP.filter((f) => /from ['"][./]*(robots\/)?signIn['"]/.test(read(f)) && f !== 'server/jobs/robots/signIn.ts');
    expect(importers).toEqual(['server/jobs/robots.ts']);
    // Nothing outside server/jobs imports a job, so the build (server/index.ts) never bundles one.
    const jobImporters = APP.filter((f) => !f.startsWith('server/jobs/') && /from ['"][^'"]*\/jobs\//.test(read(f)));
    expect(jobImporters).toEqual([]);
    // And no other file replaces getUser.
    const assigners = APP.filter((f) => /\.getUser\s*=(?!=)/.test(read(f)));
    expect(assigners).toEqual(['server/jobs/robots/signIn.ts']);
  });
});
