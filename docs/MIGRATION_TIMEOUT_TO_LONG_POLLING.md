# Roadmap: Migration from Timeouts to Long Polling

## Overview

This document outlines the migration plan to replace fixed timeouts with long polling (`?withLongPolling=true`) in ADT object operations. Long polling allows the server to hold the connection open until the object becomes available, eliminating the need for arbitrary timeout delays.

## Status

✅ **Completed:**
- Interface updates (`IAdtObject`, `IBuilder`) - `withLongPolling` parameter added to all GET methods
- Low-level read functions updated to support `withLongPolling` (all read/metadata/transport functions)
- All `AdtObject` implementations - `read`, `readMetadata`, `readTransport` methods support `withLongPolling`
- All `Builder` implementations - `read` methods support `withLongPolling`
- `AdtDomain`, `AdtClass`, `AdtDataElement`, `AdtProgram`, `AdtInterface`, `AdtTable`, `AdtView`, `AdtStructure`, `AdtFunctionGroup` - fully migrated (create, update methods use long polling)
- `BaseTester` - read with long polling added between create and update
- Test script for long polling verification created

⏳ **In Progress:**
- Remaining `AdtObject` implementations (FunctionModule, BehaviorDefinition, BehaviorImplementation, MetadataExtension, ServiceDefinition, Package) - need to add long polling in create/update methods

❌ **Not Started:**
- Test cleanup (remove timeout-based waits)
- Documentation updates

---

## 1. AdtObject Implementations

### 1.1. Domain ✅ COMPLETED
**File:** `src/core/domain/AdtDomain.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ Removed `timeout` variable usage

### 1.2. Class ✅ COMPLETED
**File:** `src/core/class/AdtClass.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)

**Pattern to follow:**
```typescript
// After create/update/activate
this.logger?.info?.('read (wait for object ready)');
try {
  await this.read(
    { className: config.className },
    'active',
    { withLongPolling: true }
  );
  this.logger?.info?.('object is ready');
} catch (readError) {
  this.logger?.warn?.('read with long polling failed:', readError);
  // Continue anyway
}
```

### 1.3. DataElement ✅ COMPLETED
**File:** `src/core/dataElement/AdtDataElement.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ Removed `timeout` variable usage (was on lines 95, 330)

**Note:** Similar structure to `AdtDomain` - data element without source code.

### 1.4. Table ✅ COMPLETED
**File:** `src/core/table/AdtTable.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`: Updated to accept `withLongPolling` parameter
- ✅ `getTableSource()`: Updated to accept `withLongPolling` parameter

**Note:** Table has DDL code, similar to View.

### 1.5. View ✅ COMPLETED
**File:** `src/core/view/AdtView.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`: Updated to accept `withLongPolling` parameter
- ✅ `getViewSource()`: Updated to accept `withLongPolling` parameter

**Note:** View has DDL source, similar to Table.

### 1.6. Structure ✅ COMPLETED
**File:** `src/core/structure/AdtStructure.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter

### 1.7. Program ✅ COMPLETED
**File:** `src/core/program/AdtProgram.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`: Updated to accept `withLongPolling` parameter
- ✅ `getProgramSource()`: Updated to accept `withLongPolling` parameter

**Note:** Program has source code, similar to Class/Interface.

### 1.8. Interface ✅ COMPLETED
**File:** `src/core/interface/AdtInterface.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`: Updated to accept `withLongPolling` parameter
- ✅ `getInterfaceSource()`: Updated to accept `withLongPolling` parameter

**Note:** Interface has source code, similar to Class/Program.

### 1.9. FunctionGroup ✅ COMPLETED
**File:** `src/core/functionGroup/AdtFunctionGroup.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter

### 1.10. FunctionModule ✅ COMPLETED
**File:** `src/core/functionModule/AdtFunctionModule.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter

### 1.11. BehaviorDefinition ✅ COMPLETED
**File:** `src/core/behaviorDefinition/AdtBehaviorDefinition.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter
- ✅ `readSource()` in `read.ts`: Updated to accept `withLongPolling` parameter

### 1.12. BehaviorImplementation ✅ COMPLETED
**File:** `src/core/behaviorImplementation/AdtBehaviorImplementation.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter
- ✅ `getBehaviorImplementationSource()` in `read.ts`: Updated to accept `withLongPolling` parameter

