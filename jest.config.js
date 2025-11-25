module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.[tj]s',
    '**/*.test.[tj]s',
    '**/__tests__/**/*.integration.test.[tj]s',
    '!**/**/index.test.[tj]s', // No tests for index.ts files
  ],
  testTimeout: 300000, // 5 minutes - allows for long-running integration tests (CDS unit tests can take 2+ minutes)
  forceExit: true,
  silent: false, // Show test output
  verbose: false, // Don't show individual test names unless failed
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.ts', // Exclude index.ts files that only re-export
    '!src/index.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/e2e/', // E2E tests should be run separately
  ],
  // Force sequential execution for all tests (single worker, no parallelism)
  // Integration tests MUST run sequentially to avoid conflicts with shared SAP objects
  maxWorkers: 1,
  maxConcurrency: 1, // Only run 1 test suite at a time
};

