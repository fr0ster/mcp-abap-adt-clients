# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Deletion XML format** – all delete operations now send proper empty `<del:transportNumber/>` tag when no transport request specified:
  - Affected modules: Structure, Domain, DataElement, Table, View, FunctionGroup, FunctionModule
  - Previously sent empty string which caused malformed XML
  - Now consistent with Class, Interface, Program, Package, BehaviorDefinition
- **Test cleanup pattern** – removed duplicate `delete()` calls in integration tests:
  - `delete()` remains in Promise chain as part of test workflow verification
  - `finally` blocks now only contain `forceUnlock()` for cleanup on test failure
  - Prevents double deletion attempts which could cause test failures
  - Affected tests: ClassBuilder, ProgramBuilder, FunctionGroupBuilder, DomainBuilder, FunctionModuleBuilder, StructureBuilder, DataElementBuilder, InterfaceBuilder

### Changed
- **Cloud-aware attributes** – `masterSystem` and `responsible` now only sent for cloud systems
  - Affects: Structure, Table, Package, View, Interface, DataElement create/update operations
  - Uses `getSystemInformation()` to detect cloud environment instead of `process.env`
- **Builder test pattern improved** – all 10 Builder tests now follow consistent pattern:
  - Pre-check: verify object doesn't exist (safety, non-destructive)
  - Test flow: includes cleanup via `.delete()` method after activation
  - No `afterEach` cleanup blocks (cleanup in test flow only)
- **PackageBuilder test enhanced** – full workflow with update verification:
  - Adds wait periods after create and update operations
  - Verifies description update with second read operation
  - Complete workflow: validate → create → read → lock → update → unlock → read → verify → delete
- **ReadOnlyClient refactored to state pattern** – all read methods now return `Promise<this>` for chaining
  - Added private `state` with `readResult` field
  - Added `getReadResult()` getter method
  - All read operations now store result in state instead of returning directly
  - Enables consistent chaining pattern: `await client.readProgram(name); const result = client.getReadResult();`
- **CrudClient state renamed** – `state` → `crudState` to avoid conflicts with ReadOnlyClient's private state
  - Both classes now have separate private state fields
  - No breaking changes to public API - all getters remain the same

### Added
- **Delete functionality** – complete delete support across all layers:
  - **All 11 Builders** now have `delete()` method, `getDeleteResult()` getter, and `deleteResult` in state
  - **CrudClient** gained 11 new delete methods:
    - `deleteClass()`, `deleteProgram()`, `deleteInterface()`
    - `deleteTable()`, `deleteStructure()`, `deleteDataElement()`
    - `deleteDomain()`, `deleteView()`, `deleteFunctionGroup()`
    - `deleteFunctionModule()` – requires both `functionModuleName` and `functionGroupName`
    - `deletePackage()` – requires `superPackage` parameter
  - Added `deleteResult` to CrudClientState and `getDeleteResult()` getter
  - Low-level delete functions in `core/*/delete.ts` now properly exposed through Builder pattern
- **CrudClient complete method coverage** – added 55 new methods for 8 object types:
  - **FunctionModule** (7 methods): create, lock, unlock, update, activate, check, validate
  - **FunctionGroup** (6 methods): create, lock, unlock, activate, check, validate
  - **DataElement** (7 methods): create, lock, unlock, update, activate, check, validate
  - **Domain** (7 methods): create, lock, unlock, update, activate, check, validate
  - **Structure** (7 methods): create, lock, unlock, update, activate, check, validate
  - **Table** (7 methods): create, lock, unlock, update, activate, check, validate
  - **View** (7 methods): create, lock, unlock, update, activate, check, validate
  - **Package** (6 methods): create, validate, lock, unlock, update, check
  - **Transport** (1 method): create
- All non-read Builder operations now accessible through CrudClient
- Total 87 CRUD methods across all object types (delete + previous methods)

## [0.1.5] - 2025-11-21

