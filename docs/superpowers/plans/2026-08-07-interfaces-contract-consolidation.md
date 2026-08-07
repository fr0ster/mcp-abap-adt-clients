# Interfaces Contract Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@mcp-abap-adt/interfaces` the single place a consumer imports from to use
the library — move the 34 contract types adt-clients still declares itself, delete 26 handler
aliases nobody uses, and stop adt-clients from exporting types at all.

**Architecture:** Types and constants a consumer must import in order to *call* the library
move to `interfaces`. Implementation — clients, parsers, request builders — stays in
adt-clients and imports its own contract. Aliases that are only a composition of two types
already in `interfaces` are deleted rather than moved: a consumer can write the composition.

**Tech Stack:** TypeScript (strict, CommonJS), Jest, Biome, two npm packages.

**Why now:** ruled 2026-08-07 while reviewing the transport plan, which had put a new error
class and a URL constant in adt-clients. The package exists so a consumer has one import
point and can override anything it wants; a contract split across two packages has no seam to
substitute at. This ships in the **same interfaces release** as the transport types — see
`2026-08-07-transport-list-configuri.md`, Tasks 1–2, which this plan joins.

## Global Constraints

- All repository artifacts in **English**.
- `@mcp-abap-adt/interfaces` publishes to npm **before** adt-clients consumes it. No `file:`,
  no tarball, no `"link": true` in `package-lock.json` — verify after every `npm install`.
- **Versions are decided** — interfaces 14.0.0, adt-clients 11.0.0, both major, ruled
  2026-08-07. Bump, then `npm install --package-lock-only` in the same commit.
- Claude opens PRs, merges **reviewed** PRs, tags. `npm publish` is the user's.
- Biome: single quotes, semicolons, 2-space indent. `npm run lint` before every commit.
- Unit tests: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`.
- No SAP system is touched by any task in this plan.

## The inventory, measured 2026-08-07

The `interfaces` barrel exports 372 symbols. adt-clients exports 104 from its own modules.
**Name collisions: zero** — so this is a gap, not duplication, and nothing has drifted.

| group | count | disposition |
|---|---|---|
| handler aliases (`AdtClassType` …) | 26 | **delete** — Task 1 |
| abapGit types | 12 | move — Task 2 |
| executor types | 10 | move — Task 3 |
| debugger types | 5 | move — Task 4 |
| batch types | 3 | move — Task 5 |
| content-type types + 2 constants | 4 | move — Task 6 |
| client configuration | 2 | move — Task 7 |
| classes and functions | 42 | **stay** — implementation |

---

## Phase 1 — adt-clients, deletions that need no release

### Task 1: Delete the 26 handler aliases

**Files:**
- Modify (delete one `export type` each): `src/core/{accessControl,appendStructure,behaviorDefinition,behaviorImplementation,class,dataElement,ddl,domain,enhancement,functionGroup,functionModule,interface,messageClass,metadataExtension,package,program,scalarFunction,scalarFunctionImplementation,serviceDefinition,structure,table,tabletype,transformation,transport,unitTest}/index.ts`
- Modify: `src/index.core.ts` — remove the 26 matching `export type { … }` lines

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This is pure removal.

Every one of these is a composition of two types that already live in `interfaces`:

```ts
export type AdtClassType = IAdtSourceObject<IClassConfig, IClassState>;
export type AdtRequestType = IAdtObject<ITransportConfig, ITransportState>;
export type AdtDomainType = IAdtNonVersionedObject<IDomainConfig, IDomainState>;
```

They are used **nowhere** — not in `src/`, not in `docs/`, not in `README.md`. Verified by
grep 2026-08-07: each name appears exactly twice, at its own definition and in the barrel.
A consumer that wants the type writes the composition, with both halves imported from
`interfaces`. Moving them would carry sugar across a package boundary; keeping them "for
compatibility" through a major is how the junk survives every major.

**One adt-clients branch carries everything that ships in 11.0.0** — this task, Phase 3, and
the transport plan's Phase B. Create it here, check it out everywhere else.

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
git checkout main && git pull --ff-only
git checkout -b feat/11.0.0-contract-and-transport
```

- [ ] **Step 1: Confirm they are still unused before removing anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
for t in AdtAccessControlType AdtAppendStructureType AdtBehaviorDefinitionType \
  AdtBehaviorImplementationType AdtClassType AdtDataElementType AdtDdlType AdtDomainType \
  AdtEnhancementType AdtFunctionGroupType AdtFunctionModuleType AdtInterfaceType \
  AdtMessageClassType AdtMessageClassMessageType AdtMetadataExtensionType AdtPackageType \
  AdtProgramType AdtScalarFunctionType AdtScalarFunctionImplementationType \
  AdtServiceDefinitionType AdtStructureType AdtTableType AdtDdicTableTypeAlias \
  AdtTransformationType AdtRequestType AdtUnitTestType; do
  n=$(grep -rn "\b$t\b" src docs README.md 2>/dev/null | grep -vc "export type\|index.core.ts")
  [ "$n" != "0" ] && echo "STILL USED: $t ($n)"
