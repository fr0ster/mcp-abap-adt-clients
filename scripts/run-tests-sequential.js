#!/usr/bin/env node

/**
 * Run test groups sequentially to avoid resource conflicts (same SAP objects),
 * but allow parallel execution within each group for better performance.
 *
 * Usage: node scripts/run-tests-sequential.js
 */

const { execSync } = require('child_process');

const testGroups = [
  'class',
  'domain',
  'dataElement',
  'interface',
  'program',
  'table',
  'structure',
  'view',
  'package',
  'functionGroup',
  'functionModule',
  'transport',
  'shared',
  'e2e', // Lock recovery and advanced scenarios
];

let totalPassed = 0;
let totalFailed = 0;
let failedGroups = [];

console.log('🚀 Running test groups sequentially...\n');

for (const group of testGroups) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Running ${group} tests...`);
  console.log('='.repeat(60));

  try {
    // Run tests for this group with parallel execution within the group
    // E2E tests are directly in e2e/ folder, others are in integration/
    const testPath = group === 'e2e' ? 'e2e' : `integration/${group}`;
    const result = execSync(
      `npm test -- ${testPath}`,
      {
        stdio: 'inherit',
        encoding: 'utf-8',
      }
    );    console.log(`✅ ${group} tests completed successfully`);
    totalPassed++;
  } catch (error) {
    console.error(`❌ ${group} tests failed`);
    totalFailed++;
    failedGroups.push(group);
    // Continue with next group even if this one failed
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`✅ Passed groups: ${totalPassed}/${testGroups.length}`);
console.log(`❌ Failed groups: ${totalFailed}/${testGroups.length}`);

if (failedGroups.length > 0) {
  console.log(`\nFailed groups: ${failedGroups.join(', ')}`);
  process.exit(1);
} else {
  console.log('\n🎉 All test groups passed!');
  process.exit(0);
}
