# Builder Test Pattern

**Last Updated:** 2025-11-23  
**Status:** Active Pattern

---

## Overview

All Builder tests in `@mcp-abap-adt/adt-clients` follow a consistent **two-test structure** with unified logging architecture that ensures complete coverage while maintaining test independence.

## Logging Architecture

### Three Logger Types

Each Builder test uses **three separate loggers** for different purposes:

1. **`connectionLogger`** (type: `ILogger` from `@mcp-abap-adt/connection`)
   - **Purpose:** Logs from the connection package (HTTP requests, sessions, CSRF tokens)
   - **Debug Flag:** `DEBUG_CONNECTORS=true`
   - **Usage:** Passed to `createAbapConnection(config, connectionLogger)`
   - **Created by:** `createConnectionLogger()` helper

2. **`builderLogger`** (type: `IAdtLogger`)
   - **Purpose:** Logs from Builder library code (lock/unlock, validation, operations)
   - **Debug Flag:** `DEBUG_ADT_LIBS=true`
   - **Usage:** Passed to Builder constructor: `new ClassBuilder(connection, builderLogger, config)`
   - **Created by:** `createBuilderLogger()` helper

3. **`testsLogger`** (type: `IAdtLogger`)
   - **Purpose:** Logs from test execution (test steps, results, errors)
   - **Debug Flag:** `DEBUG_ADT_TESTS=true`
   - **Usage:** Passed to `logBuilderTest*()` functions
   - **Created by:** `createTestsLogger()` helper

### Logger Setup Pattern

```typescript
import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { ClassBuilder } from '../../../core/class';
import { IAdtLogger } from '../../../utils/logger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (ClassBuilder) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('ClassBuilder', () => {
  let connection: AbapConnection;
  
  beforeAll(async () => {
    connection = createAbapConnection(config, connectionLogger); // connectionLogger here
    // ...
  });
  
  it('should execute full workflow', async () => {
    logBuilderTestStart(testsLogger, 'ClassBuilder - full workflow', testCase); // testsLogger here
    
    const builder = new ClassBuilder(connection, builderLogger, config); // builderLogger here
    // ...
  });
});
```

### Debug Flags Summary

| Flag | Scope | Logger | Example Output |
|------|-------|--------|----------------|
| `DEBUG_CONNECTORS=true` | Connection package | `connectionLogger` | HTTP requests, CSRF tokens, cookies |
| `DEBUG_ADT_LIBS=true` | Builder library | `builderLogger` | "Class locked, handle: ABC123..." |
| `DEBUG_ADT_TESTS=true` | Test execution | `testsLogger` | "[1/3] ▶ ClassBuilder - full workflow" |
| `DEBUG_ADT_E2E_TESTS=true` | E2E tests | `e2eLogger` | E2E integration test logs |
| `DEBUG_ADT_HELPER_TESTS=true` | Test helpers | `helperLogger` | Test helper function logs |

**Note:** Setting `DEBUG_ADT_TESTS=true` enables ALL ADT scopes (libs, tests, e2e, helpers) for backward compatibility.

## Test Structure

Each Builder test file contains exactly **2 tests** (or 1 for special cases like `TransportBuilder`):

### Test 1: Full Workflow Test

**Purpose:** Test complete CRUD workflow with a test object created during the test.

**Workflow:**
1. `validate()` - Validate object name and parameters
2. `create()` - Create the object
3. `lock()` - Lock the object for editing
4. `update()` - Update the object (modify source code, DDL, etc.)
5. `check('inactive')` - Verify object is still inactive after update
6. `unlock()` - Release the lock
7. `activate()` - Activate the object
8. `check('active')` - Verify object is active
9. `delete()` - Clean up the test object

**Characteristics:**
- Uses test object from YAML configuration (`test-config.yaml`)
- Object is created before test and cleaned up after test
- Tests all operations in sequence
- Verifies results at each step
- Uses **`testsLogger`** for test logging

