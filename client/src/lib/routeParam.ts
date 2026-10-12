/**
 * A name from the URL path, fully decoded. wouter runs decodeURI on the path, which leaves reserved
 * escapes (%26, %2F, %2C, %23, %3A) encoded; encoding that again for an API call sends %2526.
 * Keeps the raw value when it holds a bare "%" (e.g. "100% RDR").
 */
export function decodeParam(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
