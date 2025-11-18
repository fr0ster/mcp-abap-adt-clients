# Test Structure Analysis and Module Coverage Plan

## 📊 Current Test Coverage Status

### ✅ Covered Modules (with full set of operations)

#### 1. **Class**
- ✅ `create.test.ts` - class creation
- ✅ `read.test.ts` - class reading
- ✅ `update.test.ts` - class source code update
- ✅ `delete.test.ts` - class deletion
- ✅ `check.test.ts` - syntax check
- ✅ `activate.test.ts` - activation
- ✅ `lock.test.ts` - locking
- ✅ `run.test.ts` - runnable class execution
- ✅ `validate.test.ts` - validation

#### 2. **FunctionModule**
- ✅ `create.test.ts` - function module creation
- ✅ `read.test.ts` - function module reading
- ✅ `update.test.ts` - function module source code update
- ✅ `delete.test.ts` - function module deletion
- ✅ `check.test.ts` - syntax check
- ✅ `validate.test.ts` - validation

#### 3. **FunctionGroup**
- ✅ `create.test.ts` - function group creation
- ✅ `read.test.ts` - function group reading
- ✅ `delete.test.ts` - function group deletion
- ❌ `check.test.ts` - syntax check (needs to be created)
- ❌ `activate.test.ts` - activation (needs to be created)
- ❌ `lock.test.ts` - locking (needs to be created)
- ❌ `validation.test.ts` - validation (needs to be created)

#### 4. **Domain** ✅ NEWLY COVERED
- ✅ `create.test.ts` - domain creation
- ✅ `read.test.ts` - domain reading
- ✅ `update.test.ts` - domain update
- ✅ `check.test.ts` - syntax check
- ✅ `activate.test.ts` - activation
- ✅ `lock.test.ts` - locking
- ✅ `unlock.test.ts` - unlocking

### ⚠️ Partially Covered Modules

#### 5. **Check Operations** (integration test)
- ✅ `CheckClient.integration.test.ts` - covers check for all types:
  - Program, Class, Interface, Domain, DataElement, Structure, View, FunctionGroup, FunctionModule, Table, Package

### ❌ Uncovered Modules (tests need to be created)

#### 6. **DataElement**
Tests to create:
- ❌ `create.test.ts` - data element creation
- ❌ `read.test.ts` - data element reading
- ❌ `update.test.ts` - data element update
- ❌ `check.test.ts` - syntax check (exists in integration, but needs separate unit test)
- ❌ `activate.test.ts` - activation
- ❌ `lock.test.ts` - locking
- ❌ `unlock.test.ts` - unlocking

#### 7. **Structure**
Tests to create:
- ❌ `create.test.ts` - structure creation
- ❌ `read.test.ts` - structure reading
- ❌ `check.test.ts` - syntax check (exists in integration, but needs separate unit test)
- ❌ `activate.test.ts` - activation

#### 8. **Table**
Tests to create:
- ❌ `create.test.ts` - table creation
- ❌ `read.test.ts` - table reading
- ❌ `check.test.ts` - syntax check (exists in integration, but needs separate unit test)
- ❌ `activate.test.ts` - activation
- ❌ `lock.test.ts` - locking
- ❌ `unlock.test.ts` - unlocking

#### 9. **View**
Tests to create:
- ❌ `create.test.ts` - view creation
- ❌ `read.test.ts` - view reading
- ❌ `update.test.ts` - view update
- ❌ `check.test.ts` - syntax check (exists in integration, but needs separate unit test)
- ❌ `activate.test.ts` - activation
- ❌ `lock.test.ts` - locking
- ❌ `unlock.test.ts` - unlocking

#### 10. **Interface**
Tests to create:
- ❌ `create.test.ts` - interface creation
- ❌ `read.test.ts` - interface reading
- ❌ `update.test.ts` - interface source code update
- ❌ `check.test.ts` - syntax check (exists in integration, but needs separate unit test)
- ❌ `activate.test.ts` - activation
- ❌ `lock.test.ts` - locking
- ❌ `unlock.test.ts` - unlocking
- ❌ `validate.test.ts` - validation

#### 11. **Program**
Tests to create:
- ❌ `create.test.ts` - program creation
- ❌ `read.test.ts` - program reading
- ❌ `update.test.ts` - program source code update
- ❌ `check.test.ts` - syntax check (exists in integration, but needs separate unit test)
- ❌ `activate.test.ts` - activation
- ❌ `lock.test.ts` - locking
- ❌ `unlock.test.ts` - unlocking
- ❌ `validate.test.ts` - validation

#### 12. **Package**
Tests to create:
- ❌ `create.test.ts` - package creation
- ❌ `read.test.ts` - package reading
- ❌ `check.test.ts` - check (exists in integration, but needs separate unit test)
- ❌ `validation.test.ts` - validation
- ❌ `transportCheck.test.ts` - transport check

