/**
 * Smoke check, not a test: reads the newest Dáil interests register and the newest Dáil PSA
 * payments from the live Oireachtas listings, parses both, and prints counts.
 *
 *   npx tsx scripts/parliament-sources-smoke.ts
 */
import { interestsYearFromUrl, isDailInterestsRegister, parseInterestsRegister } from '../server/parliament/sources/interests';
import { browserFetch, publicationLinks } from '../server/parliament/sources/listing';
import { pdfLines } from '../server/parliament/sources/pdf';
import { isDailPsa, parsePsaPayments, psaMonthFromUrl } from '../server/parliament/sources/psa';

async function readPdf(url: string): Promise<string[][]> {
  const res = await browserFetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return pdfLines(new Uint8Array(await res.arrayBuffer()));
}

/** Surname only, for a rough cross-check: no accents, spaces or punctuation. */
const key = (surname: string) => surname.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

async function main() {
  const registers = (await publicationLinks('register-of-members-interests')).filter(isDailInterestsRegister);
  const register = registers
    .filter((u) => interestsYearFromUrl(u) !== null)
    .sort((a, b) => interestsYearFromUrl(b)! - interestsYearFromUrl(a)!)[0];
  if (!register) throw new Error('No Dáil register with a year on the first listing page');
  const entries = parseInterestsRegister(await readPdf(register));
  console.log(`Register ${interestsYearFromUrl(register)}: ${register}`);
  console.log(`  members: ${entries.length}`);
  console.log(`  members with at least one declared category: ${entries.filter((e) => e.categories.some((c) => c.text !== null)).length}`);

  const psaFiles = (await publicationLinks('parliamentary-allowances')).filter(isDailPsa);
  const month = psaFiles.map((u) => psaMonthFromUrl(u)!).sort().pop();
  if (!month) throw new Error('No Dáil PSA file on the first listing page');
  // One month can be split over two files (around the 2024 election); read them all.
  const payments = [];
  for (const url of psaFiles.filter((u) => psaMonthFromUrl(u) === month)) {
    console.log(`PSA ${month}: ${url}`);
    payments.push(...parsePsaPayments(await readPdf(url)));
  }
  const members = new Set(payments.map((p) => `${p.surname}, ${p.forenames}`));
  const cents = payments.reduce((sum, p) => sum + p.amountCents, 0);
  console.log(`  rows: ${payments.length}`);
  console.log(`  distinct members: ${members.size}`);
  console.log(`  total: €${(cents / 100).toLocaleString('en-IE', { minimumFractionDigits: 2 })}`);

  const inRegister = new Set(entries.map((e) => key(e.surname)));
  const inPsa = new Set(payments.map((p) => key(p.surname)));
  const psaOnly = Array.from(members).filter((m) => !inRegister.has(key(m.split(',')[0])));
  const registerOnly = entries.filter((e) => !inPsa.has(key(e.surname))).map((e) => `${e.surname}, ${e.forenames}`);
  console.log(`Cross-check by surname: in PSA not register: ${psaOnly.join('; ') || 'none'}; in register not PSA: ${registerOnly.join('; ') || 'none'}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
