# The legacy package and its live cycles: design

Answers `docs/superpowers/2026-10-26-legacy-package-goal.md`.

The facts below were measured on SAP_BASIS 7.40 SP04 over RFC (E77). The
probe records are outside the repository, in `~/prj/e77-probe/e77-results/`:
- B2-reads;
- B3-cycle;
- B3-deletes;
- B3-unmeasured;
- B3-fugr-v1;
- B4-cycles-20261026-2019;
- class-metadata-accept-2026-10-26.

## 1. The package

- **The repository layout.**
  - The layout is the owner's multi-package one, mirrored from `llm-agent`,
    whose root `package.json`, build, test, lint and release scripts are read
    end to end and copied.
  - The root is private (`"private": true`, `"workspaces": ["packages/*"]`)
    and holds no published code.
  - The packages are `packages/adt-clients` (today's root package, moved
    whole: `src`, its tests, scripts, docs, configs), `packages/adt-strategies`
    (unchanged, now a workspace) and `packages/adt-clients-legacy` (new).
  - `release:publish` is the owner's guarded publisher, copied whole from
    `mcp-abap-adt-interfaces` (`tools/publish-changed.js`, with its test). It
    publishes the packages whose version is not on the registry, in
    dependency order, and its `--dry-run` publishes nothing. Tags are
    `<package directory>-v<version>`, as in interfaces and auth-providers.
- **Name.** The new package is `@mcp-abap-adt/adt-clients-legacy`. Its first
  version is `0.1.0`.
- **Dependency.** It depends on `@mcp-abap-adt/adt-clients` `^37.4.0`, a
  semver range with no `file:`, `link:` or `workspace:` specifier.
  - **Inside the repository** npm links the workspace sibling. This is the
    owner's exception for packages of one repository. The repository's
    lockfile has `"link": true` for the siblings only.
  - **At release** adt-clients is published first, and the range resolves on
    the registry.
  - **Other dependencies** are the contract packages the legacy classes
    import today, at adt-clients' ranges.
- **Builds.** Each package builds into its own `dist`, with `rootDir` = its
  own `src`. The legacy package compiles against adt-clients' built
  declarations through the workspace link, so the build order follows the
  dependencies.
- **What moves in.** Everything else ends up in the new package, and
  nothing of legacy stays in the root package:
  - **The legacy classes:**
    - `AdtClientLegacy`, `AdtExecutorLegacy`, `absentOnLegacy`;
    - every `core/*/…Legacy.ts` and `executors/*/…Legacy.ts`;
    - `AdtUtilsLegacy`, `AdtRequestLegacy`;
    - the helpers `deleteLegacy`, `refusalLegacy`, `readLegacy`,
      `abapUnitRunLegacy`.
  - **Tests:** their unit tests, the live suites
    (`packages/adt-clients/src/__tests__/integration/legacy/` after the
    move), and the legacy helpers and admin
    scripts of the tests (`legacyEnv`, `legacyLive`, `legacyRfc`,
    `legacyMembers`, `admin/legacy-env`).
  - **The ABAP environment:** `abap/`, the `legacy:*` scripts and the
    overlay keys.
  - **Docs:** `docs/architecture/LEGACY.md`.
- **What stays in `packages/adt-clients`:**
  - everything modern;
  - the shared test harness (the overlay loader, the session configuration,
    the recorder, the header pairs). It has to become **free of legacy**
    first, because today `adtHeaders.ts` imports the legacy client and its
    handlers to recognise refusals, and `sessionConfig.ts` constructs
    `AdtClientLegacy`. The harness instead exposes two seams the legacy
    package fills:
    - client construction: the session takes a client factory, and the
      default is the modern one;
    - registration of header pairs and refusals per handler class.
  - The legacy registrations and the legacy factory move into the legacy
    package's test helpers.
- **The legacy package's test setup.**
  - Its Jest and type-check configuration include the root's shared harness
    by relative path from the legacy package directory (`../adt-clients/src/__tests__/helpers/…`). That source is
    test-only, in the same repository, and never part of either published
    package.
  - The root's harness never imports from the legacy package. The two AST
    rules below hold for test sources too.

