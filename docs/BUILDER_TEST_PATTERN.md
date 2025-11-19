# Builder Test Pattern

**Last Updated:** 2025-01-XX  
**Status:** Active Pattern

---

## Overview

All Builder tests in `@mcp-abap-adt/adt-clients` follow a consistent **two-test structure** that ensures complete coverage while maintaining test independence.

## Test Structure

Each Builder test file contains exactly **2 tests** (or 1 for special cases like `TransportBuilder`):

### Test 1: Full Workflow Test

**Purpose:** Test complete CRUD workflow with a test object created during the test.

**Workflow:**
1. `validate()` - Validate object name and parameters
2. `create()` - Create the object
3. `check('inactive')` - Verify object is inactive after creation
4. `lock()` - Lock the object for editing
5. `update()` - Update the object (modify source code, DDL, etc.)
6. `check('inactive')` - Verify object is still inactive after update
7. `unlock()` - Release the lock
8. `activate()` - Activate the object
9. `check('active')` - Verify object is active

**Characteristics:**
- Uses test object from YAML configuration (`test-config.yaml`)
- Object is created before test and cleaned up after test
- Tests all operations in sequence
- Verifies results at each step

**Example:**
```typescript
it('should execute full workflow and store all results', async () => {
  const testCase = getTestCaseDefinition('create_class', 'builder_class');
  // ... setup ...
  
  const builder = new ClassBuilder(connection, builderLogger, {
    className: testCase.params.class_name,
    packageName: resolvePackageName(testCase.params.package_name),
    transportRequest: resolveTransportRequest(testCase.params.transport_request)
  });

  await builder
    .validate()
    .then(b => b.create())
    .then(b => b.check('inactive'))
    .then(b => b.lock())
    .then(b => b.update())
    .then(b => b.check('inactive'))
    .then(b => b.unlock())
    .then(b => b.activate())
    .then(b => b.check('active'));

  // Verify results
  expect(builder.getCreateResult()).toBeDefined();
  expect(builder.getLockHandle()).toBeDefined();
  // ...
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

**Example:**
```typescript
it('should read standard SAP class', async () => {
  const testCase = getTestCaseDefinition('create_class', 'builder_class');
  const standardObject = resolveStandardObject('class', isCloudSystem, testCase);
  
  if (!standardObject) {
    logBuilderTestSkip(builderLogger, 'ClassBuilder - read standard object',
      `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
    return;
  }

  const builder = new ClassBuilder(connection, builderLogger, {
    className: standardObject.name,
    packageName: 'SAP' // Standard package
  });

  await builder.read('active');
  const result = builder.getReadResult();
  expect(result).toBeDefined();
  expect(result?.status).toBe(200);
  expect(result?.data).toBeDefined();
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

**Example:**
```typescript
it('should read transport request for class', async () => {
  const testCase = getTestCaseDefinition('create_class', 'builder_class');
  const standardObject = resolveStandardObject('class', isCloudSystem, testCase);
  
  // Check if transport_request is configured
  const transportRequest = resolveTransportRequest(testCase?.params?.transport_request);
  if (!transportRequest) {
    logBuilderTestSkip(builderLogger, 'ClassBuilder - read transport request',
      'transport_request not configured in test-config.yaml (required for transport read test)');
    return;
  }

  const builder = new ClassBuilder(connection, builderLogger, {
    className: standardObject.name,
    packageName: 'SAP'
  });

  await builder.readTransport();
  const result = builder.getTransportResult();
  expect(result).toBeDefined();
  expect(result?.status).toBe(200);
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
  connection = createAbapConnection(config, connectionLogger);
  
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

Tests use `builderTestLogger` helpers for consistent logging:

- `logBuilderTestStart()` - Log test start with parameters
- `logBuilderTestSkip()` - Log test skip with reason
- `logBuilderTestSuccess()` - Log test success with duration
- `logBuilderTestError()` - Log test error
- `logBuilderTestStep()` - Log individual workflow steps (when `DEBUG_TESTS=true`)

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
- [TEST_IMPROVEMENT_ROADMAP.md](./TEST_IMPROVEMENT_ROADMAP.md) - Roadmap and implementation details

