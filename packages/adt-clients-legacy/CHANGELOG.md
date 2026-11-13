# Changelog

All notable changes to this package are documented here. The package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); the repository keeps
one changelog per package.

## [0.9.5] - 2026-11-13

Released with `@mcp-abap-adt/adt-clients` 45.5.1.

### Changed

- **The `@mcp-abap-adt/adt-clients` range is `^45.5.1`** (was `^45.5.0`),
  peer and dev: the root member's `withLongPolling` type this release meets
  comes from 45.5.1. No member changes beyond the fix below.

### Fixed

- **`AdtUtilsLegacy.getActivationRun` takes the option its root member
  takes**: `withLongPolling?: boolean | undefined`, as `AdtUtils` declares it
  from `@mcp-abap-adt/adt-clients` 45.5.1 and interfaces-adt's
  `IAdtGroupLifecycle` declares it. It was `?: boolean`, so under
  `exactOptionalPropertyTypes` the class `getUtils()` hands out did not meet
  the contract its root class implements (the `extends` check compares
  methods bivariantly and let it through). Types only; the member is still
  refused without a request. `npm run test:check` now compiles
  `src/__tests__/typechecks/exact/` under the option against the built
  declarations (`tsconfig.test.exact.json`): every member of every class
  `AdtClientLegacy` and `AdtExecutorLegacy` hand out must accept what its
  root member accepts.

## [0.9.4] - 2026-11-12

Released with `@mcp-abap-adt/adt-clients` 45.5.0.

### Changed

- **The `@mcp-abap-adt/adt-clients` range is `^45.5.0`** (was `^45.4.0`),
  peer and dev, with `@mcp-abap-adt/interfaces-adt-connection` `^5.0.0` (was
  `^4.2.0`; `makeAdtRequest` takes no type parameter, and `AdtClientLegacy`
  takes a connection written to it), `@mcp-abap-adt/interfaces-adt`
  `^27.4.0` (was `^27.3.0`) and the `@mcp-abap-adt/adt-strategies`
  devDependency `^0.23.0`, so a consumer installs one copy of each. No member
  changes.

## [0.9.3] - 2026-11-12

Released with `@mcp-abap-adt/adt-clients` 45.4.0.

### Changed

- **The `@mcp-abap-adt/adt-clients` range is `^45.4.0`** (was `^45.1.0`),
  peer and dev, so the legacy classes — which answer through adt-clients'
  `answering` — are promised the verdicts that carry `sessionError` and
  `sessionLost`. `@mcp-abap-adt/interfaces-adt` `^27.3.0` (was `^27.2.0`),
  `@mcp-abap-adt/interfaces-adt-connection` `^4.2.0` (was `^4.1.0`), and the
  `@mcp-abap-adt/adt-strategies` devDependency `^0.22.3`. No member changes.

## [0.9.2] - 2026-11-11

Released with `@mcp-abap-adt/adt-clients` 45.2.0.

### Changed

- **The `fast-xml-parser` devDependency moves to `^5.12.0`** (was `^5.9.3`),
  past GHSA-474x-hrwr-fgx4 (5.11.2 and earlier), the range adt-clients
  45.2.0 declares. The published package does not depend on it; no member
  changes. The `@mcp-abap-adt/adt-clients` range stays `^45.1.0`, which
  45.2.0 satisfies.

## [0.9.1] - 2026-11-11

### Changed

- **On `@mcp-abap-adt/interfaces-adt` `^27.1.0`** (was `^27.0.0`), which it
  depends on directly, and on `@mcp-abap-adt/adt-clients` `^45.1.0`, so a
  consumer installs one copy of interfaces-adt. No member changes.

## [0.9.0] - 2026-11-09

