/**
 * Deprecated alias, kept for one release after the facts-only score:
 *   npm run td-scoring                     = npm run news:tds
 *   npm run td-scoring -- --recalculate    = npm run scores:recalculate
 */
void import(process.argv.includes('--recalculate') ? './scores-recalculate' : './news-tds');