done
echo "scan complete"
```

Expected: only `scan complete`. Any `STILL USED` line means that alias is not dead — stop and
report it rather than deleting.

- [ ] **Step 2: Delete each alias at its definition**

25 of them are a single `export type Name = …;` statement in `src/core/<module>/index.ts`.
Delete the statement and any import that becomes unused as a result — the type arguments
(`IClassConfig`, `IAdtSourceObject`) are often imported only for the alias.

Two need care:

- `src/core/tabletype/index.ts:12` — the alias is named `AdtDdicTableTypeAlias`.
- `src/core/enhancement/index.ts` — the alias is defined as `AdtEnhancement` and renamed at
  the barrel (`export type { AdtEnhancement as AdtEnhancementType }`). Delete both halves.
- `src/core/messageClass/index.ts:24,32` — two aliases in one file.

- [ ] **Step 3: Remove the barrel lines**

In `src/index.core.ts`, delete every `export type { Adt…Type } from './core/…';` line for the
names above, including `export type { AdtEnhancement as AdtEnhancementType } from './core/enhancement';`
and `export type { AdtDdicTableTypeAlias } from './core/tabletype';`.

- [ ] **Step 4: Verify the build and the whole unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean. `subpathExports.test.ts` asserts only that each barrel
resolves its primary **class**, so removing types cannot break it — if it does, a barrel lost
more than intended.

- [ ] **Step 5: Commit**

```bash
git add src/core src/index.core.ts
git commit -m "refactor!: delete the 26 handler type aliases

BREAKING CHANGE: AdtClassType, AdtRequestType, AdtDomainType and 23 others
are gone. Each was IAdtObject<IXxxConfig, IXxxState> and nothing more, with
both halves already exported by @mcp-abap-adt/interfaces — write the
composition. None was used anywhere in this repository or its docs."
```

---

## Phase 2 — interfaces, the contract that was in the wrong package

Each of Tasks 2–7 adds one file to `interfaces` and exports it from the barrel. The
adt-clients side — deleting the local declaration and importing instead — is Phase 3, after
the release, because that is the direction the dependency runs.

**The procedure is identical for every task; it is written out in full in Task 2.**

### Task 2: abapGit contract → interfaces

**Files:**
- Create: `../mcp-abap-adt-interfaces/src/adt/IAdtAbapGit.ts`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/abapGit.ts` (create)
- Read from: `src/clients/abapGit/types.ts` (the declarations to move, verbatim)

**Interfaces:**
- Consumes: nothing.
- Produces, all 12: `AbapGitStatus`, `IAbapGitErrorLogEntry`, `IAbapGitExternalRepoBranch`,
  `IAbapGitExternalRepoCredentials`, `IAbapGitExternalRepoInfo`, `IAbapGitLinkArgs`,
  `IAbapGitPullArgs`, `IAbapGitPullResult`, `IAbapGitRepoStatus`, `IAbapGitUnlinkArgs`,
  `IAdtAbapGitClient`, `IAdtAbapGitClientOptions`. Phase 3 Task 9 imports them.

**Branch first:**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
# NB: this repo's default branch is master, not main.
git checkout master && git pull --ff-only
git checkout -b feat/contract-consolidation
```

- [ ] **Step 1: Copy the declarations verbatim**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
cat src/clients/abapGit/types.ts
```

Create `../mcp-abap-adt-interfaces/src/adt/IAdtAbapGit.ts` with the same declarations,
unchanged — same names, same fields, same doc comments. This is a move, not a redesign: a
rename here turns one reviewable diff into two unreviewable ones.

Header it with why it lives here now:

```ts
/**
 * ADT-integrated abapGit — the contract a consumer calls.
 *
 * Declared here rather than in adt-clients because a consumer must import these
 * to use the client at all, and the point of this package is that there is one
 * place to import from and one place to override.
 */
```

If a declaration references a type from adt-clients that is **not** in this package, stop:
that dependency has to move first, and the task order is wrong. (Checked 2026-08-07:
`src/clients/abapGit/types.ts` has no imports at all, so this does not arise here.)

- [ ] **Step 2: Write the compile-only assertion**

Create `../mcp-abap-adt-interfaces/src/__typechecks__/abapGit.ts`:

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import type {
  AbapGitStatus,
  IAbapGitLinkArgs,
  IAbapGitPullResult,
  IAdtAbapGitClient,
} from '../adt/IAdtAbapGit';

// The union is closed: a status this package does not know is not a status.
const _status: AbapGitStatus = 'A';
void _status;

// @ts-expect-error not a member of the union
const _bogus: AbapGitStatus = 'definitely-not-a-status';
void _bogus;

// The client interface is implementable by something that is not our class —
// which is the whole point of publishing it.
const _client: Pick<IAdtAbapGitClient, 'listRepos'> = {
  listRepos: async () => [],
};
void _client;

