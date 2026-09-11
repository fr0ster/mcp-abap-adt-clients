# Strategies, Not Judgements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `adt-clients` to a client that speaks ADT and relays what came
back. Every reading that turns a response into a verdict leaves the package, and
so does every member that makes several requests and therefore cannot be given
one. What stays is the pair a consumer needs to collect a corpus of responses,
from which they build their own pool of strategies.

**Architecture:** `answering(run, read, analyse)` in `src/utils/adtResponse.ts`
already composes a request with an injected result strategy and an injected
failure strategy. Today the library also *supplies* the failure strategies —
`validationRefusal`, `activationRefusal`, `deletionRefusal` are wired as
defaults at roughly 190 call sites, and `parseCheckRunResponse` decides whether
a check run "failed". Those are the consumer's decisions. They come out. The
default result strategy stays `rawDocument`: the body as it arrived, unparsed
and untrimmed, so no member's return type moves. The default failure strategy
becomes none at all.

**Tech Stack:** TypeScript (strict, CommonJS), Jest, Biome, `fast-xml-parser`,
`@mcp-abap-adt/interfaces` for every contract.

**Atomicity.** Task 1 is large and cannot be split. `parseCheckRunResponse` has
eighteen callers among the nineteen `src/core/*/check.ts` files, and every
`?? xxxRefusal` default is a compile-time reference. Deleting a reading and
rewiring its callers in separate commits leaves the tree red in between, so they
are one task with one commit. Tasks 2 onward are independent and small.

**Spec:** none as a file. The decisions this plan argues from were taken in
conversation on 2026-09-11 and are copied into Global Constraints below.
Executors read that section as the spec.

## Global Constraints

Project-wide. Every task's requirements implicitly include them.

1. **No validation.** `adt-clients` does not check its own inputs. A caller who
   omits a name gets a URL built from what they gave and an answer from the
   server. The server is the authority on its own requests.
2. **No judging the response.** No member decides whether what came back is
   good. It returns what came back.
3. **No error handling that loses the answer.** A `catch` may not replace a
   response with a string it composed. A failure carries `response` and
   `request` so the consumer sees the whole exchange.
4. **Only corpus-collection strategies ship here.** `rawDocument` (the body as
   it arrived) and `wireItself` (the whole exchange) for results; for failures,
   `nothingIsARefusal`, which finds none. The interpreting strategies —
   `validationRefusal`, `activationRefusal`, `deletionRefusal`,
   `parseCheckRunResponse` and the assert/parse helpers around them — are
   **deleted in one major**, not deprecated. Their code stays recoverable in
   git; the consumer lifts what it wants into its own strategy package.
5. **The default failure strategy is none.** Members pass `options?.analyse`
   through and no longer substitute one. A request that threw with a response
   attached still becomes an `IAdtError` carrying that response, via
   `recogniseFailure` — that is the transport's verdict on its own exchange, not
   this library's reading of SAP's document. A consumer who wants even that
   cleared passes `nothingIsARefusal`.
6. **A note is part of the contract.** The consumer reads our comments when
   deciding what to inject, so a note may not assert what SAP does. It states
   what this implementation does. An observation is kept where it explains a
   choice, but **the system it was observed on is never named** — scrub system
   IDs (`E19`, `E77`), release identifiers (`RFCSAPRL 816`), "trial"/"trial
   system" used as an identity, and object names carried from a capture
   (`ZOK_MESSAGE_0002`, `ZAC_INCL01`, `ZAC_CDSUT_CLS`). A bare date is fine.
   Where the observation existed only to justify a strategy that Task 1 deletes,
   it goes with it.
7. **Nothing is released until the consumer's strategy package exists.** No
   `package.json` version bump, no CHANGELOG entry, no tag, no GitHub release,
   no publish — in any task. The work lands on a branch and waits. The user is
   collecting the corpus that the strategy pool will be built from; this package
   is not released until that pool is in hand.
8. **One member, one endpoint call.** This is the rule the whole design rests
   on: `IResultStrategy` takes one answer, so a member that makes several
   requests has already chosen the shape for the consumer and cannot be given a
   reading. One request, one answer, one injectable reading —
   `fetchNodeStructure` is the pattern. A walk, a read-modify-write, or a
   lock-write-unlock chain composed over such members is the consumer's
   sequence, not a member. Issue #141 for the walkers; Task 7 for the five
   updates that read before they write; Task 8 for the ten chains.
   `AdtMessageClassMessage.writeClass` is the one exception, confirmed by the
   user and documented in `CLAUDE.md`.
9. **Tests are not deleted for composing several calls.** A test imitates a
   consumer, and a consumer's sequence is exactly what this release hands them,
   so a test that locks, writes and unlocks across three members is *correct*
   and is what the new shape looks like from outside. Where a test called a
   member this plan removes, it writes that member's sequence itself — the same
   migration a real consumer performs, exercised. The one carve-out: a test that
   asserts behaviour which no longer exists — a guard's message, a deleted
   reading's verdict — pins something that is gone and goes with it.
10. **Three layers, and a decision belongs to exactly one.** *adt tools* — this
    package — give the instrument: one member, one endpoint call, no order, no
    wait, no verdict. *mcp tools* — the server — compose the sequence and judge
    what a body means. The *llm pipeline* decides what is wanted. A join made
    here cannot be replaced by the layer that owns it, so when a member would do
    two things, the join goes up.
11. Language: English for every artifact. Biome: single quotes, semicolons,
   2-space indent. Diagnostics through the injected `ILogger`, never `console.*`.

**Running the tests.** Everything here is covered by unit tests, which need no
SAP system:

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit
```

The integration suite must not be run as part of these tasks — one SAP-touching
run at a time, and no task here needs one.

**Branch.** Create it once, before Task 1, and keep every task on it:

```bash
git checkout -b feat/strategies-not-judgements
```

---

### Task 1: the interpreting strategies come out

**Why:** these are the consumer's decisions living in the library. Measured
footprint before the change:

| symbol | src | tests | docs |
|---|---|---|---|
| `deletionRefusal` | 74 | 2 | 3 |
| `validationRefusal` | 62 | 10 | 6 |
| `activationRefusal` | 53 | 13 | 5 |
| `parseCheckRunResponse` | 48 | 6 | 15 |
| `withRefusalDetection` | 10 | 7 | 0 |
| `parseDeletionCheck` | 3 | 1 | 0 |
| `assertDeletable` | 2 | 0 | 0 |
| `assertActivationSucceeded` | 1 | 1 | 0 |

One task, one commit, because the pieces reference each other at compile time.
Eighteen of the nineteen `check.ts` files call `parseCheckRunResponse`; four
documentation files import symbols being deleted and `npm run check:docs` fails
on a documented import that does not exist.

**Files:**
- Delete: `src/utils/validationRefusal.ts`, `src/utils/deletionCheck.ts`
- Modify: `src/utils/refusalAware.ts` — **not deleted.** See Step 6b: it does
  two jobs and only one of them is a judgement.
- Modify: `src/clients/AdtClient.ts:835`, `src/clients/AdtRuntimeClient.ts:76`,
  `src/clients/AdtExecutor.ts:13`, `src/core/shared/AdtUtils.ts:233` — the four
  constructors that wrap their connection
- Modify: `src/utils/activationUtils.ts` — keep `buildObjectUri` and
  `activateObjectInSession`; delete `extractActivationMsgText`,
  `detectActivationFailure`, `assertActivationSucceeded`, `activationRefusal`
- Modify: `src/utils/checkRun.ts` — delete `parseCheckRunResponse` and the
  `CheckMessage` interface; keep `runCheckRun`, `runCheckRunWithSource`, the XML
  builders and `CheckRunVersion`
- Modify, all nineteen: `src/core/{accessControl,appendStructure,authorizationField,class,dataElement,ddl,domain,enhancement,featureToggle,functionGroup,functionInclude,functionModule,interface,program,scalarFunction,scalarFunctionImplementation,serviceDefinition,structure,transformation}/check.ts`
- Modify: every file matching `grep -rl "?? validationRefusal\|?? activationRefusal\|?? deletionRefusal" src --exclude-dir=__tests__`
- Modify: **`src/index.readings.ts`** — this is the barrel that exports the
  strategies (lines 139, 159, 161, 162), re-exported by `src/index.ts`. Editing
  `src/index.ts` alone changes nothing.
- Modify: `docs/usage/OBJECT_LIFECYCLE.md`, `docs/usage/CLIENT_API_REFERENCE.md`,
  `docs/usage/TROUBLESHOOTING.md`, `docs/architecture/ARCHITECTURE.md` — every
  passage naming a deleted symbol
- Delete: `src/__tests__/unit/utils/activationRefusal.test.ts`,
  `src/__tests__/unit/utils/validationRefusal.test.ts`
- Test: `src/__tests__/unit/onlyCorpusStrategiesShip.test.ts` (create),
  `src/__tests__/unit/core/checkReturnsReport.test.ts` (create)

**Interfaces:**
- Consumes: `IAnalyse`, `IResultStrategy`, `IAdtWireResponse` from
  `@mcp-abap-adt/interfaces`.
- Produces: no new symbol. Every member keeps its signature; only the default
  value of its `analyse` argument changes, from a named refusal to `undefined`.
  Every `check*` function keeps its name and its `Promise<IAdtWireResponse>`
  return type. `rawDocument` stays the default reading everywhere it already is.

- [ ] **Step 1: Write the surface test**

Create `src/__tests__/unit/onlyCorpusStrategiesShip.test.ts`:

```typescript
import * as api from '../../index';

