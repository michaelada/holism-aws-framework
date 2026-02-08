# Database Module

This module provides database connection pooling and utilities for the AWS Web Application Framework backend.

## Overview

The database module uses PostgreSQL with connection pooling via `pg-pool`. It provides:

- Singleton connection pool management
- Environment-based configuration
- Transaction support
- Query utilities
- Health checks
- Performance monitoring

## Usage

### Initializing the Database

```typescript
import { db } from './database';

// Initialize the connection pool (typically in app startup)
await db.initialize();

// Check if database is healthy
const healthy = await db.isHealthy();
console.log('Database healthy:', healthy);
```

### Executing Queries

```typescript
import { db } from './database';

// Simple query
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
console.log(result.rows);

// Query with no parameters
const allUsers = await db.query('SELECT * FROM users');
```

### Using Transactions

```typescript
import { withTransaction } from './database';

// Execute multiple operations in a transaction
const result = await withTransaction(async (client) => {
  await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice']);
  await client.query('INSERT INTO profiles (user_id, bio) VALUES ($1, $2)', [userId, 'Bio']);
  return { success: true };
});
```

### Checking Table Existence

```typescript
import { tableExists } from './database';

const exists = await tableExists('users');
if (!exists) {
  console.log('Users table does not exist');
}
```

### Getting Table Columns

```typescript
import { getTableColumns } from './database';

const columns = await getTableColumns('users');
console.log('User table columns:', columns);
// Output: ['id', 'name', 'email', 'created_at', ...]
```

### Building Parameterized Queries

```typescript
import { buildParameterizedQuery } from './database';

const { text, values } = buildParameterizedQuery(
  'SELECT * FROM users WHERE name = :name AND age > :age',
  { name: 'Alice', age: 25 }
);

// text: 'SELECT * FROM users WHERE name = $1 AND age > $2'
// values: ['Alice', 25]

const result = await db.query(text, values);
```

### Pool Statistics

```typescript
import { db } from './database';

const stats = db.getStats();
console.log('Pool stats:', stats);
// Output: { totalCount: 20, idleCount: 15, waitingCount: 0, isConnected: true }
```

### Closing the Pool

```typescript
import { db } from './database';

// Close all connections (typically in app shutdown)
await db.close();
```

## Configuration

Database configuration is managed through environment variables:

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=aws_framework
DATABASE_USER=framework_user
DATABASE_PASSWORD=framework_password
NODE_ENV=development
```

### Environment-Specific Settings

The module automatically adjusts pool settings based on `NODE_ENV`:

**Development:**
- Pool size: 20 connections
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

**Staging:**
- Pool size: 30 connections
- Idle timeout: 45 seconds
- Connection timeout: 3 seconds

**Production:**
- Pool size: 50 connections
- Idle timeout: 60 seconds
- Connection timeout: 5 seconds

**Test:**
- Pool size: 5 connections
- Idle timeout: 10 seconds
- Connection timeout: 1 second
- Database: `aws_framework_test`

## Error Handling

The module provides comprehensive error handling:

```typescript
try {
  await db.query('SELECT * FROM invalid_table');
} catch (error) {
  // Error is logged automatically with query details
  console.error('Query failed:', error);
}
```

### Slow Query Detection

Queries taking longer than 1000ms are automatically logged:

```
Slow query detected (1234ms): {
  text: 'SELECT * FROM large_table',
  duration: 1234,
  rows: 10000
}
```

## Health Checks

Use the health check for monitoring:

```typescript
import { db } from './database';

// In your health check endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await db.isHealthy();
  
  res.json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    database: dbHealthy ? 'connected' : 'disconnected'
  });
});
```

## Best Practices

1. **Initialize once** - Call `db.initialize()` once during application startup
2. **Use transactions** - Use `withTransaction()` for multi-step operations
3. **Parameterize queries** - Always use parameterized queries to prevent SQL injection
4. **Monitor performance** - Watch for slow query warnings in logs
5. **Handle errors** - Always wrap database calls in try-catch blocks
6. **Close gracefully** - Call `db.close()` during application shutdown

## Testing

The module includes comprehensive unit tests. Run them with:

```bash
npm test
```

Tests cover:
- Configuration validation
- Connection pooling
- Query execution
- Transaction handling
- Error scenarios
- Health checks

## Architecture

```
database/
├── pool.ts           # Connection pool singleton
├── utils.ts          # Utility functions
├── index.ts          # Public exports
├── pool.test.ts      # Pool tests
├── utils.test.ts     # Utility tests
└── README.md         # This file

config/
└── database.config.ts # Configuration management
```

## Dependencies

- `pg` - PostgreSQL client
- `pg-pool` - Connection pooling
- `dotenv` - Environment variable management
