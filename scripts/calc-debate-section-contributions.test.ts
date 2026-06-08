import assert from 'node:assert/strict';
import test from 'node:test';
import { loadOutcomeRows } from './calc-debate-section-contributions.ts';

type FakeOutcomeRow = {
  section_id: string;
  created_at: string;
};

function createMockSupabase(rows: FakeOutcomeRow[]) {
  const orderCalls: Array<{ column: string; ascending: boolean | undefined }> = [];
  const rangeCalls: Array<{ from: number; to: number }> = [];

  const client = {
    from(table: string) {
      assert.equal(table, 'debate_section_outcomes');

      return {
        select() {
          return {
            order(column: string, options: { ascending?: boolean }) {
              orderCalls.push({ column, ascending: options.ascending });

              return {
                async range(from: number, to: number) {
                  rangeCalls.push({ from, to });
                  const sortedRows = [...rows].sort((a, b) => (
                    options.ascending
                      ? a.created_at.localeCompare(b.created_at)
                      : b.created_at.localeCompare(a.created_at)
                  ));

                  return {
                    data: sortedRows.slice(from, to + 1),
                    error: null
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  return { client, orderCalls, rangeCalls };
}

test('loadOutcomeRows paginates debate outcomes oldest-first', async () => {
  const { client, orderCalls, rangeCalls } = createMockSupabase([
    { section_id: 'newest', created_at: '2025-12-03T00:00:00.000Z' },
    { section_id: 'oldest', created_at: '2025-12-01T00:00:00.000Z' },
    { section_id: 'middle', created_at: '2025-12-02T00:00:00.000Z' }
  ]);

  const rows = await loadOutcomeRows(client as any, 2);

  assert.deepEqual(
    rows.map((row) => row.section_id),
    ['oldest', 'middle', 'newest']
  );
  assert.deepEqual(orderCalls, [
    { column: 'created_at', ascending: true },
    { column: 'created_at', ascending: true }
  ]);
  assert.deepEqual(rangeCalls, [
    { from: 0, to: 1 },
    { from: 2, to: 3 }
  ]);
});
