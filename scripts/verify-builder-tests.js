#!/usr/bin/env node
/**
 * Verification script for Builder tests
 *
 * Checks:
 * - All Builder tests have exactly 2 tests (or 1 for special cases)
 * - Test 1: Full workflow (validate → create → check → lock → update → check → unlock → activate → check)
 * - Test 2: Read standard object
 * - Test 3: Read transport request (optional, only if transport_request configured)
 * - All parameters from YAML (no hardcoded values)
 * - No fallbacks to getDefaultPackage()/getDefaultTransport()
 *
 * Usage:
 *   node scripts/verify-builder-tests.js
 */

const fs = require('fs');
const path = require('path');

const TEST_DIR = path.resolve(__dirname, '../src/__tests__/integration');
const YAML_CONFIG = path.resolve(__dirname, '../tests/test-config.yaml');

// Special cases: Builders with only 1 test
const SINGLE_TEST_BUILDERS = ['TransportBuilder', 'ViewBuilder'];

// Expected test patterns
const FULL_WORKFLOW_PATTERNS = [
  /full workflow/i,
  /workflow/i,
  /complete workflow/i
];

const READ_STANDARD_PATTERNS = [
  /read standard/i,
  /read.*standard/i
];

const READ_TRANSPORT_PATTERNS = [
  /read transport/i,
  /transport request/i
];

// Forbidden patterns (hardcoded values)
const FORBIDDEN_PATTERNS = [
  /getDefaultPackage\(\)/,
  /getDefaultTransport\(\)/,
  /'Z[A-Z_]+'/,  // Hardcoded Z* names (but allow in comments)
  /"Z[A-Z_]+"/,  // Hardcoded Z* names in double quotes
];

function findBuilderTestFiles() {
  const files = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('Builder.test.ts')) {
        files.push(fullPath);
      }
    }
  }

  walkDir(TEST_DIR);
  return files;
}

