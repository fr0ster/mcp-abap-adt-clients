# `adt-clients` onto the 29.0.0 contracts — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `@mcp-abap-adt/adt-clients` onto the `@mcp-abap-adt/interfaces@29.0.0` contracts, so every member answers `IAdtResponse` with SAP's own message on failure instead of throwing a fabricated one.

**Architecture:** A new `answering()` composes one request with two consumer-owned strategies — an error strategy that decides whether the answer is a failure, and a result strategy that decides how it becomes a value. Each object type declares one named result type per member in its own `types.ts`, replacing the deleted state bags. The result strategy is selected at the factory in `AdtClient`, whose return type is ours, so `@mcp-abap-adt/interfaces` is not touched.

**Tech Stack:** TypeScript (strict, CommonJS), Biome, Jest. `@mcp-abap-adt/interfaces@^29.0.0`. `@mcp-abap-adt/connection` dev-only, for integration tests against a real SAP system.

## Global Constraints

- `@mcp-abap-adt/interfaces` **is not modified**. 29.0.0 is published and final for this work.
- All repository artifacts in English. Comments explain *why*.
- Never change `package.json` version. The number and `npm publish` are the maintainer's.
- All diagnostics through the injected `ILogger`. `console.*` is banned by `noConsole`.
- No `"link": true` in `package-lock.json`; everything resolves from the npm registry.
- Gate for every commit: `npm run lint:check` exits 0.
  **`npm run build` and `npm run test:check` are both expected to fail from Task 1
  until the `AdtUtils` task** — `test:check` is red today with the same migration
  errors, in scripts, tests and handlers alike —
  which is the first point where the whole package compiles. A migration of this
  size cannot keep either type-check green at every step, and pretending otherwise
  would mean one enormous commit or a false claim in each small one. Commits in
  that window use `--no-verify` and say in their message that the type-checks are
  still red and why. `lint:check` stays green throughout and is the gate that
  actually holds.
- **One SAP-touching run at a time**, and no edits under `src/` while one is in flight.
- Test output: `npm test 2>&1 | tee test-run.log`, then read the file. Never pipe through `grep`/`head`/`tail`.
- Deleting or renaming a symbol: enumerate first, edit, then grep the repository for it **including comments, README and docs**, and compare counts before and after. Three regex sweeps in the contracts package silently deleted six types and the first field of three others while every check stayed green.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/adtResponse.ts` | `answering()`, `succeeded`, `failed`, `recogniseFailure`. The composition of the two strategies lives here and nowhere else. |
| `src/utils/resultStrategy.ts` (new) | The `IResultStrategy` shape and the shipped defaults (`rawDocument`, and the short/full pairs for large answers). |
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
npm run lint:check && npm run build
```

Expected: the batch errors are gone. Other migration errors remain — see the
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
- Consumes: `IAdtWireResponse`, `IAdtError`, `IAdtResponse`, `IAdtResult` from `@mcp-abap-adt/interfaces`; `recogniseFailure` (already in `adtResponse.ts`).
- Produces:
  - `type IResultStrategy<T> = (wire: IAdtWireResponse) => T`
  - `const rawDocument: IResultStrategy<string>`
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
 * A strategy is chosen per handler at the factory rather than per call, because
 * that is how consumers work: a backup tool wants documents whole for everything
 * it touches, a script wants two fields from every read, an MCP server picks by
 * what its model is about to do. None changes its mind between `create` and
 * `read` of the same object.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';

/** Reads a value out of the answer ADT gave. */
export type IResultStrategy<T> = (wire: IAdtWireResponse) => T;