const _link: IAbapGitLinkArgs = {} as IAbapGitLinkArgs;
const _pull: IAbapGitPullResult = {} as IAbapGitPullResult;
void _link;
void _pull;
```

Replace `'A'` with a real member of `AbapGitStatus` as copied in Step 1, and give `_client`
a method the interface actually declares. Read the file — do not guess the names.

- [ ] **Step 3: Export from the barrel**

In `../mcp-abap-adt-interfaces/src/index.ts`, add, in alphabetical position among the other
`./adt/…` exports:

```ts
export type {
  AbapGitStatus,
  IAbapGitErrorLogEntry,
  IAbapGitExternalRepoBranch,
  IAbapGitExternalRepoCredentials,
  IAbapGitExternalRepoInfo,
  IAbapGitLinkArgs,
  IAbapGitPullArgs,
  IAbapGitPullResult,
  IAbapGitRepoStatus,
  IAbapGitUnlinkArgs,
  IAdtAbapGitClient,
  IAdtAbapGitClientOptions,
} from './adt/IAdtAbapGit';
```

- [ ] **Step 4: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
npm run test:check 2>&1 | tee typecheck.log
npm run lint:check
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/adt/IAdtAbapGit.ts src/index.ts src/__typechecks__/abapGit.ts
git commit -m "feat(abapgit): the abapGit contract belongs in the contract package"
```

---

### Task 3: Executor contract → interfaces

**Files:**
- Create: `../mcp-abap-adt-interfaces/src/execution/IAdtExecutors.ts`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/executors.ts` (create)
- Read from: `src/executors/types.ts`

**Interfaces:**
- Produces, all 10: `IClassExecuteWithProfilerOptions`, `IClassExecuteWithProfilingOptions`,
  `IClassExecuteWithProfilingResult`, `IClassExecutionTarget`, `IClassExecutor`,
  `IProgramExecuteWithProfilerOptions`, `IProgramExecuteWithProfilingOptions`,
  `IProgramExecuteWithProfilingResult`, `IProgramExecutionTarget`, `IProgramExecutor`.
  Phase 3 Task 10 imports them.

`interfaces` already has a `src/execution/` directory — put it there, not under `adt/`.

- [ ] **Step 1: Copy the declarations verbatim from `src/executors/types.ts`**

Same rule as Task 2: names, fields and comments unchanged. If a declaration references a
profiler type from adt-clients that is not yet in this package, stop and move that first.

- [ ] **Step 2: Write the compile-only assertion**

Create `src/__typechecks__/executors.ts`, asserting the two executor interfaces are
implementable by something other than our classes:

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import type {
  IClassExecutor,
  IProgramExecutor,
} from '../execution/IAdtExecutors';

// Published so a consumer can substitute its own runner — a stub must satisfy it.
const _class = {} as IClassExecutor;
const _program = {} as IProgramExecutor;
void _class;
void _program;
```

- [ ] **Step 3: Export the 10 names from the barrel**, alphabetically among the
  `./execution/…` exports.

- [ ] **Step 4: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

- [ ] **Step 5: Commit**

```bash
git add src/execution/IAdtExecutors.ts src/index.ts src/__typechecks__/executors.ts
git commit -m "feat(execution): executor options and results move to the contract package"
```

---

### Task 4: Debugger contract → interfaces

**Files:**
- Create: `../mcp-abap-adt-interfaces/src/runtime/IAdtDebuggerSession.ts`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/debuggerSession.ts` (create)
- Read from: `src/clients/DebuggerSessionClient.ts`

**Interfaces:**
- Produces, all 5: `DebuggerStepAction`, `IDebuggerAttachParams`,
  `IDebuggerGetVariablesParams`, `IDebuggerListenParams`, `IDebuggerStepParams`.
  Phase 3 Task 11 imports them.

**One dependency to check first.** `DebuggerSessionClient.ts` imports `AdtClientsWS`, which is
a **class** and stays in adt-clients. Copy only the five type declarations; if any of them
mentions `AdtClientsWS` in its own shape, that member cannot move as-is — report it rather
than weakening the type to `unknown`.

- [ ] **Step 1: Copy the five declarations verbatim**

`interfaces` already has `src/runtime/` — put the file there.

- [ ] **Step 2: Write the compile-only assertion**

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import type {
  DebuggerStepAction,
  IDebuggerAttachParams,
} from '../runtime/IAdtDebuggerSession';

// The step action is a closed union — a debugger cannot be asked to do
// something this package has not named.
const _step: DebuggerStepAction = 'stepInto';
void _step;

// @ts-expect-error not a member of the union
const _bogus: DebuggerStepAction = 'teleport';
void _bogus;

const _attach: IDebuggerAttachParams = {} as IDebuggerAttachParams;
void _attach;
```

Replace `'stepInto'` with a real member as copied in Step 1 — read the file.

- [ ] **Step 3: Export the 5 names from the barrel.**

- [ ] **Step 4: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

