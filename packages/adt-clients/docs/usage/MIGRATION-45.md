# Migrating to 45.0.0

45.0.0 is on `@mcp-abap-adt/interfaces-adt` `^27.0.0` and pairs with
`@mcp-abap-adt/adt-strategies` 0.22.0 and `@mcp-abap-adt/adt-clients-legacy`
0.9.0 (fr0ster/mcp-abap-adt#351: on SAP_BASIS 751 an activation answered
`200` and activated nothing, and a caller saw a success).

- [A full `IUtilResults` names `objectActivation`](#a-full-iutilresults-names-objectactivation)
- [`analyseActivation` reads an activation that activated nothing as a failure](#analyseactivation-reads-an-activation-that-activated-nothing-as-a-failure)
- [The second step is yours: `preauditRequested`](#the-second-step-is-yours-preauditrequested)
- [Group activation: two members, the endpoint from discovery](#group-activation-two-members-the-endpoint-from-discovery)
- [One read after a silent checklist](#one-read-after-a-silent-checklist)
- [The low-level activation functions take `preauditRequested`](#the-low-level-activation-functions-take-preauditrequested)

## A full `IUtilResults` names `objectActivation`

### What changed

interfaces-adt 27.0.0 makes `objectActivation` a required slot of
`IUtilResults`: the reading of `getUtils().activateObjects`. `utilDocuments`
names it (`rawDocument`).

### What to do

A result set written out in full adds the slot; one spread from
`utilDocuments` has it already:

```typescript
import { utilDocuments } from '@mcp-abap-adt/adt-clients';

const utils = client.getUtils({ ...utilDocuments, discovery: myDiscoveryReading });
```

## `analyseActivation` reads an activation that activated nothing as a failure

### What changed

adt-strategies 0.22.0's `analyseActivation` answers `IAdtActivationFailure`:
the messages, and `stillInactive` — what SAP listed as still inactive
(`{ uri, type, name, parentUri? }`). Newly a failure: an
`ioc:inactiveObjects` answer, an answer that does not state the activation
(neither a checklist, an inactive-objects list nor empty), and a
`chkl:messages` with `activationExecuted="false"` and no message when the
inactive list read after it still names an object the activation named, or
when no list was read. An empty `200` is activated; a `msg type="E"` stays a
refusal. The table and its measurements by release are in
[`ERRATA.md`](ERRATA.md).

### What to do

A caller passing `analyseActivation` now sees `ok: false` where it saw a
success that activated nothing; read `stillInactive` for what is left. A
caller that wants the earlier verdict passes its own `analyse`.

## The second step is yours: `preauditRequested`

### What changed

Every single-object activation — `activate` of every handler and
`getClass().activateTestClasses` — takes `options.preauditRequested`
(`IAdtActivationOptions` of interfaces-adt 27) and sends it. Absent, it sends
`true`, the request it sent before.

### What to do

Nothing for today's request. After a "not activated", send the activation
again with `preauditRequested: false` — on SAP_BASIS 751 that activated the
class — or activate the references SAP listed, with `activateObjects`. Which
objects to send is yours: the list may name objects you did not.

```typescript
await client.getClass().activate(config, {
  headers,
  preauditRequested: false,
  analyse: analyseActivation,
});
```

## Group activation: two members, the endpoint from discovery

### What changed

`getUtils().activateObjects(objects, preauditRequested = false, options)` is
new: one `POST /sap/bc/adt/activation` with the body `activateObjectsGroup`
sends to `/activation/runs`, answered in its body and read through
`objectActivation`. `activateObjectsGroup` is unchanged. `getUtils()` is an
`IAdtObjectActivation<…, V>` of interfaces-adt 27.

### What to do

Read the system's discovery and choose: `/activation/runs` listed →
`activateObjectsGroup` and the run sequence; not listed (SAP_BASIS 751 and 7.40
SP04) → `activateObjects`. `utilDiscoveryCollections` and
`ACTIVATION_RUNS_COLLECTION` of adt-strategies read and name the collection;
a discovery that cannot be read decides no endpoint. The example is in
[`CLIENT_API_REFERENCE.md`](CLIENT_API_REFERENCE.md), "AdtUtils (Group
activation and deletion)". A consumer of the run sequence makes the same read
after a silent results checklist: `getInactiveObjects()`, then
`stillInactiveAmong` with the run's references (same section).

## One read after a silent checklist

### What changed

After an activation answered `chkl:messages` with `activationExecuted="false"`
and no message — and after no other answer — the member reads
`GET /sap/bc/adt/activation/inactiveobjects` once and hands it to `analyse` as
its third parameter, `context.activation` (`named`, the uris the request sent;
`inactiveObjects`, the answer). A read that fails is the call's failure, naming
that the activation's outcome could not be decided.

### What to do

A connection stub that answers every request with an activation checklist
now gets a second request after a silent one. An `analyse` of two parameters
is still an `IAnalyse` and ignores the facts; one that judges a silent
checklist reads `context?.activation`.

## The low-level activation functions take `preauditRequested`

### What changed

`activateInclude` and `activateEnhancement` (exported) take
`preauditRequested: boolean` as their last parameter, with no default, like
every activation function behind the members.

### What to do

Pass `true` for the request they sent before.

```typescript
await activateInclude(connection, headers, 'ZMY_INCLUDE', true);
```
