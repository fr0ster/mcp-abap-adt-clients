#!/usr/bin/env node

/**
 * Script to run tests for a specific module (object type)
 *
 * Usage:
 *   node scripts/test-module.js class
 *   node scripts/test-module.js domain
 *   node scripts/test-module.js functionModule
 *
 * This allows testing one module at a time without running all tests,
 * which is important when test coverage is incomplete.
 */

const { spawn } = require('child_process');
const path = require('path');

const moduleName = process.argv[2];

if (!moduleName) {
  console.error('Usage: node scripts/test-module.js <module-name>');
  console.error('');
  console.error('Available modules:');
  console.error('  - class');
  console.error('  - domain');
  console.error('  - dataElement');
  console.error('  - program');
  console.error('  - interface');
  console.error('  - functionGroup');
  console.error('  - functionModule');
  console.error('  - structure');
  console.error('  - table');
  console.error('  - view');
  console.error('  - package');
  console.error('  - transport');
  console.error('  - shared');
  process.exit(1);
}

// Map module names to test patterns
const modulePatterns = {
  class: 'class',
  domain: 'domain',
  dataElement: 'dataElement',
  program: 'program',
  interface: 'interface',
  functionGroup: 'functionGroup',
  functionModule: 'functionModule',
  structure: 'structure',
  table: 'table',
  view: 'view',
  package: 'package',
  transport: 'transport',
  shared: 'shared'
};

const testPattern = modulePatterns[moduleName];

if (!testPattern) {
  console.error(`Unknown module: ${moduleName}`);
  console.error('Available modules:', Object.keys(modulePatterns).join(', '));
  process.exit(1);
}

console.log(`Running tests for module: ${moduleName}`);
console.log(`Test pattern: ${testPattern}`);
console.log('');

// Run jest with the module pattern
const jestProcess = spawn('npm', ['test', '--', testPattern], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

jestProcess.on('close', (code) => {
  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});

