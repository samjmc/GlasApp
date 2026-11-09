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

/** The text of the handler passed to `layer.on('<event>', ...)`, up to the next `layer.on(`. */
function handlerBlock(event: string): string {
  const start = source.indexOf(`layer.on('${event}'`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf('layer.on(', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe('OfficialElectoralMap hover and click', () => {
  // bringToFront re-appends the path, so a tap (mouseover then mousedown back to back) lost its first click.
  it('does not move the path on hover, but still brings the clicked seat to the front', () => {
    expect(handlerBlock('mouseover')).toContain('setStyle(');
    expect(handlerBlock('mouseover')).not.toContain('bringToFront');
    expect(handlerBlock('click')).toContain('bringToFront()');
  });
});
