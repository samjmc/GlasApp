/**
 * List long runs of sitting days on which a TD neither voted nor spoke, and which no
 * documented absence covers. For a person to look into: if the TD or their party announced
 * leave publicly, add it with its source to server/parliament/absences.ts. Nothing here is
 * scored; a silence with no public reason stays a silence.
 *
 *   npm run parliament:silences               runs of 8+ sitting days
 *   npm run parliament:silences -- --min 12
 */
import { shutdown } from '../db';
import { repository } from '../parliament';

function argMin(argv: string[]): number {
  const i = argv.indexOf('--min');
  if (i === -1) return 8;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) throw new Error('--min needs a whole number of sitting days');
  return n;
}

repository
  .undocumentedSilences(argMin(process.argv.slice(2)))
  .then(async (runs) => {
    if (runs.length === 0) console.log('No undocumented silences.');
    for (const r of runs) console.log(`${String(r.sittingDays).padStart(3)} sitting days  ${r.from} .. ${r.to}  ${r.name} (${r.memberCode})`);
    await shutdown();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await shutdown();
    process.exit(1);
  });