- **The root package's surface.**
  - `AdtClientLegacy` and `AdtExecutorLegacy` go from `index.core` and
    `index.executors`, and `AdtRequestLegacy` goes from the transport
    barrel.
  - `createAdtClient` / `createAdtExecutor` no longer choose a legacy class.
    The `isModernAdtSystem` choice is removed: the consumer who wants legacy
    constructs `AdtClientLegacy` from the legacy package. The system type is
    declared by the consumer, never detected.
  - The root package exports what a subclass in another package needs, and
    nothing else: the handler classes the legacy classes extend, their base
    types, `AdtContentTypesBase`, `answering`, the result strategies' types
    and the wire helpers the legacy classes call today. This set is the
    compiler's: the move fails to build until it is exported.
- **The AST rule becomes two rules.**
  - **Root:** no identifier, module specifier or string containing `legacy`
    (case-insensitive) and no `/sap/bc/cts` literal anywhere in the root
    `src`, apart from the removal notes in comments.
  - **Legacy package:** each `*Legacy` class `extends` a root class and
    contains only overrides, getters and private helpers. No root module is
    patched.
- **Version.** adt-clients `37.4.0` is a minor: the legacy members never
  worked (owner). The legacy package starts at `0.1.0`.

## 2. Changes to the legacy classes (measured in B4)

| Member | Today | After | Measured |
|---|---|---|---|
| `AdtIncludeLegacy.delete` | refused | lock is the caller's; one `DELETE /sap/bc/adt/programs/includes/{name}?lockHandle=…`, Accept `application/xml`, then read → `404` | B4: `200`, read `404` |
| `AdtMessageClassLegacy.delete` | refused | one `DELETE /sap/bc/adt/messageclass/{name}?lockHandle=…`, Accept `application/xml` | B4: `200`, the name is free afterwards |
| `readTransport` (class, program, interface, function group, function module, include, DDL, message class) | sends | refused, no request | B4: `404` for every type |
| `AdtDdlLegacy.getVersions` / `getVersionSource` | sends | refused | B4: `404` on `/ddic/ddl/sources/{n}/versions` |
| `AdtMessageClassLegacy.updateMetadata` | sends | refused until its document is measured | B4: `400 ExceptionInvalidData` (7.40 expects another root element) |

The new deletes keep the base's shape: one request under the caller's lock,
timeout passed through, the lock handle in the query.

## 3. What the consumer must know (the package README)

The README of the legacy package carries everything a consumer needs. The
package does not engineer around a consumer who ignores it.

- **Construction.** Construct `AdtClientLegacy(connection, logger)` and
  `AdtExecutorLegacy(connection, logger)` over an RFC connection. HTTP is not
  a supported legacy wire.
- **The members.** A table per handler: each member and what it does on
  7.40 (sends, with the request; refused; kept but not measured).
- **Headers are the caller's.** The measured pairs per member:
  - **Include create:** only `application/vnd.sap.adt.programs.includes+xml`.
    v2 answers `400 ExceptionContentHandlerNotFound`.
  - **Class metadata read:** only `application/vnd.sap.adt.oo.classes+xml`.
    Every versioned list answers `400 ExceptionContentHandlerNotFound`.
  - **Every other type:** the library's default pairs work.
- **Empty `200`s are not success.**
  - A message class that does not exist reads `200` with an empty body.
  - Families 7.40 does not have answer an empty `200`.
  - The legacy classes refuse those families. A consumer reading
    `getUtils().readObjectMetadata` must check the body.
- **The local class includes' `check` and `validate` need the `source`.**
  Without it the library throws before sending.
- **A function module's source on 7.40.** A parameter comment block is
  refused (`500 Parameter comment blocks are not allowed`). A plain
  `FUNCTION … ENDFUNCTION` body is accepted.
