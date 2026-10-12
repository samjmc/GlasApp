/**
 * The constituency map builds its Leaflet tooltips as HTML strings (Leaflet sets them as innerHTML)
 * from names and party strings that come from the API and from a GeoJSON file. They must be escaped.
 * The component is not rendered in tests (no component test setup), so its source is read as text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escapeHtml';

describe('escapeHtml', () => {
  it('neutralises a script and an event-handler payload', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml('</div><script>alert(1)</script>')).toBe('&lt;/div&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes every one of the five characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('escapes the ampersand first, so an existing entity is shown as typed, not decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves ordinary names, fadas and numbers alone', () => {
    expect(escapeHtml('Dublin Bay South')).toBe('Dublin Bay South');
    expect(escapeHtml('Sinn Féin')).toBe('Sinn Féin');
    expect(escapeHtml('Cork North-Central')).toBe('Cork North-Central');
    expect(escapeHtml(5)).toBe('5');
  });
});

describe('OfficialElectoralMap tooltip', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'components', 'OfficialElectoralMap.tsx'), 'utf8');

  it('escapes every value it puts into the tooltip HTML', () => {
    for (const value of ['constituencyName', 'nameIrish', 'topParty.party', 'seats', 'actualSeats']) {
      expect(source, `${value} is escaped`).toContain(`\${escapeHtml(${value})}`);
      expect(source, `${value} is never interpolated raw`).not.toContain(`\${${value}}`);
    }
  });
});
