import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PartyQuizSheet } from '@shared/partyQuiz';
import { renderIndexSource, renderSheetSource } from './sheet';
import { SHEETS_DIR, parseSheetSource, readAllSheets, readSheet, writeSheet } from './sheetFiles';

const sheet = (party: string): PartyQuizSheet => ({
  party, election: 'ge2024', documents: ['x-ge2024'], model: 'deepseek-flash', promptVersion: 'v1',
  items: [{ questionId: 1, fingerprint: 'abcd1234', status: 'abstained', answerIndex: null, abstainReason: 'silent', quotes: [], rationale: 'Not addressed.', modelConfidence: 0.8, review: 'pending' }],
});

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'party-quiz-sheets-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('sheet files', () => {
  it('parse the source renderSheetSource writes, with either line ending', () => {
    const src = renderSheetSource(sheet('Green Party'));
    expect(parseSheetSource(src)).toEqual(sheet('Green Party'));
    expect(parseSheetSource(src.replace(/\n/g, '\r\n'))).toEqual(sheet('Green Party'));
    expect(() => parseSheetSource('export const sheet = {};')).toThrow(/generated/);
  });

  it('write a sheet by party key and regenerate the index from the directory', () => {
    expect(readSheet('Green Party', 'ge2024', dir)).toBeNull();
    writeSheet(sheet('Green Party'), dir);
    writeSheet(sheet('Labour Party'), dir);
    expect(fs.readFileSync(path.join(dir, 'ge2024', 'green.ts'), 'utf8')).toBe(renderSheetSource(sheet('Green Party')));
    expect(fs.readFileSync(path.join(dir, 'index.ts'), 'utf8')).toBe(renderIndexSource(['ge2024/green', 'ge2024/labour']));
    expect(readSheet('the Green Party', 'ge2024', dir)).toEqual(sheet('Green Party'));
    expect(readAllSheets(dir)).toEqual([sheet('Green Party'), sheet('Labour Party')]);
  });

  it('point at the committed sheets by default', () => {
    expect(fs.existsSync(path.join(SHEETS_DIR, 'index.ts'))).toBe(true);
  });
});