**Example:**
```typescript
it('should execute full workflow and store all results', async () => {
  const definition = getBuilderTestDefinition();
  logBuilderTestStart(testsLogger, 'ClassBuilder - full workflow', definition); // testsLogger
  
  const builder = new ClassBuilder(connection, builderLogger, { // builderLogger
    className: testCase.params.class_name,
    packageName: resolvePackageName(testCase.params.package_name),
    transportRequest: resolveTransportRequest(testCase.params.transport_request)
  });

  try {
    logBuilderTestStep('validate');
    await builder
      .validate()
      .then(b => {
        logBuilderTestStep('create');
        return b.create();
      })
      .then(async b => {
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        logBuilderTestStep('lock');
        return b.lock();
      })
      .then(async b => {
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        logBuilderTestStep('update');
        return b.update();
      })
      .then(async b => {
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        logBuilderTestStep('check(inactive)');
        return b.check('inactive');
      })
      .then(b => {
        logBuilderTestStep('unlock');
        return b.unlock();
      })
      .then(async b => {
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        logBuilderTestStep('activate');
        return b.activate();
      })
      .then(b => {
        logBuilderTestStep('check(active)');
        return b.check('active');
      })
      .then(b => {
        logBuilderTestStep('delete (cleanup)');
        return b.delete();
      });

    const state = builder.getState();
    expect(state.createResult).toBeDefined();
    expect(state.activateResult).toBeDefined();
    
    logBuilderTestSuccess(testsLogger, 'ClassBuilder - full workflow'); // testsLogger
  } catch (error) {
    logBuilderTestError(testsLogger, 'ClassBuilder - full workflow', error); // testsLogger
    throw error;
  } finally {
    await builder.forceUnlock().catch(() => {});
    logBuilderTestEnd(testsLogger, 'ClassBuilder - full workflow'); // testsLogger
  }
});
```

### Test 2: Read Standard Object Test

**Purpose:** Test read operation on a standard SAP object (independent, no dependencies).

**Workflow:**
1. `read()` - Read standard SAP object (e.g., `CL_ABAP_CHAR_UTILITIES`, `MANDT`, `T000`)
2. Verify response status and data

**Characteristics:**
- Uses standard SAP objects from YAML registry (`standard_objects` section)
- Completely independent - no object creation needed
- No cleanup required
- Object selection based on environment (on-premise vs cloud)
- Uses **`testsLogger`** for test logging

