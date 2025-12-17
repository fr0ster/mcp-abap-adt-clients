# Infrastructure Module Roadmap

Roadmap for implementing the infrastructure module in `@mcp-abap-adt/adt-clients` and updating handlers in `mcp-abap-adt`.

## Legend

- ✅ **Exists** - Method is already implemented in adt-clients
- ❌ **Missing** - Method is absent, implementation needed
- ⚠️ **Partial** - Method is partially implemented or needs extension

## Method Location

Methods can be located in:
- **ReadOnlyClient** - read-only operations only
- **CrudClient** - CRUD operations (extends ReadOnlyClient)
- **AdtClient** - high-level operations through `IAdtObject` interface or utility methods via `getUtils()`
- **Shared/Infrastructure** - utilities and infrastructure operations through `AdtUtils`

**Note:** Currently `WhereUsed`, `SqlQuery`, `InactiveObjects` are located in `core/shared/`, but it is planned to either rename `shared` to `infrastructure`, or create a new `infrastructure` module and move these methods there.

**Important:** New infrastructure functionality will be added to `AdtClient` (via `getUtils()` or new methods) as it's easier to group methods there.

**Note:** ✅ `AdtClient` now has `getEnhancement()` method to access `AdtEnhancement` class (added for consistency with other object types).

---

## 1. System/Repository Operations

### 1.1 GetWhereUsed
**Handler:** `system/readonly/handleGetWhereUsed.ts`  
**Endpoint:** `/sap/bc/adt/repository/informationsystem/usageReferences` (POST)  
**Status:** ✅ **Exists**  
**Location:** 
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getWhereUsed()`
  - `core/shared/whereUsed.ts` → `getWhereUsed()`
  - `core/shared/AdtUtils.ts` → `getWhereUsed()`

**Action:** 
- Update handler to use `AdtClient.getUtils().getWhereUsed()`
- **Planned:** Move from `core/shared/` to `core/infrastructure/` or rename `shared` to `infrastructure`

---

### 1.2 GetObjectStructure
**Handler:** `system/readonly/handleGetObjectStructure.ts`  
**Endpoint:** `/sap/bc/adt/repository/objectstructure` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getObjectStructure()`
  - `core/shared/objectStructure.ts` → `getObjectStructure()`
  - `core/shared/AdtUtils.ts` → `getObjectStructure()`

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getObjectStructure()`

---

### 1.3 GetObjectInfo
**Handler:** `system/readonly/handleGetObjectInfo.ts`  
**Endpoint:** `/sap/bc/adt/repository/nodestructure` (POST)  
**Status:** ⚠️ **Partial**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().fetchNodeStructure()` (base function)
  - `core/shared/nodeStructure.ts` → `fetchNodeStructure()` (base function for node structure)
  - **Note:** Full GetObjectInfo requires complex tree building logic with enrichment via SearchObject
  - Handler can use `fetchNodeStructure()` and implement tree building/enrichment logic

**Action:**
- ✅ Base function `fetchNodeStructure()` implemented
- Handler can use `AdtClient.getUtils().fetchNodeStructure()` for node structure queries
- Full GetObjectInfo tree building logic remains in handler (uses SearchObject for enrichment)

---

### 1.4 GetObjectNodeFromCache
**Handler:** `system/readonly/handleGetObjectNodeFromCache.ts`  
**Endpoint:** Dynamic (from OBJECT_URI)  
**Status:** 🚫 **Not Planned**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing
- ❌ Shared/Infrastructure - missing

**Reason:**
- This handler works with in-memory cache (`objectsListCache`) which is MCP server-specific
- Cache management is part of MCP server infrastructure, not adt-clients library
- adt-clients is a stateless client library and doesn't maintain server-side caches
- Handler should continue using direct `makeAdtRequest` calls in MCP server

**Action:**
- ❌ Will NOT be implemented in adt-clients
- Handler should continue using direct endpoint calls in MCP server

---

