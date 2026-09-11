# Migrating to 19.0.0

19.0.0 stops this package from deciding what a response means.

The result and error strategies were always injected so that decision belonged
to you. The library was taking it first: three failure strategies wired as the
default at 81 call sites, a check-run parser that turned a report into a pass or
a fail, and a connection wrapper that read bodies and threw on what it
recognised. All of it is gone. What ADT answered reaches you, and the reading
that turns it into a verdict is yours.

Nothing in your code stops compiling silently. Every change below is either a
name that no longer exports or a call that now returns where it used to throw.

---

## 1. The error strategies are gone

Removed from the package:

| name | what it read |
|---|---|
| `activationRefusal` | `<msg type="E">` in an activation checklist |
| `validationRefusal` | `<SEVERITY>ERROR</SEVERITY>` in a validation |
| `deletionRefusal` | `isDeletable` in a deletion check |
| `parseCheckRunResponse` | a check-run report, into pass/fail plus message lists |
| `parseDeletionCheck`, `assertDeletable`, `DeletionNotPermittedError` | the deletion check, as an exception |
| `assertActivationSucceeded` | the same checklist, as an exception |
| `withRefusalDetection` | any body, into a thrown refusal |
| `waitForCleanCheckRun` | a check run, repeatedly, until it came back empty |

**What to do.** If you were importing one, its source is in git at the `18.0.2`
tag — `src/utils/validationRefusal.ts`, `src/utils/deletionCheck.ts`,
`src/utils/activationUtils.ts` and `src/utils/checkRun.ts`. Lift what you want
into your own code and pass it as `analyse`:

```typescript
const answer = await client.getClass().activate(config, { analyse: myVerdict });
```

Write it from the responses your own system gives you, not from what this
package used to assume.

## 2. The default `analyse` is now none

Members pass `options?.analyse` through and substitute nothing.

**What changes for you.** An ADT refusal delivered inside a `2xx` — a failed
activation, a validation that says the name is taken, a deletion check that says
no — now arrives as a **success carrying that document**. It used to arrive as
an `IAdtError`.

```typescript
// 18.x: a failed activation was a failure.
const answer = await cls.activate(config);
if (!answer.ok) console.log(answer.getError().message);

// 19.0: it is the checklist, and you decide.
const answer = await cls.activate(config, { analyse: myActivationVerdict });
```

A transport failure is still a failure, carrying its response and the request it
arrived on.

If you want nothing judged at all, including a `403`, pass the one failure
strategy that ships:

```typescript
import { nothingIsARefusal } from '@mcp-abap-adt/adt-clients';

const answer = await cls.read(config, 'active', { analyse: nothingIsARefusal });
// answer.ok is true for anything that came back; a request that never
// completed is still a failure.
```

## 3. The check functions return their report

Nineteen `check*` functions used to raise `Error('… check failed: …')` when the
report held a `type="E"` message. A check run that finds a syntax error is a
check run that *worked*, and that throw cost you the findings, the line numbers
and the T100 keys.

```typescript
// 18.x
try {
  await cls.check(config);
} catch (e) {
  // a joined string, and nothing else
}

// 19.0
const answer = await cls.check(config);
// the report, whatever it says — read it how your task needs
```

Two retries went with them. `checkDdl` re-ran a check the server had answered
`notProcessed` saying the data definition did not exist, and
`checkAccessControl` re-ran one that came back `notProcessed` with no findings.
Both were waits on the server, and a wait belongs to you. If you need one, write
the loop around the call.

`checkDdl` and `checkAccessControl` also lost their trailing `logger?: ILogger`
parameter, which existed only for those retries. Neither was ever exported from
this package, so this affects nobody importing from it.

## 4. The connection wrapper no longer reads bodies

`withRefusalDetection` did two jobs. It read bodies into refusals and threw —
that half is gone. It also put `{ method, url }` back on an answer the
connection had stripped it from, and that half survives as `withRequestTrace`.

**What changes for you.** A `200` carrying `<exc:exception>` no longer throws.
It is a `200` carrying a document. `IAdtError.request` still fills itself on
every failure, including a status the transport refused.

## 5. Nothing else moved

Result strategies are unchanged. `rawDocument` is still the default reading
everywhere it was, so no member's return type moved, and `wireItself` still
hands back the whole exchange.

---

## Still to come

These are planned and not in 19.0.0. They are listed so you can see the shape
rather than be surprised by it:

- `getPackageContents`, `getPackageContentsList` and `getPackageHierarchy` leave.
  A walk is several requests, so it cannot be given a reading; you assemble it
  over `fetchNodeStructure`, which stays.
- `update` on domain, package, dataElement, transport and table type takes a
  complete, valid XML document instead of reading the current one and patching
  it. Partial updates stop existing.
- Twelve members that send several requests — lock-write-unlock chains, group
  activation, the ATC run, both profiling executors, the abapGit pull — become
  your sequence, composed from the single-request members they were built from.
