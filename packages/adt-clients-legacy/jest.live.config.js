// Live suites against a 7.40 system: src/__tests__/integration/legacy/** and
// the test-environment admin scripts in src/__tests__/admin/legacy-env/**.
// The harness (globalSetup/globalTeardown, session helpers) is the root
// package's, by relative path: test-only source in this repository, never
// published; this package's wrappers register the legacy test configuration
// before it runs. Sequential, long timeouts, admin excluded unless a legacy:*
// script replaces the ignore patterns.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  globalSetup: '<rootDir>/src/__tests__/helpers/legacyGlobalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/helpers/legacyGlobalTeardown.ts',
  setupFiles: ['<rootDir>/src/__tests__/helpers/legacySetup.ts'],
  testMatch: [
    '<rootDir>/src/__tests__/integration/legacy/**/*.test.ts',
    '<rootDir>/src/__tests__/admin/legacy-env/**/*.test.ts',
  ],
  testTimeout: 900000,
  forceExit: true,
  silent: false,
  verbose: false,
  // As jest.unit.config.js: the type check's tsconfig, and the root
  // package's source for its entry point.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@mcp-abap-adt/adt-clients$': '<rootDir>/../adt-clients/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/admin/'],
  maxWorkers: 1,
  maxConcurrency: 1,
};