- [ ] **Step 5: Commit**

```bash
git add src/runtime/IAdtDebuggerSession.ts src/index.ts src/__typechecks__/debuggerSession.ts
git commit -m "feat(runtime): debugger session parameters move to the contract package"
```

---

### Task 5: Batch contract → interfaces

**Files:**
- Create: `../mcp-abap-adt-interfaces/src/adt/IAdtBatch.ts`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/batch.ts` (create)
- Read from: `src/batch/types.ts` (no imports — moves cleanly)

**Interfaces:**
- Produces: `IBatchPayload`, `IBatchRequestPart`, `IBatchResponsePart`.
  Phase 3 Task 12 imports them.

- [ ] **Step 1: Copy the three declarations verbatim.**

- [ ] **Step 2: Write the compile-only assertion**

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import type {
  IBatchRequestPart,
  IBatchResponsePart,
} from '../adt/IAdtBatch';

// A consumer that builds or inspects a batch payload itself needs these to be
// describable without importing the implementation package.
const _part: IBatchRequestPart = {} as IBatchRequestPart;
const _response: IBatchResponsePart = {} as IBatchResponsePart;
void _part;
void _response;
```

- [ ] **Step 3: Export the 3 names from the barrel.**

- [ ] **Step 4: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

- [ ] **Step 5: Commit**

```bash
git add src/adt/IAdtBatch.ts src/index.ts src/__typechecks__/batch.ts
git commit -m "feat(batch): batch payload shapes move to the contract package"
```

---

### Task 6: Content types and their two constants → interfaces

**Files:**
- Create: `../mcp-abap-adt-interfaces/src/adt/IAdtContentTypes.ts`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/contentTypes.ts` (create)
- Read from: `src/core/shared/contentTypes.ts` (no imports)

**Interfaces:**
- Produces: types `IAdtContentTypes`, `IAdtHeaders`; **values** `AdtContentTypesBase`,
  `AdtContentTypesModern`. Phase 3 Task 13 imports all four.

The two constants move with the types they populate. `interfaces` already ships runtime
values — `ADT_SESSION_ERROR`, `AdtObjectErrorCodes`, `SERVICE_BINDING_VARIANT_MAP` — so this
adds no new kind of thing to the package.

`resolveContentTypes()` is a **function** and stays in adt-clients: it picks between the two
constants by inspecting a system, which is behaviour, not contract.

- [ ] **Step 1: Copy the two interfaces and the two constants verbatim.**

- [ ] **Step 2: Write the compile-only assertion**

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import {
  AdtContentTypesBase,
  AdtContentTypesModern,
  type IAdtContentTypes,
} from '../adt/IAdtContentTypes';

// Both shipped sets satisfy the shape a consumer may override.
const _base: IAdtContentTypes = AdtContentTypesBase;
const _modern: IAdtContentTypes = AdtContentTypesModern;
void _base;
void _modern;

// And a consumer's own set does too — the reason this is published.
const _custom: IAdtContentTypes = { ...AdtContentTypesBase };
void _custom;
```

- [ ] **Step 3: Export from the barrel** — the two types with `export type`, the two
  constants with a plain `export {}`.

- [ ] **Step 4: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

- [ ] **Step 5: Commit**

```bash
git add src/adt/IAdtContentTypes.ts src/index.ts src/__typechecks__/contentTypes.ts
git commit -m "feat(adt): content-type contract and its two shipped sets move to interfaces"
```

---

### Task 7: Client configuration → interfaces

**Files:**
- Create: `../mcp-abap-adt-interfaces/src/adt/IAdtClientOptions.ts`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/clientOptions.ts` (create)
- Read from: `src/clients/AdtClient.ts:181-197`

**Interfaces:**
- Consumes: `IAdtContentTypes` from Task 6 — `IAdtClientOptions.contentTypes` is typed by it,
  so **Task 6 must land first**.
- Produces: `IAdtClientOptions`, `IAdtSystemContext`. Phase 3 Task 14 imports them, and the
  transport plan's step E adds `transportListParser` to `IAdtClientOptions` here rather than
  in adt-clients.

This is the one a consumer cannot avoid: configuring the client at all means importing it.

Note the existing declaration types `contentTypes` with an inline `import(...)` of an
adt-clients path:

```ts
contentTypes?: import('../core/shared/contentTypes').IAdtContentTypes;
```

That inline import is exactly the seam this plan removes. In the moved copy it becomes a
normal import of the type from Task 6.

- [ ] **Step 1: Copy both declarations, replacing the inline import**

```ts
/**
 * How a consumer configures an ADT client.
 *
 * Here rather than in adt-clients because configuring the client is the first
 * thing a consumer does, and it should not require importing the implementation
 * package to describe.
 */

import type { IAdtContentTypes } from './IAdtContentTypes';

export interface IAdtSystemContext {
  masterSystem?: string;
  responsible?: string;
  /** Master/original language for newly created objects (adtcore:masterLanguage). Sourced from SAP_LANGUAGE; defaults to EN when unset. */
  masterLanguage?: string;
}

