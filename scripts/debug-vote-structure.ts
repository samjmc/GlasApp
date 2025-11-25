import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function debugVotes() {
  console.log('🔍 DEBUGGING VOTE STRUCTURE\n');

  const response = await apiClient.get('/divisions', {
    params: {
      chamber_type: 'house',
      chamber_id: 'https://data.oireachtas.ie/ie/oireachtas/house/dail/34',
      date_start: '2024-11-01',
      limit: 1
    }
  });

  const division = response.data.results?.[0]?.division;
  
  console.log('FULL DIVISION STRUCTURE:');
  console.log(JSON.stringify(division, null, 2));
}

debugVotes().catch(console.error);

