# Changelog

All notable changes to this package are documented here. The package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); the repository keeps
one changelog per package.

## [0.1.0] - 2026-10-27

The first release: the clients for legacy SAP ABAP systems (SAP_BASIS below
7.50), measured on SAP_BASIS 7.40 SP04 over RFC, moved out of
`@mcp-abap-adt/adt-clients` (where they were `AdtClientLegacy`,
`AdtExecutorLegacy` and `AdtRequestLegacy` up to 37.3.x, and are gone from 37.4.0).
The package depends on `@mcp-abap-adt/adt-clients` `^37.4.0`.
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
  (`cycles/`); none has been run as a suite yet.
- `npm run check:config` checks an overlay that holds both the root package's keys
  and the legacy keys; the root package's `check:config` checks the modern
  overlays and refuses the legacy keys.
- `npm run header:discovery` needs the root package built first.
