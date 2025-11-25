#!/bin/bash

# This script runs the database migration and updates the party dimension data

echo "Setting up party dimension scoring system..."

# 1. Run the database migration to add party dimension columns
echo "Running database migration to add party dimension columns..."
npm run tsx -- migrations/add_party_dimensions.ts

# 2. Run the script to update party dimensions
echo "Updating party dimension data..."
npm run tsx -- scripts/update_party_dimensions.ts

echo "Party dimension setup complete!"