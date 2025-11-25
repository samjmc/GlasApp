/**
 * Fetch real Wikipedia logos for news sources and political parties
 */

import axios from 'axios';

// News sources
const newsSources = [
  { id: 1, name: "The Irish Times", wikiPage: "The Irish Times" },
  { id: 2, name: "Irish Independent", wikiPage: "Irish Independent" },
  { id: 3, name: "The Journal", wikiPage: "TheJournal.ie" },
  { id: 4, name: "RTE News", wikiPage: "RTÉ News" },
  { id: 5, name: "Breaking News", wikiPage: "BreakingNews.ie" },
  { id: 6, name: "Irish Examiner", wikiPage: "Irish Examiner" },
  { id: 17, name: "Irish Mirror Politics", wikiPage: "Irish Daily Mirror" }
];

// Political parties
const parties = [
  { name: "Fianna Fáil", wikiPage: "Fianna Fáil" },
  { name: "Fine Gael", wikiPage: "Fine Gael" },
  { name: "Sinn Féin", wikiPage: "Sinn Féin" },
  { name: "Green Party", wikiPage: "Green Party (Ireland)" },
  { name: "Labour Party", wikiPage: "Labour Party (Ireland)" },
  { name: "Social Democrats", wikiPage: "Social Democrats (Ireland)" },
  { name: "People Before Profit", wikiPage: "People Before Profit" },
  { name: "Aontú", wikiPage: "Aontú" },
  { name: "Independent", wikiPage: null }
];

async function getWikipediaLogo(wikiPage, type = 'source') {
  if (!wikiPage) return null;
  
  try {
    // First, try to get the logo from the page's infobox
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    
    // Method 1: Try pageimages API (gets main image)
    const params = {
      action: 'query',
      titles: wikiPage,
      prop: 'pageimages|images',
      pithumbsize: 300,
      format: 'json',
      origin: '*'
    };
    
    const response = await axios.get(apiUrl, { 
      params,
      headers: {
        'User-Agent': 'GlasPolitics/1.0 (Educational Project; contact@example.com)'
      }
    });
    
    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1') {
      console.log(`  ⚠️  Page not found: ${wikiPage}`);
      return null;
    }
    
    const page = pages[pageId];
    
    // Get all images on the page
    if (page.images && page.images.length > 0) {
      // Look for logo specifically
      const logoImage = page.images.find(img => 
        img.title.toLowerCase().includes('logo') ||
        img.title.toLowerCase().includes('wordmark') ||
        (type === 'party' && img.title.toLowerCase().includes('emblem'))
      );
      
      if (logoImage) {
        // Get the actual image URL
        const imageParams = {
          action: 'query',
          titles: logoImage.title,
          prop: 'imageinfo',
          iiprop: 'url',
          iiurlwidth: 300,
          format: 'json',
          origin: '*'
        };
        
        const imageResponse = await axios.get(apiUrl, {
          params: imageParams,
          headers: {
            'User-Agent': 'GlasPolitics/1.0 (Educational Project; contact@example.com)'
          }
        });
        
        const imagePages = imageResponse.data.query.pages;
        const imagePageId = Object.keys(imagePages)[0];
        
        if (imagePageId !== '-1' && imagePages[imagePageId].imageinfo) {
          const imageUrl = imagePages[imagePageId].imageinfo[0].thumburl || imagePages[imagePageId].imageinfo[0].url;
          return imageUrl;
        }
      }
    }
    
    // Fallback to main page image
    if (page.thumbnail) {
      return page.thumbnail.source;
    }
    
    return null;
  } catch (error) {
    if (error.response?.status === 403) {
      console.error(`  ⚠️  Wikipedia rate limit reached`);
    } else {
      console.error(`  ❌ Error fetching logo for ${wikiPage}:`, error.message);
    }
    return null;
  }
}

async function main() {
  console.log('🔍 Fetching real logos from Wikipedia...\n');
  console.log('=' + '='.repeat(70) + '\n');
  
  // Fetch news source logos
  console.log('📰 NEWS SOURCES:\n');
  
  const newsSQL = [];
  for (const source of newsSources) {
    console.log(`Processing: ${source.name}`);
    console.log(`  Wikipedia page: ${source.wikiPage}`);
    
    const logoUrl = await getWikipediaLogo(source.wikiPage, 'source');
    
    if (logoUrl) {
      console.log(`  ✅ Logo: ${logoUrl.substring(0, 70)}...`);
      const escapedUrl = logoUrl.replace(/'/g, "''");
      newsSQL.push(
        `UPDATE news_sources SET logo_url = '${escapedUrl}' WHERE id = ${source.id};`
      );
    } else {
      console.log(`  ⚠️  No logo found`);
    }
    
    console.log();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Fetch party logos
  console.log('\n' + '='.repeat(70) + '\n');
  console.log('🎉 POLITICAL PARTIES:\n');
  
  const partySQL = [];
  for (const party of parties) {
    if (!party.wikiPage) {
      console.log(`Skipping: ${party.name} (no Wikipedia page)\n`);
      continue;
    }
    
    console.log(`Processing: ${party.name}`);
    console.log(`  Wikipedia page: ${party.wikiPage}`);
    
    const logoUrl = await getWikipediaLogo(party.wikiPage, 'party');
    
    if (logoUrl) {
      console.log(`  ✅ Logo: ${logoUrl.substring(0, 70)}...`);
      const escapedName = party.name.replace(/'/g, "''");
      const escapedUrl = logoUrl.replace(/'/g, "''");
      partySQL.push(
        `UPDATE parties SET logo = '${escapedUrl}' WHERE name = '${escapedName}';`
      );
    } else {
      console.log(`  ⚠️  No logo found`);
    }
    
    console.log();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Print SQL statements
  console.log('\n' + '='.repeat(70));
  console.log('📝 SQL UPDATE STATEMENTS:');
  console.log('='.repeat(70) + '\n');
  
  console.log('-- News Sources:\n');
  newsSQL.forEach(sql => console.log(sql));
  
  console.log('\n-- Political Parties:\n');
  partySQL.forEach(sql => console.log(sql));
  
  console.log('\n' + '='.repeat(70));
  console.log(`✅ Successfully fetched ${newsSQL.length} news source logos`);
  console.log(`✅ Successfully fetched ${partySQL.length} party logos`);
  console.log('='.repeat(70));
}

main().catch(console.error);

