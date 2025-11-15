/**
 * Test configuration helper for @mcp-abap-adt/adt-clients
 * Loads test parameters from test-config.yaml
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const dotenv = require('dotenv');

/**
 * Load environment variables from .env file (quiet mode - no console output)
 */
function loadTestEnv() {
  const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    // Suppress dotenv console.log output
    const originalLog = console.log;
    console.log = () => {}; // Temporarily disable console.log
    dotenv.config({ path: envPath });
    console.log = originalLog; // Restore console.log
  }
}

/**
 * Load test configuration from YAML
 */
function loadTestConfig() {
  const configPath = path.resolve(__dirname, 'test-config.yaml');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Test configuration file not found: test-config.yaml');
    console.error('Please create tests/test-config.yaml with test parameters');
    process.exit(1);
  }

  const configContent = fs.readFileSync(configPath, 'utf8');
  return yaml.parse(configContent);
}

/**
 * Get enabled test case from config (returns first enabled or by name)
 * @param {string} handlerName - Name of the handler (e.g., 'get_program', 'get_class')
 * @param {string} [testCaseName] - Optional: specific test case name to find
 * @returns {object|null} Test case with params, or null if not found
 */
function getEnabledTestCase(handlerName, testCaseName) {
  const config = loadTestConfig();
  const handlerTests = config[handlerName]?.test_cases || [];

  let enabledTest;
  if (testCaseName) {
    // Find specific test case by name
    enabledTest = handlerTests.find(tc => tc.name === testCaseName && tc.enabled === true);
  } else {
    // Find first enabled test case
    enabledTest = handlerTests.find(tc => tc.enabled === true);
  }

  if (!enabledTest) {
    // Silent return - test will handle missing test case gracefully
    return null;
  }

  return enabledTest;
}

/**
 * Get all enabled test cases from config
 * @param {string} handlerName - Name of the handler (e.g., 'get_program', 'get_class')
 * @returns {Array} Array of enabled test cases
 */
function getAllEnabledTestCases(handlerName) {
  const config = loadTestConfig();
  const handlerTests = config[handlerName]?.test_cases || [];

  const enabledTests = handlerTests.filter(tc => tc.enabled === true);
  // Silent return - test will handle empty array gracefully
  return enabledTests;
}

/**
 * Get test settings from config
 */
function getTestSettings() {
  const config = loadTestConfig();
  return config.test_settings || {
    fail_fast: false,
    verbose: true,
    timeout: 30000,
    retry_on_failure: false,
    max_retries: 1,
    cleanup_after_test: false
  };
}

/**
 * Get environment configuration (default package, transport request, etc.)
 * @returns {object} Environment config with default_package, default_transport, etc.
 */
function getEnvironmentConfig() {
  const config = loadTestConfig();
  return config.environment || {
    default_package: process.env.SAP_PACKAGE || 'ZOK_TEST_PKG_01',
    default_transport: process.env.SAP_TRANSPORT || ''
  };
}

/**
 * Get default package name from config (for creating objects)
 * @returns {string} Default package name
 */
function getDefaultPackage() {
  const envConfig = getEnvironmentConfig();
  return envConfig.default_package || process.env.SAP_PACKAGE || 'ZOK_TEST_PKG_01';
}

/**
 * Get default transport request from config
 * @returns {string} Default transport request (may be empty)
 */
function getDefaultTransport() {
  const envConfig = getEnvironmentConfig();
  return envConfig.default_transport || process.env.SAP_TRANSPORT || '';
}

/**
 * Validate that object name is in user space (starts with Z_ or Y_)
 * @param {string} objectName - Object name to validate
 * @param {string} objectType - Type of object (for error message)
 * @throws {Error} If object is not in user space
 */
function validateUserSpaceObject(objectName, objectType = 'object') {
  if (!objectName) {
    return; // Skip validation if name is not provided
  }

  const upperName = objectName.toUpperCase();
  // Check if object starts with Z or Y (for classes: ZCL_, YCL_; for domains: Z_, Y_; etc.)
  // Also check for Z_ and Y_ patterns for objects that use underscore prefix
  if (!upperName.startsWith('Z') && !upperName.startsWith('Y')) {
    throw new Error(
      `Invalid ${objectType} name: "${objectName}" is not in user space. ` +
      `Only user-defined objects (starting with Z or Y) can be modified in tests. ` +
      `Standard SAP objects cannot be created, updated, activated, locked, or deleted.`
    );
  }
}

/**
 * Validate test case params for user space objects
 * Checks common object name fields in test case params
 * @param {object} testCase - Test case with params
 * @param {string} operation - Operation name (for error message)
 * @throws {Error} If any object is not in user space
 */
function validateTestCaseForUserSpace(testCase, operation = 'operation') {
  if (!testCase || !testCase.params) {
    return; // Skip if no params
  }

  const params = testCase.params;
  const fieldsToCheck = [
    'class_name',
    'domain_name',
    'function_group_name',
    'function_module_name',
    'function_name',
    'program_name',
    'interface_name',
    'table_name',
    'structure_name',
    'view_name',
    'data_element_name',
    'object_name'
  ];

  for (const field of fieldsToCheck) {
    if (params[field]) {
      try {
        validateUserSpaceObject(params[field], field.replace('_', ' '));
      } catch (error) {
        throw new Error(
          `Test case validation failed for ${operation}: ${error.message} ` +
          `(Field: ${field}, Value: ${params[field]})`
        );
      }
    }
  }
}

// Auto-load environment variables when module is imported
loadTestEnv();

module.exports = {
  loadTestConfig,
  getEnabledTestCase,
  getAllEnabledTestCases,
  getTestSettings,
  getEnvironmentConfig,
  getDefaultPackage,
  getDefaultTransport,
  loadTestEnv,
  validateUserSpaceObject,
  validateTestCaseForUserSpace,
};

