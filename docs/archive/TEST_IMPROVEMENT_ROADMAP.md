# Test Improvement Roadmap - @mcp-abap-adt/adt-clients

**Created:** 2025-01-XX  
**Status:** ✅ Mostly Complete  
**Last Updated:** 2025-01-XX  
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

1. **TEST_IMPROVEMENT_ROADMAP.md** (this file) - ✅ Complete
   - Phase 1: Builder Tests Refactoring - ✅ 100%
   - Phase 2: Remove Low-Level Tests - ✅ 100%
   - Phase 3: YAML Parameter Compliance - ✅ 100%
   - Phase 4: Standard Objects Registry - ✅ 100%
   - Phase 5: Documentation & Verification - ✅ 100%

2. **TEST_COVERAGE_PLAN.md** - 📋 Planning
   - Focus: Unit tests (not integration tests)
   - Status: Planning phase

### 📦 Archived Roadmaps (Completed/Superseded)

1. **TEST_STRATEGY.md** - ✅ Archived (superseded by TEST_IMPROVEMENT_ROADMAP.md)
2. **TEST_FIXES_ROADMAP.md** - ✅ Archived (completed)
3. **TESTING_ROADMAP.md** - ✅ Archived (100% complete)
4. **TESTS_REFACTORING_ROADMAP.md** - ✅ Archived (merged into TEST_STRATEGY.md)

---

## 🎯 New Roadmap: Simplified Test Strategy - Builder Tests Only

### Strategic Decision: Builder Tests Only

**Decision:** Keep only Builder tests, remove low-level function tests.

**Rationale:**
- Builder tests use low-level functions internally → automatically test low-level functions
- Builder tests cover operation chains → test real use cases
- Fewer tests = less maintenance
- Two tests per Builder = complete coverage

### Test Structure: Two Required Tests + One Optional Test Per Builder

Each Builder test file has **2 required tests** + **1 optional test**:

1. **Full Workflow Test** (Required) - Complete CRUD workflow with test object
   - `validate()` → `create()` → `check('inactive')` → `lock()` → `update()` → `check('inactive')` → `unlock()` → `activate()` → `check('active')`
   - Uses test object from YAML
   - Tests all operations in sequence

2. **Read Standard Object Test** (Required) - Simple read of standard SAP object
   - `read()` standard SAP object (e.g., `CL_ABAP_CHAR_UTILITIES`)
   - Completely independent
   - No create/update needed

3. **Read Transport Request Test** (Optional) - Read transport request for standard object
   - `readTransport()` standard SAP object
   - Only runs if `transport_request` is configured in YAML
   - Skips gracefully if transport not configured
   - Note: On SAP BTP ABAP trial, objects are local (404 is expected)

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
- [x] `class/ClassBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `domain/DomainBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `dataElement/DataElementBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `program/ProgramBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `interface/InterfaceBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `functionGroup/FunctionGroupBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `functionModule/FunctionModuleBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `structure/StructureBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `table/TableBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `view/ViewBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `package/PackageBuilder.test.ts` ✅ (2 tests: Full workflow + Read standard object)
- [x] `transport/TransportBuilder.test.ts` ✅ (1 test: Full workflow with read - transports are dynamic)

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

## 📋 Phase 3: YAML Parameter Compliance ✅ COMPLETE

**Goal:** Ensure ALL test parameters come from YAML, no hardcoded values

### 3.1 Audit Builder Tests for Hardcoded Values (Completed)

- Reviewed every `*Builder.test.ts` file for hardcoded object names, package names, transport requests, and source code.
- Confirmed all workflow/read tests now read parameters from YAML (builder-specific params plus the shared `environment` block).
- Standard object registry completed in Phase 4.

### 3.2 Move All Values to YAML (Completed)

- All Builder test cases are defined in `tests/test-config.yaml`.  
- Common parameters that apply across tests (package name, transport request, etc.) live under `environment`.
- Each test case can still override these values locally; otherwise the defaults from `environment` are injected via `resolvePackageName` / `resolveTransportRequest`.

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

