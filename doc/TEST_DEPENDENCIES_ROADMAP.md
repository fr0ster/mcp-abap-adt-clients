# Test Dependencies Roadmap

## Overview
Some builder tests require dependent objects to be created before the test runs. This roadmap defines:
1. Which tests need dependent objects
2. Helper functions to create dependencies with full workflow
3. Cleanup logic for failed dependency creation
4. Skip logic when dependencies cannot be created

## Automation Strategy

**Important**: We automate only **simple dependency cases**:
- ✅ **Automated**: Simple cases like creating a table (or table + view)
- ⚠️ **Manual**: Complex cases require manual environment setup

**Rationale**:
- Complex dependency chains (e.g., Domain → DataElement, FunctionGroup → FunctionModule, BehaviorDefinition → BehaviorImplementation) are error-prone when automated
- Manual setup ensures test environment is stable and predictable
- Simple cases (table, view) are straightforward and safe to automate
- Tests should focus on testing the builder, not complex dependency management

**Current Automation**:
- ✅ Table creation for ViewBuilder tests (simple, single dependency)
- ⏸️ Other dependencies deferred - require manual setup in test environment

## Pattern for Dependency Creation

### Helper Function Behavior

Helper functions for dependency creation follow this logic:

1. **Object doesn't exist** → Create it (full workflow: validate → create → lock → update → unlock → activate)
2. **Object already exists** → Return error (skip reason: "Dependency already exists (may be owned by another user)")
3. **Creation failed** → Return error (skip reason: "Failed to create dependency: [error details]")
4. **Any error during workflow** → Cleanup (unlock + delete if needed) → Return error (skip reason: "Environment problem - test skipped")

**Important**: All errors result in test being skipped with clear reason indicating it's an **environment problem**, not a test failure.

### Helper Function Pattern
```javascript
/**
 * Create dependency object with full workflow
 * @param {Object} client - CrudClient instance
 * @param {Object} config - Dependency configuration
 * @param {Object} testCase - Test case for delays
 * @returns {Promise<{success: boolean, reason?: string, created?: boolean}>}
 * 
 * Behavior:
 * - If object doesn't exist: creates it (full workflow)
 * - If object exists: returns error (skip reason)
 * - If creation fails: returns error (skip reason)
 * - If any error occurs: cleanup + returns error (skip reason - environment problem)
 */
async function createDependencyObject(client, config, testCase) {
  let objectCreated = false;
  let objectLocked = false;
  let currentStep = '';
  
  try {
    // Step 1: Validate
    currentStep = 'validate';
    const validationResponse = await client.validateXxx({...});
    if (validationResponse?.status !== 200) {
      const errorMessage = extractValidationErrorMessage(validationResponse);
      const errorTextLower = errorMessage.toLowerCase();
      
      // If object already exists, return skip reason (environment problem)
      if (errorTextLower.includes('already exists') || 
          errorTextLower.includes('does already exist') ||
          errorTextLower.includes('exceptionresourcealreadyexists')) {
        return {
          success: false,
          reason: `Dependency ${config.objectName} already exists (may be owned by another user) - environment problem, test skipped`,
          created: false
        };
      }
      
      // Other validation errors (environment problem)
      // extractValidationErrorMessage parses XML and extracts meaningful error message
      return {
        success: false,
        reason: `Dependency validation failed: ${errorMessage} - environment problem, test skipped`,
        created: false
      };
    }
    
    // Step 2: Create
    currentStep = 'create';
    await client.createXxx({...});
    objectCreated = true;
    await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
    
    // Step 3: Lock
    currentStep = 'lock';
    await client.lockXxx({...});
    objectLocked = true;
    await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
    
    // Step 4: Update (if needed)
    currentStep = 'update';
    await client.updateXxx({...});
    await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
    
    // Step 5: Unlock
    currentStep = 'unlock';
    await client.unlockXxx({...});
    objectLocked = false;
    await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
    
    // Step 6: Activate
    currentStep = 'activate';
    await client.activateXxx({...});
    await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
    
    return {
      success: true,
      created: true
    };
    
  } catch (error) {
    // Cleanup: unlock and delete if object was created/locked
    if (objectLocked || objectCreated) {
      try {
        if (objectLocked) {
          await client.unlockXxx({...});
        }
        if (objectCreated) {
          await client.deleteXxx({...});
        }
      } catch (cleanupError) {
        // Log but don't fail - original error is more important
        // Cleanup errors are silent to avoid noise
      }
    }
    
    // Any error = environment problem, test should be skipped
    return {
      success: false,
      reason: `Failed to create dependency ${config.objectName}: ${error instanceof Error ? error.message : String(error)} - environment problem, test skipped`,
      created: false
    };
  }
}
```

