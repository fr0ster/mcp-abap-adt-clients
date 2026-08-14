# Honest Capabilities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No handler declares a capability it does not have, and none carries a method that
does not do what its capability promises.

**Architecture:** Two positive atoms split out of `IAdtModifiable`; one negative composite
deleted; ten handlers narrowed to the exact intersection of atoms they satisfy; `unitTest`'s
CRUD half given a subject; three behavioural defects fixed; and a guard — manifest, compile-time equality over the full
handler × atom product, and per-atom behaviour tests — that keeps the state true.

**Tech Stack:** TypeScript (strict, CommonJS), Jest, Biome. Two npm packages.

**Spec:** `docs/superpowers/specs/2026-08-13-honest-capabilities-finish.md`, beside this file,
approved 2026-08-13 after eight review rounds. **Read it before Task 1** — every number here
comes from it.

## Status — 2026-08-14

| phase | state |
|---|---|
| **A** — behavioural fixes in adt-clients (Tasks 1–4) | **done and released**, adt-clients 11.1.0 (PR #107, `0bef713`) |
| **B** — the atoms, in interfaces (Tasks 5–6) | **done, released and published**, interfaces 15.0.0 (PR #35, `e22c52c`, `npm view` → 15.0.0) |
| **C** — narrowing, in adt-clients (Tasks 6a–10) | **not started**; Task 6a is unblocked now that 15.0.0 is on npm |

Per task:

| task | state |
|---|---|
| 1 `functionGroup.activate` | done — `b508926` |
| 2 `transport.update`/`delete` | done — `8baa25d` |
| 3 `unitTest.validate` | done — `2b17f5a`, corrected in `2c97af3` |
| 4 release adt-clients 11.1.0 | done — `0bef713` |
| 5 split `IAdtModifiable`, delete `IAdtNonVersionedObject` | done — `83582ef` |
| 6 release interfaces 15.0.0 | done — `bf1a9ff`, plus review fixes `2517b03`, `d35f1ab` |
| 6a take interfaces 15.0.0 | **next** |
| 7 delete `create()` aliases | **withdrawn** — see the task for why |
| 8 narrow the ten handlers | open |
| 8a `IUnitTestConfig` describes a test class — interfaces major | open |
| 8b `AdtUnitTest`'s CRUD half | open |
| 8c delete unit testing's seven absent methods | open |
| 9 the guard | open |
| 10 release adt-clients — the narrowing | open |

Checkboxes below are ticked for Tasks 1–6 accordingly.

## Global Constraints

- All repository artifacts in **English**.
- Contract types live in `@mcp-abap-adt/interfaces` and are imported; never redefined locally.
- **Publish the dependency first.** interfaces must be on npm before adt-clients consumes it.
  No `file:`, no tarball, no `"link": true` — verify after every `npm install`.
- Claude opens PRs, merges **reviewed** PRs, tags. `npm publish` is the user's, on the user's
  timing — state the dependency, never the request.
- Biome: single quotes, semicolons, 2-space indent. `npm run lint` before every commit.
- adt-clients unit tests: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`.
- **No SAP run is needed by this plan.** Every check is a unit test or a type check.
- interfaces default branch is **`master`**; adt-clients is **`main`**.

## The two rules everything here follows

1. **An interface states what an object supports, never what it does not.** Absence is
   expressed by not declaring an atom. A name reaching for "Non…", "…Without…" or "…Except…"
   means an atom should be dropped, not a type added.
2. **The verbs are invariant.** `create` → POST, `read` → GET, `update` → PUT, `delete` →
   DELETE, `check` → POST, `activate` → POST. A handler that cannot meet its atom's verb does
   not have that capability — the guard rejecting it is the guard working.

## Scope, fixed

| | count | who |
|---|---|---|
| handlers with a problem | 11 | the 11 below; no handler loses `create()` — see Task 7 |
| type/API subtraction | **10** | the 10 declaring unsupported atoms |
| behavioural code | 3 | `transport`, `unitTest.validate`, `functionGroup.activate` |
| dead-method deletion | 1 | `unitTest` — seven methods; `update`/`delete` are implemented instead |

**The ten declaring unsupported atoms:** `dataElement`, `domain`, `functionGroup`, `package`,
`messageClass`, `authorizationField`, `featureToggle`, **`functionInclude`**,
`AdtServiceBinding`, `transport`.

Two different criteria feed that ten, which is why it is easy to miscount — and was
miscounted, in both directions, before this line was written:

- **nine by versions**: the ten version-stubbers *minus* `unitTest`. `unitTest` carries version
  stubs but never *declared* `IAdtVersionable` — they are undeclared dead methods, deleted in
  Task 8c — and its one real overclaim, `IAdtValidatable` over a mock, is fixed behaviourally
  in Phase A rather than by narrowing. It needs no *narrowing*; Task 8a changes its config type
  for a different reason — its CRUD half gains a subject.
- **plus `functionInclude`**, which has no version stub at all and joins by a different route:
  it declares `IAdtTransportAware` while its `readTransport` throws.

Nine plus one is **ten**, and that is the whole subtraction. It was fifteen until 2026-08-14,
when the five `create()` aliases turned out not to be aliases and the task deleting them was
withdrawn — see Task 7 for the evidence and the ruling.

---

## Phase A — behavioural fixes in adt-clients

These are independent of every type change and ship on their own. They come first because the
guard cannot be switched on over a handler whose method lies.

**Branch:** `feat/honest-capabilities` off `main` in
`/home/okyslytsia/prj/mcp-abap-adt-clients`.

### Task 1: `functionGroup.activate` must read the server's answer

**Files:**
- Modify: `src/core/functionGroup/AdtFunctionGroup.ts` — three call sites, one at line 711
- Read only: `src/core/functionGroup/activation.ts` — its request is already correct, verb and
  URL both; nothing there changes
- Test: `src/__tests__/unit/core/functionGroup/activateReportsFailure.test.ts` (create)

**Interfaces:** consumes `assertActivationSucceeded` from `src/utils/activationUtils.ts`.
Produces nothing new.

The defect: `activateFunctionGroup` POSTs correctly, then returns the raw response. Neither it
nor its caller reads `<msg type="E">`, so `AdtFunctionGroup` returns `{ activateResult, errors: [] }`
whatever the server said. Nine other handlers call `assertActivationSucceeded`; this one has
its own implementation and was missed when 10.0.2 fixed the rest.

This is the defect 10.0.2 removed: `activationExecuted=false` means no work was done, **not**
failure; only an error-severity `<msg>` is the verdict.

- [x] **Step 1: Write the failing test**

```ts
/**
 * Activation is judged by the messages, never by a flag — and never by silence.
 *
 * This handler POSTs correctly and then ignores what comes back, so a failed
 * activation reached the caller as `errors: []`. Nine other handlers call
 * assertActivationSucceeded; this one has its own activation and was missed
 * when 10.0.2 fixed them.
 */
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtFunctionGroup } from '../../../../core/functionGroup/AdtFunctionGroup';

const FAILED = `<?xml version="1.0" encoding="utf-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <msg objDescr="ZFG_TEST" type="E" line="12"
       href="/sap/bc/adt/functions/groups/zfg_test">
    <shortText><txt>Function group ZFG_TEST could not be activated</txt></shortText>
  </msg>
</chkl:messages>`;

const connectionReturning = (body: string) => {
  const calls: { url: string; method: string }[] = [];
  return {
    calls,
    connection: {
      connect: async () => {},
      getBaseUrl: async () => 'https://example',
      getSessionId: () => null,
      setSessionType: () => {},
      makeAdtRequest: async (o: { url: string; method: string }) => {
        calls.push({ url: o.url, method: o.method });
        return { data: body, status: 200, statusText: 'OK', headers: {} } as unknown as IAdtResponse;
      },
    } as unknown as IAbapConnection,
  };
};

describe('function group activation reports what the server said', () => {
  it('rejects when the response carries an error-severity message', async () => {
    const { connection } = connectionReturning(FAILED);

    await expect(
      new AdtFunctionGroup(connection).activate({ functionGroupName: 'ZFG_TEST' }),
    ).rejects.toThrow(/could not be activated/);
  });

  it('still POSTs to the activation resource', async () => {
    const { connection, calls } = connectionReturning('<chkl:messages/>');

    await new AdtFunctionGroup(connection).activate({ functionGroupName: 'ZFG_TEST' });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/sap/bc/adt/activation');
  });

  it('does not treat an empty message list as failure', async () => {
    const { connection } = connectionReturning('<chkl:messages/>');

    const state = await new AdtFunctionGroup(connection).activate({
      functionGroupName: 'ZFG_TEST',
    });

    expect(state.errors).toEqual([]);
  });
});
```

Read the real `IFunctionGroupConfig` for the argument name before writing — `functionGroupName`
is the expected field but confirm it.

- [x] **Step 2: Run it, confirm the first case fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/functionGroup 2>&1 | tee unit-run.log
```

Expected: the error-message case fails — today the handler resolves with `errors: []`.

- [x] **Step 3: Call the shared assert**

In `AdtFunctionGroup.ts`, at **all three** call sites of `activateFunctionGroup` (around lines
221, 565 and 711), pass the response through:

```ts
import { assertActivationSucceeded } from '../../utils/activationUtils';
// …
const result = await activateFunctionGroup(this.connection, functionGroupName);
assertActivationSucceeded('Function group', result.data);
```

Do not change `activation.ts`'s request — the verb and URL are already right.

- [x] **Step 4: Verify**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
npx tsc -p tsconfig.json     # production sources
npm run test:check           # the tests — tsconfig.json excludes src/__tests__
npm run lint
```

- [x] **Step 5: Commit**

```bash
git add src/core/functionGroup src/__tests__/unit/core/functionGroup
git commit -m "fix(functionGroup): activation must report what the server said

The POST was right and the answer was thrown away: neither activation.ts nor
its caller read <msg type=\"E\">, so a failed activation reached the caller as
errors: []. Nine handlers call assertActivationSucceeded; this one has its own
activation and was missed when 10.0.2 fixed the rest."
```

---

### Task 2: `transport.update` and `transport.delete`

**Files:**
- Create: `src/core/transport/update.ts`, `src/core/transport/delete.ts`
- Modify: `src/core/transport/AdtRequest.ts` — replace both stubs
- Test: `src/__tests__/unit/core/transport/updateDelete.test.ts` (create)

The stubs say "immutable after creation" and "cannot be deleted via ADT". Both are false: ADT
changes a request's description, and deletes an **empty** request. `AdtPackage` implements both
against the same server — read `src/core/package/update.ts` and `delete.ts` for the shape.

- [x] **Step 1: Read the reference implementation**

```bash
cat src/core/package/update.ts src/core/package/delete.ts
cat src/core/transport/read.ts   # for the item URL and its Accept header
```

The item resource is `/sap/bc/adt/cts/transportrequests/<NUMBER>` and takes
`application/vnd.sap.adt.transportorganizer.v1+xml` — captured 2026-08-07, and different from
the collection's type.

- [x] **Step 2: Write the failing tests**

Assert, against a recording connection:

- `update` issues **exactly two requests, in order: a GET then a PUT**, both to the item URL,
  with the new description in the PUT body. The mock answers the GET with a realistic
  transport-request body — an empty one is what silently corrupted read-modify-write updates
  before. Step 3 fixes this shape; the test does not leave it open;
- `delete` issues exactly one **DELETE** to the item URL;
- neither touches the collection or the search-configuration endpoint;
- `update` without a description rejects **before** any request goes out.

- [x] **Step 3: Implement, following `package`'s shape**

**Use read-modify-write: GET, patch the description, PUT.** This is decided here rather than
left to the implementer, because no test in this plan can settle it — a recording mock cannot
prove the server accepts a partial body, and the plan takes no SAP run. `package` does it this
way for a reason that applies unchanged: building the XML from scratch drops every field the
client does not model, which is how a domain update once shipped without its description and
the server blamed something else.

So the test asserts **exactly one GET followed by exactly one PUT**, and the mock answers the
GET with a realistic transport-request body. If a later SAP run shows a partial PUT is
accepted, simplifying is cheap; guessing the other way corrupts data.

- [x] **Step 4: Replace the stubs in `AdtRequest.ts`** and delete the "not supported" messages.

- [x] **Step 5: Verify and commit**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
npx tsc -p tsconfig.json     # production sources
npm run test:check           # the tests — tsconfig.json excludes src/__tests__
npm run lint
git commit -m "fix(transport): update and delete work — the stubs were false

ADT changes a transport request's description and deletes an empty one;
AdtPackage does both against the same server. The stubs claimed the request
was immutable and undeletable."
```

---

### Task 3: `unitTest.validate` — real validation

**Files:**
- Modify: `src/core/unitTest/AdtUnitTest.ts`
- Test: `src/__tests__/unit/core/unitTest/validateIsReal.test.ts` (create)

**The dead methods are NOT deleted here.** They move to Phase C, next to the other
deletions and immediately before the shape guard that needs them gone. Keeping them out of
Phase A is what lets that release stay additive.

**`validate()`** currently checks an argument and returns what its own comment calls "a mock
success response". **Validation follows what is created, not which handler you are in.** A run
against a class creates only the local test class, so the container is confirmed to exist and
the test code is checked; `validateClassName` — a name check for an object that does not exist
yet — would be meaningless against a class that is already there. `AdtCdsUnitTest` does create a
global dummy class, so that name *is* validated, and it needs its own override.

- [x] **Step 1: Write the failing test** — `validate` issues a request and reports what came
  back; a container that is not there produces errors rather than an empty success.

- [x] **Step 2: Implement it from the existing checks** — `AdtClass.read` for the container,
  `checkClassLocalTestClass` via `this.adtLocalTestClass` for the code, `validateClassName` for
  the CDS dummy class. Delete nothing, and write no new low-level function.

- [x] **Step 3: Verify and commit**

```bash
git commit -m "fix(unitTest): validate what is actually created

A unit test's validation depends on what is born, not on the handler. Testing
a class creates only the local test class, so that is what gets checked, and
the container is confirmed to exist. Testing CDS creates a global dummy class
too, so that name is validated before creating it."
```

---

### Task 4: Release adt-clients — behavioural fixes only

**Additive, so a minor.** Three handlers get behavioural fixes across four methods; nothing is removed
and no type changes. The deletions that would have forced a major moved to Phase C.

- [x] **Step 1: Ask the user for the version.** State the assessment: additive, so a minor on
  top of 11.0.0. Wait.
- [x] **Step 2: Sweep the docs** — `README.md` and all of `docs/`, not only the changelog.
  A doc describing the old contract is worse than none.
- [x] **Step 3: CHANGELOG** — three handlers receive behavioural fixes, across four methods:
  `functionGroup.activate`, `unitTest.validate`, `transport.update` and `transport.delete`.
  Nothing is removed, so no runtime-break note belongs here — the deletions that would have
  needed one are in Phase C.
- [x] **Step 4: Bump, relock, build, full unit suite; read every log.**
- [x] **Step 5: PR, user review, merge, tag, GitHub release.** Then stop.

**Phase B does not wait for this.** `interfaces` does not depend on adt-clients, and Phase A
uses none of the new atoms — the two can run in parallel. Only **Phase C** needs both: the
atoms from B on npm, and A's behavioural fixes in place, since the guard cannot be switched on
over a handler whose method lies.

---

## Phase B — the atoms, in interfaces

**Branch:** `feat/honest-capabilities` off **`master`** in
`/home/okyslytsia/prj/mcp-abap-adt-interfaces`.

### Task 5: Split `IAdtModifiable`, delete `IAdtNonVersionedObject`

**Files:**
- Modify: `src/adt/IAdtCapabilities.ts`
- Modify: `src/adt/IAdtComposites.ts` — remove the composite and its assertion helper if unused
- Modify: `src/index.ts`
- Test: `src/__typechecks__/modifiableSplit.ts` (create)

**Produces:** `IAdtUpdatable`, `IAdtDeletable`. `IAdtModifiable` becomes their composite —
same shape, so `IAdtCrud` is unchanged and nothing implementing everything notices.

```ts
export interface IAdtUpdatable<TConfig, TReadResult = TConfig> {
  update(config: Partial<TConfig>, options?: IAdtOperationOptions): Promise<TReadResult>;
}

export interface IAdtDeletable<TConfig, TReadResult = TConfig> {
  delete(config: Partial<TConfig>): Promise<TReadResult>;
}

export interface IAdtModifiable<TConfig, TReadResult = TConfig>
  extends IAdtUpdatable<TConfig, TReadResult>,
    IAdtDeletable<TConfig, TReadResult> {}
```

Move the existing doc comments onto the atom each method now belongs to; do not rewrite them.

- [x] **Step 1: Write the compile-only assertion** — `IAdtCrud` is still assignable to and from
  the four-atom intersection (so the split is shape-preserving), and a type with `update` but
  no `delete` satisfies `IAdtUpdatable` and **not** `IAdtModifiable`.
- [x] **Step 2: Run `npm run test:check`, confirm it fails.**
- [x] **Step 3: Split the interface. Delete `IAdtNonVersionedObject` and its barrel export.**
- [x] **Step 4: `npm run test:check` and `npm run lint:check` clean.** Then prove the typecheck
  is load-bearing: merge `delete` back into `IAdtUpdatable`, confirm the assertion fails,
  revert that one edit.
- [x] **Step 5: Commit.**

### Task 6: Release interfaces — a major

Deleting an exported type is breaking.

- [x] Ask the user for the version; state that the removal forces a major.
- [x] Sweep `README.md` — it lists what the package covers. Both new atoms belong there, and
  any mention of `IAdtNonVersionedObject` must go.
- [x] CHANGELOG with the removal as a **Breaking** entry and the reason: a type defined by
  absence has no place in a capability vocabulary, and `Non` means nothing to the compiler —
  `IAdtNonVersionedObject & IAdtVersionable` compiled and handed out `getVersions`.
- [x] Bump, relock, build; PR; user review; merge; tag; GitHub release. Then stop.

**Phase C does not start until this version is on npm.**

---

## Phase C — narrowing, in adt-clients

Ten handlers, plus `unitTest`, whose entry stopped being a deletion. **Always a new branch
off the current `main`** — Phase A has been merged and released by now, so its branch is gone.

**One release, two packages.** The maintainer's ruling on `unitTest` (spec, "the stubs are a
symptom of `create()` meaning the wrong thing") makes its `update` and `delete` real rather than
dead, and that needs a config type describing a **test class** where the current one describes a
**test run**. So Phase C carries an `interfaces` round-trip in the middle of it: Task 8a changes
that contract and releases it, and the adt-clients work that depends on it waits for npm.

The order below is deliberate. Tasks 7 and 8 touch neither `unitTest` nor the new config, so
they proceed while 8a is in review and while its release is being published — nothing in the
phase is blocked on that except 8b.

### Task 6a: Take the published interfaces major

**Files:** `package.json`, `package-lock.json`.

Nothing else in Phase C compiles without it: `IAdtUpdatable` and `IAdtDeletable` do not exist
in the installed version, and the deleted `IAdtNonVersionedObject` is still there — so a
handler could keep declaring a type this work removed and nobody would notice.

- [ ] **Step 1: Confirm it is on npm** — `npm view @mcp-abap-adt/interfaces version`. If it is
  not, Phase C does not start; say so and stop.
- [ ] **Step 2: Install it as a runtime dependency**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
rm -rf node_modules/@mcp-abap-adt/interfaces
npm install @mcp-abap-adt/interfaces@<version> --save     # --save, not --save-dev
grep '"version"' node_modules/@mcp-abap-adt/interfaces/package.json
```

`--save` matters: eight modules in `dist/` carry a real `require()` of this package, so
dev-only would leave consumers resolving a module npm never installed for them. This was got
wrong once already.

- [ ] **Step 3: Verify the resolution**

```bash
node -e "console.log(require('./package.json').dependencies['@mcp-abap-adt/interfaces'])"
grep -n '"link": true\|"file:' package-lock.json || echo "no local links — good"
grep -rn "IAdtNonVersionedObject" node_modules/@mcp-abap-adt/interfaces/dist/ || echo "composite gone — good"
```

The last line is the point of the task: if that type is still in the installed package, the
wrong version is installed.

- [ ] **Step 4: Commit `package.json` and `package-lock.json` together**, before any source
  change depends on them.

### Task 7 — withdrawn: `create` and `update` are always separate operations

**Nothing to do. Kept as a record, because the deletion it proposed was carried in this plan for
two days and its evidence is worth keeping.**

The task read "delete the five `create()` aliases" — `AdtMessageClassMessage`,
`AdtLocalTestClass`, `AdtLocalTypes`, `AdtLocalDefinitions`, `AdtLocalMacros` — on the grounds
that each already has a separate `update()`, so `create()` had nothing of its own to do. The
2026-08-13 verification behind that established only that a separate `update()` *exists*; it
never compared the two bodies. Read side by side, four of the five differ:

| handler | `create` vs `update` |
|---|---|
| `AdtLocalTestClass` | `create` honours `activateOnCreate`; `update` honours `activateOnUpdate` **and** a low-level `options.lockHandle` path that writes inside a lock the caller already holds |
| `AdtLocalTypes`, `AdtLocalDefinitions`, `AdtLocalMacros` | same low-level `lockHandle` path on `update` only |
| `AdtMessageClassMessage` | both are `return this._upsertMessage(config)` — the same line twice |

**Ruled 2026-08-14: `create` and `update` are always separate operations.** Almost every object
in this library has both, and some have `run` on top. That a server answers them with the same
PUT is a fact about the wire, not about the API: the two verbs mean different things to a
caller, and collapsing them would make this library the odd one out among its own handlers.

So no handler loses `create()` and none loses `IAdtCreatable`. `AdtMessageClassMessage`'s
implementation being one upsert behind two names is an observation about that handler, not a
reason to remove one of them — if it is worth changing, the change is to give `create` the
create semantics, not to delete it.

### Task 8: Narrow the ten handlers that declare what they cannot do

Per handler, replace the declared composite with the exact intersection of atoms it satisfies.
The spec's cluster tables give the starting point; **read each class** before writing its list.

| handler | drops |
|---|---|
| `dataElement`, `domain`, `functionGroup`, `package` | `IAdtVersionable` |
| `messageClass` | `IAdtVersionable`, `IAdtTransportAware`, `IAdtActivatable`, `IAdtCheckable` |
| `authorizationField`, `featureToggle` | `IAdtVersionable`, `IAdtTransportAware` |
| `functionInclude` | `IAdtTransportAware` |
| `AdtServiceBinding` | `IAdtVersionable`, `IAdtLockable` |
| `transport` | everything ADT does not give it; `IAdtValidatable` goes too — a request's number is system-generated, so `validate()` is deleted, not implemented |
`unitTest` is deliberately absent from this table: its declared atoms are correct as far as they
go, and what it needs is not narrowing but implementation — Tasks 8a to 8c.

Then delete every stub whose atom is gone, until
`grep -rn "is not supported" src/core/*/Adt*.ts` returns nothing and
`throwUnsupportedVersions` has no call site left and is itself deleted.

- [ ] One commit per handler, so a reviewer can reject one without the rest.

### `unitTest` — what changed, and why it is three tasks

An earlier version of this plan deleted nine methods from `AdtUnitTest` and called it done. The
maintainer's ruling replaced that: a unit-test handler has **CRUD and run, and they are different
things**. The test class is created **once**; it is run **as many times as needed**, and `run`
must work with no CRUD call at all, because the tests may already be in the class.

`create()` today means "start a run". **That is the whole reason `update` and `delete` looked
dead** — with creation meaning execution there was nothing to update or delete. The stubs were
two operations sharing one method, not ADT lacking a capability: `AdtLocalTestClass` implements
every one of them, and the integration tests call it directly for exactly that reason.

So the target is:

| method | subject | meaning |
|---|---|---|
| `read` / `update` / `delete` / `validate` | the local test class | manage the test code inside its container |
| `run` / `getRunId` / `getStatus` / `getResult` | a run | execute whatever tests the class holds, any number of times |

Everything else — `activate`, `check`, `lock`, `unlock`, `getVersions`, `getVersionSource`,
`readTransport` — is deleted, as before.

**`create` stays, and `IAdtCreatable` with it** — ruled 2026-08-14: a separate `create` and
`update` is this library's convention, almost every object has both, and some have `run` on top.
An earlier draft of this plan proposed deleting it on the grounds that ADT answers both with one
PUT on the `testclasses` include. That is true of the wire and beside the point: `create` and
`update` differ in what they mean to a caller, and in `AdtLocalTestClass` they differ in code
too — `update` carries a low-level `options.lockHandle` path that writes inside an existing lock
window, and each honours a different activate flag. `create` writes the test class; `update`
replaces it; `run` needs neither to have been called in this process.

### Task 8a: The config describes a test class, not a run — interfaces major

**Repo:** `mcp-abap-adt-interfaces`, new branch off `master`.
**Files:** `src/adt/IAdtUnitTest.ts`, `CHANGELOG.md`, `README.md`, `package.json`.

This is the new interface the rework needs. `IUnitTestConfig` currently describes a **run** —
`tests`, `options`, `runId`, `status`, `result` — and every one of those fields exists to serve
`create(config)` meaning "start a run" and `read(config.runId)` meaning "poll it". Once the CRUD
half addresses the test class, none of them has a producer or a consumer: `IAdtTestRunnable.run`
already takes `IClassUnitTestDefinition[]` and `IClassUnitTestRunOptions` **as arguments**, so
running needs no config at all.

```ts
export interface IUnitTestConfig {
  /** The class holding the local test class — CLAS/OC, must already exist. */
  className: string;
  /** ABAP source of the local test class; required to write it, absent when reading. */
  testClassSource?: string;
  /** Name of the test class inside the include, when it must be named. */
  testClassName?: string;
  transportRequest?: string;
}
```

`className` and `testClassSource` are **not new names invented here**: `ICdsUnitTestConfig`,
which extends this type, already carries both with exactly these meanings — the class that holds
the tests and the source that goes into it. Aligning the parent lets the CDS config stop
redeclaring them.

`IUnitTestState`'s `runId`, `runStatus` and `runResult` go the same way and for the same reason:
after the split, the methods that return a state are the CRUD ones, and none of them produces a
run.

- [ ] **Step 1: Confirm the field-by-field claim before deleting anything** — for each of
  `tests`, `options`, `runId`, `status`, `result`, `runStatus`, `runResult`, grep both repos for
  readers. A field with a live reader outside the run half is a fact this plan got wrong; report
  it rather than deleting it.
- [ ] **Step 2:** rewrite `IUnitTestConfig` and `IUnitTestState`; drop the now-duplicated members
  from `ICdsUnitTestConfig`.
- [ ] **Step 3:** `npm run build`, `npm run test:check`, `npm run lint:check`.
- [ ] **Step 4: Release.** Removing exported members is breaking, so a major. Ask the user for
  the version; sweep `README.md` and all of `docs/`; CHANGELOG with a migration showing a run
  moving from `create({tests})` to `run(tests)`, since that is what a consumer must rewrite.
- [ ] **Step 5:** PR, user review, merge, tag, GitHub release. **Then stop** — Task 8b does not
  start until this is on npm, and `npm view @mcp-abap-adt/interfaces version` is how that is
  established, not the tag.

### Task 8b: `AdtUnitTest`'s CRUD half becomes real

**Files:** `src/core/unitTest/AdtUnitTest.ts`, `AdtCdsUnitTest.ts`,
`src/core/unitTest/types.ts`; the tests naming `create` on the handler.

Take the new interfaces version first — `--save`, then the same three resolution checks as Task
6a. Then, in `AdtUnitTest`:

- **`update(config)`** → `this.adtLocalTestClass.update({ className, testClassCode:
  config.testClassSource, testClassName, transportRequest })`. The member already exists on the
  class; this task wires it up, it does not build a second implementation.
- **`delete(config)`** → `this.adtLocalTestClass.delete(...)`, which is a PUT of empty source.
  Say so in the doc comment: a caller deleting a test class is not deleting an ADT object.
- **`read(config)`** → the test class source, via `this.adtLocalTestClass.read(...)`. It no
  longer takes a `runId`, and **that is the breaking change a consumer feels most**: polling a
  run moves to `getStatus(runId)`, which has existed since 13.1.0.
- **`validate(config)`** keeps the container-existence check written in Task 3 and finally wires
  in the second half that task had to leave out — `checkClassLocalTestClass` via
  `this.adtLocalTestClass`, once `config.testClassSource` exists to check. Task 3's report says
  in as many words that it was omitted only because the config carried nothing to check.
- **`run(tests, options)`** stops going through `create()` and calls `startClassUnitTestRun`
  directly. This is the ruling's load-bearing half: **`run` must work without any CRUD call**,
  and while it delegates to `create` it cannot be honest about that.
- **`readMetadata`** follows `read` — same subject, or delete it if `read` covers it.

`AdtCdsUnitTest` already creates a class, activates it and puts a test class inside — its own
`create` chain stays as it is; check only that it still lines up with the parent's new meaning.

#### What is locked, and by whom

Ruled 2026-08-14 as the thing to settle before writing `update`: **look at what is locked.** The
code has two answers to that and uses only one.

- **The live path locks the parent class.** `AdtLocalTestClass.create`/`update` call
  `this.lock({ className })`, inherited from `AdtClass` — `POST /sap/bc/adt/oo/classes/{name}?_action=LOCK&accessMode=MODIFY` — and pass that handle to
  `updateClassTestInclude`, which PUTs `/oo/classes/{name}/includes/testclasses?lockHandle=…`.
  The include is written under the **class's** lock.
- **A second path locks the include itself** — `lockClassTestClasses`, which POSTs
  `/oo/classes/{name}/includes/testclasses?_action=LOCK`. It exists **twice**, in
  `src/core/class/testclasses.ts` and `src/core/unitTest/classTest.ts`, with its `unlock`
  sibling, and **nothing calls either copy**. `AdtLocalTestClass` carries a standing TODO saying
  Eclipse's own logs show the parent-class lock being used, and that whether the include's LOCK
  endpoint exists in ADT discovery was never verified.

Two consequences for this task, and neither is optional:

1. **`AdtUnitTest.update` must accept `options.lockHandle` and pass it through**, exactly as
   `AdtLocalTestClass.update` does. Without it, a caller that already holds the container
   class's lock — updating the class and its tests in one window — cannot write the tests
   without the handler taking a second lock on an object it has locked. That passthrough is the
   real difference between `create` and `update` here, and it is the reason both exist.
2. **`AdtUnitTest` still declares no `IAdtLockable`, and now for a stated reason** rather than
   by omission: the lock belongs to the container class, so a caller takes it through
   `getClass().lock()` and hands the handle down. Task 8c deletes the throwing `lock`/`unlock`
   on that basis.

**Decide the dead include-lock path while here.** Either it is verified against the trial and
one copy becomes the live path, or both copies go. Two unreferenced implementations of a lock
nobody takes is the same class of defect as the stubs this plan exists to remove — and a probe
is the only way to answer it, so if no SAP run is available, delete them and say why.

**One live defect blocks `delete`.** `AdtLocalTestClass.delete(config)` calls
`update({ ...config, testClassCode: '' })`, and `update` opens with
`if (!config.testClassCode) throw new Error('Test class code is required')` — an empty string is
falsy, so **delete always throws before issuing a request**. Its own TODO notes this. Fix it in
this task (`update` must distinguish "no source given" from "empty source given"), or
`AdtUnitTest.delete` will be a new method delegating to a broken one.

- [ ] **Step 1: Write the failing tests first** — `update` PUTs the source it was given and,
  given `options.lockHandle`, takes no lock of its own; `delete` PUTs empty source; `read`
  returns the include, not a run; `run` issues the run request **with no preceding create**;
  `validate` issues both the container read and the source check.
- [ ] **Step 2: Implement.** `create()` **stays** and keeps `IAdtCreatable` (see the ruling
  above); it writes the test class where `update` replaces it, over the corresponding
  `AdtLocalTestClass` methods.
- [ ] **Step 3: Verify** — `npx tsc -p tsconfig.json`, `npm run test:check`, the unit suite.
- [ ] **Step 4: Commit** with a `BREAKING CHANGE:` footer covering all three: `create` changes
  subject from a run to the test class, `read` with it, and the config changes shape.

### Task 8c: Delete what unit testing genuinely does not have

**Files:** `src/core/unitTest/AdtUnitTest.ts`; any test naming them.

Seven methods, implemented but never declared, so nothing in the contract promises them and no
TypeScript caller can reach them: `activate`, `check`, `lock`, `unlock`, `getVersions`,
`getVersionSource` — all throwing — plus **`readTransport`**, which does not throw at all: it
returns an empty state and says in its own comment that a test run has no transport request.

`update` and `delete` are **not** on this list any more; Task 8b implements them.

`check` is deleted rather than implemented even though the include does have a check resource —
`validate` makes exactly that call, and two names for one request is a duplication this plan is
removing elsewhere. `lock`/`unlock` go because **the lock is the container class's**: it is
taken on `/oo/classes/{name}`, not on the include, so a caller that needs to hold it takes it
through `getClass().lock()` and passes the handle to `update` (Task 8b, "What is locked, and by
whom"). A `lock` on the unit test would name an object ADT does not lock.

They sit here rather than in Phase A for two reasons. Deleting a public method is a runtime
break for JavaScript callers, and Phase A is otherwise additive — no need to force a major for
it. And the shape guard in Task 9 cannot run while they exist: TypeScript reads shape, not
intent, so a class carrying `check` satisfies `IAdtCheckable` however little it declares.

- [ ] **Step 1: Confirm the class declares none of the seven**

```bash
sed -n '/^export class AdtUnitTest/,/^{/p' src/core/unitTest/AdtUnitTest.ts
```

Expected after Task 8b: `IAdtCreatable`, `IAdtReadable`, `IAdtUpdatable`, `IAdtDeletable`,
`IAdtValidatable`, `IAdtTestRunnable`. If any of the seven **is** declared, it is a contract change and needs saying
in the changelog as one.

- [ ] **Step 2: Delete them; update any test that calls one.**
- [ ] **Step 3: Verify** — `npx tsc -p tsconfig.json`, `npm run test:check`, the unit suite.
- [ ] **Step 4: Commit** with a `BREAKING CHANGE:` footer naming all seven and the runtime
  consequence: a JavaScript caller moves from a sentence to `TypeError: … is not a function`.

### Task 9: The guard

**Files:**
- Create: `src/__tests__/unit/capabilities/manifest.ts`
- Create: `src/__tests__/unit/capabilities/shape.ts` — compile-time
- Create: `src/__tests__/unit/capabilities/behaviour.test.ts` — runtime
- Create: `src/__tests__/unit/capabilities/completeness.test.ts` — runtime

**This task must come after Tasks 8 and 8c**, and the spec says why: TypeScript reads shape,
not intent, so while a handler still carries an undeclared method — `unitTest`'s seven, deleted
in 8c — it satisfies that atom structurally and the bidirectional check would demand the
manifest claim it.

**The subject of every check is the FACTORY RETURN TYPE, not the concrete class.** A consumer
never names `AdtClass`; it calls `client.getClass()`, and that method's declared return type is
the contract it receives:

```ts
getClass(): IAdtSourceObject<IClassConfig, IClassState>
getDomain(): IAdtNonVersionedObject<IDomainConfig, IDomainState>   // the composite being deleted
```

Checking the class would let a getter keep a wide composite while the class underneath is
narrow, and see nothing wrong. Measured 2026-08-13: **37 getters on `AdtClient` against 18
handler classes exported from the package root** — so a class-based check is blind to 19
handlers as well as to every getter's own type.

```ts
type PublicContract<C, K extends keyof C> = C[K] extends (...a: never[]) => infer R ? R : never;
```

**Both clients, not just `AdtClient`.** `AdtClientLegacy` overrides several getters, and an
override's return type can differ from what it overrides — a legacy handler could keep a wide
contract while the modern one is narrowed, and a check over `AdtClient` alone would never look.
So each registry entry names its variant, and the mapped product runs over both:

```ts
export const HANDLERS = {
  'class@modern': { client: 'modern', factory: (c: AdtClient) => c.getClass(), … },
  'request@legacy': { client: 'legacy', factory: (c: AdtClientLegacy) => c.getRequest(), … },
};
```

The runtime side needs the same care: `Object.getOwnPropertyNames(AdtClientLegacy.prototype)`
lists only what the subclass declares, so **walk the prototype chain** or the inherited getters
vanish from completeness — the opposite of what that check exists to do.

**Check 1 — shape, compile time, bidirectional and generated.** Not one line per pair: 37
getters × 11 atoms, and a forgotten line is a silent hole in the check meant to close silent
holes. A mapped type over the full product whose `as` clause drops every atom that agrees, so a
disagreeing getter keeps a key and the assertion fails naming both. The two lookups to write
are the getter registry below and the atom types bound to each handler's config.

**Check 2 — completeness, runtime, against an authoritative registry.** Package exports are not
that registry — 18 of 37. The registry is the list of factory names, and the check asserts
three things at once: every getter on `AdtClient` (and `AdtClientLegacy`) appears in it, every
registry entry has a manifest entry, and nothing is in the manifest that is not a getter. This
is what stops a new object type, copied from an existing one, arriving unchecked; that is how
the sixteen arose.

**A `get*` filter is not the criterion.** Of the 37, `getUtils()` returns `AdtUtils` — search,
where-used, package hierarchy — which is not an object handler and has no capability matrix.
Any purely mechanical rule that admits it is wrong, and one that excludes it by name is a
hand-maintained list wearing a filter's clothes.

So the registry is **explicit and typed**, and it is the single source both checks read:

```ts
export const HANDLERS = {
  class:   { factory: (c: AdtClient) => c.getClass(),   … },
  program: { factory: (c: AdtClient) => c.getProgram(), … },
  // one entry per object handler; getUtils and any other non-handler factory
  // is simply absent, deliberately
} as const;
```

Completeness then asserts, in both directions:

- every getter on `AdtClient` and `AdtClientLegacy` is either in `HANDLERS` or in an explicit
  `NOT_HANDLERS` list with a one-line reason — so a new factory cannot be ignored by silence,
  only by a decision someone wrote down;
- every `HANDLERS` entry names a getter that exists.

`Object.getOwnPropertyNames(AdtClient.prototype)` supplies the runtime side of the first.

**The manifest is not a list of names.** Check 3 must *construct* each handler and *call* each
method, and that needs more than capabilities: factories take arguments, every atom needs a
valid object-specific config, and the recording connection has to answer differently for
`read`, `lock`, `getVersions` and `activate`. So each entry carries its own fixture:

```ts
export const HANDLERS = {
  class: {
    factory: (c: AdtClient) => c.getClass(),
    config: { className: 'ZCL_GUARD', packageName: '$TMP', description: 'guard' },
    responses: {
      read:        CLASS_XML,          // a realistic body, never ''
      lock:        LOCK_HANDLE_XML,    // carries the handle the atom must return
      getVersions: VERSIONS_FEED_XML,
      activate:    '<chkl:messages/>',
      default:     '',
    },
    capabilities: ['creatable', 'readable', 'updatable', 'deletable', 'validatable',
                   'checkable', 'activatable', 'lockable', 'versionable', 'transportAware'],
  },
  // getLocalTestClass and friends take arguments — the factory closure hides that
} as const;
```

**Writing these fixtures is the bulk of this task**, not an afterthought: one per handler, each
body realistic enough that the assertion means something. An empty body is what let
read-modify-write corrupt updates silently, and it would let this guard pass vacuously too.

**Check 3 — behaviour, runtime, driven by the manifest.** For each handler, for each atom it
claims, assert that atom's semantics against a recording connection. Every method of every
atom, not one per atom — `readMetadata`, `unlock` and `getVersionSource` are where stubs hid.
The verbs are invariant. And for `IAdtActivatable` the assertion is **not** merely that a POST
went out: an error-severity `<msg>` in the response must reach the caller, which is the only
check that would have caught `functionGroup`.

- [ ] **Step 1:** write Check 2 first — it is the simplest and immediately lists what the
  manifest is missing.
- [ ] **Step 2:** write the manifest from that list, one entry per handler.
- [ ] **Step 3:** Check 1. Expect it to fail at first and to name real disagreements; fix the
  manifest or the handler, never the check.
- [ ] **Step 4:** Check 3, atom by atom.
- [ ] **Step 5:** confirm the target state: no `is not supported` anywhere under
  `src/core/*/Adt*.ts`, no `throwUnsupportedVersions`, all three checks green.

### Task 10: Release adt-clients — the narrowing

A major: ten handlers lose declared capabilities, and `unitTest` changes what its methods mean.

- [ ] Ask for the version. Sweep the docs. CHANGELOG listing, per handler, what it no longer
  declares — a consumer needs to know which of its calls stops compiling.
- [ ] `unitTest` needs its own entry, because a consumer there is not losing a capability but
  finding a different one: `create({tests})` becomes `run(tests)`, `read({runId})` becomes
  `getStatus(runId)`, and `update`/`delete` start working instead of throwing. Give the before
  and after, not the list of methods.
- [ ] PR, user review, merge, tag, GitHub release. Then stop.

---

## What this plan does not do

- **No SAP run.** Every check here is a unit test or a type check. `transport.update`/`delete`
  and `unitTest`'s rewired CRUD are exercised against a recording connection; whether ADT accepts
  the exact body is proved by the first integration run after release, and the plan says so
  rather than implying coverage it does not have. For `unitTest` there is a reason to expect it
  will: the calls are `AdtLocalTestClass`'s, which the integration suite already runs.
- **No new composite.** `IAdtSourceObject` stays; nothing is added beside it.
- **`AdtMessageClass` is untouched** — it is created by a POST and keeps `IAdtCreatable`.
- **The `IAdtValidatable` question for other handlers is not reopened.** Only `transport`
  (deleted) and `unitTest` (implemented) were ruled on; any other handler whose `validate`
  turns out to be a no-op is a finding for the guard to surface, not something this plan
  pre-empts.
