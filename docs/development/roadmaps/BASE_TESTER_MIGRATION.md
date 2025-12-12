# BaseTester Migration Analysis

**Last Updated:** 2025-12-12  
**Status:** ⚠️ **IN PROGRESS** - 13/15 tests migrated (87%)

## Overview
This document analyzes which integration tests can be migrated to use `BaseTester` class, which provides standardized test flow and cleanup handling.

## BaseTester Capabilities

`BaseTester` provides:
- **`flowTest()`**: Standardized CRUD flow: `validation → create → lock → check(inactive) → update → unlock → activate`
- **`readTest()`**: Read-only operations for standard objects
- **Automatic cleanup**: Handles `cleanup_after_test`, `skip_cleanup`, `cleanup_session_after_test` parameters
- **Guaranteed unlock**: Ensures objects are unlocked if they were locked
- **Error handling**: Proper cleanup on errors

## Tests That Can Be Migrated

All tests that use `IAdtObject` implementations via `AdtClient` can be migrated. They follow a standard pattern:

### Pattern 1: Full Workflow Test
```typescript
describe('Full workflow', () => {
  it('should execute full workflow and store all results', async () => {
    // validation → create → check → update → activate → cleanup
  });
});
```

### Pattern 2: Read Standard Object Test
```typescript
describe('Read standard object', () => {
  it('should read standard SAP [object]', async () => {
    // read standard object
  });
});
```

## Migration Progress

| # | Test File | Object Type | Status | Test Case Key | Test Case Name | Notes |
|---|-----------|-------------|--------|---------------|----------------|-------|
| 1 | `domain/Domain.test.ts` | Domain | ✅ **MIGRATED** | `create_domain` | `adt_domain` | Uses BaseTester.flowTest() |
| 2 | `dataElement/DataElement.test.ts` | DataElement | ✅ **MIGRATED** | `create_data_element` | `adt_data_element` | Uses BaseTester.flowTest() |
| 3 | `table/Table.test.ts` | Table | ✅ **MIGRATED** | `create_table` | `adt_table` | Uses BaseTester.flowTest() |
| 4 | `structure/Structure.test.ts` | Structure | ✅ **MIGRATED** | `create_structure` | `adt_structure` | Uses BaseTester.flowTest() |
| 5 | `program/Program.test.ts` | Program | ✅ **MIGRATED** | `create_program` | `adt_program` | Uses BaseTester.flowTest() |
| 6 | `interface/Interface.test.ts` | Interface | ✅ **MIGRATED** | `create_interface` | `adt_interface` | Uses BaseTester.flowTest() |
| 7 | `functionModule/FunctionModule.test.ts` | FunctionModule | ✅ **MIGRATED** | `create_function_module` | `adt_function_module` | Uses BaseTester.flowTest() |
| 8 | `package/Package.test.ts` | Package | ✅ **MIGRATED** | `create_package` | `adt_package` | Uses BaseTester.flowTest() |
| 9 | `serviceDefinition/ServiceDefinition.test.ts` | ServiceDefinition | ✅ **MIGRATED** | `create_service_definition` | `adt_service_definition` | Uses BaseTester.flowTest() |
| 10 | `behaviorDefinition/BehaviorDefinition.test.ts` | BehaviorDefinition | ✅ **MIGRATED** | `create_behavior_definition` | `adt_behavior_definition` | Uses BaseTester.flowTest() |
| 11 | `behaviorImplementation/BehaviorImplementation.test.ts` | BehaviorImplementation | ✅ **MIGRATED** | `create_behavior_implementation` | `adt_behavior_implementation` | Uses BaseTester.flowTest() (with BehaviorDefinition dependency) |
| 12 | `functionGroup/FunctionGroup.test.ts` | FunctionGroup | ✅ **MIGRATED** | `create_function_group` | `adt_function_group` | Uses BaseTester.flowTest() (Kerberos workaround already added) |
| 13 | `class/Class.test.ts` | Class | ✅ **MIGRATED** | `create_class` | `adt_class` | Uses BaseTester.flowTest() (unit test logic removed) |
| 14 | `view/View.test.ts` | View | ✅ **MIGRATED** | `create_view` | `adt_view` | Uses BaseTester.flowTest() (CDS unit test logic removed) |
| 15 | `metadataExtension/MetadataExtension.test.ts` | MetadataExtension | ⏳ **PENDING** | `create_metadata_extension` | `adt_metadata_extension` | Requires existing CDS projection in YAML config |

