/**
 * Keyboard rules for a custom radio group (WAI-ARIA radio group pattern): the group is one tab
 * stop, and the arrow keys move between its radios and select them.
 */

const STEP: Record<string, 1 | -1> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/** The position an arrow key moves to from `position` among `count` radios, wrapping; null for any other key. */
export function arrowKeyTarget(key: string, position: number, count: number): number | null {
  if (count === 0 || !Object.prototype.hasOwnProperty.call(STEP, key)) return null;
  return (position + STEP[key] + count) % count;
}

/** The one radio Tab reaches: the selected one, else the first. */
export function isTabStop(position: number, selectedPosition: number): boolean {
  return selectedPosition < 0 ? position === 0 : position === selectedPosition;
}
