# @mcp-abap-adt/adt-clients – Changelog

All notable changes to this package are documented here.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.1.0] - 2026-04-16

### Changed

- **Dependencies**: `@mcp-abap-adt/connection` upgraded to `^1.8.0`

## [5.0.0] - 2026-04-14

### Breaking Changes

- **ServiceBinding**: `ICreateServiceBindingParams` now requires `bindingVariant: ServiceBindingVariant` instead of separate `bindingType`/`bindingVersion`/`bindingCategory` fields (#17)
- **ServiceBinding**: `ICreateAndGenerateServiceBindingParams` no longer has a `serviceType` field — derived from variant automatically
- **Dependencies**: `@mcp-abap-adt/interfaces` upgraded to `^7.0.0`, `@mcp-abap-adt/connection` to `^1.7.0`

### Added

- **Transformation module**: Full CRUD support for SAP XSLT transformations (`SimpleTransformation` and `XSLTProgram`) via new `AdtClient.getTransformation()` factory method
  - Types: `ITransformationConfig`, `ITransformationState`, `TransformationType`
  - Operations: validate, create, read, readMetadata, readTransport, update, delete, lock, unlock, check, activate
  - Endpoint: `/sap/bc/adt/xslt/transformations`
  - Content-Type: `application/vnd.sap.adt.transformations+xml`
- **ServiceBindingVariant**: `resolveBindingVariant()` helper, `SERVICE_BINDING_VARIANT_MAP` re-exported from interfaces
  - Variants: `ODATA_V2_UI`, `ODATA_V2_WEB_API`, `ODATA_V4_UI`, `ODATA_V4_WEB_API`
- **checkRun**: Added `transformation` / `xslt/vt` object type support

### Fixed

- **BatchRecordingConnection**: Add missing `connect()` method required by `IAbapConnection` interface (interfaces v7.0.0)
- **Transformation validation**: Handle 404 on `/sap/bc/adt/xslt/validation` endpoint (not available on all systems)

## [4.0.5] - 2026-04-13

### Fixed
- **BehaviorDefinition lock**: Add missing `Content-Type: application/xml` header to `lock()` and `lockForUpdate()` requests — without it the XML body was sent as `text/plain`. (#16)

## [4.0.4] - 2026-04-13

### Fixed
- **Package create**: Validate that responsible person is provided (in package config or AdtClient options) before sending request to SAP — prevents cryptic SAP error when the field is missing. (#15)

## [4.0.3] - 2026-04-12

### Fixed
- **Package**: URL-encode `$` in query parameters and XML URI paths — fixes `ERR_UNESCAPED_CHARACTERS` when `super_package` is `$TMP`. Axios default serializer does not encode `$`; switched to `URLSearchParams` via new `buildQueryString()` utility. (#14)
- **Package create**: Apply `escapeXml()` to `package_name` in XML attributes.
- **ServiceBinding**: URL-encode query parameters in publish/unpublish, generate, OData read, and classify operations.
- **ReadOperations**: URL-encode query parameters in `fetchNodeStructure`.

## [4.0.2] - 2026-04-11

### Changed
- **CI**: Upgrade GitHub Actions to Node.js 24 versions — `actions/checkout` v4→v6, `actions/setup-node` v4→v6, `softprops/action-gh-release` v1→v2.

## [4.0.1] - 2026-04-11

### Fixed
- **FeedRepository**: Disable XML entity processing (`processEntities: false`) to prevent `Entity expansion limit exceeded` error when parsing large Atom feeds from SAP ADT (e.g. dumps with >1000 entries). Also mitigates potential XXE vectors. (#13)

## [4.0.0] - 2026-04-11

### Breaking Changes
- **AdtRuntimeClient**: Refactored from ~80 flat methods to `getX()` factory methods returning interfaces from `@mcp-abap-adt/interfaces@6.0.0`. All domain objects implement `IRuntimeAnalysisObject`; listable ones also implement `IListableRuntimeObject`.
- **Debugger**: Composite object — `getDebugger()` returns `getAbap()`, `getAmdp()`, `getMemorySnapshots()`.

### Added
- **FeedRepository**: New domain object with Atom XML parsing — `dumps()`, `systemMessages()`, `gatewayErrors()`, `gatewayErrorDetail()`, `list()`, `variants()`, `byUrl()`.
- **SystemMessages**: SM02 system messages feed reader.
- **GatewayErrorLog**: `/IWFND/ERROR_LOG` gateway error feed reader with detail view.
- **AmdpDebugger**: AMDP debugging domain object.
- **Domain objects**: `AbapDebugger`, `MemorySnapshots`, `ApplicationLog`, `CrossTrace`, `Profiler`, `RuntimeDumps`, `St05Trace`, `DdicActivation`, `AtcLog` — all as standalone domain objects with `getX()` factory accessors.

### Fixed
- **GatewayErrorLog**: Use `username` attribute for user filter instead of `author`.

## [3.14.5] - 2026-04-05

### Fixed
- **Domain create**: Use single-line XML and `limitDescription()` in create payload — same fix as DataElement in 3.14.4. Pretty-printed XML with newlines between declaration and root element caused intermittent 400 "description is missing" on BTP trial. (#12)

## [3.14.4] - 2026-04-05

### Fixed
- **DataElement create**: Remove `<dtel:dataElement>` child elements from create XML payload — SAP rejects the request with "description is missing" when type details are included at creation time. Create now sends minimal XML (root element + packageRef only), matching Eclipse ADT behavior. Type details are set via update. (#11)
- **DataElement Accept header**: Fix version negotiation order to `v1, v2` matching Eclipse ADT.

## [3.14.3] - 2026-04-04

### Fixed
- **Package update**: Empty string params (`master_system`, `responsible`, `package_type`, etc.) no longer overwrite existing SAP-managed values in read-modify-write pattern. Fixes `Check of condition failed` error on BTP trial. (#10)
- **Profiler traces**: `listTraceFiles()` now supports `?user=` filter parameter. `ClassExecutor.runWithProfiling()` resolves current user via `getSystemInformation()` and polls trace files filtered by user — fixes `Failed to resolve traceId` on BTP. (#10)

### Added
- **Docs**: Root package prerequisite documented in test-config template, tests README, and CLAUDE.md.

## [3.14.2] - 2026-04-04

### Fixed
- **Biome lint**: Fix formatting in `RuntimeDumps.test.ts` that caused CI failure.
- **Pre-commit hook**: Add full `src/` Biome check alongside staged-files auto-fix — prevents committing when any file in `src/` has lint errors, matching CI behavior.

## [3.14.1] - 2026-04-02

### Fixed
- **Exports**: Export `buildDumpIdPrefix`, `buildRuntimeDumpsUserQuery`, `IRuntimeDumpsListOptions`, `IRuntimeDumpReadOptions`, `IRuntimeDumpReadView` from package index for standalone usage.
- **Integration tests**: Add test coverage for `from`/`to` datetime filtering in `listRuntimeDumps` and `listRuntimeDumpsByUser`.

## [3.14.0] - 2026-04-02

### Added
- **from/to datetime filter**: `listRuntimeDumps()` and `listRuntimeDumpsByUser()` now support `from` and `to` query params (YYYYMMDDHHMMSS format) for server-side time-range filtering. (#9)
- **buildDumpIdPrefix()**: New helper to compose a runtime dump ID prefix from datetime, hostname, sysid, and instance number — useful for locating dumps discovered via CALM events.

## [3.13.0] - 2026-03-26

### Added
- **listTransports()**: New `AdtClient.getRequest().list()` method to query transport requests via `GET /sap/bc/adt/cts/transportrequests` with proper Accept header negotiation. Supports filtering by `user`, `status`, `dateRange`, `targetSystem`, `requestType`. (#7)

## [3.12.0] - 2026-03-26

### Fixed
- **Content-Type Negotiation**: Fixed 415 (Unsupported Media Type) errors on ECC on-premise systems by auto-detecting and caching correct Content-Type per endpoint. Mirrors the existing Accept (406) negotiation mechanism. Affects `checkruns`, `deletion/check`, and any other endpoint where Content-Type varies by SAP system version. (#6)

### Changed
- **Accept/Content-Type correction enabled by default**: `enableAcceptCorrection` is now `true` by default — both 406 (Accept) and 415 (Content-Type) auto-retry work out of the box without explicit opt-in. Disable with `enableAcceptCorrection: false` or `ADT_ACCEPT_CORRECTION=false`.

## [3.11.5] - 2026-03-21

### Added
- **Pre-commit hook**: Add husky with Biome auto-fix on staged files — prevents committing code with lint/format errors.

## [3.11.4] - 2026-03-21

### Fixed
- **Batch payload**: Fix multipart boundary separation in `buildBatchPayload()` — request body content was merging with boundary markers when inner requests contained a body (POST/PUT with XML/text data). Added `\r\n` between parts and before closing boundary.

### Added
- **Batch POST tests**: Exploratory integration tests verifying POST operations (validate, check, mixed GET+POST) work through the batch endpoint.

## [3.11.3] - 2026-03-14

### Fixed
- **Legacy class update**: Keep lock→check→update→unlock in a single stateful session on legacy SAP systems (BASIS < 7.50). Fixes HTTP 423 errors caused by lock handle invalidation when switching to stateless between lock and update (GitHub #11).

### Added
- **read-object script**: Universal `scripts/read-object.ts` for reading any ADT object (source code and/or metadata) with `--type`, `--read=source|metadata|both` flags. Supports all 18 object types.

## [3.11.2] - 2026-03-13

### Fixed
- **Biome lint**: Fix `noUselessTernary` in `Package.test.ts` — simplify `=== true ? true : false` to `=== true`.
- **Biome lint**: Fix `noUselessConstructor` in `AdtUnitTestLegacy` — remove redundant constructor.
- **Biome lint**: Fix `noUnusedFunctionParameters` in `domain/check.ts` — prefix unused `logger` param with underscore.

## [3.11.1] - 2026-03-13

### Changed
- **CI**: Upgrade Node.js from 18/20 to 24 in CI and Release workflows.

## [3.11.0] - 2026-03-13

### Added
- **interfaces v5**: Upgrade `@mcp-abap-adt/interfaces` to v5 — package CRUD interfaces (`ICreatePackageParams`, `IUpdatePackageParams`, `IDeletePackageParams`, `IReadPackageParams`) moved to interfaces package.
- **Package lock**: `lockPackage` now returns `{ lockHandle, corrNr }` — `corrNr` is used as fallback transport request in update flow.
- **Package update**: Patching `master_system` field is now supported in update XML.
- **BaseTester**: Add `cleanupObject` hook for custom pre-test cleanup logic.
- **README**: Add Stand With Ukraine badge.

### Fixed
- **Package create**: Remove redundant `checkPackage(inactive)` after create — packages are containers with no source code, no syntax check needed.
- **Package update**: Remove redundant final `checkPackage(inactive)` after update.
- **Package update**: Fix `setSessionType` placement — stateful mode is now held across the full lock→update→unlock sequence.
- **Package URLs**: Normalize package name to lowercase in lock, unlock, and update URLs to avoid HTTP 404 on case-sensitive ADT endpoints.
- **Package create**: Fix `masterSystem` → `master_system` field name in low-level params.
- **Package update**: Pass `master_system` and `record_changes` consistently in all update calls.
- **ProgramExecutor test**: Adapt to fire-and-forget profiling — `traceId` is now resolved via `listTraceRequests()` + `extractTraceIdFromTraceRequestsResponse()`.
- **Test config**: Separate `connection_type` (transport mechanism) from `is_legacy` (system type) — legacy detection now uses explicit `is_legacy: true` flag instead of inferring from `connection_type: "rfc"`.

## [3.9.3] - 2026-03-11

### Fixed
- **Legacy read tests**: Enable read tests on legacy systems — remove unnecessary `available_in` restrictions from standard_objects for classes, interfaces, views, tables, function groups, function modules. These objects are available on all systems including legacy (BASIS < 7.50).
- **View flow test**: Remove `available_in: ["onprem", "legacy"]` restriction — views work on cloud.
- **Package $TMP**: Add `"legacy"` to `available_in` for standard $TMP package.

### Changed
- **Shared dependencies**: Add `available_in` to access_controls, behavior_definitions, service_definitions (`["onprem", "cloud"]`) — not available on legacy systems (BASIS < 7.50).

## [3.9.1] - 2026-03-11

### Fixed
- **Package/Domain/DataElement/TableType update**: Refactor XML update to read-modify-write pattern — GET current XML, patch only changed fields, PUT back. Previously XML was built from scratch, losing SAP-managed fields like `abapLanguageVersion`.
- **FunctionGroup update**: Remove unused XML parsing; use shared `patchXmlAttribute` utility.
- **Package delete after update**: Reset connection session before cleanup delete to release lingering locks from the update session.

### Added
- **`xmlPatch` utility** (`src/utils/xmlPatch.ts`): Shared helpers for safe XML patching — `patchXmlAttribute`, `patchXmlElement`, `patchXmlElementAttribute`, `patchXmlBlock`, `patchIf`, `extractXmlString`.

## [3.9.0] - 2026-03-11

### Added
- **Shared dependencies**: Add `ZAC_SHR_SRVD01` (service definition) exposing `ZAC_SHR_CDSUT_DDLS` to shared dependencies for read-only tests.
- **Admin scripts**: Add `service_definitions` support to setup, teardown scripts and `test-helper.js`.
- **Admin scripts**: Add `available_in` filtering to shared dependencies setup/teardown — items not available in the current environment (cloud/onprem) are skipped automatically.

### Changed
- **Cloud test coverage**: Enable all flow tests that can work on cloud by removing unnecessary `available_in: ["onprem"]` restrictions (domain, data element, table, tabletype, structure, class, interface, function group, function module, behavior definition, behavior implementation, metadata extension, transport, group activation, unit test).
- **Group activation**: Rename test objects from `ZAC_*_GRP` to `ZAC_*_GA01` (domain, data element, structure) with corrected DDL code.
- **Group activation**: Add pre-cleanup to delete leftover objects from failed previous runs, use low-level lock/update/unlock with try/finally for guaranteed unlock.
- **Shared dependencies**: Mark programs as `available_in: ["onprem", "legacy"]` (programs don't exist on cloud).
- **Shared dependencies**: Rename behavior provider class `ZBP_AC_SHR_BIMP_DDLS` → `ZAC_BP_SHR_BIMP_DDLS`.

### Fixed
- **Interface test**: Fix `Read undefined failed: no response` on cloud by skipping initial source read after create (same as class — source not yet available immediately after creation).
- **Package test**: Add `software_component: "ZLOCAL"` and `record_changes: false` for cloud trial packages.

## [3.8.9] - 2026-03-11

### Changed
- **Test config**: Migrate `standard_objects` from system-dependent SAP objects to own shared dependencies (`ZAC_SHR_*`) to avoid ABAP version/system differences across test environments.
  - classes: `CL_ABAP_CHAR_UTILITIES` → `ZAC_SHR_RUN01`
  - interfaces: `IF_BUPA_API_MODIFY` → `ZAC_SHR_IF01`
  - views: `H_T000` → `ZAC_SHR_CDSUT_DDLS`
  - programs: `RSHOWTIM` → `ZAC_SHR_PROG`
  - function_groups: `EDIN` → `ZAC_SHR_FUGR`
  - function_modules: `IDOC_INBOUND_XML_SOAP_HTTP` → `Z_AC_SHR_FM01`
  - Basic DDIC objects (MANDT, SYST, T000, STRING_TABLE, ABAP_BOOL) kept as-is.
- **Test config**: Rename all test object names from `ZADT_BLD_*` prefix to `ZAC_*` (shorter, avoids collision with `mcp-abap-adt` project).
- **Test config**: Enable all tests by default in template (`enabled: true`); use `available_in` for environment-specific restrictions instead of `enabled: false`.

### Added
- **Shared dependencies**: Add `ZAC_SHR_IF01` (interface) and `Z_AC_SHR_FM01` (function module in `ZAC_SHR_FUGR`) to shared dependencies.
- **Admin scripts**: Add `interfaces` and `function_modules` support to setup and teardown scripts.

### Fixed
- **ServiceDefinition**: Fix leaked YAML comment (`#`) in `source_code` block causing CDS syntax error on update.
- **BatchEndpointScope**: Wrap verbose payload/response logging behind `DEBUG_ADT_TESTS` env var.
- **readAccept/readAcceptCorrected**: Skip local test classes read on cloud (standard classes have no test includes).

## [3.8.8] - 2026-03-11

### Fixed
- **Biome formatting**: Fix formatting in `check.ts` for class and view modules after i18n refactoring.

## [3.8.7] - 2026-03-11

### Fixed
- **Check results (i18n)**: Replace English text matching (`"has been checked"` / `"was checked"`) in `parseCheckRunResponse` with language-independent approach — filter E-type echo messages by `statusText` comparison, extract structured `code`/`msgId`/`msgNo` from check messages. Removes hardcoded English strings from all 12 `check.ts` files. Fixes [fr0ster/mcp-abap-adt#13](https://github.com/fr0ster/mcp-abap-adt/issues/13).

## [3.8.6] - 2026-03-11

### Fixed
- **Error response logging**: Replace `JSON.stringify(e.response.data)` with `safeStringify()` in create/update/unlock error handlers across class, enhancement, interface, program, table, tabletype, transport, function group modules — `JSON.stringify` on Axios error responses throws `TypeError` due to circular references, masking the original SAP error message.

### Added
- **`safeStringify` utility** (`src/utils/internalUtils.ts`): Serializes objects with circular reference protection via replacer function.

## [3.8.5] - 2026-03-11

### Fixed
- **Logger error calls**: Replace raw `AxiosError` objects passed to `logger.error()`/`logger.warn()` with `safeErrorMessage()` utility across all 34 ADT object modules — `AxiosError` objects contain circular references that crash `JSON.stringify` inside logger implementations. `safeErrorMessage()` safely extracts HTTP status, response data snippet, and error message.

### Added
- **`safeErrorMessage` utility** (`src/utils/internalUtils.ts`): Extract safe, loggable string from error objects (HTTP status + response data + message) without circular reference risks.
- **Test scripts**: `test:reinit` — cross-platform (Windows compatible) script to recreate `test-config.yaml` from template (replaces `cp -n` which doesn't work on Windows).

## [3.8.4] - 2026-03-10

### Fixed
- **Test config**: Add missing `typeMap` entries for `serviceBinding`, `tabletype`, `accessControl` in `resolveStandardObject()` — root cause of these read tests being skipped.
- **Test config**: Fix transport test case name mismatch (`adt_transport` → `builder_transport`).
- **Package test**: Skip activation step (packages don't require activation in ADT), add `record_changes: false` for local packages without transport.
- **Access control DCL**: Fix invalid `pfcg_auth` syntax in shared and build access controls.

### Added
- **Shared dependencies**: Add `ZAC_SHR_AC01` access control (for CDS view `ZAC_SHR_CDSUT_DDLS`) to `shared_dependencies` and `standard_objects`.
- **Shared setup**: `ensureSharedDependency` now re-activates existing objects when source differs from config (previously skipped objects that already existed).
- **Admin scripts**: Add `access_controls` support to setup, teardown, and check scripts.

## [3.8.3] - 2026-03-09

### Changed
- **Test config**: Replace hardcoded object names with YAML config in shared tests (readMetadata, readSource, whereUsed, sqlQuery, tableContents). All tests now use `standard_objects` / `shared_dependencies` via `TestConfigResolver`.
- **Test config**: Add missing YAML sections — `read_source`, `read_metadata`, `where_used`, `read_transport`, `run_program`, and 11 readonly read sections.

### Dependencies
- **@mcp-abap-adt/connection**: `^1.5.0` → `^1.5.1` — fixes RFC query params encoding.

## [3.8.2] - 2026-03-09

### Added
- **Where-used test config**: Added `where_used` section (7 test cases) to YAML template and config using `ZAC_SHR_VTABL` from shared dependencies for consistent results across environments.
- **Read metadata test config**: Added `read_metadata` section (4 test cases) to YAML template and config.

### Changed
- **Where-used tests**: Replaced hardcoded object names (`CL_ABAP_CHAR_UTILITIES`, `T000`) with YAML config-driven params via `TestConfigResolver`.

## [3.8.1] - 2026-03-09

### Fixed
- **Profiler trace ID resolution**: `ClassExecutor.runWithProfiling` now falls back to `listTraceFiles` when `listTraceRequests` returns a feed without trace file IDs (previously only fell back on exception).
- **Profiler statements Accept header**: Use `application/vnd.sap.adt.runtime.traces.abaptraces.aggcalltree+xml, application/xml` for `/statements` endpoint (matching Eclipse ADT behavior).

### Added
- **Shared runnable classes**: `ZAC_SHR_RUN01` (if_oo_adt_classrun with Hello World loop) and `ZAC_SHR_DMP01` (division by zero for dumps) as shared dependencies — created once, never modified by tests.
- **Profiler traces integration test**: 6 test cases — list endpoints, create parameters, run with profiling, discover traces, read trace details (hitlist/statements/dbAccesses), requests by URI.
- **Runtime dumps integration test**: Read dumps feed, generate artificial dump via shared class, read dump by ID with views (default/summary/formatted).
- **Shared dependency support for classes**: `ensureSharedDependency` and setup script now handle `classes` type.
- **`ACCEPT_TRACE_CALLTREE`** content type constant for profiler trace statements.

## [3.7.0] - 2026-03-07

### Changed
- **Legacy unit test synchronous results**: Legacy systems (BASIS < 7.50) return test results synchronously from POST `/testruns` (`aunit:runResult`) — no run ID, no async polling. `AdtUnitTestLegacy` now handles this correctly with synthetic `legacy-sync` run ID and cached results.
- **Removed unused legacy endpoints**: `getClassUnitTestStatusLegacy` and `getClassUnitTestResultLegacy` removed — legacy systems don't support separate status/result polling.
- **Legacy XML format**: `runLegacy.ts` uses correct `aunit:runConfiguration` with `adtcore:objectReferences` format (matching Eclipse ADT behavior).

### Fixed
- **Unit test integration test**: Use single `unitTest` instance for read/readMetadata to preserve cached state across operations.
- **Test config**: `run_unit_test` now available for `legacy` environment.

## [3.6.0] - 2026-03-07

### Added
- **Legacy unit test support**: `AdtUnitTestLegacy` class for systems with BASIS < 7.50 that use `/sap/bc/adt/abapunit/testruns` endpoint instead of `/sap/bc/adt/abapunit/runs`.
- **Legacy unit test run functions**: `runLegacy.ts` with `startClassUnitTestRunLegacy`, `getClassUnitTestStatusLegacy`, `getClassUnitTestResultLegacy` using `application/xml` content types.
- **AdtClientLegacy.getUnitTest()**: Override returns `AdtUnitTestLegacy` for legacy systems.

## [3.5.0] - 2026-03-07

### Fixed
- **Class includes check on legacy**: Pass `artifactContentType` through to `checkClassDefinitions`, `checkClassLocalTypes`, `checkClassLocalTestClass`, `checkClassMacros` — fixes "Dirty Source: Wrong content type" errors on non-unicode legacy systems (e.g., E77).
- **checkClassLocalTestClass refactored**: Deduplicated into shared `checkClassInclude` function (was a standalone copy-paste).
- **Macros test config**: Remove stray `CLASS ZADT_BLD_CLS01 IMPLEMENTATION` from `macrosCode_update` (copy-paste error).

### Added
- **SAP_UNICODE documentation**: Document `SAP_UNICODE=false` env var in CLAUDE.md, RFC_TESTING.md, RFC_CONNECTION.md, LEGACY.md, and test-config.yaml template.

## [3.4.0] - 2026-03-07

### Added
- **Unicode support**: `unicode` parameter in `AdtContentTypesBase` and `IAdtClientOptions` for correct `Content-Type` headers on legacy non-unicode systems (`text/plain` vs `text/plain; charset=utf-8`).
- **Interface contentTypes**: Pass `contentTypes` through to `AdtInterface` for check and update operations on legacy systems.
- **Class local includes contentTypes**: Pass `sourceArtifactContentType` to `AdtLocalTestClass`, `AdtLocalTypes`, `AdtLocalDefinitions`, `AdtLocalMacros` update operations.
- **Pre-existing object cleanup**: `objectExists` flag in `ensureObjectReady` return type enables BaseTester to delete pre-existing objects when test is skipped.

### Fixed
- **FunctionModule test**: Fix missing `await` on `tester.beforeEach()()` causing `ensureObjectReady` to run without waiting.
- **FunctionModule existence check**: Use `readMetadata()` instead of `read()` (source) for reliable FM existence detection on legacy.
- **Interface check on legacy**: Pass `artifactContentType` to `checkInterface` to avoid "Wrong content type" errors on non-unicode systems.
- **CSRF test**: Skip on RFC connections (CSRF tokens are HTTP-only).
- **Test template**: Add default `available_in` markers for all flow test cases.

## [3.3.2] - 2026-03-07

### Fixed
- **Cloud compatibility**: Rewrite CSRF diagnostic test to use `connection.makeAdtRequest()` instead of raw axios (supports JWT auth on cloud).
- **FunctionGroup**: Add retry with delay on post-create read 404 (cloud eventual consistency).
- **FunctionModule**: Add function groups to shared dependencies for consistent test setup.
- **ServiceBinding**: Increase default long timeout from 60s to 120s for publish/unpublish operations.
- **Legacy support**: Auto-detect legacy content types for FunctionGroup/FunctionModule.

### Changed
- **Tests**: Add environment-based test filtering for legacy/cloud/onprem systems.

## [3.3.1] - 2026-03-07

### Fixed
- **CI/Release**: Resolve `@mcp-abap-adt/interfaces` from npm registry instead of local symlink in `package-lock.json`.

## [3.3.0] - 2026-03-07

### Fixed
- **Biome linter**: Replace all `any` types with strict alternatives to satisfy `noExplicitAny` rule.

## [3.2.0] - 2026-03-07

### Added
- **Legacy environment type**: Three-tier environment classification (`cloud`, `onprem`, `legacy`) for test infrastructure. Tests can now specify `available_in: ["onprem", "legacy"]` to control which systems they run on.
- **`AdtUtilsLegacy`**: Throws clear errors for operations not available on legacy systems (`getTableContents`, `getSqlQuery`, `getTransaction`) instead of returning cryptic HTTP 404.
- **`AdtClientLegacy.getUtils()`**: Returns `AdtUtilsLegacy` with unsupported operation guards.
- **Shared test programs**: `ensureSharedDependency` now supports `programs` type for auto-creating test programs.
- **`TestConfigResolver.isTestAvailable()`**: Static convenience method for tests that don't use BaseTester.
- **Auto-detect legacy in BaseTester**: Determines legacy status from `AdtClientLegacy` constructor name — no manual `isLegacySystem` flag needed.

### Fixed
- **UnitTest**: Use `createTestAdtClient()` instead of `new AdtClient()` to get correct content types on legacy systems.
- **Program run test**: Use shared program with fixed name instead of creating temporary programs with dynamic suffix.

## [3.0.0] - 2026-03-06

### Added
- **RFC transport**: Support for legacy SAP systems (BASIS < 7.50) where HTTP stateful sessions are not available. Uses `SADT_REST_RFC_ENDPOINT` function module — the same mechanism Eclipse ADT uses via JCo.
- **AdtClientLegacy**: Extended client for legacy systems with per-object handlers (direct DELETE, versionless content types). Unsupported object types throw clear errors referencing missing ADT discovery endpoints.
- **`createAdtClient()` factory**: Auto-detects modern vs legacy systems via `/sap/bc/adt/core/discovery` endpoint.
- **7 legacy handlers**: `AdtClassLegacy`, `AdtProgramLegacy`, `AdtInterfaceLegacy`, `AdtFunctionGroupLegacy`, `AdtFunctionModuleLegacy`, `AdtPackageLegacy`, `AdtViewLegacy`.
- **Content type system**: `AdtContentTypesBase` / `AdtContentTypesModern` for version-aware Accept/Content-Type headers.
- **Discovery utilities**: `fetchDiscoveryEndpoints()` and `isEndpointInDiscovery()` for endpoint availability checking.
- **CSRF diagnostic test** for connection troubleshooting.
- **Documentation**: `LEGACY.md` (support matrix), `RFC_CONNECTION.md` (consumer guide), `RFC_TESTING.md` (developer guide), discovery endpoint analysis across cloud/on-prem modern/on-prem legacy.

### Fixed
- Fix double URL-encoding in 16 validation files (`$TMP` was encoded as `%2524TMP` instead of `%24TMP`).
- Fix missing `encodeURIComponent(lockHandle)` in 33 update/unlock files (base64 lock handles from RFC contain spaces/+/= that break URLs).
- Fix missing Accept header in table, interface, and view update operations.
- Fix FunctionGroup read via RFC (only `*/*` Accept works).
- Fix BaseTester multi-word object name lookup (camelCase prefix).
- Fix missing `adtView` property declaration in `AdtCdsUnitTest`.
- Resolve Biome lint errors across the codebase.

## [2.3.0] - 2026-03-06

### Added
- **Jest globalSetup**: SAP connection preflight check — validates connectivity once before any test file runs. If `SAP_URL` is configured but unreachable, the entire suite fails immediately with a clear error instead of letting 24+ test files silently skip.

### Changed
- **Content type constants**: Extracted all inline `Accept` / `Content-Type` header strings into `src/constants/contentTypes.ts`. Replaces ~370 scattered string literals across 130+ core module files with named constants (`ACCEPT_*` for Accept headers, `CT_*` for Content-Type headers).
- **Test config template**: Simplified `shared_dependencies`, aligned `create_view` template, replaced placeholders with concrete `ZADT_SHR_*` names, added BDEF shared dependencies.

### Fixed
- Aligned `create_view` template field names with shared table definition.
- Simplified `shared_dependencies` template to match actual usage (removed unused BDEF table/view entries).
- Updated `@mcp-abap-adt/connection` to `^1.3.2`.
- Stateful session only on lock/unlock requests.
- Rewritten `getTableContents` to use DDIC Data Preview endpoint.
- Corrected Accept header for freestyle SQL query endpoint.

## [2.2.0] - 2026-03-01

### Changed
- **Test infrastructure**: moved dependency objects (tables, CDS views, BDEFs) to a persistent shared sub-package (`ZOK_TEST_0003_SHARED`) with "ensure on first use" strategy — check if exists, create only if missing, never delete.
- Added `shared_dependencies` section to `test-config.yaml.template` as single source of truth for all dependency DDL sources.
- Added `test-helper.js` to git tracking (previously caught by `src/**/*.js` gitignore rule).

### Added
- `ensureSharedPackage()` — creates shared sub-package on first use (in-memory flag skips after first verification).
- `ensureSharedDependency()` — centralized "ensure on first use" for tables, views, and behavior definitions with in-memory cache per `type:name`.
- `resolveSharedDependency()`, `getSharedDependenciesConfig()`, `getSharedPackage()`, `resetSharedDependencyCache()` helpers in `test-helper.js`.

### Removed
- Inline dependency creation/deletion in `View.test.ts`, `BehaviorDefinition.test.ts`, `CdsUnitTest.test.ts`, `BehaviorImplementation.test.ts` — replaced with shared dependency helpers (~490 lines removed).
- Module-level `ensureDependency` and `delay` helper functions from `CdsUnitTest.test.ts` and `BehaviorImplementation.test.ts`.
- Inline `dep_*_source` / `dep_*_ddl_source` / `table_source` fields from test case definitions (now resolved from `shared_dependencies`).

## [2.1.0] - 2026-03-01

### Added
- Export `getSystemInformation` from public API (`src/index.ts`).
- `resolveSystemContext()` helper in test infrastructure — resolves `masterSystem`/`responsible` for both cloud (systeminformation endpoint) and on-premise (test-config.yaml) systems.
- `run_program` test section in test-config.yaml template for direct `runProgram()` testing.

### Fixed
- **UnitTest**: read-based existence check instead of delete-before-create — reuses existing class if present, avoids transport lock conflicts.
- **CdsUnitTest**: full dependency management (table → CDS view → test class) with `ensureDependency` helper; 10-second delay after view activation for CDS metadata propagation.
- **ReadOnlyClient**: check `resolver.isEnabled()` to properly skip disabled test cases (fixes `readView`/`readServiceDefinition` failures).
- **Package**: added `resolveTransportRequest`, `recordChanges`, and `transport_layer`/`software_component` support; parent package must be structure/main type.
- **BehaviorDefinition**: auto-create dependency chain (table → CDS view) with `ensureDependency` helper; uses `define root view entity` syntax.
- **BehaviorImplementation**: auto-create full dependency chain (table → CDS view → BDEF → implementation class); uses `authorization master ( instance, global )`.
- **MetadataExtension**: updated source code to use `annotate entity` syntax instead of `extend view`.
- All integration tests: unified `systemContext` passing via `resolveSystemContext()` for consistent `masterSystem`/`responsible` resolution.

### Changed
- Updated test-config.yaml.template: all `transport_request` fields commented out (uses `default_transport` fallback), added `default_master_system` environment setting, added dependency sections for BDEF/BIMP/CDS tests, updated MetadataExtension syntax, added `run_program` section.
- Template now uses `annotate entity` (modern syntax) for metadata extensions instead of `extend view`.

## [2.0.0] - 2026-02-28

### Changed
- **BREAKING**: Moved `masterSystem`/`responsible` resolution from internal `create.ts` to caller. All `create()` calls now require explicit `masterSystem`/`responsible` in config for on-premise systems.

## [1.3.0] - 2026-02-28

### Fixed
- Fixed program validation: use `PROG/P` object type and pass `packagename` parameter to `/sap/bc/adt/programs/validation` endpoint. Previously used incorrect `prog` type causing "InvalidProgramName" on on-premise systems.
- Fixed `isCloudEnvironment()` detection: check URL patterns first (`*.hana.ondemand.com` → cloud, `http:` with port → on-premise) before falling back to systeminformation endpoint. Modern on-premise systems expose the systeminformation endpoint too, causing false cloud detection.

### Added
- Program CRUD integration tests: full workflow (validate → create → update → activate → delete), read standard object, read transport request.
- `run.test.ts` — self-contained `runProgram()` integration test (creates program, runs, cleans up).
- Test infrastructure: `test-helper.js` with `isHttpStatusAllowed`, `getAcceptHint`, `withAcceptHandling` utilities for Accept header negotiation in tests.

### Changed
- Program test `ensureObjectReady` now performs active cleanup (deletes existing program) instead of silently skipping when test object already exists.
- Program update test uses different source code for create vs update to verify actual content change.
- Cross-platform `npm run clean` — uses Node.js `fs.rmSync` instead of `rm -rf`.
- Simplified `npm test` script for Windows compatibility.

## [1.2.2] - 2026-02-27

### Removed
- Removed `resolveTransport` function (added in 1.2.0). The approach based on `/sap/bc/adt/cts/transportchecks` with `OPERATION` field was unreliable. Transport resolution is now handled at the MCP server level via `ListTransports` tool.

## [1.2.1] - 2026-02-27

### Fixed
- Removed `$TMP` hardcode from `isLocal` check in `resolveTransport`.

## [1.2.0] - 2026-02-27

### Added
- `resolveTransport(connection, params)` — resolve transport request for any object via `/sap/bc/adt/cts/transportchecks`.

## [1.1.1] - 2026-02-27

### Fixed
- Added missing URI mappings in `buildObjectUri` for group activation: DCLS/DL, TTYP, SRVD, SRVB, DDLX, BDEF, ENHO, FUGR/FF. Without them, `activateObjectsGroup` generated invalid ADT URIs causing "Failed to extract activation run ID" errors.
- `IObjectReference` gains optional `parentName` for function module activation (FUGR/FF requires group name in URI).

## [1.1.0] - 2026-02-27

### Added
- Full CRUD support for Access Control objects (DCLS/DL): `getAccessControl()` with `create`, `read`, `readMetadata`, `update`, `delete`, `activate`, `check`, `lock`, `unlock`.
- `AdtClientBatch` for batching multiple read operations into a single HTTP request.

## [1.0.6] - 2026-02-27

### Fixed
- Added missing `corrNr` query parameter to metadata extension update operation (`updateMetadataExtension`). Without it, SAP rejected updates in transportable packages with "Parameter corrNr could not be found" (HTTP 400).

## [1.0.5] - 2026-02-27

### Fixed
- Fixed `typeName` mapping for data elements with `typeKind: 'domain'`. The create and update operations incorrectly used `data_type` (underlying ABAP type, e.g. `CHAR`) instead of `type_name` (domain name, e.g. `ZD_ACTION`) for the `<dtel:typeName>` XML element, causing "No active domain CHAR available" errors.

## [1.0.4] - 2026-02-26

### Fixed
- Added missing `corrNr` query parameter to package update operation (`updatePackage`). Without it, SAP rejected package updates in transportable packages with "Parameter corrNr could not be found" (HTTP 400).

## [1.0.3] - 2026-02-26

### Fixed
- Added missing `corrNr` query parameter to create operations for `metadataExtension`, `behaviorDefinition`, and `serviceBinding`. Without it, SAP rejected creation of these objects in transportable packages with "Parameter corrNr could not be found" (HTTP 400).

## [1.0.2] - 2026-02-26

### Changed
- Removed redundant post-create `getPackage()` read from `AdtPackage.create()`. Packages are containers with no active/inactive versioning — the final read caused transient 404 errors when SAP had not yet committed the object to the database.

## [1.0.1] - 2026-02-26

### Added
- Added `recordChanges` option to `IPackageConfig` (and `record_changes` to `ICreatePackageParams`) for controlling the `pak:recordChanges` XML attribute on package create and update operations. Previously hardcoded to `"false"`, which prevented transport recording on created packages.

## [1.0.0] - 2026-02-26

### Added
- **Batch request infrastructure** — new `src/batch/` module providing reusable multipart/mixed batch support for SAP ADT.
- `AdtClientBatch` — batch-capable wrapper around `AdtClient`; record multiple independent read operations and execute them in a single HTTP round-trip via `POST /sap/bc/adt/debugger/batch`.
- `AdtRuntimeClientBatch` — same batch pattern for `AdtRuntimeClient`.
- `BatchRecordingConnection` — `IAbapConnection` proxy that intercepts `makeAdtRequest()` calls, collects them as batch parts, and resolves deferred promises after batch execution.
- `buildBatchPayload()` / `parseBatchResponse()` — multipart/mixed request builder and response parser, extracted from debugger-only helpers into a reusable module.
- Integration tests for batch operations: class+program, class+interface, domain+dataElement+structure metadata reads, reset, and sequential batch executions.
- Batch types exported from package root: `IBatchRequestPart`, `IBatchPayload`, `IBatchResponsePart`.

### Changed
- Refactored `src/runtime/debugger/abap.ts` to import shared `createBatchBoundary()` and `createRequestId()` from `src/batch/buildBatchPayload.ts` instead of local duplicates.
- Added explicit default `Accept` headers to `getDomain()` and `getDataElement()` read functions — required by the SAP ADT batch endpoint for inner GET requests.

### Fixed
- Fixed `.trim()` bug in `buildDebuggerBatchPayload()` that stripped the required `\r\n\r\n` terminator from inner HTTP requests.

### Documentation
- Updated README with `AdtClientBatch` / `AdtRuntimeClientBatch` in Features, Architecture, and Quick Start sections.
- Added full `AdtClientBatch` API reference to `docs/usage/CLIENT_API_REFERENCE.md` (batch-safe operations, sequential batches, reset).
- Updated `docs/README.md` index with batch client entries.

## [0.3.22] - 2026-02-20

### Added
- Added runtime dump read `view` option to `getRuntimeDumpById(dumpId, { view })` for `default`, `summary`, and `formatted` payloads.
- Added integration flow that can generate an artificial dump (division by zero), discover generated dump IDs, and validate dump reads end-to-end.
- Added explicit integration logs for dump discovery source and selected dump read mode.

### Changed
- Aligned runtime dump endpoints with ADT behavior:
  - list via `/sap/bc/adt/runtime/dumps`
  - read by ID via `/sap/bc/adt/runtime/dump/{id}` with `summary`/`formatted` views.
- Aligned dump read `Accept` headers with ADT request patterns.
- Simplified runtime dump consumer API to two operations:
  - list dumps
  - read dump by ID with `view` selector.
- Added `X-sap-adt-profiling: server-time` header for class profiling execution parity with program profiling.
- Stabilized executor integration tests for class/program run output matching and profiling startup timing.

## [0.3.21] - 2026-02-19

### Added
- Added program execution API (`runProgram`) for ADT endpoint `POST /sap/bc/adt/programs/programrun/{program}`.
- Added `ProgramExecutor` implementing `IExecutor` with methods `run`, `runWithProfiler`, and `runWithProfiling`.
- Added `AdtExecutor.getProgramExecutor()` and exported related program executor types from package root.
- Added integration coverage for program execution with profiling via `ProgramExecutor`.
- Added `execute_program` integration test configuration in `test-config.yaml` and template.

### Changed
- Updated documentation to include `AdtExecutor` execution API and program execution examples.

## [0.3.20] - 2026-02-19

### Changed
- Updated runtime dependency `fast-xml-parser` to `^5.3.6`.
- Updated dev dependency `@biomejs/biome` to `^2.4.2`.
- Updated dev dependency `@mcp-abap-adt/connection` to `^1.1.0`.
- Updated dev dependency `@types/node` to `^25.3.0`.
- Updated dev dependency `dotenv` to `^17.3.1`.

## [0.3.19] - 2026-02-19

### Added
- Added unit coverage for runtime profiler trace helpers and endpoint request builders (`runtime/traces/profiler`).
- Added unit coverage for runtime memory snapshot request builders and validation (`runtime/memory/snapshots`).
- Added integration tests for runtime dumps with YAML-driven configuration and standardized test progress logging.

### Changed
- Removed runtime memory snapshots from public `AdtRuntimeClient` API surface for this release.
- Kept memory snapshots as internal/runtime-level implementation pending additional ADT compatibility validation.

### Documentation
- Extended runtime API reference with contract-level sections for profiling and dumps; documented memory snapshots as deferred.
- Added runtime test coverage snapshot to architecture documentation.

## [0.3.18] - 2026-02-19

### Added
- Added dedicated integration coverage for `ServiceBinding` lifecycle (`create -> publish -> unpublish -> delete`) with YAML-driven configuration.
- Added automatic test subpackage provisioning for ServiceBinding integration tests, including parent package metadata inheritance.

### Changed
- Refactored service binding API to `AdtServiceBinding` object model and added `AdtClient.getServiceBinding()`.
- Aligned service binding operations with CRUD-style object flow; `create` now performs create + generate lifecycle.
- Updated publish/unpublish implementation for service bindings to use `POST` with ADT `objectReferences` payload and ADT-compatible headers/content types.
- Updated integration test run hints to Jest 30 syntax (`--testPathPatterns`).

### Fixed
- Added Service Binding delete operation via ADT deletion endpoint (`POST /sap/bc/adt/deletion/delete`) with pre-delete unpublish handling when binding is published.
- Improved ServiceBinding integration reliability for package creation/read eventual consistency (409/404 recovery + retry reads).

### Documentation
- Updated architecture documentation to describe ServiceBinding CRUD/lifecycle behavior and publication-state transitions.

## [0.3.17] - 2026-02-18

### Added
- Added `IAdtService` facade and typed service-binding lifecycle operations for RAP BO service flows outside generic CRUD.
- Added support for reading available service binding types via ADT (`GET /sap/bc/adt/businessservices/bindings/bindingtypes`).
- Added dedicated methods for service binding create/read/update/check/activate/generate and create+generate orchestration.

### Changed
- Updated dependency `@mcp-abap-adt/interfaces` to `^2.6.0`.
- Documented service lifecycle architecture and separation from `IAdtObject` CRUD in architecture docs.

## [0.3.16] - 2026-02-15

### Changed
- Renamed runtime dump read API to ID-based access: `getRuntimeDumpById(dumpId)` now builds ADT dump URL internally and rejects URI input.


## [0.3.15] - 2026-02-15

### Added
- Added `AdtClientsWS` realtime facade for `IWebSocketTransport` with request/response correlation and event handlers.
- Added `DebuggerSessionClient` over WS operations (`debugger.listen`, `debugger.attach`, `debugger.detach`, `debugger.step`, `debugger.getStack`, `debugger.getVariables`).
- Exported WS transport interfaces and new WS clients from package root.
- Added runtime dumps API (`listRuntimeDumps`, `listRuntimeDumpsByUser`, `getRuntimeDumpById`) to `AdtRuntimeClient`.
- Added `AdtRuntimeClientExperimental` and moved AMDP debugger/data preview APIs there as in-progress APIs.
- Added ABAP debugger batch step API for `stepInto`, `stepOut`, `stepContinue` via `POST /sap/bc/adt/debugger/batch` with multipart payloads.
- Added unit tests for runtime dumps and debugger batch-step payload/execution.

### Changed
- Updated dependency `@mcp-abap-adt/interfaces` to `^2.4.0`.
- Restricted step actions in `executeDebuggerAction`: `stepInto`, `stepOut`, and `stepContinue` must use debugger batch API.
- Updated README and docs to describe stable vs experimental runtime clients and debugger batch endpoint usage.

## [0.3.14] - 2025-12-30

### Added
- **Where-Used List**: `AdtUtils.getWhereUsedList()` returns parsed where-used references with structured `IWhereUsedListResult` instead of raw XML. Supports `enableAllTypes` for Eclipse "select all" behavior and optional `includeRawXml` for debugging.
- **Types**: New `IWhereUsedReference`, `IWhereUsedListResult`, `IGetWhereUsedListParams` interfaces for typed where-used results

## [0.3.13] - 2025-12-29

### Added
- **Package contents list**: `AdtUtils.getPackageContentsList()` returns a flat `IPackageContentItem[]` for a package, optionally traversing subpackages and preserving descriptions so callers can build tables or reports.
- **Scripts**: Added `scripts/read-package-contents.ts` so consumers can dump package contents as a table, tree, or JSON output via CLI options such as `--subpackages`, `--json`, `--tree`, and `--depth`.

## [0.3.12] - 2025-12-29

### Fixed
- **Package Hierarchy**: `getPackageHierarchy()` now fetches all object types (classes, interfaces, tables, views, etc.) by querying each `NODE_ID` from `OBJECT_TYPES` response; previously only subpackages were returned

### Added
- **Script**: `npm run package:contents <PACKAGE_NAME>` - displays package hierarchy tree with all objects

## [0.3.11] - 2025-12-29

### Added
- **CLAUDE.md**: Added project guidance file for Claude Code with build/test commands, architecture overview, and code standards

## [0.3.10] - 2025-12-29

### Changed
- **Read Versions**: Source and metadata reads now support explicit `version` selection while allowing no-version reads for initial post-create state.
- **Flow Tests**: Added active/inactive read verification with XML-aware comparison for XML-based objects.
- **Test Logging**: Renamed builder test logger utilities and removed “Builder” labels from test logs.

## [0.3.9] - 2025-12-27

### Changed
- **Docs**: Clarified where-used flow in `AdtUtils` (scope fetch, optional scope edit, search execution) and cross-linked usage/architecture notes

## [0.3.8] - 2025-12-27

### Fixed
- **Lint**: Addressed lint errors

## [0.3.7] - 2025-12-27

### Changed
- **Types**: Added strict `AdtObjectType`/`AdtSourceObjectType` for `AdtUtils.readObjectMetadata()` and `readObjectSource()`; exported via public API

## [0.3.6] - 2025-12-27

### Changed
- **Lint**: Applied Biome fixes during publish build (logger call formatting in class/enhancement/function group/interface; shared exports/package hierarchy typing cleanup)

## [0.3.5] - 2025-12-27

### Changed
- **Package Hierarchy**: `AdtUtils.getPackageHierarchy()` now builds tree via node structure traversal with recursive subpackages and `includeSubpackages`/`maxDepth` options
- **Package Hierarchy Output**: Nodes now include `is_package`, `codeFormat`, `type`, and `restoreStatus`

## [0.3.4] - 2025-12-27

### Changed
- **Create Results**: Populate `createResult` for function modules, views, structures, tables, table types, service definitions, metadata extensions, transports, and unit tests (including CDS unit tests)
- **Test Logging**: Unit test and transport integration tests now log steps consistently
- **Docs**: Documented create/read result fields in usage and README

## [0.3.3] - 2025-12-27

### Added
- **Accept Negotiation**: Optional auto-correction of `Accept` headers on 406 responses, with per-endpoint caching
- **Read Options**: `accept` override in read/readMetadata options for targeted header control
- **Package Hierarchy**: `AdtUtils.getPackageHierarchy()` builds a package/subpackage/object tree from virtual folders
- **Tests**: New integration coverage for package hierarchy and read Accept handling (corrected + uncorrected flows)

### Changed
- **Clients**: `AdtClient` and `AdtRuntimeClient` support `enableAcceptCorrection` and respect `ADT_ACCEPT_CORRECTION`
- **Read Endpoints**: Read/readMetadata helpers accept optional `accept` overrides and use updated defaults for class includes

## [0.3.2] - 2025-12-27

### Changed
- **Tooling**: Renamed ADT object mapping generator to entities (`adt:entities`, `tools/adt-object-entities.js`)
- **Docs**: Renamed generated output to `docs/usage/ADT_OBJECT_ENTITIES.md`

## [0.3.1] - 2025-12-27

### Changed
- **Builderless API**: Removed Builder classes and legacy ReadOnly/Crud clients in favor of `AdtClient` + `Adt*` objects
- **Shared Utilities**: Moved metadata/source helpers into `AdtUtils` and routed internal read helpers through it
- **Tests**: Standardized read tests to include `readMetadata`, added flow read-metadata step, and restored skip logging
- **Accept Headers**: Updated metadata Accept headers for interface, function module, table, and view endpoints
- **Docs**: Refreshed architecture/usage/dev docs and removed archived/deprecated documentation

## [0.3.0] - 2025-12-26

### Changed
- **Public API**: Root exports now include only client classes plus supporting types; internal builders and low-level utilities are no longer exported
- **Docs**: Updated README to reflect client-only public surface and usage

## [0.2.11] - 2025-12-26

### Added
- **Tooling**: `tools/adt-object-handlers.js` generator for ADT object handlers
- **Docs**: Generated `docs/usage/ADT_OBJECT_HANDLERS.md`

### Changed
- **Tools README**: Updated usage documentation for ADT handlers
- **Scripts**: Use `adt:handlers` for the new generator

### Removed
- **Legacy DDIC Handlers**: Removed outdated DDIC handlers documentation and alias

## [0.2.10] - 2025-12-26

### Fixed
- **Linter**: Formatting cleanup

## [0.2.9] - 2025-12-26

### Changed
- **Discovery Tooling**: `discovery-to-markdown` now uses `AdtUtils.discovery()`, writes pretty-printed XML next to `discovery.md`, and lists `Accept` media types per collection when present
- **Node Structure Request**: Send Eclipse-compatible ASX payload and add `parent_tech_name`, plus prefer `application/vnd.sap.as+xml` media type with fallback to existing vendor XML for node structure reads
- **Object Structure Accept**: Prefer `application/vnd.sap.adt.projectexplorer.objectstructure+xml` media type for object structure reads
- **TableType Update**: Use `adtcore:version="active"` to avoid create conflicts during update

### Fixed
- **Test Diagnostics**: Treat 406 responses as Accept-header issues and surface them consistently across shared integration tests

### Added
- **ADT Discovery**: Added `AdtUtils.discovery()` with required headers and request id generation
- **Discovery Tests**: Added integration test for ADT discovery in shared utils

## [0.2.8] - 2025-12-25

### Added
- **Shared Tests**: Added BaseTester-based integration tests for `getObjectStructure` and `fetchNodeStructure` with YAML-driven params

### Changed
- **ADT Headers**: Prefer vendor media types for objectstructure/nodestructure Accept headers with XML fallback

### Fixed
- **Test Stability**: Soft-skip 406 responses for objectstructure/nodestructure tests when endpoints are not supported

## [0.2.7] - 2025-12-24

### Fixed
- **Header Parsing**: Normalize ADT response headers before extracting run IDs and lock handles to handle non-string header values

## [0.2.6] - 2025-12-22

### Added
- **Biome Linter**: Replaced ESLint with Biome for faster, more efficient linting
  - 10-20x faster than ESLint
  - Single tool for linting and formatting (replaces ESLint + Prettier)
  - Added `biome.json` configuration with TypeScript rules
  - New npm scripts: `lint`, `lint:check`, `format`
  - Integrated into build process to catch issues before compilation

- **CI Workflow**: Added GitHub Actions CI workflow for continuous validation
  - Runs on every push and pull request
  - Validates with Biome lint (error-level diagnostics only)
  - Type checks with TypeScript compiler
  - Verifies successful build
  - Faster CI runs thanks to Biome performance

### Fixed
- **Code Quality**: Fixed 7 lint errors found by Biome
  - Removed unreachable code after throw statements in `AdtMetadataExtension.ts`
  - Fixed `forEach` callbacks returning values in `snapshots.ts`
  - Added explicit type for `RegExpExecArray | null` in `tableContents.ts`
  - Fixed assignment in expression pattern in while loop

- **TypeScript Errors**: Fixed 5 compilation errors
  - Added missing `logger` property in `AdtRuntimeClient`
  - Added missing `adtView` property in `AdtCdsUnitTest`
  - Added missing `logger` property in `AdtUtils`
  - Fixed `string | undefined` type issues in `create.ts` and `update.ts` for data elements

### Changed
- **Build Process**: Build now runs Biome lint before TypeScript compilation
  - Catches lint issues early in development
  - Ensures code quality standards before type checking
  - Prevents common errors from reaching production

## [0.2.5] - 2025-12-21

### Changed
- **Dependencies**: Updated `@mcp-abap-adt/interfaces` to `^0.2.5`
  - Compatible with simplified `IAbapConnection` interface
  - No breaking changes for adt-clients consumers

## [0.2.4] - 2025-01-27

### Changed
- **WhereUsed (Breaking Change)**: Refactored to match Eclipse ADT two-step workflow
  - **Step 1**: `getWhereUsedScope()` - Fetches scope configuration with payload (POST `/scope`)
  - **Step 2**: `getWhereUsed()` - Executes search with scope XML (POST `/usageReferences`)
  - Payload is now transmitted between requests for accurate results
  - `scopeXml` parameter is optional in `getWhereUsed()` - auto-fetches default scope if not provided

### Added
- **WhereUsed Scope Modification**: New `modifyWhereUsedScope()` helper function
  - `enableAll` - Select all object types (simulates Eclipse "select all")
  - `enableOnly` - Enable only specific types, disable others
  - `enable` / `disable` - Modify individual type selections
  - Allows fine-grained control over which object types to search

### Implementation Details
- Two usage patterns supported:
  1. **Simple**: Call `getWhereUsed()` alone - automatically fetches default scope
  2. **Advanced**: Fetch scope with `getWhereUsedScope()`, modify with `modifyWhereUsedScope()`, pass to `getWhereUsed()`
- SAP systems may return different default scope selections - this is expected behavior
- Comprehensive test coverage with 5 integration tests validating both usage patterns

## [0.2.3] - 2025-01-27

### Added
- **AdtRuntimeClient**: New standalone runtime operations client for debugging, tracing, memory analysis, and logs
  - Standalone client class (similar to `ReadOnlyClient` and `CrudClient`)
  - Independent from `AdtClient` - can be used separately
  - Centralized access to all runtime-related ADT operations
  - Clear separation from CRUD operations (via `IAdtObject`) and utility functions (via `AdtUtils`)
  - Located in `clients/AdtRuntimeClient.ts` (not in `runtime/`)
  - See [Architecture Documentation](docs/architecture/ARCHITECTURE.md) for details

- **Memory Snapshots Module** (`runtime/memory/`): Complete memory dump analysis functionality
  - 10 functions: `listSnapshots`, `getSnapshot`, `getSnapshotRankingList`, `getSnapshotDeltaRankingList`, `getSnapshotChildren`, `getSnapshotDeltaChildren`, `getSnapshotReferences`, `getSnapshotDeltaReferences`, `getSnapshotOverview`, `getSnapshotDeltaOverview`
  - Support for ranking lists, children, references, and overview with delta comparison
  - All functions accessible via `AdtRuntimeClient` class methods

- **ABAP Profiler Traces Module** (`runtime/traces/profiler.ts`): ABAP profiler trace management
  - 8 functions: `listTraceFiles`, `getTraceParameters`, `getTraceParametersForCallstack`, `getTraceParametersForAmdp`, `listTraceRequests`, `getTraceRequestsByUri`, `listObjectTypes`, `listProcessTypes`
  - Support for trace files, parameters (general, callstack aggregation, AMDP), requests, and metadata
  - All functions accessible via `AdtRuntimeClient` class methods

- **ABAP Debugger (Standard) Module** (`runtime/debugger/abap.ts`): Standard ABAP debugger for classes, programs, function modules
  - 20 functions covering session management, memory/system areas, breakpoints, variables, actions, stack, watchpoints, batch requests
  - Functions: `launchDebugger`, `stopDebugger`, `getDebugger`, `getMemorySizes`, `getSystemArea`, `synchronizeBreakpoints`, `getBreakpointStatements`, `getBreakpointMessageTypes`, `getBreakpointConditions`, `validateBreakpoints`, `getVitBreakpoints`, `getVariableMaxLength`, `getVariableSubcomponents`, `getVariableAsCsv`, `getVariableAsJson`, `getVariableValueStatement`, `executeDebuggerAction`, `getCallStack`, `insertWatchpoint`, `getWatchpoints`, `executeBatchRequest`
  - All functions accessible via `AdtRuntimeClient` class methods

- **AMDP Debugger Module** (`runtime/debugger/amdp.ts`): AMDP (ABAP Managed Database Procedures) debugger
  - 12 functions: `startAmdpDebugger`, `resumeAmdpDebugger`, `terminateAmdpDebugger`, `getAmdpDebuggee`, `getAmdpVariable`, `setAmdpVariable`, `lookupAmdp`, `stepOverAmdp`, `stepContinueAmdp`, `getAmdpBreakpoints`, `getAmdpBreakpointsLlang`, `getAmdpBreakpointsTableFunctions`
  - Support for debugger session management, debuggee operations, variable operations, lookup, step operations, breakpoints
  - All functions accessible via `AdtRuntimeClient` class methods

- **AMDP Data Preview Module** (`runtime/debugger/amdpDataPreview.ts`): Data preview during AMDP debugging
  - 2 functions: `getAmdpDataPreview`, `getAmdpCellSubstring`
  - Support for data preview and cell substring retrieval during AMDP debugging
  - All functions accessible via `AdtRuntimeClient` class methods

- **Cross Trace Module** (`runtime/traces/crossTrace.ts`): Cross-system trace analysis
  - 5 functions: `listCrossTraces`, `getCrossTrace`, `getCrossTraceRecords`, `getCrossTraceRecordContent`, `getCrossTraceActivations`
  - Support for listing traces with filters, getting trace details (with optional sensitive data), records, record content, and activations
  - All functions accessible via `AdtRuntimeClient` class methods

- **Application Logs Module** (`runtime/applicationLog/`): Application log object operations
  - 3 functions: `getApplicationLogObject`, `getApplicationLogSource`, `validateApplicationLogName`
  - Support for reading application log object properties, source code, and validation
  - All functions accessible via `AdtRuntimeClient` class methods

- **ATC Logs Module** (`runtime/atc/`): ATC (ABAP Test Cockpit) log operations
  - 2 functions: `getCheckFailureLogs`, `getExecutionLog`
  - Support for reading ATC check failure logs and execution logs
  - All functions accessible via `AdtRuntimeClient` class methods

- **Feed Reader Module** (`runtime/feeds/`): Feed repository access
  - 2 functions: `getFeeds`, `getFeedVariants`
  - Support for accessing feed repository and feed variants
  - All functions accessible via `AdtRuntimeClient` class methods

- **ST05 Performance Trace Module** (`runtime/traces/st05.ts`): Performance trace (ST05) operations
  - 2 functions: `getSt05TraceState`, `getSt05TraceDirectory`
  - Support for getting trace state and trace directory information
  - All functions accessible via `AdtRuntimeClient` class methods

- **DDIC Activation Graph Module** (`runtime/ddic/activationGraph.ts`): DDIC activation dependency graph with logs
  - 1 function: `getActivationGraph`
  - Support for getting activation dependency graph with logs
  - Accessible via `AdtRuntimeClient.getDdicActivationGraph()` method

- **Lock/Unlock Methods in IAdtObject Interface**: Added `lock()` and `unlock()` methods to `IAdtObject` interface
  - All `Adt*` classes now implement `lock()` and `unlock()` methods for explicit lock management
  - `lock()` returns lock handle that can be reused for multiple operations
  - `unlock()` accepts lock handle and releases the lock
  - Enables consumers to manage locks explicitly without going through full CRUD workflow
  - See [Architecture Documentation](docs/architecture/ARCHITECTURE.md) for usage examples

- **Lock Handle Support in Update Operations**: Added `lockHandle` parameter to `IAdtOperationOptions` interface
  - When `lockHandle` is provided in `update()` options, the full lock-check-update-unlock chain is bypassed
  - Only the low-level update operation is performed, allowing for more flexible update scenarios
  - Enables consumers to manage locks externally and perform multiple updates with the same lock handle
  - Prevents unnecessary lock/unlock operations when lock is already held

- **TestConfigResolver**: New centralized parameter resolution system for test configuration
  - Centralizes logic for resolving test parameters from `test-config.yaml`
  - Supports parameter overrides at test case level, global environment defaults, and environment variables
  - Handles `standard_objects` registry lookup with environment-specific fallbacks
  - Integrated into `BaseTester` to ensure all tests benefit from robust parameter resolution
  - Provides consistent parameter resolution across all integration tests

- **Conditional Test Execution**: Added `available_in` parameter for environment-specific test execution
  - Test cases can specify `available_in: ["cloud"]` or `available_in: ["onprem"]` to conditionally enable/disable tests
  - `BaseTester` automatically skips tests that are not available for the current environment
  - Enables tests to adapt to environment-specific limitations (e.g., table reading on cloud vs on-premise)
  - Applied to `table_contents`, `sql_query`, and `read_table` tests to handle cloud/on-premise differences

- **ReadOnlyClient Integration Tests**: Added comprehensive integration tests for `ReadOnlyClient` methods
  - Tests use `standard_objects` registry from `test-config.yaml` for environment-specific object names
  - Tests conditionally adapt to cloud/on-premise environments (e.g., CDS views for cloud, tables for on-premise)
  - Proper logging of test stages using `logBuilderTestStart`, `logBuilderTestSuccess`, `logBuilderTestError`
  - Tests located in `src/__tests__/integration/readonly/ReadOnlyClient.test.ts`

### Changed
- **Architecture Refactoring**: Separated runtime operations from utility functions
  - Runtime operations (debugging, tracing, memory analysis, logs) moved to standalone `AdtRuntimeClient` class
  - Utility functions (search, where-used, includes, enhancements) remain in `AdtUtils` class
  - Clear separation of concerns: CRUD operations (`IAdtObject`), utility functions (`AdtUtils`), runtime operations (`AdtRuntimeClient`)
  - `AdtRuntimeClient` is now an independent client (like `ReadOnlyClient` and `CrudClient`), not a factory method of `AdtClient`
  - `AdtClient` now provides two factory methods: `getClass()`, `getUtils()` (runtime operations via separate `AdtRuntimeClient`)

- **Module Organization**: Reorganized runtime modules into logical structure
  - `runtime/memory/` - Memory snapshots analysis
  - `runtime/traces/` - Tracing operations (profiler, cross-trace, ST05)
  - `runtime/debugger/` - Debugging operations (ABAP debugger, AMDP debugger)
  - `runtime/applicationLog/` - Application log operations
  - `runtime/atc/` - ATC log operations
  - `runtime/feeds/` - Feed reader operations

- **Update Method Behavior**: Enhanced `update()` methods in all `Adt*` classes to support `lockHandle` parameter
  - When `lockHandle` is provided, `setSessionType('stateful')` is not called (session already stateful)
  - Lock-check-unlock chain is bypassed, only low-level update is performed
  - Enables more flexible update scenarios where locks are managed externally
  - Applied to all `Adt*` classes: `AdtClass`, `AdtProgram`, `AdtInterface`, `AdtLocalTypes`, `AdtLocalTestClass`, `AdtLocalMacros`, `AdtLocalDefinitions`, `AdtBehaviorImplementation`, etc.

- **Test Parameter Resolution**: Migrated all integration tests to use `TestConfigResolver` for parameter resolution
  - Tests now use centralized parameter resolution instead of manual YAML parsing
  - Consistent parameter resolution priority: test case → global environment → default values
  - Better support for environment-specific parameters and standard objects lookup
  - Improved test maintainability and consistency

- **Documentation Updates**: Comprehensive documentation review and updates
  - Translated `CHECK_LOCAL_TEST_CLASS.md` from Ukrainian to English (project language is English)
  - Updated `ARCHITECTURE.md` to reflect `lock()`/`unlock()` methods and `lockHandle` parameter
  - Updated `CLIENT_API_REFERENCE.md` to reflect current client architecture
  - Updated `BUILDER_TEST_PATTERN.md` to reflect `BaseTester` and `AdtClient` usage
  - Updated `TEST_CONFIG_SCHEMA.md` to document `TestConfigResolver` and `available_in` parameter
  - Updated `OPERATION_DELAYS.md` and `OPERATION_DELAYS_SUMMARY.md` to reflect current test structure

### Fixed
- **Test Paths**: Fixed import paths in integration tests after refactoring test structure
  - Updated paths from `../../../` to `../../../../` for `clients/`, `core/`, and `utils/` imports in `integration/core/` tests
  - Updated paths from `../../helpers/` to `../../../helpers/` for helper imports in `integration/core/` tests
  - Updated paths from `../../helpers/test-helper` to `../../../helpers/test-helper` for test helper imports
  - Fixed `.env` file path resolution in `test-helper.js` to correctly find project root using `package.json` lookup
  - All integration tests now correctly locate YAML configuration files and environment variables

- **TableType Implementation**: Fixed TableType operations to correctly handle XML-based entity
  - Fixed `getTableTypeMetadata` Accept header from `application/vnd.sap.adt.tabletypes.v2+xml` to `application/vnd.sap.adt.tabletype.v1+xml` (removed 's' suffix, matching create/update headers)
  - TableType is now correctly implemented as XML-based entity (like Domain and DataElement), not DDL-based
  - Create operation creates empty TableType; `rowType` is added via update operation
  - Update operation uses proper XML format with `rowType`, `packageRef`, `description`, and `valueHelps` sections
  - Enhanced error logging in `getTableTypeMetadata` and `updateTableType` to output full server response details for debugging HTTP 406 errors

- **Test Logging**: Enhanced test step logging in shared integration tests
  - Added `logBuilderTestStep` calls with `testsLogger` to all shared integration tests for better visibility
  - Updated `logBuilderTestStep` function to accept optional logger parameter for consistent logging
  - All shared tests (`search.test.ts`, `whereUsed.test.ts`, `readMetadata.test.ts`, `readSource.test.ts`, `sqlQuery.test.ts`, `tableContents.test.ts`, `groupActivation.test.ts`) now log execution steps
  - Tests now use `createTestsLogger()` for consistent logging via `DEBUG_ADT_TESTS` environment variable
  - Improved test output visibility when running integration tests in shared folder

- **Circular Dependency**: Fixed circular dependency in `ReadOnlyClient` and `CrudClient`
  - Changed import in `src/core/interface/update.ts` from `import { encodeSapObjectName } from "../.."` to `import { encodeSapObjectName } from '../../utils/internalUtils'`
  - Prevents `TypeError: Class extends value undefined is not a constructor or null` errors
  - Resolves dependency cycle: `src/index.ts` → `ReadOnlyClient` → `CrudClient` → `core/interface/update.ts` → `src/index.ts`

- **Session Management**: Fixed incorrect `setSessionType('stateful')` calls in low-level update paths
  - `setSessionType('stateful')` is now only called immediately before lock operations
  - Not called in low-level update paths where `lockHandle` is already provided
  - Ensures proper session management and prevents unnecessary session state changes

- **Test Logging**: Improved test logging for `ReadOnlyClient` integration tests
  - Added explicit logging of test stages (`logBuilderTestStart`, `logBuilderTestSuccess`, `logBuilderTestError`)
  - Tests now properly log execution steps instead of silently skipping
  - Better visibility into test execution and failures

### Documentation
- Updated `ARCHITECTURE.md` with complete `AdtRuntimeClient` class documentation
- Added runtime modules structure and method descriptions
- Updated usage examples to show `AdtRuntimeClient` as standalone client
- See [DEBUG_TRACE_DUMP_FEED_ENDPOINTS Roadmap](docs/development/roadmaps/DEBUG_TRACE_DUMP_FEED_ENDPOINTS.md) for implementation details

## [0.2.2] - 2025-12-16

### Changed
- Dependency bump: `@mcp-abap-adt/interfaces` to `^0.1.17` for basic auth support in IConnectionConfig
- Package now supports basic authentication (username/password) for on-premise systems through updated interfaces

## [0.2.2] - 2025-12-13

### Fixed
- **Integration tests**: Fixed `TypeError: Cannot read properties of undefined (reading 'getConfig')` in all integration tests using `BaseTester`
  - Added `if (!hasConfig || !tester)` guard check before calling `tester.getConfig()` in all test files
  - Affected files: `Class.test.ts`, `Domain.test.ts`, `Table.test.ts`, `Interface.test.ts`, `Program.test.ts`, `Structure.test.ts`, `FunctionGroup.test.ts`, `BehaviorDefinition.test.ts`, `ServiceDefinition.test.ts`, `Package.test.ts`, `View.test.ts`, `BehaviorImplementation.test.ts`, `FunctionModule.test.ts`
  - Tests now properly skip when SAP configuration is unavailable instead of throwing errors
  - Prevents test failures when `tester` is undefined due to failed `beforeAll` setup

## [0.2.1] - 2025-12-13

### Changed
- Dependency bumps: `@mcp-abap-adt/interfaces` → `^0.1.16`, `@mcp-abap-adt/logger` → `^0.1.3` (align with latest interfaces/logger releases)

## [0.2.0] - 2025-12-12

### Added
- **High-Level CRUD API (AdtClient)**: Complete implementation of high-level CRUD operations
  - `AdtClient` class with factory methods for all 17 object types (`getClass()`, `getProgram()`, `getInterface()`, etc.)
  - `IAdtObject` interface for unified CRUD operations across all object types
  - Automatic operation chains: validate → create → check → lock → update → unlock → activate
  - Automatic error handling and resource cleanup (unlock, delete on failure)
  - Consistent session management (stateful only for lock/update/unlock operations)
  - All 17 object types supported: Class, Program, Interface, Domain, DataElement, Structure, Table, View, FunctionGroup, FunctionModule, Package, ServiceDefinition, BehaviorDefinition, BehaviorImplementation, MetadataExtension, UnitTest, Request
  - See [High-Level CRUD Roadmap](docs/development/roadmaps/HIGH_LEVEL_CRUD_ROADMAP.md) for details
- **AdtUtils Class**: Utility functions wrapper for cross-cutting ADT functionality
  - `AdtClient.getUtils()` method provides access to utility functions
  - Methods: `searchObjects()`, `getWhereUsed()`, `getInactiveObjects()`, `activateObjectsGroup()`, `readObjectSource()`, `readObjectMetadata()`, `getSqlQuery()`, `getTableContents()`, etc.
  - Separation of CRUD operations (via `IAdtObject`) and utility functions (via `AdtUtils`)
  - Stateless utility class (no state management)
- **Test Migration**: All integration tests migrated to `AdtClient` API
  - 15/15 object-specific integration tests migrated to `AdtClient`
  - 7/7 shared integration tests migrated to `AdtClient`/`AdtUtils`
  - All tests support cleanup parameters (`cleanup_after_test`, `skip_cleanup`)
  - Overall test migration: 22/24 applicable tests (92%)
- **BaseTester Migration**: Integration tests refactored to use `BaseTester` for consistency and maintainability
  - 13/15 object-specific integration tests migrated to `BaseTester` (87%)
  - Standardized CRUD workflow testing with `BaseTester.flowTestAuto()` and `BaseTester.readTest()`
  - Reduced boilerplate code and improved test consistency
  - `Class.test.ts`: Migrated to `BaseTester`, removed ABAP Unit test execution logic (run, getStatus, getResult)
  - `View.test.ts`: Migrated to `BaseTester`, removed CDS Unit test workflow (validate, create, run, getStatus, getResult)
  - Unit tests will be handled in separate test files for better separation of concerns
  - See [BaseTester Migration Roadmap](docs/development/roadmaps/BASE_TESTER_MIGRATION.md) for details
- **Long Polling Support**: Added `withLongPolling` parameter to all read operations for better reliability and performance
  - `IAdtObject.read()`, `readMetadata()`, and `readTransport()` methods now support `withLongPolling` option
  - `IBuilder.read()` methods now support `withLongPolling` option
  - All `AdtObject` implementations automatically use long polling in `create()` and `update()` methods to wait for object readiness
  - Replaces fixed timeouts with server-driven waiting, providing faster and more reliable operations
  - See [Migration Guide](docs/development/archive/roadmaps/MIGRATION_TIMEOUT_TO_LONG_POLLING.md) for details
- **ADT Discovery Script**: Added `discovery-to-markdown.ts` tool for generating ADT endpoint documentation
  - Fetches ADT discovery endpoint (`/sap/bc/adt/discovery`) and converts XML to readable markdown
  - Usage: `npm run discovery:markdown` or `npm run discovery:markdown -- --output custom-discovery.md`
  - See [Tools Documentation](tools/README.md) for details
  - Output: `docs/architecture/discovery.md` (default) or custom path
- **Long-polling test helper**: `scripts/test-long-polling-read.ts` for targeted validation of long-polling read flows

### Changed
- **Migration from Timeouts to Long Polling**: All `AdtObject` implementations now use long polling instead of fixed timeouts
  - `create()` methods: Added read with long polling after create, update, and activate operations
  - `update()` methods: Added read with long polling after update and activate operations
  - Integration tests: Replaced `setTimeout` calls with read operations using long polling
  - This provides better reliability and faster execution when objects are ready quickly
- **Read Operations After Create**: All `AdtObject` implementations now read 'inactive' version after create (instead of 'active') to match check operations
  - Ensures consistency between read and check operations
  - Affects: Domain, Class, DataElement, Program, Interface, Table, View, Structure, FunctionGroup
- **Function Group Check**: Improved error handling for empty function groups
  - Added workaround for "REPORT/PROGRAM statement is missing" error (expected for empty function groups)
  - Added workaround for Kerberos library errors in test environments
  - Errors are now properly categorized and documented
- **Architecture Documentation**: Updated to reflect new `AdtClient` high-level API
  - Added `AdtClient` as recommended API in architecture documentation
  - Updated README.md with `AdtClient` usage examples
  - Clarified separation between CRUD operations and utility functions
- **Test Infrastructure**: Improved test organization and documentation
  - All integration tests now use `AdtClient` for consistency
  - Shared tests use `AdtUtils` for utility functions
  - Better separation of concerns in test code
  - Introduced `BaseTester` class for standardized integration test workflows
  - 13/15 object-specific tests now use `BaseTester` for consistent CRUD testing patterns
  - Separated unit test logic from integration tests (`Class.test.ts`, `View.test.ts`) for better separation of concerns
- **Logging utilities**: `ILogger` now comes from `@mcp-abap-adt/interfaces`; legacy `src/utils/logger.ts` removed in favor of package-provided types and no-op defaults in clients

### Fixed
- **DataElement Check**: Fixed handling of empty data elements after create
  - Added proper error handling for "No domain or data type was defined" errors
  - These errors are now expected and ignored for newly created empty data elements
- **Test Naming**: Fixed test names in Program.test.ts
  - Changed from "ProgramBuilder" to "Program" to reflect actual usage of AdtClient.getProgram()
- **TypeScript Syntax Errors**: Fixed compilation errors in test files
  - `FunctionGroup.test.ts`: Removed unused `logBuilderTestStep` call
  - `ServiceDefinition.test.ts`: Removed unused `logBuilderTestStep` call
  - `FunctionModule.test.ts`: Added null check for `functionGroupName` before passing to `ensureFunctionGroupExists`

### Documentation
- Updated architecture documentation with `AdtClient` and `AdtUtils` details
- Added `AdtClient` usage examples to README.md
- Added comprehensive documentation for long polling feature in README.md
- Added migration guide from timeouts to long polling (archived in `docs/development/archive/roadmaps/`)
- Updated API reference to document `withLongPolling` parameter and high-level CRUD operations
- Added documentation for ADT discovery script in README.md and tools/README.md
- Updated IAdtOperationOptions documentation to clarify timeout vs withLongPolling usage
- Added BaseTester migration roadmap documenting test refactoring progress (13/15 tests migrated, 87%)
- Roadmap execution summary: ~95% complete (core functionality complete, documentation pending)

### Removed
- **CLI tools**: Removed legacy bin scripts (`lock-object`, `unlock-object`, `manage-locks`, `manage-sessions`, `unlock-test-objects`) and their README; repository now ships only the TypeScript/JS client APIs
- **Lock state helper**: Removed unused `src/utils/lockStateManager.ts` in favor of explicit lock handling inside builders and high-level clients

## [0.1.40] - 2025-12-08

### Fixed
- **Parameter Passing in Builder Reuse**: Fixed issue where `transportRequest` parameter was lost when reusing existing builders
  - Updated all `get*Builder` methods in `CrudClient` to update `transportRequest` when builder is reused for the same object
  - Affected methods: `getProgramBuilder()`, `getClassBuilder()`, `getInterfaceBuilder()`, `getFunctionModuleBuilder()`, `getDomainBuilder()`, `getViewBuilder()`
  - Previously, when a builder was reused (same object, same session), the `transportRequest` parameter was not updated, causing it to be lost in subsequent operations
  - Now, if `transportRequest` is provided in config, it is automatically updated via `builder.setRequest()` method
- **Transport Request URL Encoding**: Improved `transportRequest` parameter handling in `createView()` function
  - Added `encodeURIComponent()` for safe URL encoding of transport request values
  - Improved parameter validation with optional chaining (`?.`) for safer null/undefined handling
  - Better handling of empty strings and whitespace-only values

### Added
- **Parameter Passing Unit Tests Roadmap**: Added comprehensive roadmap for unit tests to verify parameter passing
  - Created `doc/roadmaps/parameter_passing_unit_tests_roadmap.md` in mcp-abap-adt
  - Detailed test strategy for verifying all parameters pass correctly from client to low-level functions
  - Test implementation plan with phases and examples
  - Coverage goals and success criteria

### Testing
- **BehaviorImplementation Test Configuration**: Fixed test configuration for BehaviorImplementationBuilder
  - Enabled `builder_behavior_implementation` test case in `test-config.yaml`
  - Test was previously skipped due to `enabled: false` setting

### Documentation
- **Architecture Documentation**: Updated documentation to reflect parameter update behavior
  - Added note in `ARCHITECTURE.md` about automatic parameter updates when reusing builders
  - Updated `STATEFUL_SESSION_GUIDE.md` with information about parameter preservation during builder reuse
  - Clarified that `transportRequest` and other parameters are automatically updated when builders are reused for the same object

## [0.1.39] - 2025-12-06

### Documentation
- **Removed Outdated Documentation**: Cleaned up documentation structure
  - Removed `CHECK_CONTENT_FORMAT.md` - information consolidated into `UPDATE_CONTENT_TYPES.md` and `CHECK_METHODS_COVERAGE.md`
  - Removed `docs/development/archive/` directory with outdated analysis documents:
    - `PARAMETERS_ANALYSIS.md` - outdated parameters analysis
    - `TEST_CLEANUP_ROADMAP.md` - outdated cleanup plan
    - `TEST_DEPENDENCIES_ROADMAP.md` - outdated dependencies plan

### Added
- **Check Methods Coverage Documentation**: Added comprehensive `CHECK_METHODS_COVERAGE.md`
  - Complete coverage table for all 21 check methods across all object types
  - Implementation details for text/plain (15 objects) and XML metadata (4 objects) checks
  - Usage patterns: Core functions → Builders → CrudClient
  - Check response format and error handling examples
  - 100% coverage verification across all layers (Core, Builder, CrudClient)

## [0.1.38] - 2025-12-06

### Changed
- **Unified Parameter Structures**: All low-level create and update functions now use parameter structures (Params) instead of individual parameters
  - **Create Functions**: All create functions now accept a single `CreateXParams` object
    - `createStructure()`: Now uses `CreateStructureParams` (camelCase)
    - `createInterface()`: Now uses `CreateInterfaceParams` (camelCase)
    - `createFunctionGroup()`: Now uses `CreateFunctionGroupParams` (camelCase)
    - `createFunctionModule()`: Already used `CreateFunctionModuleParams` (camelCase)
  - **Update Functions**: All update functions now accept a single `UpdateXParams` object
    - `updateFunctionModule()`: Now uses `UpdateFunctionModuleParams` (camelCase)
    - `updateBehaviorDefinition()`: Now uses `UpdateBehaviorDefinitionParams` (camelCase)
    - `uploadStructure()`: Now uses `UpdateStructureParams` (camelCase)
  - **Benefits**: Improved readability, type safety, scalability, and consistency across all functions
  - **Naming Convention**: All new Params interfaces use camelCase (matching BuilderConfig convention)
- **Removed sessionId Parameter**: Removed `sessionId` parameter from all check functions
  - Connection now manages session internally
  - Affected functions: `checkClass()`, `checkInterface()`, `checkView()`, `checkFunctionModule()`, `checkFunctionGroup()`, `checkProgram()`, `validateClassSource()`, `validateFunctionModuleSource()`
  - Low-level check utilities: `runCheckRun()`, `runCheckRunWithSource()` no longer accept `sessionId`

### Added
- **New Parameter Interfaces**: Added parameter structures for functions that previously used individual parameters
  - `CreateStructureParams`: Structure creation parameters (camelCase)
  - `CreateInterfaceParams`: Interface creation parameters (camelCase)
  - `CreateFunctionGroupParams`: Function group creation parameters (camelCase)
  - `UpdateFunctionModuleParams`: Function module update parameters (camelCase)
  - `UpdateBehaviorDefinitionParams`: Behavior definition update parameters (camelCase)
  - `UpdateStructureParams`: Updated to camelCase (was snake_case)

### Documentation
- **Parameters Analysis**: Added comprehensive analysis document in `docs/development/archive/PARAMETERS_ANALYSIS.md`
  - Documents advantages of using parameter structures
  - Migration status and recommendations
  - Naming convention guidelines

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
- **Shared Module Tests - JWT Token Auto-Refresh**: Fixed all shared module integration tests to support automatic JWT token refresh
  - Updated `getConfig()` functions in all shared tests to include refresh credentials (`refreshToken`, `uaaUrl`, `uaaClientId`, `uaaClientSecret`)
  - Tests affected: `whereUsed.test.ts`, `readMetadata.test.ts`, `readSource.test.ts`, `search.test.ts`, `sqlQuery.test.ts`, `tableContents.test.ts`
  - Tests now automatically refresh expired JWT tokens during execution, preventing "JWT token has expired" errors
  - Connection automatically handles token refresh via `JwtAbapConnection.makeAdtRequest()` when refresh credentials are provided

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
