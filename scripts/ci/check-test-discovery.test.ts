import { describe, expect, it } from 'vitest';
import { findings, TEST_FILE } from './check-test-discovery';

describe('test discovery guard', () => {
  const tracked = ['server/a.test.ts', 'test/e2e/b.spec.ts'];

  it('passes when each file in git is run once', () => {
    expect(findings({ tracked, vitest: ['server/a.test.ts'], playwright: ['test/e2e/b.spec.ts'] })).toEqual([]);
  });

  it('fails a file in git that no runner runs', () => {
    expect(findings({ tracked, vitest: [], playwright: ['test/e2e/b.spec.ts'] })).toEqual([
      'server/a.test.ts: in git but no test runner runs it',
    ]);
  });

  it('fails a file both runners run', () => {
    expect(
      findings({ tracked, vitest: ['server/a.test.ts', 'test/e2e/b.spec.ts'], playwright: ['test/e2e/b.spec.ts'] }),
    ).toEqual(['test/e2e/b.spec.ts: run by both vitest and playwright']);
  });

  it('fails a file a runner runs that is not in git', () => {
    expect(
      findings({ tracked, vitest: ['server/a.test.ts', 'dist/c.test.js'], playwright: ['test/e2e/b.spec.ts'] }),
    ).toEqual(['dist/c.test.js: a runner runs it but it is not in git']);
  });

  it('recognises test and spec files only', () => {
    expect(['a.test.ts', 'b.spec.tsx', 'c.test.mjs'].every((f) => TEST_FILE.test(f))).toBe(true);
    expect(['a.ts', 'testing/migrations.ts', 'a.test.ts.snap'].some((f) => TEST_FILE.test(f))).toBe(false);
  });
});
