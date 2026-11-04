/**
 * Keyboard and screen-reader gaps on the main flows (sweep C28): the quiz's answer radio group had
 * no arrow keys and every answer was a tab stop; a new question was not announced; the "Saved"
 * live text never changed; the profile photo input was display:none; admin Selects had a <Label>
 * tied to nothing. The client has no component test setup, so the key rules are tested as pure
 * functions and the wiring is read as text; test/e2e/quiz-keyboard.spec.ts drives the quiz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { arrowKeyTarget, isTabStop } from './radioGroupKeys';

const read = (...parts: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...parts), 'utf8');

describe('arrowKeyTarget', () => {
  it('Down and Right move to the next radio, wrapping at the end', () => {
    expect(arrowKeyTarget('ArrowDown', 0, 4)).toBe(1);
    expect(arrowKeyTarget('ArrowRight', 2, 4)).toBe(3);
    expect(arrowKeyTarget('ArrowDown', 3, 4)).toBe(0);
  });

  it('Up and Left move to the previous radio, wrapping at the start', () => {
    expect(arrowKeyTarget('ArrowUp', 2, 4)).toBe(1);
    expect(arrowKeyTarget('ArrowLeft', 1, 4)).toBe(0);
    expect(arrowKeyTarget('ArrowUp', 0, 4)).toBe(3);
  });

  it('ignores every other key, including inherited object keys', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Home', 'a', 'toString', 'constructor', '__proto__']) {
      expect(arrowKeyTarget(key, 1, 4), key).toBeNull();
    }
  });

  it('does nothing in an empty group', () => {
    expect(arrowKeyTarget('ArrowDown', 0, 0)).toBeNull();
  });
});

describe('isTabStop', () => {
  it('is the selected radio when there is one', () => {
    expect([0, 1, 2].map((p) => isTabStop(p, 2))).toEqual([false, false, true]);
  });

  it('is the first radio when none is selected', () => {
    expect([0, 1, 2].map((p) => isTabStop(p, -1))).toEqual([true, false, false]);
  });
});

describe('QuizPage wiring', () => {
  const quiz = read('pages', 'QuizPage.tsx');

  it('gives the answers a roving tabindex and arrow keys', () => {
    expect(quiz).toMatch(/tabIndex=\{isTabStop\(position, /);
    expect(quiz).toMatch(/onKeyDown=\{\(event\) => handleRadioKeyDown\(event, position\)\}/);
    expect(quiz).toMatch(/arrowKeyTarget\(event\.key, position, shownOrder\.length\)/);
  });

  it('moves focus to each new heading (question and follow-up note)', () => {
    expect(quiz.match(/<h2 ref=\{focusOnMount\} tabIndex=\{-1\}/g)).toHaveLength(2);
  });

  it('announces a save with text that changes, and hides the static text', () => {
    expect(quiz).toMatch(/aria-live="polite"[^>]*>\s*\{saveIndicatorVisible \? "Answer saved" : ""\}/);
    expect(quiz).not.toMatch(/aria-live="polite"\s+className=\{cn\(/);
  });
});

describe('ProfilePage photo input', () => {
  it('stays in the tab order and shows focus on its label', () => {
    const profile = read('pages', 'ProfilePage.tsx');
    const input = profile.match(/<input\s+type="file"[^>]*\/>/);
    expect(input, 'the photo <input type="file"> was not found').not.toBeNull();
    expect(input![0]).toMatch(/className="sr-only"/);
    expect(input![0]).toMatch(/aria-label="Change photo"/);
    expect(profile).toMatch(/focus-within:ring-2[^"]*"\s*>\s*<Camera/);
  });
});

describe('admin labels', () => {
  it.each([['AdminPage.tsx'], ['admin/LeaveWatchPage.tsx']])('%s has no <Label> tied to nothing', (file) => {
    const src = read('pages', ...file.split('/'));
    expect(src).toMatch(/<Label htmlFor=/);
    expect(src).not.toMatch(/<Label>/);
  });

  it('each labelled Select trigger carries the id its label points at', () => {
    const admin = read('pages', 'AdminPage.tsx');
    const leave = read('pages', 'admin', 'LeaveWatchPage.tsx');
    for (const [src, id] of [
      [admin, '"pledge-party"'],
      [admin, '"pledge-category"'],
      [admin, '{`status-${pledge.id}`}'],
      [leave, '{`reason-${alert.id}`}'],
    ] as const) {
      expect(src).toContain(`<Label htmlFor=${id}>`);
      expect(src).toContain(`<SelectTrigger id=${id}>`);
    }
  });
});
