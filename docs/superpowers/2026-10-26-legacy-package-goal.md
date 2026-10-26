# Goal: the legacy classes in a package of their own, tested end to end

## The target

The `*Legacy` classes move into a separate npm package that lives in this
repository, next to `packages/adt-strategies`. Those classes are the
clients, the object handlers, the utils, the request and the test runners
and executors that override the endpoints 7.40 serves differently. The new
package holds everything that belongs to legacy:
- the classes;
- their unit tests;
- the live tests on SAP_BASIS 7.40 SP04 over RFC;
- the ABAP test environment (`ZCL_LG7_ENV*`, the fixtures, the manual
  runner);
- the npm scripts that drive it;
- the documentation (what 7.40 serves, how the environment is prepared and
  removed).

The main package `@mcp-abap-adt/adt-clients` then carries no legacy code at
all.

The legacy classes are finally tested as a whole. The create → lock →
update → unlock → activate → read → check → delete cycles that worked on
7.40 in the hand-run probes (records B2 and B3 in `~/prj/e77-probe/`) become
live tests in the repository, one cycle per object type.

## Why

Legacy is its own product line. The legacy MCP server will be RFC-only, with
fewer handlers, and partly driven by local reports on the system. Its
classes change for 7.40 measurements, not for the modern systems, and its
tests need a 7.40 system and an ABAP environment that a modern consumer
never needs. Kept in the main package, legacy rides along in every release
and every install. Today it is held apart only by a test rule.

The legacy surface is only half proven. The live suites in the repository
cover:
- deletes;
- refusals;
- transports;
- the unit-test runners;
- the function include;
- the transportable program.

The full cycles of the core object types were measured once, by hand,
outside the repository, and nothing keeps them working.

## What changes

- **A new package in this repository** (`packages/<legacy package>`), with
  its own `package.json`, build, unit tests, live tests, docs and release
  tag. It depends on `@mcp-abap-adt/adt-clients` by a semver range. Inside
  the repository it may link to it while developing. At release,
  adt-clients is published first.
- **The main package loses legacy.** These go from it:
  - the `*Legacy` classes and helpers;
  - the `AdtClientLegacy` / `AdtExecutorLegacy` exports;
  - any choice of a legacy class in `createAdtClient` /
    `createAdtExecutor`.

  It exports whatever a subclass in another package needs to extend its
  classes: the object handlers, the content-type base and the helpers the
  legacy classes use today. Nothing beyond that.
- **The legacy rule follows the code.** The AST test that keeps legacy
  inside `*Legacy` classes becomes two rules:
  - the main package contains no legacy at all;
  - the legacy package changes only what it overrides.
- **Live cycles from B2/B3** become tests in the legacy package, one per
  object type, each on its own objects with the `ZLG7` prefix. The types:
  - class, with its local test, types, definitions and macros includes;
  - program;
  - interface;
  - function group and function module;
  - DDL source;
  - message class and its messages;
  - include;
  - function include.

  Each step is asserted on the request it sends and the answer 7.40 gives,
  as measured. A step the probes did not measure is measured first, then
  written down.
- **Docs.**
  - The legacy package gets a README of its own: what it is, how to
    construct it, what 7.40 serves, the environment and its two runners.
  - `docs/architecture/LEGACY.md` moves with it.
  - The main package's docs say that legacy is a separate package.
  - CHANGELOGs for both packages.

## Holds throughout

- **Legacy differences live only in the legacy classes**, as `extends` and
  `override` of the modern classes. The main code never handles legacy.
- **The system type is declared by the consumer, never detected.** A
  consumer that wants legacy constructs the legacy client.
- **Legacy is RFC-only.** It reads and writes over RFC; HTTP is not a
  supported legacy wire.
- **Live tests:**
  - they never delete what they did not create;
  - they never release a transport;
  - they never touch another user's objects;
  - they run as the test user only;
  - any credential refusal stops the run at once, with no retry.
- **Dependencies come only from the registry.** The two packages in this
  repository may be linked while developing; at release every range
  resolves on npm.
- **A request's headers are the caller's.** The library passes them
  through. Where 7.40 needs a specific media type, the caller (later, the
  legacy server) sends it, as with the class metadata `Accept`.
- **Claims say "measured on 7.40 SP04"**, never "BASIS < 7.50".

## Scope

In scope:
- the package split;
- the main package's exports;
- the AST rules;
- the B2/B3 cycles as live tests;
- the docs;
- the CHANGELOGs.

Out of scope:
- the legacy MCP server;
- HTTP for legacy;
- legacy runtime, debugger, batch, abapGit and the WS family (as in the
  7.40 spec);
- members 7.40 does not serve, which stay refused.

Decided:
- The package is `@mcp-abap-adt/adt-clients-legacy`.
- Moving the legacy classes out of `@mcp-abap-adt/adt-clients` is a minor: nobody used the legacy members.
- What ADT does not serve on 7.40 stays refused; the user's LLM writes modifying ABAP through the legacy MCP server for it — no handlers here.
- The goal is live tests for every handler whose endpoints ADT exposes on 7.40; the test environment is a utility for them.
