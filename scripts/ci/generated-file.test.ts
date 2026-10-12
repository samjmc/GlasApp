import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ensureGeneratedFile } from './generated-file';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'generated-file-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const COMMAND = 'npm run facts';
const run = (name: string, source: string, check: boolean) =>
  ensureGeneratedFile({ path: path.join(dir, name), source, check, generateCommand: COMMAND });

describe('ensureGeneratedFile', () => {
  it('check mode throws when the file is missing, and names the file and the command', async () => {
    await expect(run('missing.md', 'a\n', true)).rejects.toThrow(/missing\.md is missing or stale\. Run `npm run facts`/);
    expect(fs.existsSync(path.join(dir, 'missing.md'))).toBe(false);
  });

  it('check mode throws when the content differs, and leaves the file alone', async () => {
    fs.writeFileSync(path.join(dir, 'stale.md'), 'old\n');
    await expect(run('stale.md', 'new\n', true)).rejects.toThrow(/stale\.md is missing or stale/);
    expect(fs.readFileSync(path.join(dir, 'stale.md'), 'utf8')).toBe('old\n');
  });

  it('check mode passes when only the line endings differ', async () => {
    fs.writeFileSync(path.join(dir, 'crlf.md'), 'one\r\ntwo\r\n');
    await expect(run('crlf.md', 'one\ntwo\n', true)).resolves.toEqual({ changed: false });
    fs.writeFileSync(path.join(dir, 'lf.md'), 'one\ntwo\n');
    await expect(run('lf.md', 'one\r\ntwo\r\n', true)).resolves.toEqual({ changed: false });
  });

  it('write mode creates the file and its folder', async () => {
    const result = await run('nested/deeper/new.md', 'hello\n', false);
    expect(result).toEqual({ changed: true });
    expect(fs.readFileSync(path.join(dir, 'nested/deeper/new.md'), 'utf8')).toBe('hello\n');
  });

  it('write mode does not touch a file that is already current', async () => {
    fs.writeFileSync(path.join(dir, 'same.md'), 'same\r\n');
    const before = fs.statSync(path.join(dir, 'same.md')).mtimeMs;
    await expect(run('same.md', 'same\n', false)).resolves.toEqual({ changed: false });
    expect(fs.statSync(path.join(dir, 'same.md')).mtimeMs).toBe(before);
  });

  it('write mode keeps the line endings the file already has', async () => {
    fs.writeFileSync(path.join(dir, 'keep-crlf.md'), 'old\r\nlines\r\n');
    await run('keep-crlf.md', 'new\nlines\n', false);
    expect(fs.readFileSync(path.join(dir, 'keep-crlf.md'), 'utf8')).toBe('new\r\nlines\r\n');
    fs.writeFileSync(path.join(dir, 'keep-lf.md'), 'old\n');
    await run('keep-lf.md', 'new\nlines\n', false);
    expect(fs.readFileSync(path.join(dir, 'keep-lf.md'), 'utf8')).toBe('new\nlines\n');
  });

  it('check mode after a write passes (the round trip)', async () => {
    await run('round.md', 'x\ny\n', false);
    await expect(run('round.md', 'x\ny\n', true)).resolves.toEqual({ changed: false });
  });
});
