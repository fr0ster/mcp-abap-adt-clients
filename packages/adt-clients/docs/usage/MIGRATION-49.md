# Migrating to 49.0.0

49.0.0 is C7 of the owner's rule: **one member, one endpoint, one request**.
The two kinds of member that still sent two requests are split. It pairs with
`@mcp-abap-adt/adt-strategies` 0.30.0 (`readUnstatedActivation`) and
`@mcp-abap-adt/adt-clients-legacy` 0.13.0; its interfaces-adt change (decision
53, the table settings patch contract removed) is released with it. Every
change below is breaking for a consumer that uses what it names; the rest is
in [the changelog](../../CHANGELOG.md).

- [An activation sends the activation alone](#an-activation-sends-the-activation-alone)
- [`answeringActivation` is gone](#answeringactivation-is-gone)
- [A settings change is three calls](#a-settings-change-is-three-calls)
- [The settings handler takes no `variant`](#the-settings-handler-takes-no-variant)
- [What the library no longer checks at run time](#what-the-library-no-longer-checks-at-run-time)

## An activation sends the activation alone

### What changed

Every activation member — each handler's `activate`,
`getClass().activateTestClasses` and `getUtils().activateObjects` — sends
`POST /sap/bc/adt/activation` and nothing else. Until 48.0.0, after a checklist
that does not state its outcome — `activationExecuted="false"` and no message
(`silent`), or no `activationExecuted` and only `W`/`I`/`S` messages
(`unstated`) — the member read `GET /sap/bc/adt/activation/inactiveobjects`
once and handed it to `analyse` as `context.activation`. It no longer does:
`analyse` is called with the verdict and the answer, never a context.

### What fails

Nothing fails to compile. With `analyse: analyseActivation`, a `silent` or
`unstated` checklist is answered **not decided** ("… without the list of
inactive objects the activation's outcome could not be decided") where 48.0.0
answered activated or not activated from the list.

### Remedy

Read the list yourself, when the answer leaves the outcome to it, and hand it
to the strategy. The steps, which `src/__tests__/helpers/activationJudged.ts`
runs against 48.0.0's verdicts on every recorded answer:

1. Call the member with an `analyse` that keeps the starting verdict and the
   answer, unjudged.
2. If `readUnstatedActivation(answer)` (adt-strategies) answers `silent` or
   `unstated`, read `getUtils({ ...utilDocuments, inactive: wireItself })
   .getInactiveObjects()`. A credential refusal SAP never saw is thrown by
   either call, as it came; do not catch it.
3. Judge with `analyseActivation(verdict, answer, { activation: { named,
   inactiveObjects } })`. `named` is the uris the activation named:
   `buildObjectUri(name, code, parent)` for each object; a function group's
   activation names its group and the group's `source/main`; the class
   includes and a behavior implementation name their class;
   `activateTestClasses` names the class's uri with `#testclass=<name>`
   (`activationNamesItsUris.test.ts` pins each).
4. If the read failed: after `silent`, replace the verdict, before the
   strategy runs, with the read's failure, prefixed "The activation's outcome
   could not be decided: SAP answered that no activation ran and gave no
   message, and reading the inactive objects failed: " — no context; after
   `unstated`, keep the starting verdict and hand the refusal's response as the
   list, or no context when no response came back.

```typescript
import {
  analyseActivation,
  readUnstatedActivation,
} from '@mcp-abap-adt/adt-strategies';
import {
  buildObjectUri,
  utilDocuments,
  wireItself,
} from '@mcp-abap-adt/adt-clients';
import type { IAdtError, AdtNoFailure } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';

let started: IAdtError | AdtNoFailure | undefined;
let answer: IAdtWireResponse | undefined;
const program = client.getProgram();
await program.activate(
  { programName: 'ZPROG' },
  {
    headers,
    analyse: (verdict, answered) => {
      started = verdict;
      answer = answered;
      return verdict;
    },
  },
);
const kind = answer && readUnstatedActivation(answer);
if (kind && started !== undefined) {
  const listed = await client
    .getUtils({ ...utilDocuments, inactive: wireItself })
    .getInactiveObjects();
  const named = [buildObjectUri('ZPROG', 'PROG/P')];
  // On a failed read, step 4 above.
  const verdict = listed.ok
    ? analyseActivation(started, answer, {
        activation: { named, inactiveObjects: listed.getResult().value },
      })
    : undefined;
}
```

## `answeringActivation` is gone

### What changed

`answeringActivation`, exported for the handler classes built on this package
(the legacy package's activation override), ran the activation and the read
behind it. It is removed with the exchange it ran.

### What fails

An import of `answeringActivation` from `@mcp-abap-adt/adt-clients`: the
package no longer exports it.

### Remedy

Use `answering(() => request(), read, analyse)`: one request, as every member.

## A settings change is three calls

### What changed

`getTableSettings().patchMetadata` read the working area and PUT the whole
document in one member (interfaces-adt decision 51). It is removed, with the
exported type `TableSettingsPatchConfig`; interfaces-adt removes
`IAdtTableSettingsPatchable`, `ITableSettingsPatchConfig`,
`IAdtTableSettingsPatchHeaders` and `IAdtTableSettingsPatchOptions` (decision
53). The overlay is a pure function, `patchTableSettings(read, changes, variant)`,
which sends no request; `variant` is the declared system kind, and it types
the change set and the answer (on premise no `isWritableByAMDP` in either).

### What fails

```typescript
await settings.patchMetadata({ tableName, changes }, { headers, lockHandle });
// error: Property 'patchMetadata' does not exist
```

### Remedy

Under the settings' lock, right before the write:

```typescript
import { cloudTableSettings, tableSettings } from '@mcp-abap-adt/adt-strategies';
import { patchTableSettings, tableSettingsDocuments } from '@mcp-abap-adt/adt-clients';

const settings = client.getTableSettings({
  ...tableSettingsDocuments,
  metadata: tableSettings, // cloudTableSettings on the cloud
});
const read = await settings.readMetadata({ tableName }, { version: 'inactive' });
if (!read.ok) return read; // the read's failure, no write
const current = read.getResult().value;
if (!current.etag) return; // no ETag, no write
const patched = patchTableSettings(current, { sizeCategory: '2' }, 'onprem'); // 'cloud' on the cloud
if (!patched.ok) return; // patched.reason, patched.message
await settings.updateMetadata(
  { tableName, transportRequest, description: patched.description, settings: patched.settings },
  { headers, lockHandle, ifMatch: current.etag },
);
```

The `variant` argument is the declared system kind and types the call: with
`'onprem'` the change set names no `isWritableByAMDP` and the answer carries
none, so it goes to the on-premise client's write as it is; with `'cloud'` the
read must be `cloudTableSettings`' (the flag present), and the flag goes back as
read unless named.
With `ifMatch` the PUT's `Content-Type` goes without a charset, as before.

## The settings handler takes no `variant`

### What changed

`new AdtTableSettings<T, 'cloud'>(connection, { …, variant: 'cloud' })`
required the declaration so that `patchMetadata` refused a cloud read without
`ts:isWritableByAMDP`. With `patchMetadata` gone, the option and
`TableSettingsVariantOption` are removed. The handler's variant is its type
parameter; `AdtClientCloud.getTableSettings()` still answers a `'cloud'`
handler.

### What fails

```typescript
new AdtTableSettings<T, 'cloud'>(connection, { results, variant: 'cloud' });
// error: 'variant' does not exist in type …
```

### Remedy

Drop `variant`. On the cloud, read with `cloudTableSettings`, which throws for
a read without `ts:isWritableByAMDP`.

## What the library no longer checks at run time

`patchMetadata` refused, before its PUT: a failed read, a read without an
ETag, a document without every setting, on a declared cloud handler a read
without `ts:isWritableByAMDP`, a change set that names no setting, and an
`areaKeyFields` change whose resulting type is not `G`. Since 49.0.0:

- a failed read, a missing ETag: the caller's checks (above);
- an incomplete document: adt-strategies' `tableSettings` and
  `cloudTableSettings` throw, naming what is missing — and, since 0.30.0, an
  area-key count that is no safe integer;
- a cloud read without the flag: `cloudTableSettings` throws;
- a change set that names no setting: refused by the type
  (`ITableSettingsChangesOf<V>`); a change set built from outside the type
  system, such as a tool's JSON input, is the caller's to check;
- an `areaKeyFields` change whose resulting type is not `G`:
  `patchTableSettings` answers `{ ok: false, reason:
  'area-key-fields-need-type-g' }`;
- an empty `lockHandle`: `updateMetadata` still throws before the PUT.