- **`validate` of an existing name answers `400` (`InvalidClifName`, "already
  exists").** That is the answer for an existing object, not a failure of
  the request.
- **What ADT does not serve on 7.40 is the user's, one level up**: through
  the legacy MCP server, the user's LLM writes ABAP (classes, reports) that
  does it. The package refuses those members without a request.

## 4. The live cycles

Each cycle is one test on the type's own objects (`ZLG7_C_<TYPE>`), created
by the test in `$TMP` and deleted by it, also on failure. They are run as
the test user over RFC, with the overlay `MCP_TEST_OVERLAY` names and the
session file `MCP_ENV_PATH` names.

Every step asserts three things:
- **the requests it sends, read off the recorder.** An operation that sends
  one request is asserted as that one request. A composite operation is
  asserted as its complete ordered sequence, every lock and unlock included.
  For example, a message create, update or delete is a read of the class,
  `LOCK_MSG`, a class `LOCK` with `msgNo`, the `PUT`, the `UNLOCK` and
  `UNLOCK_ALL`;
- **the status 7.40 answers;**
- **the effect, read back.** A step 7.40
refuses is asserted as the library's refusal with nothing sent. The
headers are passed as the consumer passes them (§3).

| Type | Cycle |
|---|---|
| Class | create → lock → update main + types + definitions + macros + testclasses → unlock → activate → read main and each include (active) → readMetadata (unversioned Accept) → check main and each include (with source) → getVersions + getVersionSource of main and each include → `readTransport` refused → lock → delete → unlock → read `404` |
| Program | create → lock → update → unlock → activate → read → readMetadata → check → getVersions → getVersionSource → `readTransport` refused → lock → delete → unlock → `404` |
| Interface | create → lock → update → unlock → activate → read → readMetadata → check → getVersions → getVersionSource → `readTransport` refused → lock → delete → unlock → `404` |
| Function group + module | group create → activate → check; module create → lock → update (plain body) → unlock → activate → read → readMetadata → check → getVersions → getVersionSource → validate → lock → delete module → unlock → `404`; lock → delete group → unlock → `404` |
| Function include | in its own group: create (v1 pair) → lock → update → unlock → activate → read → readMetadata → check; removed with the group → read `404` |
| Include | create (unversioned pair) → lock → update → unlock → activate → read → readMetadata → lock → delete (§2) → unlock → `404` |
| DDL source | create → lock → update (a view over `T000`) → unlock → activate → read → readMetadata → check → `getVersions` refused → lock → delete → unlock → `404` |
| Message class + message | class create → lock → unlock → readMetadata → `updateMetadata` refused; message 001 create → read → update → read → delete → read absent; class lock → delete (§2) → unlock → readMetadata empty `200` (as measured) |
| Transportable program | as today (`LegacyTransportable`) |
| Transports, unit-test runners, refusals | as today |
| Utils readers | `search` (finds a cycle's object) → `getObjectStructure` of it → `fetchNodeStructure('DEVC/K', '$TMP')` lists it → `discovery` (the advertised collections) → write a cycle object without activating → `getInactiveObjects` lists it → `activateObjectsGroup` activates it → `getInactiveObjects` no longer lists it |

`validate` of a name that does not exist yet is asserted before each
create: it answers `200`, or the type's measured answer. That is the use a
consumer makes of it.

The test environment (`ZCL_LG7_ENV*`, `legacy:*`) moves with the package
unchanged. It is a utility for the live suites, not part of the published
package.

## 5. Docs and release

- **The legacy package:**
  - README (§3);
  - `docs/LEGACY.md` (moved; its measured tables updated with B4, and
    corrected where the 2026-10-26 run already measured "not measured"
    items: delete with `corrNr`, a populated transport list);
  - CHANGELOG `0.1.0`.
- **The root package:**
  - README and CLAUDE.md say legacy is a separate package;
  - CHANGELOG `37.4.0`: the legacy exports and the legacy choice in the
    factories removed, with a migration note: install
    `@mcp-abap-adt/adt-clients-legacy` and construct `AdtClientLegacy` from
    it.
- **Order of publishing.** adt-clients `37.4.0` first, then
  adt-clients-legacy `0.1.0`. After that, a clean install of the legacy
  package from the registry.

## 6. Not in this change

- the legacy MCP server;
- HTTP for legacy;
- the trace members (`listRequests`, `getRequestsByUri`, `scheduleTrace`),
  which stay kept and unmeasured;
- the message-class metadata document for 7.40;
- the 18 families 7.40 does not have, which stay refused.
