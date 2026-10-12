const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Makes text safe to put inside an HTML string (text or a quoted attribute). Leaflet tooltips are HTML strings. */
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ENTITIES[char]!);
}
