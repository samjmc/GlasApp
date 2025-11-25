/**
 * This file contains the accurate party dimension data from the database
 * These values match what's stored in the database (verified via SQL query)
 */

export interface PartyDimensions {
  party: string;
  economic: number;
  social: number;
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
}

export const partyDimensionsData: Record<string, PartyDimensions> = {
  'ie-sf': {
    party: 'Sinn Féin',
    economic: -6,
    social: -6,
    cultural: -3,
    globalism: -3,
    environmental: 4,
    authority: 1,
    welfare: 7,
    technocratic: -5
  },
  'ie-fg': {
    party: 'Fine Gael',
    economic: 2,
    social: 2,
    cultural: 3,
    globalism: 6,
    environmental: 1,
    authority: 4,
    welfare: 2,
    technocratic: 5
  },
  'ie-ff': {
    party: 'Fianna Fáil',
    economic: 1,
    social: 1,
    cultural: 2,
    globalism: 4,
    environmental: 2,
    authority: 2,
    welfare: 3,
    technocratic: 3
  },
  'ie-labour': {
    party: 'Labour Party',
    economic: -4,
    social: -6,
    cultural: -5,
    globalism: 8,
    environmental: 6,
    authority: -3,
    welfare: 8,
    technocratic: 2
  },
  'ie-green': {
    party: 'Green Party',
    economic: -2,
    social: -5,
    cultural: -6,
    globalism: 7,
    environmental: 10,
    authority: -2,
    welfare: 6,
    technocratic: 7
  },
  'ie-sd': {
    party: 'Social Democrats',
    economic: -5,
    social: -8,
    cultural: -7,
    globalism: 9,
    environmental: 7,
    authority: -4,
    welfare: 9,
    technocratic: 6
  },
  'ie-pbp': {
    party: 'People Before Profit',
    economic: -9,
    social: -10,
    cultural: -10,
    globalism: -1,
    environmental: 5,
    authority: -8,
    welfare: 10,
    technocratic: -9
  },
  'ie-aontu': {
    party: 'Aontú',
    economic: -2,
    social: 7,
    cultural: 8,
    globalism: -7,
    environmental: -3,
    authority: 6,
    welfare: 5,
    technocratic: -4
  }
};