### 1.5 GetTypeInfo
**Handler:** `system/readonly/handleGetTypeInfo.ts`  
**Endpoints:** 
- `/sap/bc/adt/ddic/domains/{name}/source/main`
- `/sap/bc/adt/ddic/dataelements/{name}`
- `/sap/bc/adt/ddic/tabletypes/{name}`
- `/sap/bc/adt/repository/informationsystem/objectproperties/values` (fallback)

**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getTypeInfo()`
  - `core/shared/typeInfo.ts` → `getTypeInfo()`
  - `core/shared/AdtUtils.ts` → `getTypeInfo()`
  - Implements fallback chain: domain → data element → table type → object properties

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getTypeInfo()`

---

### 1.6 GetAllTypes
**Handler:** `system/readonly/handleGetAllTypes.ts`  
**Endpoint:** `/sap/bc/adt/repository/informationsystem/objecttypes` (GET)  
**Status:** ❌ **Missing**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing
- ❌ Shared/Infrastructure - missing

**Action:**
- Create `core/infrastructure/system/allTypes.ts` → `getAllTypes()`
- Add to `AdtUtils` → `getAllTypes()`
- Update handler to use `AdtClient.getUtils().getAllTypes()`

---

### 1.7 GetSqlQuery
**Handler:** `system/readonly/handleGetSqlQuery.ts`  
**Endpoint:** `/sap/bc/adt/datapreview/freestyle` (POST)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getSqlQuery()`
  - `core/shared/sqlQuery.ts` → `getSqlQuery()`
  - `core/shared/AdtUtils.ts` → `getSqlQuery()`

**Action:** 
- Update handler to use `AdtClient.getUtils().getSqlQuery()`
- **Planned:** Move from `core/shared/` to `core/infrastructure/` or rename `shared` to `infrastructure`

---

### 1.8 GetTransaction
**Handler:** `system/readonly/handleGetTransaction.ts`  
**Endpoint:** `/sap/bc/adt/repository/informationsystem/objectproperties/values{?uri}` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getTransaction(transactionName)`
  - `core/shared/transaction.ts` → `getTransaction()`
  - `core/shared/AdtUtils.ts` → `getTransaction()`

**Action:** 
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getTransaction(transactionName)`
- **Note:** Uses object properties endpoint with transaction URI: `/sap/bc/adt/transactions/{name}`

---

### 1.9 GetInactiveObjects
**Handler:** `system/readonly/handleGetInactiveObjects.ts`  
**Endpoint:** N/A (uses AdtClient)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ✅ **CrudClient** - `CrudClient.getInactiveObjects(options?)`
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getInactiveObjects(options?)`
  - `core/shared/getInactiveObjects.ts` → `getInactiveObjects()`
  - `core/shared/AdtUtils.ts` → `getInactiveObjects()`

**Action:** 
- Handler already uses `CrudClient.getInactiveObjects()` ✅
- **Planned:** Move from `core/shared/` to `core/infrastructure/` or rename `shared` to `infrastructure`

---

## 2. Enhancement Operations

### 2.1 GetEnhancementImpl
**Handler:** `enhancement/readonly/handleGetEnhancementImpl.ts`  
**Endpoint:** `/sap/bc/adt/enhancements/{spot}/{name}/source/main` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getEnhancementImpl()`
  - `core/shared/enhancementImpl.ts` → `getEnhancementImpl()`
  - `core/shared/AdtUtils.ts` → `getEnhancementImpl()`
  - **Note:** Uses spot name in URL instead of enhancement type (different from standard enhancement operations)

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getEnhancementImpl(spot, name)`

---

### 2.2 GetEnhancementSpot
**Handler:** `enhancement/readonly/handleGetEnhancementSpot.ts`  
**Endpoint:** `/sap/bc/adt/enhancements/enhsxsb/{spot_name}` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ✅ **AdtClient** - has `getEnhancement()` method (access to `AdtEnhancement`)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getEnhancementSpot()`
  - `core/shared/AdtUtils.ts` → `getEnhancementSpot()` (convenience wrapper)
  - Uses `core/enhancement/read.ts` → `getEnhancementMetadata()` with type 'enhsxsb'
  - **Note:** Convenience wrapper for consistency, uses existing `getEnhancementMetadata()` internally

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getEnhancementSpot(spotName)`

