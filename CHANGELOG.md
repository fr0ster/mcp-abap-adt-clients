# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.15] - 2025-12-XX

### Changed
- **Updated dependency**: Upgraded `@mcp-abap-adt/connection` from `^0.1.10` to `^0.1.11`
  - Benefits from improved JWT token refresh handling in connection layer
  - Enhanced error messages for expired JWT and refresh tokens
  - Improved CSRF token fetching with automatic JWT refresh support
  - Better error handling for authentication scenarios

### Documentation
- Updated documentation to reflect connection package upgrade and its benefits

## [0.1.14] - 2025-11-24

### Added
- **Configurable package creation**: `CrudClient.createPackage()` now accepts either the legacy transport-request string or a richer options object (`packageType`, `softwareComponent`, `transportLayer`, `transportRequest`, `applicationComponent`, `responsible`). This enables Cloud-specific inputs such as `software_component: "ZLOCAL"` with an empty transport layer. Both `PackageBuilder` and the MCP handlers pass the options through automatically.
- **UnitTestBuilder** – new Builder class for ABAP Unit test operations:
  - Supports both class unit tests (test includes) and CDS view unit tests (full class lifecycle)
  - Methods: `lockTestClasses()`, `updateTestClass()`, `unlockTestClasses()`, `activateTestClasses()`, `runForClass()`, `runForObject()`, `getStatus()`, `getResult()`, `deleteTestClass()`
  - Low-level functions separated into `unitTest/classTest.ts` and `unitTest/run.ts` modules
  - Integration test for CDS unit tests in `ViewBuilder.test.ts` demonstrates complete workflow: table creation → CDS view creation → unit test class creation → test execution → result retrieval

### Changed
- **Standardized validation error handling** – all Builders now handle HTTP 400 validation responses consistently:
  - `StructureBuilder.validate()` now stores HTTP 400 responses in `validationResponse` instead of throwing errors, allowing consumers to parse and interpret validation results
  - `InterfaceBuilder.validate()` now stores HTTP 400 responses in `validationResponse` instead of throwing errors, allowing consumers to parse and interpret validation results
  - `FunctionGroupBuilder.validate()` now stores HTTP 400 responses in `validationResponse` instead of throwing errors, allowing consumers to parse and interpret validation results
  - This aligns validation behavior with `TableBuilder` and `ViewBuilder`, ensuring consistent error handling across all Builders
  - Integration tests now properly handle validation responses by parsing them and throwing appropriate errors when objects already exist
- **Validation test assertions simplified** – all integration tests now use Jest `expect` for validation checks:
  - Replaced `checkValidationResult()` helper with direct `expect(validationResponse?.status).toBe(200)` assertions
  - Added error output before assertion: when validation fails (non-200 status), the actual SAP error message is logged via `console.error` before Jest assertion error
  - This provides better visibility into validation failures by showing the actual SAP response data (HTTP status and error details) before the Jest assertion error
  - Removed `checkValidationResult` helper function and all imports from test files
- **Test timeout configuration** – timeouts now configured via third parameter of `it()` instead of `jest.setTimeout()`:
  - Full workflow tests use `getTimeout('test')` (120 seconds)
  - CDS unit test uses `getTimeout('long')` (200 seconds)
  - Timeouts are read from `test-config.yaml` via `getTimeout()` helper function

### Fixed
- **Interface creation timing** – increased default delay after interface creation from 3000ms to 5000ms in test configuration to prevent 404 errors when locking interfaces immediately after creation
  - Updated `tests/test-config.yaml` and `tests/test-config.yaml.template` with `operation_delays.create: 5000` for `builder_interface` test case
- **FunctionGroup Kerberos error handling** – FunctionGroup creation now ignores "Kerberos library not loaded" errors (HTTP 400) when the error message contains this text
  - SAP sometimes returns HTTP 400 with "Kerberos library not loaded" but still creates the FunctionGroup object
  - The create operation now returns a mock successful response (status 201) when this specific error occurs, allowing workflows to continue
  - Added detailed system information logging for FunctionGroup creation when `DEBUG_ADT_TESTS=true` or `NODE_ENV=test`
