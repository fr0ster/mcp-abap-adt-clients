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

// Auto-load environment variables when module is imported
loadTestEnv();

module.exports = {
  loadTestConfig,
  getEnabledTestCase,
  getAllEnabledTestCases,
  getTestSettings,
  loadTestEnv,
};

