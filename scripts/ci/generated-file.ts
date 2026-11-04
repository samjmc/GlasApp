/**
 * One generated text artifact: compare it with what is on disk, or write it.
 *
 * Comparison ignores line endings (core.autocrlf=true makes a Windows working tree CRLF
 * while the generator emits LF). A write keeps the line endings the file already has.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export interface EnsureGeneratedFileOptions {
  /** Absolute path of the generated file. */
  path: string;
  /** The full text the file should hold. */
  source: string;
  /** Compare only: throw instead of writing when the file is missing or stale. */
  check: boolean;
  /** Shown in the error, so the reader knows how to regenerate. */
  generateCommand: string;
}

const toLf = (text: string): string => text.replace(/\r\n/g, '\n');
const keepLineEndings = (source: string, existing: string | undefined): string =>
  existing?.includes('\r\n') ? toLf(source).replace(/\n/g, '\r\n') : source;

const isMissing = (cause: unknown): boolean => (cause as NodeJS.ErrnoException | null)?.code === 'ENOENT';

export async function ensureGeneratedFile({
  path: file,
  source,
  check,
  generateCommand,
}: EnsureGeneratedFileOptions): Promise<{ changed: boolean }> {
  let existing: string | undefined;
  try {
    existing = await fs.readFile(file, 'utf8');
  } catch (cause) {
    if (!isMissing(cause)) throw cause;
  }
  if (existing !== undefined && toLf(existing) === toLf(source)) return { changed: false };
  if (check) {
    throw new Error(`${file} is missing or stale. Run \`${generateCommand}\` to regenerate it, then commit the result.`);
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, keepLineEndings(source, existing), 'utf8');
  return { changed: true };
}
