module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.[tj]s',
    '**/*.test.[tj]s',
    '**/__tests__/**/*.integration.test.[tj]s',
    '!**/**/index.test.[tj]s', // No tests for index.ts files
  ],
  testTimeout: 30000,
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
  ],
  // Force sequential execution for integration tests (--runInBand in package.json)
  // Integration tests must run sequentially to avoid conflicts with shared SAP objects
  maxWorkers: 1,
};

