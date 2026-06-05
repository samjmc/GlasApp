import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

const { orderOutcomeRowsForProcessing } = await import('./calc-debate-section-contributions.ts');

test('orders paginated debate outcomes oldest-first before applying running score updates', () => {
  const newestFirstRows = [
    {
      section_id: 'section-c',
      debate_day_id: 'day-c',
      created_at: '2026-01-03T09:00:00.000Z',
      debate_days: { date: '2026-01-03' }
    },
    {
      section_id: 'section-a',
      debate_day_id: 'day-a',
      created_at: '2026-01-01T09:00:00.000Z',
      debate_days: { date: '2026-01-01' }
    },
    {
      section_id: 'section-b',
      debate_day_id: 'day-b',
      created_at: '2026-01-02T09:00:00.000Z',
      debate_days: { date: '2026-01-02' }
    }
  ];

  const ordered = orderOutcomeRowsForProcessing(newestFirstRows);

  assert.deepEqual(
    ordered.map((row) => row.section_id),
    ['section-a', 'section-b', 'section-c']
  );
  assert.deepEqual(
    newestFirstRows.map((row) => row.section_id),
    ['section-c', 'section-a', 'section-b'],
    'helper should not mutate the fetched page order in place'
  );
});

test('uses stable chronological tie breakers for outcomes with identical created_at values', () => {
  const rows = [
    {
      section_id: 'section-b',
      debate_day_id: 'day-b',
      created_at: '2026-01-01T09:00:00.000Z',
      debate_days: { date: '2026-01-02' }
    },
    {
      section_id: 'section-a',
      debate_day_id: 'day-a',
      created_at: '2026-01-01T09:00:00.000Z',
      debate_days: { date: '2026-01-01' }
    }
  ];

  const ordered = orderOutcomeRowsForProcessing(rows);

  assert.deepEqual(
    ordered.map((row) => row.section_id),
    ['section-a', 'section-b']
  );
});
