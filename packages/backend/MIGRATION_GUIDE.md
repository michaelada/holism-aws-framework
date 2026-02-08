# Database Migration Guide

This guide explains how to use the database migration system for the AWS Web Application Framework.

## Prerequisites

- PostgreSQL database running (via Docker Compose or standalone)
- Environment variables configured (see `.env.example`)

## Migration Commands

### Run Migrations

To apply all pending migrations:

```bash
npm run migrate:up
```

### Rollback Migrations

To rollback the last migration:

```bash
npm run migrate:down
```

### Create New Migration

To create a new migration file:

```bash
npm run migrate:create <migration-name>
```

Example:
```bash
npm run migrate:create add-user-table
```

## Environment Configuration

The migration system uses the following environment variables:

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=aws_framework
DATABASE_USER=framework_user
DATABASE_PASSWORD=framework_password
```

These can be set in a `.env` file in the `packages/backend` directory.

## Initial Migration

The initial migration (`1707000000000_create-metadata-tables.ts`) creates the following tables:

### field_definitions
Stores reusable field definitions that can be used across multiple objects.

**Columns:**
- `id` (UUID, Primary Key)
- `short_name` (VARCHAR, Unique) - Internal identifier
- `display_name` (VARCHAR) - User-facing label
- `description` (TEXT) - Help text
- `datatype` (VARCHAR) - Field data type
- `datatype_properties` (JSONB) - Type-specific configuration
- `validation_rules` (JSONB) - Validation rules array
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### object_definitions
Stores object definitions that describe application entities.

**Columns:**
- `id` (UUID, Primary Key)
- `short_name` (VARCHAR, Unique) - Internal identifier
- `display_name` (VARCHAR) - User-facing label
- `description` (TEXT) - Description
- `display_properties` (JSONB) - Display configuration
- `wizard_config` (JSONB) - Optional wizard configuration
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### object_fields
Stores relationships between objects and fields.

**Columns:**
- `id` (UUID, Primary Key)
- `object_id` (UUID, Foreign Key to object_definitions)
- `field_id` (UUID, Foreign Key to field_definitions)
- `mandatory` (BOOLEAN) - Whether field is required
- `display_order` (INTEGER) - Display order in forms
- `created_at` (TIMESTAMP)

**Constraints:**
- Unique constraint on (object_id, field_id)
- CASCADE delete on object_id
- RESTRICT delete on field_id

## Running Migrations with Docker

If using Docker Compose for local development:

1. Start the database:
   ```bash
   docker-compose up -d postgres
   ```

2. Wait for the database to be ready:
   ```bash
   docker-compose logs -f postgres
   ```

3. Run migrations:
   ```bash
   cd packages/backend
   npm run migrate:up
   ```

## Verifying Migrations

To verify that migrations have been applied:

```sql
-- Connect to the database
psql -h localhost -U framework_user -d aws_framework

-- Check migration status
SELECT * FROM pgmigrations ORDER BY run_on DESC;

-- List all tables
\dt

-- Describe a specific table
\d field_definitions
```

## Troubleshooting

### Connection Refused

If you get a connection refused error:
- Ensure PostgreSQL is running
- Check that the port (5432) is not blocked
- Verify environment variables are correct

### Migration Already Applied

If a migration has already been applied, it will be skipped automatically.

### Rollback Failed

If a rollback fails:
- Check the migration's `down()` function
- Ensure no data dependencies exist
- Manually fix the database state if necessary

## Best Practices

1. **Always test migrations** in development before applying to staging/production
2. **Write reversible migrations** - ensure the `down()` function properly undoes the `up()` function
3. **Use transactions** - migrations are automatically wrapped in transactions
4. **Backup before migrating** in production environments
5. **Version control** - commit migration files to git