/**
 * The shipped default: the body as it arrived.
 *
 * Not parsed, not trimmed. Decision 5 in `@mcp-abap-adt/interfaces` leaves the
 * document to whoever wants a shape out of it, and this library does not know
 * which fields a caller needs.
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
export type { IResultStrategy } from './resultStrategy';
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/shared/answeringComposition.test.ts 2>&1 | tee unit-run.log
```

Expected: 6 passed.

- [ ] **Step 7: Export `recogniseFailure`**

`chain` (Task 4) classifies a real exception and cannot reach a private function.
Change `function recogniseFailure` at `src/utils/adtResponse.ts:68` to
`export function recogniseFailure`, so the classification has one home rather
than two copies that drift.

- [ ] **Step 8: Red-proof the no-wire rule**

Temporarily change the `if (!wire)` branch to `return succeeded(read(wire as never));`. Re-run. Expected: the "cannot be cleared into a success when nothing came back" case fails. Revert the change and re-run to green. A rule nobody has seen fail is a rule nobody has tested.

- [ ] **Step 9: Commit**

```bash
git add src/utils/resultStrategy.ts src/utils/adtResponse.ts src/__tests__/unit/shared/answeringComposition.test.ts
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
- Produces: `interface IClassResults { created; source; metadata; check; activation; validation; deletion; updated }` and `const classDocuments: IClassResults` — the default strategy set for a class handler.

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
 * One strategy per member of a class handler.
 *
 * A handler is given a whole set at the factory rather than a strategy per call:
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
git commit -m "feat(class): the default result strategies for a class handler

One strategy per member, given to a handler as a set at the factory rather than
per call — a consumer wanting documents whole wants them for every member it
touches. The default answers each document as it arrived."
```

---

### The migration inventory

Every removed state type and every file naming it. A batch is not done until its
rows are clear. Counts are from `grep -rl` on 2026-09-04; re-measure rather than
trust them.

| state | files | handlers beyond the obvious one |
|---|---:|---|
| `IClassState` | 12 | `AdtClassLegacy`, `AdtLocalDefinitions`, `AdtLocalMacros`, `AdtLocalTestClass`, `AdtLocalTypes`, `AdtClassMemberBase` |
| `IDdlState`, `IFunctionGroupState`, `IFunctionModuleState`, `IInterfaceState`, `IPackageState`, `IProgramState` | 6 each | each has an `Adt<Type>Legacy` |
| `IUnitTestState` | 6 | `AdtUnitTestLegacy`; `unitTestContractConformance.test.ts` |
| `IAuthorizationFieldState`, `IFunctionIncludeState`, `ITransformationState` | 5 each | — |
| `IIncludeState` | 4 | `__tests__/helpers/testTemplate.ts` |
| `IAccessControlState`, `IBehaviorDefinitionState`, `IBehaviorImplementationState`, `IDataElementState`, `IDomainState`, `IMessageClassState`, `IMetadataExtensionState`, `IServiceDefinitionState`, `IStructureState`, `ITableState`, `ITableTypeState`, `IEnhancementState` | 4 each | — |
| `IServiceBindingState` | 4 | `core/service/AdtService.ts` — **not** under a `<type>` directory |
| `ICdsUnitTestState` | 4 | `core/unitTest/AdtCdsUnitTest.ts` — a second handler in one module |
| `ITransportState` | 4 | `AdtRequest`, `AdtRequestLegacy` |
| `IMessageClassMessageState` | 3 | `core/messageClass/AdtMessageClassMessage.ts` — a second handler |
| `IAppendStructureState`, `IScalarFunctionState`, `IScalarFunctionImplementationState` | 3 each | — |
| `IFeatureToggleState` | 3 | `core/featureToggle/AdtFeatureToggle.ts` |

`IFeatureToggleRuntimeState` **survives** — it is an ADT payload shape, not a
state bag, and is still declared in `interfaces`. Do not delete it.

**Modules that hold more than one handler**, and are therefore easy to leave half
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
  (all four class-include handlers name `IClassState` and are written under the
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
    private readonly results: R = classDocuments as unknown as R,
  ) { /* … */ }
}
```

  **`AdtClassMemberBase` must be generic in the same `R`**, and so must the four
  class-include handlers. `activate` and `readMetadata` are inherited from the
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
  `Promise<IAdtResponse<ReturnType<R['source']>>>`, not `ClassSource`. The single
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
    // by the client. Constructing the handler directly skips it, and every
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

In `src/core/class/AdtClass.ts`: change the `implements` clause to the atom list in **Interfaces** above; add `private readonly results: IClassResults = classDocuments` to the constructor; delete every `state` object, every `errors: []`, and the `AdtOperationError` import and its four throw sites.

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

Add `src/core/shared/chain.ts`:

```typescript
/**
 * Run a chain of requests as a resource scope.
 *
 * Cleanup used to run from a `catch`, which worked only because a refusal threw.
 * A refusal is now a value, so an unguarded early return would leave the object
 * locked on the server and the session stateful, with nothing raised to say so.
 *
 * **Cleanup runs on every path** — success, returned failure, and exception — in
 * reverse order of registration. That is the difference between a cleanup and an
 * error handler, and getting it wrong leaks a lock on the happy path, which is
 * the one that runs most.
 *
 * A registration can be **discharged** when the resource is released normally:
 * `onScopeEnd` returns a handle, and calling it removes that entry, so a chain
 * that unlocks as its own step does not unlock twice.
 *
 * An error raised *by* cleanup is logged, never propagated: a failing unlock must
 * not replace the reason the chain failed, which is what the caller needs.
 */
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
 * A class handler, answering documents.
 *
 * The result strategy is chosen here rather than per call because a consumer
 * that wants a particular shape wants it for every member of the handler. The
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
// The implementation is generic too. Erasing R here would build the handler at
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

