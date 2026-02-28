/**
 * Test configuration helper for @mcp-abap-adt/adt-clients
 * Loads test parameters from test-config.yaml
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const dotenv = require('dotenv');
const { XMLParser } = require('fast-xml-parser');

let cachedConfig = null;
let configLoadedFrom = null;
let displayedTemplateWarning = false;

/**
 * Load environment variables from .env file (quiet mode - no console output)
 */
function loadTestEnv() {
  const envPath =
    process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
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
      console.warn(
        '⚠️ tests/test-config.yaml not found. Using tests/test-config.yaml.template (all integration tests remain disabled).',
      );
      console.warn(
        '   Copy the template to tests/test-config.yaml and fill in your SAP system details to run integration tests.',
      );
      displayedTemplateWarning = true;
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    cachedConfig = yaml.parse(templateContent) || {};
    configLoadedFrom = 'template';
    return cachedConfig;
  }

  console.error('❌ Test configuration files not found.');
  console.error(
    'Please copy tests/test-config.yaml.template to tests/test-config.yaml and configure test parameters.',
  );
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
    enabledTest = handlerTests.find(
      (tc) => tc.name === testCaseName && tc.enabled === true,
    );
  } else {
    // Find first enabled test case
    enabledTest = handlerTests.find((tc) => tc.enabled === true);
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

  const enabledTests = handlerTests.filter((tc) => tc.enabled === true);
  // Silent return - test will handle empty array gracefully
  return enabledTests;
}

/**
 * Get test settings from config
 */
