# Test Improvement Roadmap - @mcp-abap-adt/adt-clients

**Created:** 2025-01-XX  
**Status:** 🚧 Active  
**Goal:** Fix test independence issues and ensure all parameters come from YAML

---

## 📊 Current State Analysis

### ✅ Completed Roadmaps (Archived)

1. **TESTING_ROADMAP.md** - ✅ 100% Complete
   - YAML Migration: 37/37 test files (100%)
   - All CREATE/UPDATE/DELETE/GET tests migrated to YAML
   - **Status:** Archived, fully implemented

2. **TEST_FIXES_ROADMAP.md** - ✅ Mostly Complete
   - ✅ Timeout Configuration: 80/80 files (100%)
   - ✅ Phase 1: Lock Tests: 8/8 files (100%)
   - ✅ Phase 2: Create Tests: 11/11 files (100%)
   - ⏳ Phase 5: Test Logging: ~40% complete
   - **Status:** Archived, core work done

3. **TESTS_REFACTORING_ROADMAP.md** - ✅ Merged
   - Phase 1-2 completed
   - Merged into TEST_STRATEGY.md
   - **Status:** Archived, merged

4. **ADT_CLIENTS_MIGRATION_PLAN.md** - ✅ Complete
   - Package structure created
   - Clients implemented
   - **Status:** Archived, implemented

### 🔄 Active Roadmaps

1. **TEST_STRATEGY.md** - 🚧 In Progress
   - Phase 1: YAML Config Migration - ✅ 100%
   - Phase 2: Auth + Lock Persistence - ✅ 100%
   - Phase 3: Test Logging Pattern - ⏳ 20.5%
   - Phase 4: Cleanup - ⏳ 5%
   - Phase 5: setupTestEnvironment Migration - ⏳ 20.5%

2. **TEST_COVERAGE_PLAN.md** - 📋 Planning
   - Focus: Unit tests (not integration tests)
   - Status: Planning phase

---

## 🎯 New Roadmap: Simplified Test Strategy - Builder Tests Only

### Strategic Decision: Builder Tests Only

**Decision:** Keep only Builder tests, remove low-level function tests.

**Rationale:**
- Builder tests use low-level functions internally → automatically test low-level functions
- Builder tests cover operation chains → test real use cases
- Fewer tests = less maintenance
- Two tests per Builder = complete coverage

### Test Structure: Two Tests Per Builder

Each Builder test file will have exactly **2 tests**:

1. **Full Workflow Test** - Complete CRUD workflow with test object
   - `validate()` → `create()` → `check('inactive')` → `lock()` → `update()` → `check('inactive')` → `unlock()` → `activate()` → `check('active')`
   - Uses test object from YAML
   - Tests all operations in sequence

2. **Read Standard Object Test** - Simple read of standard SAP object
   - `read()` standard SAP object (e.g., `CL_ABAP_CHAR_UTILITIES`)
   - Completely independent
   - No create/update needed

### Benefits

1. ✅ **Complete coverage** - Full workflow + read operation
2. ✅ **Test independence** - Read test uses standard objects (no dependencies)
3. ✅ **Less maintenance** - Only 12 Builder test files (one per object type)
4. ✅ **Real use cases** - Builder tests cover actual operation chains
5. ✅ **Automatic low-level testing** - Builders use low-level functions internally

### Goals

1. ✅ **All test parameters from YAML** - No hardcoded values
2. ✅ **Two tests per Builder** - Full workflow + read standard object
3. ✅ **Remove low-level tests** - Keep only Builder tests
4. ✅ **All parameters from YAML** - No fallbacks to defaults

---

## 📋 Phase 1: Refactor Builder Tests to Two-Test Structure (HIGH PRIORITY)

**Goal:** Each Builder test has exactly 2 tests: Full workflow + Read standard object

### 1.1 Current Builder Test Structure

**Current state:** Builder tests have multiple tests (workflow, error handling, etc.)

**Target state:** Each Builder test has exactly 2 tests:
1. Full workflow test (validate → create → check inactive → lock → update → check inactive → unlock → activate → check active)
2. Read standard object test (simple read of standard SAP object)

### 1.2 Template for Builder Tests

**Standard structure for all Builder tests:**

