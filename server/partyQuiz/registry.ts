/**
 * The documents parties take the quiz from: one entry per document.
 *
 * Nothing is downloaded by code. A person downloads each file in a browser, `ingest` prints its
 * sha256 and word count, and those go here with `licenceChecked` (the site has no text-and-data
 * mining opt-out, and the quote caps are accepted) in that party's sheet PR. Until then an entry
 * is a candidate: `sha256: null`, and its url and format are unconfirmed. `url: null` means the
 * document itself has not been found yet.
 */
import type { Election } from '@shared/partyQuiz';
import { partyKey } from '../ideology/partyBaselines';

export interface ManifestoDocument {
  slug: string;
  /** `tds.party` label, verbatim. */
  party: string;
  election: Election;
  title: string;
  url: string | null;
  mirrorUrl: string | null;
  format: 'pdf' | 'html';
  sha256: string | null;
  wordCount: number | null;
  /** YYYY-MM-DD */
  retrieved: string | null;
  licenceChecked: boolean;
}

const candidate = (
  slug: string,
  party: string,
  title: string,
  url: string | null,
  format: ManifestoDocument['format'],
  mirrorUrl: string | null = null,
): ManifestoDocument => ({
  slug, party, election: 'ge2024', title, url, mirrorUrl, format,
  sha256: null, wordCount: null, retrieved: null, licenceChecked: false,
});

/**
 * Documents downloaded and ingested on 2026-10-04: the sha256 and word count `ingest` printed.
 * Each site was checked for a text-and-data-mining opt-out (none found).
 */
const INGESTED: Record<string, { sha256: string; wordCount: number }> = {
  'ff-ge2024': { sha256: 'b6fdc65c8bc353374e0d45b63722df4793d618632fb1ed74ec0b415e65e0ec20', wordCount: 33240 },
  'fg-ge2024': { sha256: '8d348b553d5a3c1fbdfb4dc286c64e5c458ada2df8dbdd5c47d9c803bbb57d41', wordCount: 53124 },
  'sf-ge2024': { sha256: '6fde113d30ba945d2852e533a4df3bc3d3c40fca0777e0cf5e5ab3e3deadc4d3', wordCount: 49784 },
  'labour-ge2024': { sha256: '9278bdc40bd70012eb76a1044ab00f0cab2aa2ea27fcdf67882a1e9dd3d5ea40', wordCount: 63684 },
  // 31 of its 150 pages have almost no text (images), so its answers rest on the other 119.
  'socdems-ge2024': { sha256: 'be82c482b2531b95625bde60382b57ba7460b0aea2c0d5436bc785f36833309e', wordCount: 57945 },
  'greens-ge2024': { sha256: '9504e3a19b90e591dc2f7f5dc8cda5373f748af44711805e862441d4c2375cba', wordCount: 29317 },
  // One joint People Before Profit-Solidarity document, hosted by PBP; there is no separate Solidarity manifesto.
  'pbp-ge2024': { sha256: '927d09aab4d2234028a4d2f879f993854ea5675ba4c96e86faf9539ff509c4de', wordCount: 12325 },
  // Two parts of one manifesto, official files from the Wayback Machine; aontu.ie has no AI/TDM rules in its robots.txt or terms.
  'aontu-ge2024-p1': { sha256: '2140e71b6214bfb7d3b24a834e41c931a72600243a188772e7f5839184f91fba', wordCount: 12134 },
  'aontu-ge2024-p2': { sha256: '1c7e19b435396fffcb0e685e6354d8c6bd074eeb05636e01f6e5152f9bab7a68', wordCount: 16413 },
  // Its robots.txt names many AI crawlers but does not disallow this document; no tdm-reservation found.
  'ii-ge2024': { sha256: '0d471ffc20aa76e5821f903bfb29f4cec6af9b61e402d24287d0c291d44e6a04', wordCount: 7422 },
};

const CANDIDATES: ManifestoDocument[] = [
  candidate('ff-ge2024', 'Fianna Fáil', 'Moving Forward. Together.', 'https://www.fiannafail.ie/hubfs/FF%20Manifesto%202024_V4_Screen%5B45%5D.pdf', 'pdf'),
  candidate('fg-ge2024', 'Fine Gael', 'Securing Your Future', 'https://www.finegael.ie/app/uploads/2024/11/Fine-Gael-General-Election-2024-Manifesto.pdf', 'pdf'),
  candidate('sf-ge2024', 'Sinn Féin', 'The Choice for Change', 'https://vote.sinnfein.ie/wp-content/uploads/2024/11/SinnFeinManifesto2024.pdf', 'pdf'),
  candidate('labour-ge2024', 'Labour Party', 'Building Better Together', 'https://labour.ie/wp-content/uploads/2021/10/Labour-Manifesto-2024-Building-Better-Together.pdf', 'pdf', 'https://www.drugsandalcohol.ie/42270/1/Labour-Manifesto-2024-Building-Better-Together.pdf'),
  candidate('socdems-ge2024', 'Social Democrats', 'For the Future', 'https://www.socialdemocrats.ie/wp-content/uploads/2024/11/GE24Manifesto.pdf', 'pdf'),
  candidate('greens-ge2024', 'Green Party', 'Towards 2030: A Decade of Change, Volume II','https://www.greenparty.ie/sites/default/files/2024-11/Manifesto%20OCT%2024%20-%20digital%20version_final.pdf', 'pdf'),
  // One joint People Before Profit-Solidarity document, hosted by PBP; there is no separate Solidarity manifesto.
  candidate('pbp-ge2024', 'People Before Profit-Solidarity', 'A Vision for Real Change', 'https://www.pbp.ie/content/files/2024/11/PBP-Manifesto-GE2024-2.pdf', 'pdf'),
  candidate('ii-ge2024', 'Independent Ireland', 'General Election Manifesto 2024', 'https://www.independentireland.ie/s/Compressed-General-Election-Manifesto.pdf', 'pdf'),
  // Aontú's site no longer hosts these two parts (404); the official files survive on the Wayback Machine.
  // pidgeon.ie holds a merged copy of both: https://pidgeon.ie/manifestos/docs/aontu/Aontu%20GE%202024.pdf
  candidate('aontu-ge2024-p1', 'Aontú', 'Our Common Sense, part 1 (pages 1-52)', 'https://web.archive.org/web/20241121180148id_/https://aontu.ie/styles/kcfinder/upload/images/Manifestop1.pdf', 'pdf'),
  candidate('aontu-ge2024-p2', 'Aontú', 'Our Common Sense, part 2 (pages 53-105)', 'https://web.archive.org/web/20241203151115id_/https://aontu.ie/styles/kcfinder/upload/images/Manifestop2.pdf', 'pdf'),
  candidate('rdr-ge2024', '100% RDR', '100% Redress Party manifesto', 'https://www.100percentredressparty.ie/manifesto/', 'html'),
];

export const REGISTRY: ManifestoDocument[] = CANDIDATES.map((d) => {
  const done = INGESTED[d.slug];
  return done ? { ...d, ...done, retrieved: '2026-10-04', licenceChecked: true } : d;
});

/** A party's documents, matched by partyKey. */
export function documentsFor(party: string, registry: ManifestoDocument[] = REGISTRY): ManifestoDocument[] {
  const key = partyKey(party);
  return registry.filter((d) => partyKey(d.party) === key);
}
