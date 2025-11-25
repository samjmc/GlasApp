/**
 * Fetch Wikipedia images for ALL Irish TDs
 * Outputs SQL statements in batches
 */

import axios from 'axios';

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

// Complete list of ALL active TDs
const allTDs = [
  { id: 259, name: "Aengus Ó Snodaigh" },
  { id: 122, name: "Aidan Farrelly" },
  { id: 188, name: "Aindrias Moynihan" },
  { id: 109, name: "Aisling Dempsey" },
  { id: 112, name: "Alan Dillon" },
  { id: 154, name: "Alan Kelly" },
  { id: 114, name: "Albert Dolan" },
  { id: 138, name: "Ann Graves" },
  { id: 149, name: "Barry Heneghan" },
  { id: 249, name: "Barry Ward" },
  { id: 240, name: "Brendan Smith" },
  { id: 31, name: "Brian Brennan" },
  { id: 243, name: "Brian Stanley" },
  { id: 205, name: "Carol Nolan" },
  { id: 96, name: "Cathal Crowe" },
  { id: 18, name: "Catherine Ardagh" },
  { id: 68, name: "Catherine Callaghan" },
  { id: 85, name: "Catherine Connolly" },
  { id: 20, name: "Cathy Bennett" },
  { id: 250, name: "Charles Ward" },
  { id: 174, name: "Charlie McConalogue" },
  { id: 230, name: "Christopher O'Sullivan" },
  { id: 210, name: "Cian O'Callaghan" },
  { id: 15, name: "Ciarán Ahern" },
  { id: 160, name: "Claire Kerrane" },
  { id: 33, name: "Colm Brophy" },
  { id: 56, name: "Colm Burke" },
  { id: 184, name: "Conor D McGuinness" },
  { id: 238, name: "Conor Sheehan" },
  { id: 111, name: "Cormac Devlin" },
  { id: 146, name: "Danny Healy-Rae" },
  { id: 69, name: "Dara Calleary" },
  { id: 209, name: "Darragh O'Brien" },
  { id: 228, name: "Darren O'Rourke" },
  { id: 99, name: "David Cullinane" },
  { id: 170, name: "David Maxwell" },
  { id: 186, name: "Denise Mitchell" },
  { id: 119, name: "Dessie Ellis" },
  { id: 180, name: "Donna McGettigan" },
  { id: 256, name: "Donnchadh Ó Laoghaire" },
  { id: 241, name: "Duncan Smith" },
  { id: 237, name: "Eamon Scanlon" },
  { id: 244, name: "Edward Timmins" },
  { id: 103, name: "Emer Currie" },
  { id: 152, name: "Emer Higgins" },
  { id: 156, name: "Eoghan Kenny" },
  { id: 144, name: "Eoin Hayes" },
  { id: 253, name: "Eoin Ó Broin" },
  { id: 183, name: "Erin McGreehan" },
  { id: 260, name: "Fionntán Ó Súilleabháin" },
  { id: 123, name: "Frankie Feighan" },
  { id: 132, name: "Gary Gannon" },
  { id: 200, name: "Ged Nash" },
  { id: 165, name: "George Lawlor" },
  { id: 245, name: "Gillian Toole" },
  { id: 23, name: "Grace Boland" },
  { id: 179, name: "Helen McEntee" },
  { id: 201, name: "Hildegarde Naughton" },
  { id: 67, name: "Holly Cairns" },
  { id: 19, name: "Ivana Bacik" },
  { id: 1, name: "Jack Chambers" },
  { id: 54, name: "James Browne" },
  { id: 133, name: "James Geoghegan" },
  { id: 163, name: "James Lawless" },
  { id: 213, name: "James O'Connor" },
  { id: 100, name: "Jen Cummins" },
  { id: 72, name: "Jennifer Carroll MacNeill" },
  { id: 192, name: "Jennifer Murnane O'Connor" },
  { id: 252, name: "Jennifer Whitmore" },
  { id: 60, name: "Jerry Buttimer" },
  { id: 211, name: "Jim O'Callaghan" },
  { id: 62, name: "Joanna Byrne" },
  { id: 90, name: "Joe Cooney" },
  { id: 203, name: "Joe Neville" },
  { id: 29, name: "John Brady" },
  { id: 78, name: "John Clendennen" },
  { id: 86, name: "John Connolly" },
  { id: 101, name: "John Cummins" },
  { id: 162, name: "John Lahart" },
  { id: 185, name: "John McGuinness" },
  { id: 229, name: "John Paul O'Shea" },
  { id: 140, name: "Johnny Guirke" },
  { id: 199, name: "Johnny Mythen" },
  { id: 159, name: "Keira Keogh" },
  { id: 220, name: "Ken O'Flynn" },
  { id: 187, name: "Kevin Boxer Moran" },
  { id: 215, name: "Kieran O'Donnell" },
  { id: 232, name: "Liam Quaide" },
  { id: 222, name: "Louis O'Hara" },
  { id: 226, name: "Louise O'Reilly" },
  { id: 212, name: "Maeve O'Connell" },
  { id: 110, name: "Máire Devine" },
  { id: 121, name: "Mairéad Farrell" },
  { id: 63, name: "Malcolm Byrne" },
  { id: 141, name: "Marian Harkin" },
  { id: 239, name: "Marie Sherlock" },
  { id: 248, name: "Mark Wall" },
  { id: 251, name: "Mark Ward" },
  { id: 105, name: "Martin Daly" },
  { id: 150, name: "Martin Heydon" },
  { id: 157, name: "Martin Kenny" },
  { id: 58, name: "Mary Butler" },
  { id: 4, name: "Mary Lou McDonald" },
  { id: 73, name: "Matt Carthy" },
  { id: 181, name: "Mattie McGrath" },
  { id: 233, name: "Maurice Quinlivan" },
  { id: 66, name: "Michael Cahill" },
  { id: 82, name: "Michael Collins" },
  { id: 124, name: "Michael Fitzmaurice" },
  { id: 147, name: "Michael Healy-Rae" },
  { id: 166, name: "Michael Lowry" },
  { id: 189, name: "Michael Moynihan" },
  { id: 194, name: "Michael Murphy" },
  { id: 71, name: "Micheál Carrigy" },
  { id: 169, name: "Micheál Martin" },
  { id: 254, name: "Naoise Ó Cearúil" },
  { id: 257, name: "Naoise Ó Muirí" },
  { id: 204, name: "Natasha Newsome Drennan" },
  { id: 235, name: "Neale Richmond" },
  { id: 83, name: "Niall Collins" },
  { id: 242, name: "Niamh Smyth" },
  { id: 139, name: "Noel Grealish" },
  { id: 173, name: "Noel McCarthy" },
  { id: 129, name: "Norma Foley" },
  { id: 106, name: "Pa Daly" },
  { id: 168, name: "Pádraig Mac Lochlainn" },
  { id: 231, name: "Pádraig O'Sullivan" },
  { id: 234, name: "Pádraig Rice" },
  { id: 116, name: "Paschal Donohoe" },
  { id: 55, name: "Pat Buckley" },
  { id: 130, name: "Pat the Cope Gallagher" },
  { id: 219, name: "Patrick O'Donovan" },
  { id: 115, name: "Paul Donnelly" },
  { id: 164, name: "Paul Lawless" },
  { id: 171, name: "Paul McAuliffe" },
  { id: 196, name: "Paul Murphy" },
  { id: 135, name: "Paul Nicholas Gogarty" },
  { id: 59, name: "Paula Butterly" },
  { id: 247, name: "Peadar Tóibín" },
  { id: 113, name: "Pearse Doherty" },
  { id: 77, name: "Peter 'Chap' Cleere" },
  { id: 57, name: "Peter Burke" },
  { id: 236, name: "Peter Roche" },
  { id: 95, name: "Réada Cronin" },
  { id: 24, name: "Richard Boyd Barrett" },
  { id: 216, name: "Richard O'Donoghue" },
  { id: 217, name: "Robert O'Donoghue" },
  { id: 246, name: "Robert Troy" },
  { id: 2, name: "Roderic O'Gorman" },
  { id: 148, name: "Rory Hearne" },
  { id: 89, name: "Rose Conway-Walsh" },
  { id: 258, name: "Ruairí Ó Murchú" },
  { id: 91, name: "Ruth Coppinger" },
  { id: 224, name: "Ryan O'Meara" },
  { id: 145, name: "Seamus Healy" },
  { id: 182, name: "Séamus McGrath" },
  { id: 70, name: "Seán Canney" },
  { id: 98, name: "Seán Crowe" },
  { id: 127, name: "Sean Fleming" },
  { id: 255, name: "Seán Ó Fearghaíl" },
  { id: 190, name: "Shane Moynihan" },
  { id: 32, name: "Shay Brennan" },
  { id: 208, name: "Shónagh Ní Raghallaigh" },
  { id: 143, name: "Simon Harris" },
  { id: 134, name: "Sinéad Gibney" },
  { id: 76, name: "Sorca Clarke" },
  { id: 65, name: "Thomas Byrne" },
  { id: 137, name: "Thomas Gould" },
  { id: 27, name: "Tom Brabazon" },
  { id: 176, name: "Tony McCormack" },
  { id: 197, name: "Verona Murphy" },
  { id: 16, name: "William Aird" },
  { id: 214, name: "Willie O'Dea" }
];