### 1.13. MetadataExtension ✅ COMPLETED
**File:** `src/core/metadataExtension/AdtMetadataExtension.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter
- ✅ `readMetadataExtensionSource()` in `read.ts`: Updated to accept `withLongPolling` parameter

### 1.14. ServiceDefinition ✅ COMPLETED
**File:** `src/core/serviceDefinition/AdtServiceDefinition.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `create()`: Added read with long polling after update (before unlock)
- ✅ `create()`: Added read with long polling after activate (if `activateOnCreate: true`)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `update()`: Added read with long polling after activate (if `activateOnUpdate: true`)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter
- ✅ `getServiceDefinitionSource()` in `read.ts`: Updated to accept `withLongPolling` parameter

### 1.15. Package ✅ COMPLETED
**File:** `src/core/package/AdtPackage.ts`

**Changes made:**
- ✅ `create()`: Added read with long polling after create (before check)
- ✅ `update()`: Added read with long polling after update (before unlock)
- ✅ `read()`, `readMetadata()`, `readTransport()`: Updated to accept `withLongPolling` parameter

**Note:** Packages are containers - no activate operation, but long polling added for consistency.

---

## 2. Builder Implementations

### 2.1. DomainBuilder ✅ COMPLETED
**File:** `src/core/domain/DomainBuilder.ts`
- ✅ `read()` method updated to accept `withLongPolling` parameter

### 2.2. ClassBuilder ✅ COMPLETED
**File:** `src/core/class/ClassBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getClassSource()` call

### 2.3. ProgramBuilder ✅ COMPLETED
**File:** `src/core/program/ProgramBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getProgramSource()` call

### 2.4. InterfaceBuilder ✅ COMPLETED
**File:** `src/core/interface/InterfaceBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getInterfaceSource()` call

### 2.5. DataElementBuilder ✅ COMPLETED
**File:** `src/core/dataElement/DataElementBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getDataElement()` call

### 2.6. StructureBuilder ✅ COMPLETED
**File:** `src/core/structure/StructureBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getStructureSource()` call

### 2.7. TableBuilder ✅ COMPLETED
**File:** `src/core/table/TableBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getTableSource()` call

### 2.8. ViewBuilder ✅ COMPLETED
**File:** `src/core/view/ViewBuilder.ts`
- ✅ `read()`: Updated signature to accept `withLongPolling` parameter
- ✅ Pass `withLongPolling` to `getViewSource()` call

### 2.9. Other Builders ✅ COMPLETED
**Files:**
- ✅ `src/core/functionGroup/FunctionGroupBuilder.ts` - `read()` updated
- ✅ `src/core/functionModule/FunctionModuleBuilder.ts` - `read()` updated
- ✅ `src/core/behaviorDefinition/BehaviorDefinitionBuilder.ts` - `read()` updated
- ✅ `src/core/metadataExtension/MetadataExtensionBuilder.ts` - `read()` updated
- ✅ `src/core/serviceDefinition/ServiceDefinitionBuilder.ts` - `read()` updated
- ✅ `src/core/package/PackageBuilder.ts` - `read()` updated

**All Builder `read()` methods now support `withLongPolling` parameter.**

---

## 3. Low-Level Read Functions

### 3.1. Domain ✅ COMPLETED
**File:** `src/core/domain/read.ts`
- ✅ `getDomain()` - updated
- ✅ `getDomainTransport()` - updated

### 3.2. Class ✅ COMPLETED
**File:** `src/core/class/read.ts`
- ✅ `getClassSource()` - updated
- ✅ `getClassMetadata()` - updated
- ✅ `getClassTransport()` - updated

### 3.3. Shared Functions ✅ COMPLETED
**Files:**
- ✅ `src/core/shared/readMetadata.ts` - `readObjectMetadata()` updated
- ✅ `src/core/shared/readSource.ts` - `readObjectSource()` updated

### 3.4. Other Read Functions ✅ COMPLETED
**All read functions updated:**
- ✅ `src/core/dataElement/read.ts` - `getDataElement()`, `getDataElementTransport()`
- ✅ `src/core/program/read.ts` - `getProgramSource()`, `getProgramMetadata()`, `getProgramTransport()`
- ✅ `src/core/interface/read.ts` - `getInterfaceSource()`, `getInterfaceMetadata()`, `getInterfaceTransport()`
- ✅ `src/core/structure/read.ts` - `getStructureSource()`, `getStructureMetadata()`, `getStructureTransport()`
- ✅ `src/core/table/read.ts` - `getTableSource()`, `getTableMetadata()`, `getTableTransport()`
- ✅ `src/core/view/read.ts` - `getViewSource()`, `getViewMetadata()`, `getViewTransport()`
- ✅ `src/core/functionGroup/read.ts` - `getFunctionGroup()`, `getFunctionGroupTransport()`
- ✅ `src/core/functionModule/read.ts` - `getFunctionSource()`, `getFunctionMetadata()`, `getFunctionModuleTransport()`
- ✅ `src/core/behaviorDefinition/read.ts` - `read()`, `getBehaviorDefinitionTransport()`
- ✅ `src/core/behaviorImplementation/read.ts` - `getBehaviorImplementationMetadata()`, `getBehaviorImplementationTransport()`
- ✅ `src/core/metadataExtension/read.ts` - `readMetadataExtension()`, `getMetadataExtensionTransport()`
- ✅ `src/core/serviceDefinition/read.ts` - `getServiceDefinition()`, `getServiceDefinitionTransport()`
- ✅ `src/core/package/read.ts` - `getPackage()`, `getPackageTransport()`

