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
    /*
     * `exceljs` is deliberately absent from this list.
     *
     * It used to be mapped to a stand-in shaped to satisfy both a default and a
     * named import — so nothing could notice that the real module has **no
     * default export at all**. `new ExcelJS()` threw "is not a constructor" in
     * production while every export test passed, and all five Excel exports in
     * the application produced files the operating system refuses to open.
     *
     * The library is fast and pure. Running it for real is what lets a test
     * assert on the bytes.
     */
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
