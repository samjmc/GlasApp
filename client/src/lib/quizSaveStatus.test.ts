/**
 * The results page said "Saving this result to your profile…" for ever when the save never
 * happened (the user said no to consent, or the save failed): "saving" was worked out as
 * "signed in and no id". It must come from how the save attempt ended. The client has no
 * component test setup, so the decision is tested as a pure function and the wiring is read as
 * text; test/e2e/quiz-save-retry.spec.ts covers the page in a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { quizSaveStatus } from './quizSaveStatus';

const pageSource = fs.readFileSync(path.resolve(__dirname, '..', 'pages', 'QuizResultsPage.tsx'), 'utf8');

describe('quizSaveStatus', () => {
  it('a result with an id is saved, whatever the attempt says', () => {
    expect(quizSaveStatus(true, 7, 'failed')).toBe('saved');
    expect(quizSaveStatus(false, 7, 'idle')).toBe('saved');
  });

  it('a signed-out user is asked to sign in', () => {
    expect(quizSaveStatus(false, null, 'idle')).toBe('signedOut');
  });

  it('a signed-in user is saving only until the attempt ends', () => {
    expect(quizSaveStatus(true, null, 'idle')).toBe('saving');
    expect(quizSaveStatus(true, null, 'saving')).toBe('saving');
  });

  it('a decline or a failure is shown as such, not as saving', () => {
    expect(quizSaveStatus(true, null, 'declined')).toBe('declined');
    expect(quizSaveStatus(true, null, 'failed')).toBe('failed');
  });
});

describe('QuizResultsPage wiring', () => {
  it('derives the status from the save attempt, not from the missing id', () => {
    expect(pageSource).toMatch(/quizSaveStatus\(isAuthenticated, result\.id, saveAttempt\)/);
    expect(pageSource).not.toMatch(/isAuthenticated && result\.id === null/);
  });

  it('records a decline and a failure', () => {
    expect(pageSource).toMatch(/setSaveAttempt\("declined"\)/);
    expect(pageSource).toMatch(/setSaveAttempt\("failed"\)/);
  });

  it('offers "Save to my profile", which asks for consent again', () => {
    expect(pageSource).toMatch(/onClick=\{\(\) => saveResult\(false\)\}[\s\S]*?Save to my profile/);
    expect(pageSource).toMatch(/ensureConsent\(\{ respectDecline \}\)/);
  });
});
