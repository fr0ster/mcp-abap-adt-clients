# `adt-clients` onto the 30.0.0 contracts — implementation plan

> **Retargeted 2026-09-04, and 30.0.0 is published.** This plan was written
> against `interfaces@29.0.0` and against the assumption that the contracts
> package was closed. It was not: 30.0.0 collapsed the members that duplicated
> one endpoint, made every ADT member answer the contract, and stopped contracts
> inheriting from one another. It is on npm and installed here.
>
> **Measured against it, 2026-09-04:** `npx tsc --noEmit -p tsconfig.json` gives
> **715 error lines across 102 files**. Most of it is the 29.0.0 migration this
> plan describes and which was never executed — `IAdtCrud` (11), `IClassState`
> (9), `AdtOperationError` (8), `IAdtSourceObject` (20). The 30.0.0 delta is
> smaller than the tasks below assumed, and it changes three of them; see
> **What 30.0.0 changed in this plan** at the end.
>
> `adt-clients` migrates **once**, onto 30.0.0.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `@mcp-abap-adt/adt-clients` onto the `@mcp-abap-adt/interfaces@30.0.0` contracts, so every member answers `IAdtResponse` with SAP's own message on failure instead of throwing a fabricated one.

**Architecture:** A new `answering()` composes one request with two consumer-owned strategies — an error strategy that decides whether the answer is a failure, and a result strategy that decides how it becomes a value. Each object type declares one named result type per member in its own `types.ts`, replacing the deleted state bags. Both strategies are injected into the implementation, once: the result set is selected at the factory in `AdtClient`, and the atoms are instantiated with that set's types.

**Tech Stack:** TypeScript (strict, CommonJS), Biome, Jest. `@mcp-abap-adt/interfaces@^30.0.0`. `@mcp-abap-adt/connection` dev-only, for integration tests against a real SAP system.

## Global Constraints

- **`@mcp-abap-adt/interfaces@30.0.0` must be on npm before Task 3.** Tasks 1 and 2
  touch nothing that 30.0.0 changes and may run first; everything after them is
  blocked until the contracts release is published. No local tarball, no `file:`
  bridge, no `link: true`.
- `IResultStrategy<T>` is `(answer: IAdtWireResponse) => T` and **comes from
  `interfaces`**. This package ships implementations of it and never a second
  spelling of the type.
- **No member takes a strategy as an argument.** The choice is injected at
  construction — decision 22. A per-call parse overload was tried across 23
  members in the contracts package and reverted.
- **There is always a strategy, and the default is one too.** No member builds a
  value on its own and no branch says "nobody supplied a reading, so parse it
  ourselves". Every member obtains the answer and hands it to a strategy; the
  shipped sets — `utilsDocuments`, `transportDocuments`, `dumpDocuments` — are
  **default strategies**, not a default behaviour that an injected strategy
  replaces when one is present. Architecture decides this, not the spec: if the two ever disagree, the
  spec is what gets corrected.

  **What that costs, and it is the real work:** the parsing that lives in the
  low-level functions today — `packageContentsList.ts` and `packageHierarchy.ts`
  build their shapes with `XMLParser` before anything sees the answer, and 53
  files under `src/core` and `src/runtime` import one — moves into the shipped
  strategies. A low-level function obtains the answer; what it becomes is the
  strategy's, including the default one. A member that parses and then hands the
  parsed thing to a strategy has two readings and honours neither.

  **One old reader becomes several strategies.** `getPackageContentsList` was one
  reading nobody could choose; four replace it. A migration that moves one old
  function into one new strategy has renamed something, not made it choosable.

  **Only the pure half moves.** `IResultStrategy<T>` is
  `(answer: IAdtWireResponse) => T` — synchronous, one document, no connection —
  and the old package readers are walks, not parsers: they issue a request per
  object type and recurse into sub-packages. The mapping functions move; the walk
  is deleted, because the walk left the contract with `maxDepth` and a member
  answers one read. Task 12 Step 3 has the file-by-file list.
- **Contracts are composed, never inherited — decision 23.** No contract in
  `interfaces` extends another any more, so an implementation that used to get
  CRUD by declaring one wide contract must now list the atoms it satisfies:
  `implements IAdtServiceBinding, IAdtCreatable<IServiceBindingConfig, void>, …`.
  This is where 98 of the 715 errors are (TS2416), led by `IAdtRunnable` (18),
  `IAdtServiceBinding` (8), `IAdtInformationSystem` (7) and `IAdtAbapGitClient` (7).
- **Every atom that takes type arguments is given them.** `IAdtLockable<TConfig>`
  and `IAdtReadable<TConfig, TSource, TMetadata>` are used bare in 36 places —
  20 of them in `src/clients/AdtClient.ts` — which is TS2314 and Task 5's work,
  not a separate concern.
- All repository artifacts in English. Comments explain *why*.
- Never change `package.json` version. The number and `npm publish` are the maintainer's.
- All diagnostics through the injected `ILogger`. `console.*` is banned by `noConsole`.
- No `"link": true` in `package-lock.json`; everything resolves from the npm registry.
- Gate, stated once so the exceptions are not scattered:
  - `npm run lint:check` exits 0 on every commit **except Task 1's**, which lands
    before the five broken documentation imports are fixed.
  - `npm run build` and `npm run test:check` are expected to fail from **Task 1
    through Task 12**, and exit 0 from Task 14 onward.
- `npm run lint:check` runs `check:docs`, and **it is red for Task 1 as well, for
  five broken documentation imports** — `README.md` and `docs/usage/CLIENT_API_REFERENCE.md`
  still say `AdtOperationError` and `IClassState` come from
  `@mcp-abap-adt/interfaces`, which 29.0.0 removed. Task 2 fixes those, and from
  then on `lint:check` is green on every commit and is the gate that actually
  holds. Until it is fixed, do not read a red `lint:check` as permission to
  ignore it — check that the reported names are the five known ones.
  Three further "unchecked import" lines come from this plan naming
  `src/utils/resultStrategy.ts` before Task 2 creates it; they clear when it does.
- **One SAP-touching run at a time**, and no edits under `src/` while one is in flight.
- Test output: `npm test 2>&1 | tee test-run.log`, then read the file. Never pipe through `grep`/`head`/`tail`.
- Deleting or renaming a symbol: enumerate first, edit, then grep the repository for it **including comments, README and docs**, and compare counts before and after. Three regex sweeps in the contracts package silently deleted six types and the first field of three others while every check stayed green.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/adtResponse.ts` | `answering()`, `succeeded`, `failed`, `recogniseFailure`. The composition of the two strategies lives here and nowhere else. |
| `src/utils/resultStrategy.ts` (new) | The shipped implementations of `IResultStrategy` — `rawDocument`, `nothing`, and the short/full pairs for large answers. The *type* comes from `interfaces`; this file never redeclares it. |
| `src/core/<type>/types.ts` | One named result type per member for that object type, with the measured ADT behaviour in its doc comment. |
| `src/core/<type>/Adt<Type>.ts` | Declares the atoms it honours with those types; every member returns `answering(...)`. |
| `src/clients/AdtClient.ts` | The factory. Overloads select the result strategy; the return type is the intersection of atoms instantiated with that strategy's types. |
| `src/__tests__/unit/shared/*.test.ts` | Composition and classification, over captured real ADT answers. No SAP needed. |
| `src/__tests__/integration/**` | Behaviour against a real system. |

---

### Task 1: Remove the batch clients

Batch is research, not product: mixed GET+POST in one envelope is a server-side 500. It is deleted rather than migrated, so it cannot hold up the gate.

**Files:**
- Delete: `src/batch/` (6 files), `src/index.batch.ts`
- Delete: `src/__tests__/unit/batch/deferredResponses.test.ts`, `src/__tests__/integration/batch/BatchClient.test.ts`, `src/__tests__/integration/batch/BatchPostOperations.test.ts`, `src/__tests__/unit/runtime/debugger/abap.batch.test.ts`
- Modify: `package.json` (drop the `./batch` entry from `exports`), `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. This task only removes.

- [ ] **Step 1: Enumerate what will go**

```bash
grep -rn "batch\|Batch" src --include='*.ts' -l | sort > /tmp/batch-before.txt
wc -l /tmp/batch-before.txt
```

Record the count. Anything still matching after Step 3 that is not a changelog entry is a leftover.

- [ ] **Step 2: Delete the files**

```bash
git rm -r src/batch src/__tests__/integration/batch
git rm src/index.batch.ts src/__tests__/unit/batch/deferredResponses.test.ts
git rm src/__tests__/unit/runtime/debugger/abap.batch.test.ts
```

- [ ] **Step 3: Drop the subpath export**

In `package.json`, remove the whole `"./batch"` key from `exports`.

- [ ] **Step 4: Sweep for leftovers**

```bash
grep -rn "BatchRecordingConnection\|AdtClientBatch\|AdtRuntimeClientBatch\|index.batch" src README.md docs/ 2>/dev/null
```

Expected: no matches outside `CHANGELOG.md`. Fix any that appear, including comments.

- [ ] **Step 5: Verify the gate**

```bash
npm run build > build.log 2>&1; echo "build exit: $?"
grep -ic batch build.log
```

Run `build` **alone**: `lint:check` is red until Task 2 fixes the five broken
documentation imports, so `lint:check && npm run build` would stop at the first
and never reach the second.

Expected: **exit 1** — the migration errors are still there, which is the state
Global Constraints describes — and **0** batch matches. Piping straight into
`grep` would return 1 on the wanted result and hide the build's own exit code, so
a build that died before emitting any diagnostic would read as a pass. Other migration errors remain — see the
build exception in Global Constraints; this commit uses `--no-verify`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit --no-verify -m "refactor!: remove the batch clients

Mixed GET+POST in one envelope is a server-side 500, so batch was research
rather than product and its integration tests were red against a real system.
Deleting it removes that noise from the gate instead of migrating code nobody
can use."
```

---

### Task 2: `answering()` composes the two strategies

The mechanism the whole migration rests on. The current `answering(produce)` sees a finished value or an exception and never the wire response of a **successful** call, so `analyse` could never be consulted on the 200-with-empty-body it exists for.

**Files:**
- Create: `src/utils/resultStrategy.ts`
- Modify: `src/utils/adtResponse.ts`
- Test: `src/__tests__/unit/shared/answeringComposition.test.ts`

**Interfaces:**
- Consumes: `IAdtWireResponse`, `IAdtError`, `IAdtResponse`, `IAdtResult`, `IResultStrategy` from `@mcp-abap-adt/interfaces`; `recogniseFailure` (already in `adtResponse.ts`).
- Produces:
  - `const rawDocument: IResultStrategy<string>`
  - `const nothing: IResultStrategy<void>`
  - `type IAnalyse = (verdict: IAdtError | undefined, answer?: IAdtWireResponse) => IAdtError | undefined`
  - `answering<T>(run: () => Promise<IAdtWireResponse>, read: IResultStrategy<T>, analyse?: IAnalyse): Promise<IAdtResponse<T>>`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/shared/answeringComposition.test.ts`:

```typescript
/**
 * The composition of the two consumer-owned strategies, over answers a real
 * system gave. `adt-clients` does not decide what an ADT answer means: the error
 * strategy decides whether it is a failure, the result strategy decides how it
 * becomes a value, and the failure question is answered first.
 */