---

### 2.3 GetEnhancements
**Handler:** `enhancement/readonly/handleGetEnhancements.ts`  
**Endpoints:**
- `/sap/bc/adt/oo/classes/{name}/source/main/enhancements/elements`
- `/sap/bc/adt/programs/programs/{name}/source/main/enhancements/elements`
- `/sap/bc/adt/programs/includes/{name}/source/main/enhancements/elements`

**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getEnhancements()`
  - `core/shared/enhancements.ts` → `getEnhancements()`
  - `core/shared/AdtUtils.ts` → `getEnhancements()`
  - Supports programs, includes (with context), and classes

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getEnhancements()`

---

## 3. Include Operations

### 3.1 GetInclude
**Handler:** `include/readonly/handleGetInclude.ts`  
**Endpoint:** `/sap/bc/adt/programs/includes/{name}/source/main` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getInclude()`
  - `core/shared/include.ts` → `getInclude()`
  - `core/shared/AdtUtils.ts` → `getInclude()`

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getInclude()`

---

### 3.2 GetIncludesList
**Handler:** `include/readonly/handleGetIncludesList.ts`  
**Endpoint:** `/sap/bc/adt/repository/nodestructure` (POST, via `fetchNodeStructure`)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ❌ AdtClient - missing (no direct method)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getIncludesList()`
  - `core/shared/includesList.ts` → `getIncludesList()`
  - `core/shared/AdtUtils.ts` → `getIncludesList()`
  - Uses `fetchNodeStructure()` to discover includes recursively

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getIncludesList()`

---

## 4. Behavior Definition Operations

### 4.1 GetBdef
**Handler:** `behavior_definition/readonly/handleGetBdef.ts`  
**Endpoint:** `/sap/bc/adt/bo/behaviordefinitions/{name}/source/main` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing
- ✅ **AdtClient** - `getBehaviorDefinition().read()` (uses `readSource()`)
- ✅ **Shared/Infrastructure** - `AdtClient.getUtils().getBdef(name, version?)`
  - `core/behaviorDefinition/read.ts` → `readSource()` (already exists)
  - `core/shared/AdtUtils.ts` → `getBdef()` (convenience wrapper)
  - Uses same endpoint: `/sap/bc/adt/bo/behaviordefinitions/{name}/source/main?version={version}`