function getTestSettings() {
  const config = loadTestConfig();
  return (
    config.test_settings || {
      fail_fast: false,
      verbose: true,
      timeout: 30000,
      retry_on_failure: false,
      max_retries: 1,
      cleanup_after_test: false,
    }
  );
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
    default_transport: process.env.SAP_TRANSPORT || '',
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
 * Get default master system from test config or environment
 * @returns {string} Default master system or empty string
 */
function getDefaultMasterSystem() {
  const envConfig = getEnvironmentConfig();
  return envConfig.default_master_system || process.env.SAP_SYSTEM_ID || '';
}

/**
 * Resolve master system from explicit param or environment
 * @param {string|undefined} masterSystem
 * @returns {string} resolved master system or empty string
 */
function resolveMasterSystem(masterSystem) {
  if (masterSystem && masterSystem.trim()) {
    return masterSystem.trim();
  }
  return getDefaultMasterSystem();
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
      reason: `${testLabel}: package_name is not configured. Provide params.package_name or set environment.default_package`,
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
        `Standard SAP objects cannot be created, updated, activated, locked, or deleted.`,
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
    'object_name',
  ];

  for (const field of fieldsToCheck) {
    if (params[field]) {
      try {
        validateUserSpaceObject(params[field], field.replace('_', ' '));
      } catch (error) {
        throw new Error(
          `Test case validation failed for ${operation}: ${error.message} ` +
            `(Field: ${field}, Value: ${params[field]})`,
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

  return handlerTests.find((tc) => tc.name === testCaseName) || null;
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
    class: { yamlKey: 'classes', paramSuffix: 'class_name' },
    domain: { yamlKey: 'domains', paramSuffix: 'domain_name' },
    dataElement: { yamlKey: 'data_elements', paramSuffix: 'data_element_name' },
    data_element: {
      yamlKey: 'data_elements',
      paramSuffix: 'data_element_name',
    },
    table: { yamlKey: 'tables', paramSuffix: 'table_name' },
    structure: { yamlKey: 'structures', paramSuffix: 'structure_name' },
    interface: { yamlKey: 'interfaces', paramSuffix: 'interface_name' },
    functionGroup: {
      yamlKey: 'function_groups',
      paramSuffix: 'function_group_name',
    },
    function_group: {
      yamlKey: 'function_groups',
      paramSuffix: 'function_group_name',
    },
    functionModule: {
      yamlKey: 'function_modules',
      paramSuffix: 'function_module_name',
    },
    function_module: {
      yamlKey: 'function_modules',
      paramSuffix: 'function_module_name',
    },
    program: { yamlKey: 'programs', paramSuffix: 'program_name' },
    package: { yamlKey: 'packages', paramSuffix: 'package_name' },
    view: { yamlKey: 'views', paramSuffix: 'view_name' },
    serviceDefinition: {
      yamlKey: 'service_definitions',
      paramSuffix: 'service_definition_name',
    },
    service_definition: {
      yamlKey: 'service_definitions',
      paramSuffix: 'service_definition_name',
    },
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
  const availableObjects = objectsList.filter(
    (obj) => obj.available_in && obj.available_in.includes(envFilter),
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

/**
 * Extract meaningful error message from validation response
 * Parses XML to extract localized message or exception type
 * @param {Object} response - AxiosResponse from validation endpoint
 * @returns {string} Extracted error message or fallback to raw data
 */
function extractValidationErrorMessage(response) {
  if (!response?.data) {
    return 'Unknown validation error';
  }

  try {
    const errorData = response.data;

    // Handle object responses (non-XML)
    if (
      typeof errorData === 'object' &&
      errorData !== null &&
      !(errorData instanceof String)
    ) {
      // Try to extract meaningful fields from object
      const obj = errorData;

      // Check for common error message fields
      if (obj.message) {
        return String(obj.message);
      }
      if (obj.error) {
        return String(obj.error);
      }
      if (obj.errorMessage) {
        return String(obj.errorMessage);
      }
      if (obj.localizedMessage) {
        return String(obj.localizedMessage);
      }
      if (obj.shortText) {
        return String(obj.shortText);
      }
      if (obj.text) {
        return String(obj.text);
      }

      // Check for nested exception structure
      if (obj.exception) {
        const exc = obj.exception;
        if (exc.message) return String(exc.message);
        if (exc.localizedMessage) return String(exc.localizedMessage);
        if (exc.type) return String(exc.type);
      }

      // Check for SEVERITY/SHORT_TEXT format (function group validation - parsed XML)
      if (obj.SEVERITY || obj.Severity || obj.severity) {
        const severity = obj.SEVERITY || obj.Severity || obj.severity;
        const shortText =
          obj.SHORT_TEXT || obj.ShortText || obj.shortText || '';
        if (severity !== 'OK' && shortText) {
          return String(shortText);
        }
        if (severity !== 'OK') {
          return `Validation error (${severity})`;
        }
      }

      // Check for asx:abap structure (parsed XML)
      if (obj['asx:abap'] || obj['asx:values'] || obj.DATA) {
        const data = obj['asx:abap']?.['asx:values']?.['DATA'] || obj.DATA;
        if (data) {
          if (data.SHORT_TEXT || data.ShortText || data.shortText) {
            return String(data.SHORT_TEXT || data.ShortText || data.shortText);
          }
          if (data.SEVERITY && data.SEVERITY !== 'OK') {
            return `Validation error: ${data.SHORT_TEXT || data.SEVERITY}`;
          }
        }
      }

      // If object has toString method, use it
      if (
        typeof obj.toString === 'function' &&
        obj.toString() !== '[object Object]'
      ) {
        return obj.toString();
      }

      // Last resort: try to stringify with meaningful fields
      const meaningfulFields = {};
      for (const key in obj) {
        if (typeof obj[key] === 'string' && obj[key].length < 200) {
          meaningfulFields[key] = obj[key];
        }
      }
      if (Object.keys(meaningfulFields).length > 0) {
        return JSON.stringify(meaningfulFields);
      }

      // Final fallback: return status and basic info
      return `Validation error (HTTP ${response.status || '?'})`;
    }

    // Handle string responses (XML or plain text)
    const errorText =
      typeof errorData === 'string'
        ? errorData
        : JSON.stringify(errorData || {});

    // Try to parse XML
    if (typeof errorData === 'string' && errorData.trim().startsWith('<?xml')) {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const result = parser.parse(errorData);

      // Check for exception format (<exc:exception>)
      const exception = result['exc:exception'];
      if (exception) {
        // Extract message - handle both string and object with #text
        let localizedMessage = exception['localizedMessage'];
        if (localizedMessage && typeof localizedMessage === 'object') {
          localizedMessage =
            localizedMessage['#text'] ||
            localizedMessage['text'] ||
            localizedMessage;
        }
        if (typeof localizedMessage === 'object') {
          localizedMessage = JSON.stringify(localizedMessage);
        }

        let message = exception['message'];
        if (message && typeof message === 'object') {
          message = message['#text'] || message['text'] || message;
        }
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }

        // Extract exception type
        let exceptionType = exception['type'];
        if (exceptionType && typeof exceptionType === 'object') {
          exceptionType =
            exceptionType['#text'] || exceptionType['text'] || exceptionType;
        }
        exceptionType = exceptionType || '';

        // Prefer localized message, fallback to regular message
        const msgText = (localizedMessage || message || '').trim();

        // Combine exception type and message for clarity
        if (msgText) {
          return exceptionType ? `${exceptionType}: ${msgText}` : msgText;
        }

        // If no message, at least return exception type
        if (exceptionType) {
          return exceptionType;
        }
      }

      // Check for other XML formats (e.g., <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT>)
      // Function group validation uses this format
      if (result['asx:abap'] || result['asx:values'] || result['DATA']) {
        const data =
          result['asx:abap']?.['asx:values']?.['DATA'] || result['DATA'];
        if (data) {
          if (data['SHORT_TEXT']) {
            return String(data['SHORT_TEXT']);
          }
          if (data['SEVERITY'] && data['SEVERITY'] !== 'OK') {
            return `Validation error: ${data['SHORT_TEXT'] || data['SEVERITY']}`;
          }
        }
      }

      // Check for direct SEVERITY/SHORT_TEXT format (function group validation)
      if (result['SEVERITY']) {
        const severity = result['SEVERITY'];
        const shortText = result['SHORT_TEXT'] || result['shortText'] || '';
        if (severity !== 'OK' && shortText) {
          return String(shortText);
        }
        if (severity !== 'OK') {
          return `Validation error (${severity})`;
        }
      }

      // Check for exception with resource information (e.g., "Resource FUGR_MAINPROGRAM ...")
      if (result['exception'] || result['exc:exception']) {
        const exc = result['exception'] || result['exc:exception'];
        if (exc['message']) {
          const msg = String(exc['message']);
          // Extract resource name if present (e.g., "Resource FUGR_MAINPROGRAM ZADT_BLD_FGR01: wrong input data")
          if (msg.includes('Resource') && msg.includes(':')) {
            return msg;
          }
          return msg;
        }
      }

      // Check for nested structures that might contain error info
      // Sometimes XML parser creates nested objects
      const checkNested = (obj, depth = 0) => {
        if (depth > 3) return null; // Prevent infinite recursion

        if (typeof obj === 'string' && obj.length > 0 && obj.length < 500) {
          // If it's a meaningful string (not just whitespace), return it
          if (obj.trim().length > 0) {
            return obj.trim();
          }
        }

        if (typeof obj === 'object' && obj !== null) {
          // Check common error fields
          if (obj.message) return String(obj.message);
          if (obj.error) return String(obj.error);
          if (obj.shortText) return String(obj.shortText);
          if (obj.SHORT_TEXT) return String(obj.SHORT_TEXT);

          // Recursively check nested objects
          for (const key in obj) {
            if (Object.hasOwn(obj, key)) {
              const nested = checkNested(obj[key], depth + 1);
              if (nested) return nested;
            }
          }
        }

        return null;
      };

      const nestedMessage = checkNested(result);
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    // Fallback: return first 500 chars of raw data
    return errorText.length > 500
      ? errorText.substring(0, 500) + '...'
      : errorText;
  } catch (parseError) {
    // If parsing fails, return raw data (limited)
    const errorData = response.data;
    const errorText =
      typeof errorData === 'string'
        ? errorData
        : JSON.stringify(errorData || {});
    return errorText.length > 500
      ? errorText.substring(0, 500) + '...'
      : errorText;
  }
}

/**
 * Parse validation response from ADT
 * Checks for CHECK_RESULT=X (success) or SEVERITY=ERROR with message
 * @param {Object} response - AxiosResponse from validation endpoint
 * @returns {Object} Parsed validation result with valid, severity, message, exists fields
 */
function parseValidationResponse(response) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const result = parser.parse(response.data);

    // Check for exception format (<exc:exception>)
    const exception = result['exc:exception'];
    if (exception) {
      const message = exception['message'] || '';
      const localizedMessage = exception['localizedMessage'] || message;
      const msgText = localizedMessage || message;
      const msgLower = msgText.toLowerCase();

      // Check exception type - ExceptionResourceAlreadyExists means object exists
      const exceptionType = exception['type'] || '';
      const isResourceAlreadyExists =
        exceptionType === 'ExceptionResourceAlreadyExists' ||
        exceptionType.includes('ResourceAlreadyExists') ||
        exceptionType.includes('AlreadyExists');

      // InvalidClifName with "already exists" message also means object exists
      // Also check if exception type is InvalidClifName - this usually means object exists for OO objects
      const isInvalidClifName = exceptionType === 'InvalidClifName';

      // Check if message indicates object already exists
      const exists =
        isResourceAlreadyExists ||
        (isInvalidClifName && msgLower.includes('already exists')) ||
        msgLower.includes('already exists') ||
        msgLower.includes('does already exist') ||
        (msgLower.includes('exist') &&
          (msgLower.includes('table') ||
            msgLower.includes('database') ||
            msgLower.includes('resource') ||
            msgLower.includes('interface') ||
            msgLower.includes('class')));

      return {
        valid: false,
        severity: 'ERROR',
        message: msgText,
        exists: exists ? true : undefined,
      };
    }

    // Check for standard format (<asx:abap><asx:values><DATA>)
    const data = result['asx:abap']?.['asx:values']?.['DATA'];
    if (!data) {
      // No data means validation passed
      return { valid: true };
    }

    // Check for CHECK_RESULT=X (success)
    if (data['CHECK_RESULT'] === 'X') {
      return { valid: true };
    }

    // Check for SEVERITY (error/warning)
    const severity = data['SEVERITY'];
    const shortText = data['SHORT_TEXT'] || '';
    const longText = data['LONG_TEXT'] || '';

    // Check if message indicates object already exists
    const msgLower = shortText.toLowerCase();
    const exists =
      msgLower.includes('already exists') ||
      msgLower.includes('does already exist') ||
      (msgLower.includes('exist') &&
        (msgLower.includes('resource') ||
          msgLower.includes('definition') ||
          msgLower.includes('object')));

    return {
      valid: severity !== 'ERROR',
      severity: severity,
      message: shortText,
      longText: longText,
      exists: exists || undefined,
    };
  } catch (error) {
    // If parsing fails, assume validation passed (fallback)
    return { valid: true };
  }
}

/**
 * Check validation result and throw error if validation failed
 * Simple check: if status is not 200, throw error with raw message
 * @param {Object} validationResponse - AxiosResponse from validation
 * @param {string} objectName - Name of the object being validated
 * @param {string} objectType - Type of object (e.g., 'Interface', 'Class', 'Table')
 * @throws {Error} If validation failed (status !== 200)
 */
function checkValidationResult(validationResponse, objectName, objectType) {
  if (!validationResponse) {
    return; // No validation response, assume OK
  }

  const status = validationResponse.status;

  // If status is 200, validation passed
  if (status === 200) {
    return;
  }

  // If status is not 200, get raw error message and throw
  const rawData =
    typeof validationResponse.data === 'string'
      ? validationResponse.data
      : JSON.stringify(validationResponse.data);

  throw new Error(
    `${objectType} validation failed (HTTP ${status}): ${rawData}`,
  );
}

/**
 * Retry check operation after activate - activation is asynchronous and may take time
 * Handles "importing object from the database" errors by retrying
 * @param {Function} checkFunction - Async function that performs the check (e.g., () => client.checkDomain({ domainName }))
 * @param {Object} options - Options for retry behavior
 * @param {number} [options.maxAttempts=5] - Maximum number of retry attempts
 * @param {number} [options.delay=1000] - Delay between retries in milliseconds
 * @param {Object} [options.logger] - Optional logger for debug messages
 * @param {string} [options.objectName] - Optional object name for log messages
 * @returns {Promise<Object>} Check result (AxiosResponse)
 * @throws {Error} If all retry attempts failed
 */
async function retryCheckAfterActivate(checkFunction, options = {}) {
  const {
    maxAttempts = 5,
    delay = 1000,
    logger = null,
    objectName = 'object',
  } = options;

  let checkAttempts = 0;
  let lastError = null;

  while (checkAttempts < maxAttempts) {
    try {
      const result = await checkFunction();
      // Success - return result
      return result;
    } catch (error) {
      checkAttempts++;
      lastError = error;

      if (checkAttempts >= maxAttempts) {
        // All attempts failed - throw error
        throw error;
      }

      // Check if error is about importing from database (activation still in progress)
      const errorMessage = error?.message || String(error);
      const isActivationInProgress =
        errorMessage.includes('importing object') ||
        errorMessage.includes('from the database') ||
        errorMessage.includes('Error while importing');

      if (isActivationInProgress) {
        // Activation still in progress - retry
        if (logger && logger.debug) {
          logger.debug(
            `Check attempt ${checkAttempts} failed for ${objectName} (activation in progress), retrying in ${delay}ms...`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Other error - don't retry, throw immediately
      throw error;
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error(`Check failed after ${maxAttempts} attempts`);
}

/**
 * Check if package exists using searchObjects
 * @param {Object} connection - ABAP connection
 * @param {string} packageName - Package name to check
 * @returns {Promise<boolean>} True if package exists, false otherwise
 */
async function checkPackageExists(connection, packageName) {
  try {
    // Dynamically require searchObjects to avoid circular dependencies
    const { searchObjects } = require('../src/core/shared/search');

    const response = await searchObjects(connection, {
      query: `${packageName}*`,
      objectType: 'DEVC',
      maxResults: 101,
    });

    if (response.status !== 200) {
      return false;
    }

    const xmlData = typeof response.data === 'string' ? response.data : '';
    if (!xmlData || !xmlData.includes('<adtcore:objectReference')) {
      return false;
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed = parser.parse(xmlData);
    const refs =
      parsed['adtcore:objectReferences']?.['adtcore:objectReference'];
    const objects = refs ? (Array.isArray(refs) ? refs : [refs]) : [];

    return objects.some(
      (obj) =>
        obj['@_adtcore:name']?.toUpperCase() === packageName.toUpperCase(),
    );
  } catch (error) {
    return false;
  }
}

/**
 * Validate test parameters: package and transport request
 * @param {Object} connection - ABAP connection
 * @param {Object} params - Test case params
 * @param {string} testLabel - Test label for error messages
 * @param {string} defaultPackage - Default package name
 * @param {string} defaultTransport - Default transport request
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
async function validateTestParameters(
  connection,
  params = {},
  testLabel = 'test',
  defaultPackage = '',
  defaultTransport = '',
) {
  // Resolve package name
  const resolvedPackage = resolvePackageName(params.package_name);
  if (!resolvedPackage) {
    return {
      success: false,
      reason: `${testLabel}: package_name is not configured. Provide params.package_name or set environment.default_package`,
    };
  }

  // Check if package exists (if explicitly specified, not default)
  const testPackageName = params.package_name;
  if (testPackageName && testPackageName !== defaultPackage) {
    const packageExists = await checkPackageExists(connection, resolvedPackage);
    if (!packageExists) {
      return {
        success: false,
        reason: `Package ${resolvedPackage} does not exist`,
      };
    }
  }

  // Validate transport request if specified (can be added later if needed)
  const resolvedTransport = resolveTransportRequest(params.transport_request);
  if (resolvedTransport && resolvedTransport !== defaultTransport) {
    // Transport request validation can be added here if needed
  }

  return { success: true };
}

/**
 * Check default package and transport before all tests
 * @param {Object} connection - ABAP connection
 * @returns {Promise<{success: boolean, reason?: string, defaultPackage?: string, defaultTransport?: string}>}
 */
async function checkDefaultTestEnvironment(connection) {
  const defaultPackage = getDefaultPackage();
  const defaultTransport = getDefaultTransport();

  if (!defaultPackage) {
    return {
      success: false,
      reason:
        'Default package is not configured. Set environment.default_package or SAP_PACKAGE',
      defaultPackage: '',
      defaultTransport,
    };
  }

  // Check if default package exists
  const packageExists = await checkPackageExists(connection, defaultPackage);
  if (!packageExists) {
    return {
      success: false,
      reason: `Default package ${defaultPackage} does not exist`,
      defaultPackage,
      defaultTransport,
    };
  }

  return {
    success: true,
    defaultPackage,
    defaultTransport,
  };
}

/**
 * Log default test environment in one line
 * @param {Object} logger - Logger object with info method
 * @param {string} defaultPackage - Default package name
 * @param {string} defaultTransport - Default transport request
 */
function logDefaultTestEnvironment(
  logger,
  defaultPackage = '',
  defaultTransport = '',
) {
  const envInfo = [
    defaultPackage && `Package: ${defaultPackage}`,
    defaultTransport && `Transport: ${defaultTransport}`,
  ]
    .filter(Boolean)
    .join(', ');

  // Only log if DEBUG_ADT_TESTS is enabled - this is just informational
  if (envInfo && process.env.DEBUG_ADT_TESTS === 'true' && logger?.info) {
    logger.info(`✓ ${envInfo}`);
  }
}

/**
 * Create dependency table with full workflow (validate → create → lock → update → unlock → activate)
 * Includes cleanup (unlock + delete) if update fails
 * @param {Object} client - CrudClient instance
 * @param {Object} config - Table configuration
 *   - tableName: string - Table name
 *   - packageName: string - Package name
 *   - description: string - Table description
 *   - ddlCode: string - DDL source code
 *   - transportRequest: string - Transport request (optional)
 * @param {Object} testCase - Test case for delays
 * @returns {Promise<{success: boolean, reason?: string, created?: boolean}>}
 */
async function createDependencyTable(client, config, testCase) {
  if (!client || !config || !config.tableName) {
    return {
      success: false,
      reason: 'Invalid parameters for createDependencyTable',
      created: false,
    };
  }

  let tableCreated = false;
  let tableLocked = false;
  let currentStep = '';

  try {
    // Step 1: Validate
    currentStep = 'validate';
    const validationResponse = await client.validateTable({
      tableName: config.tableName,
      packageName: config.packageName,
      description: config.description || '',
    });

    if (validationResponse?.status !== 200) {
      const errorMessage = extractValidationErrorMessage(validationResponse);
      const errorTextLower = errorMessage.toLowerCase();

      // If table already exists, return skip reason (environment problem)
      if (
        errorTextLower.includes('already exists') ||
        errorTextLower.includes('does already exist') ||
        errorTextLower.includes('exceptionresourcealreadyexists')
      ) {
        return {
          success: false,
          reason: `Dependency table ${config.tableName} already exists (may be owned by another user) - environment problem, test skipped`,
          created: false,
        };
      }

      // Other validation errors (environment problem)
      return {
        success: false,
        reason: `Dependency table validation failed: ${errorMessage} - environment problem, test skipped`,
        created: false,
      };
    }

    // Step 2: Create
    currentStep = 'create';
    await client.createTable({
      tableName: config.tableName,
      packageName: config.packageName,
      description: config.description || '',
      ddlCode: config.ddlCode || '',
      transportRequest: config.transportRequest,
    });
    tableCreated = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('create', testCase) || 1000),
    );

    // Step 3: Lock
    currentStep = 'lock';
    await client.lockTable({ tableName: config.tableName });
    tableLocked = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('lock', testCase) || 1000),
    );

    // Step 4: Update
    currentStep = 'update';
    await client.updateTable({
      tableName: config.tableName,
      ddlCode: config.ddlCode || '',
    });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('update', testCase) || 1000),
    );

    // Step 5: Unlock
    currentStep = 'unlock';
    await client.unlockTable({ tableName: config.tableName });
    tableLocked = false;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('unlock', testCase) || 1000),
    );

    // Step 6: Activate
    currentStep = 'activate';
    await client.activateTable({ tableName: config.tableName });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('activate', testCase) || 2000),
    );

    return {
      success: true,
      created: true,
    };
  } catch (error) {
    // Cleanup: unlock and delete if table was created/locked
    if (tableLocked || tableCreated) {
      try {
        if (tableLocked) {
          await client.unlockTable({ tableName: config.tableName });
        }
        if (tableCreated) {
          await client.deleteTable({
            tableName: config.tableName,
            transportRequest: config.transportRequest,
          });
        }
      } catch (cleanupError) {
        // Log but don't fail - original error is more important
        // Cleanup errors are silent to avoid noise
      }
    }

    // Any error = environment problem, test should be skipped
    return {
      success: false,
      reason: `Failed to create dependency table ${config.tableName}: ${error instanceof Error ? error.message : String(error)} - environment problem, test skipped`,
      created: false,
    };
  }
}

