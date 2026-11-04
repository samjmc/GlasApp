import { describe, expect, it, vi } from 'vitest';

vi.mock('../../news/ingest.js', () => ({ ingest: vi.fn() }));
vi.mock('../../news/repository.js', () => ({ statusCounts: vi.fn() }));
vi.mock('../../news/tdPipeline.js', () => ({ runTdPipeline: vi.fn() }));
const { pipelineBody } = await import('./tdScoringRoutes');

describe('POST /api/admin/td-scoring/run body', () => {
  it('defaults to 50 articles and the top 25%, and ignores the old minImportance', () => {
    expect(pipelineBody.parse({})).toEqual({ batchSize: 50, topPercentile: 25 });
    expect(pipelineBody.parse({ batchSize: '20', topPercentile: 10, minImportance: 40 })).toEqual({ batchSize: 20, topPercentile: 10 });
  });

  it('refuses a run that would claim every pending article or process all of them', () => {
    for (const body of [{ batchSize: 5000 }, { topPercentile: 100 }, { batchSize: 0 }, { batchSize: 2.5 }, { batchSize: 'all' }]) {
      expect(pipelineBody.safeParse(body).success).toBe(false);
    }
  });
});
