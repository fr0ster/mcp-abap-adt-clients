/**
 * Test configuration helper for @mcp-abap-adt/adt-clients
 * Loads test parameters from test-config.yaml.template + test-config.overlay.yaml
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');
const dotenv = require('dotenv');
const { XMLParser } = require('fast-xml-parser');
// Every member that takes `options.headers` gets the recorded pair; a member
// with none fails loudly instead of sending a fake one to SAP.
const { integrationHeadersOf } = require('./adtHeaders');
const {
  analyseActivation,
  analyseException,
} = require('@mcp-abap-adt/adt-strategies');
// Every expected-success call is judged, the exception document first.
const { judged } = require('./judged');
const {
  loadTestConfigFrom,
  overlayPathFromEnv,
} = require('../../../scripts/lib/testConfigOverlay');

let cachedConfig = null;
let configLoadedFrom = null;
let displayedTemplateWarning = false;
let cachedEnvType = null;

/**
 * Write a shared object's source and leave it active.
 *
 * Since adt-clients 18.0.0 a member issues one request: `update` is the write
 * and carries the handle it is given, so the lock, the write, the unlock and
 * the activation are four calls a caller makes in the order it chooses. This
 * setup script is such a caller, and it makes them here once rather than in
 * twenty-four places.
 *
 * The unlock runs whatever the write answered — a handle left held is what
 * makes the next run's create answer 403 with nothing appearing to hold it —
 * and a refusal at any point is thrown, because a shared dependency that was
 * not written is not one the suite can build on.
 */
async function writeAndActivate(handler, config, options, logger) {
  await writeSource(handler, config, options, logger);
  if (typeof handler.activate === 'function') {
    // `analyseActivation` reads the verdict inside the 200:
    // activationExecuted="false" or a message of type E is a refusal.
    const activated = await handler.activate(config, {
      headers: integrationHeadersOf(handler, 'activate', config),
      analyse: judged(analyseActivation),
    });
    if (activated && activated.ok === false) {
      const failure = activated.getError();
      throw new Error(
        `activate failed [${failure.origin}]: ${failure.message}`,
      );
    }
  }
}

/**
 * The write half of {@link writeAndActivate}: lock, write, unlock — nothing
 * activated. For an object whose activation belongs to a later group run.
 * Since 23.0.0 `create` is the POST alone and drops `source`; an object that
 * is created and not written reads back with an empty source.
 */
async function writeSource(handler, config, options, logger) {
  const raise = (answer, what) => {
    if (answer && answer.ok === false) {
      const failure = answer.getError();
      throw new Error(`${what} failed [${failure.origin}]: ${failure.message}`);
    }
    return answer && answer.ok ? answer.getResult().value : undefined;
  };

  let handle;
  if (typeof handler.lock === 'function') {
    handle = raise(
      await handler.lock(config, { analyse: analyseException }),
      'lock',
    );
  }
  let writeFailed = true;
  let unlockRefusal = '';
  try {
    // `update` writes a source; a type that has none writes its document with
    // `updateMetadata`, and since 18.0.0 it offers only that. A domain, a data
    // element, a package, a table type, a function group and their neighbours
    // are their own document. Written as a capability question rather than a
    // list of type names, so a new document-only type needs nothing here.
    //
    // The write carries `source` and nothing else from the caller, written
    // out rather than spread: a spread could bring an `analyse` of its own
    // over this one, and a key nobody expected is refused instead of sent.
    const { source, ...unexpected } = options ?? {};
    if (Object.keys(unexpected).length > 0) {
      throw new Error(
        `writeSource takes { source } only, got ${Object.keys(unexpected).join(', ')}`,
      );
    }
    if (typeof handler.update === 'function')
      raise(
        await handler.update(config, {
          analyse: analyseException,
          source,
          lockHandle: handle,
          headers: integrationHeadersOf(handler, 'update', config),
        }),
        'update',
      );
    else
      raise(
        await handler.updateMetadata(config, {
          analyse: analyseException,
          source,
          lockHandle: handle,
          headers: integrationHeadersOf(handler, 'updateMetadata', config),
        }),
        'updateMetadata',
      );
    writeFailed = false;
  } finally {
    if (handle && typeof handler.unlock === 'function') {
      const released = await handler.unlock(config, handle, {
        analyse: analyseException,
      });
      if (released && released.ok === false) {
        const refusal = `unlock failed, the handle may still be held: ${released.getError().message}`;
        // A refused unlock is a failure of its own: the handle left held is
        // what makes the next write answer 403. When the write already
        // failed, that failure is the one in flight, so this one is logged
        // beside it instead of replacing it.
        if (writeFailed) logger?.warn?.(refusal);
        else unlockRefusal = refusal;
      }
    }
  }
  if (unlockRefusal) throw new Error(unlockRefusal);
}

/**
 * Whether a refused read says the object is not there.
 *
 * SAP's text outranks the status: a function module's source answers `500`
 * with "Function module … does not exist" (FL651) inside, and a status alone
 * would call that a server fault. Only an answer without a text is judged by
 * its status, and then only 404 is absence. `failure.message` is SAP's text
 * when a strategy read it, and the transport's sentence ("Request failed with
 * status code 500") when none did, so the document itself is read too.
 */
function answerSaysAbsent(failure) {
  const data = failure?.response?.data;
  const document =
    typeof data === 'string' ? data : data == null ? '' : String(data);
  const texts = [failure?.adtType ?? '', failure?.message ?? '', document];
  const said = texts.join('\n');
  if (/ExceptionResourceNotFound|does not exist/i.test(said)) return true;
  if (document.trim() !== '') return false;
  return failure?.response?.status === 404;
}

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
 * Determine current environment type from test config.
 * Returns 'cloud', 'legacy', or 'onprem'.
 */
function getEnvironmentType() {
  if (cachedEnvType) {
    return cachedEnvType;
  }
  const config = loadTestConfig();
  // connection_type (rfc/http) is a transport mechanism, not a system type.
  // Use explicit is_legacy: true in environment config to mark BASIS < 7.50 systems.
  if (config?.environment?.is_legacy === true) {
    cachedEnvType = 'legacy';
  } else {
    // Will be refined later when isCloud is known; default to 'onprem'
    cachedEnvType = 'onprem';
  }
  return cachedEnvType;
}

/**
 * Check if a test case is available for the current environment based on available_in.
 * If available_in is not specified, the test is available everywhere.
 */
function isTestAvailableForEnv(testCase) {
  if (!testCase) {
    return false;
  }
  const availableIn = testCase.available_in;
  if (!availableIn || !Array.isArray(availableIn) || availableIn.length === 0) {
    return true;
  }
  return availableIn.includes(getEnvironmentType());
}

/**
 * Load test configuration: the tracked base (`test-config.yaml.template`)
 * merged with the local overlay (`test-config.overlay.yaml`), see
 * scripts/lib/testConfigOverlay.js. Without an overlay the base alone is
 * returned and `isTestConfigTemplate()` is true. A defective overlay, or the
 * old full `test-config.yaml`, throws a TestConfigError naming the fault.
 *
 * `MCP_TEST_OVERLAY` names the overlay of this checkout's own directory, one
 * per system; a caller handing in another directory reads that directory's
 * files alone.
 */
