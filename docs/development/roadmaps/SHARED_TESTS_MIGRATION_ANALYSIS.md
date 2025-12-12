# Shared Tests Migration Analysis

Analysis of shared integration tests and their migration potential to `AdtClient` API with `AdtUtils`.

## Overview

There are 7 shared test files that test utility functions and cross-object operations. This document analyzes each test to determine:
1. Current API usage
2. Migration feasibility to `AdtClient` + `AdtUtils`
3. Recommended approach

## Architecture: AdtUtils

**Key Point:** Shared functions are NOT CRUD operations, so they don't implement `IAdtObject` interface. Instead, they should be accessed through `AdtUtils` class, which `AdtClient` provides via `getUtils()` method.

**Proposed Structure:**
```typescript
// AdtClient provides access to utilities
const client = new AdtClient(connection, logger);
const utils = client.getUtils();

// Utility functions (not CRUD)
await utils.searchObjects(...);
await utils.getWhereUsed(...);
await utils.getInactiveObjects(...);
await utils.activateObjectsGroup(...);
await utils.readObjectSource(...);
await utils.readObjectMetadata(...);
// etc.

// CRUD operations (via AdtObject)
await client.getClass().create(...);
await client.getDomain().read(...);
// etc.
```

## Test Files Analysis

### 1. `groupActivation.test.ts` ⚠️ **PARTIAL MIGRATION**

**Current API:**
- `CrudClient` for object creation/deletion (domain, data element, structure)
- `SharedBuilder.groupActivate()` for group activation

**What it tests:**
- Creating multiple related objects (domain → data element → structure)
- Activating them as a group using `SharedBuilder.groupActivate()`
- Cleanup of all objects

**Migration Strategy:**
- ✅ **Migrate object operations** to `AdtObject` (via `AdtClient`):
  - `client.getDomain().create()` instead of `client.createDomain()`
  - `client.getDataElement().create()` instead of `client.createDataElement()`
  - `client.getStructure().create()` instead of `client.createStructure()`
  - `client.getDomain().delete()` instead of `client.deleteDomain()`
  - `client.getDataElement().delete()` instead of `client.deleteDataElement()`
  - `client.getStructure().delete()` instead of `client.deleteStructure()`
- ✅ **Migrate group activation** to `AdtUtils`:
  - `client.getUtils().activateObjectsGroup()` instead of `sharedBuilder.activateGroup()`
  - `client.getUtils().getInactiveObjects()` instead of `sharedBuilder.listInactiveObjects()`
- ✅ **Add cleanup parameter support** (`cleanup_after_test`, `skip_cleanup`)

**Priority:** Medium - Object operations can be migrated, but group activation is specialized

---

### 2. `readSource.test.ts` ✅ **FULL MIGRATION**

**Current API:**
- Low-level `readObjectSource()` function directly

**What it tests:**
- Reading source code for different object types (class, program, interface, etc.)

**Migration Strategy:**
- ✅ **Migrate to `AdtObject.read()`** (via `AdtClient`):
  - `client.getClass().read()` instead of `readObjectSource(connection, 'class', className)`
  - `client.getProgram().read()` instead of `readObjectSource(connection, 'program', programName)`
  - `client.getInterface().read()` instead of `readObjectSource(connection, 'interface', interfaceName)`
  - etc.
  
  **Note:** `AdtObject.read()` is the CRUD method for reading object source code. For generic `readObjectSource()` utility, use `client.getUtils().readObjectSource()`.

**Priority:** High - Direct replacement with `AdtClient.read()`

---

### 3. `readMetadata.test.ts` ⚠️ **REVIEW NEEDED**

**Current API:**
- Low-level `readObjectMetadata()` function directly

**What it tests:**
- Reading metadata for different object types

**Migration Strategy:**
- ⚠️ **Review if `AdtClient.read()` supports metadata**:
  - If `AdtClient.read()` returns metadata → migrate to `AdtClient.read()`
  - If metadata is separate → keep on low-level API or add `readMetadata()` to `AdtClient` if needed
- Need to check what `readObjectMetadata()` returns vs what `AdtClient.read()` returns

**Priority:** Medium - Depends on `AdtClient.read()` capabilities

---

### 4. `tableContents.test.ts` ❌ **KEEP ON LOW-LEVEL**

**Current API:**
- Low-level `getTableContents()` function directly

**What it tests:**
- Reading table contents (data rows)
- ⚠️ **ABAP Cloud Limitation:** Works only for on-premise systems

**Migration Strategy:**
- ✅ **Migrate to `AdtUtils.getTableContents()`**:
  - `client.getUtils().getTableContents()` instead of `getTableContents(connection, ...)`
- This is a utility function, not CRUD, so it belongs in `AdtUtils`

**Priority:** Low - Specialized utility, not part of object CRUD operations

---

### 5. `search.test.ts` ❌ **KEEP ON LOW-LEVEL**

**Current API:**
- Low-level `searchObjects()` function directly

**What it tests:**
- Searching for objects by name/type

**Migration Strategy:**
- ❌ **Keep on low-level API** - Search is a utility function, not part of object CRUD
- `AdtClient` focuses on operations on specific objects (by name), not searching
- Search functionality is separate from CRUD operations

**Priority:** Low - Utility function, not part of object CRUD operations

---

### 6. `sqlQuery.test.ts` ❌ **KEEP ON LOW-LEVEL**

**Current API:**
- Low-level `getSqlQuery()` function directly

**What it tests:**
- Executing SQL queries
- ⚠️ **ABAP Cloud Limitation:** Works only for on-premise systems