On `@mcp-abap-adt/adt-clients` `^45.0.0` (fr0ster/mcp-abap-adt#351).

### Changed — breaking (a 0.x minor)

- **`getUtils().activateObjectsGroup` is refused without a request**
  (`UNSUPPORTED_OPERATION`), as `getActivationRun` and
  `getActivationResults` are: 7.40's discovery lists no `/activation/runs`
  (measured on 7.40 SP04, 2026-11-09). Its message points to
  `activateObjects`. **Migration:** call `activateObjects(objects,
  preauditRequested, options)` — the same synchronous
  `POST /sap/bc/adt/activation` the legacy `activateObjectsGroup` sent,
  inherited from adt-clients 45 and read through the `objectActivation` slot.
  It takes 7.40's activated codes by type (`AdtActivationCode<'basis740'>`);
  unlike the old override it has no runtime refusal of another code — a caller
  that bypasses the types sends the request, and SAP's answer is the
  verdict.
- **The `@mcp-abap-adt/adt-clients` peer range moves to `^45.0.0`** (was
  `^44.0.0`; the devDependency too), and `@mcp-abap-adt/interfaces-adt` to
  `^27.0.0`; the adt-strategies dev range to `^0.22.0`.

### Added

- `getFunctionGroup().activate` takes `options.preauditRequested` and sends
  it; absent, `true`, today's request. It goes through adt-clients'
  activation helper: after a `chkl:messages` with `activationExecuted="false"`
  and no message, it reads the inactive list once and hands it to `analyse`.

### Documentation

- `docs/LEGACY.md` and the README: the group activation member, and the 7.40
  measurements of 2026-11-09 — an empty `200` that activated a class, and no
  `/activation/runs` in the discovery.

## [0.8.0] - 2026-11-09

On `@mcp-abap-adt/adt-clients` `^44.0.0`: legacy 0.8.0 requires adt-clients
44.

### Changed — breaking (a 0.x minor)

- **The `@mcp-abap-adt/adt-clients` peer range moves to `^44.0.0`** (was
  `^43.1.0`; the devDependency moves to `^44.0.0` too). Every legacy class
  extends an adt-clients class and hands its superclass the connection it was
  given, typed by interfaces-adt-connection 4 (`getBaseUrl(): Promise<string |
  undefined>`). adt-clients 43 types that parameter by contract v3
  (`Promise<string>`), which a v4 connection does not satisfy, so legacy 0.8.0
  works only over adt-clients 44.
  **Migration:** install adt-clients 44 with legacy 0.8.0.
- **On `@mcp-abap-adt/interfaces-adt-connection` `^4.0.0`** (was `^3.0.0`), as
  adt-clients 44 and adt-strategies 0.21.0, so one copy of the contract is
  installed (where `getBaseUrl()` may answer `undefined`); v3 is no longer
  accepted. No legacy class reads `getBaseUrl()`. The adt-strategies dev range
  moves to `^0.21.0`. No member changes.

## [0.7.2] - 2026-11-05

On `@mcp-abap-adt/adt-clients` `^43.1.0`.

### Changed

- `getUtils().getStructureElementInfo` and
  `getUtils().getServiceDefinitionElementInfo`, new in adt-clients 43.1.0,
  are refused without a request (`UNSUPPORTED_OPERATION`): the 7.40 discovery
  lists neither `/sap/bc/adt/ddic/elementinfo` nor
  `/sap/bc/adt/ddic/srvd/elementinfo`. The adt-strategies dev range moves to
  `^0.20.0`.

## [0.7.1] - 2026-11-05

### Changed

- **On `@mcp-abap-adt/interfaces-adt` `^26.0.0`** (was `^25.2.0`), which it
  depends on directly, and on `@mcp-abap-adt/adt-clients` `^43.0.1`, so a
  consumer installs one copy of interfaces-adt. The adt-strategies dev range
  moves to `^0.19.0`. No member changes.

## [0.7.0] - 2026-11-04

On `@mcp-abap-adt/adt-clients` `^43.0.0`. A breaking change of a 0.x package,
so a minor: the creates it inherits take no `abstract` / `programType` and
invent no language (adt-clients' MIGRATION-43.md).

### Changed

- The creates the legacy client inherits carry adt-clients' fixes: escaped
  attribute values, and the language written and sent as `sap-language` only
  when one is given (no `EN` default).
- `getUtils().getObjectOutline` is inherited and sent as on the modern client
  (not measured on 7.40); `getBehaviorImplementation().readImplementations`
  is refused without a request, like every member of that absent type.

## [0.6.2] - 2026-11-03

### Changed

- On `@mcp-abap-adt/adt-clients` `^42.2.0` and `@mcp-abap-adt/interfaces-adt`
  `^25.2.0`. The legacy classes override no update that writes, so a legacy
  `update` given `ifMatch` sends `If-Match` as the root member does; the
  `updateMetadata` refusals take `IAdtUpdateOptions` and still send nothing
  (`legacyIfMatch.test.ts` holds both).
- **7.40 does not act on `If-Match`** (measured over RFC, 2026-11-03): a source
  read answers an ETag and a source write answers none; a source `PUT` with a
  stale `If-Match`, and one with an arbitrary `If-Match`, each answered `200`
  and the write took place. `docs/LEGACY.md` lists the write guard among what
  the legacy system lacks. Nothing strips the header: the request is the
  caller's, and SAP's answer is the verdict.

## [0.6.1] - 2026-11-03

### Changed

- On `@mcp-abap-adt/adt-clients` `^42.1.0`. `docs/LEGACY.md` lists the ATC
  results by Display ID it added (`getAtc().listResults`, `getResult`) among
  the runtime families with no legacy variant: 7.40 SP04's discovery lists no
  `/sap/bc/adt/atc/results`, and no run there has sent either request. Nothing
  in this package's code changes.

## [0.6.0] - 2026-11-02

On `@mcp-abap-adt/adt-clients` `^42.0.0`. A breaking change of a 0.x package,
so a minor.

### Breaking

- **`create` takes `packageName: string`, required**, on every `*Legacy`
  class that inherits a create needing a package from adt-clients 42.0.0:
  `AdtClassLegacy`, `AdtProgramLegacy`, `AdtInterfaceLegacy`,
  `AdtIncludeLegacy`, `AdtFunctionGroupLegacy`, `AdtMessageClassLegacy`,
  `AdtDdlLegacy`, and the handlers `AdtClientLegacy` serves from its base
  unchanged. A call without one does not compile: SAP creates nothing without
  a package (read in SAP's handlers on a modern on-premise system, 2026-11-02;
  not read on 7.40). `AdtProgramLegacy.validate` and `AdtIncludeLegacy.validate`
  take `packageName` too, inherited: SAP's program validation refuses an empty
  package. **Migrating:** install `@mcp-abap-adt/adt-clients@^42.0.0` and pass
  `packageName` to those `create` and `validate` calls (see adt-clients'
  [MIGRATION-42.md](../adt-clients/docs/usage/MIGRATION-42.md)).

### Fixed

- `validate` without a package, inherited from adt-clients 42.0.0, sends
  `packagename` empty instead of the text `undefined`
  (`AdtClassLegacy`, `AdtInterfaceLegacy`, `AdtDdlLegacy`).

## [0.5.0] - 2026-11-02

On `@mcp-abap-adt/adt-clients` `^41.0.0`. A breaking change of a 0.x package,
so a minor. Types only: no request changes.

### Breaking

- **Every `*Legacy` class is typed by the values its result slots answer**,
  as its base is in adt-clients 41.0.0: `AdtClassLegacy<T extends ClassValues
  = ResultValuesOf<typeof classDocuments>>` and so on for every class and
  executor here, with no cast left in reading a slot. The legacy clients'
  getters answer `XLegacy<ResultValuesOf<R>>`. **Migrating:** install
  `@mcp-abap-adt/adt-clients@^41.0.0`; code that names a class's type
  parameter (`AdtClassLegacy<typeof classDocuments>`, a subclass) now names the
  values (`AdtClassLegacy<ResultValuesOf<typeof classDocuments>>`);
  `getX()` / `getX(results)` calls are unchanged.

## [0.4.1] - 2026-11-02

### Added

- `getInclude().readMainPrograms`, which `AdtInclude` gained in adt-clients
  40.1.0, is refused without a request: 7.40 SP04's type table lists no
  `mainPrograms` for the include and no run there has sent its GET
  (`legacyNotMeasuredRefusal`, as `updateMetadata`). `docs/LEGACY.md` records
  it. `@mcp-abap-adt/adt-clients` `^40.1.0`.

## [0.4.0] - 2026-11-01

On `@mcp-abap-adt/adt-clients` `^40.0.0`, `@mcp-abap-adt/adt-strategies`
`^0.18.0` and `@mcp-abap-adt/interfaces-adt` `^25.0.0`. A breaking change of a
0.x package, so a minor.

### Breaking

- **Every read takes `AdtReadVersion`** — `active`, `inactive` or
  `workingArea` — as interfaces-adt 25.0.0 and adt-clients 40.0.0 type it:
  `AdtUtilsLegacy.readObjectSource` and every read the `*Legacy` classes
  inherit. Migrating: install `@mcp-abap-adt/adt-clients@^40.0.0` and
  `@mcp-abap-adt/interfaces-adt@^25.0.0`; an override of a read widens its
  version parameter.

### Changed

- **An inherited read sends the version its caller names**, `workingArea`
  included, as `?version=<value>`: every metadata read sends
  `options.version` (adt-clients 40.0.0), and every source read sends
  exactly the version it is given — a class include's `inactive` as
  `inactive` (was `workingArea`). The enhancement and the metadata extension
  are refused on 7.40 with no request, so their changes do not reach this
  package. Of the `*Legacy` classes only the
  package's (refused) and the transport request's (no version) override
  `readMetadata`. **Not measured on 7.40:** what 7.40 answers to a version, to
  `workingArea` and to the changed requests above all, is its own. A read
  given no version sends no version (adt-clients 40.0.0 removed every
  default). Migrating: pass the version you mean.

## [0.3.0] - 2026-10-30

On `@mcp-abap-adt/adt-clients` `^39.0.0` and `@mcp-abap-adt/interfaces-adt`
`^24.0.1`. A breaking change of a 0.x package, so a minor.

### Breaking

- **`getUtils().search` takes 7.40's search names.** `AdtUtilsLegacy.search`
  takes `IAdtSearchObjectsParamsOf<'basis740'>`: the eleven names measured to
  select on 7.40 SP04 (`ADT_SEARCH_TYPES_BASIS_740`: `DEVC`, `CLAS`, `INTF`,
  `PROG`, `FUGR`, `FUNC`, `DDLS`, `MSAG`, `TABL`, `ENHO`, `ENHS`). It took
  7.40's codes, which 7.40 reads as their main type (`TABL/DS` answers both
  table kinds). A code, an alias the newer releases select (`STRU`, `DTAB`,
  `REPO`, `INCL`, `BADI`) and an unknown name do not compile; from a caller
  outside the type system each is refused without a request, the refusal
  naming `ADT_SEARCH_TYPES_BASIS_740` — 7.40 answers them `200` with no hits,
  which a caller could not tell from an empty search. A name is sent as
  `objectType`, as a code was.
- **The group references are interfaces-adt's typed ones.**
  `activateObjectsGroup`, `checkDeletionGroup` and `deleteObjectsGroup` take
  `IAdtCodedReference<C>[]` (a function module names its group), where-used
  `IGetWhereUsedParams<AdtWhereUsedCode<'basis740'>>` — adt-clients 39.0.0's
  sets for 7.40, `VIEW/DV` among them.

### Changed

- **A group activation of `VIEW/DV` is sent.** 7.40's utility table
  (`ADT_UTILITY_CODES_BASIS_740`) lists group activation for it, so the
  synchronous `POST /sap/bc/adt/activation` carries it under
  `/sap/bc/adt/ddic/views/<name>`; it was refused without a request. Not
  measured on 7.40 SP04 (the utility table says `measured: false`).

## [0.2.0] - 2026-10-29

On `@mcp-abap-adt/adt-clients` `^38.0.0`, with its two changes of contract:
each factory answers its class and the compositions of atoms are gone (#216),
and the ADT type tables of `@mcp-abap-adt/interfaces-adt` decide what a client
serves (#282) — here `ADT_TYPES_BASIS_740`. Answers do not change; a request
changes only where a code no table holds is no longer taken. A breaking change
of a 0.x package, so a minor.

### Breaking

- **`AdtClientLegacy`'s and `AdtExecutorLegacy`'s getters have adt-clients
  38's two overloads**: no argument answers the legacy handler, runner or
  executor typed by the shipped documents, a result set one typed by it;
  `getClass<MyResults>()` or `getClassTestRunner<MyResults>()` without
  results no longer compiles. Every override of `AdtClientLegacy` (the
  sixteen served types' and the eighteen absent ones') takes them, its
  variant gate unchanged. The legacy handlers, runners and executors inherit
  their base constructors, which take an options object with a required
  `results` (adt-clients 38.0.0):
  `new AdtClassLegacy(connection, { logger, results: classDocuments })`,
  `new AdtUtilsLegacy(connection, { logger, results: utilDocuments })`,
  `new ClassTestRunnerLegacy(connection, { logger, results: classTestRunnerDocuments })`;
  or take one from the getter. No request and no answer changes.
- **`AdtClientLegacy` is `AdtClient<'basis740'>`, typed by 7.40's table.**
  `AdtExecutorLegacy` is `AdtExecutor<'basis740'>`, and every legacy handler
  extends its base fixed to `'basis740'`. A getter or member
  `ADT_TYPES_BASIS_740` does not list does not compile (`getTable()`,
  `getPackage()`, `getClass().checkDeletion()`, `getDdl().getVersions()`, the
  transport request's `create` / `updateMetadata` / `delete`, the executors'
  class run and profiling, a runner's `getStatus` / `getResult`, …); every
  override keeps its base's gate. A legacy client is not assignable to a
  modern `AdtClient`. The refusals stay, for callers outside the type system,
  and still send nothing.
- **Every code is a code of 7.40's table.** `getUtils()`'
  `readObjectMetadata`, `readObjectSource`, `search`, `fetchNodeStructure`,
  `getObjectStructure` and `activateObjectsGroup` take 7.40's codes
  (`DEVC/K` too for the two structure reads) and refuse any other without a
  request — `BDEF/BDO`, `SRVD/SRV`, `DDLX/EX`, `DCLS/DL` and `ENHO/XHH`
  included; the refusal names the table. The friendly names (`class`,
  `program`, …), bare R3TR types and lower-case spellings are gone with
  adt-clients 38.
- **The getters answer classes.** The eleven that re-declared the base's two
  overloads over a composition (`getFunctionInclude`, `getInclude`,
  `getMessageClass`, `getLocalTestClass`, `getLocalTypes`,
  `getLocalDefinitions`, `getLocalMacros`, and `getTransformation`,
  `getScalarFunction`, `getScalarFunctionImplementation`, `getAppendStructure`)
  have one signature each, answering their legacy class or, for the last four,
  the base class through `absentOnLegacy`. A consumer composes the contract it
  accepts from `@mcp-abap-adt/interfaces-adt`; `AdtClientLegacy` satisfies such
  a contract as `AdtClient` does.
- **The result-set contracts come from `@mcp-abap-adt/interfaces-adt`.** A
  consumer imports `IClassResults` and its siblings from there; adt-clients
  38.0.0 no longer exports them
  ([MIGRATION-38.md](../adt-clients/docs/usage/MIGRATION-38.md)).

### Added

- **The function group's source on 7.40**: `getFunctionGroup().read(config,
  version?)` and `update(config, { source, lockHandle, headers })` are
  adt-clients 38's, inherited — one `GET …/source/main` (`Accept:
  text/plain`) and one `PUT …/source/main?lockHandle=` of the caller's text.
  Measured on SAP_BASIS 7.40 SP04 over RFC (2026-10-29, in `$TMP`): the GET
  answered `200 text/plain` (the main program `SAPL<group>`), the PUT with
  `Content-Type: text/plain; charset=utf-8` `200` under the lock, the
  one-reference activation activated the group and its main program, and the
  source read back equalled what was written. 7.40's table lists `read`,
  `source` and `update` for `FUGR/F` since interfaces-adt 23.1.1, so both
  compile on `AdtClientLegacy`. The function group live cycle reads, writes,
  activates and reads back the group's source.
- Refusals, without a request, of the members adt-clients 38 adds and 7.40 has
  not measured: `updateMetadata` of the class, interface, program, function
  module, DDL source and include. 7.40's table lists none of them, so each
  also does not compile on `AdtClientLegacy`.
- `getUtils().getTypeStructure()` is served, inherited (7.40's answer is in
  adt-clients' corpus).
- **The generic ABAP Unit runner on 7.40**, `AbapUnitTestRunnerLegacy`
  (`AdtExecutorLegacy.getAbapUnitTestRunner()`): `runSync(uris, { headers })`
  is adt-clients' — one `POST /abapunit/testruns` with `<options>`; `run` of
  an object or a package target, `getStatus` and `getResult` are refused
  without a request (no `/abapunit/runs`) and do not compile on
  `'basis740'`.

### Changed

- **The function group's activation sends the group alone**, as in 0.1.0.
  adt-clients 38 adds the group's main program (`SAPL<group>`, `FUGR/I`) as a
  second reference, measured on S/4HANA 2025 and ABAP cloud only;
  `AdtFunctionGroupLegacy.activate()` keeps the one reference.
- Peer and dev dependency `@mcp-abap-adt/adt-clients` `^38.0.0` (was
  `^37.4.0`); `@mcp-abap-adt/interfaces-adt` `^23.1.1` (was `^20.1.0`);
  dev `@mcp-abap-adt/adt-strategies` `^0.16.0` (was `^0.10.0`).
- `legacyConsumerContract.test.ts` proves that a contract composed from
  interfaces-adt alone accepts `AdtClientLegacy`; `legacyVariantGates.test.ts`
  holds every 7.40 gate through the overrides with `@ts-expect-error`; the
  literal scan of type codes (`typeCodeLiterals.test.ts`) runs over this
  package's source.

### Migration

- Code that calls a getter or member 7.40's table does not list no longer
  compiles: drop the call, or, where the value comes from outside the type
  system, keep reading the refusal (`UNSUPPORTED_OPERATION`).
- Pass codes of the tables (`'CLAS/OC'`, `'PROG/P'`, `'FUGR/FF'` with its
  group) where a friendly name or another spelling was passed.
- A function typed `(client: AdtClient)` does not take an `AdtClientLegacy`
  any more; type it `AdtClient<'basis740'>`, `AdtClientLegacy`, or the
  consumer's own contract composed from `@mcp-abap-adt/interfaces-adt`.
- Install `@mcp-abap-adt/adt-clients` `^38.0.0` beside it, and see its
  [MIGRATION-38.md](../adt-clients/docs/usage/MIGRATION-38.md).

## [0.1.0] - 2026-10-27

The first release: the clients for legacy SAP ABAP systems (SAP_BASIS
7.40), measured on SAP_BASIS 7.40 SP04 over RFC, moved out of
`@mcp-abap-adt/adt-clients` (where they were `AdtClientLegacy`,
`AdtExecutorLegacy` and `AdtRequestLegacy` up to 37.3.x, and are gone from 37.4.0).
The package takes `@mcp-abap-adt/adt-clients` `^37.4.0` as a peer dependency: the consumer installs it, and the legacy classes extend that one copy.
The live cycles were run on SAP_BASIS 7.40 SP04 over RFC and pass (15 suites, 385 tests; record `T6-20261027`).

### What the package is

- Exports `AdtClientLegacy`, `AdtExecutorLegacy` and `AdtRequestLegacy`. Each
  `*Legacy` class `extends` a class of `@mcp-abap-adt/adt-clients` and only
  overrides.
- **The consumer declares the system type.** A consumer of a 7.40 system installs
  this package and constructs `new AdtClientLegacy(connection, logger)` /
  `new AdtExecutorLegacy(connection, logger)` over an RFC connection; nothing
  detects a system, and no factory chooses a legacy class. HTTP to a legacy
  system is not a supported wire.
- Each member sends the request measured accepted on 7.40 SP04, or keeps an
  unmeasured request under a collection 7.40 advertises, or answers a refusal
  without a request. The README states the contract per handler; `docs/LEGACY.md`
  names the probe record behind each claim and lists what is not measured.

### Changed from the 37.3.x legacy client (measured on 7.40 SP04)

- **Include and message class `delete` send** one
  `DELETE <object URI>?lockHandle=` under the caller's lock (they were refused),
  with the caller's headers and timeout, and `&corrNr=` when `transportRequest`
  is given (a delete with `corrNr` in a transportable package is measured by the
  2026-10-26 live run). Measured: the include answered `200` and then `404` on read; the
  message class answered `200`.
- **`readTransport` is refused**, with no request, for a class, program,
  interface, function group, function module and DDL source. `GET <object>/transport`
  answered `404` for the first five and for the DDL source (`T6-20261027`).
- **The four local class includes refuse `readTransport` too**
  (`getLocalTestClass()`, `getLocalTypes()`, `getLocalDefinitions()`,
  `getLocalMacros()`): their inherited member sends the container class's
  `GET <class>/transport`, which answered `404` (B4 c6-readTransport).
- **A DDL source's `getVersions` and `getVersionSource` are refused**:
  `GET /ddic/ddl/sources/<name>/versions` answered `404`.
- **A message class's `updateMetadata` is refused** until its document is
  measured: the `PUT` answered `400 ExceptionInvalidData` (7.40 expects another
  root element).
- **`AdtPackageLegacy.read` is not carried over**: it was a member `AdtPackage`
  does not have.

### Tests and tooling

- The live suites (`src/__tests__/integration/legacy/`), the test environment
  (`ZCL_LG7_ENV*`, the `legacy:*` scripts) and the test configuration keys moved
  with the code, and one live cycle per type 7.40 serves was added
  (`cycles/`); the cycles ran on SAP_BASIS 7.40 SP04 over RFC and pass
  (`T6-20261027`).
- `npm run check:config` checks an overlay that holds both the root package's keys
  and the legacy keys; the root package's `check:config` checks the modern
  overlays and refuses the legacy keys.
- `npm run header:discovery` needs the root package built first.
