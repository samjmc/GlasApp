/**
 * Test rating submission in detail
 */

const BASE_URL = 'http://localhost:5000';

async function testRatingSubmit() {
  console.log('Testing rating submission in detail...\n');
  
  const ratingData = {
    tdName: 'Mary Lou McDonald',
    transparency: 75,
    effectiveness: 80,
    integrity: 85,
    consistency: 70,
    constituencyService: 65,
    comment: 'Test rating from automated test'
  };
  
  console.log('Submitting rating:');
  console.log(JSON.stringify(ratingData, null, 2));
  console.log();
  
  try {
    const response = await fetch(`${BASE_URL}/api/ratings/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ratingData)
    });
    
    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${text}\n`);
    
    if (response.ok) {
      const data = JSON.parse(text);
      if (data.success) {
        console.log('✅ Rating submitted successfully!');
        console.log(`Rating ID: ${data.rating_id}\n`);
        
        // Try to fetch it back
        console.log('Fetching rating back...');
        const getResponse = await fetch(`${BASE_URL}/api/ratings/td/${encodeURIComponent(ratingData.tdName)}`);
        const getRatingText = await getResponse.text();
        console.log(`Get Status: ${getResponse.status}`);
        console.log(`Get Response: ${getRatingText}`);
      } else {
        console.log(`❌ Failed: ${data.message}`);
      }
    } else {
      console.log('❌ HTTP Error');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testRatingSubmit();