import type { IAdtError, IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { AdtSAPError } from '../../../utils/adtErrors';
import { answering, rawDocument } from '../../../utils/adtResponse';

const wire = (data: string, status = 200): IAdtWireResponse => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
});

/** Verbatim from a cloud trial, 2026-09-03. */
const REFUSAL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceNoAccess"/>' +
  '<message lang="EN">You are not authorized to make changes ' +
  '(authorization object S_ABPLNGVS)</message></exc:exception>';

describe('answering', () => {
  it('answers the value a result strategy makes of a successful body', async () => {
    const answer = await answering(async () => wire('CLASS zcl_x.'), rawDocument);

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toBe('CLASS zcl_x.');
  });

  it("carries SAP's own sentence, whole, when the request threw a refusal", async () => {
    const answer = await answering(async () => {
      throw new AdtSAPError('SAP refused the request: ' +
        'You are not authorized to make changes (authorization object S_ABPLNGVS)',
        { response: wire(REFUSAL, 403) });
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    const failure = answer.getError();
    expect(failure.origin).toBe('refusal');
    expect(failure.message).toContain('S_ABPLNGVS');
    // Not truncated: the whole document is reachable.
    expect(String(failure.response?.data)).toBe(REFUSAL);
  });

  it('consults analyse on a success, so an empty body can be called a failure', async () => {
    const analyse = (verdict: IAdtError | undefined, wireIn?: IAdtWireResponse) =>
      verdict ??
      (String(wireIn?.data ?? '') === ''
        ? { origin: 'refusal' as const, message: 'the object is not there' }
        : undefined);

    const answer = await answering(async () => wire(''), rawDocument, analyse);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().message).toBe('the object is not there');
  });

  it('lets analyse clear a refusal, and the value comes from the same answer', async () => {
    const answer = await answering(
      async () => {
        throw new AdtSAPError('refused', { response: wire('<probe/>', 404) });
      },
      rawDocument,
      () => undefined,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toBe('<probe/>');
  });

  it('cannot be cleared into a success when nothing came back', async () => {
    // A socket that would not open carries no answer, so there is nothing for a
    // result strategy to read and no honest IAdtSuccess to build.
    const answer = await answering(
      async () => {
        throw new Error('connect ECONNREFUSED');
      },
      rawDocument,
      () => undefined,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().origin).toBe('connection');
  });

  it("does not catch the result strategy's own exception", async () => {
    // A consumer's parser bug is theirs; labelling it `origin: 'connection'`
    // would advise them to reauthenticate over a defect in their own code.
    const boom = () => {
      throw new TypeError('their bug');
    };

    await expect(
      answering(async () => wire('<x/>'), boom as never),
    ).rejects.toThrow('their bug');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/shared/answeringComposition.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `rawDocument` is not exported and `answering` takes one argument.

- [ ] **Step 3: Create the result-strategy module**

Create `src/utils/resultStrategy.ts`:

```typescript
/**
 * How an ADT answer becomes a value.
 *
 * `adt-clients` does not decide what a server response *means*. This is one of
 * the two axes the consumer owns: the error strategy decides whether an answer
 * is a failure, and this decides how the same answer is presented when it is
 * not. What ships here are defaults, not the meaning.
 *
 * A strategy is chosen per implementation at the factory rather than per call, because
 * that is how consumers work: a backup tool wants documents whole for everything
 * it touches, a script wants two fields from every read, an MCP server picks by
 * what its model is about to do. None changes its mind between `create` and
 * `read` of the same object.
 */
import type { IResultStrategy } from '@mcp-abap-adt/interfaces';

/**
 * The body as it arrived.
 *
 * Not parsed, not trimmed. Decision 5 in `@mcp-abap-adt/interfaces` leaves the
 * document to whoever wants a shape out of it, and this library does not know
 * which fields a caller needs.
 *
 * **It is the default only where the member answered a document before** — dumps
 * are the case, and package contents and the transport tree are not. Each shipped
 * set defaults to what its own member already answered, which is the rule
 * `interfaces@30.0.0` encodes in its own type parameters
 * (`IAdtPackageBrowsing<TContents = IPackageContentItem[]>`,
 * `IRuntimeDumps<TList = string>`), so a consumer who names no strategy is not
 * moved by this release. Where the document is not the default it is one named,
 * exported strategy away.
 */
export const rawDocument: IResultStrategy<string> = (wire) =>
  typeof wire.data === 'string' ? wire.data : String(wire.data ?? '');

/** For members ADT answers with nothing worth reading — an unlock, a write. */
export const nothing: IResultStrategy<void> = () => undefined;
```

- [ ] **Step 4: Migrate `succeeded` and `failed` to the new response shape**

Both still answer `IAdtResponse<IAdtResult<T>>` — the extra layer 29.0.0 removed.
Left as they are, `return succeeded(read(wire))` is not assignable to
`IAdtResponse<T>`. In `src/utils/adtResponse.ts:36` and `:45`:

```typescript
/** An answer that succeeded, carrying the value the result strategy made. */
export function succeeded<T>(value: T): IAdtResponse<T> {
  return {
    ok: true,
    getResult: () => ({ value }),
    getError: () => undefined,
  };
}

/** An answer that failed, carrying what the error strategy made of it. */
export function failed<T>(error: IAdtError): IAdtResponse<T> {
  return {
    ok: false,
    getResult: () => undefined,
    getError: () => error,
  };
}
```

`getResult()` still answers `IAdtResult<T>` — that is what the contract says. What
changed is that `IAdtResult` is no longer written in the *response's* type
argument. Then sweep for the old shape:

```bash
grep -rn "IAdtResponse<IAdtResult<" src --include='*.ts'
```

Expected after this step and Task 12: no matches.

- [ ] **Step 5: Rewrite `answering` in `src/utils/adtResponse.ts`**

Replace the existing `answering` (currently at line 115) with:

```typescript
/**
 * What a consumer may say about an answer this library obtained.
 *
 * Handed the default's verdict **and** the answer it was reached from, so it can
 * overrule in either direction. Returning `undefined` means "not a failure".
 */
export type IAnalyse = (
  verdict: IAdtError | undefined,
  answer?: IAdtWireResponse,
) => IAdtError | undefined;

/**
 * Run one request and answer with the contract.
 *
 * The order is fixed: the failure question is answered first, because a result
 * strategy must not be asked to make a value out of a refusal.
 *
 * | what happened | wire in hand | may `analyse` clear it |
 * |---|---|---|
 * | returned | yes | — (there is nothing to clear) |
 * | threw, response attached | yes | **yes** — the value comes from that wire |
 * | threw, no response | no | **no** — always a failure |
 *
 * A verdict can be cleared only when there is an answer to produce a value
 * from. A socket that would not open, a dead session or a failed authentication
 * carries none, so there is no `IAdtSuccess<T>` that could honestly be built;
 * `analyse` is still called for the record, and its `undefined` is ignored.
 *
 * `read` runs **outside** the classification. An exception from it is the
 * caller's own and surfaces untouched — running it inside would label their
 * parser bug `origin: 'connection'`, advice pointing at the wrong system.
 */
export async function answering<T>(
  run: () => Promise<IAdtWireResponse>,
  read: IResultStrategy<T>,
  analyse?: IAnalyse,
): Promise<IAdtResponse<T>> {
  let wire: IAdtWireResponse | undefined;
  let verdict: IAdtError | undefined;

  try {
    wire = await run();
  } catch (error: unknown) {
    verdict = recogniseFailure(error);
    wire = (error as { response?: IAdtWireResponse })?.response;
  }

  const decided = analyse ? analyse(verdict, wire) : verdict;

  if (decided) return failed<T>(decided);
  if (!wire) {
    // `analyse` cleared a verdict for a request that produced no answer.
    return failed<T>(
      verdict ?? {
        origin: 'connection',
        message: 'The request produced no answer to read a result from',
      },
    );
  }

  // Outside the try on purpose. Their exception is theirs.
  return succeeded(read(wire));
}
```

Add to the imports at the top of the file:

```typescript
import type { IResultStrategy } from './resultStrategy';
```

And re-export the defaults so callers have one import site:

```typescript
export { rawDocument, nothing } from './resultStrategy';
```

`IResultStrategy` itself is **not** re-exported: consumers import types from
`@mcp-abap-adt/interfaces` directly, which is the whole reason that package
exists.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/shared/answeringComposition.test.ts 2>&1 | tee unit-run.log
```

Expected: 6 passed.

- [ ] **Step 7: Fix the five broken documentation imports**

`check:docs` is red before this task begins. `README.md` and
`docs/usage/CLIENT_API_REFERENCE.md` document `AdtOperationError` and
`IClassState` as coming from `@mcp-abap-adt/interfaces`; 29.0.0 removed both. Run
`npm run lint:check` to list all five, and fix each where it is written — a doc
that names a removed export is read as the authority, because nothing else checks
it. `AdtOperationError` has no replacement: catch structurally on `code`, or
catch this package's `AdtSAPError`.

After this step `lint:check` must exit 0 and stay there for the rest of the
migration.

- [ ] **Step 8: Export `recogniseFailure`**

`chain` (Task 4) classifies a real exception and cannot reach a private function.
Change `function recogniseFailure` at `src/utils/adtResponse.ts:68` to
`export function recogniseFailure`, so the classification has one home rather
than two copies that drift.

- [ ] **Step 9: Red-proof the no-wire rule**

Temporarily change the `if (!wire)` branch to `return succeeded(read(wire as never));`. Re-run. Expected: the "cannot be cleared into a success when nothing came back" case fails. Revert the change and re-run to green. A rule nobody has seen fail is a rule nobody has tested.

- [ ] **Step 10: Commit**

```bash
git add README.md docs/usage/CLIENT_API_REFERENCE.md src/utils/resultStrategy.ts src/utils/adtResponse.ts src/__tests__/unit/shared/answeringComposition.test.ts
git commit -m "feat: answering composes the error and result strategies

The old answering saw a finished value or an exception, never the wire response
of a successful call — so analyse could not be consulted on the 200-with-empty-
body it exists for, and could not clear a refusal refusalAware had already
thrown.

It now takes the request and the extraction separately, and the wire response is
passed both ways. A verdict can be cleared only when there is an answer to
produce a value from: a socket that would not open carries none, so no
IAdtSuccess could honestly be built. Red-proofed by breaking that branch."
```

---

### Task 3: Class result types and its strategy

`src/core/class/types.ts` is already written and is the worked example. This task adds the strategy that selects between shapes.

**Files:**
- Modify: `src/core/class/types.ts`
- Test: `src/__tests__/unit/core/classResultStrategy.test.ts`

**Interfaces:**
- Consumes: `IResultStrategy`, `rawDocument`, `nothing` from Task 2.
- Produces: `interface IClassResults { created; source; metadata; check; activation; validation; deletion; updated }` and `const classDocuments: IClassResults` — the default strategy set for a class implementation.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/classResultStrategy.test.ts`:

```typescript
import { classDocuments } from '../../../core/class/types';

const wire = (data: string) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

describe('the class default result strategies', () => {
  it('answers the source as it arrived', () => {
    expect(classDocuments.source(wire('CLASS zcl_x.'))).toBe('CLASS zcl_x.');
  });

  it('answers an empty source as empty rather than as absence', () => {
    // ADT answers a read for a missing class with 200 and no body. Whether that
    // is absence is the error strategy's question, not this one's.
    expect(classDocuments.source(wire(''))).toBe('');
  });

  it('answers nothing for an update', () => {
    expect(classDocuments.updated(wire(''))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/classResultStrategy.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `classDocuments` is not exported.

- [ ] **Step 3: Add the strategy set**

Append to `src/core/class/types.ts`:

```typescript
import type { IResultStrategy } from '../../utils/resultStrategy';
import { nothing, rawDocument } from '../../utils/resultStrategy';

/**
 * One strategy per member of a class implementation.
 *
 * A implementation is given a whole set at the factory rather than a strategy per call:
 * a consumer that wants documents whole wants them for every member it touches.
 */
export interface IClassResults<
  TCreated = ClassCreated,
  TSource = ClassSource,
  TMetadata = ClassMetadata,
  TCheck = ClassCheckResult,
  TActivation = ClassActivationResult,
  TValidation = ClassValidationResult,
  TDeletion = ClassDeletionResult,
  TUpdated = ClassUpdated,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
  readonly activation: IResultStrategy<TActivation>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
}

/** The shipped default: every member answers its document as it arrived. */
export const classDocuments: IClassResults = {  // all defaults
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: nothing,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/classResultStrategy.test.ts 2>&1 | tee unit-run.log
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/class/types.ts src/__tests__/unit/core/classResultStrategy.test.ts
git commit -m "feat(class): the default result strategies for a class implementation

One strategy per member, given to a implementation as a set at the factory rather than
per call — a consumer wanting documents whole wants them for every member it
touches. The default answers each document as it arrived."
```

---

### The migration inventory

Every removed state type and every file naming it. A batch is not done until its
rows are clear. Counts are from `grep -rl` on 2026-09-04; re-measure rather than
trust them.

| state | files | implementations beyond the obvious one |
|---|---:|---|
| `IClassState` | 12 | `AdtClassLegacy`, `AdtLocalDefinitions`, `AdtLocalMacros`, `AdtLocalTestClass`, `AdtLocalTypes`, `AdtClassMemberBase` |
| `IDdlState`, `IFunctionGroupState`, `IFunctionModuleState`, `IInterfaceState`, `IPackageState`, `IProgramState` | 6 each | each has an `Adt<Type>Legacy` |
| `IUnitTestState` | 6 | `AdtUnitTestLegacy`; `unitTestContractConformance.test.ts` |
| `IAuthorizationFieldState`, `IFunctionIncludeState`, `ITransformationState` | 5 each | — |
| `IIncludeState` | 4 | `__tests__/helpers/testTemplate.ts` |
| `IAccessControlState`, `IBehaviorDefinitionState`, `IBehaviorImplementationState`, `IDataElementState`, `IDomainState`, `IMessageClassState`, `IMetadataExtensionState`, `IServiceDefinitionState`, `IStructureState`, `ITableState`, `ITableTypeState`, `IEnhancementState` | 4 each | — |
| `IServiceBindingState` | 4 | `core/service/AdtService.ts` — **not** under a `<type>` directory |
| `ICdsUnitTestState` | 4 | `core/unitTest/AdtCdsUnitTest.ts` — a second implementation in one module |
| `ITransportState` | 4 | `AdtRequest`, `AdtRequestLegacy` |
| `IMessageClassMessageState` | 3 | `core/messageClass/AdtMessageClassMessage.ts` — a second implementation |
| `IAppendStructureState`, `IScalarFunctionState`, `IScalarFunctionImplementationState` | 3 each | — |
| `IFeatureToggleState` | 3 | `core/featureToggle/AdtFeatureToggle.ts` |

`IFeatureToggleRuntimeState` **survives** — it is an ADT payload shape, not a
state bag, and is still declared in `interfaces`. Do not delete it.

**Modules that hold more than one implementation**, and are therefore easy to leave half
migrated: `class` (six), `unitTest` (two), `messageClass` (two), `service` (one,
under a name that does not match its directory).

Every one of these appears in `src/clients/AdtClient.ts` as a factory return type,
so that file is not finished until the last batch is.

---

### Task 4: `AdtClass` answers the contract

**Files:**
- Create: `src/core/shared/chain.ts`
- Modify: `src/core/class/AdtClass.ts`, `src/core/class/AdtClassMemberBase.ts`,
  `src/core/class/AdtLocalDefinitions.ts`, `src/core/class/AdtLocalMacros.ts`,
  `src/core/class/AdtLocalTestClass.ts`, `src/core/class/AdtLocalTypes.ts`
  (all four class-include implementations name `IClassState` and are written under the
  parent class's lock — see `docs/architecture/`), and `src/core/class/AdtClassLegacy.ts`
- Test: `src/__tests__/unit/core/classAnswersContract.test.ts`

**Interfaces:**
- Consumes: `answering` (Task 2), `IClassResults` / `classDocuments` (Task 3), the low-level `create/read/update/delete/check/activation/validation` in `src/core/class/*.ts`, each `(connection, args, …) => Promise<IAdtWireResponse>`.
- Produces: **`AdtClass` is generic in its strategy set.** A class fixed to
  `ClassSource` could not honestly return a consumer's shape, and the factory
  overload would be lying about the runtime type. The declaration:

```typescript
export class AdtClass<R extends IClassResults<
  unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown
> = IClassResults>
  implements
    IAdtCreatable<IClassConfig, ReturnType<R['created']>>,
    IAdtReadable<IClassConfig, ReturnType<R['source']>, ReturnType<R['metadata']>>,
    IAdtUpdatable<IClassConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IClassConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IClassConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IClassConfig, ReturnType<R['check']>>,
    IAdtActivatable<IClassConfig, ReturnType<R['activation']>>,
    IAdtLockable<IClassConfig>,
    IAdtVersionable<IClassConfig>
{
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    protected readonly results: R = classDocuments as unknown as R,
  ) { /* … */ }
}
```

  **`AdtClassMemberBase` must be generic in the same `R`**, and so must the four
  class-include implementations — `AdtLocalDefinitions`, `AdtLocalMacros`,
  `AdtLocalTestClass`, `AdtLocalTypes`. `activate` and `readMetadata` are inherited from the
  base; leaving it fixed would bind them to the defaults while the `implements`
  clause promises `ReturnType<R['activation']>` and `ReturnType<R['metadata']>` —
  the class would not satisfy the atoms it claims, for exactly the members a
  consumer is least likely to test:

```typescript
export abstract class AdtClassMemberBase<
  R extends IClassResults<
    unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown
  > = IClassResults,
> {
  protected abstract readonly results: R;
  async activate(/* … */): Promise<IAdtResponse<ReturnType<R['activation']>>>;
  async readMetadata(/* … */): Promise<IAdtResponse<ReturnType<R['metadata']>>>;
}
```

  Every member's return type follows from `R`: `read` answers
  `Promise<IAdtResponse<ReturnType<R['source']>>>`, not `ClassSource`.

  **The four class-include implementations share the class's set.** They read and
  write an include of a class — `testclasses`, `localtypes`, `definitions`,
  `macros` — under the parent class's lock, so their source and their metadata are
  the class's source and metadata. Giving them sets of their own would let a
  caller ask for one shape from `getClass()` and a different one from
  `getLocalTypes()` for the same bytes, which is a choice nobody wants and four
  more sets to keep aligned:

```typescript
// src/core/class/AdtLocalTypes.ts — and the three beside it
export class AdtLocalTypes<R extends IClassResults<…> = IClassResults>
  extends AdtClassMemberBase<R>
  implements
    IAdtReadable<IClassConfig, ReturnType<R['source']>, ReturnType<R['metadata']>>,
    IAdtUpdatable<IClassConfig, ReturnType<R['updated']>>
{
  // The base declares `protected abstract readonly results: R`, so every concrete
  // subclass must carry it. Omitting it here leaves the class abstract-incompatible
  // and it will not compile — the same trap in all four.
  // The base takes five, in this order. Dropping systemContext would put
  // IAdtContentTypes where IAdtSystemContext belongs and LockRegistry where
  // contentTypes belongs — a mis-wiring a cast would hide rather than fix.
  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    protected readonly results: R = classDocuments as unknown as R,
  ) {
    super(connection, logger, systemContext, contentTypes, lockRegistry);
  }
  // … read / readMetadata / update, each `answering(…, this.results.<member>)`
}

// src/clients/AdtClient.ts — each of the four takes the same pair of overloads
getLocalTypes(): AdtLocalTypes;
getLocalTypes<R extends IClassResults<…>>(results: R): AdtLocalTypes<R>;
```

  Same for `getLocalDefinitions`, `getLocalMacros`, `getLocalTestClass`. A caller
  wanting one shape for a class and its includes passes the same set to all five,
  which is the point of it being one set. The single
  cast is on the default in the constructor, where `classDocuments` is known to
  satisfy the erased bound, and it is the only one — a cast on the *members*
  would be the factory lying, which is what this avoids.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/classAnswersContract.test.ts`:

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';

const logger = {
  log: jest.fn(), info: jest.fn(), error: jest.fn(),
  warn: jest.fn(), debug: jest.fn(),
} as unknown as ILogger;

/** ADT answers a refusal inside a 200; the document is the verdict. */
const REFUSAL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceNoAccess"/>' +
  '<message lang="EN">Object ZCL_X is locked by user XYZ</message></exc:exception>';

const answering = (data: string, status = 200): IAbapConnection =>
  ({
    setSessionType: jest.fn(),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async () => ({
      data, status, statusText: 'OK', headers: {},
    })),
  }) as unknown as IAbapConnection;

describe('AdtClass', () => {
  it('answers a result when the read succeeded', async () => {
    // Through AdtClient, not `new AdtClass`: the refusal detection that turns an
    // <exc:exception> inside a 200 into a failure is installed on the connection
    // by the client. Constructing the implementation directly skips it, and every
    // refusal test would pass as a success while proving nothing.
    const cls = new AdtClient(answering('CLASS zcl_x.'), logger).getClass();

    const response = await cls.read({ className: 'ZCL_X' });

    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(response.getError().message);
    expect(response.getResult().value).toBe('CLASS zcl_x.');
  });

  it("answers a failure carrying SAP's own sentence when it refused", async () => {
    const cls = new AdtClient(answering(REFUSAL), logger).getClass();

    const response = await cls.create({
      className: 'ZCL_X',
      packageName: 'ZPKG',
      description: 'x',
    });

    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected a failure');
    const failure = response.getError();
    expect(failure.origin).toBe('refusal');
    // The whole point: who holds the lock reaches the caller.
    expect(failure.message).toContain('XYZ');
    expect(failure.request?.url).toContain('/oo/classes');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/classAnswersContract.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `read` returns a state, not a contract.

- [ ] **Step 3: Rewrite the members**

In `src/core/class/AdtClass.ts`: change the `implements` clause to the atom list in **Interfaces** above; the constructor's `results` parameter is `protected readonly results: R` — it
satisfies the base's `protected abstract readonly results: R`, and a `private`
one would not compile against it; delete every `state` object, every `errors: []`, and the `AdtOperationError` import and its four throw sites.

Each member becomes one shape — `read` shown, the rest follow it:

```typescript
async read(
  config: Partial<IClassConfig>,
  version?: 'active' | 'inactive',
  options?: { withLongPolling?: boolean } & IAdtOperationOptions,
): Promise<IAdtResponse<ReturnType<R['source']>>> {
  if (!config.className) {
    return failed({
      origin: 'parse',
      message: 'Class name is required',
    });
  }
  return answering(
    () => getClassSource(this.connection, config.className as string, version, options),
    this.results.source,
    options?.analyse,
  );
}
```

`create`, `update` and `delete` **cannot** keep their chains as they are, and this
is the sharpest edge in the migration. Today the cleanup — unlock, restore
stateless, end the critical section, `deleteOnFailure` — runs from a `catch`,
because a refused request throws. Once a refusal is a returned value, that `catch`
never fires: the lock stays held on the server, the session stays stateful, and
nothing says so.

So the chain gets an executor with **resource-scope** semantics — cleanup runs
whatever happens, not only on the way out through a failure.

`recogniseFailure` is currently private to `adtResponse.ts`. Export it there
rather than duplicating the classification; `chain` needs it for a real exception.

Add `src/core/shared/chain.ts`. The imports are part of the file, not an exercise
for the reader:

```typescript
import type {
  IAdtError,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { failed, recogniseFailure, succeeded } from '../../utils/adtResponse';
import { safeErrorMessage } from '../../utils/internalUtils';

/**
 * Run a chain of requests as a resource scope.
 *
 * Cleanup used to run from a `catch`, which worked only because a refusal threw.
 * A refusal is now a value, so an unguarded early return would leave the object
 * locked on the server and the session stateful, with nothing raised to say so.
 *
 * **Cleanup runs on every path** — success, returned failure, and exception — in
 * reverse order of registration. That is the difference between a cleanup and an
 * error implementation, and getting it wrong leaks a lock on the happy path, which is
 * the one that runs most.
 *
 * A registration can be **discharged** when the resource is released normally:
 * `onScopeEnd` returns a handle, and calling it removes that entry, so a chain
 * that unlocks as its own step does not unlock twice.
 *
 * An error raised *by* cleanup is logged, never propagated: a failing unlock must
 * not replace the reason the chain failed, which is what the caller needs.
 */
/**
 * Raised by `step()` to abandon a chain, carrying the failure that caused it.
 *
 * Private to this module and never exported: it is a control-flow device, not a
 * failure a caller should ever see. `chain` catches it and returns the failure
 * it carries; anything else that escapes is a real exception and is classified.
 */
class ChainAbandoned extends Error {
  constructor(readonly failure: IAdtError) {
    super(failure.message);
    this.name = 'ChainAbandoned';
  }
}

export async function chain<T>(
  logger: ILogger | undefined,
  body: (scope: {
    /** Await an answer; its value on success, or abandon the chain with its failure. */
    step<S>(answer: Promise<IAdtResponse<S>>): Promise<S>;
    /** Register cleanup. The returned function discharges it. */
    onScopeEnd(undo: () => Promise<void>): () => void;
  }) => Promise<T>,
): Promise<IAdtResponse<T>> {
  const undos: Array<() => Promise<void>> = [];
  const scope = {
    async step<S>(answer: Promise<IAdtResponse<S>>): Promise<S> {
      const a = await answer;
      if (!a.ok) throw new ChainAbandoned(a.getError());
      return a.getResult().value;
    },
    onScopeEnd(undo: () => Promise<void>): () => void {
      undos.push(undo);
      return () => {
        const at = undos.indexOf(undo);
        if (at >= 0) undos.splice(at, 1);
      };
    },
  };

  try {
    return succeeded(await body(scope));
  } catch (error: unknown) {
    return failed<T>(
      error instanceof ChainAbandoned
        ? error.failure
        : recogniseFailure(error),
    );
  } finally {
    for (const undo of undos.reverse()) {
      try {
        await undo();
      } catch (cleanupError: unknown) {
        logger?.warn?.('cleanup failed', { error: safeErrorMessage(cleanupError) });
      }
    }
  }
}
```

`update` then reads as the chain it always was. The body returns the value it
already has — it does not re-read a wire response it no longer holds — and the
unlock is discharged when it happens normally:

```typescript
return chain(this.logger, async ({ step, onScopeEnd }) => {
  this.connection.setSessionType('stateful');
  // Registered FIRST so it unwinds LAST. Order matters twice over: on older
  // BASIS a lock handle is only valid inside a stateful request, so going
  // stateless before the unlock would break the unlock (#106); and if
  // lockClass itself throws, the session is still restored because this was
  // already registered.
  onScopeEnd(async () => {
    this.connection.setSessionType('stateless');
  });

  const lockHandle = await lockClass(this.connection, name);   // throws; no failure half
  const releaseLock = onScopeEnd(async () => {
    await unlockClass(this.connection, name, lockHandle);
  });
  // Unwind order is therefore: unlock, then stateless.

  await step(answering(() => checkClass(...), this.results.check, options?.analyse));
  const updated = await step(
    answering(() => updateClass(...), this.results.updated, options?.analyse),
  );

  await unlockClass(this.connection, name, lockHandle);
  releaseLock();          // released normally; do not unlock twice

  return updated;
});
```

Each **request** goes through `answering`, so `IAdtError.request` names the step
that refused rather than the chain that contained it.

- [ ] **Step 4: Test that a refusal mid-chain still unwinds**

Add to the same file — this is the case the old `catch` covered and a naive early
return loses:

```typescript
it('unlocks when a request refuses after the lock was taken', async () => {
  const calls: string[] = [];
  const connection = {
    setSessionType: jest.fn((t: string) => calls.push(`session:${t}`)),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async (r: { url: string }) => {
      calls.push(r.url);
      // Real URLs carry `_action=LOCK` / `_action=UNLOCK`, upper case. Matching
      // lowercase `lock` would also match `lockHandle=` on the update, so the
      // mock would answer a lock handle to the write and the chain would never
      // reach the branch under test.
      if (/_action=LOCK\b/i.test(r.url)) {
        return { data: '<LOCK_HANDLE>h1</LOCK_HANDLE>', status: 200, statusText: 'OK', headers: {} };
      }
      return { data: REFUSAL, status: 200, statusText: 'OK', headers: {} };
    }),
  } as unknown as IAbapConnection;

  const response = await new AdtClient(connection, logger).getClass().update({
    className: 'ZCL_X',
    sourceCode: 'CLASS zcl_x.',
  });

  expect(response.ok).toBe(false);
  // The lock was released even though nothing threw.
  expect(calls.some((c) => /_action=UNLOCK\b/i.test(c))).toBe(true);
  expect(calls).toContain('session:stateless');
});

it('reports what SAP refused, not what the unlock did', async () => {
  // An unlock that also fails must not replace the reason the chain failed.
  const connection = {
    setSessionType: jest.fn(),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async (r: { url: string }) => {
      if (/_action=LOCK\b/i.test(r.url)) {
        return { data: '<LOCK_HANDLE>h1</LOCK_HANDLE>', status: 200, statusText: 'OK', headers: {} };
      }
      if (/_action=UNLOCK\b/i.test(r.url)) throw new Error('unlock exploded');
      return { data: REFUSAL, status: 200, statusText: 'OK', headers: {} };
    }),
  } as unknown as IAbapConnection;

  const response = await new AdtClient(connection, logger).getClass().update({
    className: 'ZCL_X',
    sourceCode: 'CLASS zcl_x.',
  });

  expect(response.ok).toBe(false);
  if (response.ok) throw new Error('expected a failure');
  expect(response.getError().message).toContain('XYZ');
  expect(response.getError().message).not.toContain('unlock exploded');
});
```

```typescript
it('restores stateless on the success path too', async () => {
  // The path that runs most. A cleanup that only fires on failure leaks the
  // session on every successful update.
  const calls: string[] = [];
  const connection = {
    setSessionType: jest.fn((t: string) => calls.push(`session:${t}`)),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async (r: { url: string }) => {
      calls.push(r.url);   // without this the unlock count is always 0 and the
      return {             // assertion below passes whatever cleanup does
        data: /_action=LOCK\b/i.test(r.url) ? '<LOCK_HANDLE>h1</LOCK_HANDLE>' : '',
        status: 200, statusText: 'OK', headers: {},
      };
    }),
  } as unknown as IAbapConnection;

  const response = await new AdtClient(connection, logger).getClass().update({
    className: 'ZCL_X',
    sourceCode: 'CLASS zcl_x.',
  });

  expect(response.ok).toBe(true);
  expect(calls[calls.length - 1]).toBe('session:stateless');
  // Discharged, so exactly one unlock.
  expect(calls.filter((c) => /_action=UNLOCK\b/i.test(c)).length).toBe(1);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/classAnswersContract.test.ts 2>&1 | tee unit-run.log
```

Expected: 5 passed.

- [ ] **Step 6: Check the class module compiles**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "^src/core/class/"
```

Expected: no output. Errors elsewhere are expected until later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/core/shared/chain.ts src/core/class/ src/__tests__/unit/core/classAnswersContract.test.ts
git commit -m "feat(class)!: AdtClass answers the contract

Every member returns IAdtResponse; the state object and errors: [] are gone, and
so are the four AdtOperationError throws that replaced SAP's sentence with one of
ours. A create chain runs answering per request, so IAdtError.request names the
step that refused rather than the chain that contained it.

Unit-tested against a refusal document a real system gave: the caller now learns
who holds the lock."
```

---

### Task 5: The factory selects the strategy

**It also carries 36 of the 715 errors on its own.** `IAdtLockable<TConfig>` and
`IAdtReadable<TConfig, TSource, TMetadata>` are used without type arguments in 36
places — 20 of them in `src/clients/AdtClient.ts`, 4 in `AdtClientLegacy.ts`, the
rest in `AdtUnitTest`, `AdtRequest`, `LockCapability` and `AdtPackage`. That is
TS2314, and it is this task's: a factory return type that names an atom without
saying what it reads is the same defect as a state bag, one layer up.

**Files:**
- Modify: `src/clients/AdtClient.ts:304` (`getClass`)
- Test: `src/__tests__/unit/clients/factoryStrategy.test.ts`

**Interfaces:**
- Consumes: `AdtClass` (Task 4), `IClassResults` / `classDocuments` (Task 3).
- Produces: two overloads of `getClass`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/clients/factoryStrategy.test.ts`:

```typescript
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { classDocuments } from '../../../core/class/types';

const logger = { log: jest.fn(), info: jest.fn(), error: jest.fn(),
  warn: jest.fn(), debug: jest.fn() } as unknown as ILogger;

const connection = {
  setSessionType: jest.fn(),
  isConnected: () => true,
  makeAdtRequest: jest.fn(async () => ({
    data: '<abapClass adtcore:name="ZCL_X"/>', status: 200,
    statusText: 'OK', headers: {},
  })),
} as unknown as IAbapConnection;

describe('AdtClient.getClass', () => {
  it('defaults to documents', async () => {
    const answer = await new AdtClient(connection, logger)
      .getClass()
      .read({ className: 'ZCL_X' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toContain('ZCL_X');
  });

  it("gives a consumer their own shape when they supply one", async () => {
    const names = {
      ...classDocuments,
      source: (wire: { data: unknown }) => ({
        name: /adtcore:name="([^"]+)"/.exec(String(wire.data))?.[1] ?? '',
      }),
    };

    const answer = await new AdtClient(connection, logger)
      .getClass(names)
      .read({ className: 'ZCL_X' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    // Their type, not ours — and typed, not cast.
    expect(answer.getResult().value.name).toBe('ZCL_X');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/clients/factoryStrategy.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `getClass` takes no argument.

- [ ] **Step 3: Add the overloads**

Replace `getClass()` in `src/clients/AdtClient.ts`:

```typescript
/**
 * A class implementation, answering documents.
 *
 * The result strategy is chosen here rather than per call because a consumer
 * that wants a particular shape wants it for every member of the implementation. The
 * return type is this package's, which is why `@mcp-abap-adt/interfaces` needs
 * no parser parameter and did not change to make this possible.
 */
getClass(): AdtClass;
getClass<
  R extends IClassResults<
    unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown
  >,
>(
  results: R,
): IAdtCreatable<IClassConfig, ReturnType<R['created']>> &
  IAdtReadable<IClassConfig, ReturnType<R['source']>, ReturnType<R['metadata']>> &
  IAdtUpdatable<IClassConfig, ReturnType<R['updated']>> &
  IAdtDeletable<IClassConfig, ReturnType<R['deletion']>> &
  IAdtValidatable<IClassConfig, ReturnType<R['validation']>> &
  IAdtCheckable<IClassConfig, ReturnType<R['check']>> &
  IAdtActivatable<IClassConfig, ReturnType<R['activation']>> &
  IAdtLockable<IClassConfig> &
  IAdtVersionable<IClassConfig>;
// The implementation is generic too. Erasing R here would build the implementation at
// `unknown` while the overload promised `ReturnType<R['source']>` — the factory
// telling the truth in its signature and lying in its body.
getClass<
  R extends IClassResults<
    unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown
  > = IClassResults,
>(results: R = classDocuments as unknown as R): AdtClass<R> {
  this.assertConnected();
  return new AdtClass<R>(
    this.connection,
    this.logger,
    this.systemContext,
    this.contentTypes,
    this.lockRegistry,
    results,
  );
}
```

- [ ] **Step 4: Prove the implementation and the overload agree on `R`**

A compile-only assertion, in the same file. A runtime test cannot catch the
factory building at `unknown` while its signature promises otherwise:

```typescript
// Compile-only: if these stop compiling, the factory and the implementation disagree.
const named = {
  ...classDocuments,
  source: (wire: IAdtWireResponse) => ({ name: String(wire.data) }),
};
type Implementation = ReturnType<AdtClient['getClass']>;
type FromNamed = ReturnType<typeof AdtClient.prototype.getClass<typeof named>>;
const _readsTheirShape: (
  c: FromNamed,
) => Promise<IAdtResponse<{ name: string }>> = (c) => c.read({ className: 'X' });
void _readsTheirShape;
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/clients/factoryStrategy.test.ts 2>&1 | tee unit-run.log
npx tsc --noEmit -p tsconfig.json 2>&1 | grep factoryStrategy
```

Expected: 2 passed, no tsc output, and `answer.getResult().value.name` type-checks without a cast.

- [ ] **Step 6: Commit**

```bash
git add src/clients/AdtClient.ts src/__tests__/unit/clients/factoryStrategy.test.ts
git commit -m "feat!: getClass selects the result strategy

The substitution the design needs, expressed entirely in this package: the atoms
keep their published signatures and what varies is the type arguments the factory
instantiates them with. interfaces 29.0.0 needs no follow-up release.

Tested with a consumer's own strategy returning their own shape, and the value is
typed rather than cast."
```

---

### Task 6: Read the class module's casts, and the negative cases

**Files:**
- Modify: every file under `src/core/class/` carrying an `as` cast
- Test: `src/__tests__/unit/core/classNegativeCases.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces: nothing new. This task removes casts and adds coverage.

- [ ] **Step 1: Enumerate the casts**

```bash
grep -rnE "\bas [A-Z]|as unknown as" src/core/class/ --include='*.ts'
```

Record the count. Read each one: many existed to get around the envelope. Remove those that are now redundant; where one hides a real mismatch, fix the mismatch.

- [ ] **Step 2: Write the negative-case tests**

Create `src/__tests__/unit/core/classNegativeCases.test.ts` covering, each as its own `it`:

```typescript
// 1. a refusal inside a 200 is a failure, not an empty result
// 2. a 404 carrying a document is `refusal`, not `connection`
// 3. an empty body is a result by default, and a failure when `analyse` says so
// 4. a deletion answering del:isDeleted="false" is a failure
// 5. an activation answering activationExecuted="false" with no message is a SUCCESS
```

Case 5 is the one usually missed: it asserts that no error is reported when SAP did not refuse. A library that failed everything would pass the other four.

- [ ] **Step 3: Run them**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/ 2>&1 | tee unit-run.log
```

Expected: all pass. Any that fail is a real defect in Tasks 2–5 — fix there, not in the test.

- [ ] **Step 4: Sweep the class module for the removed symbols**

```bash
grep -rn "IClassState\|errors: \[\]\|AdtOperationError" src/core/class/
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add src/core/class src/__tests__/unit/core/classNegativeCases.test.ts
git commit -m "test(class): both directions, and the casts that hid the envelope

Five negative cases, including the one usually missed: activationExecuted=false
with no message is a success, because a library that failed everything would pass
the other four.

The casts in this module were read rather than counted — several existed only to
get around the envelope and are gone with it."
```

---

### Tasks 7 to 11 — the remaining 29 object types, in batches

Five batches, each the same six steps as Tasks 3, 4 and 6 applied to its types. The pattern is proved; what is not proved is what each endpoint answers, so **read each type's low-level functions before naming its results**. Copy the shape, never the values.

| Task | Types |
|---|---|
| 7 | `program`, `interface`, `include`, `functionGroup`, `functionModule`, `functionInclude` |
| 8 | `table`, `structure`, `domain`, `dataElement`, `tabletype`, `appendStructure` |
| 9 | `ddl`, `metadataExtension`, `accessControl`, `serviceDefinition`, `service` (implementation is `AdtService`, state `IServiceBindingState`), `behaviorDefinition`, `behaviorImplementation` |
| 10 | `package`, `transport` (`AdtRequest` **and** `AdtRequestLegacy`), `enhancement`, `transformation`, `messageClass` (`AdtMessageClass` **and** `AdtMessageClassMessage`) |
| 11 | `unitTest` (`AdtUnitTest`, `AdtCdsUnitTest`, `AdtUnitTestLegacy`), `authorizationField`, `featureToggle`, `scalarFunction`, `scalarFunctionImplementation` |

Per type, in order:

- [ ] **Step 1:** Read `src/core/<type>/{create,read,update,delete,check,activation,validation}.ts` and note what each request asks for and what ADT answers.
- [ ] **Step 2:** Write `src/core/<type>/types.ts` — one named result type per member with the measured behaviour in its doc comment, plus `I<Type>Results` and `<type>Documents`, following `src/core/class/types.ts`.
- [ ] **Step 3:** Rewrite `src/core/<type>/Adt<Type>.ts` to declare its atoms and return `answering(...)` per request.
- [ ] **Step 4:** Add the factory overload in `src/clients/AdtClient.ts`, following `getClass`.
- [ ] **Step 5:** Read the casts in that module; remove the redundant, fix what the rest hid.
- [ ] **Step 6:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "^src/core/<type>/"` — expect no output.
- [ ] **Step 7:** `grep -rn "I<Type>State" src` — expect no matches. A module with two implementations is only done when both are clear; check the inventory row rather than the directory listing.

At the end of each batch:

- [ ] **Sweep:** `grep -rn "I<Type>State\|errors: \[\]\|AdtOperationError" src/core/` — expect no matches for the types in this batch.
- [ ] **Gate:** `npm run lint:check && npm run test:check`
- [ ] **Commit** the batch as one commit naming the types it covers.

---

### Task 12: The short and full strategies the design promised

The design names three answers large enough that callers want different amounts,
and nothing so far creates them. Without this task the "two or three defaults"
are a claim rather than a feature, and every consumer still gets one shape.

**Files:**
- Create: `src/core/transport/results.ts`, `src/runtime/dumps/results.ts`,
  `src/core/shared/results.ts` (the four package readings and the utilities set —
  they belong beside `AdtUtils`, which is what takes them)
- Modify: `src/runtime/dumps/RuntimeDumps.ts` (generic in its set; three members),
  `src/clients/AdtRuntimeClient.ts` (`getDumps` overloads and its cache),
  `src/clients/AdtClient.ts` (`getRequest` overloads only — **`getUtils` is Task 14's**),
  `src/core/transport/types.ts`
- Modify: `src/index.ts` (export them; a strategy a consumer cannot import is not an option they have)
- Test: `src/__tests__/unit/core/resultStrategies.test.ts`

**Interfaces:**
- Consumes: `IResultStrategy`, `rawDocument` (Task 2).
- Produces, each an `IResultStrategy` and each exported from the package root:
  - `transportNumbers: IResultStrategy<string[]>` — request numbers alone
  - `transportTree: IResultStrategy<ITransportTree>` — containers, descriptions, and the **language** a request carries, which nothing currently exposes
  - `dumpList: IResultStrategy<IDumpSummary[]>` — `{ id, at, program, message }`
  - `dumpDocument = rawDocument`
  - Four for package contents, over the single `getPackageContents` member that
    `interfaces` 30.0.0 leaves in place of `getPackageContentsList` and
    `getPackageHierarchy`:
    - `packageList: IResultStrategy<IPackageContentItem[]>` — names and ADT type codes
    - `packageTree: IResultStrategy<IPackageHierarchyNode>` — the structure with its descriptions and sub-package links
    - `packageShort: IResultStrategy<{ name: string; type: string }[]>` — the reading an MCP server can afford
    - `packageRaw = rawDocument` — the document untouched, which a backup consumer
      could not reach through the old members at all

    The walk those two members performed — `maxDepth`, default 5, recursing into
    sub-packages — does not come with them. A member answers one read; a consumer
    holding a result with sub-package references walks them itself.

**One type note.** `IResultStrategy<T>` is `(answer: IAdtWireResponse) => T` — it
is handed the whole answer, because a reading may need the status or a header.
The name and the signature come from `interfaces` 30.0.0, so nothing in this
package declares a second spelling of it, nothing converts between forms, and
nothing fabricates a status.

- [ ] **Step 1:** Write the failing test: for each pair, the same captured document read by both strategies, asserting the short one carries the identifying fields and the full one carries what the short one drops. Assert the short is **not** a prefix or subset-by-truncation of the full — it is a different reading, and a test that only checks length would pass a truncation.

  **For the package readings, assert which nodes of one captured document reach
  each result**, by name: the document's `objects` entries appear in `packageList`
  and `packageShort`, its `childNodes` appear in `packageTree` as references and
  in neither of the other two, and `packageRaw` is byte-identical to `wire.data`.
  Their semantics are new — the old members answered a walk — so this is the test
  that defines them rather than one that confirms a port.
- [ ] **Step 2:** Run it; expect FAIL on the missing exports.
- [ ] **Step 3: Split the old readers into several strategies — and move only what is pure**

**One old function becomes several strategies, not one.** `getPackageContentsList`
was a single reading nobody could choose; what replaces it is four —
`packageList`, `packageTree`, `packageShort`, `packageRaw` — each reading the same
document differently. The same split is what `transportNumbers`/`transportTree`
and `dumpList`/`dumpDocument` are. A migration that moves one old function into
one new strategy has renamed something, not made it choosable.

**What can move, and what cannot.** `IResultStrategy<T>` is
`(answer: IAdtWireResponse) => T`: **synchronous, one document, no connection.**
The old functions are not parsers — they are walks. `packageContentsList.ts:147`
fetches the node structure, `:175` issues **another request per object type**, and
`:248` recurses into sub-packages to `maxDepth`; `packageHierarchy.ts:311`, `:356`
and `:397` do the same. None of that can live in a strategy, and none of it should
live anywhere: the walk left the contract with `maxDepth`, and a member answers one
read.

So what moves is the **pure** half, and only it:

| moves into a strategy | stays, or goes |
|---|---|
| `parseNodeStructure`, `toNodeContents` (`nodeStructure.ts:145`, `:204`) | — |
| `parseNodesToItems`, `mapAdtTypeToSupported`, `isPackageType`, `readNodeValue` (`packageContentsList.ts`) | — |
| `normalizeAdtType`, `mapAdtTypeToCodeFormat`, the tree builders (`packageHierarchy.ts`) | — |
| — | `fetchNodeStructure` — it issues the request and returns the answer |
| — | the per-type follow-ups and the recursion: **deleted**, not relocated |

- [ ] **Step 3a: State what each reading yields from ONE document, because it is new**

A single `POST /repository/nodestructure` response carries the objects at that
level and the child-node pairs below it — that is what `IRepositoryNodeContents`
names, `objects` and `childNodes`. The four readings of it are therefore:

| strategy | from one document |
|---|---|
| `packageList` | `IPackageContentItem[]` built from that document's `objects` — **the level asked for, not the sub-tree**, because deeper levels are other requests |
| `packageTree` | `IPackageHierarchyNode` for the node itself with its `childNodes` as **unexpanded references** — a caller who wants them expanded asks for them |
| `packageShort` | `{ name, type }` per object, the same set as `packageList` |
| `packageRaw` | the document |

This is a behaviour change and the CHANGELOG says so: `getPackageContentsList`
with `includeSubpackages` returned a flattened sub-tree, and no reading here does.
The consumer walks, holding the references the tree gave them.

- [ ] **Step 3b: Copying is the failure mode, not moving**

A pure function left behind *and* used in a strategy is two readings of one
document, with the one that runs decided by which call site a caller reached —
the defect this whole line of work is about, one layer down. After this step a
low-level function issues its request and returns the answer. If it still parses,
the strategy above it is decoration.
- [ ] **Step 4:** Export from `src/index.ts`, and add each to the docs list `npm run check:docs` reads.
- [ ] **Step 5:** Run the tests; expect pass. Run `npm run check:docs`; expect 0.

- [ ] **Step 5a: Prove the parsing moved rather than multiplied**

```bash
grep -rn "XMLParser" src/core/shared/packageContentsList.ts \
  src/core/shared/packageHierarchy.ts src/core/transport/
```

Expect no hit outside the `results.ts` files. 53 files under `src/core` and
`src/runtime` import `XMLParser` today; this task is responsible for the ones
whose readings it just created, and the batches in Tasks 7–11 for theirs. A file
that both parses and calls a strategy is the failure to look for.
- [ ] **Step 6: Bind them to the strategy sets and the factories**

A strategy nobody can select is a function, not an option. Each pair joins its
type's result set and gets a factory overload, exactly as `getClass` has:

```typescript
// src/core/transport/types.ts
export const transportDocuments: ITransportResults = { /* … */ list: transportTree };
export const transportShort: ITransportResults<string[]> = { /* … */ list: transportNumbers };

// src/clients/AdtClient.ts
getRequest(): AdtRequest;
getRequest<R extends ITransportResults<unknown>>(results: R): /* atoms over R */;

// src/runtime/dumps/RuntimeDumps.ts — the real class, with its three real
// members. In 29.0.0 `IRuntimeDumps` declared them answering IAdtWireResponse,
// so this class had to choose between honouring the contract and naming its
// results, and this plan told it to drop `implements`. **30.0.0 fixed the
// contract instead**: `IRuntimeDumps<TList, TDump>` answers `IAdtResponse` with
// the shape as a type parameter, and it inherits nothing (decision 23), so it
// declares `kind` and `list` itself. The class therefore KEEPS `implements` —
// and if it cannot satisfy it, that is a defect here, not a reason to stop
// declaring the contract.
export class RuntimeDumps<R extends IDumpResults<unknown> = typeof dumpDocuments>
  implements IRuntimeDumps<ReturnType<R['list']>, ReturnType<R['document']>>
{
  readonly kind = 'runtimeDumps' as const;
  constructor(/* … */, private readonly results: R = dumpDocuments as unknown as R) {}
  list(options?: IRuntimeDumpsListOptions): Promise<IAdtResponse<ReturnType<R['list']>>>;
  listByUser(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'>,
  ): Promise<IAdtResponse<ReturnType<R['list']>>>;
  getById(
    dumpId: string,
    options?: IRuntimeDumpReadOptions,
  ): Promise<IAdtResponse<ReturnType<R['document']>>>;
}
```

`IDumpResults` therefore carries two strategies, not three: `list` serves both
listing members because they answer the same shape from the same resource, and
`document` serves `getById`. That is also the shape `IRuntimeDumps<TList, TDump>`
takes in 30.0.0, so the class's set and the contract's parameters line up one to
one rather than needing conversion. Callers of all three migrate in this task — find them
with `grep -rn "getDumps()" src`.

```typescript

// src/clients/AdtRuntimeClient.ts
//
// The existing `getDumps()` memoises one implementation in `_dumps` and returns it for
// every later call. With a strategy that is a defect the overload hides: the
// second consumer asks for a different shape, gets the first one's implementation, and
// the signature promises theirs. Key the cache by the set's identity instead.
private readonly dumpHandlers = new WeakMap<object, RuntimeDumps<never>>();

getDumps(): RuntimeDumps;
getDumps<R extends IDumpResults<unknown>>(results: R): RuntimeDumps<R>;
getDumps<R extends IDumpResults<unknown> = typeof dumpDocuments>(
  results: R = dumpDocuments as unknown as R,
): RuntimeDumps<R> {
  const cached = this.dumpHandlers.get(results as object);
  if (cached) return cached as unknown as RuntimeDumps<R>;
  const made = new RuntimeDumps<R>(this.connection, this.logger, results);
  this.dumpHandlers.set(results as object, made as unknown as RuntimeDumps<never>);
  return made;
}
```

**`getUtils` is not bound here.** Package contents reach a caller through
`AdtUtils.getPackageContents`, and `AdtUtils` does not compile until **Task 14**
migrates it — so the overload pair, the identity-keyed cache and the generic class
are all that task's, following `RuntimeDumps<R>` above as their worked example.
This task creates the strategies and the set they go in; Task 14 is where they
reach a caller.

Doing it here would mean either a test that cannot compile or half of Task 14
executed early under a heading that does not say so. The injection point is the
same one decision 22 names, wherever it is written: there is no per-call parser
argument anywhere in this package.

**`IUtilsResults` carries one key per parameterised atom, and `getPackageContents`
is its own.** `IAdtPackageBrowsing<TContents>` is a separate atom with its own
type parameter — a package reading cannot ride on `nodeContents`, which belongs to
`IAdtRepositoryStructure<TNode>` and answers a different question. Read from the
published contract, the utility atoms that take parameters are four, carrying six
between them:

```typescript
// src/core/shared/results.ts
export interface IUtilsResults {
  readonly search: IResultStrategy<unknown>;          // IAdtInformationSystem #1
  readonly whereUsed: IResultStrategy<unknown>;       // IAdtInformationSystem #2
  readonly allTypes: IResultStrategy<unknown>;        // IAdtInformationSystem #3
  readonly nodeContents: IResultStrategy<unknown>;    // IAdtRepositoryStructure
  readonly packageContents: IResultStrategy<unknown>; // IAdtPackageBrowsing
  readonly inactiveObjects: IResultStrategy<unknown>; // IAdtGroupLifecycle
}

export const utilsDocuments = {
  /* … */ packageContents: packageList,
} satisfies IUtilsResults;

export const utilsShort = {
  /* … */ packageContents: packageShort,
} satisfies IUtilsResults;

export const utilsRaw = {
  /* … */ packageContents: packageRaw,
} satisfies IUtilsResults;
```

**`satisfies`, never a `: IUtilsResults` annotation.** The interface types every
field as `IResultStrategy<unknown>`, because it is the *constraint* — it says
which keys a set must have, not what any of them returns. Annotating a constant
with it widens every strategy to that constraint, so
`ReturnType<R['packageContents']>` is `unknown` and
`getUtils(utilsShort).getPackageContents('Z')` answers `IAdtResponse<unknown>` —
the exact opposite of what this task is for. `satisfies` checks the shape and
keeps `packageShort`'s own return type, which is what `R` then carries. TypeScript
5.9 is what this package builds with, so the operator is available.

The same rule applies to `transportDocuments`, `transportShort`, `dumpDocuments`
and `dumpShort` in the two `results.ts` files above: **shape checked by
`satisfies`, types kept.** A set annotated with its constraint is a set that
answers `unknown` for everything, and the compiler will not say so — every call
still compiles, and every caller gets `unknown`.

**The default is `typeof utilsDocuments`, never `IUtilsResults`.** A type
parameter cannot default to a *value*, and defaulting it to its own constraint
undoes everything `satisfies` just bought: `R = IUtilsResults` makes every
`ReturnType<R[k]>` `unknown` again, so the no-argument `getUtils()` — the call
almost every consumer makes — answers `unknown` for everything while the explicit
sets answer precisely. Write `AdtUtils<R extends IUtilsResults = typeof utilsDocuments>`
and `getUtils(): AdtUtils<typeof utilsDocuments>`. The same holds for
`RuntimeDumps` and `AdtRequest`: the default is `typeof dumpDocuments` and
`typeof transportDocuments`.

Then `AdtUtils<R extends IUtilsResults = typeof utilsDocuments>` instantiates each
atom with the matching key: `IAdtPackageBrowsing<ReturnType<R['packageContents']>>`,
`IAdtRepositoryStructure<ReturnType<R['nodeContents']>>`, and so on. A set that
declares a strategy no atom reads, or an atom instantiated with a key the set does
not carry, is the defect this list exists to prevent — `packageTree` was declared
in Step 1 and reachable from nothing until this key existed.

- [ ] **Step 7: Test the cache on every factory that has one, on one client instance**

Three factories take a set and memoise the implementation, so three tests, each
asking the same client twice with different sets and asserting the second is not
the first and answers the second shape. Calling them on two clients would pass
while the cache defect is still there.

Two here — `getUtils` is tested in Task 14, where it exists.

```typescript
const client = new AdtClient(connection, logger);

// transport
expect(client.getRequest(transportShort)).not.toBe(client.getRequest(transportDocuments));

// dumps — AdtRuntimeClient
expect(runtime.getDumps(dumpShort)).not.toBe(runtime.getDumps(dumpDocuments));
```

And one assertion past identity, because a factory can cache correctly and read
wrongly:

```typescript
const short = expectResult(await runtime.getDumps(dumpShort).list(), 'list');
const docs = expectResult(await runtime.getDumps(dumpDocuments).list(), 'list');
expect(Array.isArray(short)).toBe(true);
expect(typeof docs).toBe('string');
```

- [ ] **Step 8:** Commit.

---

### Task 13: The implementations that answered past the contract

The 30.0.0 delta this plan was written before. Ninety-eight of the 715 errors are
TS2416 — a member not assignable to the contract it claims — and they are not the
object types: they are the clients that answered the transport envelope, or their
own type, while declaring a contract that now answers `IAdtResponse`.

**Files, with the error count each carries:**

| implementation | errors | contract |
|---|---|---|
| `src/executors/*` | 18 | `IAdtRunnable` + `IRunnableWithProfiler` + `IRunnableWithProfiling` + `ITraceScheduling` — **`IExecutor` no longer exists** |
| `src/core/service/*` | 8 | `IAdtServiceBinding` **and** the CRUD atoms, listed separately |
| `src/core/shared/AdtUtils.ts` | 7 | `IAdtInformationSystem` |
| `src/clients/AdtAbapGitClient.ts` | 7 | `IAdtAbapGitClient` |
| `src/runtime/feeds/*` | 6 | `IFeedRepository` |
| `src/core/shared/AdtUtils.ts` | 6 | `IAdtObjectAccess` |
| `src/runtime/traces/*` | 5 + 5 | `ITraceScheduling`, `ICrossTrace` |
| the rest | ~36 | `IAdtVersionable`, `IAdtGroupLifecycle`, and the runtime clients |

**Interfaces:**
- Consumes: `answering`, `rawDocument` (Task 2); the result sets from Task 12.
- Produces: no new types. Every member here answers `IAdtResponse<T>` where it
  answered a bare value or an envelope, and every class lists the atoms it
  satisfies instead of inheriting them.

- [ ] **Step 1: Take the work list from the compiler, per file**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep TS2416 > ts2416.log
```

Read the log. Each line names the member, the shape it has and the shape the
contract wants. Do not guess from the table above — it is the map, not the list.

- [ ] **Step 2: The executors first, because `IExecutor` is gone**

`AdtClassExecutor` and `AdtProgramExecutor` declared one contract and got `run`
by inheritance. They now declare three:

```typescript
export class AdtClassExecutor
  implements
    IAdtRunnable<IClassExecutionTarget, string>,
    IRunnableWithProfiler<IClassExecutionTarget, string, IClassExecuteWithProfilerOptions>,
    IRunnableWithProfiling<IClassExecutionTarget, IClassExecuteWithProfilingResult, IClassExecuteWithProfilingOptions>,
    ITraceScheduling
```

`IClassExecuteWithProfilingResult.response` was renamed to `run` and is no longer
an `IAdtWireResponse` — a result carrying the transport frame is the shape 30.0.0
removed. Callers of `.response` are found with
`grep -rn "\.response" src/executors src/clients`.

- [ ] **Step 3: Each remaining class, one commit per file**

Every member wraps its answer in `answering(...)`, and the class lists its atoms.
Where a contract takes type parameters, instantiate them with what this
implementation actually answers rather than widening to `string`: the parameter
exists so the type says which reading this implementation performs.

- [ ] **Step 4: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c TS2416`** — expect 0.

- [ ] **Step 5: Commit per file, then move on.**

---

### Task 14: `AdtUtils` and the legacy clients

**Files:**
- Modify: `src/core/shared/AdtUtils.ts`, `src/core/shared/AdtUtilsLegacy.ts`, `src/clients/AdtClient.ts`, `src/clients/AdtClientLegacy.ts`, and the 13 `*Legacy.ts` files under `src/core/`

**Interfaces:**
- Consumes: `answering`, `rawDocument` (Task 2).
- Consumes: `IUtilsResults`, `utilsDocuments`, `utilsShort` and `utilsRaw` from
  `src/core/shared/results.ts` — **Task 12 creates them**, with one key per
  parameterised atom: `search`, `whereUsed`, `allTypes`, `nodeContents`,
  `packageContents`, `inactiveObjects`.
- Produces:
  - `AdtUtils<R extends IUtilsResults>`, each atom it declares instantiated with
    the matching key.
  - The `getUtils` overload pair on `AdtClient`, and its identity-keyed cache —
    **bound here, not in Task 12**, because that is where `AdtUtils` first
    compiles. `RuntimeDumps<R>` and `getDumps` in Task 12 are the worked example
    to copy.

`AdtUtils` becomes generic in that set and keeps declaring the utility contracts
it satisfies — which it can, because the 30.0.0 atoms take their result type as a
parameter. No member gains an argument: the choice is injected once, at
construction, and nothing in this package offers a per-call parser.

- [ ] **Step 1:** Confirm against `node_modules/@mcp-abap-adt/interfaces/dist`
  that the installed version is **30.0.0 or later** and that
  `IAdtRepositoryStructure`, `IAdtInformationSystem` and `IAdtGroupLifecycle` each
  take a type parameter. If the installed version is 29.0.0, stop: this task is
  blocked until 30.0.0 is on npm, and no local tarball or `file:` bridge
  substitutes for that.

- [ ] **Step 2:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "AdtUtils|Legacy"` — this is the work list.
- [ ] **Step 3:** Make `AdtUtils` generic — `AdtUtils<R extends IUtilsResults = typeof utilsDocuments>`,
the default written with `typeof` because a type parameter cannot default to a
value and defaulting to the constraint answers `unknown` — and instantiate **every** atom it declares with the matching
key — `IAdtPackageBrowsing<ReturnType<R['packageContents']>>`,
`IAdtRepositoryStructure<ReturnType<R['nodeContents']>>`,
`IAdtInformationSystem<ReturnType<R['search']>, ReturnType<R['whereUsed']>, ReturnType<R['allTypes']>>`,
`IAdtGroupLifecycle<ReturnType<R['inactiveObjects']>>` — following `RuntimeDumps<R>`
in Task 12 exactly. An atom left bare here is TS2314 again, one layer down. The two package members it used to
declare are one now — `getPackageContents` — and the readings a caller used to pick
by method name are the four strategies Task 12 ships. `fetchNodeStructure` stays
where it is: it is the node structure asked for as itself, and that the package
member reaches the same resource internally was never the contract's business.
- [ ] **Step 4:** `AdtUtils`' members already answer `IAdtResponse`; they lose the extra `IAdtResult` layer and the twelve that answered `IAdtWireResponse` answer `rawDocument` of it instead.
- [ ] **Step 5:** The legacy clients follow their non-legacy counterparts. Legacy systems answer differently, but the *contract* is the same — a separate implementation is the point of the contract existing.
- [ ] **Step 6: Bind `getUtils`, and test the cache that only exists here**

```typescript
// src/clients/AdtClient.ts — keyed by the set's identity, exactly as getDumps is
private readonly utilsHandlers = new WeakMap<object, AdtUtils<never>>();

getUtils(): AdtUtils<typeof utilsDocuments>;
getUtils<R extends IUtilsResults>(results: R): AdtUtils<R>;
```

```typescript
const client = new AdtClient(connection, logger);
expect(client.getUtils(utilsShort)).not.toBe(client.getUtils(utilsRaw));

const short = expectResult(
  await client.getUtils(utilsShort).getPackageContents('ZPKG'),
  'getPackageContents',
);
const raw = expectResult(
  await client.getUtils(utilsRaw).getPackageContents('ZPKG'),
  'getPackageContents',
);
expect(Array.isArray(short)).toBe(true);
expect(typeof raw).toBe('string');
```

Both assertions matter and neither substitutes for the other: identity catches
the memoised single instance `getUtils` had before it took a set, and the shapes
catch a factory that caches correctly and reads wrongly.

- [ ] **Step 7:** `npm run lint:check && npm run build && npm run test:check` — all 0. This is the first point where the whole package compiles.
- [ ] **Step 8:** Commit.

---

### Task 15: The integration tests read the verdict from the contract

**Files:**
- Modify: `src/__tests__/integration/shared/{discovery,readSource,readMetadata,whereUsed,search,sqlQuery,tableContents}.test.ts`
- Modify: the skip paths in every integration test file

**Interfaces:**
- Consumes: `expectResult` / `expectFailure` from `src/__tests__/helpers/contract.ts` (already written).

- [ ] **Step 1:** Replace every `expect(result.status).toBe(200)` with `const result = expectResult(answer, '<member>')`. Asserting a status asserts the channel: ADT answers a refusal inside a 200, so that check can pass while the server refused.
- [ ] **Step 2:** Replace every `.rejects.toThrow()` with `expectFailure(answer, '<member>')` and an assertion on `origin` or `message`.
- [ ] **Step 3:** `sqlQuery` and `tableContents` are green today **because they never run** — `available_in: ["onprem"]` and the skip is silent. Migrate them too; they execute for the first time on on-prem.
- [ ] **Step 4:** Make every skip print unconditionally, with its reason. A suite that reports green must state which of its cases executed.
- [ ] **Step 5:** `npm run test:check:integration` — 0.
- [ ] **Step 6:** Commit.

---

### Task 16: Full run against the cloud trial

- [ ] **Step 1:** Confirm no other SAP-touching run is in flight, and that the token in `.env` is valid.
- [ ] **Step 2:** `npm test 2>&1 | tee test-run.log`
- [ ] **Step 3:** Read `test-run.log`. Baseline before the migration: 178 suites, 1342 tests, 1318 passed, 22 failed, 2 skipped.
- [ ] **Step 4:** Classify every failure. Acceptable: environmental (leftover objects, missing shared dependencies, cloud-unsupported operations). Not acceptable: anything attributable to this migration.
- [ ] **Step 5:** Confirm every skip printed its reason, and that the count of executed tests is stated rather than implied.
- [ ] **Step 6:** Commit the log summary in the CHANGELOG entry, not the log itself.

---

### Task 17: On-prem acceptance

The report this whole line of work started from. The cloud trial cannot show it: `ZLOCAL` is local and `transport_request` is unset, which the last full run confirmed by skipping `read_transport`.

- [ ] **Step 1:** Warn the user before launching — on-prem runs from a different machine.
- [ ] **Step 2:** Create and modify a class in a package that **requires a transport request**, without supplying one.
- [ ] **Step 3:** Assert the caller receives `ok: false`, `origin: 'refusal'`, and SAP's own sentence about the transport request — not a sentence composed by this library, and not truncated.
- [ ] **Step 4:** Run `sqlQuery` and `tableContents`, which execute here for the first time.
- [ ] **Step 5:** Record the outcome in the CHANGELOG under the version the maintainer chooses.

---

## Self-review

**Spec coverage.** Consumer-owned interpretation on two axes → Tasks 2, 3, 5. `analyse` composition and the no-wire rule → Task 2, red-proofed; chain cleanup on every path → Task 4, three tests. Result strategy at the factory → Tasks 5 and 12, with the short/full pairs bound to factories in Task 12. Per-type result types → Tasks 3, 7–11. Legacy migrates, batch deleted → Tasks 1, 14. Contracts composed rather than inherited, and the members that answered past the contract → Task 13. Casts → Task 6 and each batch. Both test directions and negative cases as their own body → Task 6. Visible skips → Task 15. Full trial run → Task 16. On-prem acceptance → Task 17. `interfaces` untouched → Global Constraints.

**Placeholders.** None: every code step carries the code, and the batches in Tasks 7–11 name their types and their six steps rather than saying "as above".

**Type consistency.** `IResultStrategy<T>` comes from `interfaces@30.0.0` under that name; `IAnalyse`, `rawDocument`, `nothing` are defined in Task 2 and used under those names in 3, 4, 5 and the batches. `IClassResults` / `classDocuments` are defined in Task 3 and consumed in 4 and 5. `answering(run, read, analyse?)` keeps that argument order everywhere.

---

## What 30.0.0 changed in this plan

Recorded here rather than folded in silently, because a worker reading a task
should know which instruction was rewritten and why.

1. **Task 12 — `RuntimeDumps` keeps `implements IRuntimeDumps`.** The plan told it
   to stop declaring the contract, on the grounds that `IRuntimeDumps` answered
   `IAdtWireResponse` and `interfaces` was closed. It is not closed and the
   contract is fixed: `IRuntimeDumps<TList, TDump>` answers `IAdtResponse`, and it
   inherits nothing, so the class declares `kind` and `list` itself.

2. **Task 13 is new.** The plan covered the 28 object types and the utilities, and
   never mentioned the executors, abapGit, the service binding, feeds or trace
   scheduling — 98 errors, and `IExecutor` no longer exists to inherit `run` from.

3. **Task 5 gained the bare atoms.** 36 uses of `IAdtLockable` and `IAdtReadable`
   without type arguments, which no task named.

4. **Global constraints gained decision 23.** An implementation lists the atoms it
   satisfies; nothing in `interfaces` extends anything, so nothing is inherited
   into a class by declaring one wide contract.

5. **The utilities result set carries six keys, not three.** Task 12 ships four
   package readings and Task 14 declared a set without a `packageContents` key, so
   nothing could reach them: `IAdtPackageBrowsing<TContents>` is its own atom with
   its own parameter, and a package reading cannot ride on `nodeContents`. The set
   is now one key per parameterised atom, read from the published contract, and it
   is created in Task 12 where the strategies are, not in Task 14 where it was
   only consumed.

6. **The cache test covers all three factories.** It named `getDumps` alone, while
   the factory the package work actually adds a set to is `getUtils` — which
   memoised one `AdtUtils` long before it took one. Identity is asserted for
   `getRequest`, `getDumps` and `getUtils`, and for `getUtils` also that the two
   implementations answer different shapes, since a factory can cache correctly
   and still read wrongly.

7. **`satisfies`, not an annotation, on every result set.** `IUtilsResults` types
   its fields as `IResultStrategy<unknown>` because it is the constraint; a
   constant annotated with it widens every strategy to that, so
   `ReturnType<R['packageContents']>` is `unknown` and the caller gets
   `IAdtResponse<unknown>` — the opposite of the point, with nothing failing to
   compile to say so. The same holds for the transport and dump sets.

8. **`getUtils` is bound in Task 14, not Task 12.** Task 12 claimed the overloads,
   the cache and their test while `AdtUtils` does not compile until Task 14 — so
   either the test could not build or half of Task 14 ran early under a heading
   that did not say so. Task 12 keeps the strategies and the sets; Task 14 binds
   them and carries the `getUtils` half of the cache test.

9. **The no-argument default is what the member answered before**, not the raw
   document. Decided by the maintainer, 2026-09-04. The design spec said "the
   shipped default answers the body as it arrived" — written before the contract
   existed, and now contradicting it: `IAdtPackageBrowsing<TContents = IPackageContentItem[]>`
   and `IAdtRequest<TList = ITransportTree>` declare parsed defaults, while
   `IRuntimeDumps<TList = string>` declares the document, each because that is
   what its member answered. A factory disagreeing with the contract it returns
   would retype every existing call to `string` and say nothing. The spec is
   corrected; `packageRaw` and `dumpDocument` remain exported, one strategy away.

10. **A type parameter defaults with `typeof`, never with its constraint.**
    `AdtUtils<R extends IUtilsResults = IUtilsResults>` answers `unknown` for
    every key, undoing what `satisfies` bought, and the no-argument `getUtils()`
    is the call almost every consumer makes. Written as
    `= typeof utilsDocuments`, and the same for `RuntimeDumps` and `AdtRequest`.

11. **The move is into several strategies, and only the pure half moves.** Step 3
    said "move that code into the strategy", which cannot be done: the old package
    readers issue a request per object type and recurse into sub-packages, while
    `IResultStrategy` is synchronous, sees one document and holds no connection.
    The mapping functions move — named file by file — the walk is deleted, and
    one old reader becomes four readings. What each yields from a single document
    is stated in Step 3a and asserted in Step 1, because those semantics are new:
    the old member answered a flattened sub-tree and no reading here does.

**What did not change:** every task about `answering`, the two strategies, the
per-type result types, the casts, the negative cases, the visible skips and the
two acceptance runs. The 30.0.0 delta is real but small; most of the 715 errors
are the 29.0.0 migration this plan already describes and which was never
executed.