export interface IAdtClientOptions {
  enableAcceptCorrection?: boolean;
  masterSystem?: string;
  responsible?: string;
  /** Master/original language for newly created objects. Falls back to EN when unset. */
  masterLanguage?: string;
  contentTypes?: IAdtContentTypes;
  /** Whether the SAP system uses Unicode encoding. Affects Content-Type headers for source code operations. */
  unicode?: boolean;
}
```

- [ ] **Step 2: Write the compile-only assertion**

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import { AdtContentTypesModern } from '../adt/IAdtContentTypes';
import type {
  IAdtClientOptions,
  IAdtSystemContext,
} from '../adt/IAdtClientOptions';

// Every field is optional: a client can be built with no configuration at all.
const _empty: IAdtClientOptions = {};
void _empty;

// And the content-type set a consumer overrides is the one this package ships.
const _configured: IAdtClientOptions = {
  enableAcceptCorrection: true,
  contentTypes: AdtContentTypesModern,
  unicode: false,
};
void _configured;

const _context: IAdtSystemContext = { masterSystem: 'TRL', responsible: 'CB99' };
void _context;
```

- [ ] **Step 3: Export both from the barrel.**

- [ ] **Step 4: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

- [ ] **Step 5: Commit**

```bash
git add src/adt/IAdtClientOptions.ts src/index.ts src/__typechecks__/clientOptions.ts
git commit -m "feat(adt): client options and system context move to the contract package

The declaration typed contentTypes with an inline import of an adt-clients
path — the exact seam this removes."
```

---

### Task 8: Release interfaces

This is the **same release** as the transport plan's Tasks 1–2. Do not cut two.

- [ ] **Step 1: Confirm the transport types are on the same branch**

Tasks 1 and 2 of `2026-08-07-transport-list-configuri.md` add `IListTransportsParams`,
`IListTransportsOptions`, `ITransportSearchConfiguration`, `IDeferredResponseConnection` and
`hasDeferredResponses`. They must be committed to `feat/contract-consolidation` too, plus the
two symbols that plan originally put in adt-clients and this ruling moves here:

- `TransportSearchConfigurationMissing` — the error class a consumer catches. Precedent:
  `AdtOperationError` already lives in `src/adt/AdtTypes.ts`.
- `TRANSPORT_SEARCH_CONFIGURATIONS_URL` — the constant a consumer needs to fetch a
  `configUri` itself.

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git log --oneline main..feat/contract-consolidation
```

Expected: the six commits from Tasks 2–7 plus the two transport commits.

- [ ] **Step 2: Version — decided: 14.0.0**

Ruled by the user 2026-08-07: **major**. `13.1.0 → 14.0.0`.

The moves themselves are additive — nothing leaves `interfaces` and no shape changes — but
`IListTransportsParams` is narrowed to a required `configUri`, which breaks every existing
caller on its own. A minor would have been a lie about a type that stops compiling.

- [ ] **Step 3: Update the documentation**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rn "IAdtClientOptions\|abapGit\|executor\|IBatch" README.md docs/ 2>/dev/null | tee docs-hits.log
```

Read `docs-hits.log` and update every hit. The package README should say what the package is
**for** — one import point, so a consumer can override anything — because that is the rule
that decided every move in this plan.

- [ ] **Step 4: CHANGELOG, bump, lock, build**

```bash
npm version 14.0.0 --no-git-tag-version
npm install --package-lock-only
grep -n '"link": true' package-lock.json || echo "no local links — good"
npm run build 2>&1 | tee build.log
```

- [ ] **Step 5: PR, review, merge, tag, hand over**

```bash
git add -A
git commit -m "release(14.0.0): consolidate the contract into one package"
git push -u origin feat/contract-consolidation
gh pr create --title "release(14.0.0): consolidate the contract into one package" \
             --body "$(cat <<'BODY'
## Why

The package exists so a consumer has one import point and can override
anything it wants. 34 contract types were still declared in adt-clients, so
using the library meant importing from two packages and there was no single
seam to substitute at.

Measured 2026-08-07: the barrel exported 372 symbols; adt-clients exported
104 from its own modules, **with zero name collisions** — a gap, not
duplication, so nothing had drifted.

## What moves in

abapGit (12), executors (10), debugger (5), batch (3), content types and
their two shipped constant sets (4), client options and system context (2),
plus the transport contract and the deferred-response atom.

## What does not

Classes, parsers and request builders stay in adt-clients — that is
implementation. `resolveContentTypes()` stays too: it inspects a system to
pick between the two constant sets, which is behaviour.

## Deleted, separately, in adt-clients

The 26 handler aliases (`AdtClassType` and friends). Each was
`IAdtObject<IXxxConfig, IXxxState>` with both halves already here, and none
was used anywhere.
BODY
)"
```

After the user's review:

