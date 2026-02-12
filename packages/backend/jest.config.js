module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^exceljs$': '<rootDir>/__mocks__/exceljs.js',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // Set up test environment before running tests
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.js'],
  // Run tests sequentially to avoid database conflicts
  maxWorkers: 1,
  // Force exit after tests complete to avoid hanging on open handles
  forceExit: true,
};
