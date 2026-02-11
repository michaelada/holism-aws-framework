# Test Database Setup

## Problem

Previously, running tests would delete all data from the development database (`aws_framework`), including manually created field definitions, object definitions, and instances. This made it impossible to maintain test data while developing.

## Solution

Tests now use a separate test database (`aws_framework_test`) that is completely isolated from the development database.

## Changes Made

### 1. Test Environment Configuration

**File**: `packages/backend/.env.test`
- Created dedicated test environment file
- Configures `DATABASE_NAME=aws_framework_test`
- Sets `NODE_ENV=test`
- Uses different ports to avoid conflicts

### 2. Jest Configuration

**File**: `packages/backend/jest.config.js`
- Added `setupFilesAfterEnv` to load test environment
- Ensures `NODE_ENV=test` before tests run
- Loads `.env.test` file automatically

### 3. Test Setup File

**File**: `packages/backend/src/__tests__/jest.setup.ts`
- Loads `.env.test` before any tests run
- Sets `NODE_ENV=test`
- Logs which database is being used
- Warns if accidentally using development database

### 4. Database Setup Script

**File**: `packages/backend/scripts/setup-test-db.sh`
- Creates `aws_framework_test` database
- Runs migrations on test database
- Can be run anytime to reset test database

## How It Works

### Database Selection Logic

The `getDatabaseConfig()` function in `packages/backend/src/config/database.config.ts` already had logic to use different databases based on `NODE_ENV`:

```typescript
case 'test':
  return {
    ...baseConfig,
    database: process.env.DATABASE_NAME || 'aws_framework_test',
    max: 5, // Small pool for testing
  };
```

Now that Jest properly sets `NODE_ENV=test`, this logic is activated.

### Test Isolation

Each test file that uses the database:
1. Connects to `aws_framework_test` (not `aws_framework`)
2. Can safely delete/truncate tables
3. Development data remains untouched

## Setup Instructions

### First Time Setup

1. **Create the test database**:
   ```bash
   cd packages/backend
   chmod +x scripts/setup-test-db.sh
   ./scripts/setup-test-db.sh
   ```

   Or manually:
   ```bash
   psql -U framework_user -d postgres -c "CREATE DATABASE aws_framework_test"
   ```

2. **Run migrations on test database** (if you have migrations):
   ```bash
   export DATABASE_NAME=aws_framework_test
   export NODE_ENV=test
   node migrations/1707000000000_create-metadata-tables.js
   node migrations/1707000000001_remove-field-mandatory.js
   ```

### Running Tests

Simply run tests as normal:

```bash
npm test
```

The test setup will automatically:
- Load `.env.test`
- Set `NODE_ENV=test`
- Connect to `aws_framework_test`
- Log which database is being used

### Resetting Test Database

If your test database gets into a bad state:

```bash
# Drop and recreate
psql -U framework_user -d postgres -c "DROP DATABASE IF EXISTS aws_framework_test"
./scripts/setup-test-db.sh

# Or just truncate tables
psql -U framework_user -d aws_framework_test -c "TRUNCATE field_definitions, object_definitions, object_fields CASCADE"
```

## Verification

### Check Which Database Tests Use

When you run tests, you'll see:

```
🧪 Running tests against database: aws_framework_test
```

If you see `aws_framework` instead, something is wrong!

### Verify Databases Are Separate

```bash
# List databases
psql -U framework_user -d postgres -c "\l"

# You should see both:
# - aws_framework (development)
# - aws_framework_test (testing)
```

### Check Development Data Is Safe

```bash
# Check development database
psql -U framework_user -d aws_framework -c "SELECT COUNT(*) FROM field_definitions"

# Run tests
npm test

# Check again - count should be the same
psql -U framework_user -d aws_framework -c "SELECT COUNT(*) FROM field_definitions"
```

## Database Comparison

| Database | Purpose | Data Persistence | Used By |
|----------|---------|------------------|---------|
| `aws_framework` | Development | Persistent | Local dev server, manual testing |
| `aws_framework_test` | Testing | Cleared between tests | Jest tests, CI/CD |

## CI/CD Considerations

In CI/CD pipelines, ensure:

1. **Test database is created** before running tests:
   ```yaml
   - name: Setup test database
     run: |
       psql -U postgres -c "CREATE DATABASE aws_framework_test"
   ```

2. **Environment variables are set**:
   ```yaml
   env:
     NODE_ENV: test
     DATABASE_NAME: aws_framework_test
   ```

3. **Migrations are run** on test database:
   ```yaml
   - name: Run migrations
     run: npm run migrate
     env:
       DATABASE_NAME: aws_framework_test
   ```

## Troubleshooting

### Tests Still Using Development Database

**Symptom**: Tests delete your development data

**Solution**:
1. Check that `.env.test` exists and has `DATABASE_NAME=aws_framework_test`
2. Verify Jest config has `setupFilesAfterEnv` pointing to setup file
3. Check console output shows correct database name
4. Ensure `NODE_ENV=test` is set

### Test Database Doesn't Exist

**Symptom**: Tests fail with "database does not exist"

**Solution**:
```bash
./scripts/setup-test-db.sh
```

### Permission Denied on Script

**Symptom**: `./scripts/setup-test-db.sh: Permission denied`

**Solution**:
```bash
chmod +x packages/backend/scripts/setup-test-db.sh
```

### Tables Don't Exist in Test Database

**Symptom**: Tests fail with "relation does not exist"

**Solution**:
Run migrations on test database:
```bash
export DATABASE_NAME=aws_framework_test
export NODE_ENV=test
# Run your migration scripts
```

## Best Practices

### 1. Always Use Test Database for Tests

Never set `DATABASE_NAME=aws_framework` in test files or `.env.test`.

### 2. Clean Up Test Data

Tests should clean up after themselves:

```typescript
afterEach(async () => {
  // Clean up test data
  await db.query('DELETE FROM object_definitions WHERE short_name LIKE $1', ['test_%']);
  await db.query('DELETE FROM field_definitions WHERE short_name LIKE $1', ['test_%']);
});
```

### 3. Use Test Prefixes

Prefix test data with `test_` or `pbt_` to make it easy to identify and clean up:

```typescript
const testField = await metadataService.createField({
  shortName: 'test_email',  // ← prefix with 'test_'
  displayName: 'Email',
  // ...
});
```

### 4. Isolate Test Data

Each test should create its own data and not depend on data from other tests.

### 5. Reset Between Test Runs

Consider adding a script to reset the test database:

```json
{
  "scripts": {
    "test:reset": "psql -U framework_user -d aws_framework_test -c 'TRUNCATE field_definitions, object_definitions, object_fields CASCADE'",
    "test": "npm run test:reset && jest"
  }
}
```

## Summary

✅ **Development database** (`aws_framework`) - Your data is safe
✅ **Test database** (`aws_framework_test`) - Used exclusively for tests
✅ **Automatic switching** - Jest setup handles database selection
✅ **Clear logging** - Console shows which database is being used
✅ **Easy setup** - One script creates and initializes test database

Your development data will no longer be deleted when running tests!