```bash
gh pr merge <N> --squash --delete-branch
git checkout master && git pull --ff-only
git tag -a v14.0.0 -m "consolidate the contract into one package" && git push --tags
```

Then **stop** and tell the user: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm publish`.

Verify before continuing:

```bash
npm view @mcp-abap-adt/interfaces version
```

---

## Phase 3 — adt-clients stops declaring its own contract

All of Phase 3 is one branch and one release, together with the transport plan's Phase B.

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
git checkout feat/11.0.0-contract-and-transport          # created in Task 1 — do not branch again
rm -rf node_modules/@mcp-abap-adt/interfaces
npm install @mcp-abap-adt/interfaces@14.0.0 --save-dev
grep '"version"' node_modules/@mcp-abap-adt/interfaces/package.json
```

The `grep` on `node_modules` is the check that counts: `npm view` reports the registry, not
what got installed.

Tasks 9–14 are the mirror of Tasks 2–7: the declaration is now in `interfaces`, so the local
copy goes and every user of it imports across the package boundary instead. Each is one
commit and is independently reviewable — a reviewer can reject the abapGit move while
approving batch.

### Task 9: adt-clients imports the abapGit contract

**Files:**
- Modify: `src/clients/abapGit/types.ts` — delete the declarations
- Modify: `src/index.abapgit.ts` — delete the matching `export type { … }` line
- Modify: every file that used them — see below

**Interfaces:**
- Consumes from `@mcp-abap-adt/interfaces@14.0.0`: `AbapGitStatus`, `IAbapGitErrorLogEntry`, `IAbapGitExternalRepoBranch`, `IAbapGitExternalRepoCredentials`, `IAbapGitExternalRepoInfo`, `IAbapGitLinkArgs`, `IAbapGitPullArgs`, `IAbapGitPullResult`, `IAbapGitRepoStatus`, `IAbapGitUnlinkArgs`, `IAdtAbapGitClient`, `IAdtAbapGitClientOptions` (moved there by Task 2).
- Produces: nothing. adt-clients stops exporting these names.

Users to repoint: `AdtAbapGitClient` in `src/clients/AdtAbapGitClient.ts` and everything under `src/clients/abapGit/`.

- [ ] **Step 1: Find every use before deleting anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "IAdtClientOptions\|IAdtSystemContext" src | grep -v node_modules   # adjust the names per task
```

Replace the names in that command with this task's symbols. Read the whole output — a
declaration used in a place you did not expect is the signal that it is not purely contract.

- [ ] **Step 2: Delete the local declarations from `src/clients/abapGit/types.ts`**

Delete only the type declarations. Classes, functions and constants in the same file stay
unless this task names them.

- [ ] **Step 3: Import the same names from `@mcp-abap-adt/interfaces` at every use site**

The names and shapes are identical — this is a path change, nothing else. If a shape needs
adjusting to compile, the move in Task 2 was not verbatim; fix it there, not here.

- [ ] **Step 4: Delete the barrel line in `src/index.abapgit.ts`**

adt-clients no longer hands out contract types. A consumer imports them from `interfaces`,
which is the entire point of the release.

- [ ] **Step 5: Build and run the unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor!: import the abapGit contract from interfaces

BREAKING CHANGE: adt-clients no longer exports these types. Same names,
same shapes, different package — import from @mcp-abap-adt/interfaces."
```

---

### Task 10: adt-clients imports the executor contract

**Files:**
- Modify: `src/executors/types.ts` — delete the declarations
- Modify: `src/index.executors.ts` — delete the matching `export type { … }` line
- Modify: every file that used them — see below

**Interfaces:**
- Consumes from `@mcp-abap-adt/interfaces@14.0.0`: `IClassExecuteWithProfilerOptions`, `IClassExecuteWithProfilingOptions`, `IClassExecuteWithProfilingResult`, `IClassExecutionTarget`, `IClassExecutor`, `IProgramExecuteWithProfilerOptions`, `IProgramExecuteWithProfilingOptions`, `IProgramExecuteWithProfilingResult`, `IProgramExecutionTarget`, `IProgramExecutor` (moved there by Task 3).
- Produces: nothing. adt-clients stops exporting these names.

Users to repoint: `AdtExecutor` in `src/clients/AdtExecutor.ts` and everything under `src/executors/`.

- [ ] **Step 1: Find every use before deleting anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "IAdtClientOptions\|IAdtSystemContext" src | grep -v node_modules   # adjust the names per task
```

Replace the names in that command with this task's symbols. Read the whole output — a
declaration used in a place you did not expect is the signal that it is not purely contract.

- [ ] **Step 2: Delete the local declarations from `src/executors/types.ts`**

Delete only the type declarations. Classes, functions and constants in the same file stay
unless this task names them.

- [ ] **Step 3: Import the same names from `@mcp-abap-adt/interfaces` at every use site**

The names and shapes are identical — this is a path change, nothing else. If a shape needs
adjusting to compile, the move in Task 3 was not verbatim; fix it there, not here.

- [ ] **Step 4: Delete the barrel line in `src/index.executors.ts`**

adt-clients no longer hands out contract types. A consumer imports them from `interfaces`,
which is the entire point of the release.

- [ ] **Step 5: Build and run the unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor!: import the executor contract from interfaces

BREAKING CHANGE: adt-clients no longer exports these types. Same names,
same shapes, different package — import from @mcp-abap-adt/interfaces."
```

