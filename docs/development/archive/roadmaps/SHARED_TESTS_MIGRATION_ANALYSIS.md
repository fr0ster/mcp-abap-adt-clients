# Shared Tests Migration Analysis

**Last Updated:** 2025-12-12  
**Status:** ✅ **COMPLETED** - All 7 shared tests migrated to `AdtClient`/`AdtUtils`

**Archive Note:** This roadmap has been completed and archived in `docs/development/archive/roadmaps/`. All 7 shared integration tests have been successfully migrated to `AdtClient`/`AdtUtils` API. The migration is 100% complete with all utility functions accessible through `AdtClient.getUtils()` method. Shared tests are NOT candidates for BaseTester migration as they test utility functions and cross-object operations, not single-object CRUD flows.

## Overview

Shared tests verify utility functions (`AdtUtils`) and cross-object operations. They test functionality that is NOT CRUD operations on single objects.

**Architecture:**
- `AdtClient` provides `getUtils()` method for utility functions
- `AdtUtils` wraps low-level utility functions from `src/core/shared/*.ts`
- Utility functions: `searchObjects()`, `getWhereUsed()`, `getInactiveObjects()`, `activateObjectsGroup()`, `readObjectSource()`, `readObjectMetadata()`, `getSqlQuery()`, `getTableContents()`

## BaseTester Migration

**Note:** Shared tests **cannot** use `BaseTester` because:
- `BaseTester` is designed for testing single `IAdtObject` implementations (CRUD operations)
- Shared tests test utility functions and cross-object operations
- `BaseTester.flowTest()` expects a single `IAdtObject` instance

**Exception:** `groupActivation.test.ts` could potentially use `BaseTester` for individual object creation, but the test's main purpose is group activation, not individual CRUD flows.

## Test Migration Progress

| # | Test File | Status | API Used | Notes |
|---|-----------|--------|----------|-------|
| 1 | `groupActivation.test.ts` | ✅ **MIGRATED** | `AdtClient` + `AdtUtils` | Tests multiple objects + group operations |
| 2 | `readSource.test.ts` | ✅ **MIGRATED** | `AdtUtils` | Tests utility function |
| 3 | `readMetadata.test.ts` | ✅ **MIGRATED** | `AdtUtils` | Tests utility function |
| 4 | `tableContents.test.ts` | ✅ **MIGRATED** | `AdtUtils` | Tests utility function |
| 5 | `search.test.ts` | ✅ **MIGRATED** | `AdtUtils` | Tests utility function |
| 6 | `sqlQuery.test.ts` | ✅ **MIGRATED** | `AdtUtils` | Tests utility function |
| 7 | `whereUsed.test.ts` | ✅ **MIGRATED** | `AdtUtils` | Tests utility function |

**Overall Status:** ✅ **7/7 tests migrated (100%)**

## Migration Details

### 1. groupActivation.test.ts
- ✅ Object operations: `client.getDomain().create()`, `client.getDataElement().create()`, `client.getStructure().create()`
- ✅ Group activation: `client.getUtils().activateObjectsGroup()`
- ✅ Cleanup: `client.getDomain().delete()`, `client.getDataElement().delete()`, `client.getStructure().delete()`
- ✅ Cleanup parameters: `cleanup_after_test`, `skip_cleanup`

### 2. readSource.test.ts
- ✅ Uses: `client.getUtils().readObjectSource(objectType, objectName)`
- ✅ Uses: `client.getUtils().supportsSourceCode(objectType)`

### 3. readMetadata.test.ts
- ✅ Uses: `client.getUtils().readObjectMetadata(objectType, objectName)`

### 4. tableContents.test.ts
- ✅ Uses: `client.getUtils().getTableContents(params)`
- ⚠️ **ABAP Cloud Limitation:** Works only for on-premise systems

### 5. search.test.ts
- ✅ Uses: `client.getUtils().searchObjects(params)`

### 6. sqlQuery.test.ts
- ✅ Uses: `client.getUtils().getSqlQuery(params)`
- ⚠️ **ABAP Cloud Limitation:** Works only for on-premise systems

### 7. whereUsed.test.ts
- ✅ Uses: `client.getUtils().getWhereUsed(params)`

## Completed Phases

### Phase 1: AdtUtils Infrastructure ✅ COMPLETED
- ✅ `AdtUtils` class created in `src/core/shared/AdtUtils.ts`
- ✅ `getUtils()` method added to `AdtClient`

### Phase 2: High Priority Migration ✅ COMPLETED
- ✅ `readSource.test.ts` → `AdtUtils.readObjectSource()`
- ✅ `readMetadata.test.ts` → `AdtUtils.readObjectMetadata()`
- ✅ `groupActivation.test.ts` → `AdtObject` for CRUD, `AdtUtils` for group activation

### Phase 3: Medium Priority Migration ✅ COMPLETED
- ✅ `tableContents.test.ts` → `AdtUtils.getTableContents()`
- ✅ `search.test.ts` → `AdtUtils.searchObjects()`
- ✅ `sqlQuery.test.ts` → `AdtUtils.getSqlQuery()`
- ✅ `whereUsed.test.ts` → `AdtUtils.getWhereUsed()`

## Notes

- **Utility Functions vs CRUD Operations:** 
  - `AdtObject` (via `AdtClient`) is for object CRUD operations
  - `AdtUtils` (via `AdtClient.getUtils()`) is for utility functions
  - This separation keeps the API clean and follows single responsibility principle

- **BaseTester:** Shared tests are NOT candidates for BaseTester migration. See `BASE_TESTER_MIGRATION.md` (in same archive directory) for object-specific test migration plan (completed, 15/15 tests migrated).
