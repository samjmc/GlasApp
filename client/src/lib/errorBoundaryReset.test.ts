/**
 * The global ErrorBoundary wraps AuthProvider, RegionProvider and ConsentProvider. A `key` on it
 * that changes with the location remounted all of them on every navigation: auth went back to
 * "loading" (a full-screen loader per click) and open dialogs and pending consent promises were
 * lost. It must reset itself instead. The client has no component test setup, so the wiring is
 * read as text and the decision is tested as a pure function.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldResetBoundary } from './errorBoundaryReset';

const SRC = path.resolve(__dirname, '..');
const boundarySource = fs.readFileSync(path.join(SRC, 'components', 'ErrorBoundary.tsx'), 'utf8');

describe('shouldResetBoundary', () => {
  it('clears a crashed boundary when the location changes', () => {
    expect(shouldResetBoundary(true, '/td/a', '/')).toBe(true);
  });

  it('keeps showing the fallback while the location is the same', () => {
    expect(shouldResetBoundary(true, '/td/a', '/td/a')).toBe(false);
  });

  it('never touches a healthy boundary on navigation', () => {
    expect(shouldResetBoundary(false, '/td/a', '/')).toBe(false);
  });
});

describe('ErrorBoundary wiring', () => {
  it('does not key the boundary on the location', () => {
    const open = boundarySource.match(/<ErrorBoundaryCore\b[^>]*>/);
    expect(open, 'the <ErrorBoundaryCore ...> element was not found').not.toBeNull();
    expect(open![0]).not.toMatch(/\bkey=/);
    expect(open![0]).toMatch(/resetKey=\{location\}/);
  });

  it('resets itself on a location change through shouldResetBoundary', () => {
    expect(boundarySource).toMatch(/componentDidUpdate\(/);
    expect(boundarySource).toMatch(/shouldResetBoundary\(/);
  });
});