---

### Task 11: adt-clients imports the debugger contract

**Files:**
- Modify: `src/clients/DebuggerSessionClient.ts` — delete the declarations
- Modify: `src/index.ws.ts` — delete the matching `export type { … }` line
- Modify: every file that used them — see below

**Interfaces:**
- Consumes from `@mcp-abap-adt/interfaces@14.0.0`: `DebuggerStepAction`, `IDebuggerAttachParams`, `IDebuggerGetVariablesParams`, `IDebuggerListenParams`, `IDebuggerStepParams` (moved there by Task 4).
- Produces: nothing. adt-clients stops exporting these names.

Users to repoint: `DebuggerSessionClient` itself — the declarations sit in the same file as the class, so delete only the `export type`/`export interface` blocks and leave the class.

- [ ] **Step 1: Find every use before deleting anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "IAdtClientOptions\|IAdtSystemContext" src | grep -v node_modules   # adjust the names per task
```

Replace the names in that command with this task's symbols. Read the whole output — a
declaration used in a place you did not expect is the signal that it is not purely contract.

- [ ] **Step 2: Delete the local declarations from `src/clients/DebuggerSessionClient.ts`**

Delete only the type declarations. Classes, functions and constants in the same file stay
unless this task names them.

- [ ] **Step 3: Import the same names from `@mcp-abap-adt/interfaces` at every use site**

The names and shapes are identical — this is a path change, nothing else. If a shape needs
adjusting to compile, the move in Task 4 was not verbatim; fix it there, not here.

- [ ] **Step 4: Delete the barrel line in `src/index.ws.ts`**

adt-clients no longer hands out contract types. A consumer imports them from `interfaces`,
which is the entire point of the release.

- [ ] **Step 5: Build and run the unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor!: import the debugger contract from interfaces

BREAKING CHANGE: adt-clients no longer exports these types. Same names,
same shapes, different package — import from @mcp-abap-adt/interfaces."
```

---

### Task 12: adt-clients imports the batch contract

**Files:**
- Modify: `src/batch/types.ts` — delete the declarations
- Modify: `src/index.batch.ts` — delete the matching `export type { … }` line
- Modify: every file that used them — see below

**Interfaces:**
- Consumes from `@mcp-abap-adt/interfaces@14.0.0`: `IBatchPayload`, `IBatchRequestPart`, `IBatchResponsePart` (moved there by Task 5).
- Produces: nothing. adt-clients stops exporting these names.

Users to repoint: `buildBatchPayload.ts`, `parseBatchResponse.ts`, `BatchRecordingConnection.ts`.

- [ ] **Step 1: Find every use before deleting anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "IAdtClientOptions\|IAdtSystemContext" src | grep -v node_modules   # adjust the names per task
```

Replace the names in that command with this task's symbols. Read the whole output — a
declaration used in a place you did not expect is the signal that it is not purely contract.

- [ ] **Step 2: Delete the local declarations from `src/batch/types.ts`**

Delete only the type declarations. Classes, functions and constants in the same file stay
unless this task names them.

- [ ] **Step 3: Import the same names from `@mcp-abap-adt/interfaces` at every use site**

The names and shapes are identical — this is a path change, nothing else. If a shape needs
adjusting to compile, the move in Task 5 was not verbatim; fix it there, not here.

- [ ] **Step 4: Delete the barrel line in `src/index.batch.ts`**

adt-clients no longer hands out contract types. A consumer imports them from `interfaces`,
which is the entire point of the release.

- [ ] **Step 5: Build and run the unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor!: import the batch contract from interfaces

BREAKING CHANGE: adt-clients no longer exports these types. Same names,
same shapes, different package — import from @mcp-abap-adt/interfaces."
```

---

### Task 13: adt-clients imports the content-type contract

**Files:**
- Modify: `src/core/shared/contentTypes.ts` — delete the declarations
- Modify: `src/index.core.ts` — delete the matching `export type { … }` line
- Modify: every file that used them — see below

**Interfaces:**
- Consumes from `@mcp-abap-adt/interfaces@14.0.0`: types `IAdtContentTypes`, `IAdtHeaders` and constants `AdtContentTypesBase`, `AdtContentTypesModern` (moved there by Task 6).
- Produces: nothing. adt-clients stops exporting these names.

Users to repoint: `resolveContentTypes()` in `src/utils/systemInfo.ts`, which STAYS here — it inspects a system to choose between the two constant sets, which is behaviour, not contract.