---

## 🎯 Test Structure Pattern (from Classes, FunctionModules, FunctionGroups)

### General Test Structure

Each test follows this structure:

```typescript
/**
 * Unit test for {ObjectType} {Operation}
 * Tests {operation} function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/{objectType}/{operation}.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { {operationFunction} } from '../../../core/{objectType}/{operation}';
// Additional imports depending on operation
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

function getConfig(): SapConfig {
  // Standard configuration function (same for all tests)
  // ...
}

describe('{ObjectType} - {Operation}', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  it('should {operation} {objectType}', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('{operation}_{objectType}', 'test_{objectType}');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Execute operation
    // Verify result
    // ...
  }, 30000);
});
```

### Key Pattern Features

1. **Using test-config.yaml**
   - All tests use `getEnabledTestCase(handlerName, testCaseName)`
   - Handler name corresponds to operation name: `create_domain`, `read_domain`, `update_domain`, etc.
   - Test case name usually: `test_{objectType}` or `basic_{objectType}`

2. **Configuration Handling**
   - Check for `.env` file presence
   - Graceful skip if configuration is missing
   - Log warnings instead of failing tests

3. **Test Structure**
   - `beforeAll` - connection creation
   - `afterAll` - connection cleanup
   - Each test checks `hasConfig` before execution
   - Timeout usually 30000ms for operations, 15000ms for read

4. **Result Verification**
   - For create: verify through read operation
   - For update: verify through read with 'inactive' version
   - For read: verify status 200 and presence of expected data

---

## 📋 Test Coverage Plan

### Priority 1: DDIC Objects (Domain, DataElement)

#### Domain Tests
1. **create.test.ts**
   - Test basic domain creation (CHAR)
   - Test domain creation with different data types (NUMC, DEC, etc.)
   - Handler: `create_domain`, test case: `test_domain`

2. **read.test.ts**
   - Test reading existing domain
   - Test reading non-existent domain (error)
   - Handler: `get_domain`, test case: `test_domain` or `standard_domain`

3. **update.test.ts**
   - Test updating domain description
   - Test updating data type/length
   - Handler: `update_domain`, test case: `test_domain`

4. **check.test.ts**
   - Test domain syntax check
   - Handler: `check_domain`, test case: `test_domain`

5. **activate.test.ts**
   - Test domain activation
   - Handler: `activate_domain`, test case: `test_domain`

6. **lock.test.ts** / **unlock.test.ts**
   - Test domain locking/unlocking
   - Handler: `lock_domain` / `unlock_domain`, test case: `test_domain`

#### DataElement Tests
1. **create.test.ts**
   - Test data element creation with domain
   - Test data element creation without domain (with data type)
   - Handler: `create_data_element`, test case: `test_data_element`

2. **read.test.ts**
   - Test reading data element
   - Handler: `get_data_element`, test case: `test_data_element` or `standard_data_element`

3. **update.test.ts**
   - Test updating data element
   - Handler: `update_data_element`, test case: `test_data_element`

4. **check.test.ts**
   - Test data element syntax check
   - Handler: `check_data_element`, test case: `test_data_element`

5. **activate.test.ts**
   - Test data element activation
   - Handler: `activate_data_element`, test case: `test_data_element`

6. **lock.test.ts** / **unlock.test.ts**
   - Test data element locking/unlocking
   - Handler: `lock_data_element` / `unlock_data_element`, test case: `test_data_element`

### Priority 2: Structures and Tables

#### Structure Tests
1. **create.test.ts** - structure creation
2. **read.test.ts** - structure reading
3. **check.test.ts** - syntax check
4. **activate.test.ts** - activation

#### Table Tests
1. **create.test.ts** - table creation
2. **read.test.ts** - table reading
3. **check.test.ts** - syntax check
4. **activate.test.ts** - activation
5. **lock.test.ts** / **unlock.test.ts** - locking/unlocking

### Priority 3: View, Interface, Program

#### View Tests
1. **create.test.ts** - view creation
2. **read.test.ts** - view reading
3. **update.test.ts** - view update
4. **check.test.ts** - syntax check
5. **activate.test.ts** - activation
6. **lock.test.ts** / **unlock.test.ts** - locking/unlocking

#### Interface Tests
1. **create.test.ts** - interface creation
2. **read.test.ts** - interface reading
3. **update.test.ts** - interface source code update
4. **check.test.ts** - syntax check
5. **activate.test.ts** - activation
6. **lock.test.ts** / **unlock.test.ts** - locking/unlocking
7. **validate.test.ts** - validation

