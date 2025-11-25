-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  profile_image_url TEXT,
  county VARCHAR(50),
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create quiz_results table
CREATE TABLE IF NOT EXISTS quiz_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  economic_score VARCHAR(10) NOT NULL,
  social_score VARCHAR(10) NOT NULL,
  ideology VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  share_code VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create parties table
CREATE TABLE IF NOT EXISTS parties (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  abbreviation VARCHAR(20),
  color VARCHAR(20) NOT NULL,
  logo TEXT,
  description TEXT,
  economic_position DECIMAL(3,1),
  social_position DECIMAL(3,1),
  founded_year INTEGER,
  website TEXT
);

-- Create constituencies table
CREATE TABLE IF NOT EXISTS constituencies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  county VARCHAR(50) NOT NULL,
  seats INTEGER NOT NULL,
  population INTEGER,
  registered_voters INTEGER,
  geo_data TEXT,
  economic_score DECIMAL(3,1),
  social_score DECIMAL(3,1)
);

-- Create elections table
CREATE TABLE IF NOT EXISTS elections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  date TIMESTAMP NOT NULL,
  type VARCHAR(50) NOT NULL,
  turnout DECIMAL(5,2),
  description TEXT
);

-- Create election_results table
CREATE TABLE IF NOT EXISTS election_results (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id),
  constituency_id INTEGER NOT NULL REFERENCES constituencies(id),
  party_id INTEGER NOT NULL REFERENCES parties(id),
  votes INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  seats INTEGER NOT NULL,
  first_preference INTEGER
);

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  party_id INTEGER REFERENCES parties(id),
  constituency_id INTEGER REFERENCES constituencies(id),
  election_id INTEGER REFERENCES elections(id),
  elected VARCHAR(5) DEFAULT 'false',
  votes INTEGER,
  position INTEGER
);