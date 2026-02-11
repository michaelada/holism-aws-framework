/**
 * Jest setup file - runs before all tests
 * Configures test environment to use separate test database
 */

const { config } = require('dotenv');
const path = require('path');

// Load test environment variables
const testEnvPath = path.resolve(__dirname, '../../.env.test');
config({ path: testEnvPath });

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test';

// Log database being used (for debugging)
console.log(`\n🧪 Running tests against database: ${process.env.DATABASE_NAME}\n`);

// Warn if using production database
if (process.env.DATABASE_NAME === 'aws_framework' && process.env.NODE_ENV === 'test') {
  console.warn('⚠️  WARNING: Tests are configured to use development database!');
  console.warn('⚠️  This will delete data. Please use aws_framework_test database.\n');
}
