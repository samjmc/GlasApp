/**
 * The cookie notice used to offer "Analytics" and "Preferences" switches and wrote
 * `cookie_analytics` / `cookie_functional` cookies that nothing ever read, while the app stored
 * quiz progress, theme and tour flags whatever was chosen. The owner dropped the switches: the app
 * only stores what it needs and has no analytics. The client has no component test setup, so this
 * reads the source as text; the behaviour is covered by test/e2e/cookie-notice.spec.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const notice = fs.readFileSync(path.join(SRC, 'components', 'CookieConsent.tsx'), 'utf8');
const policy = fs.readFileSync(path.join(SRC, 'pages', 'PrivacyPolicyPage.tsx'), 'utf8');

describe('cookie notice', () => {
  it('still records that it was shown, so it appears once', () => {
    expect(notice).toMatch(/"cookie_consent"/);
  });

  it('writes no cookies and offers no switches', () => {
    expect(notice).not.toMatch(/document\.cookie/);
    expect(notice).not.toMatch(/cookie_analytics|cookie_functional/);
    expect(notice).not.toMatch(/Switch/);
  });
});

describe('privacy policy cookie wording', () => {
  it('no longer describes optional analytics or functional cookies', () => {
    expect(policy).not.toMatch(/requires consent/i);
    expect(policy).not.toMatch(/cookie banner/i);
    expect(policy).not.toMatch(/Analytics cookies \(optional/);
  });

  it('says there are no analytics or advertising cookies', () => {
    expect(policy).toMatch(/No analytics or advertising cookies/);
  });
});