### 3.3 Remove Fallbacks to Defaults (Completed)

- All Builder tests now resolve package/transport exclusively through YAML:
  - `ensurePackageConfig` injects `environment.package_name` / `environment.transport_request` when missing.
  - Tests skip with a clear reason if `package_name` is still undefined (e.g., environment misconfigured).
- Legacy helpers (`getDefaultPackage`, `getDefaultTransport`) remain for backward compatibility but are no longer used inside integration tests.

---

## 📋 Phase 4: Standard SAP Objects Registry ✅ COMPLETE

**Goal:** Document standard SAP objects for read tests with on-premise/cloud variants

### 4.1 Create Standard Objects Registry in YAML ✅ COMPLETE

**Task:** Document standard SAP objects that can be used for testing with environment-specific variants

**YAML structure (implemented in `tests/test-config.yaml`):**
```yaml
standard_objects:
  classes:
    - name: CL_ABAP_CHAR_UTILITIES
      description: Standard SAP utility class for character operations
      available_in:
        - onprem
        - cloud
  
  domains:
    - name: MANDT
      description: Client domain (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud
  
  data_elements:
    - name: MANDT
      description: Client data element (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud
  
  tables:
    - name: T000
      description: Client table (exists in all ABAP systems)
      available_in:
        - onprem
        - cloud
  
  # ... more standard objects with available_in arrays
```

**Implementation:**
- ✅ Added `standard_objects` section to `test-config.yaml` with all object types
- ✅ Each object includes `available_in` array (`onprem`, `cloud`)
- ✅ Objects are filtered by environment when resolving

### 4.2 Create resolveStandardObject Helper ✅ COMPLETE

**Task:** Create helper function to resolve standard objects based on environment

**Helper function (implemented in `tests/test-helper.js`):**
```javascript
function resolveStandardObject(objectType, isCloud, testCase = null) {
  // Priority 1: Test case specific param (e.g., standard_class_name_onprem or standard_class_name_cloud)
  // Priority 2: Generic test case param (e.g., standard_class_name) - for backward compatibility
  // Priority 3: Global standard_objects registry filtered by environment
  // Returns: { name: string, group?: string } | null
}
```

**Features:**
- ✅ Supports test-case-specific params with `_onprem`/`_cloud` suffixes
- ✅ Falls back to generic params for backward compatibility
- ✅ Uses global `standard_objects` registry filtered by `available_in`
- ✅ Returns object name and optional group (for function modules)

### 4.3 Update Builder Tests to Use Standard Objects ✅ COMPLETE

**Task:** Ensure read tests in Builder tests use `resolveStandardObject` instead of hardcoded names

**Pattern (implemented):**
```typescript
// Test 2: Read standard object
it('should read standard SAP class', async () => {
  const testCase = getTestCaseDefinition('create_class', 'builder_class');
  const standardObject = resolveStandardObject('class', isCloudSystem, testCase);
  
  if (!standardObject) {
    logBuilderTestSkip(builderLogger, 'ClassBuilder - read standard object', 
      `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
    return;
  }

  const standardClassName = standardObject.name;
  const builder = new ClassBuilder(connection, logger, {
    className: standardClassName,
    packageName: 'SAP'
  });

  await builder.read('active');
  // ... verify results
}, getTimeout('test'));
```

**Status:**
- ✅ ClassBuilder - Updated
- ✅ DomainBuilder - Updated
- ✅ DataElementBuilder - Updated
- ✅ TableBuilder - Updated
- ✅ StructureBuilder - Updated
- ✅ InterfaceBuilder - Updated
- ✅ FunctionGroupBuilder - Updated
- ✅ FunctionModuleBuilder - Updated
- ✅ ProgramBuilder - Updated (read test still skips in cloud)
- ✅ PackageBuilder - Updated
- ✅ TransportBuilder - Read method improved (optional parameter, uses state)

### 4.4 Add Read Transport Request Functions ✅ COMPLETE

**Task:** Add functions to read transport request information for each object type

**Implementation:**
- ✅ Added `getClassTransport()` in `class/read.ts`
- ✅ Added `getInterfaceTransport()` in `interface/read.ts`
- ✅ Added `getTableTransport()` in `table/read.ts`
- ✅ Added `getProgramTransport()` in `program/read.ts`
- ✅ Added `getStructureTransport()` in `structure/read.ts`
- ✅ Added `getDomainTransport()` in `domain/read.ts`
- ✅ Added `getDataElementTransport()` in `dataElement/read.ts`
- ✅ Added `getViewTransport()` in `view/read.ts`
- ✅ Added `getFunctionGroupTransport()` in `functionGroup/read.ts`
- ✅ Added `getFunctionModuleTransport()` in `functionModule/read.ts` (requires functionGroup parameter)
- ✅ Added `getPackageTransport()` in `package/read.ts`

**URI Pattern:** `/sap/bc/adt/{object-type-path}/{encodedName}/transport`

**Example:**
```typescript
import { getClassTransport } from '@mcp-abap-adt/adt-clients/core';

