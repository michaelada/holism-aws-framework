module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // `scripts` as well as `src`: the demo seed's date arithmetic decides whether
  // the fixture still reaches its intended states a year from now, which is
  // precisely the thing that cannot be checked by running the seed today.
  roots: ['<rootDir>/src', '<rootDir>/scripts'],
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
    '^isomorphic-dompurify$': '<rootDir>/__mocks__/isomorphic-dompurify.js',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(isomorphic-dompurify|@exodus/bytes|html-encoding-sniffer|whatwg-encoding|jsdom)/)',
  ],
  // Set up test environment before running tests
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.js'],
  // Run tests sequentially to avoid database conflicts
  maxWorkers: 1,
  // Force exit after tests complete to avoid hanging on open handles
  forceExit: true,
};