/**
 * This package ships the strategies a consumer needs to collect a corpus of
 * responses, and no reading that turns one into a verdict. Interpreting those
 * responses is the consumer's, built from their own corpus.
 */
describe('the public surface', () => {
  it('offers the corpus readings', () => {
    expect(typeof (api as Record<string, unknown>).rawDocument).toBe('function');
    expect(typeof (api as Record<string, unknown>).wireItself).toBe('function');
  });

  it.each([
    'validationRefusal',
    'activationRefusal',
    'deletionRefusal',
    'parseCheckRunResponse',
    'parseDeletionCheck',
    'assertDeletable',
    'assertActivationSucceeded',
    'withRefusalDetection',
    'DeletionNotPermittedError',
  ])('no longer exports %s', (name) => {
    expect(api).not.toHaveProperty(name);
  });
});
```

- [ ] **Step 2: Write the behavioural check-run tests**

Not a source regex. `check.ts` files also hold input guards that live until
Task 10, and unreachable-branch throws; a regex over source would forbid those
too. What matters is behaviour: a report carrying an `E` comes back as the
answer.

Create `src/__tests__/unit/core/checkReturnsReport.test.ts`:

```typescript
import type { IAbapConnection, IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { checkClass } from '../../../core/class/check';
import { checkDdl } from '../../../core/ddl/check';
import { checkAccessControl } from '../../../core/accessControl/check';
import { checkFunctionModule } from '../../../core/functionModule/check';

const report = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun">
  ${inner}
</chkrun:checkRunReports>`;

/** A syntax error found. The check itself worked. */
const withError = report(`
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:status="processed"
    chkrun:statusText="checked">
    <chkrun:checkMessageList>
      <chkrun:checkMessage chkrun:type="E" chkrun:shortText="Field FOO unknown"/>
    </chkrun:checkMessageList>
  </chkrun:checkReport>`);

/** The server declining to run the check at all. Still an answer. */
const notProcessed = report(`
  <chkrun:checkReport chkrun:reporter="abapCheckRun" chkrun:status="notProcessed"
    chkrun:statusText="Data definition does not exist"/>`);

const respondingWith = (body: string) => {
  const calls: number[] = [];
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async () => {
      calls.push(1);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: body,
      } as IAdtWireResponse;
    },
  };
  return { connection: connection as IAbapConnection, calls };
};

describe('a check run that finds an error', () => {
  it('comes back from checkClass as the response', async () => {
    const { connection } = respondingWith(withError);
    const answer = await checkClass(connection, 'ZOK_CL', 'inactive');
    expect(answer.status).toBe(200);
    expect(answer.data).toContain('Field FOO unknown');
  });

  it('comes back from checkAccessControl as the response', async () => {
    const { connection } = respondingWith(withError);
    const answer = await checkAccessControl(connection, 'ZOK_DCL', 'inactive');
    expect(answer.data).toContain('Field FOO unknown');
  });
});

describe('a check run the server did not process', () => {
  it('comes back from checkFunctionModule as the response', async () => {
    const { connection } = respondingWith(notProcessed);
    const answer = await checkFunctionModule(
      connection,
      'ZOK_FG',
      'ZOK_FM',
      'inactive',
    );
    expect(answer.data).toContain('does not exist');
  });

  it('is not retried by checkDdl', async () => {
    const { connection, calls } = respondingWith(notProcessed);
    const answer = await checkDdl(connection, 'ZOK_DDL', 'inactive');
    expect(answer.data).toContain('does not exist');
    expect(calls).toHaveLength(1);
  });
});
```

The four signatures, verified against the current tree:

```
checkClass(connection, className, version, sourceCode?, artifactContentType?)
checkDdl(connection, ddlName, version = 'active', sourceCode?, logger?)
checkAccessControl(connection, accessControlName, version = 'inactive', sourceCode?, logger?)
checkFunctionModule(connection, functionGroupName, functionModuleName, version, sourceCode?, contentTypes?)
```

`checkFunctionModule` takes the version as its **fourth** argument and it is not
optional.

- [ ] **Step 3: Run both tests to verify they fail**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/onlyCorpusStrategiesShip.test.ts src/__tests__/unit/core/checkReturnsReport.test.ts`
Expected: the surface test fails on the exported names; the check tests fail by
rejecting with `Class check failed: Field FOO unknown` and, for `checkDdl`, by
calling the connection twice.

- [ ] **Step 4: Rewrite the nineteen `check.ts` files**

The shape is **not** uniform. Three kinds:

*Plain* — sixteen files. `src/core/class/check.ts` ends `checkClass` with a
`parseCheckRunResponse` call, a `has_errors` branch and a throw. Delete all
three lines and the `parseCheckRunResponse` name from the `await import(...)`
destructuring, leaving `return response;`. Leave any `if (!name) throw new
Error('… is required')` guard exactly where it is — those belong to Task 10.

*Retrying* — `src/core/ddl/check.ts` and `src/core/accessControl/check.ts`. The
loop exists to re-run a check the server answered `notProcessed`, on the theory
that an inactive version had not materialised yet. That is a judgement about the
server and a wait this package does not own. Reduce `checkDdl` to:

```typescript
export async function checkDdl(
  connection: IAbapConnection,
  ddlName: string,
  version: CheckRunVersion = 'active',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  return runCheckRun(
    connection,
    'view',
    ddlName,
    version,
    'abapCheckRun',
    sourceCode,
  );
}
```

deleting `shouldRetryMissingVersion`, `delay`, and the now-unused `logger`
parameter. Do the same to `checkAccessControl`. A consumer who wants that retry
writes it around the call.

*Status-branching* — `src/core/functionModule/check.ts` throws separately on
`status === 'notProcessed'`. Delete that branch with the rest.

Delete every `@throws Error if check finds errors (chkrun:type="E")` line from
the doc comments in all nineteen files.

- [ ] **Step 5: Fix the callers that relied on the throw**

Run: `grep -rn "checkClass\|checkProgram\|checkInterface\|checkDdl\|checkDomain\|checkAccessControl\|checkFunctionModule" src --exclude-dir=__tests__`
A member that wrapped the check in `try/catch` to convert the throw into a
failure deletes the `try/catch` and returns the answer. Do not add an `analyse`
in its place — that belongs to the consumer's strategy pool.

- [ ] **Step 6: Unwire the refusal defaults**

The edit is the same everywhere. In `src/core/class/AdtClass.ts:133`:

```typescript
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
```

becomes

```typescript
      options?.analyse,
```

and the import line goes. Members that already pass `options?.analyse` straight
through — `AdtClass.read` is one — need no change. Find them all with:

```bash
grep -rn "?? validationRefusal\|?? activationRefusal\|?? deletionRefusal" src --exclude-dir=__tests__
```

Work one object-type directory at a time, running `npm run build:fast` after
each so a missed import surfaces next to the file that caused it.

- [ ] **Step 6b: Split the connection wrapper — keep the trace, drop the verdict**

`withRefusalDetection` in `src/utils/refusalAware.ts` wraps every connection the
four clients are given, and does three things:

1. On a thrown error, parses the body with `sapErrorIn` and throws a richer
   refusal built from it. **A reading of SAP's document. Goes.**
2. On a 2xx, parses the body with `sapErrorIn` and throws if it recognises a
   refusal. This is the "a 200 can be a refusal" behaviour. **A reading of SAP's
   document. Goes.**
3. On every answer, returns `{ ...response, request: { method, url } }`.
   **Mechanical, and load-bearing.**

Do not delete the file. The connection normalises a successful answer down to
`status`, `statusText`, `headers` and `data`, dropping `config` and `request`;
this wrapper is the only place the URL still exists. `requestOf()` in
`src/utils/requestTrace.ts` reads it back, and ten call sites build
`IAdtError.request` from it. Deleting the wrapper wholesale makes every one of
them `undefined` and breaks constraint 3 — a failure that cannot say which
request it was.

Replace the function with a trace-only wrapper, and move it to
`src/utils/requestTrace.ts` where its vocabulary already lives:

```typescript
/**
 * Puts the request back on the answer.
 *
 * The connection normalises a 200 down to four fields and drops the URL, so a
 * failure built further up cannot say which call it was. This is the last place
 * that information exists. It reads nothing and decides nothing: what a body
 * means is the consumer's, through their own `analyse`.
 */
export function withRequestTrace(connection: IAbapConnection): IAbapConnection {
  if (installed.has(connection) || typeof connection?.makeAdtRequest !== 'function') {
    return connection;
  }
  installed.add(connection);
  const base = connection.makeAdtRequest.bind(connection);

  connection.makeAdtRequest = async function withTrace<T = unknown, D = unknown>(
    request: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    const asked = { method: request?.method, url: request?.url };
    const response = await base<T, D>(request);
    return { ...response, request: asked };
  };

  return connection;
}
```

Keep the `installed` WeakSet guard and the `typeof makeAdtRequest !== 'function'`
early return exactly as they are — some members compute a URI and never call
out, and are exercised with a connection that offers nothing else.

Then point the four constructors at it:
`src/clients/AdtClient.ts:835`, `src/clients/AdtRuntimeClient.ts:76`,
`src/clients/AdtExecutor.ts:13`, `src/core/shared/AdtUtils.ts:233`.

Add to `src/__tests__/unit/utils/corpusCollection.test.ts` or a sibling: a 200
answered through a wrapped connection still carries `request.url`, and a body
holding an ADT exception document no longer throws.

- [ ] **Step 7: Delete the modules, parser last**

Only now, with no callers left:

```bash
git rm src/utils/validationRefusal.ts src/utils/deletionCheck.ts
git rm src/__tests__/unit/utils/activationRefusal.test.ts src/__tests__/unit/utils/validationRefusal.test.ts
```

In `src/utils/activationUtils.ts`, delete `extractActivationMsgText`,
`detectActivationFailure`, `assertActivationSucceeded` and `activationRefusal`
with their doc comments — including the probed table, which existed to justify a
default that no longer ships. Keep `buildObjectUri` and
`activateObjectInSession`: they build and send a request, which is this
package's job.

In `src/utils/checkRun.ts`, delete `parseCheckRunResponse` and the
`CheckMessage` interface. Keep `runCheckRun`, `runCheckRunWithSource`,
`CheckRunVersion` and the XML builders.

- [ ] **Step 8: Remove the names from `src/index.readings.ts`**

Delete lines 139, 159 and 162 (`activationRefusal`, `deletionRefusal`,
`validationRefusal`) and any export of `parseCheckRunResponse`,
`withRefusalDetection`, `assertDeletable`, `parseDeletionCheck` or
`DeletionNotPermittedError`. Keep line 161 —
`export { nothing, rawDocument, wireItself } from './utils/resultStrategy';` —
that is the corpus set. Check `src/index.ts` and the other `src/index.*.ts`
barrels for the same names.

- [ ] **Step 9: Rewrite the documentation that names a deleted symbol**

```bash
grep -rln "activationRefusal\|validationRefusal\|deletionRefusal\|parseCheckRunResponse" docs
```

returns `docs/usage/OBJECT_LIFECYCLE.md`, `docs/usage/CLIENT_API_REFERENCE.md`,
`docs/usage/TROUBLESHOOTING.md` and `docs/architecture/ARCHITECTURE.md`. This
must happen inside this task: `npm run check:docs` runs
`scripts/check-doc-imports.js`, which fails on a documented import that no
longer exists.

Each passage is replaced, not patched. Where a doc explained how a shipped
refusal read a response, it now says that this package relays the response. If
Task 4 has already run, link its "Collecting your own corpus" section; if not,
state the behaviour without a link and add the link in Task 4. Do not leave a
sentence describing a reading that no longer exists here.

- [ ] **Step 10: Fix the remaining tests**

Run: `grep -rln "Refusal\|parseCheckRunResponse\|assertDeletable" src/__tests__`
A test whose whole subject is a deleted reading is deleted. A test that merely
imported one to build a fixture passes `undefined` instead.
`src/__tests__/unit/capabilities/behaviour.test.ts` asserts session handling and
must keep passing — if it fails, Step 6 touched `setSessionType`, which it must
not.

- [ ] **Step 11: Run everything**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run build`
Expected: PASS, clean, including `check:docs` inside `lint:check`.

- [ ] **Step 12: Commit**

```bash
git add -A src docs
git commit -m "feat!: the verdict on a response belongs to the consumer"
```

---

### Task 2: `functionGroup` create stops fabricating a 201

**Why:** `src/core/functionGroup/create.ts:96` catches HTTP 400, looks for the
string `Kerberos library not loaded`, and returns `{ ...e.response, status: 201,
statusText: 'Created' }`. The comment says the object "may have been created".
The library does not know that, and a consumer told `201 Created` cannot find
out.

**Files:**
- Modify: `src/core/functionGroup/create.ts:94-118`
- Test: `src/__tests__/unit/core/functionGroupCreateRelaysTheRefusal.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: the exported function is `create` — not `createFunctionGroup` —
  with signature `(connection, params: ICreateFunctionGroupParams, logger?,
  contentTypes?)`. It keeps that signature. On a 400 it rejects with the
  transport's error, which `recogniseFailure` turns into an `IAdtError` carrying
  `response` and `request`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/functionGroupCreateRelaysTheRefusal.test.ts`:

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { create } from '../../../core/functionGroup/create';
import type { ICreateFunctionGroupParams } from '../../../core/functionGroup/types';

const refusing: Partial<IAbapConnection> = {
  makeAdtRequest: async () => {
    const error = new Error('Request failed with status code 400') as Error & {
      response?: unknown;
    };
    error.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      data: '<exc>Kerberos library not loaded</exc>',
    };
    throw error;
  },
};

