import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function debugDebates() {
  console.log('🔍 DEBUGGING DEBATE STRUCTURE\n');

  const response = await apiClient.get('/debates', {
    params: {
      chamber_type: 'house',
      chamber_id: 'https://data.oireachtas.ie/ie/oireachtas/house/dail/34',
      date_start: '2024-11-01',
      limit: 1
    }
  });

  const result = response.data.results?.[0];
  
  console.log('FULL RESULT STRUCTURE:');
  console.log(JSON.stringify(result, null, 2));
}

debugDebates().catch(console.error);