function loadTestConfig(configDirectory = __dirname) {
  if (cachedConfig) {
    return cachedConfig;
  }

  const { config, source } = loadTestConfigFrom(
    configDirectory,
    configDirectory === __dirname ? overlayPathFromEnv() : undefined,
  );
  if (source === 'base-only' && !displayedTemplateWarning) {
    console.warn(
      '⚠️ test-config.overlay.yaml not found. Using test-config.yaml.template alone; its values are placeholders (e.g. default_package <DEV_PACKAGE>).',
    );
    console.warn(
      '   Run `npm run test:init -- onprem` (or `cloud`) and fill in your SAP system details.',
    );
    displayedTemplateWarning = true;
  }
  cachedConfig = config;
  configLoadedFrom = source === 'base-only' ? 'template' : 'custom';
  return cachedConfig;
}

/** Whether the cached configuration came from the placeholder template. */
function isTestConfigTemplate() {
  loadTestConfig();
  return configLoadedFrom === 'template';
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

  // Filter by available_in if specified
  if (!isTestAvailableForEnv(enabledTest)) {
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

  const enabledTests = handlerTests.filter(
    (tc) => tc.enabled === true && isTestAvailableForEnv(tc),
  );
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
/**
 * The `session_config` block, which lives at the ROOT of test-config.yaml.
 *
 * Not under `environment` — reading it from there is how
 * `cleanup_session_after_test: false` came to be ignored for as long as it has
 * existed: `getEnvironmentConfig().session_config` is `undefined`, and the
 * caller's `!== false` then read that as "yes, recycle".
 */
function getSessionConfig() {
  return loadTestConfig().session_config || {};
}

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
  // A configured string is a statement, "" included (a cloud system has no
  // master system); the environment answers only when the key is absent.
  if (typeof envConfig.default_master_system === 'string') {
    return envConfig.default_master_system;
  }
  return process.env.SAP_SYSTEM_ID || '';
}

/**
 * Resolve master system from explicit param or environment
 * @param {string|undefined} masterSystem
 * @returns {string} resolved master system or empty string
 */
function resolveMasterSystem(masterSystem) {
  if (masterSystem?.trim()) {
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
  if (packageName?.trim()) {
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
    'ddl_name',
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

  let testCase;
  if (!testCaseName) {
    testCase = handlerTests[0] || null;
  } else {
    testCase = handlerTests.find((tc) => tc.name === testCaseName) || null;
  }

  // Filter by available_in if specified
  if (testCase && !isTestAvailableForEnv(testCase)) {
    return null;
  }

  return testCase;
}

/**
 * Resolve standard SAP object name for read tests
 * Supports both test-case-specific params and global standard_objects registry
 * @param {string} objectType - Type of object ('class', 'domain', 'table', etc.)
 * @param {boolean} isCloud - Whether the system is cloud (true) or on-premise (false)
 * @param {object} [testCase] - Optional test case with params (e.g., { params: { standard_class_name_onprem: '...' } })
 * @returns {{name: string, group?: string} | null} - Object name and optional group (for function modules), or null if not found
 */
function resolveStandardObject(
  objectType,
  isCloud,
  testCase = null,
  isLegacy = false,
) {
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
    functionInclude: {
      yamlKey: 'function_group_includes',
      paramSuffix: 'include_name',
    },
    function_include: {
      yamlKey: 'function_group_includes',
      paramSuffix: 'include_name',
    },
    program: { yamlKey: 'programs', paramSuffix: 'program_name' },
    include: { yamlKey: 'includes', paramSuffix: 'include_name' },
    transformation: {
      yamlKey: 'transformations',
      paramSuffix: 'transformation_name',
    },
    package: { yamlKey: 'packages', paramSuffix: 'package_name' },
    view: { yamlKey: 'views', paramSuffix: 'ddl_name' },
    serviceDefinition: {
      yamlKey: 'service_definitions',
      paramSuffix: 'service_definition_name',
    },
    service_definition: {
      yamlKey: 'service_definitions',
      paramSuffix: 'service_definition_name',
    },
    serviceBinding: {
      yamlKey: 'service_bindings',
      paramSuffix: 'service_binding_name',
    },
    service_binding: {
      yamlKey: 'service_bindings',
      paramSuffix: 'service_binding_name',
    },
    tabletype: { yamlKey: 'tabletypes', paramSuffix: 'tabletype_name' },
    tableType: { yamlKey: 'tabletypes', paramSuffix: 'tabletype_name' },
    table_type: { yamlKey: 'tabletypes', paramSuffix: 'tabletype_name' },
    accessControl: {
      yamlKey: 'access_controls',
      paramSuffix: 'access_control_name',
    },
    access_control: {
      yamlKey: 'access_controls',
      paramSuffix: 'access_control_name',
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
  const envFilter = isCloud ? 'cloud' : isLegacy ? 'legacy' : 'onprem';
  const availableObjects = objectsList.filter((obj) =>
    obj.available_in?.includes(envFilter),
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
 * @param {Object} response - ADT response from the validation endpoint
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
        const data = obj['asx:abap']?.['asx:values']?.DATA || obj.DATA;
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
        let localizedMessage = exception.localizedMessage;
        if (localizedMessage && typeof localizedMessage === 'object') {
          localizedMessage =
            localizedMessage['#text'] ||
            localizedMessage.text ||
            localizedMessage;
        }
        if (typeof localizedMessage === 'object') {
          localizedMessage = JSON.stringify(localizedMessage);
        }

        let message = exception.message;
        if (message && typeof message === 'object') {
          message = message['#text'] || message.text || message;
        }
        if (typeof message === 'object') {
          message = JSON.stringify(message);
        }

        // Extract exception type
        let exceptionType = exception.type;
        if (exceptionType && typeof exceptionType === 'object') {
          exceptionType =
            exceptionType['#text'] || exceptionType.text || exceptionType;
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
      if (result['asx:abap'] || result['asx:values'] || result.DATA) {
        const data = result['asx:abap']?.['asx:values']?.DATA || result.DATA;
        if (data) {
          if (data.SHORT_TEXT) {
            return String(data.SHORT_TEXT);
          }
          if (data.SEVERITY && data.SEVERITY !== 'OK') {
            return `Validation error: ${data.SHORT_TEXT || data.SEVERITY}`;
          }
        }
      }

      // Check for direct SEVERITY/SHORT_TEXT format (function group validation)
      if (result.SEVERITY) {
        const severity = result.SEVERITY;
        const shortText = result.SHORT_TEXT || result.shortText || '';
        if (severity !== 'OK' && shortText) {
          return String(shortText);
        }
        if (severity !== 'OK') {
          return `Validation error (${severity})`;
        }
      }

      // Check for exception with resource information (e.g., "Resource FUGR_MAINPROGRAM ...")
      if (result.exception || result['exc:exception']) {
        const exc = result.exception || result['exc:exception'];
        if (exc.message) {
          const msg = String(exc.message);
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
      ? `${errorText.substring(0, 500)}...`
      : errorText;
  } catch (parseError) {
    // If parsing fails, return raw data (limited)
    const errorData = response.data;
    const errorText =
      typeof errorData === 'string'
        ? errorData
        : JSON.stringify(errorData || {});
    return errorText.length > 500
      ? `${errorText.substring(0, 500)}...`
      : errorText;
  }
}

/**
 * Check if package exists using searchObjects
 *
 * Throws when the check itself could not run. It previously answered `false` for
 * that case, which is a different statement: "the package is not there" rather
 * than "I could not look". The `require` below pointed at
 * `src/__tests__/src/core/...` — a path that has never existed — so every call
 * threw `MODULE_NOT_FOUND`, was caught here, and reported the root package
 * missing. `Ddl.test.ts` is the only integration test that calls
 * `checkDefaultTestEnvironment`, so it alone skipped every test it owns and
 * still reported PASS, while the tests around it created objects in the very
 * package this claimed was absent.
 *
 * Parsing goes through `readSearchHits` (adt-strategies) rather than a local
 * XML reader.
 * ADT is not consistent across releases about namespacing quickSearch hits —
 * `<adtcore:objectReference adtcore:name>` on some, `<objectReference name>` on
 * others — and `readSearchHits` already accepts both, with tests. The copy
 * that used to live here required the literal `<adtcore:objectReference` and
 * read only the prefixed attribute, so on a system emitting the unprefixed
 * form the lookup would succeed and this would still answer "missing" — the
 * same silent skip as above, reached by a different route.
 *
 * @param {Object} connection - ABAP connection
 * @param {string} packageName - Package name to check
 * @returns {Promise<boolean>} True if package exists, false if it does not
 * @throws when the existence check could not be performed
 */
async function checkPackageExists(connection, packageName) {
  try {
    // Dynamically required to avoid circular dependencies
    const { searchObjects } = require('../../core/shared/search');
    const { readSearchHits } = require('@mcp-abap-adt/adt-strategies');

    const answer = await searchObjects(connection, {
      query: `${packageName}*`,
      objectType: 'DEVC',
      maxResults: 101,
    });
    const hits = readSearchHits(String(answer?.data ?? ''));

    return hits.some(
      (hit) => hit.name?.toUpperCase() === packageName.toUpperCase(),
    );
  } catch (error) {
    throw new Error(
      `Could not check whether package ${packageName} exists: ${error instanceof Error ? error.message : String(error)}`,
    );
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
      reason: 'Invalid parameters for createDependencyDomain',
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
          reason: `Dependency domain ${config.domainName} already exists (may be owned by another user)`,
          created: false,
        };
      }

      // Other validation errors (environment problem)
      return {
        success: false,
        reason: `Dependency domain validation failed: ${errorMessage}`,
        created: false,
      };
    }

    // Step 2: Create
    currentStep = 'create';
    mustSucceed(
      await client.createDomain({
        domainName: config.domainName,
        packageName: config.packageName,
        description: config.description || '',
      }),
      'dependency domain createDomain',
    );
    domainCreated = true;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('create', testCase) || 1000),
    );

    // Step 3: Lock
    currentStep = 'lock';
    mustSucceed(
      await client.lockDomain({ domainName: config.domainName }),
      'dependency domain lockDomain',
    );
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
    mustSucceed(
      await client.updateDomain(updateConfig),
      'dependency domain updateDomain',
    );
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('update', testCase) || 1000),
    );

    // Step 5: Unlock
    currentStep = 'unlock';
    mustSucceed(
      await client.unlockDomain({ domainName: config.domainName }),
      'dependency domain unlockDomain',
    );
    domainLocked = false;
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('unlock', testCase) || 1000),
    );

    // Step 6: Activate
    currentStep = 'activate';
    mustSucceed(
      await client.activateDomain({ domainName: config.domainName }),
      'dependency domain activateDomain',
    );
    await new Promise((resolve) =>
      setTimeout(resolve, getOperationDelay('activate', testCase) || 2000),
    );

    return {
      success: true,
      created: true,
    };
  } catch (error) {
    // Cleanup: unlock and delete if domain was created/locked. The original
    // error is the one returned; a cleanup that fails too is named beside it,
    // since the domain may be left on the system.
    let cleanupNote = '';
    if (domainLocked || domainCreated) {
      try {
        if (domainLocked) {
          mustSucceed(
            await client.unlockDomain({ domainName: config.domainName }),
            'dependency domain unlockDomain',
          );
        }
        if (domainCreated) {
          mustSucceed(
            await client.deleteDomain({
              domainName: config.domainName,
              transportRequest: config.transportRequest || '',
            }),
            'dependency domain deleteDomain',
          );
        }
      } catch (cleanupError) {
        cleanupNote = `; the cleanup after it failed too: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
      }
    }

    // Any error fails the setup of the test that needs the domain.
    return {
      success: false,
      reason: `Failed to create dependency domain ${config.domainName}: ${error instanceof Error ? error.message : String(error)}${cleanupNote}`,
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
 * @param {'tables'|'views'|'behavior_definitions'|'function_groups'} type - Dependency collection type
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
 * The value, or a throw carrying what SAP said.
 *
 * Every create and update below used to be `await client.getX().y(...)` with
 * the answer dropped on the floor. That was survivable while a failure threw;
 * since the contract migration a failure is the other half of the answer, so a
 * create that never happened returned normally and the setup counted it as
 * done. Measured: `shared:setup` announced "ZAC_SHR_RUN01 updated and
 * activated", reported "16 already existed, 0 failed", and the class was not on
 * the system at all.
 *
 * It throws rather than returning a flag because every caller here is a setup
 * step whose next step depends on it, and because the surrounding `catch`
 * blocks — the cloud post-create verify, the "already exists" recovery — were
 * written for a throw.
 */
function mustSucceed(answer, what) {
  if (!answer || typeof answer.ok !== 'boolean') {
    // Not a contract: a helper that answers something else is doing its own
    // thing, and this is not the place to guess what.
    return answer;
  }
  if (!answer.ok) {
    const failure = answer.getError();
    // The status and SAP's own sentence, so a refusal says what it was: the
    // message alone is the transport's "Request failed with status code …"
    // whenever no strategy read the body.
    const status = failure.response?.status;
    const said = sapMessageOf(failure.response?.data);
    throw new Error(
      `${what} failed [${failure.origin}]${status ? ` ${status}` : ''}: ${failure.message}` +
        (said && !String(failure.message ?? '').includes(said)
          ? ` — SAP: ${said}`
          : '') +
        (failure.request?.url ? ` (${failure.request.url})` : ''),
    );
  }
  return answer.getResult().value;
}

/**
 * The text of the first `<message …>` (or `<ns:message …>`) element of an ADT
 * exception document, or ''.
 */
function sapMessageOf(data) {
  const text = typeof data === 'string' ? data : '';
  const open = text.search(/<(\w+:)?message[\s>]/);
  if (open < 0) return '';
  const start = text.indexOf('>', open);
  const end = text.indexOf('</', start);
  if (start < 0 || end < 0) return '';
  return text.slice(start + 1, end).trim();
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

  // Check if package exists.
  //
  // `readResult` was a field on the state bag, and the state bags are gone: this
  // read `readResult?.readResult`, which is now always `undefined`, so the
  // package was re-created on every run.
  //
  // A package is its own document: `getPackage()` offers `readMetadata`
  // and no `read`, since 18.0.0 named each member for the resource it
  // addresses. This file is JavaScript, so `tsc` could not say so.
  //
  // Only an answer naming the package as absent leads to the create. A read
  // that was refused for another reason, or threw, is "could not find out",
  // and fails setup with what was said.
  const answer = await client
    .getPackage()
    .readMetadata({ packageName }, { analyse: analyseException });
  if (answer.ok) {
    logger?.info?.(`Shared package ${packageName} already exists`);
    _sharedPackageReady = true;
    return;
  }
  const failure = answer.getError();
  if (!answerSaysAbsent(failure)) {
    throw new Error(
      `Could not determine whether shared package ${packageName} exists: ${failure.message}. ` +
        'Refusing to assume it is missing.',
    );
  }

  // Create the package. A refused create fails setup — a 409 or "already
  // exists" included: the read above said the package is absent, so such an
  // answer is a refusal of this create, not a package made ready.
  const transportRequest = resolveTransportRequest(
    sharedConfig.transport_request,
  );
  mustSucceed(
    await client.getPackage().create(
      {
        packageName,
        description: 'Shared test dependencies package',
        superPackage: sharedConfig.super_package,
        softwareComponent: sharedConfig.software_component,
        transportLayer: sharedConfig.transport_layer,
        packageType: 'development',
        transportRequest,
        // A transportable software component (HOME on an on-premise system)
        // refuses a package without change recording (TR432); a local one
        // (ZLOCAL, LOCAL, $) does not want it. Stated in the config, not guessed.
        recordChanges: sharedConfig.record_changes === true,
      },
      {
        analyse: analyseException,
        headers: integrationHeadersOf(client.getPackage(), 'create'),
      },
    ),
    `shared package create ${packageName}`,
  );
  logger?.info?.(`Created shared package ${packageName}`);

  _sharedPackageReady = true;
}

/**
 * Ensure a shared dependency object exists. Creates it if missing, never deletes.
 * Uses in-memory cache to skip verification after first check.
 *
 * @param {Object} client - AdtClient instance
 * @param {'tables'|'views'|'behavior_definitions'|'function_groups'} type - Dependency type
 * @param {string} name - Object name
 * @param {Object} logger - Logger instance
 * @returns {Promise<{existed: boolean, created: boolean}>}
 */

/**
 * Read the document a document-only type's update has to send back.
 *
 * **A read that answers nothing is not a document.** ADT answers a read of an
 * object that is not ready yet with HTTP 200 and an empty body, and patching
 * that would assemble a document out of air — which is how a write ends up
 * shipping without the field it was supposed to carry, and the server gets
 * blamed for refusing it. An empty body is a failure here, named for the
 * object, and retried a few times because "not ready yet" passes.
 */
async function readDocumentForUpdate(read, what, logger) {
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const answer = await read();
    if (!answer.ok) {
      const failure = answer.getError();
      throw new Error(`${what} failed [${failure.origin}]: ${failure.message}`);
    }
    last = String(answer.getResult().value ?? '');
    if (last.trim() !== '') return last;
    logger?.debug?.(`${what} came back empty (attempt ${attempt}), retrying`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `${what} came back empty three times — ADT answers a read of an object ` +
      'that is not ready with 200 and no body, and there is nothing to patch',
  );
}

/**
 * The configured shape, patched into the document the server just gave us.
 *
 * **The create makes a shell and the update is what gives it a type.** A
 * domain's POST carries the description, the language and the package
 * reference, and nothing else — `<doma:datatype/>` comes back empty and
 * `<doma:length>` reads `000000`. Passing `datatype` and `length` to the update
 * as loose fields did nothing either: since 19.0.0 the update writes
 * `config.document` and merges nothing, so a config without one PUT
 * `undefined`. Every shared domain has been sitting there with no data type.
 *
 * Lengths are written as the six digits the server itself serialises, rather
 * than the bare number the pre-19.0.0 merge used, so the document goes back in
 * the shape it came out.
 */
function domainDocumentFor(current, depConfig) {
  // Required here rather than at the top: this module is loaded by plain node
  // as well as by ts-jest, and only the latter can resolve a TypeScript path.
  const {
    patchIf,
    patchXmlAttribute,
    patchXmlElement,
  } = require('../../utils/xmlPatch');
  let xml = patchXmlAttribute(
    current,
    'adtcore:description',
    (depConfig.description || 'Shared test domain').slice(0, 60),
  );
  xml = patchXmlElement(xml, 'doma:datatype', depConfig.datatype || 'CHAR');
  xml = patchXmlElement(
    xml,
    'doma:length',
    String(depConfig.length || 10).padStart(6, '0'),
  );
  return patchIf(xml, depConfig.decimals, (x, val) =>
    patchXmlElement(x, 'doma:decimals', String(val).padStart(6, '0')),
  );
}

/**
 * The same, for a data element: its type kind, and the domain it points at or
 * the predefined type it carries (`data_type`, `length`, `decimals`, lengths
 * as six digits like the domain's).
 */
function dataElementDocumentFor(current, depConfig) {
  const {
    patchIf,
    patchXmlAttribute,
    patchXmlElement,
  } = require('../../utils/xmlPatch');
  let xml = patchXmlAttribute(
    current,
    'adtcore:description',
    (depConfig.description || 'Shared test data element').slice(0, 60),
  );
  const typeKind = depConfig.type_kind || 'domain';
  xml = patchXmlElement(xml, 'dtel:typeKind', typeKind);
  if (typeKind === 'domain' && depConfig.domain_name) {
    xml = patchXmlElement(
      xml,
      'dtel:typeName',
      String(depConfig.domain_name).toUpperCase(),
    );
  }
  if (typeKind !== 'domain' && depConfig.data_type) {
    xml = patchXmlElement(
      xml,
      'dtel:dataType',
      String(depConfig.data_type).toUpperCase(),
    );
    xml = patchIf(xml, depConfig.length, (x, val) =>
      patchXmlElement(x, 'dtel:dataTypeLength', String(val).padStart(6, '0')),
    );
    xml = patchIf(xml, depConfig.decimals, (x, val) =>
      patchXmlElement(x, 'dtel:dataTypeDecimals', String(val).padStart(6, '0')),
    );
  }
  return xml;
}

/**
 * Write a shared object's configured source, and activate it unless the
 * config says `skip_activation: true`.
 *
 * `skip_activation` is for objects that name each other — an AMDP class and
 * the table function it implements — and so can only be activated together:
 * each is written inactive here, and the caller activates the group
 * (`activateSharedGroup` in `sharedActivation.ts`, or `shared:setup`'s group
 * run).
 */
async function writeShared(handler, config, depConfig, logger) {
  if (depConfig.skip_activation) {
    await writeSource(handler, config, { source: depConfig.source }, logger);
    return;
  }
  await writeAndActivate(handler, config, { source: depConfig.source }, logger);
}

/**
 * The active source of an existing shared object, read for comparison; a
 * type with no source read here answers `undefined`.
 */
function readActiveSharedSource(client, type, name, depConfig) {
  const read = {
    tables: () =>
      client
        .getTable()
        .read({ tableName: name }, 'active', { analyse: analyseException }),
    structures: () =>
      client
        .getStructure()
        .read({ structureName: name }, 'active', { analyse: analyseException }),
    views: () =>
      client
        .getDdl()
        .read({ ddlName: name }, 'active', { analyse: analyseException }),
    programs: () =>
      client
        .getProgram()
        .read({ programName: name }, 'active', { analyse: analyseException }),
    behavior_definitions: () =>
      client
        .getBehaviorDefinition()
        .read({ name }, 'active', { analyse: analyseException }),
    classes: () =>
      client
        .getClass()
        .read({ className: name }, 'active', { analyse: analyseException }),
    access_controls: () =>
      client.getAccessControl().read({ accessControlName: name }, 'active', {
        analyse: analyseException,
      }),
    interfaces: () =>
      client
        .getInterface()
        .read({ interfaceName: name }, 'active', { analyse: analyseException }),
    function_modules: () =>
      client.getFunctionModule().read(
        {
          functionModuleName: name,
          functionGroupName: depConfig.function_group,
        },
        'active',
        { analyse: analyseException },
      ),
    function_group_includes: () =>
      client
        .getFunctionInclude()
        .read(
          { functionGroupName: depConfig.function_group, includeName: name },
          'active',
          { analyse: analyseException },
        ),
    service_definitions: () =>
      client
        .getServiceDefinition()
        .read({ serviceDefinitionName: name }, 'active', {
          analyse: analyseException,
        }),
  }[type];
  return read ? read() : undefined;
}

/**
 * Two sources are the same when they differ only in line endings, trailing
 * blanks at line ends, or blank lines at the end.
 */
function sameSource(a, b) {
  const lines = (text) => {
    const out = String(text ?? '')
      .split('\r\n')
      .join('\n')
      .split('\n')
      .map((line) => line.trimEnd());
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  };
  return lines(a) === lines(b);
}

/**
 * Whether an existing shared object's **active** source is already the
 * configured one. Then it is both right and active, and is left as it is:
 * no lock, no write, no activation.
 *
 * `false` only for what was found out: the active source read and differing,
 * an answer naming it absent (the object has no active version), or a type
 * with no source read here. A read refused for any other reason, or one that
 * throws, fails setup with what was said — a failed read never falls through
 * into a write over a shared object.
 */
async function sharedSourceIsCurrent(client, type, name, depConfig) {
  const answer = await readActiveSharedSource(client, type, name, depConfig);
  if (answer === undefined) return false;
  if (!answer.ok) {
    const failure = answer.getError();
    if (answerSaysAbsent(failure)) return false;
    throw new Error(
      `Could not read the active source of shared ${type} ${name}: ${failure.message}`,
    );
  }
  return sameSource(answer.getResult().value, depConfig.source);
}

/**
 * Update source and activate an existing shared dependency.
 * Called when object exists but may have outdated or inactive source.
 */
async function updateAndActivateShared(
  client,
  type,
  name,
  depConfig,
  transportRequest,
  logger,
) {
  // An object at the configured source and active is left alone: a lock and a
  // write on every run put it into whatever request the system chooses, and
  // gain nothing.
  if (await sharedSourceIsCurrent(client, type, name, depConfig)) {
    logger?.info?.(
      `Shared ${type} ${name} is at the configured source and active — left as it is`,
    );
    return false;
  }
  logger?.info?.(
    `Shared ${type} ${name} exists — updating source and activating...`,
  );
  if (type === 'tables') {
    await writeAndActivate(
      client.getTable(),
      { tableName: name, source: depConfig.source, transportRequest },
      { source: depConfig.source },
    );
  } else if (type === 'structures') {
    // A structure carries its source like a table does. Without this
    // branch it fell to the "no update logic, skipping" line below — so the run
    // announced "updating source and activating", did neither, and recorded the
    // object as satisfied. Both shared structures had been in that state.
    await writeAndActivate(
      client.getStructure(),
      { structureName: name, source: depConfig.source, transportRequest },
      { source: depConfig.source },
    );
  } else if (type === 'views') {
    await writeShared(
      client.getDdl(),
      { ddlName: name, source: depConfig.source, transportRequest },
      depConfig,
      logger,
    );
  } else if (type === 'programs') {
    await writeAndActivate(
      client.getProgram(),
      { programName: name, source: depConfig.source, transportRequest },
      { source: depConfig.source },
    );
  } else if (type === 'behavior_definitions') {
    await writeAndActivate(
      client.getBehaviorDefinition(),
      { name, source: depConfig.source, transportRequest },
      { source: depConfig.source },
    );
  } else if (type === 'classes') {
    await writeShared(
      client.getClass(),
      { className: name, source: depConfig.source, transportRequest },
      depConfig,
      logger,
    );
  } else if (type === 'access_controls') {
    mustSucceed(
      await writeAndActivate(
        client.getAccessControl(),
        {
          accessControlName: name,
          source: depConfig.source,
          transportRequest,
        },
        { source: depConfig.source },
      ),
      `shared accesscontrol update ${name}`,
    );
  } else if (type === 'interfaces') {
    mustSucceed(
      await writeAndActivate(
        client.getInterface(),
        {
          interfaceName: name,
          source: depConfig.source,
          transportRequest,
        },
        { source: depConfig.source },
      ),
      `shared interface update ${name}`,
    );
  } else if (type === 'function_modules') {
    mustSucceed(
      await writeAndActivate(
        client.getFunctionModule(),
        {
          functionModuleName: name,
          functionGroupName: depConfig.function_group,
          source: depConfig.source,
          transportRequest,
        },
        { source: depConfig.source },
      ),
      `shared functionmodule update ${name}`,
    );
  } else if (type === 'function_group_includes') {
    // The include is written under the *group's* lock, which the handler takes
    // for itself — the same shape as every other source-bearing type here.
    mustSucceed(
      await writeAndActivate(
        client.getFunctionInclude(),
        {
          functionGroupName: depConfig.function_group,
          includeName: name,
          source: depConfig.source,
          transportRequest,
        },
        { source: depConfig.source },
      ),
      `shared functioninclude update ${name}`,
    );
  } else if (type === 'service_definitions') {
    mustSucceed(
      await writeAndActivate(
        client.getServiceDefinition(),
        {
          serviceDefinitionName: name,
          source: depConfig.source,
          transportRequest,
        },
        { source: depConfig.source },
      ),
      `shared servicedefinition update ${name}`,
    );
  } else {
    logger?.info?.(`Shared ${type} ${name} — no update logic, skipping`);
    return false;
  }
  logger?.info?.(`Shared ${type} ${name} updated`);
  return true;
}

/**
 * Bring a shared function group to active, whether it was just created or was
 * already there.
 *
 * **Why a group needs this and the other ten types do not.** Every other
 * shared type carries a `source`, so the reconciliation path writes it and
 * activates in one move. A function group has none — it is a container — and
 * the branch that creates one simply stopped after the POST. Meanwhile
 * creating a function module inside it makes SAP regenerate `SAPL<group>`,
 * which comes back inactive, and the module's branch activates the module,
 * not the group.
 *
 * **Answers the state, not the request.** It resolves only when the group is
 * off the inactive list, which takes two requests to establish and is the only
 * claim worth making.
 *
 * Every other outcome throws — a refused activation, an inactive list that
 * could not be read, and a group still inactive after it: a dependency that
 * could not be made ready is a failed setup, never a setup that went on and
 * let the suite pass over an object nobody made ready.
 */
async function activateSharedFunctionGroup(
  client,
  name,
  transportRequest,
  logger,
) {
  const answer = await client.getFunctionGroup().activate(
    { functionGroupName: name, transportRequest },
    {
      headers: integrationHeadersOf(client.getFunctionGroup(), 'activate'),
      analyse: judged(analyseActivation),
    },
  );
  if (!answer.ok) {
    throw new Error(
      `Shared function group ${name} could not be activated: ${answer.getError().message}`,
    );
  }

  // **The POST answering is not the group being active.** `analyseActivation`
  // reads a refusal inside the 200 (activationExecuted="false", a message of
  // type E), but an activation can be executed and leave the group inactive.
  // Measured with `scripts/probe-activation-settle.ts` on
  // the ABAP Cloud system: `activationExecuted="true"`, no `msg` children, and `FUGR/F` still
  // on the inactive list afterwards — the exact state this repair exists to
  // remove, about to be recorded as removed.
  //
  // So the list decides. It is the only resource that answers "is it active
  // NOW", and reading it straight after the POST is sound because that POST
  // does its work before it answers — nine cycles of nine, same probe.
  // The list read into references by `utilInactiveObjects`; the shipped
  // default answers the document as it came.
  const { utilDocuments } = require('../../core/shared/utilResultSet');
  const { utilInactiveObjects } = require('@mcp-abap-adt/adt-strategies');
  const listed = await client
    .getUtils({ ...utilDocuments, inactive: utilInactiveObjects })
    .getInactiveObjects({ analyse: analyseException });
  if (!listed.ok) {
    throw new Error(
      `Shared function group ${name} was activated, but the inactive list ` +
        `could not be read to confirm it: ${listed.getError().message}`,
    );
  }

  // The group and the main program the server regenerates for it — both were
  // on the list when this defect was found, and either one left behind is a
  // group the next suite inherits broken.
  const wanted = [name.toUpperCase(), `SAPL${name.toUpperCase()}`];
  const stillInactive = (listed.getResult().value?.objects ?? []).filter((o) =>
    wanted.includes(String(o.name ?? '').toUpperCase()),
  );
  if (stillInactive.length > 0) {
    throw new Error(
      `Shared function group ${name} answered an activation but is still ` +
        `inactive: ${stillInactive.map((o) => `${o.type} ${o.name}`).join(', ')}`,
    );
  }

  logger?.info?.(`Shared function group ${name} activated`);
  return true;
}

async function ensureSharedDependency(client, type, name, logger) {
  const cacheKey = `${type}:${name}`;
  if (_verifiedDependencies[cacheKey]) {
    logger?.info?.(`Shared ${type} ${name} already verified, skipping`);
    return { existed: true, created: false, changed: false };
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

  // Types whose configuration lives in fields rather than a `source` block.
  // For them "it reads back" is not "it is correct": create() writes only a
  // shell — a domain with no data type at all — and the update that fills it in
  // is a separate call. A setup interrupted between the two leaves exactly that
  // shell, and a later run would accept it as a working dependency. So these are
  // always brought to configuration and activated, existing or not.
  const ALWAYS_RECONCILE = new Set(['domains', 'data_elements']);

  // Check if the object already exists.
  //
  // **The answer, not `undefined`.** Every handler used to return `undefined`
  // for an object that is not there, and this read `result !== undefined`. Since
  // the contract migration a read always answers an `IAdtResponse` object, so
  // that expression was `true` for every object on every system — setup took
  // the "it exists, update it" branch for all twenty, announced "updated and
  // activated", created nothing, and reported success.
  //
  // Existence is asked of the object's own URI — its metadata — never of its
  // source. A source answers nothing about existence: a service definition
  // created and not yet written answers `200` with an empty source, a function
  // module that does not exist answers `500` on its source, and on an ABAP Cloud system
  // an absent object's source answers `200` and no body. Its metadata answers
  // a document when the object is there and `ExceptionResourceNotFound` when
  // it is not. Measured on an ABAP Cloud system for a function module, a service
  // definition and a package.
  const readShared = async () => {
    if (type === 'domains') {
      return client
        .getDomain()
        .readMetadata({ domainName: name }, { analyse: analyseException });
    }
    if (type === 'data_elements') {
      return client
        .getDataElement()
        .readMetadata({ dataElementName: name }, { analyse: analyseException });
    }
    if (type === 'structures') {
      return client
        .getStructure()
        .readMetadata({ structureName: name }, { analyse: analyseException });
    }
    if (type === 'tables') {
      return client
        .getTable()
        .readMetadata({ tableName: name }, { analyse: analyseException });
    }
    if (type === 'views') {
      return client
        .getDdl()
        .readMetadata({ ddlName: name }, { analyse: analyseException });
    }
    if (type === 'programs') {
      return client
        .getProgram()
        .readMetadata({ programName: name }, { analyse: analyseException });
    }
    if (type === 'behavior_definitions') {
      return client
        .getBehaviorDefinition()
        .readMetadata({ name }, { analyse: analyseException });
    }
    if (type === 'classes') {
      return client
        .getClass()
        .readMetadata({ className: name }, { analyse: analyseException });
    }
    if (type === 'access_controls') {
      return client
        .getAccessControl()
        .readMetadata(
          { accessControlName: name },
          { analyse: analyseException },
        );
    }
    if (type === 'interfaces') {
      return client
        .getInterface()
        .readMetadata({ interfaceName: name }, { analyse: analyseException });
    }
    if (type === 'function_groups') {
      return client
        .getFunctionGroup()
        .readMetadata(
          { functionGroupName: name },
          { analyse: analyseException },
        );
    }
    if (type === 'function_modules') {
      return client.getFunctionModule().readMetadata(
        {
          functionModuleName: name,
          functionGroupName: depConfig.function_group,
        },
        { analyse: analyseException },
      );
    }
    if (type === 'function_group_includes') {
      return client.getFunctionInclude().readMetadata(
        {
          functionGroupName: depConfig.function_group,
          includeName: name,
        },
        { analyse: analyseException },
      );
    }
    if (type === 'service_definitions') {
      return client
        .getServiceDefinition()
        .readMetadata(
          { serviceDefinitionName: name },
          { analyse: analyseException },
        );
    }
    if (type === 'service_bindings') {
      return client
        .getServiceBinding()
        .readMetadata({ bindingName: name }, { analyse: analyseException });
    }
    return undefined;
  };

  let exists = false;
  try {
    const answer = await readShared();
    if (answer === undefined) {
      // A type this function has no read for: whether it exists cannot be
      // found out, and "could not find out" is never "absent".
      throw new Error(
        `Shared dependency type ${type} has no existence read here — ${name} cannot be made ready`,
      );
    }
    if (answer.ok) {
      // A 2xx on the object's own URI is the object — even an empty one: a
      // document read too soon after its create answers `200` and no body.
      exists = true;
    } else {
      const failure = answer.getError();
      // A refused read is not absence unless it says so — it is "we did not
      // find out", and turning that into `exists = false` is a guess that then
      // does something irreversible.
      //
      // Measured on an ABAP Cloud system: reads of ZAC_SHR_GA_DOM and ZAC_SHR_STRU
      // failed on a flaky link, the blanket catch here called them missing, and
      // the create that followed came back
      // `400 ExceptionResourceAlreadyExists: Resource Domain ZAC_SHR_GA_DOM
      // does already exist` — the objects were there all along. A 403, a 500 or
      // a timeout would read the same way.
      //
      // A refusal naming the object as non-existent is absence: that is the
      // sentence a cloud system answers in place of a 404.
      if (!answerSaysAbsent(failure)) {
        throw new Error(
          `Could not determine whether shared ${type} ${name} exists: ${failure.message}. ` +
            'Refusing to assume it is missing — the create that would follow ' +
            'either fails on an object that exists or writes over one that does.',
        );
      }
      exists = false;
    }
  } catch (error) {
    const status = error?.response?.status ?? error?.status;
    if (status !== 404) {
      throw new Error(
        `Could not determine whether shared ${type} ${name} exists: ${error.message}. ` +
          'Refusing to assume it is missing — the create that would follow ' +
          'either fails on an object that exists or writes over one that does.',
      );
    }
    exists = false;
  }

  if (exists) {
    // If config has source, update and activate to ensure it matches config
    let changed = false;
    if (depConfig.source) {
      try {
        changed = await updateAndActivateShared(
          client,
          type,
          name,
          depConfig,
          transportRequest,
          logger,
        );
      } catch (updateErr) {
        // Rethrow, for the reason spelled out in the reconcile branch below: a
        // shared dependency whose update failed is NOT at the configured state,
        // and swallowing that returns `{ existed: true }` and caches it as
        // verified. Every test that later borrows this object then fails
        // somewhere else, against an object nobody said was wrong — the warning
        // went to a logger that is silent unless DEBUG_TESTS=true.
        throw new Error(
          `Shared ${type} ${name} exists but could not be brought to the configured source: ${updateErr.message}`,
        );
      }
    } else if (ALWAYS_RECONCILE.has(type)) {
      // No `source` block, so the branch above cannot help — yet these are the
      // types whose create() writes only a shell. Bring the existing object to
      // the configured state and activate it, rather than trusting that it
      // reads back.
      try {
        if (type === 'domains') {
          // Read, edit, then lock — the order the migration note prescribes.
          // Reading inside the lock window would invent a sequence the library
          // no longer performs.
          const current = await readDocumentForUpdate(
            () =>
              client
                .getDomain()
                .readMetadata(
                  { domainName: name },
                  { analyse: analyseException },
                ),
            `read shared domain ${name}`,
            logger,
          );
          mustSucceed(
            await writeAndActivate(
              client.getDomain(),
              {
                domainName: name,
                packageName,
                transportRequest,
              },
              { source: domainDocumentFor(current, depConfig) },
            ),
            `shared domain update ${name}`,
          );
        } else {
          const current = await readDocumentForUpdate(
            () =>
              client
                .getDataElement()
                .readMetadata(
                  { dataElementName: name },
                  { analyse: analyseException },
                ),
            `read shared data element ${name}`,
            logger,
          );
          mustSucceed(
            await writeAndActivate(
              client.getDataElement(),
              {
                dataElementName: name,
                packageName,
                transportRequest,
              },
              { source: dataElementDocumentFor(current, depConfig) },
            ),
            `shared dataelement update ${name}`,
          );
        }
        logger?.info?.(`Shared ${type} ${name} reconciled to configuration`);
      } catch (reconcileErr) {
        // Rethrow: the lines below would otherwise cache this as verified and
        // return { existed: true }, so setup would report success over a domain
        // that is still an empty inactive shell — the exact false green this
        // reconciliation exists to prevent.
        throw new Error(
          `Shared ${type} ${name} exists but could not be reconciled to configuration: ${reconcileErr.message}`,
        );
      }
    } else {
      logger?.info?.(`Shared ${type} ${name} already exists`);
    }
    // **A function group that exists can still be inactive, and nothing else
    // here would notice.** Creating a function module inside a group makes SAP
    // regenerate the group's main include, which comes back inactive; the
    // module's own branch activates the module and not the group above it. A
    // group carries no `source`, so the reconciliation above never runs for
    // one, and `already exists` was the whole of the check.
    //
    // Measured on an on-premise system, 2026-09-22: after a green run of all
    // 192 suites, `GET /sap/bc/adt/activation/inactiveobjects` still listed
    // `FUGR/F ZAC_SHR_FUGR` and `FUGR/I SAPLZAC_SHR_FUGR` — every run left
    // them so, and every run passed.
    //
    // Activation is idempotent, so this asserts nothing about how the group got
    // into that state. It costs two requests, not one: the second reads the
    // inactive list, because the answer to the first says only that the server
    // replied — see `activateSharedFunctionGroup`.
    //
    // A group that could not be made active throws, so it is neither cached
    // as verified nor handed to the suite as ready.
    if (type === 'function_groups') {
      await activateSharedFunctionGroup(client, name, transportRequest, logger);
    }
    _verifiedDependencies[cacheKey] = true;
    // `changed`: the source was written (and, without skip_activation,
    // activated) by this call — what a caller activating a group needs to know.
    return { existed: true, created: false, changed };
  }

  // Create the object (high-level create does full chain: validate → create → lock → update → unlock → activate)
  logger?.info?.(`Creating shared ${type} ${name}...`);
  // No recovery after a refused create: a 409 or "already exists" is a
  // failure of this create, reported with what SAP said. An object that a
  // read then finds was made by someone else, in a state nobody configured,
  // and is not this dependency made ready.
  if (type === 'domains') {
    mustSucceed(
      await client.getDomain().create(
        {
          domainName: name,
          packageName,
          description: depConfig.description || 'Shared test domain',
          datatype: depConfig.datatype || 'CHAR',
          length: depConfig.length || 10,
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getDomain(), 'create'),
        },
      ),
      `shared domain create ${name}`,
    );
    // A domain carries no source: create only makes the shell, update fills
    // in the type, and without that step it stays an empty object with no
    // data type at all. Which is what happened, for as long as the fields
    // were passed here as fields: the update writes `config.document` and
    // merges nothing, so a config without one sent `undefined` and the shell
    // stayed a shell. The document the create just answered is read back,
    // patched, and written whole.
    const createdDomain = await readDocumentForUpdate(
      () =>
        client
          .getDomain()
          .readMetadata({ domainName: name }, { analyse: analyseException }),
      `read shared domain ${name} after create`,
      logger,
    );
    mustSucceed(
      await writeAndActivate(
        client.getDomain(),
        {
          domainName: name,
          // The update needs the package as much as the create did: measured on
          // on premise (BASIS 816), the first-ever setup of a shared domain failed with `Package
          // name is required for update` and the next run passed, because by
          // then the object existed and the reconcile branch — which does pass
          // it — took over. A defect only a fresh system ever sees.
          packageName,
          transportRequest,
        },
        { source: domainDocumentFor(createdDomain, depConfig) },
      ),
      `shared domain update ${name}`,
    );
  } else if (type === 'data_elements') {
    mustSucceed(
      await client.getDataElement().create(
        {
          dataElementName: name,
          packageName,
          description: depConfig.description || 'Shared test data element',
          typeKind: depConfig.type_kind || 'domain',
          typeName: depConfig.domain_name,
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getDataElement(), 'create'),
        },
      ),
      `shared dataelement create ${name}`,
    );
    const createdElement = await readDocumentForUpdate(
      () =>
        client
          .getDataElement()
          .readMetadata(
            { dataElementName: name },
            { analyse: analyseException },
          ),
      `read shared data element ${name} after create`,
      logger,
    );
    mustSucceed(
      await writeAndActivate(
        client.getDataElement(),
        {
          dataElementName: name,
          // Same omission as the domain above, and the same fresh-system-only
          // failure waiting behind it.
          packageName,
          transportRequest,
        },
        { source: dataElementDocumentFor(createdElement, depConfig) },
      ),
      `shared dataelement update ${name}`,
    );
  } else if (type === 'structures') {
    mustSucceed(
      await client.getStructure().create(
        {
          structureName: name,
          packageName,
          description: depConfig.description || 'Shared test structure',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getStructure(), 'create'),
        },
      ),
      `shared structure create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared structure ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getStructure(),
          {
            structureName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared structure update ${name}`,
      );
      logger?.info?.(`Shared structure ${name} activated`);
    }
  } else if (type === 'tables') {
    mustSucceed(
      await client.getTable().create(
        {
          tableName: name,
          packageName,
          description: depConfig.description || 'Shared test table',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getTable(), 'create'),
        },
      ),
      `shared table create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared table ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getTable(),
          {
            tableName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared table update ${name}`,
      );
      logger?.info?.(`Shared table ${name} activated`);
    }
  } else if (type === 'views') {
    mustSucceed(
      await client.getDdl().create(
        {
          ddlName: name,
          packageName,
          description: depConfig.description || 'Shared test view',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getDdl(), 'create'),
        },
      ),
      `shared ddl create ${name}`,
    );
    if (depConfig.source) {
      await writeShared(
        client.getDdl(),
        { ddlName: name, source: depConfig.source, transportRequest },
        depConfig,
        logger,
      );
      logger?.info?.(`Shared view ${name} written`);
    }
  } else if (type === 'programs') {
    mustSucceed(
      await client.getProgram().create(
        {
          programName: name,
          packageName,
          description: depConfig.description || 'Shared test program',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getProgram(), 'create'),
        },
      ),
      `shared program create ${name}`,
    );
    if (depConfig.source) {
      mustSucceed(
        await writeAndActivate(
          client.getProgram(),
          {
            programName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared program update ${name}`,
      );
    }
  } else if (type === 'behavior_definitions') {
    mustSucceed(
      await client.getBehaviorDefinition().create(
        {
          name,
          packageName,
          rootEntity: depConfig.root_entity || name,
          implementationType: depConfig.implementation_type || 'Managed',
          description: depConfig.description || 'Shared test BDEF',
          source: depConfig.source,
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(
            client.getBehaviorDefinition(),
            'create',
          ),
        },
      ),
      `shared behaviordefinition create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared behavior definition ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getBehaviorDefinition(),
          {
            name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared behaviordefinition update ${name}`,
      );
      logger?.info?.(`Shared behavior definition ${name} activated`);
    }
  } else if (type === 'classes') {
    mustSucceed(
      await client.getClass().create(
        {
          className: name,
          packageName,
          description: depConfig.description || 'Shared test class',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getClass(), 'create'),
        },
      ),
      `shared class create ${name}`,
    );
    if (depConfig.source) {
      await writeShared(
        client.getClass(),
        { className: name, source: depConfig.source, transportRequest },
        depConfig,
        logger,
      );
      logger?.info?.(`Shared class ${name} written`);
    }
  } else if (type === 'access_controls') {
    mustSucceed(
      await client.getAccessControl().create(
        {
          accessControlName: name,
          packageName,
          description: depConfig.description || 'Shared test access control',
          source: depConfig.source,
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getAccessControl(), 'create'),
        },
      ),
      `shared accesscontrol create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared access control ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getAccessControl(),
          {
            accessControlName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared accesscontrol update ${name}`,
      );
      logger?.info?.(`Shared access control ${name} activated`);
    }
  } else if (type === 'interfaces') {
    mustSucceed(
      await client.getInterface().create(
        {
          interfaceName: name,
          packageName,
          description: depConfig.description || 'Shared test interface',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getInterface(), 'create'),
        },
      ),
      `shared interface create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared interface ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getInterface(),
          {
            interfaceName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared interface update ${name}`,
      );
      logger?.info?.(`Shared interface ${name} activated`);
    }
  } else if (type === 'function_groups') {
    // A refused create fails setup with what SAP said; a group found by a
    // later read does not forgive it.
    mustSucceed(
      await client.getFunctionGroup().create(
        {
          functionGroupName: name,
          packageName,
          description: depConfig.description || 'Shared test FUGR',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getFunctionGroup(), 'create'),
        },
      ),
      `shared functiongroup create ${name}`,
    );
    // Throws when the group cannot be made active.
    await activateSharedFunctionGroup(client, name, transportRequest, logger);
  } else if (type === 'function_modules') {
    mustSucceed(
      await client.getFunctionModule().create(
        {
          functionModuleName: name,
          functionGroupName: depConfig.function_group,
          packageName,
          description: depConfig.description || 'Shared test FM',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getFunctionModule(), 'create'),
        },
      ),
      `shared functionmodule create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared function module ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getFunctionModule(),
          {
            functionModuleName: name,
            functionGroupName: depConfig.function_group,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared functionmodule update ${name}`,
      );
      logger?.info?.(`Shared function module ${name} activated`);
    }
  } else if (type === 'function_group_includes') {
    // `create` takes no source since 18.0.0 — it makes the include, and the
    // body is the write that follows. Same two steps as the function module
    // above.
    mustSucceed(
      await client.getFunctionInclude().create(
        {
          functionGroupName: depConfig.function_group,
          includeName: name,
          description:
            depConfig.description || 'Shared test function group include',
          transportRequest,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getFunctionInclude(), 'create'),
        },
      ),
      `shared functioninclude create ${name}`,
    );
    if (depConfig.source) {
      logger?.info?.(`Activating shared function include ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getFunctionInclude(),
          {
            functionGroupName: depConfig.function_group,
            includeName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared functioninclude update ${name}`,
      );
      logger?.info?.(`Shared function include ${name} activated`);
    }
  } else if (type === 'service_definitions') {
    mustSucceed(
      await client.getServiceDefinition().create(
        {
          serviceDefinitionName: name,
          packageName,
          description:
            depConfig.description || 'Shared test service definition',
          transportRequest,
          source: depConfig.source,
        },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(
            client.getServiceDefinition(),
            'create',
          ),
        },
      ),
      `shared servicedefinition create ${name}`,
    );
    if (depConfig.source && !depConfig.skip_activation) {
      logger?.info?.(`Activating shared service definition ${name}...`);
      mustSucceed(
        await writeAndActivate(
          client.getServiceDefinition(),
          {
            serviceDefinitionName: name,
            source: depConfig.source,
            transportRequest,
          },
          { source: depConfig.source },
        ),
        `shared servicedefinition update ${name}`,
      );
      logger?.info?.(`Shared service definition ${name} activated`);
    } else if (depConfig.source && depConfig.skip_activation) {
      mustSucceed(
        await writeSource(
          client.getServiceDefinition(),
          { serviceDefinitionName: name, transportRequest },
          { source: depConfig.source },
          logger,
        ),
        `shared servicedefinition write ${name}`,
      );
      logger?.info?.(
        `Shared service definition ${name} written (activation deferred for group activation)`,
      );
    }
  } else if (type === 'service_bindings') {
    mustSucceed(
      await client.getServiceBinding().create(
        {
          bindingName: name,
          packageName,
          description: depConfig.description || 'Shared test service binding',
          serviceDefinitionName: depConfig.service_definition,
          serviceName: depConfig.service_name || name,
          serviceVersion: depConfig.service_version || '0001',
          // adt-clients takes a single bindingVariant (e.g. ODATA_V4_WEB_API),
          // not separate type/version. Prefer an explicit binding_variant;
          // otherwise derive it from binding_type/binding_version (defaulting
          // the category to WEB_API).
          bindingVariant:
            depConfig.binding_variant ||
            `${depConfig.binding_type || 'ODATA'}_${depConfig.binding_version || 'V4'}_WEB_API`,
          transportRequest,
        },
        {
          analyse: analyseException,
          activateOnCreate: !depConfig.skip_activation,
          headers: integrationHeadersOf(client.getServiceBinding(), 'create'),
        },
      ),
      `shared servicebinding create ${name}`,
    );
    if (depConfig.skip_activation) {
      logger?.info?.(
        `Shared service binding ${name} created (activation deferred for group activation)`,
      );
    }
  } else {
    throw new Error(
      `Shared dependency type ${type} has no create here — ${name} was not created`,
    );
  }
  logger?.info?.(`Created shared ${type} ${name}`);
  _verifiedDependencies[cacheKey] = true;
  return { existed: false, created: true, changed: true };
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
  activateSharedFunctionGroup,
  answerSaysAbsent,
  writeSource,
  domainDocumentFor,
  dataElementDocumentFor,
  readDocumentForUpdate,
  writeAndActivate,
  mustSucceed,
  loadTestConfig,
  isTestConfigTemplate,
  getSessionConfig,
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
  checkPackageExists, // Check if package exists using searchObjects
  validateTestParameters, // Validate test parameters (package, transport)
  checkDefaultTestEnvironment, // Check default test environment before all tests
  logDefaultTestEnvironment, // Log default test environment in one line
  createDependencyDomain, // Create dependency domain with full workflow (validate → create → lock → update → unlock → activate)
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
  getEnvironmentType, // Get current environment type: 'cloud', 'legacy', or 'onprem'
  isTestAvailableForEnv, // Check if test case available_in includes current environment
};
