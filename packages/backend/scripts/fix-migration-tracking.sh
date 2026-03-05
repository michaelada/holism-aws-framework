#!/bin/bash

# Fix Migration Tracking Script
# This script connects to the Docker PostgreSQL container and fixes the migration tracking

echo "Connecting to PostgreSQL container to fix migration tracking..."

docker exec -i aws-framework-postgres psql -U framework_user -d aws_framework <<EOF
-- Check if the table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_onboarding_preferences'
) AS table_exists;

-- Manually mark migration #23 as completed
INSERT INTO pgmigrations (name, run_on)
VALUES ('1707000000023_create-onboarding-preferences-table', NOW())
ON CONFLICT (name) DO NOTHING;

-- Verify the migration is now tracked
SELECT * FROM pgmigrations 
WHERE name = '1707000000023_create-onboarding-preferences-table';

-- Show all migrations
SELECT name, run_on FROM pgmigrations ORDER BY run_on;
EOF

echo ""
echo "Migration tracking fixed! You can now run: npm run migrate:up"