```typescript
describe('ClassBuilder', () => {
  let connection: AbapConnection;
  let testCase: any = null;
  let standardObjectName: string | null = null;

  beforeAll(async () => {
    // Setup connection, session, etc.
    const testCase = getEnabledTestCase('builder_class', 'workflow_class');
    standardObjectName = testCase?.params?.standard_class_name || 'CL_ABAP_CHAR_UTILITIES';
  });

  afterAll(async () => {
    // Cleanup
  });

  // Test 1: Full workflow with test object
  it('should execute full workflow: validate → create → check inactive → lock → update → check inactive → unlock → activate → check active', async () => {
    if (!testCase) {
      logger.skip('Workflow Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    const builder = new ClassBuilder(connection, logger, {
      className: testCase.params.class_name,
      packageName: testCase.params.package_name,
      // ... all from YAML
    });

    // Full workflow
    await builder
      .validate()
      .then(b => b.create())
      .then(b => b.check('inactive'))
      .then(b => b.lock())
      .then(b => b.update(testCase.params.updated_source_code))
      .then(b => b.check('inactive'))
      .then(b => b.unlock())
      .then(b => b.activate())
      .then(b => b.check('active'));

    // Verify results
    expect(builder.getCreateResult()).toBeDefined();
    expect(builder.getLockHandle()).toBeDefined();
    expect(builder.getUpdateResult()).toBeDefined();
    expect(builder.getActivateResult()).toBeDefined();
  }, getTimeout('test'));

  // Test 2: Read standard SAP object (independent)
  it('should read standard SAP class', async () => {
    if (!standardObjectName) {
      logger.skip('Read Test', 'Standard object name not configured');
      return;
    }

    const builder = new ClassBuilder(connection, logger, {
      className: standardObjectName,
    });

    try {
      await builder.read('active');
      expect(builder.getReadResult()).toBeDefined();
      expect(builder.getReadResult()?.status).toBe(200);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.skip('Read Test', `Standard object ${standardObjectName} not available in this system`);
        return;
      }
      throw error;
    }
  }, getTimeout('read'));
});
```

### 1.3 YAML Structure for Builder Tests

**Required YAML structure:**

```yaml
builder_tests:
  class_builder:
    workflow_class:
      enabled: true
      params:
        class_name: ZCL_TEST_BUILDER
        package_name: ZOK_TEST_PKG_01
        transport_request: E19K905635
        source_code: |
          CLASS zcl_test_builder DEFINITION PUBLIC.
          PUBLIC SECTION.
            METHODS: hello.
          ENDCLASS.
        updated_source_code: |
          CLASS zcl_test_builder DEFINITION PUBLIC.
          PUBLIC SECTION.
            METHODS: hello, goodbye.
          ENDCLASS.
        standard_class_name: CL_ABAP_CHAR_UTILITIES  # For read test
```

### 1.4 Files to Update

**All Builder test files (12 files):**
- [ ] `class/ClassBuilder.test.ts`
- [ ] `domain/DomainBuilder.test.ts`
- [ ] `dataElement/DataElementBuilder.test.ts`
- [ ] `program/ProgramBuilder.test.ts`
- [ ] `interface/InterfaceBuilder.test.ts`
- [ ] `functionGroup/FunctionGroupBuilder.test.ts`
- [ ] `functionModule/FunctionModuleBuilder.test.ts`
- [ ] `structure/StructureBuilder.test.ts`
- [ ] `table/TableBuilder.test.ts`
- [ ] `view/ViewBuilder.test.ts`
- [ ] `package/PackageBuilder.test.ts`
- [ ] `transport/TransportBuilder.test.ts` (may not have read, adjust accordingly)

**YAML structure:**
```yaml
# Builder test cases
builder_tests:
  view_builder:
    basic_view:
      enabled: true
      params:
        view_name: Z_TEST
        package_name: ${default_package}
        ddl_source: "..."
    
    second_view:
      enabled: true
      params:
        view_name: Z_TEST2
        # ...

# Check test cases
check_tests:
  hypothetical_code:
    class_hypothetical:
      enabled: true
      params:
        class_name: ZCL_TEST_HYPOTHETICAL
        source_code: |
          CLASS ZCL_TEST_HYPOTHETICAL DEFINITION
            PUBLIC
            FINAL
            CREATE PUBLIC .
          PUBLIC SECTION.
            METHODS: test_method RETURNING VALUE(rv_result) TYPE string.
          ENDCLASS.
          # ...
```

