import axios from 'axios';

const remainingTDs = [
  { id: 96, name: "Cathal Crowe" },
  { id: 184, name: "Conor D McGuinness" },
  { id: 186, name: "Denise Mitchell" },
  { id: 123, name: "Frankie Feighan" },
  { id: 133, name: "James Geoghegan" },
  { id: 62, name: "Joanna Byrne" },
  { id: 157, name: "Martin Kenny" },
  { id: 189, name: "Michael Moynihan" },
  { id: 83, name: "Niall Collins" },
  { id: 27, name: "Tom Brabazon" }
];

async function searchWikipedia(tdName) {
  const url = 'https://en.wikipedia.org/w/api.php';
  const params = {
    action: 'query',
    list: 'search',
    srsearch: `${tdName} Irish politician TD Dáil`,
    format: 'json',
    origin: '*'
  };
  
  const response = await axios.get(url, { params });
  return response.data.query.search.length > 0 ? response.data.query.search[0].title : null;
}

async function getWikipediaImage(pageTitle) {
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
  return pages[pageId].thumbnail?.source || null;
}

async function main() {
  console.log('Fetching remaining 10 TDs...\n');
  
  for (const td of remainingTDs) {
    console.log(`Processing: ${td.name}`);
    const wikiTitle = await searchWikipedia(td.name);
    
    if (!wikiTitle) {
      console.log(`  ⚠️  Not found\n`);
      continue;
    }
    
    console.log(`  📖 Found: ${wikiTitle}`);
    const imageUrl = await getWikipediaImage(wikiTitle);
    
    if (imageUrl) {
      const wikiEscaped = wikiTitle.replace(/'/g, "''");
      const urlEscaped = imageUrl.replace(/'/g, "''");
      console.log(`  ✅ Image found`);
      console.log(`UPDATE td_scores SET wikipedia_title = '${wikiEscaped}', image_url = '${urlEscaped}', has_profile_image = true WHERE id = ${td.id};\n`);
    } else {
      console.log(`  ⚠️  No image\n`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
}

main().catch(console.error);