- **Interface validation endpoint** – fixed Interface validation to use correct ADT endpoint `/sap/bc/adt/oo/validation/objectname` with `objtype=INTF/OI` and `packageName` query parameter
  - Aligns with Eclipse ADT's validation behavior
  - Previously used incorrect endpoint which caused "wrong input data for processing" errors
- **FunctionGroup validation** – added `packageName` parameter to FunctionGroup validation request
  - `packageName` is now included in both query parameters and XML payload when provided
  - Ensures validation works correctly for FunctionGroups with package context
- **Interface create status verification** – added explicit status code verification in `create.ts` to ensure only HTTP 201/200 responses are accepted
  - Throws descriptive error if create returns unexpected status code
  - Improves error visibility when interface creation fails silently
- **Test workflow fixes** – removed duplicate `lock()` calls from integration tests
  - Fixed tests in `ClassBuilder`, `DataElementBuilder`, `DomainBuilder`, `FunctionModuleBuilder`, `FunctionGroupBuilder`
  - Two consecutive locks are invalid in ADT and caused test failures
- **Safe error logging** – implemented `logErrorSafely()` utility function to prevent credential leakage in error logs
  - All Builder `create()` methods now use `logErrorSafely()` instead of directly logging AxiosError objects
  - Limits response data to 500 characters and excludes sensitive headers
  - Applied to all 14 Builders: Class, Interface, Program, View, Table, Structure, DataElement, Domain, FunctionGroup, FunctionModule, Package, Transport, BehaviorDefinition, MetadataExtension
- **Interface test improvements** – added operation delays after create, lock, update, and unlock operations in InterfaceBuilder test
  - Ensures SAP has time to commit operations before proceeding
  - Added `waitForInterfaceCreation()` helper with retry logic and detailed logging
  - Improved error messages when interface is not found after creation

### Changed
- **Error logging security** – all Builder error logging now uses `logErrorSafely()` to prevent exposing credentials in logs
  - Replaced direct `logger.error()` calls with `logErrorSafely()` in all Builder `create()` methods
  - Error details are logged without sensitive information (credentials, full response data)
  - Response data is limited to first 500 characters for readability

### Documentation
- Updated `docs/usage/CLIENT_API_REFERENCE.md` to describe the new `createPackage(name, superPackage, description, transportOrOptions?)` signature and the available option fields.

## [0.1.13] - 2025-11-24

### Added
- **Class test include helper** – new low-level function and Builder/CrudClient APIs to upload ABAP Unit test classes for existing classes:
  - Added `updateClassTestInclude()` low-level function (PUT `/includes/testclasses`) that accepts a lock handle and raw ABAP test class source.
  - `ClassBuilder` gained `setTestClassCode()` and `updateTestClasses()` helpers plus `getTestClassesResult()` to inspect the response.
  - `CrudClient` now exposes `updateClassTestIncludes()` and `getTestClassUpdateResult()` for automation scenarios that provision ABAP Unit tests alongside productive code.
  - Added ABAP Unit orchestration helpers (`startClassUnitTestRun`, `getClassUnitTestStatus`, `getClassUnitTestResult`) and corresponding CrudClient methods (`runClassUnitTests`, `getClassUnitTestRunStatus`, `getClassUnitTestRunResult`) with getters for run/status/result responses.
  - ClassBuilder integration test now supports optional test-class configuration from `tests/test-config.yaml` (auto uploads test class include and executes ABAP Unit run when configured).
  - `tests/test-config.yaml.template` updated with richer example class (parent/child data builders) and optional `test_class` block.
- **Dedicated test-class lifecycle methods**:
  - Added low-level helpers (`lockClassTestClasses`, `unlockClassTestClasses`) and ClassBuilder methods (`lockTestClasses`, `updateTestClasses`, `unlockTestClasses`, `activateTestClasses`) so test includes can be managed explicitly.
  - CrudClient now proxies these methods 1:1, exposing `lockTestClasses()`, `updateClassTestIncludes()`, `unlockTestClasses()`, `activateTestClasses()` plus getters for lock/activation results.

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
