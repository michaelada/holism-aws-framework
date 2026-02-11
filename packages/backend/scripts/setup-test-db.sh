#!/bin/bash

# Script to create and initialize the test database
# Run this before running tests for the first time

set -e

echo "🔧 Setting up test database..."

# Database configuration
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:-framework_user}"
DB_PASSWORD="${DATABASE_PASSWORD:-framework_password}"
DB_NAME="aws_framework_test"

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on $DB_HOST:$DB_PORT"
    echo "   Please start PostgreSQL first (e.g., docker-compose up -d postgres)"
    exit 1
fi

echo "✓ PostgreSQL is running"

# Create test database if it doesn't exist
echo "📦 Creating test database '$DB_NAME'..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"

echo "✓ Test database created"

# Initialize schema using infrastructure SQL
echo "🔄 Initializing test database schema..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'EOF'
-- Field Definitions table
CREATE TABLE IF NOT EXISTS field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  datatype VARCHAR(50) NOT NULL,
  datatype_properties JSONB DEFAULT '{}',
  validation_rules JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_field_definitions_short_name ON field_definitions(short_name);

-- Object Definitions table
CREATE TABLE IF NOT EXISTS object_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  display_properties JSONB DEFAULT '{}',
  wizard_config JSONB,
  field_groups JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_object_definitions_short_name ON object_definitions(short_name);

-- Object Fields relationship table
CREATE TABLE IF NOT EXISTS object_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id UUID NOT NULL REFERENCES object_definitions(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES field_definitions(id) ON DELETE RESTRICT,
  mandatory BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL,
  in_table BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(object_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_object_fields_object_id ON object_fields(object_id);
CREATE INDEX IF NOT EXISTS idx_object_fields_field_id ON object_fields(field_id);

EOF

echo "✓ Schema initialized"

echo ""
echo "✅ Test database setup complete!"
echo ""
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   User: $DB_USER"
echo ""
echo "You can now run tests with: npm test"
echo ""
