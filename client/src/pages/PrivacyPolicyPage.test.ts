/**
 * The privacy policy's "Server Log" section must say what the server actually logs and keeps. The
 * client has no component test setup, so this reads the sources as text, as cookieNotice.test.ts does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const policy = fs.readFileSync(path.join(ROOT, 'client', 'src', 'pages', 'PrivacyPolicyPage.tsx'), 'utf8');
const compose = fs.readFileSync(path.join(ROOT, 'deploy', 'compose.yml'), 'utf8');

describe('privacy policy: server log', () => {
  it('claims nothing the app does not collect', () => {
    for (const claim of [/Pages visited/i, /Referral sources/i, /Session duration/i, /Google Analytics/i, /Analytics Provider/i, /anonymi[sz]ed after/i]) {
      expect(policy).not.toMatch(claim);
    }
  });

  it('states the same log size limit as the app container in deploy/compose.yml', () => {
    // The app service's json-file options are the first logging block in the file.
    const size = /max-size:\s*"(\d+)m"/.exec(compose);
    const files = /max-file:\s*"(\d+)"/.exec(compose);
    expect(size && files, 'logging options not found in deploy/compose.yml').toBeTruthy();
    const perFile = Number(size![1]);
    expect(policy).toContain(`newest ${perFile * Number(files![1])} MB`);
    expect(policy).toContain(`files of ${perFile} MB`);
  });
});