**Example:**
```typescript
it('should read standard SAP class', async () => {
  const testCase = getTestCaseDefinition('create_class', 'builder_class');
  const standardObject = resolveStandardObject('class', isCloudSystem, testCase);
  
  if (!standardObject) {
    logBuilderTestStart(testsLogger, 'ClassBuilder - read standard object', {
      name: 'read_standard',
      params: {}
    });
    logBuilderTestSkip(testsLogger, 'ClassBuilder - read standard object',
      `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
    return;
  }

  logBuilderTestStart(testsLogger, 'ClassBuilder - read standard object', {
    name: 'read_standard',
    params: { class_name: standardObject.name }
  });

  const builder = new ClassBuilder(connection, builderLogger, { // builderLogger
    className: standardObject.name,
    packageName: 'SAP' // Standard package
  });

  try {
    logBuilderTestStep('read');
    await builder.read();
    
    const result = builder.getReadResult();
    expect(result).toBeDefined();
    expect(result?.status).toBe(200);
    expect(result?.data).toBeDefined();
    
    logBuilderTestSuccess(testsLogger, 'ClassBuilder - read standard object'); // testsLogger
  } catch (error) {
    logBuilderTestError(testsLogger, 'ClassBuilder - read standard object', error); // testsLogger
    throw error;
  } finally {
    logBuilderTestEnd(testsLogger, 'ClassBuilder - read standard object'); // testsLogger
  }
});
```

### Test 3: Read Transport Request Test (Optional)

**Purpose:** Test reading transport request information for an object.

**Workflow:**
1. `readTransport()` - Read transport request for a standard SAP object
2. Verify response status and data

**Characteristics:**
- Only runs if `transport_request` is configured in YAML
- Uses standard SAP objects (same as Test 2)
- Skips gracefully if transport request not configured
- Note: On SAP BTP ABAP trial systems, objects are local and may return 404 (expected)
- Uses **`testsLogger`** for test logging

**Example:**
```typescript
it('should read transport request for class', async () => {
  const testCase = getTestCaseDefinition('create_class', 'builder_class');
  const standardObject = resolveStandardObject('class', isCloudSystem, testCase);
  
  // Check if transport_request is configured
  const transportRequest = resolveTransportRequest(testCase?.params?.transport_request);
  if (!transportRequest) {
    logBuilderTestStart(testsLogger, 'ClassBuilder - read transport request', {
      name: 'read_transport',
      params: {}
    });
    logBuilderTestSkip(testsLogger, 'ClassBuilder - read transport request',
      'transport_request not configured in test-config.yaml (required for transport read test)');
    return;
  }

  logBuilderTestStart(testsLogger, 'ClassBuilder - read transport request', {
    name: 'read_transport',
    params: { transport_request: transportRequest }
  });

  const builder = new ClassBuilder(connection, builderLogger, { // builderLogger
    className: standardObject.name,
    packageName: 'SAP'
  });

  try {
    logBuilderTestStep('readTransport');
    await builder.readTransport();
    
    const result = builder.getTransportResult();
    expect(result).toBeDefined();
    expect(result?.status).toBe(200);
    
    logBuilderTestSuccess(testsLogger, 'ClassBuilder - read transport request'); // testsLogger
  } catch (error) {
    logBuilderTestError(testsLogger, 'ClassBuilder - read transport request', error); // testsLogger
    throw error;
  } finally {
    logBuilderTestEnd(testsLogger, 'ClassBuilder - read transport request'); // testsLogger
  }
});
```

## Special Cases

### TransportBuilder

`TransportBuilder` has only **1 test** (Full workflow with read):
- Creates a transport request
- Reads the created transport request
- No separate "read standard object" test (transports are dynamic)

### ViewBuilder

`ViewBuilder` has **1 test** (Full workflow with read):
- Creates a view
- Reads the created view
- No separate "read standard object" test (merged into workflow)

## Test Setup and Cleanup

### Connection Setup (`beforeAll`)

```typescript
beforeAll(async () => {
  const testCount = 3; // Full workflow + Read standard object + Read transport request
  setTotalTests(testCount);
  
  const config = getConfig();
  connection = createAbapConnection(config, connectionLogger); // connectionLogger here
  
  // Setup session and lock tracking
  const env = await setupTestEnvironment(connection, 'class_builder', __filename);
  sessionId = env.sessionId;
  testConfig = env.testConfig;
  
  await (connection as any).connect();
  hasConfig = true;
  isCloudSystem = await isCloudEnvironment(connection);
});
```

### Cleanup (`afterAll`)

```typescript
afterAll(async () => {
  resetTestCounter();
  if (connection) {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    connection.reset();
  }
});
```

### Per-Test Cleanup (`beforeEach` / `afterEach`)

- **Full workflow test:** Cleanup before test (delete if exists) and after test (delete created object)
- **Read tests:** No cleanup needed (using standard objects)

## YAML Configuration

All test parameters come from `tests/test-config.yaml`:

```yaml
create_class:
  builder_class:
    enabled: true
    params:
      class_name: ZADT_BLD_CL01
      package_name: ${environment.package_name}
      transport_request: ${environment.transport_request}
      source_code: |
        CLASS zadt_bld_cl01 DEFINITION PUBLIC FINAL CREATE PUBLIC.
        PUBLIC SECTION.
          METHODS: hello.
        ENDCLASS.
      updated_source_code: |
        CLASS zadt_bld_cl01 DEFINITION PUBLIC FINAL CREATE PUBLIC.
        PUBLIC SECTION.
          METHODS: hello, goodbye.
        ENDCLASS.

environment:
  package_name: ZOK_TEST_PKG_01
  transport_request: E19K905635  # Optional, only for transportable packages

standard_objects:
  classes:
    - name: CL_ABAP_CHAR_UTILITIES
      description: Standard SAP utility class
      available_in:
        - onprem
        - cloud
```

## Standard Objects Registry

Standard SAP objects are defined in `test-config.yaml` under `standard_objects`:

- Each object type has a list of available objects
- Each object specifies `available_in` (onprem, cloud, or both)
- Objects are selected automatically based on detected environment
- Helper function `resolveStandardObject()` handles selection

## Test Logging

Tests use unified logger architecture with **three separate loggers**:

### Logger Helpers from `testLogger.ts`

```typescript
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';

