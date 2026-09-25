import { describe, expect, it } from 'vitest';
import { buildMailto } from './contact';

describe('buildMailto', () => {
  it('routes the topic to its address and encodes the message', () => {
    const mail = buildMailto({ name: ' Aoife Ní Bhriain ', subject: 'privacy', message: 'Delete my data & quiz?\nThanks' });
    expect(mail.to).toBe('privacy@glaspolitics.ie');
    const url = new URL(mail.href);
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe('privacy@glaspolitics.ie');
    expect(url.searchParams.get('subject')).toBe('Privacy/GDPR request from Aoife Ní Bhriain');
    expect(url.searchParams.get('body')).toBe('Delete my data & quiz?\nThanks\n\nAoife Ní Bhriain');
  });

  it('sends bug reports to support and unknown topics to the general address', () => {
    expect(buildMailto({ name: 'A', subject: 'bug', message: 'x' }).to).toBe('support@glaspolitics.ie');
    expect(buildMailto({ name: 'A', subject: 'nope', message: 'x' }).to).toBe('contact@glaspolitics.ie');
  });
});
