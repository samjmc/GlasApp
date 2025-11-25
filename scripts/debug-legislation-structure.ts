import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function debugLegislation() {
  console.log('🔍 DEBUGGING LEGISLATION STRUCTURE\n');

  const response = await apiClient.get('/legislation', {
    params: {
      date_start: '2024-01-01',
      limit: 3
    }
  });

  const result = response.data.results?.[0];
  
  console.log('FULL RESULT STRUCTURE:');
  console.log(JSON.stringify(result, null, 2));
}

debugLegislation().catch(console.error);