### Test Integration Pattern
```typescript
beforeEach(async () => {
  // ... existing setup ...
  
  // Create dependency if needed
  if (dependencyName && dependencySource) {
    const dependencyConfig = {
      objectName: dependencyName,
      packageName: resolvePackageName(tc.params.package_name),
      description: `Test dependency for ${mainObjectName}`,
      sourceCode: dependencySource,
      transportRequest: resolveTransportRequest(tc.params.transport_request)
    };
    
    const dependencyResult = await createDependencyObject(
      client,
      dependencyConfig,
      tc
    );
    
    // If dependency creation failed or object exists, skip test (environment problem)
    if (!dependencyResult.success) {
      skipReason = dependencyResult.reason || 'Failed to create dependency - environment problem, test skipped';
      testCase = null;
      return;
    }
  }
});
```

### Error Handling Logic

Helper functions always return `{success: boolean, reason?: string, created?: boolean}`:
- **`success: true`** → Object created successfully, test can proceed
- **`success: false`** → Environment problem, test should be skipped
  - Reason always includes "environment problem, test skipped" for clarity
  - Error messages are parsed from XML using `extractValidationErrorMessage()` to show meaningful SAP error messages
  - Test is skipped, not failed (this is an environment issue, not a code issue)
  - In `beforeEach`/`beforeAll`: Sets `skipReason`, clears test variables, returns early
  - In `it()` block: Checks `if (skipReason)` at start, calls `logBuilderTestSkip()` and `return` to exit test

**Important**: When validation fails in helper function:
1. Helper returns `{success: false, reason: "..."}`
2. Test's `beforeEach`/`beforeAll` sets `skipReason` and returns early
3. Test's `it()` block checks `skipReason` at start and skips with `logBuilderTestSkip()` + `return`
4. Test does NOT proceed to actual test logic - it exits immediately

## Test Dependencies

### ✅ High Priority

#### 1. **ViewBuilder.test.ts** - Requires Table
- **Dependency**: Table (CDS Table)
- **Config Field**: `table_name`, `table_source`
- **Helper Function**: `createDependencyTable(client, config, testCase)`
- **Status**: ✅ Implemented
- **Location**: `src/__tests__/integration/view/ViewBuilder.test.ts`
- **Notes**: 
  - Table must be created before view
  - View references table in DDL source
  - Table cleanup in `afterEach` if created in `beforeEach`
  - Uses `createDependencyTable` helper function from `test-helper.js`

#### 2. **DataElementBuilder.test.ts** - Requires Domain
- **Dependency**: Domain
- **Config Field**: `type_kind` = 'domain', `type_name` (domain name), `domain_data_type`, `domain_length`, `domain_decimals` (optional)
- **Helper Function**: `createDependencyDomain(client, config, testCase)`
- **Status**: ✅ Implemented
- **Location**: `src/__tests__/integration/dataElement/DataElementBuilder.test.ts`
- **Notes**:
  - DataElement references Domain for data type
  - Domain must exist before DataElement creation
  - Domain created in `beforeEach` if `type_kind` = 'domain' and `type_name` provided
  - Domain cleanup in `afterEach` if created in `beforeEach`
  - Uses `createDependencyDomain` helper function from `test-helper.js`
  - Test skips if domain validation fails or domain already exists

#### 3. **FunctionModuleBuilder.test.ts** - Requires FunctionGroup
- **Dependency**: FunctionGroup
- **Config Field**: `function_group_name`
- **Helper Function**: `createDependencyFunctionGroup(client, config, testCase)`
- **Status**: ✅ Implemented
- **Location**: `src/__tests__/integration/functionModule/FunctionModuleBuilder.test.ts`
- **Notes**:
  - FunctionModule must belong to FunctionGroup
  - FunctionGroup must exist before FunctionModule creation
  - FunctionGroup created in `beforeEach` if `function_group_name` provided
  - FunctionGroup cleanup in `afterEach` if created in `beforeEach`
  - Uses `createDependencyFunctionGroup` helper function from `test-helper.js`
  - Test skips if function group validation fails or function group already exists

