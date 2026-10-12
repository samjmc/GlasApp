/**
 * Clicking a constituency calls geoJsonLayer.resetStyle(), which re-runs the `style` option the
 * Leaflet layer was built with. That option was a closure over the first render's colouring
 * (empty data, first layer), so one click repainted every other seat with stale colours. The
 * style must read the current colouring through a ref. The client has no component test setup
 * (no DOM), so the wiring is read as text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, 'OfficialElectoralMap.tsx'), 'utf8');

describe('OfficialElectoralMap colouring', () => {
  it('resets to the current colours, not the first render', () => {
    expect(source).toContain('geoJsonLayer.resetStyle()');
    expect(source).toContain('colorRef.current = getConstituencyColor;');
    expect(source).toContain('fillColor: colorRef.current(constituencyName)');
    expect(source).not.toContain('fillColor: getConstituencyColor(');
  });
});