it('relays a 400 instead of answering 201', async () => {
  await expect(
    create(refusing as IAbapConnection, {
      functionGroupName: 'ZOK_FG',
      description: 'x',
      packageName: 'ZLOCAL',
    } as ICreateFunctionGroupParams),
  ).rejects.toMatchObject({ response: { status: 400 } });
});
```

`ICreateFunctionGroupParams` comes from `@mcp-abap-adt/interfaces` and its
fields are camelCase: the body reads `functionGroupName`, `packageName`,
`description`, `transportRequest`, `masterLanguage`, `masterSystem` and
`responsible`. Snake_case field names would compile only behind a cast and would
describe a call that cannot happen.

- [ ] **Step 2: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/functionGroupCreateRelaysTheRefusal.test.ts`
Expected: FAIL — the call resolves with a fabricated 201 instead of rejecting.

- [ ] **Step 3: Delete the special case**

Remove the whole `if (e.response?.status === 400) { … }` block, including the
`errorData` extraction and the `logger?.debug` line inside it. The `catch` keeps
the debug logging that follows and its final `throw`.

Leave the unrelated `finalResponsible.trim() === ''` normalisation at line 37
alone — that shapes a request before it is sent, which is this package's job.

- [ ] **Step 4: Run it, run the suite**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/functionGroup/create.ts src/__tests__/unit/core/functionGroupCreateRelaysTheRefusal.test.ts
git commit -m "fix(functiongroup): a 400 is answered as a 400"
```

---

### Task 3: the `tabletype` catch stops composing an error string

**Why:** `src/core/tabletype/update.ts:119-126` and `read.ts:52-61` build
`Failed to update table type X: HTTP 400 Bad Request — <body>` and throw it. The
response object is discarded, so `IAdtError.response` arrives empty and the
consumer's strategy has nothing to read.

**Files:**
- Modify: `src/core/tabletype/update.ts:115-130`, `src/core/tabletype/read.ts:48-65`
- Test: `src/__tests__/unit/core/tabletypeRelaysTheResponse.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getTableTypeMetadata(connection, tableTypeName: string, options?,
  logger?)` and `updateTableType(connection, params, lockHandle?, logger?)` keep
  their signatures. Note `getTableTypeMetadata` takes a **name string**, not a
  config object. The other reads in that file are `getTableTypeSource`,
  `getTableType` and `getTableTypeTransport`; there is no `readTableType`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/tabletypeRelaysTheResponse.test.ts`:

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTableTypeMetadata } from '../../../core/tabletype/read';

