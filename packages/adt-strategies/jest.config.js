// No globalSetup: nothing here talks to SAP. Every test reads the recorded
// answers in `corpus/adt/`, which is the whole point — a strategy is judged
// against what the server actually sent, not against a live system's mood.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  testTimeout: 15000,
};