#### Program Tests
1. **create.test.ts** - program creation
2. **read.test.ts** - program reading
3. **update.test.ts** - program source code update
4. **check.test.ts** - syntax check
5. **activate.test.ts** - activation
6. **lock.test.ts** / **unlock.test.ts** - locking/unlocking
7. **validate.test.ts** - validation

### Priority 4: Package

#### Package Tests
1. **create.test.ts** - package creation
2. **read.test.ts** - package reading
3. **check.test.ts** - check
4. **validation.test.ts** - validation
5. **transportCheck.test.ts** - transport check

---

## 🔧 test-config.yaml Configuration

For each new test, corresponding sections need to be added to `test-config.yaml`:

### Example for Domain:

```yaml
# Create Domain
create_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Create test domain"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"
        description: "Test domain created via MCP"
        package_name: "ZTEST"
        transport_request: ""  # Optional, can be empty for $TMP
        datatype: "CHAR"
        length: 50
        decimals: 0
        lowercase: false
        sign_exists: false

# Get Domain
get_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Get test domain"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"

# Update Domain
update_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Update test domain"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"
        description: "Updated test domain description"
        package_name: "ZTEST"
        datatype: "CHAR"
        length: 60
        decimals: 0

# Check Domain
check_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Check test domain syntax"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"
        version: "new"

# Activate Domain
activate_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Activate test domain"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"

# Lock Domain
lock_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Lock test domain"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"

# Unlock Domain
unlock_domain:
  test_cases:
    - name: "test_domain"
      enabled: true
      description: "Unlock test domain"
      params:
        domain_name: "ZZ_TEST_MCP_DOMAIN"
```

---

## 📝 Implementation Recommendations

### 1. Test Creation Sequence

For each object type, tests should be created in this order:
1. **read.test.ts** - simplest, doesn't require object creation (can use standard object)
2. **create.test.ts** - object creation
3. **update.test.ts** - update (requires existing object)
4. **check.test.ts** - syntax check
5. **activate.test.ts** - activation
6. **lock.test.ts** / **unlock.test.ts** - locking/unlocking
7. **validate.test.ts** (if exists) - validation

### 2. Object Dependencies

- **DataElement** depends on **Domain** - create domain first, then data element
- **Table/Structure** may depend on **DataElement** - consider when creating tests
- **View** depends on **Table** - table first, then view

### 3. Using Standard Objects

For read tests, standard SAP objects can be used:
- Domain: `SYST_SUBRC`
- DataElement: `SYST_SUBRC`
- Table: `MARA`, `DD02L`
- Structure: `SYST`
- Interface: `IF_T100_MESSAGE`
- Program: `SAPMV45A`

This allows testing read operations without needing to create test objects.

### 4. Cleanup and Idempotency

- Tests should be idempotent - can be run multiple times
- For create tests: check object existence before creation, or delete before creation
- Use `deleteObject` for cleanup (if allowed)

### 5. Error Handling

- Tests should gracefully handle missing authorizations (e.g., `S_ABPLNGVS`)
- Log warnings instead of failing tests
- Use `console.warn` for informative messages

---

## ✅ Checklist for Creating New Test

- [ ] Create file `src/__tests__/unit/{objectType}/{operation}.test.ts`
- [ ] Add standard test structure (imports, getConfig, describe)
- [ ] Add section in `test-config.yaml` with handler name `{operation}_{objectType}`
- [ ] Add test case with name `test_{objectType}` or `basic_{objectType}`
- [ ] Implement test using `getEnabledTestCase`
- [ ] Add result verification
- [ ] Verify error handling and missing configuration handling
- [ ] Run test: `npm test -- unit/{objectType}/{operation}.test`
- [ ] Check coverage: `npm run test:coverage`

---

## 📊 Coverage Statistics

### Current Status:
- **Fully covered modules:** 2 (Class - 9 tests, Domain - 7 tests)
- **Partially covered modules:** 2 (FunctionModule - 6 tests, FunctionGroup - 3 tests, needs 4 more)
- **Integration test:** 1 (Check operations for all types)
- **Uncovered modules:** 8 (DataElement, Structure, Table, View, Interface, Program, Package)

### Progress:
- ✅ **Domain** - fully covered (7/7 tests created)
- ⚠️ **FunctionGroup** - needs 4 more tests (check, activate, lock, validation)

### After Plan Implementation:
- **Covered modules:** 12 (all main object types)
- **Expected code coverage:** 60-70% (from current 32.8%)

---

## 🔗 References

- [TEST_COVERAGE_PLAN.md](./TEST_COVERAGE_PLAN.md) - general coverage plan
- [test-config.yaml.template](../tests/test-config.yaml.template) - configuration template
- [test-helper.js](../tests/test-helper.js) - test helper functions