/**
 * Create dependency CDS view with full workflow (validate → create → lock → update → unlock → activate)
 * Includes cleanup (unlock + delete) if update fails
 * @param {Object} client - CrudClient instance
 * @param {Object} config - View configuration
 *   - viewName: string - View name
 *   - packageName: string - Package name
 *   - description: string - View description
 *   - ddlSource: string - DDL source code
 *   - transportRequest: string - Transport request (optional)
 * @param {Object} testCase - Test case for delays
 * @returns {Promise<{success: boolean, reason?: string, created?: boolean}>}
 */
async function createDependencyCdsView(client, config, testCase) {
  if (!client || !config || !config.viewName) {
    return {
      success: false,
      reason:
        'Invalid parameters for createDependencyCdsView - environment problem, test skipped',
      created: false,
    };
  }

  let viewCreated = false;
  let viewLocked = false;
  let currentStep = '';

  try {
    // Step 1: Validate
    currentStep = 'validate';
    const validationResponse = await client.validateView({
      viewName: config.viewName,
      packageName: config.packageName,
      description: config.description || '',
    });

    if (validationResponse?.status !== 200) {
      const errorMessage = extractValidationErrorMessage(validationResponse);
      const errorTextLower = errorMessage.toLowerCase();

      // If view already exists, return skip reason (environment problem)
      if (
        errorTextLower.includes('already exists') ||
        errorTextLower.includes('does already exist') ||
        errorTextLower.includes('exceptionresourcealreadyexists')
      ) {
        return {
          success: false,
          reason: `Dependency view ${config.viewName} already exists (may be owned by another user) - environment problem, test skipped`,
          created: false,
        };
      }

      // Other validation errors (environment problem)
      return {
        success: false,
        reason: `Dependency view validation failed: ${errorMessage} - environment problem, test skipped`,
        created: false,
      };
    }

    // Step 2: Create
    currentStep = 'create';
    if (!config.ddlSource) {
      return {
        success: false,
        reason:
          'ddlSource is required for view creation - environment problem, test skipped',
        created: false,
      };
    }
    await client.createView({
      viewName: config.viewName,
      packageName: config.packageName,
      description: config.description || '',
      ddlSource: config.ddlSource,
      transportRequest: config.transportRequest,
    });
    viewCreated = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('create', testCase) || 1000),
    );

    // Step 3: Lock
    currentStep = 'lock';
    await client.lockView({ viewName: config.viewName });
    viewLocked = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('lock', testCase) || 1000),
    );

    // Step 4: Update
    currentStep = 'update';
    await client.updateView({
      viewName: config.viewName,
      ddlSource: config.ddlSource,
    });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('update', testCase) || 1000),
    );

    // Step 5: Unlock
    currentStep = 'unlock';
    await client.unlockView({ viewName: config.viewName });
    viewLocked = false;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('unlock', testCase) || 1000),
    );

    // Step 6: Activate
    currentStep = 'activate';
    await client.activateView({ viewName: config.viewName });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('activate', testCase) || 2000),
    );

    return {
      success: true,
      created: true,
    };
  } catch (error) {
    // Cleanup: unlock and delete if view was created/locked
    if (viewLocked || viewCreated) {
      try {
        if (viewLocked) {
          await client.unlockView({ viewName: config.viewName });
        }
        if (viewCreated) {
          await client.deleteView({
            viewName: config.viewName,
            transportRequest: config.transportRequest,
          });
        }
      } catch (cleanupError) {
        // Log but don't fail - original error is more important
        // Cleanup errors are silent to avoid noise
      }
    }

    // Any error = environment problem, test should be skipped
    return {
      success: false,
      reason: `Failed to create dependency view ${config.viewName}: ${error instanceof Error ? error.message : String(error)} - environment problem, test skipped`,
      created: false,
    };
  }
}

