/**
 * Debug Question API Format
 * Fetches one question to see exact structure
 */

import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

async function debugQuestionFormat() {
  console.log('🔍 DEBUGGING QUESTION API FORMAT\n');

  try {
    const response = await apiClient.get('/questions', {
      params: {
        date_start: '2024-01-01',
        limit: 3
      }
    });

    const questions = response.data.results || [];
    
    console.log(`✅ Fetched ${questions.length} questions\n`);

    for (let i = 0; i < Math.min(3, questions.length); i++) {
      const result = questions[i];
      const q = result.question;
      
      console.log('═'.repeat(70));
      console.log(`QUESTION ${i + 1}:`);
      console.log('═'.repeat(70));
      
      console.log('\n📋 Full question object structure:');
      console.log(JSON.stringify(q, null, 2));
      
      console.log('\n🔑 Key fields:');
      console.log(`  questionNo: ${q.questionNo}`);
      console.log(`  uri: ${q.uri}`);
      console.log(`  showAs: ${q.showAs}`);
      console.log(`  questionType: ${q.questionType}`);
      
      console.log('\n👤 Member "by" structure:');
      console.log(`  by: ${JSON.stringify(q.by, null, 2)}`);
      
      console.log('\n🎯 Extracted member URI attempts:');
      console.log(`  q.by?.uri: ${q.by?.uri}`);
      console.log(`  q.by?.member?.uri: ${q.by?.member?.uri}`);
      console.log(`  q.by?.showAs: ${q.by?.showAs}`);
      
      console.log('\n');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugQuestionFormat().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

