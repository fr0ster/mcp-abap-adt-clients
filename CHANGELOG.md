# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.37] - 2025-12-05

### Added
- **Source Code Validation in Check Methods**: All check methods now support optional `sourceCode` parameter for validating new/unsaved code
  - **Table**: `checkTable(config, sourceCode?, version?)` - validates DDL code (base64 encoded in request)
  - **View**: `checkView(config, sourceCode?, version?)` - validates DDL code (base64 encoded in request)
  - **Structure**: `checkStructure(config, sourceCode?, version?)` - validates DDL code (base64 encoded in request)
  - **Class**: `checkClass(config, version?, sourceCode?)` - validates ABAP code (base64 encoded in request)
  - **Program**: `checkProgram(config, version?, sourceCode?)` - validates ABAP code (base64 encoded in request)
  - **FunctionModule**: `checkFunctionModule(config, version?, sourceCode?)` - validates ABAP code (base64 encoded in request)
  - **Interface**: `checkInterface(config, sourceCode?, version?)` - validates ABAP code (base64 encoded in request)
  - **BehaviorDefinition**: `checkBehaviorDefinition(config, sourceCode?, version?)` - validates BDEF code (base64 encoded in request)
  - **ServiceDefinition**: `checkServiceDefinition(config, sourceCode?, version?)` - validates SRVD code (base64 encoded in request)
  - **MetadataExtension**: `checkMetadataExtension(config, sourceCode?, version?)` - validates DDLX code (base64 encoded in request)
  - When `sourceCode` is provided, code is automatically base64 encoded and included in check request body as `<chkrun:artifacts><chkrun:content>`
  - This enables "live validation" of unsaved code, similar to Eclipse ADT editor behavior
  - All 11 code-bearing object types now support this feature

### Changed
- **CrudClient.checkBehaviorDefinition()**: Added `sourceCode?: string` parameter to support validation of new/unsaved BDEF code
- **CrudClient.checkMetadataExtension()**: Added `sourceCode?: string` parameter to support validation of new/unsaved DDLX code
- **Integration Tests**: Updated Table, View, and Structure tests to include validation of new code after lock/update operations
  - Tests now verify `check(new_code)` step before unlock, ensuring unsaved code can be validated