/**
 * Create dependency domain with full workflow (validate → create → lock → update → unlock → activate)
 * Includes cleanup (unlock + delete) if update fails
 * @param {Object} client - CrudClient instance
 * @param {Object} config - Domain configuration
 *   - domainName: string - Domain name
 *   - packageName: string - Package name
 *   - description: string - Domain description
 *   - dataType: string - Data type (e.g., 'CHAR', 'NUMC', 'DEC')
 *   - length: number - Length
 *   - decimals: number - Decimals (optional)
 *   - transportRequest: string - Transport request (optional)
 * @param {Object} testCase - Test case for delays
 * @returns {Promise<{success: boolean, reason?: string, created?: boolean}>}
 */
async function createDependencyDomain(client, config, testCase) {
  if (!client || !config || !config.domainName) {
    return {
      success: false,
      reason:
        'Invalid parameters for createDependencyDomain - environment problem, test skipped',
      created: false,
    };
  }

  let domainCreated = false;
  let domainLocked = false;
  let currentStep = '';

  try {
    // Step 1: Validate
    currentStep = 'validate';
    const validationResponse = await client.validateDomain({
      domainName: config.domainName,
      packageName: config.packageName,
      description: config.description || '',
    });

    if (validationResponse?.status !== 200) {
      const errorMessage = extractValidationErrorMessage(validationResponse);
      const errorTextLower = errorMessage.toLowerCase();

      // If domain already exists, return skip reason (environment problem)
      if (
        errorTextLower.includes('already exists') ||
        errorTextLower.includes('does already exist') ||
        errorTextLower.includes('exceptionresourcealreadyexists')
      ) {
        return {
          success: false,
          reason: `Dependency domain ${config.domainName} already exists (may be owned by another user) - environment problem, test skipped`,
          created: false,
        };
      }

      // Other validation errors (environment problem)
      return {
        success: false,
        reason: `Dependency domain validation failed: ${errorMessage} - environment problem, test skipped`,
        created: false,
      };
    }

    // Step 2: Create
    currentStep = 'create';
    await client.createDomain({
      domainName: config.domainName,
      packageName: config.packageName,
      description: config.description || '',
    });
    domainCreated = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('create', testCase) || 1000),
    );

    // Step 3: Lock
    currentStep = 'lock';
    await client.lockDomain({ domainName: config.domainName });
    domainLocked = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('lock', testCase) || 1000),
    );

    // Step 4: Update (set data type, length, decimals if provided)
    currentStep = 'update';
    const updateConfig = {
      domainName: config.domainName,
      packageName: config.packageName,
      description: config.description || '',
    };
    if (config.dataType) {
      updateConfig.dataType = config.dataType;
    }
    if (config.length !== undefined) {
      updateConfig.length = config.length;
    }
    if (config.decimals !== undefined) {
      updateConfig.decimals = config.decimals;
    }
    await client.updateDomain(updateConfig);
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('update', testCase) || 1000),
    );

    // Step 5: Unlock
    currentStep = 'unlock';
    await client.unlockDomain({ domainName: config.domainName });
    domainLocked = false;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('unlock', testCase) || 1000),
    );

    // Step 6: Activate
    currentStep = 'activate';
    await client.activateDomain({ domainName: config.domainName });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('activate', testCase) || 2000),
    );

    return {
      success: true,
      created: true,
    };
  } catch (error) {
    // Cleanup: unlock and delete if domain was created/locked
    if (domainLocked || domainCreated) {
      try {
        if (domainLocked) {
          await client.unlockDomain({ domainName: config.domainName });
        }
        if (domainCreated) {
          await client.deleteDomain({
            domainName: config.domainName,
            transportRequest: config.transportRequest || '',
          });
        }
      } catch (cleanupError) {
        // Log but don't fail - original error is more important
        // Cleanup errors are silent to avoid noise
      }
    }

    // Any error = environment problem, test should be skipped
    return {
      success: false,
      reason: `Failed to create dependency domain ${config.domainName}: ${error instanceof Error ? error.message : String(error)} - environment problem, test skipped`,
      created: false,
    };
  }
}