**Action:** 
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getBdef(bdefName)` or `AdtClient.getBehaviorDefinition().read({ name }, 'active')`

---

## 5. Package Operations

### 5.1 GetPackage
**Handler:** `package/readonly/handleGetPackage.ts`  
**Endpoint:** `/sap/bc/adt/repository/nodestructure` (POST)  
**Status:** ✅ **Complete**  
**Location:**
- ✅ **ReadOnlyClient** - `readPackage()` (reads package metadata)
- ✅ **AdtClient** - `getPackage().read()` (reads package metadata)
- ✅ **Shared/Infrastructure** - `core/package/read.ts` → `getPackage()` (reads package metadata)
- ✅ **Shared/Infrastructure** - `core/package/read.ts` → `getPackageContents()` (reads package contents)
  - `core/shared/AdtUtils.ts` → `getPackageContents()`
  - Uses `/sap/bc/adt/repository/nodestructure` with `parent_type: 'DEVC/K'` to get package contents

**Action:**
- ✅ Implementation completed
- Update handler to use `AdtClient.getUtils().getPackageContents()` for package contents

---

## 6. Transport Operations

### 6.1 GetTransport
**Handler:** `transport/readonly/handleGetTransport.ts`  
**Endpoint:** `/sap/bc/adt/cts/transportrequests/{number}` (GET)  
**Status:** ✅ **Exists**  
**Location:**
- ✅ **ReadOnlyClient** - `readTransport()`
- ✅ **AdtClient** - `getRequest().read()` (uses `getTransport()`)
- ✅ **Shared/Infrastructure** - `core/transport/read.ts` → `getTransport()`

**Action:** Update handler to use `AdtClient.getRequest().read()` or `core/transport/read.ts` → `getTransport()`

---

## 7. Function Group Operations

### 7.1 UpdateFunctionGroup
**Handler:** `function/high/handleUpdateFunctionGroup.ts`  
**Endpoint:** `/sap/bc/adt/functions/groups/{name}` (PUT)  
**Status:** ✅ **Exists**  
**Location:**
- ❌ ReadOnlyClient - missing
- ❌ CrudClient - missing (no direct method)
- ✅ **AdtClient** - `getFunctionGroup().update()` (uses `updateFunctionGroup()`)
- ✅ **Shared/Infrastructure** - `core/functionGroup/update.ts` → `updateFunctionGroup()`

**Action:** Update handler to use `AdtClient.getFunctionGroup().update()` instead of direct `connection.makeAdtRequest()`

---

## 8. Code Analysis (No ADT endpoints)

### 8.1 GetAbapAST
**Handler:** `system/readonly/handleGetAbapAST.ts`  
**Endpoint:** N/A (local parsing)  
**Status:** N/A (does not require infrastructure module)

---

### 8.2 GetAbapSemanticAnalysis
**Handler:** `system/readonly/handleGetAbapSemanticAnalysis.ts`  
**Endpoint:** N/A (local parsing)  
**Status:** N/A (does not require infrastructure module)

---

### 8.3 GetAbapSystemSymbols
**Handler:** `system/readonly/handleGetAbapSystemSymbols.ts`  
**Endpoint:** N/A (uses other handlers)  
**Status:** N/A (uses other handlers)

---

### 8.4 DescribeByList
**Handler:** `system/readonly/handleDescribeByList.ts`  
**Endpoint:** N/A (uses SearchObject handler)  
**Status:** N/A (uses `AdtClient.getUtils().searchObjects()`)

---

## Summary

### ✅ Already Implemented (16)
1. GetWhereUsed - `AdtClient.getUtils().getWhereUsed()`
2. GetSqlQuery - `AdtClient.getUtils().getSqlQuery()`
3. GetInactiveObjects - `AdtClient.getUtils().getInactiveObjects()` / `CrudClient.getInactiveObjects()`
4. GetTransport - `AdtClient.getRequest().read()` / `core/transport/read.ts` → `getTransport()`
5. UpdateFunctionGroup - `AdtClient.getFunctionGroup().update()` / `core/functionGroup/update.ts` → `updateFunctionGroup()`
6. GetTransaction - `AdtClient.getUtils().getTransaction(transactionName)` / `core/shared/transaction.ts` → `getTransaction()`
7. GetBdef - `AdtClient.getUtils().getBdef(name, version?)` / `core/behaviorDefinition/read.ts` → `readSource()` (via wrapper)
8. GetEnhancements - `AdtClient.getUtils().getEnhancements(objectName, objectType, context?)` / `core/shared/enhancements.ts` → `getEnhancements()`
9. GetIncludesList - `AdtClient.getUtils().getIncludesList(objectName, objectType, timeout?)` / `core/shared/includesList.ts` → `getIncludesList()`
10. GetPackageContents - `AdtClient.getUtils().getPackageContents(packageName)` / `core/package/read.ts` → `getPackageContents()`
11. FetchNodeStructure - `AdtClient.getUtils().fetchNodeStructure(parentType, parentName, nodeId?, withShortDescriptions?)` / `core/shared/nodeStructure.ts` → `fetchNodeStructure()` (base function for GetObjectInfo)
12. GetObjectStructure - `AdtClient.getUtils().getObjectStructure(objectType, objectName)` / `core/shared/objectStructure.ts` → `getObjectStructure()`
13. GetInclude - `AdtClient.getUtils().getInclude(includeName)` / `core/shared/include.ts` → `getInclude()`
14. GetTypeInfo - `AdtClient.getUtils().getTypeInfo(typeName)` / `core/shared/typeInfo.ts` → `getTypeInfo()` (with fallback chain)
15. GetEnhancementImpl - `AdtClient.getUtils().getEnhancementImpl(spot, name)` / `core/shared/enhancementImpl.ts` → `getEnhancementImpl()` (uses spot in URL)
16. GetEnhancementSpot - `AdtClient.getUtils().getEnhancementSpot(spotName)` / `core/enhancement/read.ts` → `getEnhancementMetadata()` (convenience wrapper with type 'enhsxsb')

### ⚠️ Partially Implemented (2)
1. GetEnhancementImpl - has `getEnhancementSource()`, but handler uses different URL format (spot in URL instead of type), needs `getEnhancementImplBySpot()`
2. GetPackage - has `getPackage()` for metadata, needs method for contents

### ✅ Can Use Existing (1)
1. GetEnhancementSpot - can use `AdtEnhancement.readMetadata()` with `type='enhsxsb'`, needs convenience wrapper `getEnhancementSpot()`

### ❌ Implementation Needed (1)
1. GetAllTypes - object types listing

### 🚫 Not Planned (1)
1. GetObjectNodeFromCache - MCP server-specific (uses in-memory cache, not suitable for adt-clients library)

---

## Recommended Infrastructure Module Structure

```
src/core/infrastructure/
├── system/
│   ├── objectStructure.ts      # GetObjectStructure
│   ├── objectInfo.ts            # GetObjectInfo
│   ├── typeInfo.ts              # GetTypeInfo
│   ├── allTypes.ts              # GetAllTypes
│   └── transaction.ts           # GetTransaction (✅ implemented in core/shared/)
├── enhancement/
│   ├── enhancementImpl.ts       # GetEnhancementImpl (uses spot in URL instead of type)
│   ├── enhancementSpot.ts       # GetEnhancementSpot (convenience wrapper for readMetadata with type='enhsxsb')
│   └── enhancements.ts          # GetEnhancements
├── include/
│   ├── include.ts               # GetInclude
│   └── includesList.ts          # GetIncludesList
├── behavior/
│   └── bdef.ts                  # GetBdef
└── package/
    └── packageContents.ts       # GetPackageContents (extension)
