/**
 * Test configuration helper for @mcp-abap-adt/adt-clients
 * Loads test parameters from test-config.yaml
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const dotenv = require('dotenv');

let cachedConfig = null;
let configLoadedFrom = null;
let displayedTemplateWarning = false;

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
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(__dirname, 'test-config.yaml');
  const templatePath = path.resolve(__dirname, 'test-config.yaml.template');

  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    cachedConfig = yaml.parse(configContent) || {};
    configLoadedFrom = 'custom';
    return cachedConfig;
  }

  if (fs.existsSync(templatePath)) {
    if (!displayedTemplateWarning) {
      console.warn('⚠️ tests/test-config.yaml not found. Using tests/test-config.yaml.template (all integration tests remain disabled).');
      console.warn('   Copy the template to tests/test-config.yaml and fill in your SAP system details to run integration tests.');
      displayedTemplateWarning = true;
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    cachedConfig = yaml.parse(templateContent) || {};
    configLoadedFrom = 'template';
    return cachedConfig;
  }

  console.error('❌ Test configuration files not found.');
  console.error('Please copy tests/test-config.yaml.template to tests/test-config.yaml and configure test parameters.');
  process.exit(1);
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
  if (config.environment) {
    return config.environment;
  }
  return {
    default_package: process.env.SAP_PACKAGE || '',
    default_transport: process.env.SAP_TRANSPORT || ''
  };
}

/**
 * Get default package name from config (for creating objects)
 * @returns {string} Default package name
 */
/**
 * Get default transport request from config
 * @returns {string} Default transport request (may be empty)
 */
function getDefaultPackage() {
  const envConfig = getEnvironmentConfig();
  return envConfig.default_package || process.env.SAP_PACKAGE || '';
}

function getDefaultTransport() {
  const envConfig = getEnvironmentConfig();
  if (typeof envConfig.default_transport === 'string') {
    return envConfig.default_transport;
  }
  return process.env.SAP_TRANSPORT || '';
}

/**
 * Resolve package name from explicit param or environment
 * @param {string|undefined} packageName
 * @returns {string} resolved package name or empty string
 */
function resolvePackageName(packageName) {
  if (packageName && packageName.trim()) {
    return packageName.trim();
  }
  return getDefaultPackage();
}

/**
 * Resolve transport request from explicit param or environment
 * @param {string|undefined} transportRequest
 * @returns {string} transport request (may be empty string)
 */
function resolveTransportRequest(transportRequest) {
  if (transportRequest !== undefined && transportRequest !== null) {
    return transportRequest;
  }
  return getDefaultTransport();
}

/**
 * Ensure package/transport params are populated from environment defaults
 * @param {object} params Test case params object
 * @param {string} testLabel Identifier for skip/error messages
 * @returns {{success: boolean, reason?: string}}
 */