const connectionLogger: ILogger = createConnectionLogger();  // DEBUG_CONNECTORS
const builderLogger: IAdtLogger = createBuilderLogger();     // DEBUG_ADT_LIBS
const testsLogger: IAdtLogger = createTestsLogger();         // DEBUG_ADT_TESTS
```

### Test Logging Functions from `builderTestLogger.ts`

All test logging functions accept **`testsLogger`** (NOT `builderLogger`):

- **`logBuilderTestStart(testsLogger, testName, testCase)`** - Log test start with parameters
- **`logBuilderTestSkip(testsLogger, testName, reason)`** - Log test skip with reason
- **`logBuilderTestSuccess(testsLogger, testName)`** - Log test success with duration
- **`logBuilderTestError(testsLogger, testName, error)`** - Log test error with details
- **`logBuilderTestStep(stepName)`** - Log individual workflow steps (when `DEBUG_ADT_TESTS=true`)
- **`logBuilderTestEnd(testsLogger, testName)`** - Log test completion (optional, for cleanup)

### Important: Logger Usage Rules

1. **`connectionLogger`** → Pass to `createAbapConnection(config, connectionLogger)`
   - Controls HTTP/session logs from connection package
   - Enable with `DEBUG_CONNECTORS=true`

2. **`builderLogger`** → Pass to Builder constructor
   - Controls logs from Builder library code (lock/unlock, operations)
   - Enable with `DEBUG_ADT_LIBS=true`
   - **NEVER pass to `logBuilderTest*` functions**

3. **`testsLogger`** → Pass to `logBuilderTest*()` functions
   - Controls test execution logs
   - Enable with `DEBUG_ADT_TESTS=true`
   - **NEVER pass to Builder constructor**

### Example: Correct Logger Usage

```typescript
describe('ClassBuilder', () => {
  let connection: AbapConnection;
  
  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, connectionLogger); // ✅ connectionLogger
    await (connection as any).connect();
  });
  
  it('should execute full workflow', async () => {
    logBuilderTestStart(testsLogger, 'ClassBuilder - full workflow', testCase); // ✅ testsLogger
    
    const builder = new ClassBuilder(connection, builderLogger, config); // ✅ builderLogger
    
    try {
      await builder.create();
      logBuilderTestSuccess(testsLogger, 'ClassBuilder - full workflow'); // ✅ testsLogger
    } catch (error) {
      logBuilderTestError(testsLogger, 'ClassBuilder - full workflow', error); // ✅ testsLogger
      throw error;
    }
  });
});
```

### Debug Flag Examples

```bash
# Debug only connection HTTP/session logs
DEBUG_CONNECTORS=true npm test -- --testPathPattern=class/ClassBuilder

# Debug only Builder library operations
DEBUG_ADT_LIBS=true npm test -- --testPathPattern=class/ClassBuilder

# Debug only test execution flow
DEBUG_ADT_TESTS=true npm test -- --testPathPattern=class/ClassBuilder

# Debug everything (enables all ADT scopes)
DEBUG_ADT_TESTS=true npm test -- --testPathPattern=class/ClassBuilder

# Debug connection + test flow
DEBUG_CONNECTORS=true DEBUG_ADT_TESTS=true npm test -- --testPathPattern=class/ClassBuilder
```

## Environment Detection

Tests automatically detect environment type:

```typescript
isCloudSystem = await isCloudEnvironment(connection);
```

- **Cloud systems:** SAP BTP ABAP Environment (trial or production)
- **On-premise systems:** Traditional SAP systems

Some object types are not supported in cloud (e.g., programs), tests skip gracefully.

## Graceful Skipping

Tests skip gracefully with clear reasons:

- No SAP configuration → "No SAP configuration"
- Test case disabled → "Test case disabled or not found"
- Package not configured → "package_name not configured"
- Transport not configured → "transport_request not configured"
- Object not available → "Standard object not configured for {environment}"
- Cloud system limitation → "Programs are not supported in cloud systems"

## Best Practices

1. **Always use YAML parameters** - No hardcoded values
2. **Use helper functions** - `resolvePackageName()`, `resolveTransportRequest()`, `resolveStandardObject()`
3. **Cleanup before and after** - Ensure test isolation
4. **Skip gracefully** - Provide clear reasons for skipped tests
5. **Log consistently** - Use `builderTestLogger` helpers
6. **Handle errors properly** - Distinguish between skip conditions and actual failures

---

**Related Documentation:**
- [TEST_CONFIG_SCHEMA.md](./TEST_CONFIG_SCHEMA.md) - YAML configuration schema

