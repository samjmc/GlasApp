/**
 * Test Script: Verify Party Baselines are Applied Correctly
 */

import { TDIdeologyProfileService } from '../services/tdIdeologyProfileService';

async function testPartyBaselines() {
  console.log('🧪 Testing Party Baseline Initialization\n');

  const testTDs = [
    { name: 'Test TD Fine Gael', party: 'Fine Gael', expected: { economic: 2, social: 2, welfare: 2 } },
    { name: 'Test TD Fianna Fail', party: 'Fianna Fáil', expected: { economic: 1, social: 1, welfare: 3 } },
    { name: 'Test TD Sinn Fein', party: 'Sinn Féin', expected: { economic: -6, social: -6, welfare: 7 } },
    { name: 'Test TD Labour', party: 'Labour Party', expected: { economic: -4, social: -6, welfare: 8 } },
  ];

  for (const td of testTDs) {
    console.log(`\n📋 Testing: ${td.name} (${td.party})`);
    
    // This will create the profile if it doesn't exist
    const profile = await (TDIdeologyProfileService as unknown).ensureTDProfile?.(td.name);
    
    if (!profile) {
      console.error('❌ Failed to create profile');
      continue;
    }

    console.log(`   Economic: ${profile.economic} (expected: ${td.expected.economic})`);
    console.log(`   Social: ${profile.social} (expected: ${td.expected.social})`);
    console.log(`   Welfare: ${profile.welfare} (expected: ${td.expected.welfare})`);
    
    const economicMatch = Math.abs(profile.economic - td.expected.economic) < 0.1;
    const socialMatch = Math.abs(profile.social - td.expected.social) < 0.1;
    const welfareMatch = Math.abs(profile.welfare - td.expected.welfare) < 0.1;
    
    if (economicMatch && socialMatch && welfareMatch) {
      console.log('   ✅ PASS: Party baseline correctly applied');
    } else {
      console.log('   ❌ FAIL: Party baseline not correct');
    }
  }

  console.log('\n✅ Party baseline test complete!');
}

testPartyBaselines().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