**All low-level read functions now support `withLongPolling` parameter.**

**Pattern to follow:**
```typescript
export async function getXxx(
  connection: IAbapConnection,
  name: string,
  options?: { withLongPolling?: boolean }
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(name);
  let url = `/sap/bc/adt/.../${encodedName}`;
  if (options?.withLongPolling) {
    url += '?withLongPolling=true';
  }
  // ... rest of function
}
```

---

## 4. Test Updates

### 4.1. BaseTester ✅ COMPLETED
**File:** `src/__tests__/helpers/BaseTester.ts`

**Changes made:**
- ✅ `IReadTestOptions` - added `withLongPolling?: boolean`
- ✅ `readTest()` - passes `withLongPolling` to `adtObject.read()`
- ✅ `flowTest()` - added read with long polling between create and update

### 4.2. Integration Tests ⏳ TODO
**Files:**
- `src/__tests__/integration/domain/Domain.test.ts`
- `src/__tests__/integration/class/Class.test.ts`
- `src/__tests__/integration/dataElement/DataElement.test.ts`
- `src/__tests__/integration/structure/Structure.test.ts`
- `src/__tests__/integration/table/Table.test.ts`
- `src/__tests__/integration/view/View.test.ts`
- `src/__tests__/integration/program/Program.test.ts`
- `src/__tests__/integration/interface/Interface.test.ts`
- Other integration test files

**Changes needed:**
- [ ] Remove `setTimeout()` calls that wait for object readiness
- [ ] Remove `timeout` options from test calls (if not needed for operation timeout)
- [ ] Add `withLongPolling: true` to read operations after create/update/activate
- [ ] Update test expectations if timing changes

**Example of what to remove:**
```typescript
// REMOVE THIS:
await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for object to be ready

// REPLACE WITH:
await adtObject.read(config, 'active', { withLongPolling: true });
```

### 4.3. Test Helper Functions ⏳ TODO
**File:** `src/__tests__/helpers/test-helper.ts`

**Changes needed:**
- [ ] Review helper functions for timeout usage
- [ ] Replace timeout-based waits with long polling where applicable

---

## 5. Documentation Updates

### 5.1. README ⏳ TODO
**File:** `README.md`

**Changes needed:**
- [ ] Document `withLongPolling` parameter usage
- [ ] Add examples of using long polling in create/update flows
- [ ] Update migration notes if needed

### 5.2. CHANGELOG ⏳ TODO
**File:** `CHANGELOG.md`

**Changes needed:**
- [ ] Add entry for migration from timeouts to long polling
- [ ] Document breaking changes (if any)
- [ ] Document new `withLongPolling` parameter

---

## 6. Code Cleanup

### 6.1. Remove Unused Timeout Variables ✅ IN PROGRESS
**Search pattern:** `const timeout = options?.timeout || 1000;`

**Files checked:**
- [x] `AdtDomain.ts` - removed unused timeout variable

**Files to check:**
- [ ] Other `AdtObject` implementations (if any)
- [ ] All `Builder` implementations
- [ ] Test files

**Action:** Remove timeout variable if it's only used for delays (not for operation timeouts).

### 6.2. Remove setTimeout Calls ✅ IN PROGRESS
**Search pattern:** `setTimeout`, `new Promise(resolve => setTimeout`

