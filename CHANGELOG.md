# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.13] - 2025-11-24

### Added
- **Class test include helper** – new low-level function and Builder/CrudClient APIs to upload ABAP Unit test classes for existing classes:
  - Added `updateClassTestInclude()` low-level function (PUT `/includes/testclasses`) that accepts a lock handle and raw ABAP test class source.
  - `ClassBuilder` gained `setTestClassCode()` and `updateTestClasses()` helpers plus `getTestClassesResult()` to inspect the response.
  - `CrudClient` now exposes `updateClassTestIncludes()` and `getTestClassUpdateResult()` for automation scenarios that provision ABAP Unit tests alongside productive code.
  - Added ABAP Unit orchestration helpers (`startClassUnitTestRun`, `getClassUnitTestStatus`, `getClassUnitTestResult`) and corresponding CrudClient methods (`runClassUnitTests`, `getClassUnitTestRunStatus`, `getClassUnitTestRunResult`) with getters for run/status/result responses.
  - ClassBuilder integration test now supports optional test-class configuration from `tests/test-config.yaml` (auto uploads test class include and executes ABAP Unit run when configured).
  - `tests/test-config.yaml.template` updated with richer example class (parent/child data builders) and optional `test_class` block.

## [0.1.12] - TBD

### Changed
- **Type definitions consolidated** – all type definitions moved to centralized `types.ts` files per module:
  - Created `types.ts` in each core module (class, program, interface, domain, dataElement, structure, table, view, functionGroup, functionModule, package, transport, behaviorDefinition, metadataExtension, shared)
  - **Low-level function parameters** use `snake_case` naming (e.g., `class_name`, `package_name`, `transport_request`)
  - **Builder configuration** uses `camelCase` naming (e.g., `className`, `packageName`, `transportRequest`)
  - Moved all interface definitions from individual files (create.ts, delete.ts, update.ts, Builder.ts) to centralized `types.ts`
  - Updated all imports to reference `types.ts` instead of individual files
  - Simplified module exports: `export * from './types'` provides all type definitions
  - Improved type consistency and maintainability across the codebase
- **Reorganized internal Client utilities** – moved Client implementation utilities from `src/core/` to `src/utils/`:
  - Moved `managementOperations.ts` – internal implementations for activation and check operations used by CrudClient
  - Moved `readOperations.ts` – internal implementations for read operations used by ReadOnlyClient
  - These are internal utilities used only by Client classes and not exported through public API
  - `src/core/shared/` remains for operations exposed through SharedBuilder (getInactiveObjects, activateObjectsGroup, search, whereUsed, etc.)
  - Clarified separation: `src/utils/` for internal utilities, `src/core/shared/` for public shared operations

### Added
- **Documentation index** – created `docs/README.md` as central documentation hub:
  - Organized documentation by categories: Architecture, Usage Guides, Development
  - Added quick navigation to all documentation files
  - Included visual directory structure
  - Added key concepts overview (Client classes, Builder pattern, Type system, Session management)
  - Provided links to main package documentation and support resources

## [0.1.11] - TBD

### Changed
- **Reorganized internal utilities** – moved internal helper modules from `src/core/shared/` to `src/utils/`:
  - Moved `systemInfo.ts` – system information and cloud environment detection (used internally by Builders)
  - Moved `validation.ts` – object name validation utilities (used internally by Builders)
  - Moved `checkRun.ts` – syntax and consistency check utilities (used internally by Builders)
  - These utilities are internal implementation details and not exported through public API
  - `src/core/shared/` now contains only operations exposed through CrudClient/ReadOnlyClient
  - Updated all imports in Builders, tests, and core modules

## [0.1.10] - TBD

### Changed
- **Unified logger architecture** – all Builder tests now use three separate loggers:
  - **`connectionLogger`** (type: `ILogger`) – for connection package logs, created by `createConnectionLogger()`, controlled by `DEBUG_CONNECTORS`
  - **`builderLogger`** (type: `IAdtLogger`) – for Builder library code logs, created by `createBuilderLogger()`, controlled by `DEBUG_ADT_LIBS`
  - **`testsLogger`** (type: `IAdtLogger`) – for test execution logs, created by `createTestsLogger()`, controlled by `DEBUG_ADT_TESTS`
  - Removed manual logger implementations and debug flag variables (`debugE2EEnabled`, `debugConnectionEnabled`, `debugLibsEnabled`)
  - Updated all 12 Builder integration tests to use helper functions
  - Fixed logger usage: `testsLogger` for `logBuilderTest*()` functions, `builderLogger` for Builder constructors
