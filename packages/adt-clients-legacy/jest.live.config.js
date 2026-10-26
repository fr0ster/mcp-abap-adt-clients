// Live suites against a 7.40 system: src/__tests__/integration/legacy/** and
// the test-environment admin scripts in src/__tests__/admin/legacy-env/**.
// The harness (globalSetup/globalTeardown, session helpers) is the root
// package's, by relative path: test-only source in this repository, never
// published. Sequential, long timeouts, admin excluded unless a legacy:*
// script replaces the ignore patterns.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  globalSetup: '<rootDir>/../adt-clients/src/__tests__/helpers/globalSetup.ts',
  globalTeardown:
    '<rootDir>/../adt-clients/src/__tests__/helpers/globalTeardown.ts',
  testMatch: [
    '<rootDir>/src/__tests__/integration/legacy/**/*.test.ts',
    '<rootDir>/src/__tests__/admin/legacy-env/**/*.test.ts',
  ],
  testTimeout: 900000,
  forceExit: true,
  silent: false,
  verbose: false,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/admin/'],
  maxWorkers: 1,
  maxConcurrency: 1,
};