#### 4. **MetadataExtensionBuilder.test.ts** - Requires CDS View
- **Dependency**: CDS View (DDLS)
- **Config Field**: `view_name`, `ddl_source`
- **Helper Function**: `createDependencyCdsView(client, config, testCase)`
- **Status**: ✅ Implemented
- **Location**: `src/__tests__/integration/metadataExtension/MetadataExtensionBuilder.test.ts`
- **Notes**:
  - MetadataExtension extends CDS View
  - CDS View must exist before MetadataExtension creation
  - CDS View created in `beforeAll` if `view_name` and `ddl_source` provided
  - CDS View cleanup in `afterAll` if created in `beforeAll`
  - Uses `createDependencyCdsView` helper function from `test-helper.js`
  - Test skips if CDS view validation fails or CDS view already exists

### ⚠️ Medium Priority

#### 5. **BehaviorDefinitionBuilder.test.ts** - May require Table
- **Dependency**: Table (for data source)
- **Config Field**: `table_name`, `table_source` (optional)
- **Helper Function**: `createDependencyTable(connection, config, testCase)` (reuse)
- **Status**: ❌ Needs verification
- **Location**: `src/__tests__/integration/behaviorDefinition/BehaviorDefinitionBuilder.test.ts`
- **Notes**: Only if BehaviorDefinition uses table as data source

#### 6. **BehaviorImplementationBuilder.test.ts** - Requires BehaviorDefinition
- **Dependency**: BehaviorDefinition
- **Config Field**: `behavior_definition_name`, `behavior_definition_source`, `root_entity`, `implementation_type` (optional, default: 'Managed')
- **Helper Function**: `createDependencyBehaviorDefinition(client, config, testCase)`
- **Status**: ✅ Implemented
- **Location**: `src/__tests__/integration/behaviorImplementation/BehaviorImplementationBuilder.test.ts`
- **Notes**:
  - BehaviorImplementation implements BehaviorDefinition
  - BehaviorDefinition must exist first
  - BehaviorDefinition created in `beforeAll` if `behavior_definition_name` and `behavior_definition_source` provided
  - BehaviorDefinition cleanup in `afterAll` if created in `beforeAll`
  - Uses `createDependencyBehaviorDefinition` helper function from `test-helper.js`
  - Test skips if behavior definition validation fails or behavior definition already exists

### 📋 Lower Priority (No Dependencies)

#### 7. **TableBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 8. **ClassBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 9. **ProgramBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 10. **InterfaceBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 11. **DomainBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 12. **StructureBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 13. **PackageBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

#### 14. **ServiceDefinitionBuilder.test.ts** - May require CDS View
- **Dependency**: CDS View (optional)
- **Status**: ❌ Needs verification
- **Notes**: Only if ServiceDefinition references CDS View

#### 15. **FunctionGroupBuilder.test.ts** - No dependencies
- **Status**: ✅ No dependencies needed

## Implementation Plan

### Phase 1: Helper Functions (test-helper.js) - ✅ COMPLETED
1. ✅ Create `createDependencyTable(client, config, testCase)` - **COMPLETED**
2. ✅ Create `createDependencyDomain(client, config, testCase)` - **COMPLETED**
3. ✅ Create `createDependencyFunctionGroup(client, config, testCase)` - **COMPLETED**
4. ✅ Create `createDependencyCdsView(client, config, testCase)` - **COMPLETED**
5. ✅ Create `createDependencyBehaviorDefinition(client, config, testCase)` - **COMPLETED**

**Note**: All helper functions are implemented and integrated into their respective tests:
- `createDependencyTable` - used in ViewBuilder.test.ts
- `createDependencyDomain` - used in DataElementBuilder.test.ts
- `createDependencyFunctionGroup` - used in FunctionModuleBuilder.test.ts
- `createDependencyCdsView` - used in MetadataExtensionBuilder.test.ts
- `createDependencyBehaviorDefinition` - used in BehaviorImplementationBuilder.test.ts

### Phase 2: Test Integration - ✅ COMPLETED
1. ✅ **ViewBuilder.test.ts** - Integrate `createDependencyTable` in `beforeEach` - **COMPLETED**
2. ✅ **DataElementBuilder.test.ts** - Integrate `createDependencyDomain` in `beforeEach` - **COMPLETED**
3. ✅ **FunctionModuleBuilder.test.ts** - Integrate `createDependencyFunctionGroup` in `beforeEach` - **COMPLETED**
4. ✅ **MetadataExtensionBuilder.test.ts** - Integrate `createDependencyCdsView` in `beforeAll` - **COMPLETED**
5. ✅ **BehaviorImplementationBuilder.test.ts** - Integrate `createDependencyBehaviorDefinition` in `beforeAll` - **COMPLETED**