```

All new methods will be added to `AdtClient` via `getUtils()` for easier method grouping.

---

## Implementation Priorities

### High Priority
1. ✅ **GetEnhancements** - ✅ implemented via `AdtUtils.getEnhancements()`
2. ✅ **GetIncludesList** - ✅ implemented via `AdtUtils.getIncludesList()`
3. ✅ **GetPackageContents** - ✅ implemented via `AdtUtils.getPackageContents()`
4. ⚠️ **GetObjectInfo** - ⚠️ base function `fetchNodeStructure()` implemented, full tree building logic remains in handler

### Medium Priority
5. ✅ **GetObjectStructure** - ✅ implemented via `AdtUtils.getObjectStructure()`
6. ✅ **GetTypeInfo** - ✅ implemented via `AdtUtils.getTypeInfo()` (with fallback chain)
7. ✅ **GetInclude** - ✅ implemented via `AdtUtils.getInclude()`
8. ✅ **GetEnhancementImpl** - ✅ implemented via `AdtUtils.getEnhancementImpl()` (uses spot in URL)
9. ✅ **GetEnhancementSpot** - ✅ implemented via `AdtUtils.getEnhancementSpot()` (convenience wrapper)

### Low Priority
10. **GetAllTypes** - object types listing

### ✅ Already Implemented (not in priorities)
- **GetBdef** - ✅ implemented via `AdtUtils.getBdef()` (wraps `readSource()`)
- **GetTransaction** - ✅ implemented via `AdtUtils.getTransaction()`

### 🚫 Not Planned
- **GetObjectNodeFromCache** - MCP server-specific (in-memory cache, not suitable for adt-clients)