### 1.3 Remove Fallbacks to Defaults

**Task:** Ensure all tests use YAML values, not `getDefaultPackage()`/`getDefaultTransport()`

**Current pattern (WRONG):**
```typescript
package_name: testCase.params.package_name || getDefaultPackage()
```

**Target pattern (CORRECT):**
```typescript
// Option 1: Require in YAML
if (!testCase.params.package_name) {
  logger.skip('Test', 'package_name not provided in test-config.yaml');
  return;
}
package_name: testCase.params.package_name

// Option 2: Use YAML default
package_name: testCase.params.package_name || testConfig.defaults?.package_name
```

**Files to fix:**
- [ ] All `create.test.ts` files
- [ ] All `update.test.ts` files
- [ ] All `lock.test.ts` files
- [ ] All `unlock.test.ts` files
- [ ] All `ensure*Exists()` helper functions

**YAML defaults section:**
```yaml
test_settings:
  defaults:
    package_name: ZOK_TEST_PKG_01  # From YAML, not code
    transport_request: E19K905635    # From YAML, not code
```

---

## 📋 Phase 2: Remove Low-Level Function Tests (HIGH PRIORITY)

**Goal:** Remove all low-level function tests, keep only Builder tests

### 2.0 Disable Non-Builder Tests in YAML (PRE-REQ)

**Before deleting files:** update `tests/test-config.yaml` to disable all non-builder tests.

- [ ] For every non-builder test case (`create_*`, `read_*`, `check_*`, etc.) set `enabled: false`
- [ ] Leave only Builder test cases enabled (`builder_*`)
- [ ] This prevents CI/test runs from trying to execute deleted tests
- [ ] Script idea: `scripts/disable-non-builder-tests.js` to automate updating YAML

```yaml
# Example disable
create_class:
  basic_class:
    enabled: false   # Non-builder test disabled

builder_tests:
  class_builder:
    workflow_class:
      enabled: true   # Builder test remains enabled
```

### 2.1 Files to Remove

**Low-level test files to delete (keep only Builder tests):**

**Read tests (11 files):**
- [ ] `class/read.test.ts` → DELETE (covered by ClassBuilder.test.ts)
- [ ] `domain/read.test.ts` → DELETE (covered by DomainBuilder.test.ts)
- [ ] `dataElement/read.test.ts` → DELETE (covered by DataElementBuilder.test.ts)
- [ ] `program/read.test.ts` → DELETE (covered by ProgramBuilder.test.ts)
- [ ] `interface/read.test.ts` → DELETE (covered by InterfaceBuilder.test.ts)
- [ ] `functionGroup/read.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts)
- [ ] `functionModule/read.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts)
- [ ] `structure/read.test.ts` → DELETE (covered by StructureBuilder.test.ts)
- [ ] `table/read.test.ts` → DELETE (covered by TableBuilder.test.ts)
- [ ] `view/read.test.ts` → DELETE (covered by ViewBuilder.test.ts)
- [ ] `package/read.test.ts` → DELETE (covered by PackageBuilder.test.ts)

**Check tests (11 files):**
- [ ] `class/check.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `domain/check.test.ts` → DELETE (covered by DomainBuilder.test.ts workflow)
- [ ] `dataElement/check.test.ts` → DELETE (covered by DataElementBuilder.test.ts workflow)
- [ ] `program/check.test.ts` → DELETE (covered by ProgramBuilder.test.ts workflow)
- [ ] `interface/check.test.ts` → DELETE (covered by InterfaceBuilder.test.ts workflow)
- [ ] `functionGroup/check.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts workflow)
- [ ] `functionModule/check.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)
- [ ] `structure/check.test.ts` → DELETE (covered by StructureBuilder.test.ts workflow)
- [ ] `table/check.test.ts` → DELETE (covered by TableBuilder.test.ts workflow)
- [ ] `view/check.test.ts` → DELETE (covered by ViewBuilder.test.ts workflow)
- [ ] `package/check.test.ts` → DELETE (covered by PackageBuilder.test.ts workflow)

**Lock tests (11 files):**
- [ ] `class/lock.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `domain/lock.test.ts` → DELETE (covered by DomainBuilder.test.ts workflow)
- [ ] `dataElement/lock.test.ts` → DELETE (covered by DataElementBuilder.test.ts workflow)
- [ ] `program/lock.test.ts` → DELETE (covered by ProgramBuilder.test.ts workflow)
- [ ] `interface/lock.test.ts` → DELETE (covered by InterfaceBuilder.test.ts workflow)
- [ ] `functionGroup/lock.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts workflow)
- [ ] `functionModule/lock.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)
- [ ] `structure/lock.test.ts` → DELETE (covered by StructureBuilder.test.ts workflow)
- [ ] `table/lock.test.ts` → DELETE (covered by TableBuilder.test.ts workflow)
- [ ] `view/lock.test.ts` → DELETE (covered by ViewBuilder.test.ts workflow)
- [ ] `package/lock.test.ts` → DELETE (covered by PackageBuilder.test.ts workflow)