async function main() {
  console.log(`🔍 Fetching Wikipedia images for ALL ${allTDs.length} TDs...\n`);
  
  // Filter out those that are already done
  const alreadyDone = [4, 143, 169, 2, 113, 67, 19, 116, 214, 154, 24, 247, 253, 85, 166, 181, 146, 147, 141, 124];
  const tdsToProcess = allTDs.filter(td => !alreadyDone.includes(td.id));
  
  console.log(`Skipping ${alreadyDone.length} TDs with existing photos`);
  console.log(`Processing ${tdsToProcess.length} remaining TDs\n`);
  
  const sqlStatements = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < tdsToProcess.length; i++) {
    const td = tdsToProcess[i];
    console.log(`[${i + 1}/${tdsToProcess.length}] Processing: ${td.name}`);
    
    const wikiTitle = await searchWikipedia(td.name);
    if (!wikiTitle) {
      failCount++;
      console.log();
      continue;
    }
    
    console.log(`  📖 Found: ${wikiTitle}`);
    
    const imageUrl = await getWikipediaImage(wikiTitle);
    
    if (imageUrl) {
      console.log(`  ✅ Image found`);
      
      const wikiTitleEscaped = wikiTitle.replace(/'/g, "''");
      const imageUrlEscaped = imageUrl.replace(/'/g, "''");
      
      sqlStatements.push(
        `UPDATE td_scores SET wikipedia_title = '${wikiTitleEscaped}', image_url = '${imageUrlEscaped}', has_profile_image = true WHERE id = ${td.id};`
      );
      successCount++;
    } else {
      failCount++;
    }
    
    console.log();
    
    // Be respectful to Wikipedia's API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 Summary:');
  console.log('='.repeat(70));
  console.log(`✅ Found images: ${successCount}`);
  console.log(`❌ No image found: ${failCount}`);
  console.log(`📝 Total TDs processed: ${tdsToProcess.length}`);
  console.log('='.repeat(70) + '\n\n');
  
  // Print SQL statements in batches of 10
  console.log('SQL UPDATE Statements (run these in the database):\n');
  for (let i = 0; i < sqlStatements.length; i += 10) {
    const batch = sqlStatements.slice(i, i + 10);
    console.log(`-- Batch ${Math.floor(i / 10) + 1} (${batch.length} statements)\n`);
    batch.forEach(sql => console.log(sql));
    console.log('\n');
  }
}

main().catch(console.error);