**Overall Status:** ✅ **13/15 tests migrated (87%)**

## Migration Candidates

### ✅ Fully Migratable (Standard IAdtObject)

| Test File | Object Type | Test Case Key | Test Case Name | Notes |
|-----------|-------------|---------------|----------------|-------|
| `class/Class.test.ts` | Class | `create_class` | `adt_class` | ⏳ Unit test logic will be moved to separate test file |
| `dataElement/DataElement.test.ts` | DataElement | `create_data_element` | `adt_data_element` | ✅ **MIGRATED** |
| `domain/Domain.test.ts` | Domain | `create_domain` | `adt_domain` | ✅ **MIGRATED** |
| `table/Table.test.ts` | Table | `create_table` | `adt_table` | ✅ **MIGRATED** |
| `structure/Structure.test.ts` | Structure | `create_structure` | `adt_structure` | ✅ **MIGRATED** |
| `view/View.test.ts` | View | `create_view` | `adt_view` | ⏳ CDS unit test logic will be moved to separate test file |
| `program/Program.test.ts` | Program | `create_program` | `adt_program` | ⏳ Simple migration |
| `interface/Interface.test.ts` | Interface | `create_interface` | `adt_interface` | ⏳ Simple migration |
| `functionGroup/FunctionGroup.test.ts` | FunctionGroup | `create_function_group` | `adt_function_group` | ⏳ Kerberos error handling already supported |
| `functionModule/FunctionModule.test.ts` | FunctionModule | `create_function_module` | `adt_function_module` | ⏳ Simple migration |
| `package/Package.test.ts` | Package | `create_package` | `adt_package` | ⏳ Simple migration |
| `serviceDefinition/ServiceDefinition.test.ts` | ServiceDefinition | `create_service_definition` | `adt_service_definition` | ⏳ Simple migration |
| `behaviorDefinition/BehaviorDefinition.test.ts` | BehaviorDefinition | `create_behavior_definition` | `adt_behavior_definition` | ⏳ Simple migration |
| `behaviorImplementation/BehaviorImplementation.test.ts` | BehaviorImplementation | `create_behavior_implementation` | `adt_behavior_implementation` | ⏳ Simple migration |
| `metadataExtension/MetadataExtension.test.ts` | MetadataExtension | `create_metadata_extension` | `adt_metadata_extension` | ⚠️ Requires CDS view dependency setup |

### ❌ Not Migratable (Not IAdtObject)

| Test File | Reason |
|-----------|--------|
| `shared/search.test.ts` | Uses `AdtUtils.searchObjects()` - not IAdtObject |
| `shared/readSource.test.ts` | Uses `AdtUtils.readSource()` - not IAdtObject |
| `shared/readMetadata.test.ts` | Uses `AdtUtils.readMetadata()` - not IAdtObject |
| `shared/whereUsed.test.ts` | Uses `AdtUtils.whereUsed()` - not IAdtObject |
| `shared/groupActivation.test.ts` | Uses `AdtUtils.groupActivate()` - not IAdtObject |
| `shared/sqlQuery.test.ts` | Uses `AdtUtils.getSqlQuery()` - not IAdtObject |
| `shared/tableContents.test.ts` | Uses `AdtUtils.getTableContents()` - not IAdtObject |
| `transport/Transport.test.ts` | Uses `AdtRequest` (IAdtObject) but has special transport logic |
| `class/run.test.ts` | Unit test execution - not CRUD operations |

## Migration Priority