**Unlock tests (10 files):**
- [ ] `class/unlock.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `domain/unlock.test.ts` → DELETE (covered by DomainBuilder.test.ts workflow)
- [ ] `dataElement/unlock.test.ts` → DELETE (covered by DataElementBuilder.test.ts workflow)
- [ ] `program/unlock.test.ts` → DELETE (covered by ProgramBuilder.test.ts workflow)
- [ ] `interface/unlock.test.ts` → DELETE (covered by InterfaceBuilder.test.ts workflow)
- [ ] `functionGroup/unlock.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts workflow)
- [ ] `functionModule/unlock.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)
- [ ] `structure/unlock.test.ts` → DELETE (covered by StructureBuilder.test.ts workflow)
- [ ] `table/unlock.test.ts` → DELETE (covered by TableBuilder.test.ts workflow)
- [ ] `view/unlock.test.ts` → DELETE (covered by ViewBuilder.test.ts workflow)

**Create tests (11 files):**
- [ ] `class/create.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `domain/create.test.ts` → DELETE (covered by DomainBuilder.test.ts workflow)
- [ ] `dataElement/create.test.ts` → DELETE (covered by DataElementBuilder.test.ts workflow)
- [ ] `program/create.test.ts` → DELETE (covered by ProgramBuilder.test.ts workflow)
- [ ] `interface/create.test.ts` → DELETE (covered by InterfaceBuilder.test.ts workflow)
- [ ] `functionGroup/create.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts workflow)
- [ ] `functionModule/create.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)
- [ ] `structure/create.test.ts` → DELETE (covered by StructureBuilder.test.ts workflow)
- [ ] `table/create.test.ts` → DELETE (covered by TableBuilder.test.ts workflow)
- [ ] `view/create.test.ts` → DELETE (covered by ViewBuilder.test.ts workflow)
- [ ] `package/create.test.ts` → DELETE (covered by PackageBuilder.test.ts workflow)

