/**
 * Adapter for server/scoring/panel.ts, which dynamic-imports this name and is off-limits to
 * the ideology rebuild. It forwards one article stance to `recordTdEvidence`. When panel.ts
 * calls server/ideology directly, delete this file.
 */
import type { IdeologyDimension } from '@shared/ideology';
import { recordTdEvidence } from '../ideology';

interface AdjustmentMetadata {
  sourceType: 'article' | 'debate' | 'manual';
  sourceId?: number | null;
  policyTopic?: string | null;
  weight?: number;
  confidence?: number;
  sourceDate?: Date | string;
  sourceReliability?: number;
}

export const TDIdeologyProfileService = {
  /**
   * `adjustments` is the panel's ±0.5 per-dimension stance. Panel's `weight` already
   * includes confidence and source reliability (it passes them again for logging), so
   * they are not multiplied in a second time, as the old engine did.
   */
  async applyAdjustments(politicianName: string, adjustments: Partial<Record<IdeologyDimension, number>>, metadata: AdjustmentMetadata): Promise<void> {
    if (metadata.sourceType !== 'article' || metadata.sourceId == null) return;
    const observedAt = metadata.sourceDate ? new Date(metadata.sourceDate) : new Date();
    await recordTdEvidence({
      td: politicianName,
      source: 'article',
      sourceRef: String(metadata.sourceId),
      raw: adjustments,
      weight: metadata.weight ?? (metadata.confidence ?? 1) * (metadata.sourceReliability ?? 1),
      observedAt: Number.isNaN(observedAt.getTime()) ? new Date() : observedAt,
      policyTopic: metadata.policyTopic,
    });
  },
};