function ensurePackageConfig(params = {}, testLabel = 'builder test') {
  const resolvedPackage = resolvePackageName(params.package_name);
  if (!resolvedPackage) {
    return {
      success: false,
      reason: `${testLabel}: package_name is not configured. Provide params.package_name or set environment.default_package`
    };
  }

  if (!params.package_name) {
    params.package_name = resolvedPackage;
  }

  params.transport_request = resolveTransportRequest(params.transport_request);
  return { success: true };
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

/**
 * Get timeout for specific operation type or handler
 * @param {string} operationType - Type of operation (e.g., 'create', 'read', 'update')
 * @param {string} [handlerName] - Optional handler name for handler-specific timeout
 * @returns {number} Timeout in milliseconds
 */
function getTimeout(operationType, handlerName) {
  const config = loadTestConfig();
  const timeouts = config.test_settings?.timeouts || {};

  // Check for handler-specific timeout override
  if (handlerName && timeouts[handlerName]) {
    return timeouts[handlerName];
  }

  // Check for operation-specific timeout
  if (timeouts[operationType]) {
    return timeouts[operationType];
  }

  // Fall back to default timeout
  return timeouts.default || 60000;
}

/**
 * Get global test timeout from configuration
 * @returns {number} Test timeout in milliseconds
 */
function getTestTimeout() {
  const config = loadTestConfig();
  return config.test_settings?.timeout || 60000;
}

// Auto-load environment variables when module is imported
loadTestEnv();

/**
 * Get test case definition regardless of enabled flag
 * @param {string} handlerName
 * @param {string} testCaseName
 * @returns {object|null}
 */
function getTestCaseDefinition(handlerName, testCaseName) {
  const config = loadTestConfig();
  const handlerTests = config[handlerName]?.test_cases || [];

  if (!testCaseName) {
    return handlerTests[0] || null;
  }

  return handlerTests.find(tc => tc.name === testCaseName) || null;
}

/**
 * Resolve standard SAP object name for read tests
 * Supports both test-case-specific params and global standard_objects registry
 * @param {string} objectType - Type of object ('class', 'domain', 'table', etc.)
 * @param {boolean} isCloud - Whether the system is cloud (true) or on-premise (false)
 * @param {object} [testCase] - Optional test case with params (e.g., { params: { standard_class_name_onprem: '...' } })
 * @returns {{name: string, group?: string} | null} - Object name and optional group (for function modules), or null if not found
 */
function resolveStandardObject(objectType, isCloud, testCase = null) {
  const config = loadTestConfig();
  const standardObjects = config.standard_objects || {};

  // Map object types to YAML keys and param suffixes
  const typeMap = {
    'class': { yamlKey: 'classes', paramSuffix: 'class_name' },
    'domain': { yamlKey: 'domains', paramSuffix: 'domain_name' },
    'dataElement': { yamlKey: 'data_elements', paramSuffix: 'data_element_name' },
    'data_element': { yamlKey: 'data_elements', paramSuffix: 'data_element_name' },
    'table': { yamlKey: 'tables', paramSuffix: 'table_name' },
    'structure': { yamlKey: 'structures', paramSuffix: 'structure_name' },
    'interface': { yamlKey: 'interfaces', paramSuffix: 'interface_name' },
    'functionGroup': { yamlKey: 'function_groups', paramSuffix: 'function_group_name' },
    'function_group': { yamlKey: 'function_groups', paramSuffix: 'function_group_name' },
    'functionModule': { yamlKey: 'function_modules', paramSuffix: 'function_module_name' },
    'function_module': { yamlKey: 'function_modules', paramSuffix: 'function_module_name' },
    'program': { yamlKey: 'programs', paramSuffix: 'program_name' },
    'package': { yamlKey: 'packages', paramSuffix: 'package_name' },
    'view': { yamlKey: 'views', paramSuffix: 'view_name' }
  };

  const typeInfo = typeMap[objectType];
  if (!typeInfo) {
    return null;
  }

  const envSuffix = isCloud ? '_cloud' : '_onprem';
  const paramKey = `standard_${typeInfo.paramSuffix}${envSuffix}`;

  // Priority 1: Test case specific param (e.g., standard_class_name_onprem or standard_class_name_cloud)
  if (testCase?.params?.[paramKey]) {
    return { name: testCase.params[paramKey] };
  }

  // Priority 2: Generic test case param (e.g., standard_class_name) - for backward compatibility
  const genericParamKey = `standard_${typeInfo.paramSuffix}`;
  if (testCase?.params?.[genericParamKey]) {
    return { name: testCase.params[genericParamKey] };
  }

  // Priority 3: Global standard_objects registry filtered by environment
  const objectsList = standardObjects[typeInfo.yamlKey] || [];
  const envFilter = isCloud ? 'cloud' : 'onprem';
  const availableObjects = objectsList.filter(obj =>
    obj.available_in && obj.available_in.includes(envFilter)
  );

  if (availableObjects.length > 0) {
    const obj = availableObjects[0];
    const result = { name: obj.name };
    // For function modules, include group
    if (objectType === 'functionModule' || objectType === 'function_module') {
      if (obj.group) {
        result.group = obj.group;
      }
    }
    return result;
  }

  return null;
}

/**
 * Get operation delay in milliseconds
 * @param {string} operation - Operation type ('lock', 'unlock', 'update', 'create', or 'default')
 * @param {object} [testCase] - Optional test case to check for override
 * @returns {number} Delay in milliseconds
 */
function getOperationDelay(operation = 'default', testCase = null) {
  const config = loadTestConfig();
  const defaultDelay = 3000; // Default 3 seconds
  
  // Check for test case specific override first
  if (testCase?.params?.operation_delays?.[operation]) {
    return testCase.params.operation_delays[operation];
  }
  
  // Check for global operation delays in test_settings
  const globalDelays = config.test_settings?.operation_delays;
  if (globalDelays?.[operation]) {
    return globalDelays[operation];
  }
  
  // Fall back to legacy delay setting or default
  if (config.test_settings?.timeouts?.delay) {
    return config.test_settings.timeouts.delay;
  }
  
  return defaultDelay;
}

module.exports = {
  loadTestConfig,
  getEnabledTestCase,
  getAllEnabledTestCases,
  getTestCaseDefinition,
  getTestSettings,
  getEnvironmentConfig,
  getDefaultPackage,
  getDefaultTransport,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolvePackageName,
  resolveTransportRequest,
  loadTestEnv,
  validateUserSpaceObject,
  validateTestCaseForUserSpace,
  getTimeout,  // Add getTimeout from root helper
  getTestTimeout,  // Add getTestTimeout from root helper
  resolveStandardObject,  // Add resolveStandardObject helper
  getOperationDelay,  // Get delay for SAP operations
};

