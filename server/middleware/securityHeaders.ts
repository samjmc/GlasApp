/**
 * Security headers (helmet). The Content-Security-Policy is REPORT-ONLY for now: the browser
 * logs what it would block and blocks nothing. Read the console on a real page load, fix or
 * allow what shows up, then set `reportOnly` to false.
 *
 * Known to report today: the inline theme script in client/index.html (give it a hash or move it
 * to a file before enforcing) and the fallback constituency GeoJSON hosts in
 * client/src/helpers/fetchConstituencyGeoJSON.ts.
 */
import helmet from 'helmet';
import type { RequestHandler } from 'express';

/** The origin of SUPABASE_URL, plus its websocket twin for realtime; empty when it is unset or not a URL. */
function supabaseOrigins(env: NodeJS.ProcessEnv): string[] {
  try {
    const url = new URL(env.SUPABASE_URL ?? '');
    return [url.origin, `${url.protocol === 'http:' ? 'ws:' : 'wss:'}//${url.host}`];
  } catch {
    return [];
  }
}

export function contentSecurityPolicyDirectives(env: NodeJS.ProcessEnv = process.env) {
  return {
    defaultSrc: ["'self'"],
    connectSrc: ["'self'", ...supabaseOrigins(env)],
    imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
    // Inline styles: React style props and the component libraries use them. The stylesheet at
    // fonts.googleapis.com is linked from client/index.html.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    scriptSrc: ["'self'"],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    frameAncestors: ["'none'"],
  };
}

export function securityHeaders(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  return helmet({
    contentSecurityPolicy: { useDefaults: false, reportOnly: true, directives: contentSecurityPolicyDirectives(env) },
    crossOriginEmbedderPolicy: false,
  });
}
