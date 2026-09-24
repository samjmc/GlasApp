/**
 * Format a date-only "YYYY-MM-DD" string. `new Date("2025-06-25")` is UTC midnight, which
 * shows as 24 June anywhere west of UTC; this builds the date in local time instead.
 */
export function formatIsoDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  return new Intl.DateTimeFormat("en-IE", options).format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}