### High Priority (Simple, Standard Flow)
1. ✅ **DataElement** - ✅ **MIGRATED** - Simple, no special logic
2. ✅ **Domain** - ✅ **MIGRATED** - Simple, no special logic
3. ✅ **Table** - ✅ **MIGRATED** - Simple, no special logic
4. ✅ **Structure** - ✅ **MIGRATED** - Simple, no special logic
5. ✅ **Program** - ✅ **MIGRATED** - Simple, no special logic
6. ✅ **Interface** - ✅ **MIGRATED** - Simple, no special logic
7. ✅ **FunctionModule** - ✅ **MIGRATED** - Simple, no special logic
8. ✅ **Package** - ✅ **MIGRATED** - Simple, no special logic
9. ✅ **ServiceDefinition** - ✅ **MIGRATED** - Simple, no special logic
10. ✅ **BehaviorDefinition** - ✅ **MIGRATED** - Simple, no special logic
11. ✅ **BehaviorImplementation** - ✅ **MIGRATED** - Simple, no special logic (with BehaviorDefinition dependency)
12. ✅ **Class** - ✅ **MIGRATED** - Unit test logic removed, migrated to BaseTester
13. ✅ **View** - ✅ **MIGRATED** - CDS unit test logic removed, migrated to BaseTester
14. ✅ **FunctionGroup** - ✅ **MIGRATED** - Simple migration (Kerberos handling already supported)

### Medium Priority (Has Special Logic)
1. ⏳ **Class** - Has unit test logic, but can migrate main flow
2. ⏳ **View** - Has CDS unit test logic, but can migrate main flow
3. ⏳ **FunctionGroup** - Has Kerberos handling (already supported)
4. ⏳ **MetadataExtension** - Requires CDS view dependency setup

### Low Priority (Complex or Not Applicable)
1. ❌ **Transport** - Special transport request logic
2. ❌ **Shared tests** - Not IAdtObject implementations

## Migration Example

### Before (Current Test)
```typescript
it('should execute full workflow and store all results', async () => {
  // Check cleanup settings
  const envConfig = getEnvironmentConfig();
  const cleanupAfterTest = envConfig.cleanup_after_test !== false;
  const skipCleanup = testCase.params.skip_cleanup === true;
  const shouldCleanup = cleanupAfterTest && !skipCleanup;
  
  let objectCreated = false;
  
  try {
    // 1. Validate
    await client.getDataElement().validate(config);
    
    // 2. Create
    await client.getDataElement().create(config, { activateOnCreate: false });
    objectCreated = true;
    
    // 3. Check
    await client.getDataElement().check(config, 'inactive');
    
    // 4. Update
    await client.getDataElement().update(config);
    
    // 5. Activate
    await client.getDataElement().activate(config);
    
    // 6. Cleanup
    if (shouldCleanup && objectCreated) {
      await client.getDataElement().delete(config);
    }
  } catch (error) {
    if (shouldCleanup && objectCreated) {
      await client.getDataElement().delete(config);
    }
    throw error;
  }
});
```

### After (Using BaseTester)
```typescript
import { BaseTester } from '../../helpers/BaseTester';

const tester = new BaseTester(
  client.getDataElement(),
  'DataElement',
  'create_data_element',
  'adt_data_element',
  testsLogger
);

it('should execute full workflow and store all results', async () => {
  const testCase = tester.getTestCaseDefinition();
  const config = buildConfig(testCase);
  
  await tester.flowTest(config, testCase.params, {
    sourceCode: testCase.params.source_code,
    updateConfig: { /* update fields */ }
  });
});
```

## Benefits of Migration

1. **Consistency**: All tests use the same flow and cleanup logic
2. **Maintainability**: Changes to test flow happen in one place
3. **Reliability**: Guaranteed cleanup and unlock handling
4. **Reduced Code**: ~200-300 lines per test file → ~50-100 lines
5. **Error Handling**: Standardized error handling and cleanup
6. **Cleanup Parameters**: Automatic handling of cleanup settings

## Migration Steps

### For Standard CRUD Tests:
1. Import `BaseTester` from `../../helpers/BaseTester`
2. Create `BaseTester` instance in `beforeAll` or test setup
3. Replace "Full workflow" test with `tester.flowTest()`
4. Replace "Read standard object" test with `tester.readTest()`
5. Remove manual cleanup logic (handled by BaseTester)
6. Remove manual unlock logic (handled by BaseTester)

### For Class and View Tests (Special):
1. **Remove unit test logic** from main test files (unit tests will be tested separately):
   - `class/Class.test.ts` - Remove all unit test related code, keep only CRUD operations
   - `view/View.test.ts` - Remove all CDS unit test related code, keep only CRUD operations