### Changed
- **Public API simplified** – removed `/core` exports completely
  - Only CrudClient and ReadOnlyClient are now exposed as public API
  - All functionality accessible through these two client classes only

### Added
- **CrudClient.activateObjectsGroup()** – batch activation of multiple objects
- **CrudClient.parseActivationResponse()** – parse activation results and extract messages

### Removed
- **src/core.ts** – removed internal exports file
- **package.json /core export** – no more internal API exposure

## [0.1.4] - 2025-11-21

### Added
- **CrudClient** – unified client for CRUD operations across all 12 object types
  - Method chaining pattern: all methods return `Promise<this>` for fluent workflows
  - State management: internal state stores results from create, lock, unlock, update, activate operations
  - State getters: `getCreateResult()`, `getLockHandle()`, `getUnlockResult()`, `getUpdateResult()`, `getActivateResult()`, `getCheckResult()`, `getValidationResult()`
  - Extends ReadOnlyClient for all read operations
  - Example: `await client.createProgram(...).lockProgram(...).updateProgram(...).unlockProgram(...).activateProgram(...)` then `client.getCreateResult()`

- **ReadOnlyClient** – simple client for read-only operations
  - 12 read methods covering all object types (readProgram, readClass, readInterface, etc.)
  - Each method internally creates Builder, calls read(), and returns result via getState()
  - Returns `Promise<AxiosResponse>` directly (no chaining needed)

- **Specialized clients** (existing clients, now documented)
  - `LockClient` – wraps lock/unlock for all supported object types, logs `[LOCK]` entries, and registers handles inside `.locks/active-locks.json`
  - `ValidationClient` – shared entry point for ADT name validation (classes, programs, domains, etc.) so handlers no longer import internal modules
  - `ManagementClient` – batch activation and syntax checking operations

### Changed
- **Module exports cleaned** – all 12 core modules (interface, class, dataElement, program, domain, functionGroup, functionModule, structure, table, view, package, transport) now only export:
  - Builder classes (e.g., `ProgramBuilder`, `ClassBuilder`)
  - Type definitions
  - Low-level functions (create, upload, lock, unlock, update, etc.) are now PRIVATE to module folders and NOT exported
  
- **Client classes removed** – `InterfaceClient`, `ClassClient`, `ProgramClient` removed from public API
  - Replaced by unified `CrudClient` which provides the same functionality with better API design
  - Migration path: use `CrudClient` instead of object-specific clients

- **TableBuilder.update()** now calls a refactored `updateTable()` that requires the existing lock handle and session ID. This removes the duplicate LOCK/UNLOCK sequence that previously caused EU510 "currently editing" errors even when the table did not exist.

- **README** completely rewritten to document the new Client architecture:
  - Added "Architecture" section explaining three-layer API (Builders, Clients, Specialized)
  - Added "API Reference" section with CrudClient and ReadOnlyClient method signatures
  - Added "Migration Guide" section with breaking changes and before/after examples
  - Updated "Quick Start" to show CrudClient, ReadOnlyClient, and Builder usage patterns

### Fixed
- **Test imports** – FunctionModuleBuilder tests now use `FunctionGroupBuilder` instead of removed `createFunctionGroup()` function
- Workflow tests for tables now register locks through `onLock` + `LockClient`, ensuring clean unlock/cleanup after each run
- `updateTable()` no longer spawns a second stateful session; the existing ADT session (and cookies) are reused end-to-end

### Breaking Changes
- **Low-level function exports removed** – functions like `createProgram()`, `lockClass()`, `updateInterface()` are no longer exported from module index files
  - **Migration**: Use Builders directly (`new ProgramBuilder(...)`) or use `CrudClient` for simpler API
  - Example: `import { createProgram }` → `import { ProgramBuilder }` or `import { CrudClient }`

- **Object-specific client classes removed** – `InterfaceClient`, `ClassClient`, `ProgramClient` removed from exports
  - **Migration**: Use `CrudClient` which provides unified API for all object types
  - Example: `new InterfaceClient(connection)` → `new CrudClient(connection)`