/**
 * Create dependency function group with full workflow (validate → create → lock → unlock → activate)
 * Note: FunctionGroup doesn't have update operation
 * Includes cleanup (unlock + delete) if creation fails
 * @param {Object} client - CrudClient instance
 * @param {Object} config - FunctionGroup configuration
 *   - functionGroupName: string - Function group name
 *   - packageName: string - Package name
 *   - description: string - Function group description
 *   - transportRequest: string - Transport request (optional)
 * @param {Object} testCase - Test case for delays
 * @returns {Promise<{success: boolean, reason?: string, created?: boolean}>}
 */
async function createDependencyFunctionGroup(client, config, testCase) {
  if (!client || !config || !config.functionGroupName) {
    return {
      success: false,
      reason:
        'Invalid parameters for createDependencyFunctionGroup - environment problem, test skipped',
      created: false,
    };
  }

  let functionGroupCreated = false;
  let functionGroupLocked = false;
  let currentStep = '';

  try {
    // Step 1: Validate
    currentStep = 'validate';
    // packageName is required for function group validation
    // Without it, SAP ADT returns "Resource FUGR_MAINPROGRAM: wrong input data"
    const validationResponse = await client.validateFunctionGroup({
      functionGroupName: config.functionGroupName,
      packageName: config.packageName, // Required for validation
      description: config.description || '',
    });

    if (validationResponse?.status !== 200) {
      const errorMessage = extractValidationErrorMessage(validationResponse);
      const errorTextLower = errorMessage.toLowerCase();

      // If function group already exists, return skip reason (environment problem)
      if (
        errorTextLower.includes('already exists') ||
        errorTextLower.includes('does already exist') ||
        errorTextLower.includes('exceptionresourcealreadyexists')
      ) {
        return {
          success: false,
          reason: `Dependency function group ${config.functionGroupName} already exists (may be owned by another user) - environment problem, test skipped`,
          created: false,
        };
      }

      // Other validation errors (environment problem)
      return {
        success: false,
        reason: `Dependency function group validation failed: ${errorMessage} - environment problem, test skipped`,
        created: false,
      };
    }

    // Step 2: Create
    currentStep = 'create';
    await client.createFunctionGroup({
      functionGroupName: config.functionGroupName,
      packageName: config.packageName,
      description: config.description || '',
      transportRequest: config.transportRequest,
    });
    functionGroupCreated = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('create', testCase) || 1000),
    );

    // Step 3: Lock
    currentStep = 'lock';
    await client.lockFunctionGroup({
      functionGroupName: config.functionGroupName,
    });
    functionGroupLocked = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('lock', testCase) || 1000),
    );

    // Step 4: Unlock (FunctionGroup doesn't have update operation)
    currentStep = 'unlock';
    await client.unlockFunctionGroup({
      functionGroupName: config.functionGroupName,
    });
    functionGroupLocked = false;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('unlock', testCase) || 1000),
    );

    // Step 5: Activate
    currentStep = 'activate';
    await client.activateFunctionGroup({
      functionGroupName: config.functionGroupName,
    });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('activate', testCase) || 2000),
    );

    return {
      success: true,
      created: true,
    };
  } catch (error) {
    // Cleanup: unlock and delete if function group was created/locked
    if (functionGroupLocked || functionGroupCreated) {
      try {
        if (functionGroupLocked) {
          await client.unlockFunctionGroup({
            functionGroupName: config.functionGroupName,
          });
        }
        if (functionGroupCreated) {
          await client.deleteFunctionGroup({
            functionGroupName: config.functionGroupName,
            transportRequest: config.transportRequest || '',
          });
        }
      } catch (cleanupError) {
        // Log but don't fail - original error is more important
        // Cleanup errors are silent to avoid noise
      }
    }

    // Any error = environment problem, test should be skipped
    return {
      success: false,
      reason: `Failed to create dependency function group ${config.functionGroupName}: ${error instanceof Error ? error.message : String(error)} - environment problem, test skipped`,
      created: false,
    };
  }
}