const response = await getClassTransport(connection, 'ZCL_MY_CLASS');
// Returns transport request information in XML format
```

---

## 📋 Phase 5: Documentation & Verification ✅ COMPLETE

**Goal:** Document Builder test pattern and verify compliance

### 5.1 Create Builder Test Pattern Documentation ✅ COMPLETE

**Task:** Document the two-test Builder pattern

**File:** `docs/BUILDER_TEST_PATTERN.md` ✅

**Content:**
- Two-test structure explanation (with optional 3rd test for transport read)
- Test 1: Full workflow pattern
- Test 2: Read standard object pattern
- Test 3: Read transport request pattern (optional, only if transport_request configured)
- YAML configuration structure
- Standard objects registry
- Environment detection and graceful skipping

### 5.2 Create YAML Schema Documentation ✅ COMPLETE

**Task:** Document YAML structure for Builder tests

**File:** `docs/TEST_CONFIG_SCHEMA.md` ✅

**Content:**
- Builder test case structure
- Required vs optional fields
- Standard objects configuration
- Workflow test parameters
- Read test parameters
- Transport request parameters
- Environment-specific behavior (cloud vs on-premise)

### 5.3 Verification Script ✅ COMPLETE

**Task:** Create script to verify Builder test compliance

**Script:** `scripts/verify-builder-tests.js` ✅

**Checks:**
- All Builder tests have 2-3 tests (2 required: workflow + read standard, 1 optional: read transport)
- Special cases: TransportBuilder and ViewBuilder have 1 test (workflow with read)
- Test 1: Full workflow (validate → create → check → lock → update → check → unlock → activate → check)
- Test 2: Read standard object
- Test 3: Read transport request (optional)
- All parameters from YAML (no hardcoded values)
- No fallbacks to `getDefaultPackage()`/`getDefaultTransport()`
- YAML config structure validation

---

## 📊 Implementation Checklist

### Phase 1: Refactor Builder Tests to Two-Test Structure ✅ COMPLETE
- [x] 1.1 Update all Builder tests to have exactly 2 tests ✅ (11 builders with 2 tests, 1 with 1 test - TransportBuilder)
- [x] 1.2 Test 1: Full workflow (validate → create → check inactive → lock → update → check inactive → unlock → activate → check active) ✅
- [x] 1.3 Test 2: Read standard object (independent) ✅
- [x] 1.4 Add YAML configuration for all Builder tests ✅

### Phase 2: Remove Low-Level Function Tests ✅ COMPLETE
- [x] 2.1 Delete all `read.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.2 Delete all `check.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.3 Delete all `lock.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.4 Delete all `unlock.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.5 Delete all `create.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.6 Delete all `update.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.7 Delete all `activate.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.8 Delete all `delete.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.9 Delete all `validate.test.ts` files ✅ (0 files found - all deleted)
- [x] 2.10 Keep special tests (`run.test.ts`, `shared/*.test.ts`) ✅
- [x] 2.11 Delete old Client tests (ReadOnlyClient, CrudClient, CheckClient, ManagementClient) ✅

### Phase 3: YAML Parameter Compliance ✅ COMPLETE
- [x] 3.1 Audit Builder tests for hardcoded values ✅ (found getDefaultPackage/getDefaultTransport usage)
- [x] 3.2 Move all hardcoded values to YAML ✅ (Builder tests now rely on YAML params + environment defaults)
- [x] 3.3 Remove fallbacks to `getDefaultPackage()`/`getDefaultTransport()` ✅ (all builders now resolve via `environment.package_name` / optional `environment.transport_request`)

### Phase 4: Standard Objects Registry ✅ COMPLETE
- [x] 4.1 Create standard objects registry in YAML ✅
- [x] 4.2 Create resolveStandardObject helper ✅
- [x] 4.3 Update Builder tests to use standard objects from YAML ✅ (10/10 complete; TransportBuilder read merged into workflow)
- [x] 4.4 Add read transport request functions for all object types ✅

### Phase 5: Documentation ✅ COMPLETE
- [x] 5.1 Create Builder test pattern documentation ✅ (`docs/BUILDER_TEST_PATTERN.md`)
- [x] 5.2 Create YAML schema documentation ✅ (`docs/TEST_CONFIG_SCHEMA.md`)
- [x] 5.3 Create verification script ✅ (`scripts/verify-builder-tests.js`)

---

## 🎯 Success Criteria

1. ✅ **Only Builder tests remain** - All low-level function tests removed ✅ COMPLETE
2. ✅ **Two required tests per Builder** - Full workflow + read standard object ✅ COMPLETE (11 builders with 2-3 tests, TransportBuilder/ViewBuilder with 1)
3. ✅ **All parameters from YAML** - Builder tests now use YAML params with `environment.*` defaults and skip when not provided ✅ COMPLETE
4. ✅ **Standard object registry** - YAML-driven registry with on-premise/cloud variants, all Builder read tests use `resolveStandardObject()` ✅ COMPLETE
5. ✅ **Complete coverage** - Full workflow covers all operations ✅ COMPLETE
6. ✅ **Documentation complete** - Builder test pattern and YAML schema documented ✅ COMPLETE

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
**Status:** ✅ Complete (All phases done)

## 📊 Current Status Summary

### ✅ Completed
- **Phase 1:** All Builder tests refactored to 2-test structure (11 builders with 2 tests, TransportBuilder with 1)
- **Phase 2:** All low-level function tests removed (0 files found)
- **Phase 3:** YAML parameter compliance – Builder tests rely on YAML params + `environment.*` defaults (no code fallbacks)
- **Phase 4:** Standard SAP Objects Registry – YAML structure ✅, helper function ✅, all Builder tests updated ✅, transport read functions added ✅
- **Phase 5:** Documentation – Builder test pattern documentation ✅, YAML schema documentation ✅, verification script ✅
- **Phase 2.11:** Old Client tests removed (ReadOnlyClient, CrudClient, CheckClient, ManagementClient)
- **Lock registration:** All Builders now support `onLock` callback for persistent lock tracking
- **DDL for structures:** Structures now use DDL SQL instead of XML
- **E2E test:** testLockRecovery.integration.test.ts fixed to handle missing configuration
- **Stateful table workflow:** `TableBuilder` now reuses the existing lock handle/session when updating, eliminating the duplicate EU510 "currently editing" error path.
- **Test logging:** `[LOCK] ...` output is controlled via `LOG_LOCKS`, and skip logs no longer bump the progress counter a second time.
- **Transport read functions:** Added `get*Transport()` functions for all object types (class, interface, table, program, structure, domain, dataElement, view, functionGroup, functionModule, package)

### ✅ Completed
- **Phase 5:** Documentation – Builder pattern (`BUILDER_TEST_PATTERN.md`), YAML schema (`TEST_CONFIG_SCHEMA.md`), and verification script (`scripts/verify-builder-tests.js`) completed ✅

### 📋 Optional Future Enhancements
- Document optional transport handling for local (`$TMP`) vs transportable packages with explicit skip reasons
- Add more standard objects to registry as needed