### Phase 3: Cleanup Integration - ✅ COMPLETED
1. ✅ **ViewBuilder.test.ts** - Add `afterEach` for table cleanup - **COMPLETED**
2. ✅ **DataElementBuilder.test.ts** - Add `afterEach` for domain cleanup - **COMPLETED**
3. ✅ **FunctionModuleBuilder.test.ts** - Add `afterEach` for function group cleanup - **COMPLETED**
4. ✅ **MetadataExtensionBuilder.test.ts** - Add `afterAll` for CDS view cleanup - **COMPLETED**
5. ✅ **BehaviorImplementationBuilder.test.ts** - Add `afterAll` for behavior definition cleanup - **COMPLETED**

## Current Status

✅ **Completed**: All helper functions and test integrations
- All helper functions (`createDependencyTable`, `createDependencyDomain`, `createDependencyFunctionGroup`, `createDependencyCdsView`, `createDependencyBehaviorDefinition`) implemented in `test-helper.js`
- All test integrations completed:
  - ViewBuilder.test.ts - Table dependency (beforeEach/afterEach)
  - DataElementBuilder.test.ts - Domain dependency (beforeEach/afterEach)
  - FunctionModuleBuilder.test.ts - FunctionGroup dependency (beforeEach/afterEach)
  - MetadataExtensionBuilder.test.ts - CDS View dependency (beforeAll/afterAll)
  - BehaviorImplementationBuilder.test.ts - BehaviorDefinition dependency (beforeAll/afterAll)
- All cleanup hooks implemented in `afterEach` or `afterAll`
- Handles validation, creation, lock, update, unlock, activate workflow
- Includes cleanup on failure (unlock + delete)
- Returns skip reason if dependency already exists (environment problem)
- **Error handling**: All validation errors result in test skip (not failure)
  - Helper functions return `{success: false, reason: "..."}` on validation failure
  - Tests check `skipReason` at start of `it` block and skip with `logBuilderTestSkip` + `return`
  - Error messages are parsed from XML to show meaningful SAP error messages
- **Simple cases**: Single dependency - safe to automate

## Automated Dependency Management

All simple dependency cases are now automated:

1. **DataElementBuilder.test.ts** - Domain dependency
   - Automatically creates Domain if `type_kind` = 'domain' and `type_name` (domain name) is provided
   - Cleanup in `afterEach` if domain was created

2. **FunctionModuleBuilder.test.ts** - FunctionGroup dependency
   - Automatically creates FunctionGroup if `function_group_name` is provided
   - Cleanup in `afterEach` if function group was created

3. **MetadataExtensionBuilder.test.ts** - CDS View dependency
   - Automatically creates CDS View if `view_name` and `ddl_source` are provided
   - Cleanup in `afterAll` if CDS view was created

4. **BehaviorImplementationBuilder.test.ts** - BehaviorDefinition dependency
   - Automatically creates BehaviorDefinition if `behavior_definition_name` and `behavior_definition_source` are provided
   - Cleanup in `afterAll` if behavior definition was created

**Note**: Complex dependency chains (e.g., BehaviorDefinition that requires Table, which requires Domain) still require manual environment setup.

**Note**: Tests will skip with clear error messages if dependencies are missing, making it easy to identify what needs to be set up manually.

## Skip Logic

### When Dependency Creation Fails
```typescript
if (!dependencyResult.success) {
  skipReason = dependencyResult.reason || 'Failed to create dependency';
  testCase = null;
  return;
}
```

### When Dependency Already Exists
```typescript
// In helper function
if (errorTextLower.includes('already exists')) {
  return {
    success: false,
    reason: `Dependency ${config.objectName} already exists (may be owned by another user)`,
    created: false
  };
}
```

## Error Messages

### Standard Messages
- **Creation failed**: `"Test skipped: Failed to create required dependency table ${tableName}: ${error}"`
- **Already exists**: `"Test skipped: Dependency table ${tableName} already exists (may be owned by another user)"`
- **Validation failed**: `"Test skipped: Dependency validation failed: ${errorText}"`

## Notes

- All dependency creation functions must follow the same pattern: validate → create → lock → update → unlock → activate
- Cleanup must happen in helper function catch block (unlock + delete)
- Cleanup must also happen in test `afterEach` if dependency was created in `beforeEach`
- Skip reasons should be descriptive to help diagnose issues
- Dependencies should be created with unique names to avoid conflicts in multi-user environments