- [ ] **Step 4: Prove the handler and the overload agree on `R`**

A compile-only assertion, in the same file. A runtime test cannot catch the
factory building at `unknown` while its signature promises otherwise:

```typescript
// Compile-only: if these stop compiling, the factory and the handler disagree.
const named = {
  ...classDocuments,
  source: (wire: IAdtWireResponse) => ({ name: String(wire.data) }),
};
type Handler = ReturnType<AdtClient['getClass']>;
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
| 9 | `ddl`, `metadataExtension`, `accessControl`, `serviceDefinition`, `service` (handler is `AdtService`, state `IServiceBindingState`), `behaviorDefinition`, `behaviorImplementation` |
| 10 | `package`, `transport` (`AdtRequest` **and** `AdtRequestLegacy`), `enhancement`, `transformation`, `messageClass` (`AdtMessageClass` **and** `AdtMessageClassMessage`) |
| 11 | `unitTest` (`AdtUnitTest`, `AdtCdsUnitTest`, `AdtUnitTestLegacy`), `authorizationField`, `featureToggle`, `scalarFunction`, `scalarFunctionImplementation` |

Per type, in order:

- [ ] **Step 1:** Read `src/core/<type>/{create,read,update,delete,check,activation,validation}.ts` and note what each request asks for and what ADT answers.
- [ ] **Step 2:** Write `src/core/<type>/types.ts` — one named result type per member with the measured behaviour in its doc comment, plus `I<Type>Results` and `<type>Documents`, following `src/core/class/types.ts`.
- [ ] **Step 3:** Rewrite `src/core/<type>/Adt<Type>.ts` to declare its atoms and return `answering(...)` per request.
- [ ] **Step 4:** Add the factory overload in `src/clients/AdtClient.ts`, following `getClass`.
- [ ] **Step 5:** Read the casts in that module; remove the redundant, fix what the rest hid.
- [ ] **Step 6:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "^src/core/<type>/"` — expect no output.
- [ ] **Step 7:** `grep -rn "I<Type>State" src` — expect no matches. A module with two handlers is only done when both are clear; check the inventory row rather than the directory listing.

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
- Create: `src/core/transport/results.ts`, `src/runtime/dumps/results.ts`, `src/core/package/results.ts`
- Modify: `src/index.ts` (export them; a strategy a consumer cannot import is not an option they have)
- Test: `src/__tests__/unit/core/resultStrategies.test.ts`

**Interfaces:**
- Consumes: `IResultStrategy`, `rawDocument` (Task 2).
- Produces, each an `IResultStrategy` and each exported from the package root:
  - `transportNumbers: IResultStrategy<string[]>` — request numbers alone
  - `transportTree: IResultStrategy<ITransportTree>` — containers, descriptions, and the **language** a request carries, which nothing currently exposes
  - `dumpList: IResultStrategy<IDumpSummary[]>` — `{ id, at, program, message }`
  - `dumpDocument = rawDocument`
  - `packageNames: IResultStrategy<IAdtObjectHit[]>` — name and ADT type code
  - `packageStructure: IResultStrategy<IRepositoryNodeContents>` — the full node structure

