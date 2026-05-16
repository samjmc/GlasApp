import assert from 'node:assert/strict';

import { hasMeaningfulELOChanges } from './eloChangeUtils.js';

assert.equal(
  hasMeaningfulELOChanges({
    overall: { change: 0 },
    transparency: { change: 12 },
  }),
  true,
  'dimension-only ELO updates must be treated as meaningful'
);

assert.equal(
  hasMeaningfulELOChanges({
    overall: { change: 0 },
    transparency: { change: 0 },
    integrity: { change: 0 },
  }),
  false,
  'all-zero ELO updates should still be skipped'
);

console.log('multiAgentTDScoring regression checks passed');