**Update tests (11 files):**
- [ ] `class/update.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `domain/update.test.ts` → DELETE (covered by DomainBuilder.test.ts workflow)
- [ ] `dataElement/update.test.ts` → DELETE (covered by DataElementBuilder.test.ts workflow)
- [ ] `program/update.test.ts` → DELETE (covered by ProgramBuilder.test.ts workflow)
- [ ] `interface/update.test.ts` → DELETE (covered by InterfaceBuilder.test.ts workflow)
- [ ] `functionGroup/update.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts workflow)
- [ ] `functionModule/update.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)
- [ ] `structure/update.test.ts` → DELETE (covered by StructureBuilder.test.ts workflow)
- [ ] `table/update.test.ts` → DELETE (covered by TableBuilder.test.ts workflow)
- [ ] `view/update.test.ts` → DELETE (covered by ViewBuilder.test.ts workflow)
- [ ] `package/update.test.ts` → DELETE (covered by PackageBuilder.test.ts workflow)

**Activate tests (10 files):**
- [ ] `class/activate.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `domain/activate.test.ts` → DELETE (covered by DomainBuilder.test.ts workflow)
- [ ] `dataElement/activate.test.ts` → DELETE (covered by DataElementBuilder.test.ts workflow)
- [ ] `program/activate.test.ts` → DELETE (covered by ProgramBuilder.test.ts workflow)
- [ ] `interface/activate.test.ts` → DELETE (covered by InterfaceBuilder.test.ts workflow)
- [ ] `functionGroup/activate.test.ts` → DELETE (covered by FunctionGroupBuilder.test.ts workflow)
- [ ] `functionModule/activate.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)
- [ ] `structure/activate.test.ts` → DELETE (covered by StructureBuilder.test.ts workflow)
- [ ] `table/activate.test.ts` → DELETE (covered by TableBuilder.test.ts workflow)
- [ ] `view/activate.test.ts` → DELETE (covered by ViewBuilder.test.ts workflow)

**Delete tests (5 files):**
- [ ] `class/delete.test.ts` → DELETE (covered by cleanup in ClassBuilder.test.ts)
- [ ] `domain/delete.test.ts` → DELETE (covered by cleanup in DomainBuilder.test.ts)
- [ ] `dataElement/delete.test.ts` → DELETE (covered by cleanup in DataElementBuilder.test.ts)
- [ ] `program/delete.test.ts` → DELETE (covered by cleanup in ProgramBuilder.test.ts)
- [ ] `interface/delete.test.ts` → DELETE (covered by cleanup in InterfaceBuilder.test.ts)

**Validate tests (1 file):**
- [ ] `class/validate.test.ts` → DELETE (covered by ClassBuilder.test.ts workflow)
- [ ] `functionModule/validate.test.ts` → DELETE (covered by FunctionModuleBuilder.test.ts workflow)

**Other tests:**
- [ ] `class/run.test.ts` → KEEP (special case, not covered by Builder)
- [ ] `shared/*.test.ts` → KEEP (shared utilities, not object-specific)

**Total files to delete:** ~75 low-level test files

### 2.2 Update Builder Tests

**Task:** Ensure all Builder tests follow the two-test structure

**For each Builder test:**
- [ ] Test 1: Full workflow (validate → create → check inactive → lock → update → check inactive → unlock → activate → check active)
- [ ] Test 2: Read standard object (independent, no dependencies)

---

## 📋 Phase 3: YAML Parameter Compliance (HIGH PRIORITY)

**Goal:** Ensure ALL test parameters come from YAML, no hardcoded values

### 3.1 Audit Builder Tests for Hardcoded Values

**Task:** Identify all hardcoded values in Builder tests

**Files to check:**
- [ ] All `*Builder.test.ts` files (check for hardcoded object names)
- [ ] Check for hardcoded package names, transport requests
- [ ] Check for hardcoded source code

**Expected findings:**
- Builder tests may have hardcoded test names (e.g., `'Z_TEST'`, `'Z_TEST2'`)
- Some tests may use `getDefaultPackage()`/`getDefaultTransport()` fallbacks
- Source code may be hardcoded instead of from YAML

### 3.2 Move All Values to YAML

**Task:** Add all test cases to `test-config.yaml`

**YAML structure:**
```yaml
builder_tests:
  class_builder:
    workflow_class:
      enabled: true
      params:
        class_name: ZCL_TEST_BUILDER
        package_name: ZOK_TEST_PKG_01
        transport_request: E19K905635
        source_code: |
          CLASS zcl_test_builder DEFINITION PUBLIC.
          PUBLIC SECTION.
            METHODS: hello.
          ENDCLASS.
        updated_source_code: |
          CLASS zcl_test_builder DEFINITION PUBLIC.
          PUBLIC SECTION.
            METHODS: hello, goodbye.
          ENDCLASS.
        standard_class_name: CL_ABAP_CHAR_UTILITIES  # For read test
  
  domain_builder:
    workflow_domain:
      enabled: true
      params:
        domain_name: Z_TEST_DOMAIN_BUILDER
        package_name: ZOK_TEST_PKG_01
        transport_request: E19K905635
        datatype: CHAR
        length: 10
        standard_domain_name: MANDT  # For read test
```

### 3.3 Remove Fallbacks to Defaults

**Task:** Ensure all tests use YAML values, not `getDefaultPackage()`/`getDefaultTransport()`

**Current pattern (WRONG):**
```typescript
package_name: testCase.params.package_name || getDefaultPackage()
```

**Target pattern (CORRECT):**
```typescript
// Require in YAML, skip if missing
if (!testCase.params.package_name) {
  logger.skip('Test', 'package_name not provided in test-config.yaml');
  return;
}
package_name: testCase.params.package_name
```

**Files to fix:**
- [ ] All `*Builder.test.ts` files

---

## 📋 Phase 4: Standard SAP Objects Registry (MEDIUM PRIORITY)

**Goal:** Document standard SAP objects for read tests

### 4.1 Create Standard Objects Registry in YAML

**Task:** Document standard SAP objects that can be used for testing

**YAML structure:**
```yaml
standard_objects:
  classes:
    - name: CL_ABAP_CHAR_UTILITIES
      description: Standard SAP utility class
      available_in: [cloud, onprem, s4hana]
  
  domains:
    - name: MANDT
      description: Client domain
      available_in: [cloud, onprem, s4hana]
  
  tables:
    - name: T000
      description: Client table
      available_in: [cloud, onprem, s4hana]
  
  # ... more standard objects
```

### 4.2 Update Builder Tests to Use Standard Objects

**Task:** Ensure read tests in Builder tests use standard objects from YAML

**Pattern:**
```typescript
// Test 2: Read standard object
it('should read standard SAP class', async () => {
  const standardClassName = testCase?.params?.standard_class_name || 
                           testConfig.standard_objects?.classes?.[0]?.name ||
                           'CL_ABAP_CHAR_UTILITIES';
  
  const builder = new ClassBuilder(connection, logger, {
    className: standardClassName,
  });

  try {
    await builder.read('active');
    expect(builder.getReadResult()).toBeDefined();
    expect(builder.getReadResult()?.status).toBe(200);
  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.skip('Read Test', `Standard object ${standardClassName} not available in this system`);
      return;
    }
    throw error;
  }
}, getTimeout('read'));
```

---

## 📋 Phase 5: Documentation & Verification (LOW PRIORITY)

**Goal:** Document Builder test pattern and verify compliance

### 5.1 Create Builder Test Pattern Documentation

**Task:** Document the two-test Builder pattern

**File:** `docs/BUILDER_TEST_PATTERN.md`

**Content:**
- Two-test structure explanation
- Test 1: Full workflow pattern
- Test 2: Read standard object pattern
- YAML configuration structure
- Standard objects registry

### 5.2 Create YAML Schema Documentation

**Task:** Document YAML structure for Builder tests

**File:** `docs/TEST_CONFIG_SCHEMA.md`

**Content:**
- Builder test case structure
- Required vs optional fields
- Standard objects configuration
- Workflow test parameters
- Read test parameters

### 5.3 Verification Script

**Task:** Create script to verify Builder test compliance

**Script:** `scripts/verify-builder-tests.js`

**Checks:**
- All Builder tests have exactly 2 tests
- Test 1: Full workflow (validate → create → check → lock → update → check → unlock → activate → check)
- Test 2: Read standard object
- All parameters from YAML (no hardcoded values)
- No fallbacks to `getDefaultPackage()`/`getDefaultTransport()`

---

## 📊 Implementation Checklist

### Phase 1: Refactor Builder Tests to Two-Test Structure
- [ ] 1.1 Update all Builder tests to have exactly 2 tests
- [ ] 1.2 Test 1: Full workflow (validate → create → check inactive → lock → update → check inactive → unlock → activate → check active)
- [ ] 1.3 Test 2: Read standard object (independent)
- [ ] 1.4 Add YAML configuration for all Builder tests

### Phase 2: Remove Low-Level Function Tests
- [ ] 2.1 Delete all `read.test.ts` files (11 files)
- [ ] 2.2 Delete all `check.test.ts` files (11 files)
- [ ] 2.3 Delete all `lock.test.ts` files (11 files)
- [ ] 2.4 Delete all `unlock.test.ts` files (10 files)
- [ ] 2.5 Delete all `create.test.ts` files (11 files)
- [ ] 2.6 Delete all `update.test.ts` files (11 files)
- [ ] 2.7 Delete all `activate.test.ts` files (10 files)
- [ ] 2.8 Delete all `delete.test.ts` files (5 files)
- [ ] 2.9 Delete all `validate.test.ts` files (2 files)
- [ ] 2.10 Keep special tests (`run.test.ts`, `shared/*.test.ts`)

### Phase 3: YAML Parameter Compliance
- [ ] 3.1 Audit Builder tests for hardcoded values
- [ ] 3.2 Move all hardcoded values to YAML
- [ ] 3.3 Remove fallbacks to `getDefaultPackage()`/`getDefaultTransport()`

### Phase 4: Standard Objects Registry
- [ ] 4.1 Create standard objects registry in YAML
- [ ] 4.2 Update Builder tests to use standard objects from YAML

### Phase 5: Documentation
- [ ] 5.1 Create Builder test pattern documentation
- [ ] 5.2 Create YAML schema documentation
- [ ] 5.3 Create verification script

---

## 🎯 Success Criteria

1. ✅ **Only Builder tests remain** - All low-level function tests removed
2. ✅ **Two tests per Builder** - Full workflow + read standard object
3. ✅ **All parameters from YAML** - Zero hardcoded values
4. ✅ **Test independence** - Read test uses standard objects (no dependencies)
5. ✅ **Complete coverage** - Full workflow covers all operations
6. ✅ **Documentation complete** - Builder test pattern and YAML schema documented

---

## 📅 Timeline Estimate

- **Phase 1:** 2-3 weeks (Refactor Builder tests to two-test structure)
- **Phase 2:** 1 week (Remove low-level function tests)
- **Phase 3:** 1 week (YAML parameter compliance)
- **Phase 4:** 1 week (Standard objects registry)
- **Phase 5:** 1 week (Documentation)

**Total:** 6-7 weeks

---

## 📝 Example: Complete Builder Test Structure

**File:** `class/ClassBuilder.test.ts`

```typescript
describe('ClassBuilder', () => {
  let connection: AbapConnection;
  let testCase: any = null;
  let standardClassName: string | null = null;

  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    await setupTestEnvironment(connection, 'class_builder', __filename);
    await (connection as any).connect();

    testCase = getEnabledTestCase('builder_class', 'workflow_class');
    standardClassName = testCase?.params?.standard_class_name || 'CL_ABAP_CHAR_UTILITIES';
  });

  afterAll(async () => {
    // Cleanup test object if created
    if (testCase?.params?.class_name) {
      try {
        await deleteObject(connection, {
          object_name: testCase.params.class_name,
          object_type: 'CLAS/OC'
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  // Test 1: Full workflow with test object
  it('should execute full workflow: validate → create → check inactive → lock → update → check inactive → unlock → activate → check active', async () => {
    if (!testCase) {
      logger.skip('Workflow Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    // Cleanup before test
    try {
      await deleteObject(connection, {
        object_name: testCase.params.class_name,
        object_type: 'CLAS/OC'
      });
    } catch (error) {
      // Ignore if doesn't exist
    }

    const builder = new ClassBuilder(connection, logger, {
      className: testCase.params.class_name,
      packageName: testCase.params.package_name,
      transportRequest: testCase.params.transport_request,
      description: testCase.params.description
    });

    // Full workflow
    await builder
      .setCode(testCase.params.source_code)
      .validate()
      .then(b => b.create())
      .then(b => b.check('inactive'))
      .then(b => b.lock())
      .then(b => b.setCode(testCase.params.updated_source_code))
      .then(b => b.update())
      .then(b => b.check('inactive'))
      .then(b => b.unlock())
      .then(b => b.activate())
      .then(b => b.check('active'));

    // Verify all operations completed
    expect(builder.getValidationResult()).toBeDefined();
    expect(builder.getCreateResult()).toBeDefined();
    expect(builder.getLockHandle()).toBeDefined();
    expect(builder.getUpdateResult()).toBeDefined();
    expect(builder.getActivateResult()).toBeDefined();
  }, getTimeout('test'));

  // Test 2: Read standard SAP object (independent)
  it('should read standard SAP class', async () => {
    if (!standardClassName) {
      logger.skip('Read Test', 'Standard object name not configured');
      return;
    }

    const builder = new ClassBuilder(connection, logger, {
      className: standardClassName,
    });

    try {
      await builder.read('active');
      expect(builder.getReadResult()).toBeDefined();
      expect(builder.getReadResult()?.status).toBe(200);
      expect(builder.getReadResult()?.data).toBeDefined();
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.skip('Read Test', `Standard object ${standardClassName} not available in this system`);
        return;
      }
      throw error;
    }
  }, getTimeout('read'));
});
```

---

## 🔗 Related Documents

- [ANALYSIS.md](../ANALYSIS.md) - Current state analysis
- [TEST_STRATEGY.md](./archive/TEST_STRATEGY.md) - Archived: Overall test strategy (superseded by this roadmap)
- [TEST_COVERAGE_PLAN.md](./TEST_COVERAGE_PLAN.md) - Unit test coverage plan (separate from integration tests)

---

**Last Updated:** 2025-01-XX  
**Status:** 🚧 Planning Phase

