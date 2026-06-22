module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // No globalSetup for unit tests
  testMatch: ['**/__tests__/unit/**/*.test.[tj]s'],
  testTimeout: 30000,
  forceExit: true,
  silent: false,
  verbose: false,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['<rootDir>/src'],
  maxWorkers: 1,
  maxConcurrency: 1,
};
