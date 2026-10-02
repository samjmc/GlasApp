import { describe, expect, it } from 'vitest';
import { SOURCE_MAX_CHARS, htmlToSource, leadSummary, sentences } from './source';

/** The shape the MediaWiki parse API returns (measured 2026-10-02 on three TDs' pages). */
const page = (body: string) => `<div class="mw-parser-output">${body}</div>`;
const h = (level: number, title: string) => `<div class="mw-heading mw-heading${level}"><h${level} id="x">${title}</h${level}></div>`;

const ARDAGH = page(`
  <div class="shortdescription">Irish politician</div>
  <p class="mw-empty-elt"></p>
  <table class="infobox"><tr><td>Infobox text must not appear</td></tr></table>
  <p>Catherine Ardagh (born 20 September 1982) is an Irish Fianna Fáil politician who has served as a Minister of State since 2026.<sup class="reference">[1]</sup> She has been a TD for Dublin South-Central since November 2024. She served as a Senator from 2016 to 2024.</p>
  ${h(2, 'Political career')}
  ${h(3, 'County Councillor')}
  <p>She was elected to Dublin City Council at the 2009 local elections for the Crumlin–Kimmage area.</p>
  ${h(2, 'Controversies')}
  <p>She was accused of something in a newspaper.</p>
  ${h(3, 'Expenses')}
  <p>A subsection under a cut section is cut too.</p>
  ${h(2, 'Personal life')}
  <p>She is married with two children.</p>
  ${h(2, 'Teachta Dála')}
  <p>She was elected at the 2024 general election.</p>
  ${h(2, 'References')}
  <p>Reference text.</p>
`);

describe('htmlToSource', () => {
  const source = htmlToSource(ARDAGH);

  it('keeps the lead and the kept sections, without footnote marks or the infobox', () => {
    expect(source.lead).toBe(
      'Catherine Ardagh (born 20 September 1982) is an Irish Fianna Fáil politician who has served as a Minister of State since 2026. She has been a TD for Dublin South-Central since November 2024. She served as a Senator from 2016 to 2024.',
    );
    expect(source.text).toContain('elected to Dublin City Council at the 2009 local elections');
    expect(source.text).toContain('elected at the 2024 general election');
    expect(source.text).not.toContain('[1]');
    expect(source.text).not.toContain('Infobox');
  });

  it('cuts controversy, personal and reference sections, with their subsections', () => {
    expect(source.text).not.toContain('accused');
    expect(source.text).not.toContain('subsection under a cut section');
    expect(source.text).not.toContain('married');
    expect(source.text).not.toContain('Reference text');
    expect(source.cut).toEqual(['Controversies', 'Personal life', 'References']);
  });

  it('stops at a paragraph boundary at SOURCE_MAX_CHARS', () => {
    const long = page(`<p>${'Lead sentence here. '.repeat(10)}</p>${h(2, 'Career')}${Array.from({ length: 40 }, (_, i) => `<p>Paragraph ${i} ${'word '.repeat(80)}</p>`).join('')}`);
    const { text } = htmlToSource(long);
    expect(text.length).toBeLessThanOrEqual(SOURCE_MAX_CHARS);
    expect(text.length).toBeGreaterThan(SOURCE_MAX_CHARS - 600);
    expect(text.endsWith('word')).toBe(true);
  });
});

describe('sentences', () => {
  it('does not split at an initial or an abbreviation', () => {
    expect(sentences('W. T. Cosgrave led the government. He was born in St. James. Dr. Ryan spoke.')).toEqual([
      'W. T. Cosgrave led the government.',
      'He was born in St. James.',
      'Dr. Ryan spoke.',
    ]);
  });
});

describe('leadSummary', () => {
  it('is the first two sentences, word for word', () => {
    expect(leadSummary(htmlToSource(ARDAGH).lead)).toBe(
      'Catherine Ardagh (born 20 September 1982) is an Irish Fianna Fáil politician who has served as a Minister of State since 2026. She has been a TD for Dublin South-Central since November 2024.',
    );
  });

  it('stops at the first sensitive sentence', () => {
    expect(leadSummary('A B is a TD for Cork since 2020. He was convicted of fraud in 2019. He likes cats.')).toBe('A B is a TD for Cork since 2020.');
  });

  it('is null when the first sentence is sensitive, or there is no lead', () => {
    expect(leadSummary('A B is a TD who was accused of corruption. He is from Cork.')).toBeNull();
    expect(leadSummary('')).toBeNull();
  });
});
