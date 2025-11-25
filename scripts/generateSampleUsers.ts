import { db } from '../server/db';
import { users } from '../shared/schema';
import * as bcrypt from 'bcryptjs';

// Ireland's approximate bounding box
const IRELAND_MIN_LAT = 51.3;
const IRELAND_MAX_LAT = 55.4;
const IRELAND_MIN_LNG = -10.6;
const IRELAND_MAX_LNG = -5.3;

// List of Irish counties
const IRISH_COUNTIES = [
  'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry',
  'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare',
  'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth',
  'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo',
  'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
];

// Generate a random number within a range
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Generate a random sample user
function generateSampleUser(index: number) {
  const username = `user${index}`;
  const email = `user${index}@example.com`;
  // Use a simple password for test users
  const password = bcrypt.hashSync('password123', 10);
  const firstName = `Test${index}`;
  const lastName = `User${index}`;
  
  // Random county from list
  const county = IRISH_COUNTIES[Math.floor(Math.random() * IRISH_COUNTIES.length)];
  
  // Random latitude and longitude within Ireland's bounds
  const latitude = randomInRange(IRELAND_MIN_LAT, IRELAND_MAX_LAT);
  const longitude = randomInRange(IRELAND_MIN_LNG, IRELAND_MAX_LNG);
  
  return {
    username,
    email,
    password,
    firstName,
    lastName,
    county,
    latitude,
    longitude,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

async function generateSampleUsers(count: number) {
  console.log(`Generating ${count} sample users with location data...`);
  
  try {
    const sampleUsers = Array.from({ length: count }, (_, i) => generateSampleUser(i + 1));
    
    // Insert users in batches to avoid overwhelming the database
    const BATCH_SIZE = 20;
    for (let i = 0; i < sampleUsers.length; i += BATCH_SIZE) {
      const batch = sampleUsers.slice(i, i + BATCH_SIZE);
      
      try {
        await db.insert(users).values(batch).onConflictDoNothing();
        console.log(`Inserted batch ${i / BATCH_SIZE + 1}/${Math.ceil(sampleUsers.length / BATCH_SIZE)}`);
      } catch (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
      }
    }
    
    console.log('Sample user generation complete!');
  } catch (error) {
    console.error('Error generating sample users:', error);
  } finally {
    process.exit(0);
  }
}

// Generate 100 sample users
generateSampleUsers(100);