const refusing: Partial<IAbapConnection> = {
  makeAdtRequest: async () => {
    const error = new Error('Request failed with status code 403') as Error & {
      response?: unknown;
    };
    error.response = {
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      data: '<exc><localizedMessage>no</localizedMessage></exc>',
    };
    throw error;
  },
};

it('re-throws the transport error with its response attached', async () => {
  await expect(
    getTableTypeMetadata(refusing as IAbapConnection, 'ZOK_TT'),
  ).rejects.toMatchObject({ response: { status: 403 } });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/tabletypeRelaysTheResponse.test.ts`
Expected: FAIL — the thrown value is a fresh `Error` with no `response`.

- [ ] **Step 3: Replace the composed message with a re-throw**

In both files the `catch (e)` block keeps whatever `logger?.debug` calls it has
and ends with `throw e;`. Delete the `status` / `statusText` / `responseData`
extraction and the template literal built from them.

`updateTableType` also opens with `if (!params.tabletype_name) throw new
Error('tabletype_name is required')`. Leave it — Task 10 owns it.

- [ ] **Step 4: Run the suite**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/tabletype/read.ts src/core/tabletype/update.ts src/__tests__/unit/core/tabletypeRelaysTheResponse.test.ts
git commit -m "fix(tabletype): the failure carries the response, not a sentence about it"
```

---

### Task 4: the pair that collects a corpus

**Why:** this package ships the collection strategies and nothing else.
`rawDocument` and `wireItself` already exist. The failure side does not: without
it, a refusal comes back as an `IAdtError` and the body worth collecting sits
one level down instead of being the value.

**Files:**
- Modify: `src/utils/adtResponse.ts` (add `nothingIsARefusal`)
- Modify: `src/utils/resultStrategy.ts` (point `wireItself`'s doc at the pair)
- Modify: `src/index.readings.ts` (export it)
- Modify: `docs/usage/CLIENT_API_REFERENCE.md` (a section naming the pair)
- Test: `src/__tests__/unit/utils/corpusCollection.test.ts` (create)

**Interfaces:**
- Consumes: `ADT_NO_FAILURE`, `IAnalyse`, `IAdtError` from
  `@mcp-abap-adt/interfaces`; `answering` and `wireItself` from this package.
- Produces: `nothingIsARefusal: IAnalyse<IAdtError>`, exported from
  `src/utils/adtResponse.ts` and re-exported from `src/index.readings.ts`.
- `IAdtResponse` is a discriminated union on a readonly `ok` field —
  `IAdtSuccess<T>` has `ok: true` and `getResult()`, `IAdtFailure<E>` has
  `ok: false` and `getError()`. There is no `isSuccess()` method. `getResult()`
  is only reachable after narrowing on `ok`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/utils/corpusCollection.test.ts`:

```typescript
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { answering, nothingIsARefusal } from '../../../utils/adtResponse';
import { wireItself } from '../../../utils/resultStrategy';

const refused = {
  status: 403,
  statusText: 'Forbidden',
  headers: {},
  data: '<exc><localizedMessage>locked</localizedMessage></exc>',
} as IAdtWireResponse;

it('hands back a refusal whole, for a corpus', async () => {
  const answer = await answering(
    async () => {
      const error = new Error('403') as Error & { response?: unknown };
      error.response = refused;
      throw error;
    },
    wireItself,
    nothingIsARefusal,
  );

  expect(answer.ok).toBe(true);
  if (!answer.ok) throw new Error('narrowing');
  expect(answer.getResult().value.status).toBe(403);
  expect(answer.getResult().value.data).toContain('locked');
});

it('still fails when nothing came back at all', async () => {
  const answer = await answering(
    async () => {
      throw new Error('socket hang up');
    },
    wireItself,
    nothingIsARefusal,
  );

  expect(answer.ok).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/utils/corpusCollection.test.ts`
Expected: FAIL — `nothingIsARefusal` is not exported.

- [ ] **Step 3: Add it**

In `src/utils/adtResponse.ts`, after `recogniseFailure`:

```typescript
/**
 * The failure strategy that never finds one.
 *
 * Paired with `wireItself` it is how a corpus is collected: every exchange that
 * produced an answer comes back as a success carrying that answer, refusals
 * included, so the bodies can be captured and read. This package ships no
 * reading that turns such a body into a verdict — which reading fits a given
 * task is what the corpus is for.
 *
 * `answering` still fails a request that returned nothing at all. There is no
 * answer to collect, and a success built from none would be a lie.
 */
export const nothingIsARefusal: IAnalyse<IAdtError> = () => ADT_NO_FAILURE;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/utils/corpusCollection.test.ts`
Expected: PASS, both cases.

- [ ] **Step 5: Export it and document the pair correctly**

Add `nothingIsARefusal` to `src/index.readings.ts` beside the `resultStrategy`
exports.

The readings are **not** per-call. A reading set is chosen when the
implementation is constructed — `getClass(results)` takes it as a positional
argument, defaulting to `classDocuments`, and the per-call options carry
`analyse`, `timeout` and `lockHandle` only. The documentation must show that, or
it describes an API that does not exist.

In `docs/usage/CLIENT_API_REFERENCE.md`, add:

```markdown
## Collecting your own corpus

This package relays what ADT answered. It ships no reading that decides whether
an answer was good — that depends on your system and your task, and it is
decided by looking at what your endpoints actually return.

The reading is chosen once, when the implementation is built. The failure
strategy is passed per call.

```typescript
import { AdtClient, wireItself, nothingIsARefusal } from '@mcp-abap-adt/adt-clients';

// Every reading in the set returns the exchange itself.
const cls = new AdtClient(connection, logger).getClass({
  created: wireItself,
  source: wireItself,
  metadata: wireItself,
  check: wireItself,
  activation: wireItself,
  validation: wireItself,
  deletion: wireItself,
  updated: wireItself,
  deletionCheck: wireItself,
});

const answer = await cls.read(config, { analyse: nothingIsARefusal });
if (answer.ok) {
  const exchange = answer.getResult().value; // status, headers, body
}
```

Capture those across the calls your application makes, then build your
strategies from what you see.
```

`IClassResults` types every key as `IResultStrategy<unknown>`, including
`updated`, so `wireItself` is accepted throughout and the example compiles as
written. Verify only that `npm run check:docs` passes: it fails on a documented
import that does not exist.

- [ ] **Step 6: Run the suite and the docs check**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/adtResponse.ts src/utils/resultStrategy.ts src/index.readings.ts docs/usage/CLIENT_API_REFERENCE.md src/__tests__/unit/utils/corpusCollection.test.ts
git commit -m "feat(strategies): the pair that hands back an exchange whole"
```

---

### Task 5: the notes pass

**Why:** 165 references across 67 files name the system a thing was observed on,
which is closed information. And notes phrased as facts about SAP steer the very
choice the consumer is supposed to make from their own corpus. Task 1 already
deleted the notes that justified deleted strategies; this is what remains.

**Files:** everything returned by

```bash
grep -rlniE "\bE19\b|\bE77\b|RFCSAPRL|trial system|on the trial|against the trial|ZOK_MESSAGE_0002|ZAC_INCL01|ZAC_CDSUT_CLS" src docs | grep -v __tests__
```

At the time of writing that includes `src/core/package/{AdtPackage.ts,types.ts}`,
`src/core/messageClass/{lock.ts,AdtMessageClassMessage.ts}`,
`src/core/include/{AdtInclude.ts,delete.ts,types.ts}`,
`src/core/shared/capabilities/LockCapability.ts`, `src/core/service/AdtService.ts`,
`src/runtime/feeds/read.ts`, the eleven `src/core/*/validation.ts` files,
`src/core/{featureToggle,functionInclude}/update*.ts`, and
`docs/usage/{CLIENT_API_REFERENCE.md,STATEFUL_SESSION_GUIDE.md,OBJECT_LIFECYCLE.md,TROUBLESHOOTING.md}`.

**Interfaces:**
- Consumes: nothing. This task changes no code.
- Produces: nothing. No signature moves.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/notesNameNoSystem.test.ts`:

```typescript
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Which system an observation came from is closed information. The observation
 * stays where it explains a choice; the identity never does. Object names
 * carried over from a capture identify the system as surely as its ID does.
 */
const FORBIDDEN =
  /\bE19\b|\bE77\b|RFCSAPRL|trial system|on the trial|against the trial|ZOK_MESSAGE_0002|ZAC_INCL01|ZAC_CDSUT_CLS/i;

describe('notes', () => {
  const files = execSync('git ls-files src docs', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__'))
    .filter((f) => !f.startsWith('docs/development/'))
    .filter((f) => f.endsWith('.ts') || f.endsWith('.md'));

  it.each(files)('%s names no system', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(FORBIDDEN);
  });
});
```

`docs/development/` is excluded on purpose: it tells a developer how to point
the suite at a system, which is configuration, not a claim about SAP.

Before writing the regex, re-run the grep above — other capture-derived object
names may exist beyond the three known ones, and each found name goes into
`FORBIDDEN`.

- [ ] **Step 2: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/notesNameNoSystem.test.ts`
Expected: FAIL, roughly 60 files.

- [ ] **Step 3: Scrub the identity, keep the observation**

Mechanical: `Measured on E19 2026-08-31:` → `Measured 2026-08-31:`.
`Measured on E19 (RFCSAPRL 816) 2026-08-28:` → `Measured 2026-08-28:`.
`probed against a trial system:` → `probed:`. A capture-derived object name is
dropped from the sentence or replaced with a description of what kind of object
it was.

- [ ] **Step 4: Turn the remaining rules about SAP into rules about this code**

`src/core/shared/functionGroupNodes.ts:158` says "A genuine FUGR node structure
always returns its type catalog". Replace with what the code does: "A missing
`OBJECT_TYPES` key is treated as a response that is not a node structure; an
empty one as a node structure with no matching child."

`src/core/transport/readLegacy.ts:20` and
`src/core/transport/AdtRequestLegacy.ts:117` both say the endpoint "always
returns the full transport list". Replace "always returns" with "answered, when
measured, with", keeping the date if git can recover one, and state it as the
reason the parameter is not sent.

`src/core/service/AdtService.ts:458` says a field is "optional in practice".
Replace with the mechanical reason already in the same sentence: without
`serviceType` there is no endpoint to call.

- [ ] **Step 5: Fix the dangling citation**

`src/core/program/validation.ts:23` cites
`docs/evidence/2026-08-28-profiler-contract-e19.md`. No `docs/evidence`
directory exists in the tree. Delete the citation line — a reference a reader
cannot follow is worse than none.

- [ ] **Step 6: Run the test, the suite and the docs check**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run lint:check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src docs
git commit -m "docs: a note says what this implementation does, and names no system"
```

---

### Task 6: the package walkers leave the package

**Why:** issue `fr0ster/mcp-abap-adt-clients#141`. `IResultStrategy<T>` is
`(answer: IAdtWireResponse) => T` — it takes **one** answer. A member that makes
several requests cannot have one, and `src/core/shared/utilResultSet.ts:17-18`
says so in its own table: `getPackageContents` is "one node-structure request
per object type, plus a walk into subpackages — no single answer";
`getPackageHierarchy` is "the same walk, assembled as a tree — no single
answer". So `IUtilResults` has four slots — `search`, `types`, `node`,
`inactive` — and none for the walkers. A consumer cannot inject how a package
is assembled.

That is not a missing feature, it is the wrong shape. Returning a package as a
flat list and returning it as a tree are two readings of the same walk, and this
package ships one member per reading. A third reading — a count, a filtered
projection, a tree with descriptions folded in — would need a third member,
which is the growth the strategy axis exists to prevent.

The same issue records that a missing package and an empty one answer
byte-identically: HTTP 200, no content type, zero bytes, same sha256. So these
members cannot be given an `analyse` either. Both halves of the contract are
unavailable to them.

**The line.** `fetchNodeStructure` is one request and one answer, it has the
`node` slot, and it stays. The walk composed over it does not. In the consumer
repository eight handlers walk the repository and six already call
`fetchNodeStructure` and assemble it themselves, precisely because each wanted a
different shape; only two use the packaged walkers, and those two are the ones
that cannot take a strategy.

**Files:**
- Delete: `src/core/shared/packageHierarchy.ts` (460 lines),
  `src/core/shared/packageContentsList.ts` (277 lines)
- Modify: `src/core/shared/AdtUtils.ts` — delete the members `getPackageContents`
  (line 865), `getPackageContentsList` (904) and `getPackageHierarchy` (937),
  their imports at lines 109-110, and the passage at lines 190-195 arguing which
  of them is contract-shaped
- Modify: `src/core/shared/utilResultSet.ts:17-18` — the two table rows
- Modify: `src/index.readings.ts:96-97` and the option types beside them —
  `IPackageContentItem`, `IPackageHierarchyNode`,
  `IGetPackageContentsListOptions`, `IGetPackageHierarchyOptions`
- Modify: `src/clients/AdtClient.ts:1818, 1993, 2008` — comments naming the
  walkers as things the client does not offer
- Modify: `src/__tests__/integration/shared/packageHierarchy.test.ts` and
  `src/__tests__/integration/shared/responseContract.test.ts` — they keep their
  coverage and assemble the walk themselves over `fetchNodeStructure`, which is
  the migration a consumer performs. Neither is deleted. The
  `test-config.yaml.template` keys they read stay.
- Modify: `docs/architecture/LEGACY.md`
- Modify: `docs/architecture/DECISIONS.md` — **see Step 5, this one is the
  user's**

**Interfaces:**
- Consumes: nothing new.
- Produces: `AdtUtils` loses three members. `fetchNodeStructure`, the `node`
  reading and every other member are untouched. `IUtilResults` keeps its four
  slots — nothing is added, because the walk is gone rather than made
  injectable.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/shared/noPackageWalkers.test.ts`:

```typescript
import { AdtUtils } from '../../../core/shared/AdtUtils';

/**
 * A walk is several requests, and IResultStrategy takes one answer. A member
 * that cannot be given a reading has already chosen one for the consumer, so
 * the walk belongs to the consumer — assembled over fetchNodeStructure, which
 * is a single request and keeps its slot.
 */
describe('AdtUtils', () => {
  const surface = AdtUtils.prototype as unknown as Record<string, unknown>;

  it.each(['getPackageContents', 'getPackageContentsList', 'getPackageHierarchy'])(
    'no longer offers %s',
    (name) => {
      expect(surface[name]).toBeUndefined();
    },
  );

  it('still offers the single-request step the walk was built from', () => {
    expect(typeof surface.fetchNodeStructure).toBe('function');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/shared/noPackageWalkers.test.ts`
Expected: FAIL on all three names; the `fetchNodeStructure` case passes already.

- [ ] **Step 3: Delete the members and their modules**

```bash
git rm src/core/shared/packageHierarchy.ts src/core/shared/packageContentsList.ts
```

In `src/core/shared/AdtUtils.ts` delete the three members with their doc
comments, the two imports at lines 109-110, and the passage at lines 190-195
that argues which of `getPackageContents` and `getPackageContentsList` is the
contract-shaped one. That argument is settled by neither of them being here.

Nothing else in `src` calls them — verified with
`grep -rn "getPackageHierarchy\|getPackageContentsList\|getPackageContents" src --exclude-dir=__tests__`,
which returns only these definitions and comments.

- [ ] **Step 4: Rewrite the table in `utilResultSet.ts`**

The two rows saying these members have "no single answer" describe members that
no longer exist. Replace them with one sentence above the table: a member that
cannot be handed a reading does not belong here, and the walk those two
performed is assembled by the consumer over `fetchNodeStructure`.

- [ ] **Step 5: Record the decision, do not just delete the text**

`docs/architecture/DECISIONS.md` is the user's design record. It currently
discusses these members. **Do not rewrite an existing decision.** Append a new
entry stating what changed and why — a member whose result cannot be injected
has made the consumer's choice for them — and reference issue #141. Then stop
and show the entry to the user before committing it; the wording of a decision
is theirs.

`docs/architecture/LEGACY.md` is a record of what used to be and may keep its
existing text; add only a line saying when the walkers were removed.

- [ ] **Step 6: Fix the type re-exports**

Remove `IPackageContentItem`, `IPackageHierarchyNode`,
`IGetPackageContentsListOptions` and `IGetPackageHierarchyOptions` from
`src/index.readings.ts`. These are `@mcp-abap-adt/interfaces` types and a
consumer still wanting them imports them from there directly, which is the
standing rule for interface types anyway.

- [ ] **Step 7: Rewrite the tests as the consumer they imitate**

`packageHierarchy.test.ts` and `responseContract.test.ts` called the walkers.
They now assemble the walk themselves over `fetchNodeStructure` and keep
asserting the same thing about the result. This is the first real use of the new
shape, and if it reads badly the shape is wrong — treat that as a finding, not a
test to weaken. Do not delete either file, and leave the
`test-config.yaml.template` keys in place.

- [ ] **Step 8: Run everything**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run test:check:integration`
Run: `npm run build`
Expected: PASS, clean. The integration type-check matters here: the deleted
members are called from integration tests, and this is what finds them.

- [ ] **Step 9: Commit**

```bash
git add -A src docs
git commit -m "feat!: a walk is the consumer's, assembled over fetchNodeStructure"
```

**Left open on purpose.** Issue #141 also observes that `whereUsed` has no
strategy slot. `getWhereUsed`, `getWhereUsedList` and `getWhereUsedScope` were
not named for removal and are not touched by this task. If they turn out to be
multi-request too, that is a separate question for the user, not a decision to
take while here.

---

### Task 7: the read-modify-write updates become the write

**Why:** constraint 8 is the rule, and five `update` functions break it by
issuing a GET before their PUT. Each says so in its own file header — "Uses
read-modify-write pattern: GET current XML → patch fields → PUT":

| function | file | requests |
|---|---|---|
| `updateDomain` | `src/core/domain/update.ts:109,132` | GET, PUT |
| `updatePackage` | `src/core/package/update.ts:108,133` | GET, PUT |
| `updateDataElement` | `src/core/dataElement/update.ts:230,276` | GET, PUT |
| `updateTransport` | `src/core/transport/update.ts:47,71` | GET, PUT |
| `updateTableType` | `src/core/tabletype/update.ts:88,109` | GET (via `getTableTypeMetadata`), PUT |

Two consequences, both already recorded elsewhere. `CLAUDE.md` states the rule
as "`update` is the write and carries `options.lockHandle` as given" — these
five do more than the write. And a memory of this project records that a
not-ready read answers `200` with an empty body for exactly these types
(domain, dataElement, package, tabletype, functionGroup); a read-modify-write
built on such a read patches an empty document and PUTs the result, silently
losing whatever was there.

**The shape after the change — decided.** `update` takes a **complete, valid
XML document** and sends it. The caller reads the current document, produces the
full description they want written, and guarantees its validity. This package
does not merge, does not patch, and does not check.

So the patch helpers go with the read: `patchDomainXml`, `patchPackageXml`,
`patchDataElementXml`, `patchTableTypeXml` and the transport description patch
are deleted here. Building the document is part of guaranteeing it, and that is
the caller's.

**This is a sharp break and it is accepted as one.** A partial update stops
existing: a field the caller does not put in the document is not preserved,
because nothing here knows what was there before. Every caller of these five
changes shape. The migration section in Task 9 must state that in those words.

**Files:**
- Modify: `src/core/{domain,package,dataElement,transport,tabletype}/update.ts`
- Modify: the `update` member of `AdtDomain`, `AdtPackage`, `AdtDataElement`,
  `AdtRequest`, `AdtTableType`
- Modify: `src/core/*/types.ts` for the five — `IUpdateXxxParams` loses the
  field-by-field shape if the decision above says the caller passes a document
- Test: `src/__tests__/unit/core/updateIsOneRequest.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: five `updateXxx` low-level functions that issue exactly one PUT.
  Their parameter shape depends on the decision above and must be written into
  this task before it is executed.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/updateIsOneRequest.test.ts`.

```typescript
import type { IAbapConnection, IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { updateDomain } from '../../../core/domain/update';

const recording = () => {
  const methods: string[] = [];
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async (request: { method?: string }) => {
      methods.push(request.method ?? 'GET');
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtWireResponse;
    },
  };
  return { connection: connection as IAbapConnection, methods };
};

it('sends the write and nothing else', async () => {
  const { connection, methods } = recording();
  await updateDomain(
    connection,
    { domain_name: 'ZOK_DOM', document: '<dom:domain/>' } as never,
  );
  expect(methods).toEqual(['PUT']);
});
```

Repeat for the other four.

- [ ] **Step 2: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/updateIsOneRequest.test.ts`
Expected: FAIL — `methods` is `['GET', 'PUT']`.

- [ ] **Step 3: Remove the read and the patch from each of the five**

Delete the "1. GET current XML" block, the `extractXmlString` call, and the
`patchXxxXml` function with its helpers. The PUT sends the document the caller
gave. Rewrite each file's header comment, which currently announces the
read-modify-write pattern.

- [ ] **Step 4: Move the read to the caller in this repository's own callers**

Run: `grep -rn "updateDomain\|updatePackage\|updateDataElement\|updateTransport\|updateTableType" src --exclude-dir=__tests__`
Each `AdtXxx.update` member now has to either take the document from its config
or make the read a separate member call. It may not read and write inside one
member — that is the rule this task exists for.

- [ ] **Step 5: Run everything**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run test:check:integration`
Run: `npm run build`
Expected: PASS, clean.

- [ ] **Step 6: Write this task's migration section**

Append to `docs/usage/MIGRATION-19.md` (created in Task 9, or created here if
Task 9 has not run): the five members, their old call, their new call, and the
sentence that a partial update no longer exists.

- [ ] **Step 7: Commit**

```bash
git add -A src docs
git commit -m "feat!: update is the write"
```

The other multi-request members are Task 8.

---

### Task 8: the chains move to the consumer

**Why:** constraint 8. Each of these members issues several requests, so none of
them can be given a reading, and each has already chosen a shape and an order on
the consumer's behalf. Every entry below was read in the tree, not inferred:

| member | file | what it sends |
|---|---|---|
| `AdtClass.updateTestClasses` | `src/core/class/AdtClass.ts:432` | lock, write include, unlock |
| `updateFunctionGroup` | `src/core/functionGroup/update.ts:70` | lock, read, write metadata, unlock |
| `updateClassWithCheck` | `src/core/class/update.ts:33` | check run, then write |
| `activateObjectsGroup` | `src/core/shared/groupActivation.ts:138` | start, **poll** until done, fetch results |
| `AdtAtc.run` | `src/runtime/atc/AdtAtc.ts:77` | resolve variant, create worklist, start run |
| `getWhereUsedList` | `src/core/shared/whereUsed.ts:356` | scope, then where-used |
| `listFunctionGroupChildren` | `src/core/shared/functionGroupNodes.ts:135` | two node-structure reads |
| `ProgramExecutor.runWithProfiling` | `src/executors/program/ProgramExecutor.ts:74` | schedule trace, run, fetch result |
| `ClassExecutor.runWithProfiling` | `src/executors/class/ClassExecutor.ts` | same three |
| `pullRepo` | `src/clients/abapGit/pull.ts:16` | list repos, PUT pull, **poll**, fetch error log |
| `AdtService.create` | `src/core/service/AdtService.ts:375` | system information, then the POST (via the private `createRequest`) |
| `AdtBehaviorImplementation.create` | `src/core/behaviorImplementation/AdtBehaviorImplementation.ts:188` | system information, then the class create |

The last two are the same pattern: a create that fetches
`/sap/bc/adt/core/http/systeminformation` to fill `masterSystem` and
`responsible` before writing. The caller knows who they are; this package asks
the server on their behalf and spends a request doing it. `getSystemInformation`
also swallows its own failure and answers `null`, which is a judgement of the
same family as the rest of this plan.

Two of them poll — `activateObjectsGroup` and `pullRepo` — which this project
already ruled out in its own words: waiting on an asynchronous ADT job is the
consumer's, not this package's.

**The rule is split, not delete.** A chain comes apart into the single-request
calls it was made of, and each of those becomes a member in its own right. A
part is deleted **only** when the split shows it already exists — `getWhereUsed`
and `getWhereUsedScope` are both public already, so `getWhereUsedList` leaves
and nothing replaces it. Where a part is private today it is promoted, not
discarded: `getActivationResults`, `resolveCheckVariant`, `createWorklist` and
`runWithProfilerId` are each one request and each becomes public.

Promoting a member adds nothing to `@mcp-abap-adt/interfaces` — a class may
carry members past its atoms. Only *removing* a member an atom declares forces
an interfaces change, which narrows the cross-package work to `getWhereUsedList`
in `IAdtInformationSystem` and `runWithProfiling` in `IAdtRunnable`.

**What stays, verified.** `getWhereUsed` and `getWhereUsedScope` each issue
exactly one request and keep their place; only the member that chains them goes.
`fetchNodeStructure` stays and is what `listFunctionGroupChildren` was built
over. `AdtMessageClassMessage.writeClass` **stays** — it is the documented
exception in `CLAUDE.md`, a message is a row inside its class's document, and the
user has confirmed it remains despite being inconvenient.

**Files:**
- Modify: each file in the table, deleting the member
- Modify: the barrels that export them — `src/index.readings.ts`,
  `src/index.core.ts`, `src/index.executors.ts`, `src/index.abapgit.ts`
- Modify: `src/clients/AdtExecutor.ts` — if both `runWithProfiling` members go,
  decide whether the executor class has anything left; report to the user rather
  than deleting a client unasked
- Modify: `src/clients/AdtAbapGitClient.ts` — `pullRepo` is one of its seven
  public methods
- Modify: the integration tests covering each — they compose the sequence
  themselves and keep their assertions. None is deleted.
- Modify: `docs/usage/MIGRATION-19.md` (Task 9)

**Interfaces:**
- Consumes: nothing new.
- Produces: twelve members fewer. The single-request steps each was built from stay
  exported, because that is what the consumer composes: `lockClass`/`unlockClass`,
  `updateClassTestInclude`, `checkClass`, `fetchNodeStructure`, `getWhereUsed`,
  `getWhereUsedScope`, `scheduleTrace`, `listRepos`, `getErrorLog`, and the
  activation start and results reads.

- [ ] **Step 1: Confirm every step it was built from is exported**

For each member in the table, list the single-request calls in its body and
check each is reachable from a barrel. A chain cannot move to the consumer if
the pieces are private. Where a piece is not exported, export it in this task —
that is the only addition this plan makes.

Run, for each: `grep -rn "export.*<piece>" src/index*.ts`

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/unit/oneRequestPerMember.test.ts`:

```typescript
import { AdtUtils } from '../../core/shared/AdtUtils';
import { AdtClass } from '../../core/class/AdtClass';
import { AdtAtc } from '../../runtime/atc/AdtAtc';

/**
 * One member, one endpoint call. A member that sends several has chosen an
 * order and a shape the consumer cannot replace, and cannot be given a reading
 * because IResultStrategy takes one answer.
 */
describe('the chains', () => {
  it.each([
    [AdtClass.prototype, 'updateTestClasses'],
    [AdtUtils.prototype, 'getWhereUsedList'],
    [AdtAtc.prototype, 'run'],
  ])('%p no longer offers %s', (proto, name) => {
    expect((proto as unknown as Record<string, unknown>)[name]).toBeUndefined();
  });

  it('keeps the single-request steps they were built from', () => {
    const utils = AdtUtils.prototype as unknown as Record<string, unknown>;
    expect(typeof utils.getWhereUsed).toBe('function');
    expect(typeof utils.getWhereUsedScope).toBe('function');
    expect(typeof utils.fetchNodeStructure).toBe('function');
  });
});
```

Extend it with the remaining members once Step 1 has confirmed where each lives.

- [ ] **Step 3: Run it to verify it fails**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/oneRequestPerMember.test.ts`
Expected: FAIL on every named member.

- [ ] **Step 4: Delete the members, one file per commit**

Twelve members across eleven files. The two `create` members are not deleted —
they lose the system-information call, and `masterSystem` and `responsible` come
from the config the caller passed. Commit per file so a mistake stays local, and run
`npm run build:fast` after each.

Do not leave a thin wrapper behind. A member that survives as a deprecated
one-liner is still the library choosing the order.

- [ ] **Step 5: Decide the two clients that may be left empty**

`AdtExecutor` exists to offer `getClassExecutor()` and `getProgramExecutor()`,
whose principal member is `runWithProfiling`. `AdtAbapGitClient` has seven
public methods and loses `pullRepo`. Neither is deleted in this task. Report
what is left of each to the user and let them decide.

- [ ] **Step 6: Write this task's migration section**

For **each** of the twelve, `docs/usage/MIGRATION-19.md` gets the sequence the
consumer now writes, in full, as runnable code. Not a description of the
sequence — the code. This is the task's real deliverable: ten members' worth of
order, locking and waiting moves to people who did not write it, and a table
saying "removed, do it yourself" is not a migration.

- [ ] **Step 7: The guard that makes the rule hold**

A grep cannot prove this. `AdtClass.updateTestClasses` is invisible to a static
scan because its requests go through `inStatefulSession(() => …)`, and
`ProfilerDomain.viewResponse` looks like three requests and is a switch that
sends one. Both were only settled by reading them. So the rule needs a runtime
guard, not a pattern.

Create `src/__tests__/unit/oneRequestPerMember.counting.test.ts`: a fake
`IAbapConnection` that counts calls and answers a plausible empty document, and
one case per public member that reaches the wire, asserting the count is exactly
one.

```typescript
const counting = () => {
  let calls = 0;
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async () => {
      calls += 1;
      return { status: 200, statusText: 'OK', headers: {}, data: '' } as IAdtWireResponse;
    },
    setSessionType: async () => undefined,
  };
  return { connection: connection as IAbapConnection, count: () => calls };
};
```

Members that legitimately send nothing — a URI builder — are listed as sending
zero, not skipped, so the list is a census and a new member has to be added to
it. `AdtMessageClassMessage.writeClass` is the one entry allowed a number above
one, with the exception named beside it.

Build this incrementally as the members are deleted. It is the only thing that
keeps the rule true for code written after this plan.

- [ ] **Step 7: Run everything**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run test:check:integration`
Run: `npm run build`
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add -A src docs
git commit -m "feat!: a sequence of requests is the consumer's sequence"
```

---

### Task 9: the migration document

**Why:** this release removes or reshapes roughly thirty public members and
every default strategy. The user's standing rule is that a release updates all
the documentation it touches, not only the changelog, and that a breaking
release carries a migration note saying what a consumer on the old contract must
now do. At this size the note is a document.

It is written last, when what actually changed is known, but each task appends
its own section as it lands — Tasks 7 and 8 say so explicitly. This task makes
the document exist, fills the sections nobody filled, and checks it against the
diff.

**Files:**
- Create: `docs/usage/MIGRATION-19.md`
- Modify: `README.md` — the strategies paragraph, and a link to the migration
- Modify: `docs/usage/CLIENT_API_REFERENCE.md`, `docs/usage/OBJECT_LIFECYCLE.md`,
  `docs/usage/TROUBLESHOOTING.md`, `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/README.md` or whatever indexes `docs/usage/`

**Interfaces:**
- Consumes: the record left by every earlier task.
- Produces: nothing in code.

- [ ] **Step 1: Build the list from the diff, not from memory**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/index.readings.ts src/index.core.ts src/index.executors.ts src/index.abapgit.ts
```

Every name that left a barrel needs an entry. Every name still exported whose
behaviour changed needs one too — the check functions, the five updates, the
four constructors.

- [ ] **Step 2: Write the document**

Structure, one section each:

1. **What this release is.** The library relays what ADT answered. It ships the
   strategies for collecting a corpus of responses and no reading that turns one
   into a verdict.
2. **The strategies that left**, and that their code is recoverable from git at
   the tag before this one, for a consumer building their own pool.
3. **The default failure strategy is now none.** What `answering` does without
   one, and what `nothingIsARefusal` does instead.
4. **The check functions return the report.** Including that the `ddl` and
   `accessControl` retries are gone.
5. **`update` takes a complete document.** The five members, and the sentence
   that a partial update no longer exists.
6. **The walks and the chains are yours.** Every removed member with the
   sequence that replaces it, as code.
7. **Input validation is gone.** What a call with a missing field now does.
8. **The connection wrapper no longer reads bodies.** A refusal inside a 2xx is
   no longer raised; `request` is still attached.

- [ ] **Step 3: Check every documented import exists**

Run: `npm run check:docs`
Expected: PASS. This is what catches a migration example written against a
member that also left.

- [ ] **Step 4: Read the whole document once, against the diff**

Not a skim. The failure mode here is a section that describes the intention of a
task rather than what the task did.

- [ ] **Step 5: Commit**

```bash
git add -A docs README.md
git commit -m "docs: the migration this release owes a consumer"
```

---

### Task 10: input validation comes out

**Why:** 454 throws of the form `throw new Error('Class name is required')` fire
before any request is built. The server is the authority on its own requests.

**The promise has to be proved, not asserted.** Deleting a guard does not by
itself mean the request goes out. Two shapes exist, and they behave differently
with a missing value:

- The name reaches `encodeSapObjectName`, which is `encodeURIComponent` — given
  `undefined` it returns the string `"undefined"`, a URL is built, and the
  server answers. `src/core/class/read.ts:91` is this shape.
- The name has a method called on it first. `updateTableType` does
  `params.tabletype_name.toUpperCase()`; there are 61 such call sites across
  `src/core`. Without the guard these raise `TypeError: Cannot read properties
  of undefined` locally, which is a worse answer than the guard was.

So this task is not "delete 454 lines". It is: delete the guard, then make the
value's path to the wire not depend on it, and prove with a test that
`makeAdtRequest` was called.

**Files:** everything returned by `grep -rln "is required" src --exclude-dir=__tests__`.
Heaviest: `src/core/service/AdtService.ts` (36), `src/core/class/AdtClass.ts`
(19), `src/core/interface/AdtInterface.ts` (16), `src/core/program/AdtProgram.ts`
(15), `src/core/shared/AdtUtils.ts` (14), `src/core/functionGroup/AdtFunctionGroup.ts`
(14), `src/clients/AdtClientLegacy.ts` (14).

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature changes. Fields stay required in the *types* where they
  are required, and the compiler keeps saying so. What goes is the runtime
  re-check of what the type already states.

- [ ] **Step 1: Understand what this does and does not promise**

Nothing is added. Not a serialisation rule, not a tolerant helper, not a
`string | undefined` signature. Replacing 454 guards with tolerance in sixty-one
places is the same defence spread thinner, and it is still this package deciding
what a caller may leave out.

A field typed as required that arrives `undefined` is a defect in the caller's
code, which the compiler already told them about. What happens next depends on
the member and **that is accepted**:

- Where the value goes to `encodeSapObjectName` — `encodeURIComponent` — the URL
  is built from the string `"undefined"`, the request goes out, and SAP answers.
  `src/core/class/read.ts:91` is this shape.
- Where a method is called on it first — `updateTableType` does
  `params.tabletype_name.toUpperCase()`, and there are 61 such sites in
  `src/core` — a `TypeError` is raised locally. It is not caught, not wrapped
  and not prevented. A defect in the caller's code says so in the caller's
  stack; that is more useful than a sentence this package composed.

So the promise is **not** "every missing field reaches the server". It is "this
package stops answering for the server". Write that in the migration document
in those words.

- [ ] **Step 2: Write the representative behavioural tests**

Two shapes, exercised through the **public path** — the guards live on the
high-level members, not on the low-level functions. `getClassSource` has no
guard today, so calling it directly would pass before any change and prove
nothing.

Create `src/__tests__/unit/missingValueReachesTheServer.test.ts`:

```typescript
import type { IAbapConnection, IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../clients/AdtClient';
import { updateTableType } from '../../core/tabletype/update';

const wire = (data: string): IAdtWireResponse =>
  ({ status: 200, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

/** Answers each call in turn, and records the URLs it was asked for. */
const recording = (bodies: string[]) => {
  const urls: string[] = [];
  let call = 0;
  const connection: Partial<IAbapConnection> = {
    makeAdtRequest: async (request: { url: string }) => {
      urls.push(request.url);
      return wire(bodies[call++] ?? '');
    },
    setSessionType: async () => undefined,
  };
  return { connection: connection as IAbapConnection, urls };
};

it('sends a request even with no class name', async () => {
  const { connection, urls } = recording(['']);
  const answer = await new AdtClient(connection)
    .getClass()
    .read({} as never, 'active');

  expect(answer.ok).toBe(true);
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain('/sap/bc/adt/oo/classes/');
});

/**
 * `updateTableType` is a read-modify-write: GET the current document, patch the
 * fields the caller gave, PUT the result. With no fields given the patch is a
 * no-op, but the GET must still return a parseable document or the call dies in
 * `extractXmlString` before the PUT exists.
 */
const currentTableType =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<ttyp:tableType xmlns:ttyp="http://www.sap.com/adt/dictionary/tabletypes" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZOK_TT" ' +
  'adtcore:description="x"/>';

it('sends the write even with no table type name', async () => {
  const { connection, urls } = recording([currentTableType, '']);
  await updateTableType(connection, {} as never);

  expect(urls).toHaveLength(2);
  expect(urls[0]).toContain('/sap/bc/adt/ddic/tabletypes/');
  expect(urls[1]).toContain('/sap/bc/adt/ddic/tabletypes/');
});
```

Add a third case for whichever member in `src/core/service/AdtService.ts` has
the most guards, since that file holds 36 of them. Check first whether that
member is also a read-modify-write; if it is, give `recording` the documents its
reads need, in order.

- [ ] **Step 3: Run them to verify they fail**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/missingValueReachesTheServer.test.ts`
Expected: the class case fails with `Class name is required` from
`AdtClass.read`. Drop the table-type case from this file — with the guard gone
it raises a `TypeError`, which is the accepted outcome from Step 1 and not
something to assert a request against. Assert the class shape and one more
member of the same shape instead.

- [ ] **Step 4: Write the source test**

Create `src/__tests__/unit/noInputValidation.test.ts`:

```typescript
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The server is the authority on its own requests. A missing field is answered
 * by SAP, with a body the caller can act on, not by a string this library
 * composed before the request existed. The behavioural proof that the request
 * actually goes out is in missingValueReachesTheServer.test.ts; this only keeps
 * the guards from coming back.
 */
describe('production code', () => {
  const files = execSync('git ls-files src', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.includes('__tests__'));

  it.each(files)('%s validates no input', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(
      /throw new \w*Error\([`'"][^`'"]*is required/,
    );
  });
});
```

- [ ] **Step 5: Delete the guards, one file at a time, committing per file**

For each file: delete every `if (!config.x) throw new Error('x is required');`
and every multi-line equivalent. Delete a local variable that existed only to
satisfy one. Add nothing. Run `npm run build:fast` after each file so damage
stays local — a cast that the guard used to justify (`config.className as
string`) may now be the only thing keeping a file compiling, and that cast is
fine: the type already says the field is there.

Work heaviest-first per the list above.

- [ ] **Step 6: Decide `AdtClientLegacy.ts` separately**

Its 14 guards sit on a legacy surface. Run
`grep -rn "AdtClientLegacy" src docs --exclude-dir=__tests__` and check whether
anything still reaches it. If nothing does, propose deleting the file to the
user rather than editing it — do not delete it unasked.

- [ ] **Step 7: Fix the tests that asserted the throw**

Run: `grep -rln "is required" src/__tests__`
A test that pinned `rejects.toThrow('Class name is required')` is deleted, not
rewritten — there is no replacement message, there is a server response, and
asserting on that needs a system.
`src/__tests__/unit/capabilities/requiredParameters.test.ts` is likely to be
entirely about these guards. Read it first; if that is its whole subject, it
goes with them.

- [ ] **Step 8: Run everything**

Run: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
Run: `npm run build`
Expected: PASS, clean.

- [ ] **Step 9: Commit and stop**

```bash
git add -A src
git commit -m "feat!: the server judges its own requests"
```

Then stop. Constraint 7: no version bump, no CHANGELOG, no tag, no release, no
publish. Report what is on the branch and wait.

---

## Notes for whoever executes this

- Task 1 is one commit on purpose: the parser, its eighteen callers, the refusal
  defaults, the barrel and the four documentation files all reference each other
  at compile or check time, and splitting them leaves the tree red in between.
- Task 5 must precede Task 10, or the notes pass rewrites comments next to code
  about to move. Tasks 6, 7 and 8 are independent of both.
- Task 9 is last. Every task before it appends its own migration section; Task 9
  fills the gaps and checks the whole against the diff.
- Tasks 2, 3, 4 and 6 are independent of everything else and of each other.
  Doing Task 4 first is worth considering: Task 1 rewrites documentation that
  wants to point at the corpus section Task 4 adds.
- Nothing here needs an SAP system. If a task appears to, stop — it has drifted
  into asserting something about the server, which is what this plan removes.
- `fr0ster/mcp-abap-adt#200` is the consumer-side inventory of claims this
  library made. Tasks 1 and 5 remove the claims it names. Closing it is the
  consumer repository's call.
- `fr0ster/mcp-abap-adt-clients#141` is this repository's own, and Task 6 closes
  it. It also carries the corpus fixtures the consumer captured for the package
  walk, under `tests/fixtures/adt/` in the consumer repository — the assembly
  they build there can be tested against them.
- The branch does not merge into a release. It waits for the consumer's strategy
  package, and the release is proposed to the user only once that exists.