/**
 * Create dependency behavior definition with full workflow (validate → create → lock → update → unlock → activate)
 * Includes cleanup (unlock + delete) if update fails
 * @param {Object} client - CrudClient instance
 * @param {Object} config - BehaviorDefinition configuration
 *   - bdefName: string - Behavior definition name
 *   - packageName: string - Package name
 *   - description: string - Behavior definition description
 *   - rootEntity: string - Root entity name
 *   - implementationType: string - Implementation type ('Managed' | 'Unmanaged' | 'Abstract' | 'Projection')
 *   - sourceCode: string - Source code (optional, for update)
 *   - transportRequest: string - Transport request (optional)
 * @param {Object} testCase - Test case for delays
 * @returns {Promise<{success: boolean, reason?: string, created?: boolean}>}
 */
async function createDependencyBehaviorDefinition(client, config, testCase) {
  if (!client || !config || !config.bdefName) {
    return {
      success: false,
      reason:
        'Invalid parameters for createDependencyBehaviorDefinition - environment problem, test skipped',
      created: false,
    };
  }

  let behaviorDefinitionCreated = false;
  let behaviorDefinitionLocked = false;
  let currentStep = '';

  try {
    // Step 1: Validate
    currentStep = 'validate';
    await client.validateBehaviorDefinition({
      rootEntity: config.rootEntity,
      packageName: config.packageName,
      description: config.description,
      implementationType: config.implementationType,
    });
    const validationResponse = client.getValidationResponse();

    if (validationResponse?.status !== 200) {
      const errorMessage = extractValidationErrorMessage(validationResponse);
      const errorTextLower = errorMessage.toLowerCase();

      // If behavior definition already exists, return skip reason (environment problem)
      if (
        errorTextLower.includes('already exists') ||
        errorTextLower.includes('does already exist') ||
        errorTextLower.includes('exceptionresourcealreadyexists')
      ) {
        return {
          success: false,
          reason: `Dependency behavior definition ${config.bdefName} already exists (may be owned by another user) - environment problem, test skipped`,
          created: false,
        };
      }

      // Other validation errors (environment problem)
      return {
        success: false,
        reason: `Dependency behavior definition validation failed: ${errorMessage} - environment problem, test skipped`,
        created: false,
      };
    }

    // Step 2: Create
    currentStep = 'create';
    await client.createBehaviorDefinition({
      name: config.bdefName,
      packageName: config.packageName,
      description: config.description,
      rootEntity: config.rootEntity,
      implementationType: config.implementationType,
      transportRequest: config.transportRequest,
    });
    behaviorDefinitionCreated = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('create', testCase) || 1000),
    );

    // Step 3: Lock
    currentStep = 'lock';
    await client.lockBehaviorDefinition({ name: config.bdefName });
    behaviorDefinitionLocked = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('lock', testCase) || 1000),
    );

    // Step 4: Update (if sourceCode provided)
    if (config.sourceCode) {
      currentStep = 'update';
      await client.updateBehaviorDefinition({
        name: config.bdefName,
        sourceCode: config.sourceCode,
      });
      await new Promise((resolve) =>
        setTimeout(resolve, getOperationDelay('update', testCase) || 1000),
      );
    }

    // Step 5: Unlock
    currentStep = 'unlock';
    await client.unlockBehaviorDefinition({ name: config.bdefName });
    behaviorDefinitionLocked = false;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('unlock', testCase) || 1000),
    );

    // Step 6: Activate
    currentStep = 'activate';
    await client.activateBehaviorDefinition({ name: config.bdefName });
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('activate', testCase) || 2000),
    );

    return {
      success: true,
      created: true,
    };
  } catch (error) {
    // Cleanup: unlock and delete if behavior definition was created/locked
    if (behaviorDefinitionLocked || behaviorDefinitionCreated) {
      try {
        if (behaviorDefinitionLocked) {
          await client.unlockBehaviorDefinition({ name: config.bdefName });
        }
        if (behaviorDefinitionCreated) {
          await client.deleteBehaviorDefinition({
            name: config.bdefName,
            transportRequest: config.transportRequest || '',
          });
        }
      } catch (cleanupError) {
        // Log but don't fail - original error is more important
        // Cleanup errors are silent to avoid noise
      }
    }

    // Any error = environment problem, test should be skipped
    return {
      success: false,
      reason: `Failed to create dependency behavior definition ${config.bdefName}: ${error instanceof Error ? error.message : String(error)} - environment problem, test skipped`,
      created: false,
    };
  }
}