**Files updated:**
- [x] `Program.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `Class.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `Interface.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `Table.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `View.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `Structure.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `FunctionGroup.test.ts` - replaced setTimeout with read + long polling after create/activate
- [x] `FunctionModule.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `MetadataExtension.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `ServiceDefinition.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `Package.test.ts` - replaced setTimeout with read + long polling after create/update
- [x] `BehaviorDefinition.test.ts` - replaced setTimeout with read + long polling after create/update/activate
- [x] `BehaviorImplementation.test.ts` - replaced setTimeout with read + long polling after create/update/activate

**Files to check:**
- [ ] Other test files (Class, Interface, Table, View, Structure, FunctionGroup, FunctionModule, etc.)
- [ ] All implementation files (check.ts, groupActivation.ts - these may be for different purposes)

**Action:** Replace with long polling read operations.

### 6.3. Update IAdtOperationOptions Documentation ⏳ TODO
**File:** `src/adt/IAdtObject.ts` (in interfaces package)

**Changes needed:**
- [ ] Update `timeout` field documentation to clarify it's for operation timeout, not readiness waiting
- [ ] Add note about using `withLongPolling` for waiting object readiness

---

## 7. Verification

### 7.1. Test Script ✅ COMPLETED
**File:** `scripts/test-long-polling-read.ts`
- ✅ Created and tested
- ✅ Verifies long polling works correctly

### 7.2. Integration Test Verification ⏳ TODO
**Actions:**
- [ ] Run all integration tests to verify no regressions
- [ ] Verify tests are faster (no arbitrary timeouts)
- [ ] Verify tests are more reliable (long polling waits for actual readiness)

### 7.3. Performance Testing ⏳ TODO
**Actions:**
- [ ] Compare test execution times before/after migration
- [ ] Verify long polling doesn't add significant overhead
- [ ] Document performance improvements

---

## 8. Migration Order (Recommended)

1. ✅ **Phase 1: Interfaces and Low-Level Functions** (COMPLETED)
   - Update `IAdtObject` and `IBuilder` interfaces
   - Update low-level read functions
   - Update shared read functions

2. ✅ **Phase 2: Domain Implementation** (COMPLETED)
   - Migrate `AdtDomain` as reference implementation
   - Test and verify

3. ✅ **Phase 3: Other AdtObject Implementations** (COMPLETED)
   - ✅ All `read()`, `readMetadata()`, `readTransport()` methods support `withLongPolling`
   - ✅ All AdtObject implementations fully migrated (create/update use long polling):
     - Domain, Class, DataElement, Program, Interface, Table, View, Structure, FunctionGroup
     - FunctionModule, BehaviorDefinition, BehaviorImplementation, MetadataExtension, ServiceDefinition, Package

4. ✅ **Phase 4: Builder Implementations** (COMPLETED)
   - ✅ All builder `read()` methods updated to accept `withLongPolling` parameter
   - ✅ All builders pass `withLongPolling` to respective read functions

5. ⏳ **Phase 5: Test Updates**
   - Remove timeout-based waits
   - Add long polling where needed
   - Verify all tests pass

6. ⏳ **Phase 6: Documentation and Cleanup**
   - Update documentation
   - Remove unused timeout code
   - Final verification

---

## 9. Notes

### When to Use Long Polling
- ✅ After `create()` - wait for object to be available for read/update
- ✅ After `update()` - wait for object to be ready for unlock/activate
- ✅ After `activate()` - wait for object to be available in active version
- ✅ In tests - replace `setTimeout()` waits

### When NOT to Use Long Polling
- ❌ For operation timeouts (use `timeout` option in `IAdtOperationOptions`)
- ❌ For network request timeouts (handled by connection layer)
- ❌ When object is already known to be ready

### Error Handling
- Long polling read failures should be logged as warnings
- Operations should continue even if long polling read fails
- Long polling is an optimization, not a requirement

---

## 10. Checklist Summary

- [x] Interfaces updated (`IAdtObject`, `IBuilder` - all GET methods)
- [x] Low-level functions updated (all read/metadata/transport functions)
- [x] Domain implementation migrated (create/update + read methods)
- [x] Class implementation migrated (create/update + read methods)
- [x] DataElement implementation migrated (create/update + read methods)
- [x] Program implementation migrated (create/update + read methods)
- [x] Interface implementation migrated (create/update + read methods)
- [x] Table implementation migrated (create/update + read methods)
- [x] View implementation migrated (create/update + read methods)
- [x] Structure implementation migrated (create/update + read methods)
- [x] FunctionGroup implementation migrated (create/update + read methods)
- [x] All AdtObject `read()`, `readMetadata()`, `readTransport()` methods support `withLongPolling`
- [x] All Builder `read()` methods support `withLongPolling`
- [x] All AdtObject implementations fully migrated (create/update use long polling)
- [x] Integration tests updated (all main integration tests completed)
- [ ] Documentation updated
- [x] Code cleanup started (removed unused timeout in AdtDomain)
- [ ] All tests passing
- [ ] Performance verified

---

**Last Updated:** 2025-01-XX
**Status:** Phase 3 Complete (All AdtObject Implementations), Phase 4 Complete (Builders), Phase 5 In Progress (Test Updates)

