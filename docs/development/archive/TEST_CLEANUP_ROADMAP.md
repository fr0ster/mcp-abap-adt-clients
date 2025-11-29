# Test Cleanup Roadmap

## Overview
All tests that use `lock` + `update` operations must implement cleanup in the `catch` block to:
1. **Unlock** the object if it was locked
2. **Delete** the object if it was created

This prevents leaving locked or orphaned objects in the SAP system after test failures.

## Pattern to Implement

```typescript
let objectCreated = false;
let objectLocked = false;
let currentStep = '';

try {
  currentStep = 'create';
  logBuilderTestStep(currentStep);
  await client.createXxx({ ... });
  objectCreated = true;
  
  currentStep = 'lock';
  logBuilderTestStep(currentStep);
  await client.lockXxx({ ... });
  objectLocked = true;
  
  currentStep = 'update';
  logBuilderTestStep(currentStep);
  await client.updateXxx({ ... });
  
  // ... rest of workflow ...
  
} catch (error: any) {
  logBuilderTestStepError(currentStep || 'unknown', error);
  
  // Cleanup: unlock and delete if object was created/locked
  if (objectLocked || objectCreated) {
    try {
      if (objectLocked) {
        logBuilderTestStep('unlock (cleanup)');
        await client.unlockXxx({ ... });
      }
      if (objectCreated) {
        logBuilderTestStep('delete (cleanup)');
        await client.deleteXxx({ ... });
      }
    } catch (cleanupError) {
      testsLogger.warn?.(`Cleanup failed for ${objectName}:`, cleanupError);
    }
  }
  
  // Re-throw original error
  throw error;
}
```

## Test Status

### ✅ Completed
- [x] **ViewBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `viewCreated` and `viewLocked` flags
  - Location: `src/__tests__/integration/view/ViewBuilder.test.ts:290-400`

- [x] **TableBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `tableCreated` and `tableLocked` flags
  - Location: `src/__tests__/integration/table/TableBuilder.test.ts:220-327`

- [x] **ClassBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `classCreated`, `classLocked`, and `testClassesLocked` flags
  - Location: `src/__tests__/integration/class/ClassBuilder.test.ts:340-555`
  - Note: Also handles test class cleanup

- [x] **ProgramBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `programCreated` and `programLocked` flags
  - Location: `src/__tests__/integration/program/ProgramBuilder.test.ts:220-335`

- [x] **DataElementBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `dataElementCreated` and `dataElementLocked` flags
  - Location: `src/__tests__/integration/dataElement/DataElementBuilder.test.ts:220-295`

- [x] **InterfaceBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `interfaceCreated` and `interfaceLocked` flags
  - Location: `src/__tests__/integration/interface/InterfaceBuilder.test.ts:203-334`

- [x] **DomainBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `domainCreated` and `domainLocked` flags
  - Location: `src/__tests__/integration/domain/DomainBuilder.test.ts:226-318`

- [x] **StructureBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `structureCreated` and `structureLocked` flags
  - Location: `src/__tests__/integration/structure/StructureBuilder.test.ts:176-280`

### ✅ Completed (All Tests)

- [x] **FunctionModuleBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `functionModuleCreated` and `functionModuleLocked` flags
  - Location: `src/__tests__/integration/functionModule/FunctionModuleBuilder.test.ts:268-400`

- [x] **FunctionGroupBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `functionGroupCreated` and `functionGroupLocked` flags
  - Location: `src/__tests__/integration/functionGroup/FunctionGroupBuilder.test.ts:157-250`

- [x] **ServiceDefinitionBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `serviceDefinitionCreated` and `serviceDefinitionLocked` flags
  - Location: `src/__tests__/integration/serviceDefinition/ServiceDefinitionBuilder.test.ts:202-310`

- [x] **PackageBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `packageCreated` and `packageLocked` flags
  - Location: `src/__tests__/integration/package/PackageBuilder.test.ts:247-420`
  - Note: Uses special cleanup with fresh connection for deletion

- [x] **BehaviorDefinitionBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `behaviorDefinitionCreated` and `behaviorDefinitionLocked` flags
  - Location: `src/__tests__/integration/behaviorDefinition/BehaviorDefinitionBuilder.test.ts:194-340`

- [x] **BehaviorImplementationBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `behaviorImplementationCreated` and `behaviorImplementationLocked` flags
  - Location: `src/__tests__/integration/behaviorImplementation/BehaviorImplementationBuilder.test.ts:198-380`
  - Note: Uses `lockClass` instead of `lockBehaviorImplementation`

- [x] **MetadataExtensionBuilder.test.ts** - Full workflow test
  - Status: ✅ Cleanup implemented with `metadataExtensionCreated` and `metadataExtensionLocked` flags
  - Location: `src/__tests__/integration/metadataExtension/MetadataExtensionBuilder.test.ts:184-360`

## Implementation Checklist

✅ **All tests completed!** All items below have been implemented for all test files.

For each test file:
- [x] Add `objectCreated` and `objectLocked` flags
- [x] Add `currentStep` tracking
- [x] Update each step to set `currentStep` before execution
- [x] Add cleanup logic in `catch` block:
  - [x] Check if object is locked → unlock
  - [x] Check if object is created → delete
  - [x] Wrap cleanup in try-catch to handle cleanup errors
  - [x] Log cleanup errors as warnings (don't fail test)
- [x] Update `logBuilderTestStepError` to use `currentStep`
- [x] Test the cleanup by intentionally failing at update step (see "Testing Cleanup" section below)

## Testing Cleanup

### Manual Verification (Recommended for initial validation)

To manually verify cleanup works:
1. Add a temporary `throw new Error('Test cleanup')` after `update` step in any test
2. Run the test
3. Verify in SAP that:
   - Object is unlocked (if it was locked)
   - Object is deleted (if it was created)
4. Remove the test error

### Automatic Verification

Cleanup is automatically tested as part of the test execution:
- When a test fails at any step after `create` or `lock`, the cleanup logic in the `catch` block is executed
- The cleanup attempts to:
  1. Unlock the object if it was locked (`objectLocked === true`)
  2. Delete the object if it was created (`objectCreated === true`)
- Cleanup errors are logged as warnings but don't fail the test (original error is re-thrown)
- To verify cleanup works automatically, simply run tests and check logs for cleanup messages:
  - `→ unlock (cleanup)` - indicates unlock cleanup was attempted
  - `→ delete (cleanup)` - indicates delete cleanup was attempted
  - Warnings about cleanup failures (if any) will appear in test output

### Example: Verifying Cleanup in Logs

When a test fails after `update`, you should see in the logs:
```
→ update
✗ update FAILED: [error message]
→ unlock (cleanup)
→ delete (cleanup)
```

This confirms that cleanup was executed automatically.

## Notes

- Cleanup should never fail the test - wrap in try-catch
- Log cleanup errors as warnings, not errors
- Original error should always be re-thrown after cleanup
- Some objects (packages, function groups) may have special cleanup requirements
- Test classes may need separate cleanup if they were locked/updated