**Migration Strategy:**
- ✅ **Migrate to `AdtUtils.getSqlQuery()`**:
  - `client.getUtils().getSqlQuery()` instead of `getSqlQuery(connection, ...)`
- This is a utility function, not CRUD, so it belongs in `AdtUtils`

**Priority:** Low - Specialized utility, not part of object CRUD operations

---

### 7. `whereUsed.test.ts` ❌ **KEEP ON LOW-LEVEL**

**Current API:**
- Low-level `getWhereUsed()` function directly

**What it tests:**
- Finding where an object is used (dependencies)

**Migration Strategy:**
- ✅ **Migrate to `AdtUtils.getWhereUsed()`**:
  - `client.getUtils().getWhereUsed()` instead of `getWhereUsed(connection, ...)`
- This is a utility function, not CRUD, so it belongs in `AdtUtils`

**Priority:** Low - Utility function, not part of object CRUD operations

---

## Summary

| Test File | Migration Feasibility | Recommended Action | Priority |
|-----------|----------------------|-------------------|----------|
| `groupActivation.test.ts` | ✅ Full | Migrate object operations to `AdtObject`, group activation to `AdtUtils` | High |
| `readSource.test.ts` | ✅ Full | Migrate to `AdtObject.read()` or `AdtUtils.readObjectSource()` | High |
| `readMetadata.test.ts` | ✅ Full | Migrate to `AdtUtils.readObjectMetadata()` | High |
| `tableContents.test.ts` | ✅ Full | Migrate to `AdtUtils.getTableContents()` | Medium |
| `search.test.ts` | ✅ Full | Migrate to `AdtUtils.searchObjects()` | Medium |
| `sqlQuery.test.ts` | ✅ Full | Migrate to `AdtUtils.getSqlQuery()` | Medium |
| `whereUsed.test.ts` | ✅ Full | Migrate to `AdtUtils.getWhereUsed()` | Medium |

## Migration Plan

### Phase 1: Create AdtUtils Infrastructure
1. ⚠️ **Create `AdtUtils` class** in `src/core/shared/AdtUtils.ts`
   - Wrap all utility functions from `src/core/shared/*.ts`
   - Methods: `searchObjects()`, `getWhereUsed()`, `getInactiveObjects()`, `activateObjectsGroup()`, `readObjectSource()`, `readObjectMetadata()`, `getSqlQuery()`, `getTableContents()`, etc.
2. ⚠️ **Add `getUtils()` method to `AdtClient`**
   - Returns `AdtUtils` instance with connection and logger

### Phase 2: High Priority (Full Migration)
3. ✅ **`readSource.test.ts`** - Migrate to `AdtObject.read()` or `AdtUtils.readObjectSource()`
4. ✅ **`readMetadata.test.ts`** - Migrate to `AdtUtils.readObjectMetadata()`
5. ✅ **`groupActivation.test.ts`** - Migrate object operations to `AdtObject`, group activation to `AdtUtils`

### Phase 3: Medium Priority (Full Migration)
6. ✅ **`tableContents.test.ts`** - Migrate to `AdtUtils.getTableContents()`
7. ✅ **`search.test.ts`** - Migrate to `AdtUtils.searchObjects()`
8. ✅ **`sqlQuery.test.ts`** - Migrate to `AdtUtils.getSqlQuery()`
9. ✅ **`whereUsed.test.ts`** - Migrate to `AdtUtils.getWhereUsed()`

## Notes

- **Utility Functions vs CRUD Operations:** 
  - `AdtObject` (via `AdtClient`) is for object CRUD operations (create, read, update, delete, validate, activate, check)
  - `AdtUtils` (via `AdtClient.getUtils()`) is for utility functions (search, where-used, group operations, metadata, etc.)
  - This separation keeps the API clean and follows single responsibility principle

- **AdtUtils Design:**
  - `AdtUtils` wraps low-level utility functions from `src/core/shared/*.ts`
  - Provides consistent API with connection and logger context
  - Methods return `AxiosResponse` or typed results (similar to low-level functions)
  - No state management (stateless utility class)

- **Cleanup Parameters:** All tests that create objects should support `cleanup_after_test` and `skip_cleanup` parameters (similar to object-specific tests).

## Next Steps

1. **Create `AdtUtils` class** (`src/core/shared/AdtUtils.ts`):
   - Wrap all utility functions from `src/core/shared/*.ts`
   - Accept `connection` and `logger` in constructor
   - Provide methods: `searchObjects()`, `getWhereUsed()`, `getInactiveObjects()`, `activateObjectsGroup()`, `readObjectSource()`, `readObjectMetadata()`, `getSqlQuery()`, `getTableContents()`, etc.

2. **Add `getUtils()` to `AdtClient`**:
   - Return `AdtUtils` instance with connection and logger

3. **Migrate tests** (in order of priority):
   - `readSource.test.ts` → Use `AdtObject.read()` or `AdtUtils.readObjectSource()`
   - `readMetadata.test.ts` → Use `AdtUtils.readObjectMetadata()`
   - `groupActivation.test.ts` → Use `AdtObject` for CRUD, `AdtUtils` for group activation
   - `tableContents.test.ts` → Use `AdtUtils.getTableContents()`
   - `search.test.ts` → Use `AdtUtils.searchObjects()`
   - `sqlQuery.test.ts` → Use `AdtUtils.getSqlQuery()`
   - `whereUsed.test.ts` → Use `AdtUtils.getWhereUsed()`

4. **Add cleanup parameter support** to `groupActivation.test.ts`