/**
 * Check if an HTTP status code is allowed/expected for a test case
 * When allowed, the test can skip gracefully instead of failing
 */
function isHttpStatusAllowed(statusCode, testCase) {
  if (testCase?.params?.allow_406 === true && statusCode === 406) {
    return true;
  }
  const config = loadTestConfig();
  if (config.test_settings?.allow_406 === true && statusCode === 406) {
    return true;
  }
  return false;
}

/**
 * Extract Accept header hint from an HTTP error response
 * Returns a human-readable string about supported content types, or null
 */
function getAcceptHint(error) {
  if (!error?.response) return null;
  const status = error.response.status;
  if (status !== 406) return null;

  const contentType = error.response.headers?.['content-type'] || '';
  const data =
    typeof error.response.data === 'string' ? error.response.data : '';

  // Try to extract supported types from error response
  const typeMatch =
    data.match(/supported[^:]*:\s*([^\n]+)/i) ||
    data.match(/accept[^:]*:\s*([^\n]+)/i);
  if (typeMatch) {
    return `Server supports: ${typeMatch[1].trim()}`;
  }

  if (contentType) {
    return `Response content-type: ${contentType}`;
  }

  return 'HTTP 406 Not Acceptable - check Accept headers';
}

/**
 * Wrap a promise with Accept header error handling
 * On 406 errors, enhances the error with accept hint info
 */
async function withAcceptHandling(promise) {
  try {
    return await promise;
  } catch (error) {
    if (error?.response?.status === 406) {
      const hint = getAcceptHint(error);
      if (hint) {
        error.message = `${error.message} (${hint})`;
      }
    }
    throw error;
  }
}

// ─── Shared Dependencies ────────────────────────────────────────────────────

let _sharedPackageReady = false;
const _verifiedDependencies = {};

/**
 * Get the shared_dependencies config section from test-config.yaml
 * @returns {Object|null}
 */
function getSharedDependenciesConfig() {
  const config = loadTestConfig();
  return config.shared_dependencies || null;
}

/**
 * Get the shared package name (falls back to default_package)
 * @returns {string}
 */
function getSharedPackage() {
  const sharedConfig = getSharedDependenciesConfig();
  return sharedConfig?.package || getDefaultPackage();
}

/**
 * Look up a shared dependency by type and name
 * @param {'tables'|'views'|'behavior_definitions'} type - Dependency collection type
 * @param {string} name - Object name (e.g., "ZADT_VIEW_TBL01")
 * @returns {Object|null} The dependency config (name, description, source, etc.)
 */
function resolveSharedDependency(type, name) {
  const sharedConfig = getSharedDependenciesConfig();
  if (!sharedConfig) return null;

  const collection = sharedConfig[type];
  if (!Array.isArray(collection)) return null;

  return collection.find((item) => item.name === name) || null;
}

/**
 * Ensure the shared sub-package exists (create if missing).
 * Skips after first successful verification (in-memory flag).
 * @param {Object} client - AdtClient instance
 * @param {Object} logger - Logger instance
 */
