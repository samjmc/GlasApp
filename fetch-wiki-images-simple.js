/**
 * Simple script to fetch Wikipedia images for Irish TDs
 * Outputs SQL statements to manually run
 */

import axios from 'axios';

// Top TDs to update
const tds = [
  { id: 4, name: "Mary Lou McDonald" },
  { id: 143, name: "Simon Harris" },
  { id: 169, name: "Micheál Martin" },
  { id: 2, name: "Roderic O'Gorman" },
  { id: 113, name: "Pearse Doherty" },
  { id: 67, name: "Holly Cairns" },
  { id: 19, name: "Ivana Bacik" },
  { id: 116, name: "Paschal Donohoe" },
  { id: 214, name: "Willie O'Dea" },
  { id: 154, name: "Alan Kelly" },
  { id: 24, name: "Richard Boyd Barrett" },
  { id: 247, name: "Peadar Tóibín" },
  { id: 253, name: "Eoin Ó Broin" },
  { id: 85, name: "Catherine Connolly" },
  { id: 166, name: "Michael Lowry" },
  { id: 181, name: "Mattie McGrath" },
  { id: 146, name: "Danny Healy-Rae" },
  { id: 147, name: "Michael Healy-Rae" },
  { id: 141, name: "Marian Harkin" },
  { id: 124, name: "Michael Fitzmaurice" }
];

async function searchWikipedia(tdName) {
  try {
    const url = 'https://en.wikipedia.org/w/api.php';
    const params = {
      action: 'query',
      list: 'search',
      srsearch: `${tdName} Irish politician TD`,
      format: 'json',
      origin: '*'
    };
    
    const response = await axios.get(url, { params });
    const results = response.data.query.search;
    
    if (results.length === 0) {
      console.error(`  ⚠️  No Wikipedia page found for ${tdName}`);
      return null;
    }
    
    return results[0].title;
  } catch (error) {
    console.error(`  ❌ Error searching for ${tdName}:`, error.message);
    return null;
  }
}

async function getWikipediaImage(pageTitle) {
  try {
    const url = 'https://en.wikipedia.org/w/api.php';
    const params = {
      action: 'query',
      titles: pageTitle,
      prop: 'pageimages',
      pithumbsize: 500,
      format: 'json',
      origin: '*'
    };
    
    const response = await axios.get(url, { params });
    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1') {
      console.error(`  ⚠️  Page not found: ${pageTitle}`);
      return null;
    }
    
    const page = pages[pageId];
    
    if (!page.thumbnail) {
      console.error(`  ⚠️  No image found for ${pageTitle}`);
      return null;
    }
    
    return page.thumbnail.source;
  } catch (error) {
    console.error(`  ❌ Error fetching image for ${pageTitle}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Fetching Wikipedia images for Irish TDs...\n');
  
  const sqlStatements = [];
  
  for (let i = 0; i < tds.length; i++) {
    const td = tds[i];
    console.log(`[${i + 1}/${tds.length}] Processing: ${td.name}`);
    
    const wikiTitle = await searchWikipedia(td.name);
    if (!wikiTitle) {
      console.log();
      continue;
    }
    
    console.log(`  📖 Found: ${wikiTitle}`);
    
    const imageUrl = await getWikipediaImage(wikiTitle);
    
    if (imageUrl) {
      console.log(`  ✅ Image: ${imageUrl.substring(0, 60)}...`);
      
      const wikiTitleEscaped = wikiTitle.replace(/'/g, "''");
      const imageUrlEscaped = imageUrl.replace(/'/g, "''");
      
      sqlStatements.push(
        `UPDATE td_scores SET wikipedia_title = '${wikiTitleEscaped}', image_url = '${imageUrlEscaped}', has_profile_image = true WHERE id = ${td.id};`
      );
    }
    
    console.log();
    
    // Be respectful to Wikipedia's API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SQL UPDATE Statements:');
  console.log('='.repeat(70) + '\n');
  
  sqlStatements.forEach(sql => console.log(sql + '\n'));
}

main().catch(console.error);

