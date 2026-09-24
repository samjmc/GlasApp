/**
 * Where each party's TDs start before any evidence: the prior in model.ts.
 *
 * From the only full eight-axis set the old code had (scripts/update_party_dimensions.ts,
 * −2..+2, ×5 onto −10..+10). Seven columns already followed the shared sign rule. Its
 * technocratic column did not: half the rows scored "technocratic" positive, half scored
 * "populist" positive. Each row was re-read from its own rationale text: FF and FG are
 * expert-led (negative), Greens and PBP populist (positive), SF and Labour "balanced" (0).
 */
import type { IdeologyVector } from '@shared/ideology';

const SCALE = 5;

const RAW: Array<[name: string, v: IdeologyVector]> = [
  ['Fianna Fáil', { economic: -0.4, social: 0.3, cultural: 0.6, authority: 0.8, environmental: -0.2, welfare: -0.6, globalism: -0.3, technocratic: -0.9 }],
  ['Fine Gael', { economic: 0.3, social: 0.2, cultural: 0.5, authority: 0.6, environmental: 0.1, welfare: 0.1, globalism: -0.1, technocratic: -0.8 }],
  ['Sinn Féin', { economic: -1.2, social: -0.4, cultural: 0.2, authority: 1.0, environmental: -0.6, welfare: -1.4, globalism: 0.6, technocratic: 0 }],
  ['Aontú', { economic: -0.3, social: 1.2, cultural: 1.4, authority: 1.5, environmental: -0.2, welfare: -0.5, globalism: 1.3, technocratic: 1.0 }],
  ['Green Party', { economic: -1.0, social: -1.2, cultural: -1.0, authority: -0.5, environmental: -1.8, welfare: -1.3, globalism: -1.0, technocratic: 0.6 }],
  ['People Before Profit–Solidarity', { economic: -1.5, social: -1.5, cultural: -1.4, authority: -1.3, environmental: -1.5, welfare: -1.6, globalism: -1.2, technocratic: 0.7 }],
  ['Labour Party', { economic: -1.0, social: -0.8, cultural: -0.5, authority: -0.4, environmental: -1.0, welfare: -1.2, globalism: -0.8, technocratic: 0 }],
  ['Independent Ireland', { economic: 0.1, social: 0.6, cultural: 1.2, authority: 1.0, environmental: 0.1, welfare: 0.1, globalism: 0.5, technocratic: 0.7 }],
  ['Social Democrats', { economic: -1.1, social: -1.0, cultural: -0.8, authority: -0.6, environmental: -1.2, welfare: -1.4, globalism: -0.9, technocratic: -0.4 }],
  ['The Irish People', { economic: 0.2, social: 1.4, cultural: 1.6, authority: 1.3, environmental: 0.3, welfare: 0.2, globalism: 1.8, technocratic: 1.1 }],
  ['Irish Freedom Party', { economic: 0.5, social: 1.4, cultural: 1.8, authority: 1.2, environmental: 0.5, welfare: 0.2, globalism: 2.0, technocratic: 1.3 }],
  ['National Party', { economic: 0.7, social: 1.6, cultural: 2.0, authority: 1.8, environmental: 0.6, welfare: 0.3, globalism: 2.0, technocratic: 1.5 }],
];

/** "People Before Profit - Solidarity", "the Labour Party" and "Labour" all match. */
export function partyKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(the|party)\b/g, '')
    .replace(/[^a-z]/g, '');
}

const BASELINES = new Map<string, IdeologyVector>(
  RAW.map(([name, v]) => [
    partyKey(name),
    Object.fromEntries(Object.entries(v).map(([d, x]) => [d, x * SCALE])) as IdeologyVector,
  ]),
);

/** True for no party and for independents; "Independent Ireland" is a registered party. */
export function isIndependent(party: string | null | undefined): boolean {
  if (!party) return true;
  const key = partyKey(party);
  return key.startsWith('independent') && key !== 'independentireland';
}

/** The party's starting position, or null for independents and parties with no baseline. */
export function partyBaseline(party: string | null | undefined): IdeologyVector | null {
  if (isIndependent(party)) return null;
  return BASELINES.get(partyKey(party!)) ?? null;
}