- [ ] **Step 1: Find every use before deleting anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "IAdtClientOptions\|IAdtSystemContext" src | grep -v node_modules   # adjust the names per task
```

Replace the names in that command with this task's symbols. Read the whole output — a
declaration used in a place you did not expect is the signal that it is not purely contract.

- [ ] **Step 2: Delete the local declarations from `src/core/shared/contentTypes.ts`**

Delete only the type declarations. Classes, functions and constants in the same file stay
unless this task names them.

- [ ] **Step 3: Import the same names from `@mcp-abap-adt/interfaces` at every use site**

The names and shapes are identical — this is a path change, nothing else. If a shape needs
adjusting to compile, the move in Task 6 was not verbatim; fix it there, not here.

- [ ] **Step 4: Delete the barrel line in `src/index.core.ts`**

adt-clients no longer hands out contract types. A consumer imports them from `interfaces`,
which is the entire point of the release.

- [ ] **Step 5: Build and run the unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor!: import the content-type contract from interfaces

BREAKING CHANGE: adt-clients no longer exports these types. Same names,
same shapes, different package — import from @mcp-abap-adt/interfaces."
```

---

### Task 14: adt-clients imports the client-configuration contract

**Files:**
- Modify: `src/clients/AdtClient.ts` — delete the declarations
- Modify: `src/index.core.ts` — delete the matching `export type { … }` line
- Modify: every file that used them — see below

**Interfaces:**
- Consumes from `@mcp-abap-adt/interfaces@14.0.0`: `IAdtClientOptions`, `IAdtSystemContext` (moved there by Task 7).
- Produces: nothing. adt-clients stops exporting these names.

Users to repoint: `AdtClient`, `AdtClientLegacy`, `AdtClientBatch`, `AdtRuntimeClient`, `AdtExecutor`, `createAdtClient` — every constructor that takes options, plus every `import type { IAdtSystemContext } from '../../clients/AdtClient'` in `src/core/*/Adt*.ts`.

- [ ] **Step 1: Find every use before deleting anything**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "IAdtClientOptions\|IAdtSystemContext" src | grep -v node_modules   # adjust the names per task
```

Replace the names in that command with this task's symbols. Read the whole output — a
declaration used in a place you did not expect is the signal that it is not purely contract.

- [ ] **Step 2: Delete the local declarations from `src/clients/AdtClient.ts`**

Delete only the type declarations. Classes, functions and constants in the same file stay
unless this task names them.

- [ ] **Step 3: Import the same names from `@mcp-abap-adt/interfaces` at every use site**

The names and shapes are identical — this is a path change, nothing else. If a shape needs
adjusting to compile, the move in Task 7 was not verbatim; fix it there, not here.

- [ ] **Step 4: Delete the barrel line in `src/index.core.ts`**

adt-clients no longer hands out contract types. A consumer imports them from `interfaces`,
which is the entire point of the release.

- [ ] **Step 5: Build and run the unit suite**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs. Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor!: import the client-configuration contract from interfaces

BREAKING CHANGE: adt-clients no longer exports these types. Same names,
same shapes, different package — import from @mcp-abap-adt/interfaces."
```

---


### Task 15: Release adt-clients

Folded into the transport plan's Task 9 — one adt-clients major carrying both the transport
fix and this consolidation. Its CHANGELOG gains:

```markdown
### Breaking

- adt-clients no longer exports contract types. `IAdtClientOptions`,
  `IAdtSystemContext`, `IAdtContentTypes`, `IAdtHeaders`, `AdtContentTypesBase`,
  `AdtContentTypesModern`, the three `IBatch*`, the twelve abapGit types, the ten
  executor types and the five debugger types now come from
  `@mcp-abap-adt/interfaces`.

  **Migration:** change the import path. The names and shapes are unchanged.

  ```ts
  // before
  import type { IAdtClientOptions } from '@mcp-abap-adt/adt-clients';
  // after
  import type { IAdtClientOptions } from '@mcp-abap-adt/interfaces';
  ```

- The 26 handler aliases are deleted (Task 1, already done): `AdtClassType`,
  `AdtRequestType`, `AdtDomainType` and the rest. Each was
  `IAdtObject<IXxxConfig, IXxxState>` and nothing more, and none of them
  resolves against the package any more.

  **Migration:** write the composition, with both halves from
  `@mcp-abap-adt/interfaces` — for the former `AdtClassType`:

  ```ts
  import type { IAdtSourceObject, IClassConfig, IClassState } from '@mcp-abap-adt/interfaces';
  type AdtClassType = IAdtSourceObject<IClassConfig, IClassState>;
  ```
```

---

## Ordering

```
Task 1 (delete aliases, adt-clients)     ── independent, can go first or last
Task 6 (content types) ──► Task 7 (client options, needs IAdtContentTypes)
Tasks 2,3,4,5           ── independent of each other
        └──────────────► Task 8 (one interfaces release, with transport Tasks 1–2)
                              └──► user publishes ──► Phase 3, Tasks 9–14
                                                          └──► transport Phase B
```

The only hard dependency inside Phase 2 is Task 6 before Task 7.
