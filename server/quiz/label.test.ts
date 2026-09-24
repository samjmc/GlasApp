import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import { ideologyLabel } from './label';

const at = (v: Partial<IdeologyVector>): IdeologyVector => ({ ...emptyIdeologyVector(), ...v });

describe('ideologyLabel', () => {
  it('names the classic quadrants', () => {
    expect(ideologyLabel(at({ economic: -8, authority: 8 })).name).toBe('Authoritarian Left');
    expect(ideologyLabel(at({ economic: 8, authority: 8 })).name).toBe('Authoritarian Right');
    expect(ideologyLabel(at({ economic: -5, authority: -5 })).name).toBe('Libertarian Left');
    expect(ideologyLabel(at({ economic: 5, authority: -5 })).name).toBe('Libertarian Right');
    expect(ideologyLabel(at({})).name).toBe('Centrist');
  });

  // + is the right-coded pole: +globalism is nationalist, −welfare is communitarian, +technocratic is populist.
  it('reads the four once-inverted dimensions with the shared sign rule', () => {
    const base = { economic: 5, social: 5 };
    expect(ideologyLabel(at({ ...base, globalism: 8 })).name).toContain('Nationalist');
    expect(ideologyLabel(at({ ...base, globalism: -8 })).name).toContain('Internationalist');
    expect(ideologyLabel(at({ ...base, welfare: -8 })).name).toContain('Communitarian');
    expect(ideologyLabel(at({ ...base, welfare: 8 })).name).toContain('Individualist');
    expect(ideologyLabel(at({ ...base, technocratic: 5 })).name).toContain('Populist');
    expect(ideologyLabel(at({ ...base, technocratic: -5 })).name).toContain('Technocratic');
  });

  it('always returns a name and a description', () => {
    const { name, description } = ideologyLabel(at({ economic: 4, social: -4, cultural: -4 }));
    expect(name.length).toBeGreaterThan(0);
    expect(description).toMatch(/^Your politics/);
  });
});
