module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.[tj]s',
    '**/*.test.[tj]s',
    '**/__tests__/**/*.integration.test.[tj]s',
  ],
  testTimeout: 30000,
  forceExit: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  // Separate unit and integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
};