- **IAdtLogger interface unified** – all Builders now use shared `IAdtLogger` interface instead of custom logger types:
  - Created `IAdtLogger` in `src/utils/logger.ts` with optional methods (debug, info, warn, error)
  - Updated all 14 Builders (Class, Interface, Program, View, Table, etc.) to use `IAdtLogger`
  - Removed custom `XxxBuilderLogger` type definitions
  - Exported `IAdtLogger` and `emptyLogger` from main index
- **Lock handle output improved** – all lock operations now log full handle instead of truncated:
  - Changed from `lockHandle.substring(0, 10) + '...'` to full `lockHandle`
  - Affects all 13 Builders with lock() method
  - Updated `unlock.ts` error messages to show full handle
  - Improves debugging and lock tracking
- **Debug flags granular system** – 5-tier debug flag architecture:
  - `DEBUG_CONNECTORS` – connection package logs (renamed from `DEBUG_TESTS`)
  - `DEBUG_ADT_LIBS` – Builder library and core function logs
  - `DEBUG_ADT_TESTS` – Builder test execution logs
  - `DEBUG_ADT_E2E_TESTS` – E2E integration test logs
  - `DEBUG_ADT_HELPER_TESTS` – test helper function logs
  - `DEBUG_ADT_TESTS=true` enables all ADT scopes for backward compatibility
- **Operation delays now configurable** – test delays moved from hardcoded to YAML configuration:
  - **Default delays increased**: Changed from 2 seconds to **3 seconds** for better reliability
  - **Global configuration**: Set delays for all tests in `test_settings.operation_delays` section
  - **Test-specific overrides**: Each test case can override delays via `params.operation_delays`
  - **Configurable operations**: `lock`, `unlock`, `update`, `create`, and `default`
  - Added `getOperationDelay(operation, testCase)` helper in `tests/test-helper.js`
  - Updated all 7 Builder integration tests to use configurable delays
  - Improved test reliability when running test suites (multiple tests together)
- **Sequential test execution enforced** – added `maxConcurrency: 1` to `jest.config.js`:
  - Ensures only 1 test suite runs at a time (previously only limited workers)
  - Prevents SAP object conflicts between concurrent tests
  - Combined with existing `maxWorkers: 1` for complete sequential execution

### Added
- **Logger helper functions** in `src/__tests__/helpers/testLogger.ts`:
  - `createConnectionLogger()` – creates logger for connection package
  - `createBuilderLogger()` – creates logger for Builder library code
  - `createTestsLogger()` – creates logger for Builder test execution
  - `createE2ETestsLogger()` – creates logger for E2E tests
  - All helpers respect corresponding DEBUG flags
- **Operation delays documentation** – comprehensive guide in `docs/usage/OPERATION_DELAYS.md`:
  - Configuration examples (global and test-specific)
  - Usage patterns for all operation types
  - Troubleshooting guide for common timing issues
  - Performance tuning recommendations
  - Complete API reference for `getOperationDelay()`
- **Debug logging documentation** – updated `docs/usage/DEBUG.md`:
  - Granular debug flag system explanation
  - Usage examples for each debug scope
  - Logger helper function documentation
  - Backward compatibility notes

### Documentation
- **Reorganized documentation structure** – moved files into categorical subfolders:
  - **`docs/architecture/`** – system design and architecture (ARCHITECTURE.md)
  - **`docs/usage/`** – user guides (DEBUG.md, OPERATION_DELAYS.md, OPERATION_DELAYS_SUMMARY.md, STATEFUL_SESSION_GUIDE.md)
  - **`docs/development/`** – developer guides (BUILDER_TEST_PATTERN.md, TEST_CONFIG_SCHEMA.md)
  - Removed old `docs/reference/` folder
- **Cleaned up obsolete scripts** – removed deprecated development scripts:
  - `fix-builder-tests.sh`
  - `scripts/add-delete-methods.js`
  - `scripts/add-delete-to-builders.sh`

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
