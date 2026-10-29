# Changelog

All notable changes to this package are documented here. The package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); the repository keeps
one changelog per package.

## [0.2.0] - 2026-10-29

On `@mcp-abap-adt/adt-clients` `^38.0.0`, with its two changes of contract:
each factory answers its class and the compositions of atoms are gone (#216),
and the ADT type tables of `@mcp-abap-adt/interfaces-adt` decide what a client
serves (#282) — here `ADT_TYPES_BASIS_740`. Answers do not change; a request
changes only where a code no table holds is no longer taken. A breaking change
of a 0.x package, so a minor.

### Breaking

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

- Refusals, without a request, of the members adt-clients 38 adds and 7.40 has
  not measured: `updateMetadata` of the class, interface, program, function
  module, DDL source and include, and `read` / `update` of the function
  group's source. 7.40's table lists none of them, so each also does not
  compile on `AdtClientLegacy`.
- `getUtils().getTypeStructure()` is served, inherited (7.40's answer is in
  adt-clients' corpus).

### Changed

- **The function group's activation sends the group alone**, as in 0.1.0.
  adt-clients 38 adds the group's main program (`SAPL<group>`, `FUGR/I`) as a
  second reference, measured on S/4HANA 2025 and ABAP cloud only;
  `AdtFunctionGroupLegacy.activate()` keeps the one reference.
- Peer and dev dependency `@mcp-abap-adt/adt-clients` `^38.0.0` (was
  `^37.4.0`); `@mcp-abap-adt/interfaces-adt` `^23.0.4` (was `^20.1.0`);
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
