
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function debugDivision() {
  console.log('🔍 Fetching multiple divisions for inspection...');
  
  const response = await apiClient.get('/divisions', {
    params: {
      chamber_type: 'house',
      chamber_id: 'https://data.oireachtas.ie/ie/oireachtas/house/dail/34',
      date_start: '2024-01-01', // Look back further
      limit: 50
    }
  });

  const results = response.data.results;
  console.log(`Fetched ${results.length} results.`);

  results.forEach((r: any, i: number) => {
      const subject = r.division.subject;
      if (!subject) {
          console.log(`[${i}] No subject`);
          return;
      }
      
      const showAs = subject.showAs;
      console.log(`[${i}] showAs type: ${typeof showAs}, Value:`, JSON.stringify(showAs));

      if (typeof showAs !== 'string') {
          console.log('!!! FOUND NON-STRING showAs !!!');
          console.log(JSON.stringify(subject, null, 2));
      }
  });
}

debugDivision();

