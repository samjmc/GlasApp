/**
 * Reading and writing the generated sheet files under server/partyQuiz/sheets. Used by the
 * party-quiz job only; the server reads the compiled-in SHEETS.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Election, PartyQuizSheet } from '@shared/partyQuiz';
import { renderIndexSource, renderSheetSource, sheetFile } from './sheet';

export const SHEETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sheets');

/** The inverse of renderSheetSource. A hand edit must keep the JSON form ("edit fields only"). */
export function parseSheetSource(src: string): PartyQuizSheet {
  const match = /export const sheet: PartyQuizSheet = ([\s\S]*);\s*$/.exec(src.replace(/\r\n/g, '\n'));
  if (!match) throw new Error('Not a generated sheet file: expected `export const sheet: PartyQuizSheet = {...};`');
  return JSON.parse(match[1]!) as PartyQuizSheet;
}

/** Sheet files as `sheetFile` names them: `<election>/<name>`, no extension. */
function sheetFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => fs.readdirSync(path.join(dir, e.name)).filter((f) => f.endsWith('.ts')).map((f) => `${e.name}/${f.slice(0, -3)}`));
}

export function readSheet(party: string, election: Election, dir: string = SHEETS_DIR): PartyQuizSheet | null {
  const file = path.join(dir, `${sheetFile({ party, election })}.ts`);
  return fs.existsSync(file) ? parseSheetSource(fs.readFileSync(file, 'utf8')) : null;
}

export function readAllSheets(dir: string = SHEETS_DIR): PartyQuizSheet[] {
  return sheetFiles(dir).map((f) => parseSheetSource(fs.readFileSync(path.join(dir, `${f}.ts`), 'utf8')));
}

/** Writes the sheet and regenerates index.ts from the directory listing. Returns the sheet's path. */
export function writeSheet(sheet: PartyQuizSheet, dir: string = SHEETS_DIR): string {
  const file = path.join(dir, `${sheetFile(sheet)}.ts`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderSheetSource(sheet));
  fs.writeFileSync(path.join(dir, 'index.ts'), renderIndexSource(sheetFiles(dir)));
  return file;
}