### Fixed
- **Domain and DataElement Check Methods**: Removed incorrect `sourceCode` parameter support (these objects are metadata-only and don't have source code)

## [0.1.36] - 2025-12-05

### Changed
- **npm Configuration**: Added `.npmrc` with `prefer-online=true` to ensure packages are fetched from npm registry
- **Version Alignment**: Updated `@mcp-abap-adt/connection` dependency in devDependencies from `^0.1.14` to `^0.1.15`

## [0.1.35] - 2025-12-04

### Added
- **Interfaces Package Integration**: Migrated to use `@mcp-abap-adt/interfaces` package for all interface definitions
  - All interfaces now imported from shared package
  - Dependency on `@mcp-abap-adt/interfaces@^0.1.1` added
  - Added `axios@^1.11.0` as dependency (required for `AxiosResponse` type)
- **Local Timeout Utilities**: Created local `getTimeout` implementation in `src/utils/timeouts.ts`
  - Removed dependency on `@mcp-abap-adt/connection` package
  - Timeout configuration now independent of connection package

### Changed
- **Removed Connection Dependency**: Removed `@mcp-abap-adt/connection` from dependencies
  - Package now depends only on `@mcp-abap-adt/interfaces` for type definitions
  - All connection-related types now use `IAbapConnection` and `IAbapRequestOptions` from interfaces package
- **Interface Renaming**: All connection types now use interface names with `I` prefix:
  - `AbapConnection` → `IAbapConnection` (imported from `@mcp-abap-adt/interfaces`)
  - `AbapRequestOptions` → `IAbapRequestOptions` (imported from `@mcp-abap-adt/interfaces`)
- **Type Exports**: Now exports only interface names from `@mcp-abap-adt/interfaces`:
  - `IAbapConnection`, `IAbapRequestOptions`

### Fixed
- **getPackage Accept Headers**: Fixed 404 (Not Found) errors by adding proper ADT-specific Accept header for package read operations
  - Accept: `application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml`
- **readMetadata Accept Headers**: Fixed 406 (Not Acceptable) errors by using proper ADT-specific Accept headers for different object types
  - Classes: `application/vnd.sap.adt.oo.classes.v4+xml` (with fallback to v3, v2, v1)
  - Tables: `application/vnd.sap.adt.tables.v2+xml` (with fallback to v1 and blues.v1)
  - Domains: `application/vnd.sap.adt.domains.v2+xml` (with fallback to v1)
  - Data Elements: `application/vnd.sap.adt.dataelements.v2+xml` (with fallback to v1)
  - Structures: `application/vnd.sap.adt.structures.v2+xml` (with fallback to v1)
  - Views: `application/vnd.sap.adt.ddlSource.v2+xml` (with fallback to v1)
  - Programs: `application/vnd.sap.adt.programs.programs.v2+xml` (with fallback to v1)
  - Function Groups: `application/vnd.sap.adt.functions.groups.v2+xml` (with fallback to v1)
  - Function Modules: `application/vnd.sap.adt.functions.fmodules.v2+xml` (with fallback to v1)
  - Packages: `application/vnd.sap.adt.packages.v2+xml` (with fallback to v1)
- **whereUsed Content-Type Headers**: Fixed 415 (Unsupported Media Type) errors by using proper ADT-specific headers for usageReferences API
  - Content-Type: `application/vnd.sap.adt.repository.usagereferences.request.v1+xml`
  - Accept: `application/vnd.sap.adt.repository.usagereferences.result.v1+xml`
- **Integration Tests**: Added proper error handling for 406, 415, and 404 errors in shared integration tests
  - Tests now provide clear error messages when these HTTP errors occur
  - Added `.env` file loading in all shared integration tests (`readMetadata`, `whereUsed`, `search`, `readSource`, `tableContents`, `sqlQuery`)
  - Added error handling for 404 errors in PackageBuilder tests with clear error messages
- **Test Cleanup Improvements**: Enhanced cleanup logic in integration tests to ensure objects are always cleaned up
  - Added final cleanup in `finally` blocks for guaranteed unlock even if previous cleanup failed
  - Fixed cleanup for tables created in `beforeEach` in ViewBuilder tests (now cleaned up in catch blocks)
  - Ensures objects are unlocked even if test fails after creation
- **Test Timeout Configuration**: Increased Jest global timeout to accommodate sequential test execution
  - Global `testTimeout` increased from 5 minutes (300000ms) to 15 minutes (900000ms)
  - Individual test timeout for `whereUsed` table test increased to 60 seconds (60000ms) for complex queries

## [0.1.34] - 2025-XX-XX

## [0.1.33] - 2025-12-01

### Dependencies
- Updated `@mcp-abap-adt/connection` to `^0.1.13`:
  - **CSRF Token Endpoint Optimization**: Connection layer now uses `/sap/bc/adt/core/discovery` endpoint instead of `/sap/bc/adt/discovery`
    - Lighter response payload (smaller XML response)
    - Available on all SAP systems (on-premise and cloud)
    - Standard ADT discovery endpoint ensures better compatibility
  - **CSRF Configuration Export**: `CSRF_CONFIG` and `CSRF_ERROR_MESSAGES` constants are now exported from connection package
    - Enables consistent CSRF token handling across different connection implementations
    - Provides centralized configuration for retry logic, delays, and error messages
    - See [PR Proposal](https://github.com/fr0ster/mcp-abap-adt/blob/main/packages/connection/PR_PROPOSAL_CSRF_CONFIG.md) for details
  - **Impact**: All CRUD operations and read operations benefit from optimized CSRF token fetching
    - Faster connection initialization
    - Reduced network traffic
    - Better compatibility across different SAP system versions

## [0.1.32] - 2025-11-30

### Added
- **Test cleanup control parameter** – added `skip_cleanup` parameter for controlling object deletion after tests:
  - Global parameter: `environment.skip_cleanup` in `test-config.yaml` (applies to all tests by default)
  - Per-test parameter: `params.skip_cleanup` in test case configuration (overrides global setting)
  - When `skip_cleanup: true`, objects are not deleted but are always unlocked (for analysis/debugging)
  - When `skip_cleanup: false` (default), normal cleanup is performed (unlock + delete)
  - Implemented in `ViewBuilder.test.ts`, `ClassBuilder.test.ts`, and `FunctionModuleBuilder.test.ts`
  - Unlock operations are always performed regardless of `skip_cleanup` setting (only delete is skipped)
  - Useful for debugging, analysis, and troubleshooting test failures

### Changed
- **Test cleanup logic** – improved cleanup behavior in integration tests:
  - Unlock operations are now always performed in cleanup blocks (even when `skip_cleanup: true`)
  - Delete operations are conditionally performed based on `skip_cleanup` parameter
  - Ensures objects are never left locked in SAP system, even when deletion is skipped
  - Clear logging when cleanup is skipped: `⚠️ Cleanup skipped (skip_cleanup=true) - objects left for analysis`

### Documentation
- **Test configuration documentation** – added comprehensive documentation for `skip_cleanup` parameter:
  - Updated `TEST_CONFIG_SCHEMA.md` with cleanup configuration section
  - Updated `BUILDER_TEST_PATTERN.md` with skip cleanup implementation pattern
  - Documented global and per-test configuration options
  - Added use cases and examples for debugging and analysis scenarios

### Fixed
- **CdsUnitTestBuilder double lock issue** – fixed HTTP 403 error during class activation:
  - Added `unlock()` call after `update()` in `CdsUnitTestBuilder.create()` method
  - Prevents "User is currently editing" error when activating class after creation
  - Ensures class is unlocked after test class source is added, allowing activation to proceed
  - Fixes sequence: create → lock → update → unlock (was missing unlock before)
- **Package existence check** – fixed `checkPackageExists` function:
  - Corrected module path from `../src/core/shared/search` to `../../core/shared/search`
  - Added fallback to try `dist/` first, then source directory
  - Changed query from wildcard `${packageName}*` to exact match `packageName` for better accuracy
  - Added diagnostic logging when `DEBUG_ADT_TESTS=true` to help troubleshoot package validation issues
- **Example file imports** – fixed `sessionPersistence.example.ts`:
  - Removed non-existent imports: `setupTestEnvironment`, `cleanupTestEnvironment`, `createClass`
  - Updated to use `getConfig()` and `CrudClient` instead
  - Example now compiles without errors

## [0.1.31] - 2025-11-29

### Fixed
- **Versioning and documentation alignment** – aligned CHANGELOG version dates with actual git release dates:
  - Corrected dates for versions 0.1.10 through 0.1.28 to match actual commit dates from git history
  - Ensures CHANGELOG accurately reflects when each version was actually released
  - Improves historical accuracy and maintainability of project documentation

### Changed
- **Version management rules** – established strict version management guidelines:
  - Added `.cursor/rules/main.mdc` with version management rules
  - Assistant now asks user for version number when adding CHANGELOG entries
  - Assistant never modifies `package.json` version without explicit user request
  - Prevents accidental version changes and ensures user control over versioning

## [0.1.30] - 2025-11-29

## [0.1.29] - 2025-11-29

## [0.1.28] - 2025-11-29

### Added
- **DataElement parameter validation** – added validation for required parameters based on `type_kind`:
  - `predefinedAbapType` and `refToPredefinedAbapType` require `data_type` parameter (e.g., CHAR, NUMC, INT4)
  - `domain`, `refToDictionaryType`, and `refToClifType` require `type_name` parameter
  - Validation added in low-level functions (`create.ts`, `update.ts`) and `DataElementBuilder` methods (`create()`, `update()`)
  - Clear error messages indicate which parameter is missing and what value is expected
  - Prevents runtime errors by catching invalid parameter combinations early

### Changed
- **DataElement domain handling** – improved domain name handling when `type_kind = 'domain'`:
  - When `type_name` is provided and `type_kind = 'domain'`, `type_name` is automatically used as `data_type` internally
  - This aligns with ADT API requirements where domain name must be passed via `data_type` parameter
  - Maintains backward compatibility: if `data_type` is explicitly provided, it takes precedence
  - Updated validation logic to check for either `type_name` or `data_type` when `type_kind = 'domain'`

### Fixed
- **DataElement parameter validation order** – fixed validation to check `args.type_kind` directly before assigning to intermediate variables:
  - Validation now uses `args.type_kind` directly in condition checks instead of intermediate `typeKindXml`/`typeKind` variables
  - Ensures validation occurs before any variable assignment
  - Improves code clarity and prevents potential issues with undefined values

## [0.1.27] - 2025-11-28

### Changed
- **Updated @mcp-abap-adt/connection dependency** – upgraded to `^0.1.12`:
  - Connection package no longer provides `loadEnvFile()`, `loadConfigFromEnvFile()`, or `getConfigFromEnv()` functions
  - Connection package no longer reads `.env` files or depends on `dotenv`
  - Consumers must now pass `SapConfig` directly to connection constructors
  - This change improves separation of concerns and resolves `stdio` mode output corruption issues

### Fixed
- **examples/read-object-transport.js** – updated to work with connection@0.1.12:
  - Removed usage of deprecated `loadConfigFromEnvFile()` and `getConfigFromEnv()` functions
  - Implemented manual `.env` file parsing and `SapConfig` creation
  - Example now reads environment variables and creates `SapConfig` object directly
  - Maintains backward compatibility with existing `.env` file structure

## [0.1.26] - 2025-11-28

### Added
- **DataElementBuilderConfig search help and parameter support** – added support for search help and parameter configuration:
  - `searchHelp?: string` – search help name for data element
  - `searchHelpParameter?: string` – search help parameter name
  - `setGetParameter?: string` – Set/Get parameter ID for data element
  - These parameters are now properly passed through `DataElementBuilder.update()` to `UpdateDataElementParams`
  - Enables full configuration of search help and parameter settings when updating data elements

### Changed
- **DataElementBuilder.update()** – updated to include search help and parameter fields:
  - Now passes `search_help`, `search_help_parameter`, and `set_get_parameter` from config to `UpdateDataElementParams`
  - Ensures all data element properties including search help configuration are properly updated

## [0.1.25] - 2025-11-28

### Changed
- **DomainBuilder.update() workflow detection** – improved workflow detection logic:
  - `update()` method now correctly determines CREATE vs UPDATE workflow based on `this.state.createResult`
  - For UPDATE workflow: uses `updateDomain()` low-level function (for existing domains)
  - For CREATE workflow: uses `upload()` function (for filling newly created empty domains)
  - Ensures proper workflow selection when updating existing domains vs filling newly created domains

### Fixed
- **Domain update workflow** – fixed issue where `DomainBuilder.update()` incorrectly used CREATE workflow for existing domains:
  - `update()` now properly checks `this.state.createResult` to determine workflow
  - If `createResult` exists, uses CREATE workflow (upload to fill empty domain)
  - If `createResult` does not exist, uses UPDATE workflow (updateDomain for existing domain)
  - Prevents "Domain already exists" errors when updating existing domains

## [0.1.24] - 2025-11-27

### Added
- **BehaviorImplementationBuilderConfig.implementationCode** – added optional `implementationCode` parameter to `BehaviorImplementationBuilderConfig`:
  - Allows specifying custom code for implementations include (local handler class) when updating behavior implementation
  - Can be set via config during builder initialization or using `setImplementationCode()` method
  - If `implementationCode` is provided, it takes precedence over `sourceCode` for implementations include updates
  - `BehaviorImplementationBuilder.updateImplementations()` now uses `implementationCode` if available, otherwise falls back to default generated code
  - Enables full control over local handler class implementation code in behavior implementation classes

### Changed
- **CrudClient.updateBehaviorImplementation()** – updated to accept `implementationCode` parameter:
  - Method signature now includes optional `implementationCode` in config: `Pick<BehaviorImplementationBuilderConfig, 'className' | 'behaviorDefinition' | 'implementationCode'>`
  - When `implementationCode` is provided, it is used for updating implementations include instead of default generated code
  - Maintains backward compatibility: if `implementationCode` is not provided, default code is generated as before

### Fixed
- **BehaviorImplementationBuilder constructor** – fixed to properly initialize `implementationCode` from config:
  - Now correctly uses `config.implementationCode` if available, otherwise falls back to `config.sourceCode`
  - Ensures custom implementation code is properly set when provided via config

## [0.1.23] - 2025-11-27

### Added
- **Complete type exports for Behavior Definition operations** – added comprehensive type exports for behavior definition operations:
  - `BehaviorDefinitionValidationParams` – validation parameters structure (`objname`, `rootEntity`, `description`, `package`, `implementationType`)
  - `BehaviorDefinitionImplementationType` – type union for implementation types (`'Managed' | 'Unmanaged' | 'Abstract' | 'Projection'`)
  - `ValidationResult` – validation result structure (`severity`, `shortText`, `longText`)
  - `BehaviorDefinitionCreateParams` – creation parameters structure
  - `LockResult` – lock operation result with lock handle and transport information
  - `CheckReporter` – check reporter type union (`'bdefImplementationCheck' | 'abapCheckRun'`)
  - `CheckMessage` – check message structure (`uri`, `type`, `shortText`, `code`)
  - `CheckRunResult` – check run result structure with reporter, status, and messages
  - Enables consumers to import and use all types directly from `@mcp-abap-adt/adt-clients` for type-safe operations
  - Supports proper type checking when constructing parameters and parsing results for behavior definition operations
- **Complete type exports for Behavior Implementation operations** – added type exports for behavior implementation:
  - `CreateBehaviorImplementationParams` – creation parameters structure for behavior implementation classes
  - Enables type-safe creation of behavior implementation classes
- **Complete type exports for Metadata Extension operations** – added type exports for metadata extension:
  - `MetadataExtensionValidationParams` – validation parameters structure
  - `MetadataExtensionCreateParams` – creation parameters structure
  - Enables type-safe validation and creation of metadata extensions

## [0.1.22] - 2025-11-27

### Added
- **BehaviorDefinitionValidationParams export** – added `BehaviorDefinitionValidationParams` type export to main package index:
  - Enables consumers to import and use the validation parameters type directly from `@mcp-abap-adt/adt-clients`
  - Type-safe access to validation parameters structure (`objname`, `rootEntity`, `description`, `package`, `implementationType`)
  - Supports proper type checking when constructing validation parameters for behavior definition validation operations

## [0.1.21] - 2025-11-27

### Added
- **Integration tests for Behavior Definition, Behavior Implementation, and Metadata Extension**:
  - Added `BehaviorDefinitionBuilder.test.ts` – full workflow test for behavior definition operations
  - Added `BehaviorImplementationBuilder.test.ts` – full workflow test for behavior implementation class operations
  - Added `MetadataExtensionBuilder.test.ts` – full workflow test for metadata extension operations
  - All tests follow consistent pattern: validate → create → lock → update → unlock → activate → check → delete
  - Tests gracefully skip if objects already exist (validation returns HTTP 400)
  - Tests only attempt cleanup if object was successfully created during test run
  - Test configuration support in `test-config.yaml.template`:
    - `create_behavior_definition` section with required parameters (`bdef_name`, `root_entity`, `implementation_type`, `description`, `package_name`, `source_code`)
    - `create_behavior_implementation` section with required parameters (`class_name`, `behavior_definition`, `description`, `package_name`, `source_code`)
    - `create_metadata_extension` section with required parameters (`ext_name`, `target_entity`, `description`, `package_name`, `source_code`)

### Fixed
- **Metadata Extension check run support** – added `DDLX/EX` object type to `getObjectUri()` function in `utils/checkRun.ts`:
  - Metadata Extension objects now correctly resolve to `/sap/bc/adt/ddic/ddlx/sources/{name}` URI
  - `checkMetadataExtension()` now passes only object name to `runCheckRun()`, allowing `getObjectUri()` to construct the full URI
  - Fixes "Unsupported object type: DDLX/EX" error during check operations
- **Stateful session management in BehaviorDefinitionBuilder** – explicit session type management:
  - `lock()` method now explicitly calls `this.connection.setSessionType("stateful")` to enable stateful session
  - `unlock()` method now explicitly calls `this.connection.setSessionType("stateless")` to disable stateful session
  - Ensures lock handle is correctly maintained across lock → update → unlock operations
  - Fixes HTTP 423 "Resource is not locked (invalid lock handle)" errors
- **Validation error handling** – graceful handling of existing objects:
  - `validateBehaviorImplementationName()` now catches HTTP 400 errors and returns `error.response` instead of throwing
  - `validateMetadataExtension()` now catches HTTP 400 errors and returns `error.response` instead of throwing
  - Tests can now check `validationResponse?.status === 400` to detect existing objects and skip gracefully
  - Prevents test failures when objects already exist in shared development environments

### Changed
- **Test parameter validation** – stricter parameter requirements for safety:
  - `BehaviorDefinitionBuilder.test.ts` now validates all required parameters (`bdef_name`, `root_entity`, `source_code`, `package_name`, `implementation_type`, `description`) upfront
  - Tests skip with descriptive error message if any required parameter is missing
  - Prevents unsafe auto-generation of critical parameters in multi-developer environments
  - All parameters must be explicitly configured in `test-config.yaml`
- **Test cleanup logic** – improved cleanup safety:
  - `MetadataExtensionBuilder.test.ts` now uses `objectCreated` flag to track if object was created during test
  - Cleanup in `finally` block only executes if `objectCreated === true`
  - Prevents attempts to delete pre-existing objects that were not created by the test
  - `BehaviorImplementationBuilder.test.ts` and `MetadataExtensionBuilder.test.ts` skip cleanup if validation detects existing object

### Documentation
- **API Reference updated** – added Behavior Definition and Metadata Extension to supported object types:
  - Updated `README.md` – added Behavior Definitions (BDEF) and Metadata Extensions (DDLX) to supported object types table
  - Updated `docs/usage/CLIENT_API_REFERENCE.md` – added complete method documentation:
    - Read operations: `readBehaviorDefinition()`, `readMetadataExtension()`
    - Create operations: `createBehaviorDefinition()`, `createMetadataExtension()`
    - Lock/Unlock operations: `lockBehaviorDefinition()`, `unlockBehaviorDefinition()`, `lockMetadataExtension()`, `unlockMetadataExtension()`
    - Update operations: `updateBehaviorDefinition()`, `updateMetadataExtension()`
    - Activate operations: `activateBehaviorDefinition()`, `activateMetadataExtension()`
    - Delete operations: `deleteBehaviorDefinition()`, `deleteMetadataExtension()`
    - Check operations: `checkBehaviorDefinition()`, `checkMetadataExtension()`
    - Validation operations: `validateBehaviorDefinition()`, `validateMetadataExtension()`, `validateBehaviorImplementation()`
- **Test configuration template updated** – `test-config.yaml.template` now includes complete examples for all three new test types:
  - All required parameters documented with placeholders
  - Source code templates provided for each object type
  - Comments explain parameter usage and requirements

## [0.1.20] - 2025-11-27

### Changed
- **DataElement creation simplified** – removed `domainName` parameter and automatic parameter determination:
  - Removed `domainName` from `CreateDataElementParams`, `UpdateDataElementParams`, and `DataElementBuilderConfig` types
  - Removed `setDomainName()` method from `DataElementBuilder`
  - When `typeKind = 'domain'`, domain name must be passed via `dataType` parameter (domain name goes to `typeName` in XML)
  - For other `typeKind` values, `typeName` comes from `type_name` parameter
  - Removed automatic determination of `typeName`, `dataType`, `length`, and `decimals` based on `typeKind`
  - Removed automatic `getDomainInfo()` calls that fetched domain information
  - Functions now use only provided values directly - no automatic parameter inference
  - If incorrect values are provided, errors will come from SAP system, not from client-side logic

### Removed
- **DataElement `domainName` parameter** – removed from all interfaces and methods:
  - `CreateDataElementParams.domain_name` – removed
  - `UpdateDataElementParams.domain_name` – removed
  - `DataElementBuilderConfig.domainName` – removed
  - `DataElementBuilder.setDomainName()` – removed
  - `CrudClient.createDataElement()` no longer accepts `domainName` in config
  - `CrudClient.updateDataElement()` no longer accepts `domainName` in config

### Migration Guide
- **Before (0.1.19)**:
  ```typescript
  await client.createDataElement({
    dataElementName: 'Z_TEST_DE',
    packageName: 'ZLOCAL',
    typeKind: 'domain',
    domainName: 'Z_TEST_DOMAIN'  // ❌ Removed
  });
  ```

- **After (0.1.20)**:
  ```typescript
  await client.createDataElement({
    dataElementName: 'Z_TEST_DE',
    packageName: 'ZLOCAL',
    typeKind: 'domain',
    dataType: 'Z_TEST_DOMAIN'  // ✅ Domain name via dataType
  });
  ```

## [0.1.19] - 2025-11-26

### Added
- **Complete type exports** – all BuilderConfig and BuilderState types are now exported from main package:
  - All `*BuilderConfig` types (ClassBuilderConfig, ProgramBuilderConfig, InterfaceBuilderConfig, DataElementBuilderConfig, DomainBuilderConfig, StructureBuilderConfig, TableBuilderConfig, ViewBuilderConfig, FunctionGroupBuilderConfig, FunctionModuleBuilderConfig, ServiceDefinitionBuilderConfig, BehaviorDefinitionBuilderConfig, BehaviorImplementationBuilderConfig, MetadataExtensionBuilderConfig)
  - All corresponding `*BuilderState` types for each BuilderConfig
  - `ClassUnitTestDefinition` and `ClassUnitTestRunOptions` types used in CrudClient unit test methods
  - Enables consumers to import and use all types that are returned by client methods (e.g., `getClassReadResult(): ClassBuilderConfig`)
  - Type-safe access to configuration objects returned from read operations
  - Full TypeScript support for all client method return types

## [0.1.18] - 2025-11-26

### Added
- **BehaviorImplementationBuilder** – new Builder class for ABAP Behavior Implementation operations:
  - Extends `ClassBuilder` for full class lifecycle support
  - High-level method `createBehaviorImplementation()` – executes complete workflow:
    1. Creates class as regular class
    2. Locks class
    3. Updates main source with "FOR BEHAVIOR OF" clause
    4. Updates implementations include with default local handler class
    5. Unlocks class
    6. Activates class
  - Specific methods:
    - `updateMainSource()` – updates main source with "FOR BEHAVIOR OF" clause
    - `updateImplementations()` – updates implementations include with hardcoded default handler class code
    - `getBehaviorDefinition()` – returns behavior definition name
  - Automatic generation of default local handler class code based on behavior definition
  - Integration with `CrudClient`:
    - `createBehaviorImplementation()` – full workflow
    - `updateBehaviorImplementationMainSource()` – update main source
    - `updateBehaviorImplementation()` – update implementations include
    - `validateBehaviorImplementation()` – validate class name
    - `getBehaviorImplementationBuilderInstance()` – get builder for advanced operations
  - All standard class operations (lock, unlock, activate, check, read, delete) available through `ClassBuilder` inheritance
  - Integration tests in `src/__tests__/integration/behaviorImplementation/BehaviorImplementationBuilder.test.ts`
  - Test configuration support in `test-config.yaml`:
    - `create_behavior_implementation` section for workflow tests
- **ClassBuilder.update() enhancements** – added support for updating multiple class parts:
  - `update(sourceCode?, options?)` – now accepts optional `options` parameter:
    - `options.implementations` – update implementations include
    - `options.testClasses` – update test classes include
  - All parts can be updated using the same lock handle (no separate lock needed for test classes)
  - New function `updateClassImplementations()` in `core/class/update.ts` for updating implementations include
- **UnitTestBuilder inheritance** – now extends `ClassBuilder` for CDS unit test classes:
  - For `objectType='cds'`: full class lifecycle through `ClassBuilder` inheritance
  - For `objectType='class'`: test include operations only (standalone)
  - CDS unit test classes can use all `ClassBuilder` methods: `create()`, `lock()`, `update()`, `unlock()`, `activate()`, `delete()`

### Changed
- **ClassBuilder fields visibility** – changed private fields to `protected` to enable inheritance:
  - `connection`, `logger`, `config`, `sourceCode`, `lockHandle`, `testLockHandle`, `state` are now `protected`
  - Enables `BehaviorImplementationBuilder` and `UnitTestBuilder` to extend `ClassBuilder`
- **ClassBuilder.update() for test classes** – now uses same lock handle as main source:
  - Removed requirement for separate `lockTestClasses()` when updating test classes via `update()`
  - Test classes can be updated using the same `lockHandle` from `lock()`
- **BehaviorImplementationBuilder.updateImplementations()** – removed parameter, always uses hardcoded default implementation code
- **CrudClient.createBehaviorImplementation()** – removed `sourceCode` parameter requirement:
  - Implementation code is now automatically generated based on `behaviorDefinition`
  - No need to provide implementation code manually

### Fixed
- **Description length limitation** – applied 60-character limit to all description fields across all object types:
  - Added `limitDescription()` utility function in `utils/internalUtils.ts`
  - Applied to all `create()`, `update()`, and `validate()` functions
  - Ensures compliance with SAP ADT description field limitations

## [0.1.17] - 2025-11-26

### Added
- **ServiceDefinitionBuilder** – new Builder class for CDS Service Definition operations:
  - Full CRUD support: `create()`, `read()`, `update()`, `delete()`, `lock()`, `unlock()`, `activate()`, `check()`, `validate()`
  - Low-level functions in `core/serviceDefinition/` module:
    - `create()` – create service definition with package and description
    - `read()` – read service definition metadata
    - `readSource()` – read service definition source code
    - `lock()` / `unlock()` – lock/unlock for modification
    - `update()` – update service definition source code
    - `check()` – syntax check with support for active/inactive versions
    - `activate()` – activate service definition
    - `delete()` – delete service definition
    - `validation()` – validate service definition name
  - Fluent API with Promise chaining support
  - Integration with `CrudClient` and `ReadOnlyClient`:
    - `CrudClient.createServiceDefinition()`, `lockServiceDefinition()`, `unlockServiceDefinition()`, `updateServiceDefinition()`, `activateServiceDefinition()`, `checkServiceDefinition()`, `validateServiceDefinition()`, `deleteServiceDefinition()`
    - `ReadOnlyClient.readServiceDefinition()`
  - Integration tests in `src/__tests__/integration/serviceDefinition/ServiceDefinitionBuilder.test.ts`
  - Test configuration support in `test-config.yaml`:
    - `create_service_definition` section for workflow tests
    - `read_service_definition` section for read-only tests
    - `standard_objects.service_definitions` registry for standard object tests
- **Service Definition support in checkRun utilities** – added `service_definition` and `srvd/srv` object types to `getObjectUri()` function in `utils/checkRun.ts`

### Changed
- **CrudClient parameter handling** – improved default value handling for ServiceDefinitionBuilder:
  - `getServiceDefinitionBuilder()` now only includes explicitly provided parameters (no forced defaults)
  - `validateServiceDefinition()` explicitly sets description on builder before validation
  - Prevents unintended default values from being used when parameters are not provided
- **ReadOnlyClient parameter handling** – removed unnecessary `description: ''` default for `readServiceDefinition()`:
  - Service definition read operations don't require description parameter
  - Builder created with only required `serviceDefinitionName` parameter

### Fixed
- **ServiceDefinitionBuilder test configuration** – added proper test case handling:
  - Test skips gracefully if `create_service_definition` or `read_service_definition` sections are missing from YAML
  - Read test uses separate `read_service_definition` section instead of `create_service_definition`
  - Support for environment-specific parameters (`service_definition_name_cloud`, `service_definition_name_onprem`)

## [0.1.16] - 2025-11-26

### Changed
- **Integration tests refactored to use CrudClient** – all integration tests now use `CrudClient` instead of direct Builder instantiation:
  - `DomainBuilder.test.ts` – migrated to CrudClient for full workflow and read operations
  - `DataElementBuilder.test.ts` – migrated to CrudClient with proper `typeKind` parameter handling
  - `ClassBuilder.test.ts` – migrated to CrudClient including ABAP Unit test operations
  - `InterfaceBuilder.test.ts` – migrated to CrudClient for full workflow
  - `ProgramBuilder.test.ts` – migrated to CrudClient for full workflow
  - `StructureBuilder.test.ts` – migrated to CrudClient with proper `ddlCode` handling
  - `TableBuilder.test.ts` – migrated to CrudClient with proper `ddlCode` handling
  - `ViewBuilder.test.ts` – migrated to CrudClient for main workflow (CDS unit test workflow remains with direct builders)
  - `FunctionModuleBuilder.test.ts` – migrated to CrudClient with error handling for standard objects
  - `FunctionGroupBuilder.test.ts` – migrated to CrudClient for full workflow
  - `PackageBuilder.test.ts` – migrated to CrudClient with proper `softwareComponent` handling
  - Benefits: consistent API usage, better session management, simplified test code, easier maintenance
- **CrudClient session management improved** – `CrudClient` now reuses Builder instances for the same object to maintain session state:
  - Each object type (Domain, Class, DataElement, etc.) has its own Builder instance stored in `CrudClient` state
  - Builder instances are reused when operating on the same object name, ensuring `lockHandle` and session cookies are preserved
  - Prevents "User is currently editing" errors when chaining `lock()` → `update()` → `unlock()` operations
  - One `CrudClient` instance corresponds to one ADT session, maintaining consistency across operations
- **Builder return types updated** – non-state-changing methods now return results directly instead of `this`:
  - `validate()` methods now return `Promise<AxiosResponse>` instead of `Promise<this>`
  - `check()` methods now return `Promise<AxiosResponse>` instead of `Promise<this>`
  - `read()` methods now return `Promise<BuilderConfigUnion | string | undefined>` instead of `Promise<this>`
  - State-changing methods (`create()`, `lock()`, `update()`, `unlock()`, `activate()`, `delete()`) continue to return `Promise<this>` for chaining
  - This makes the API more concise and intuitive: `const result = await builder.validate()` instead of `await builder.validate(); const result = builder.getValidationResponse()`
- **IBuilder interface enhanced** – introduced `BuilderConfigUnion` type for unified `read()` return type:
  - `read()` method can now return various `*BuilderConfig` interfaces or source code strings
  - Enables type-safe access to parsed configuration from read operations
  - Supports use cases where read result is used for subsequent update operations

### Fixed
- **Parameter passing in CrudClient** – fixed parameter handling for various object types:
  - `ddlCode` now properly passed to `StructureBuilder` and `TableBuilder` via `setDdlCode()` method
  - `softwareComponent` now required and properly validated for `PackageBuilder.create()`
  - `typeKind` now required and properly passed for `DataElementBuilder.create()`
  - All `get*Builder()` methods in `CrudClient` now update builder config using setters when reusing instances
- **Package creation** – `softwareComponent` is now mandatory for package creation:
  - `PackageBuilder.create()` validates that `softwareComponent` is provided
  - Low-level `createPackage()` function throws error if `software_component` is missing
  - `CrudClient.createPackage()` requires `softwareComponent` in method signature
  - Default value removed – must be explicitly provided (typically `"ZLOCAL"` for local development)
- **DataElement creation** – `typeKind` is now mandatory for data element creation:
  - `CrudClient.createDataElement()` requires `typeKind` in method signature
  - Ensures proper type definition when creating data elements
- **Asynchronous activation handling** – added retry logic for `check()` operations after `activate()`:
  - Created `retryCheckAfterActivate()` helper function in `tests/test-helper.js`
  - Retries `check()` operation up to 5 times with 1-second delay when activation is still in progress
  - Handles "Error while importing object from the database" errors that occur during asynchronous activation
  - Applied to all integration tests that perform `check(active)` after `activate()`
- **Circular JSON references** – fixed serialization errors in `ClassBuilder.test.ts`:
  - ABAP Unit test status and result retrieval now extracts specific properties (`status`, `statusText`, `data`) from `AxiosResponse` before logging
  - Prevents "Converting circular structure to JSON" errors when stringifying `AxiosResponse` objects
- **Standard object read errors** – improved error handling in `FunctionModuleBuilder.test.ts`:
  - Catches HTTP 404, 500, and 403 errors when reading standard SAP function modules
  - Treats these errors as skips instead of test failures, logging warnings instead
  - Makes tests more resilient to environment-specific data unavailability
- **ViewBuilder test compilation** – fixed TypeScript compilation errors:
  - Added missing `TableBuilder` import
  - Fixed type annotations for Promise chain parameters
  - Updated `validate()` usage to handle `AxiosResponse` return type correctly

### Added
- **Retry helper for activation checks** – `retryCheckAfterActivate()` function in `tests/test-helper.js`:
  - Encapsulates retry logic for `check()` operations after object activation
  - Configurable max attempts (default: 5) and delay (default: 1000ms)
  - Supports custom logger and object name for better error messages
  - Used by all integration tests that need to wait for asynchronous activation to complete

### Documentation
- Updated architecture documentation to reflect CrudClient Builder reuse pattern
- Updated test documentation to reflect migration to CrudClient usage

## [0.1.15] - 2025-11-25

### Changed
- **Updated dependency**: Upgraded `@mcp-abap-adt/connection` from `^0.1.10` to `^0.1.11`
  - Benefits from improved JWT token refresh handling in connection layer
  - Enhanced error messages for expired JWT and refresh tokens
  - Improved CSRF token fetching with automatic JWT refresh support
  - Better error handling for authentication scenarios

### Documentation
- Updated documentation to reflect connection package upgrade and its benefits

## [0.1.14] - 2025-11-25

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

## [0.1.12] - 2025-11-23

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

## [0.1.11] - 2025-11-23

### Changed
- **Reorganized internal utilities** – moved internal helper modules from `src/core/shared/` to `src/utils/`:
  - Moved `systemInfo.ts` – system information and cloud environment detection (used internally by Builders)
  - Moved `validation.ts` – object name validation utilities (used internally by Builders)
  - Moved `checkRun.ts` – syntax and consistency check utilities (used internally by Builders)
  - These utilities are internal implementation details and not exported through public API
  - `src/core/shared/` now contains only operations exposed through CrudClient/ReadOnlyClient
  - Updated all imports in Builders, tests, and core modules

## [0.1.10] - 2025-11-23

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