async function ensureSharedPackage(client, logger) {
  if (_sharedPackageReady) return;

  const sharedConfig = getSharedDependenciesConfig();
  if (!sharedConfig?.package) return;

  const packageName = sharedConfig.package;

  // Check if package exists
  try {
    const pkgHandler = client.getPackage();
    const readResult = await pkgHandler.read({ packageName });
    if (readResult?.readResult) {
      logger?.info?.(`Shared package ${packageName} already exists`);
      _sharedPackageReady = true;
      return;
    }
  } catch (_error) {
    // Package doesn't exist — will create below
  }

  // Create the package
  try {
    const transportRequest = resolveTransportRequest(
      sharedConfig.transport_request,
    );
    await client.getPackage().create({
      packageName,
      description: 'Shared test dependencies package',
      superPackage: sharedConfig.super_package,
      softwareComponent: sharedConfig.software_component,
      transportLayer: sharedConfig.transport_layer,
      packageType: 'development',
      transportRequest,
    });
    logger?.info?.(`Created shared package ${packageName}`);
  } catch (error) {
    if (
      error.message?.includes('409') ||
      error.message?.includes('already exist')
    ) {
      logger?.info?.(`Shared package ${packageName} already exists`);
    } else {
      logger?.warn?.(
        `Failed to create shared package ${packageName}: ${error.message}`,
      );
      throw error;
    }
  }

  _sharedPackageReady = true;
}

/**
 * Ensure a shared dependency object exists. Creates it if missing, never deletes.
 * Uses in-memory cache to skip verification after first check.
 *
 * @param {Object} client - AdtClient instance
 * @param {'tables'|'views'|'behavior_definitions'} type - Dependency type
 * @param {string} name - Object name
 * @param {Object} logger - Logger instance
 * @returns {Promise<{existed: boolean, created: boolean}>}
 */
async function ensureSharedDependency(client, type, name, logger) {
  const cacheKey = `${type}:${name}`;
  if (_verifiedDependencies[cacheKey]) {
    logger?.info?.(`Shared ${type} ${name} already verified, skipping`);
    return { existed: true, created: false };
  }

  const depConfig = resolveSharedDependency(type, name);
  if (!depConfig) {
    throw new Error(
      `Shared dependency ${type}:${name} not found in shared_dependencies config`,
    );
  }

  const sharedConfig = getSharedDependenciesConfig();
  const packageName = sharedConfig?.package || getDefaultPackage();
  const transportRequest = resolveTransportRequest(
    sharedConfig?.transport_request,
  );

  // Check if the object already exists
  let exists = false;
  try {
    if (type === 'tables') {
      const result = await client.getTable().read({ tableName: name });
      // Table read returns { readResult: undefined } on 404 (quirk)
      exists = result?.readResult !== undefined;
    } else if (type === 'views') {
      await client.getView().read({ viewName: name });
      exists = true;
    } else if (type === 'behavior_definitions') {
      await client.getBehaviorDefinition().read({ name });
      exists = true;
    }
  } catch (error) {
    // 404 or similar — object doesn't exist
    exists = false;
  }

  if (exists) {
    logger?.info?.(`Shared ${type} ${name} already exists`);
    _verifiedDependencies[cacheKey] = true;
    return { existed: true, created: false };
  }

  // Create the object (high-level create does full chain: validate → create → lock → update → unlock → activate)
  logger?.info?.(`Creating shared ${type} ${name}...`);
  try {
    if (type === 'tables') {
      await client.getTable().create({
        tableName: name,
        packageName,
        description: depConfig.description || 'Shared test table',
        ddlCode: depConfig.source,
        transportRequest,
      });
    } else if (type === 'views') {
      await client.getView().create({
        viewName: name,
        packageName,
        description: depConfig.description || 'Shared test view',
        ddlSource: depConfig.source,
        transportRequest,
      });
    } else if (type === 'behavior_definitions') {
      await client.getBehaviorDefinition().create({
        name,
        packageName,
        rootEntity: depConfig.root_entity || name,
        implementationType: depConfig.implementation_type || 'Managed',
        description: depConfig.description || 'Shared test BDEF',
        sourceCode: depConfig.source,
        transportRequest,
      });
    }
    logger?.info?.(`Created shared ${type} ${name}`);
    _verifiedDependencies[cacheKey] = true;
    return { existed: false, created: true };
  } catch (error) {
    if (
      error.message?.includes('409') ||
      error.message?.includes('already exist')
    ) {
      logger?.info?.(
        `Shared ${type} ${name} already exists (concurrent creation)`,
      );
      _verifiedDependencies[cacheKey] = true;
      return { existed: true, created: false };
    }
    throw error;
  }
}

/**
 * Clear in-memory caches for shared dependencies (for debugging/testing)
 */
function resetSharedDependencyCache() {
  _sharedPackageReady = false;
  for (const key of Object.keys(_verifiedDependencies)) {
    delete _verifiedDependencies[key];
  }
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
  loadTestEnv,
  validateUserSpaceObject,
  validateTestCaseForUserSpace,
  getTimeout, // Add getTimeout from root helper
  getTestTimeout, // Add getTestTimeout from root helper
  resolveStandardObject, // Add resolveStandardObject helper
  getOperationDelay, // Get delay for SAP operations
  parseValidationResponse, // Parse validation response from ADT
  checkValidationResult, // Check validation result and throw if failed
  retryCheckAfterActivate, // Retry check operation after activate
  checkPackageExists, // Check if package exists using searchObjects
  validateTestParameters, // Validate test parameters (package, transport)
  checkDefaultTestEnvironment, // Check default test environment before all tests
  logDefaultTestEnvironment, // Log default test environment in one line
  createDependencyTable, // Create dependency table with full workflow (validate → create → lock → update → unlock → activate)
  createDependencyCdsView, // Create dependency CDS view with full workflow (validate → create → lock → update → unlock → activate)
  createDependencyDomain, // Create dependency domain with full workflow (validate → create → lock → update → unlock → activate)
  createDependencyFunctionGroup, // Create dependency function group with full workflow (validate → create → lock → unlock → activate)
  createDependencyBehaviorDefinition, // Create dependency behavior definition with full workflow (validate → create → lock → update → unlock → activate)
  extractValidationErrorMessage, // Extract meaningful error message from validation response (parses XML)
  isHttpStatusAllowed, // Check if HTTP status is allowed/expected for test case
  getAcceptHint, // Extract Accept header hint from error response
  withAcceptHandling, // Wrap promise with Accept header error handling
  getDefaultMasterSystem, // Get default master system from config or env
  resolveMasterSystem, // Resolve master system from param or environment
  // Shared dependencies
  getSharedDependenciesConfig, // Get shared_dependencies section from config
  getSharedPackage, // Get shared package name (fallback: default_package)
  resolveSharedDependency, // Look up dependency config by type + name
  ensureSharedPackage, // Create shared sub-package if it doesn't exist
  ensureSharedDependency, // Ensure shared dependency exists (create if missing, never delete)
  resetSharedDependencyCache, // Clear in-memory caches (for debugging)
};
