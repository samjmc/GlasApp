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

export const REGISTRY: ManifestoDocument[] = [
  candidate('ff-ge2024', 'Fianna Fáil', 'Moving Forward. Together.', 'https://7358484.fs1.hubspotusercontent-na1.net/hubfs/7358484/FF%20Manifesto%202024_V4_Screen%5B45%5D.pdf', 'pdf'),
  candidate('fg-ge2024', 'Fine Gael', 'Securing Your Future', 'https://www.finegael.ie/app/uploads/2024/11/Fine-Gael-General-Election-2024-Manifesto.pdf', 'pdf'),
  candidate('sf-ge2024', 'Sinn Féin', 'The Choice for Change', 'https://www.sinnfein.ie/contents/65896', 'html'),
  candidate('labour-ge2024', 'Labour Party', 'Building Better Together', 'https://labour.ie/wp-content/uploads/2021/10/Labour-Manifesto-2024-Building-Better-Together.pdf', 'pdf', 'https://www.drugsandalcohol.ie/42270/1/Labour-Manifesto-2024-Building-Better-Together.pdf'),
  candidate('socdems-ge2024', 'Social Democrats', 'For the Future', 'https://www.socialdemocrats.ie/our-policies/general-election-manifesto-2024/', 'html'),
  candidate('greens-ge2024', 'Green Party', 'Towards 2030', 'https://www.greenparty.ie/sites/default/files/2024-11/Manifesto%20OCT%2024%20-%20digital%20version_final.pdf', 'pdf'),
  candidate('pbp-ge2024', 'People Before Profit-Solidarity', 'Another Ireland is Possible', 'https://www.pbp.ie/ge24/manifesto/', 'html'),
  candidate('solidarity-ge2024', 'People Before Profit-Solidarity', 'Solidarity General Election Manifesto', 'https://www.solidarity.ie/manifesto', 'html'),
  candidate('ii-ge2024', 'Independent Ireland', 'Common Sense Solutions', 'https://www.independentireland.ie/manifesto', 'html'),
  candidate('aontu-ge2024', 'Aontú', 'Our Common Sense', null, 'pdf'),
  candidate('rdr-ge2024', '100% RDR', '100% Redress Party manifesto', null, 'pdf'),
];

/** A party's documents, matched by partyKey. */
export function documentsFor(party: string, registry: ManifestoDocument[] = REGISTRY): ManifestoDocument[] {
  const key = partyKey(party);
  return registry.filter((d) => partyKey(d.party) === key);
}
