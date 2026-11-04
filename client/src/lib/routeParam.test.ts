/**
 * TD and constituency pages encoded a name from the URL again without first undoing the escapes
 * wouter leaves in place, so "%26" went to the API as "%2526". All three profile pages now share
 * decodeParam.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeParam } from './routeParam';

describe('decodeParam', () => {
  it('finishes the escapes wouter leaves (& / , # :)', () => {
    expect(decodeParam('Dublin%2C%20Fingal')).toBe('Dublin, Fingal');
    expect(decodeParam('Labour%20%26%20Co')).toBe('Labour & Co');
    expect(decodeParam('A%2FB')).toBe('A/B');
  });

  it('round-trips with encodeURIComponent, so the API gets one level of encoding', () => {
    const name = 'Ó Ríordáin & Sons / Ltd';
    expect(encodeURIComponent(decodeParam(encodeURIComponent(name))!)).toBe(encodeURIComponent(name));
  });

  it('keeps a value with a bare "%" and passes undefined through', () => {
    expect(decodeParam('100% RDR')).toBe('100% RDR');
    expect(decodeParam(undefined)).toBeUndefined();
  });

  it.each(['TDProfilePage', 'PartyProfilePage', 'ConstituencyProfilePage'])('%s decodes its name', (page) => {
    const text = fs.readFileSync(path.resolve(__dirname, '../pages', `${page}.tsx`), 'utf8');
    expect(text).toMatch(/const name = decodeParam\(useParams/);
  });
});
