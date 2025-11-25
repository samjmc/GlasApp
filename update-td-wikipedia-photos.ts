/**
 * Fetch and update Wikipedia profile photos for all TDs
 * Uses the Wikipedia API to get page images for Irish politicians
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase client
const supabaseUrl = 'https://ospxqnxlotakujloltqy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcHhxbnhsb3Rha3VqbG9sdHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk0MjU5MzYsImV4cCI6MjA0NTAwMTkzNn0.SRqgDRJ_YeIwU5x0PzThCsDm9Sk1L9RX2FLl1gORiCQ';
const supabase = createClient(supabaseUrl, supabaseKey);

interface TD {
  id: number;
  politician_name: string;
  wikipedia_title: string | null;
  image_url: string | null;
}

/**
 * Search Wikipedia for a politician's page
 */
async function searchWikipedia(tdName: string): Promise<string | null> {
  try {
    // Clean up the name (remove middle initials, etc.)
    const cleanName = tdName.replace(/\s+\w\.\s+/g, ' ').trim();
    
    // Search for the page
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    const searchParams = {
      action: 'query',
      list: 'search',
      srsearch: `${cleanName} Irish politician TD`,
      format: 'json',
      origin: '*'
    };
    
    const searchResponse = await axios.get(searchUrl, { params: searchParams });
    const searchResults = searchResponse.data.query.search;
    
    if (searchResults.length === 0) {
      console.log(`  ⚠️  No Wikipedia page found for ${tdName}`);
      return null;
    }
    
    // Return the title of the first result
    return searchResults[0].title;
  } catch (error) {
    console.error(`  ❌ Error searching Wikipedia for ${tdName}:`, error);
    return null;
  }
}

/**
 * Get the main image from a Wikipedia page
 */
async function getWikipediaImage(pageTitle: string): Promise<string | null> {
  try {
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const params = {
      action: 'query',
      titles: pageTitle,
      prop: 'pageimages',
      pithumbsize: 500,
      format: 'json',
      origin: '*'
    };
    
    const response = await axios.get(apiUrl, { params });
    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];
    
    if (pageId === '-1') {
      console.log(`  ⚠️  Page not found: ${pageTitle}`);
      return null;
    }
    
    const page = pages[pageId];
    
    if (!page.thumbnail) {
      console.log(`  ⚠️  No image found for ${pageTitle}`);
      return null;
    }
    
    return page.thumbnail.source;
  } catch (error) {
    console.error(`  ❌ Error fetching image for ${pageTitle}:`, error);
    return null;
  }
}

/**
 * Update a TD's Wikipedia information in the database
 */
async function updateTD(tdId: number, wikipediaTitle: string | null, imageUrl: string | null) {
  try {
    const updates: any = {
      wikipedia_title: wikipediaTitle,
      image_url: imageUrl,
      has_profile_image: !!imageUrl
    };
    
    const { error } = await supabase
      .from('td_scores')
      .update(updates)
      .eq('id', tdId);
    
    if (error) {
      console.error(`  ❌ Error updating TD ${tdId}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`  ❌ Error updating TD ${tdId}:`, error);
    return false;
  }
}

/**
 * Main function to update all TDs
 */
async function updateAllTDs() {
  console.log('🔍 Fetching active TDs from database...\n');
  
  // Fetch all active TDs
  const { data: tds, error } = await supabase
    .from('td_scores')
    .select('id, politician_name, wikipedia_title, image_url')
    .eq('is_active', true)
    .order('politician_name');
  
  if (error) {
    console.error('❌ Error fetching TDs:', error);
    return;
  }
  
  if (!tds || tds.length === 0) {
    console.log('No active TDs found');
    return;
  }
  
  console.log(`Found ${tds.length} active TDs\n`);
  
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  
  // Process each TD
  for (let i = 0; i < tds.length; i++) {
    const td = tds[i];
    console.log(`[${i + 1}/${tds.length}] Processing: ${td.politician_name}`);
    
    // Skip if already has an image
    if (td.image_url) {
      console.log(`  ✓ Already has image, skipping\n`);
      skippedCount++;
      continue;
    }
    
    // Search for Wikipedia page if we don't have the title
    let wikipediaTitle = td.wikipedia_title;
    if (!wikipediaTitle) {
      wikipediaTitle = await searchWikipedia(td.politician_name);
      if (!wikipediaTitle) {
        failCount++;
        console.log('');
        continue;
      }
      console.log(`  📖 Found Wikipedia page: ${wikipediaTitle}`);
    }
    
    // Get the image URL
    const imageUrl = await getWikipediaImage(wikipediaTitle);
    
    if (imageUrl) {
      // Update the database
      const success = await updateTD(td.id, wikipediaTitle, imageUrl);
      if (success) {
        console.log(`  ✅ Updated with image: ${imageUrl.substring(0, 60)}...\n`);
        successCount++;
      } else {
        failCount++;
        console.log('');
      }
    } else {
      // Still update the Wikipedia title even if no image
      await updateTD(td.id, wikipediaTitle, null);
      failCount++;
      console.log('');
    }
    
    // Add a small delay to be respectful to Wikipedia's API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n===========================================');
  console.log('📊 Summary:');
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed (no image found): ${failCount}`);
  console.log(`⏭️  Skipped (already had image): ${skippedCount}`);
  console.log(`📝 Total processed: ${tds.length}`);
  console.log('===========================================\n');
}

// Run the script
updateAllTDs().catch(console.error);

