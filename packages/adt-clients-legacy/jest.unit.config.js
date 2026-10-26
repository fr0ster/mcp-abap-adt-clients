// Unit tests only: nothing here talks to SAP, so no globalSetup and the
// default timeout. This is what CI runs. The live suites are jest.live.config.js.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/integration/',
    '/src/__tests__/admin/',
  ],
  // What the legacy classes bring to the root harness, in every file: the
  // header pairs and refusals, and the legacy test configuration.
  setupFiles: ['<rootDir>/src/__tests__/helpers/legacySetup.ts'],
  // ts-jest compiles with the type check's tsconfig, so a suite and the root
  // harness it imports by relative path compile here as `test:check` checks
  // them (rootDir `..`), not under the build's rootDir `src`.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // The root package's source, as in tsconfig.test.json's `paths`: one
  // AdtClient for the harness and the package under test.
  moduleNameMapper: {
    '^@mcp-abap-adt/adt-clients$': '<rootDir>/../adt-clients/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
