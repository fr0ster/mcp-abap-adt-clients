# BaseTester Migration Analysis

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

## Migration Candidates

### ✅ Fully Migratable (Standard IAdtObject)

| Test File | Object Type | Test Case Key | Test Case Name | Notes |
|-----------|-------------|---------------|----------------|-------|
| `class/Class.test.ts` | Class | `create_class` | `adt_class` | ✅ Simple migration - unit test logic will be moved to separate test file |
| `dataElement/DataElement.test.ts` | DataElement | `create_data_element` | `adt_data_element` | ✅ Simple migration |
| `domain/Domain.test.ts` | Domain | `create_domain` | `adt_domain` | ✅ Simple migration |
| `view/View.test.ts` | View | `create_view` | `adt_view` | ✅ Simple migration - CDS unit test logic will be moved to separate test file |
| `table/Table.test.ts` | Table | `create_table` | `adt_table` | ✅ Simple migration |
| `structure/Structure.test.ts` | Structure | `create_structure` | `adt_structure` | ✅ Simple migration |
| `program/Program.test.ts` | Program | `create_program` | `adt_program` | ✅ Simple migration |
| `interface/Interface.test.ts` | Interface | `create_interface` | `adt_interface` | ✅ Simple migration |
| `functionGroup/FunctionGroup.test.ts` | FunctionGroup | `create_function_group` | `adt_function_group` | ✅ Simple migration - Kerberos error handling already supported |
| `functionModule/FunctionModule.test.ts` | FunctionModule | `create_function_module` | `adt_function_module` | ✅ Simple migration |
| `package/Package.test.ts` | Package | `create_package` | `adt_package` | ✅ Simple migration |
| `serviceDefinition/ServiceDefinition.test.ts` | ServiceDefinition | `create_service_definition` | `adt_service_definition` | ✅ Simple migration |
| `behaviorDefinition/BehaviorDefinition.test.ts` | BehaviorDefinition | `create_behavior_definition` | `adt_behavior_definition` | ✅ Simple migration |
| `behaviorImplementation/BehaviorImplementation.test.ts` | BehaviorImplementation | `create_behavior_implementation` | `adt_behavior_implementation` | ✅ Simple migration |
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
1. ✅ **DataElement** - Simple, no special logic
2. ✅ **Domain** - Simple, no special logic
3. ✅ **Table** - Simple, no special logic
4. ✅ **Structure** - Simple, no special logic
5. ✅ **Program** - Simple, no special logic
6. ✅ **Interface** - Simple, no special logic
7. ✅ **FunctionModule** - Simple, no special logic
8. ✅ **Package** - Simple, no special logic
9. ✅ **ServiceDefinition** - Simple, no special logic
10. ✅ **BehaviorDefinition** - Simple, no special logic
11. ✅ **BehaviorImplementation** - Simple, no special logic
12. ✅ **Class** - Simple migration after unit test logic is moved to separate file
13. ✅ **View** - Simple migration after CDS unit test logic is moved to separate file
14. ✅ **FunctionGroup** - Simple migration (Kerberos handling already supported)

### Medium Priority (Has Special Logic)
1. ⚠️ **Class** - Has unit test logic, but can migrate main flow
2. ⚠️ **View** - Has CDS unit test logic, but can migrate main flow
3. ⚠️ **FunctionGroup** - Has Kerberos handling (already supported)
4. ⚠️ **MetadataExtension** - Requires CDS view dependency setup

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
1. **Extract unit test logic** to separate files:
   - `class/ClassUnitTest.test.ts` - All unit test related code
   - `view/ViewCdsUnitTest.test.ts` - All CDS unit test related code
2. **Migrate CRUD flow** in main test files:
   - `class/Class.test.ts` - Use `BaseTester` for CRUD only
   - `view/View.test.ts` - Use `BaseTester` for CRUD only
3. **Unit test files** remain separate and don't use `BaseTester` (they test unit test functionality, not CRUD)

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
- Setup dependencies (CDS view) before `flowTest()`
- Cleanup dependencies after test (if needed)

### Kerberos Errors (FunctionGroup)
- Already handled in `BaseTester` via error handling
- No special action needed

## Estimated Impact

- **Files to migrate**: 15 test files (14 CRUD + 1 MetadataExtension)
- **New test files to create**: 2 files (ClassUnitTest.test.ts, ViewCdsUnitTest.test.ts)
- **Lines of code reduction**: ~200-300 lines per CRUD test file = ~2800-4200 lines total
- **Code organization**: Better separation of concerns (CRUD vs Unit Test functionality)
- **Time savings**: Faster test development, easier maintenance
- **Risk**: Low - BaseTester is well-tested and handles edge cases

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