function extractTestCases(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const testCases = [];
  let currentTest = null;
  let inDescribe = false;
  let inIt = false;
  let describeName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find describe block
    if (line.match(/describe\(['"]([^'"]+)['"]/)) {
      const match = line.match(/describe\(['"]([^'"]+)['"]/);
      describeName = match[1];
      inDescribe = true;
    }

    // Find it/test block
    if (line.match(/(it|test)\(['"]([^'"]+)['"]/)) {
      const match = line.match(/(it|test)\(['"]([^'"]+)['"]/);
      if (currentTest) {
        testCases.push(currentTest);
      }
      currentTest = {
        name: match[2],
        line: i + 1,
        describe: describeName,
        file: path.basename(filePath)
      };
      inIt = true;
    }

    // Check for forbidden patterns
    if (currentTest && !currentTest.forbidden) {
      for (const pattern of FORBIDDEN_PATTERNS) {
        // Skip if in comment
        const commentIndex = line.indexOf('//');
        const codePart = commentIndex >= 0 ? line.substring(0, commentIndex) : line;

        if (pattern.test(codePart)) {
          currentTest.forbidden = {
            pattern: pattern.toString(),
            line: i + 1,
            code: line.trim()
          };
          break;
        }
      }
    }
  }

  if (currentTest) {
    testCases.push(currentTest);
  }

  return testCases;
}

function classifyTest(testName) {
  const name = testName.toLowerCase();

  if (FULL_WORKFLOW_PATTERNS.some(p => p.test(name))) {
    return 'workflow';
  }
  if (READ_STANDARD_PATTERNS.some(p => p.test(name))) {
    return 'read_standard';
  }
  if (READ_TRANSPORT_PATTERNS.some(p => p.test(name))) {
    return 'read_transport';
  }

  return 'unknown';
}

function verifyBuilderTest(filePath) {
  const fileName = path.basename(filePath);
  const builderName = fileName.replace('.test.ts', '');
  const isSingleTest = SINGLE_TEST_BUILDERS.includes(builderName);

  const testCases = extractTestCases(filePath);
  const classified = testCases.map(t => ({
    ...t,
    type: classifyTest(t.name)
  }));

  const workflowTests = classified.filter(t => t.type === 'workflow');
  const readStandardTests = classified.filter(t => t.type === 'read_standard');
  const readTransportTests = classified.filter(t => t.type === 'read_transport');
  const unknownTests = classified.filter(t => t.type === 'unknown');

  const issues = [];

  // Check test count
  if (isSingleTest) {
    if (testCases.length !== 1) {
      issues.push({
        severity: 'error',
        message: `Expected 1 test for ${builderName}, found ${testCases.length}`
      });
    }
  } else {
    const expectedCount = 3; // Full workflow + Read standard + Read transport
    if (testCases.length < 2) {
      issues.push({
        severity: 'error',
        message: `Expected at least 2 tests for ${builderName}, found ${testCases.length}`
      });
    } else if (testCases.length > 3) {
      issues.push({
        severity: 'warning',
        message: `Expected 2-3 tests for ${builderName}, found ${testCases.length}`
      });
    }
  }

  // Check for required test types
  if (!isSingleTest) {
    if (workflowTests.length === 0) {
      issues.push({
        severity: 'error',
        message: `Missing full workflow test in ${builderName}`
      });
    }
    if (readStandardTests.length === 0) {
      issues.push({
        severity: 'error',
        message: `Missing read standard object test in ${builderName}`
      });
    }
    // Read transport is optional (only if transport_request configured)
  }

  // Check for forbidden patterns
  const forbiddenTests = classified.filter(t => t.forbidden);
  for (const test of forbiddenTests) {
    issues.push({
      severity: 'error',
      message: `Forbidden pattern found in ${builderName} test "${test.name}" (line ${test.forbidden.line}): ${test.forbidden.pattern}`,
      code: test.forbidden.code
    });
  }

  // Check for unknown tests
  if (unknownTests.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Unknown test pattern(s) in ${builderName}: ${unknownTests.map(t => `"${t.name}"`).join(', ')}`
    });
  }

  return {
    builder: builderName,
    file: fileName,
    testCount: testCases.length,
    expectedCount: isSingleTest ? 1 : 3,
    workflowTests: workflowTests.length,
    readStandardTests: readStandardTests.length,
    readTransportTests: readTransportTests.length,
    unknownTests: unknownTests.length,
    issues,
    tests: classified
  };
}

function verifyYamlConfig() {
  if (!fs.existsSync(YAML_CONFIG)) {
    return {
      valid: false,
      issues: [{
        severity: 'error',
        message: `YAML config file not found: ${YAML_CONFIG}`
      }]
    };
  }

  const content = fs.readFileSync(YAML_CONFIG, 'utf8');
  const issues = [];

  // Check for environment section
  if (!content.includes('environment:')) {
    issues.push({
      severity: 'warning',
      message: 'Missing "environment:" section in YAML config'
    });
  }

  // Check for standard_objects section
  if (!content.includes('standard_objects:')) {
    issues.push({
      severity: 'warning',
      message: 'Missing "standard_objects:" section in YAML config'
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function main() {
  console.log('🔍 Verifying Builder tests...\n');

  const testFiles = findBuilderTestFiles();
  console.log(`Found ${testFiles.length} Builder test files\n`);

  const results = testFiles.map(verifyBuilderTest);
  const yamlResult = verifyYamlConfig();

  let totalIssues = 0;
  let errorCount = 0;
  let warningCount = 0;

  // Print results
  for (const result of results) {
    const status = result.issues.length === 0 ? '✅' : '❌';
    console.log(`${status} ${result.builder}`);
    console.log(`   Tests: ${result.testCount} (expected: ${result.expectedCount})`);
    console.log(`   - Workflow: ${result.workflowTests}`);
    console.log(`   - Read standard: ${result.readStandardTests}`);
    console.log(`   - Read transport: ${result.readTransportTests}`);
    if (result.unknownTests > 0) {
      console.log(`   - Unknown: ${result.unknownTests}`);
    }

    if (result.issues.length > 0) {
      console.log(`   Issues:`);
      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`   ${icon} ${issue.message}`);
        if (issue.code) {
          console.log(`      Code: ${issue.code}`);
        }
        if (issue.severity === 'error') {
          errorCount++;
        } else {
          warningCount++;
        }
        totalIssues++;
      }
    }
    console.log();
  }

  // YAML config verification
  console.log('📋 YAML Configuration:');
  if (yamlResult.valid) {
    console.log('✅ YAML config structure is valid\n');
  } else {
    console.log('⚠️ YAML config issues:\n');
    for (const issue of yamlResult.issues) {
      console.log(`   ${issue.severity === 'error' ? '❌' : '⚠️'} ${issue.message}`);
      if (issue.severity === 'error') {
        errorCount++;
      } else {
        warningCount++;
      }
      totalIssues++;
    }
    console.log();
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   Total Builder tests: ${results.length}`);
  console.log(`   Total issues: ${totalIssues}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Warnings: ${warningCount}`);

  if (totalIssues === 0) {
    console.log('\n✅ All Builder tests comply with the pattern!');
    process.exit(0);
  } else {
    console.log(`\n❌ Found ${totalIssues} issue(s) that need to be fixed.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyBuilderTest, findBuilderTestFiles, classifyTest };

