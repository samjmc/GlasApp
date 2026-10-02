/**
 * The daily session's walk-through decisions, kept apart from the page so they can be tested.
 *
 * A question can be answered somewhere else before the session reaches it (its article card),
 * so "answered" questions are not always the first N. Every decision here looks at which
 * items are answered, never at how many.
 */

/** The first unanswered item at or after `from`, wrapping to the start. -1 when none is left. */
export function firstUnansweredIndex(items: ReadonlyArray<{ hasVoted: boolean }>, from = 0): number {
  for (let step = 0; step < items.length; step++) {
    const index = (from + step) % items.length;
    if (!items[index]!.hasVoted) return index;
  }
  return -1;
}

/** Where to go once the answer to `currentIndex` is saved. `items` is the saved session. */
export function afterVote(items: ReadonlyArray<{ hasVoted: boolean }>, currentIndex: number) {
  const nextIndex = firstUnansweredIndex(items, currentIndex + 1);
  return { isFinal: nextIndex === -1, nextIndex };
}

/** What a question's target axis (or older policy area) is called on screen. */
const DIMENSION_LABELS: Record<string, string> = {
  economic: 'Economy',
  social: 'Social issues',
  cultural: 'Culture and identity',
  authority: 'Rights and order',
  environmental: 'Climate',
  welfare: 'Welfare',
  globalism: 'Ireland and the world',
  technocratic: 'Experts and the public',
  housing: 'Housing',
  immigration: 'Immigration',
  healthcare: 'Healthcare',
  economy: 'Economy',
  social_issues: 'Social Policy',
  justice: 'Justice & Security',
  education: 'Education',
};

export function dimensionLabel(dimension?: string | null): string {
  if (!dimension) return 'Policy';
  return DIMENSION_LABELS[dimension] ?? dimension.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