2. **Migrate CRUD flow** in main test files:
   - `class/Class.test.ts` - Use `BaseTester` for CRUD only
   - `view/View.test.ts` - Use `BaseTester` for CRUD only
3. **Unit test functionality** will be tested in separate test files (not part of BaseTester migration)

## Special Cases Handling

### Unit Tests (Class, View) - **SEPARATED INTO NEW FILES**
- **Class Unit Tests**: Move to `class/ClassUnitTest.test.ts`
  - Test class creation, update, and unit test execution
  - Separate from CRUD flow test
  - Uses `AdtUnitTest` (IAdtObject) for test class operations
  - Uses `AdtClient.getUnitTest()` for unit test execution
  
- **View CDS Unit Tests**: Move to `view/ViewCdsUnitTest.test.ts`
  - CDS view unit test creation and execution
  - Separate from CRUD flow test
  - Uses `AdtCdsUnitTest` (IAdtObject) for CDS unit test operations
  - Uses `AdtClient.getCdsUnitTest()` for CDS unit test execution

- **Main CRUD Tests**: Use `BaseTester` for standard flow
  - `Class.test.ts` - Only CRUD operations (create, read, update, delete, activate)
  - `View.test.ts` - Only CRUD operations (create, read, update, delete, activate)

### Dependencies (MetadataExtension)
- **Requires existing CDS projection** in YAML test config
- Test config must specify `cds_projection_name` parameter pointing to existing CDS view
- No automatic dependency creation - CDS view must exist before test runs

### Kerberos Errors (FunctionGroup)
- **Workaround already added** in FunctionGroup check operation
- Handles "REPORT/PROGRAM statement is missing" error for empty function groups
- No special action needed for BaseTester migration

## Estimated Impact

- **Files to migrate**: 15 test files (14 CRUD + 1 MetadataExtension)
- **Files migrated**: 13/15 (87%)
- **Files remaining**: 2/15 (13%)
- **New test files to create**: 2 files (ClassUnitTest.test.ts, ViewCdsUnitTest.test.ts)
- **Lines of code reduction**: ~200-300 lines per CRUD test file = ~2800-4200 lines total (estimated)
- **Code organization**: Better separation of concerns (CRUD vs Unit Test functionality)
- **Time savings**: Faster test development, easier maintenance
- **Risk**: Low - BaseTester is well-tested and handles edge cases

## Migration Status Summary

**Completed (13/15):**
- ✅ Domain.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ DataElement.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ Table.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ Structure.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ Program.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ Interface.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ FunctionModule.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ Package.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ ServiceDefinition.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ BehaviorDefinition.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest()
- ✅ BehaviorImplementation.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest() (with BehaviorDefinition dependency)
- ✅ FunctionGroup.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest() (Kerberos workaround already added)
- ✅ Class.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest() (unit test logic removed)
- ✅ View.test.ts - Uses BaseTester.flowTest() and BaseTester.readTest() (CDS unit test logic removed)

**Remaining (11/15):**
- ⏳ Class.test.ts - Needs unit test logic separation (unit tests will be in separate file)
- ⏳ View.test.ts - Needs CDS unit test logic separation (CDS unit tests will be in separate file)
- ⏳ Program.test.ts - Simple migration
- ⏳ Interface.test.ts - Simple migration
- ⏳ FunctionGroup.test.ts - Simple migration
- ⏳ FunctionModule.test.ts - Simple migration
- ⏳ Package.test.ts - Simple migration
- ⏳ ServiceDefinition.test.ts - Simple migration
- ⏳ BehaviorDefinition.test.ts - Simple migration
- ⏳ BehaviorImplementation.test.ts - Simple migration
- ⏳ MetadataExtension.test.ts - Requires CDS view dependency setup

## New Test File Structure

### After Migration:
```
integration/
├── class/
│   ├── Class.test.ts              # CRUD operations only (uses BaseTester)
│   └── ClassUnitTest.test.ts      # Unit test operations (new file)
├── view/
│   ├── View.test.ts               # CRUD operations only (uses BaseTester)
│   └── ViewCdsUnitTest.test.ts    # CDS unit test operations (new file)
└── [other test files using BaseTester]
```