- [ ] **Step 1:** Write the failing test: for each pair, the same captured document read by both strategies, asserting the short one carries the identifying fields and the full one carries what the short one drops. Assert the short is **not** a prefix or subset-by-truncation of the full — it is a different reading, and a test that only checks length would pass a truncation.
- [ ] **Step 2:** Run it; expect FAIL on the missing exports.
- [ ] **Step 3:** Implement, parsing with `fast-xml-parser` as the existing parsers do.
- [ ] **Step 4:** Export from `src/index.ts`, and add each to the docs list `npm run check:docs` reads.
- [ ] **Step 5:** Run the tests; expect pass. Run `npm run check:docs`; expect 0.
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
// members. `IRuntimeDumps` in interfaces 29.0.0 declares them answering
// IAdtWireResponse and is NOT changed by this work, so the class stops declaring
// `implements IRuntimeDumps` and states its own contract instead. That is the
// honest move: a class cannot both answer the contract and answer the frame, and
// interfaces is closed for this migration.
export class RuntimeDumps<R extends IDumpResults<unknown> = IDumpResults> {
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
`document` serves `getById`. Callers of all three migrate in this task — find them
with `grep -rn "getDumps()" src`.

```typescript

// src/clients/AdtRuntimeClient.ts
getDumps(): RuntimeDumps;
getDumps<R extends IDumpResults<unknown>>(results: R): RuntimeDumps<R>;
```

Package contents reach a caller through `AdtUtils.getPackageContents`, whose
result set is given to `AdtUtils` at construction — so `AdtClient.getUtils()`
gains the same pair of overloads, and `src/core/shared/AdtUtils.ts` takes
`results: IUtilsResults` alongside its connection. Both are done in the
`AdtUtils` task, and this step is not complete until that one names them.

- [ ] **Step 7:** Test each factory with both sets: one call, two shapes, and the
short one typed as its own type rather than as `unknown`.

- [ ] **Step 8:** Commit.

---

### Task 13: `AdtUtils` and the legacy clients

**Files:**
- Modify: `src/core/shared/AdtUtils.ts`, `src/core/shared/AdtUtilsLegacy.ts`, `src/clients/AdtClientLegacy.ts`, and the 13 `*Legacy.ts` files under `src/core/`

**Interfaces:**
- Consumes: `answering`, `rawDocument` (Task 2).
- Produces: no new names; `AdtUtils`' 25 members keep theirs.

- [ ] **Step 1:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "AdtUtils|Legacy"` — this is the work list.
- [ ] **Step 2:** `AdtUtils`' members already answer `IAdtResponse`; they lose the extra `IAdtResult` layer and the twelve that answered `IAdtWireResponse` answer `rawDocument` of it instead.
- [ ] **Step 3:** The legacy clients follow their non-legacy counterparts. Legacy systems answer differently, but the *contract* is the same — a separate implementation is the point of the contract existing.
- [ ] **Step 4:** `npm run lint:check && npm run build && npm run test:check` — all 0. This is the first point where the whole package compiles.
- [ ] **Step 5:** Commit.

---

### Task 14: The integration tests read the verdict from the contract

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

### Task 15: Full run against the cloud trial

- [ ] **Step 1:** Confirm no other SAP-touching run is in flight, and that the token in `.env` is valid.
- [ ] **Step 2:** `npm test 2>&1 | tee test-run.log`
- [ ] **Step 3:** Read `test-run.log`. Baseline before the migration: 178 suites, 1342 tests, 1318 passed, 22 failed, 2 skipped.
- [ ] **Step 4:** Classify every failure. Acceptable: environmental (leftover objects, missing shared dependencies, cloud-unsupported operations). Not acceptable: anything attributable to this migration.
- [ ] **Step 5:** Confirm every skip printed its reason, and that the count of executed tests is stated rather than implied.
- [ ] **Step 6:** Commit the log summary in the CHANGELOG entry, not the log itself.

---

### Task 16: On-prem acceptance

The report this whole line of work started from. The cloud trial cannot show it: `ZLOCAL` is local and `transport_request` is unset, which the last full run confirmed by skipping `read_transport`.

- [ ] **Step 1:** Warn the user before launching — on-prem runs from a different machine.
- [ ] **Step 2:** Create and modify a class in a package that **requires a transport request**, without supplying one.
- [ ] **Step 3:** Assert the caller receives `ok: false`, `origin: 'refusal'`, and SAP's own sentence about the transport request — not a sentence composed by this library, and not truncated.
- [ ] **Step 4:** Run `sqlQuery` and `tableContents`, which execute here for the first time.
- [ ] **Step 5:** Record the outcome in the CHANGELOG under the version the maintainer chooses.

---

## Self-review

**Spec coverage.** Consumer-owned interpretation on two axes → Tasks 2, 3, 5. `analyse` composition and the no-wire rule → Task 2, red-proofed; chain cleanup on every path → Task 4, three tests. Result strategy at the factory → Tasks 5 and 12, with the short/full pairs bound to factories in Task 12. Per-type result types → Tasks 3, 7–11. Legacy migrates, batch deleted → Tasks 1, 13. Casts → Task 6 and each batch. Both test directions and negative cases as their own body → Task 6. Visible skips → Task 14. Full trial run → Task 15. On-prem acceptance → Task 16. `interfaces` untouched → Global Constraints.

**Placeholders.** None: every code step carries the code, and the batches in Tasks 7–11 name their types and their six steps rather than saying "as above".

**Type consistency.** `IResultStrategy<T>`, `IAnalyse`, `rawDocument`, `nothing` are defined in Task 2 and used under those names in 3, 4, 5 and the batches. `IClassResults` / `classDocuments` are defined in Task 3 and consumed in 4 and 5. `answering(run, read, analyse?)` keeps that argument order everywhere.
