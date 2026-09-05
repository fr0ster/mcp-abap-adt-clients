# Client API Reference

This project exposes the following client classes:

- `AdtClient` - high-level CRUD operations for ADT objects.
- `AdtRuntimeClient` - runtime operations (ABAP debugger, traces, dumps, logs, feeds, ATC check runs, etc.).

`ReadOnlyClient` and `CrudClient` have been removed in the builderless API.

## AdtClient

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

// CRUD operations via IAdtObject
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class',
});

const readState = await client.getClass().read({ className: 'ZCL_TEST' });
```

Every member answers `IAdtResponse` — a result or a failure, never both:

```typescript
const answer = await client.getFunctionModule().create({
  functionGroupName: 'ZFGROUP',
  functionModuleName: 'ZFM_TEST',
  description: 'Test FM',
});

if (!answer.ok) throw new Error(answer.getError().message);
console.log(answer.getResult().value);   // the create's document, by default
```

What that value *is* comes from the reading the implementation was built with —
see [The reading is injected once](#the-reading-is-injected-once) below.

Additional factory methods follow the same shape — a config in, a contract back:

```typescript
// Authorization Field (SUSO / AUTH) — DDIC-style, XML-only.
// Available on modern on-prem (E19+) and cloud MDD; absent on legacy systems.
// Endpoint: /sap/bc/adt/aps/iam/auth/{name}
await client.getAuthorizationField().create({
  authorizationFieldName: 'ZAUTHF01',
  packageName: 'ZPACKAGE',
  description: 'Test authorization field',
  rollName: 'ZDTEL_AUTH',
  domname: 'ZDOM_AUTH',
});

// Function Include (FUGR/I) — source-bearing, scoped to a function group.
// Available on all systems (legacy, modern on-prem, cloud).
// Endpoint: /sap/bc/adt/functions/groups/{groupName}/includes/{includeName}
const fincl = client.getFunctionInclude();
await fincl.create({
  functionGroupName: 'ZFGROUP',
  includeName: 'LZFGROUPF01',
  description: 'Forms include',
  sourceCode: '* report source',
});

// Dedicated source reader
const source = await fincl.readSource({
  functionGroupName: 'ZFGROUP',
  includeName: 'LZFGROUPF01',
});

// Feature Toggle (FTG2/FT) — SAP feature-gate artifact with JSON source payload.
// Available on modern on-prem and cloud MDD; absent on legacy kernels (E77).
// Endpoint: /sap/bc/adt/sfw/featuretoggles/{name}
// Factory returns IFeatureToggleObject — extends IAdtObject<IFeatureToggleConfig,
// IFeatureToggleState> and adds five domain methods (switchOn, switchOff,
// getRuntimeState, checkState, readSource). The full surface is statically
// visible on the factory return — no casts required at call sites.
const toggle = client.getFeatureToggle();

// --- 1. Create a custom feature toggle ---
// CREATE typically requires SAP_DEVELOPER-equivalent authorization. On cloud
// trial systems FTG2/FT creation is usually SAP-reserved — expect HTTP 403.
// On modern on-prem (BASIS ≥ 7.50) with developer auth, this works.
await toggle.create({
  featureToggleName: 'ZMY_FEATURE',
  packageName: 'ZMY_PKG',
  description: 'My feature toggle',
  transportRequest: 'DEVK900123',
  source: {
    // Optional structured source body. If omitted, the toggle is created
    // empty and the JSON source can be updated later via update() with
    // config.source set, or by calling the low-level uploadFeatureToggleSource.
    rollout: {
      lifecycleStatus: 'inValidation',
      strategy: 'immediate',
      configurable: false,
      defaultEnabledFor: 'none',
      reversible: true,
    },
    toggledPackages: ['ZMY_PKG'],
  },
});

// --- 2. Switch the toggle ON (client-level) ---
// transportRequest is REQUIRED for client-level toggling (captures the change
// into a CTS request). For user-specific toggling, set userSpecific: true;
// depending on system configuration, transportRequest may still be needed.
await toggle.switchOn(
  { featureToggleName: 'ZMY_FEATURE' },
  { transportRequest: 'DEVK900123' },
);

// --- 3. Switch the toggle OFF ---
// rollout.reversible must be true for the toggle definition to accept OFF
// after it has been switched ON. Otherwise the server returns an error.
await toggle.switchOff(
  { featureToggleName: 'ZMY_FEATURE' },
  { transportRequest: 'DEVK900123' },
);

// --- 4. Pre-flight check before toggling ---
// checkState() returns current state plus transport binding info. Call this
// before switchOn/switchOff when you need to know whether a customising
// transport is allowed and which package / object URI the change would bind to.
const preflight = await toggle.checkState({ featureToggleName: 'ZMY_FEATURE' });
console.log(preflight.checkStateResult);
// { currentState: 'off', transportPackage: 'ZMY_PKG',
//   transportUri: '/sap/bc/adt/vit/wb/object_type/sf01/object_name/zmy_feature',
//   customizingTransportAllowed: true }

// --- 5. Read runtime state (all levels) ---
// Returns the client-level aggregate for the current session plus the full
// per-client and per-user breakdowns.
const runtime = await toggle.getRuntimeState({ featureToggleName: 'ZMY_FEATURE' });
console.log(runtime.runtimeState);
// {
//   name: 'ZMY_FEATURE',
//   clientState: 'on',
//   userState: 'undefined',
//   clientStates: [{ client: '100', description: '...', state: 'on' }, ...],
//   userStates:   [],
// }

// --- 6. Read the JSON source body (rollout / toggledPackages / attributes) ---
// Unlike ABAP source, feature-toggle source is structured JSON. readSource()
// parses it and returns IFeatureToggleSource via state.sourceResult.
const sourceState = await toggle.readSource(
  { featureToggleName: 'ZMY_FEATURE' },
  'active', // or 'inactive'
);
console.log(sourceState.sourceResult?.rollout?.defaultEnabledFor);
// 'none' | 'someCustomers' | 'allCustomers' | ...

// --- 7. Update the toggle (metadata + optional source) ---
// The update chain is the canonical IAdtObject flow: lock → check → update →
// (if source provided) uploadSource → unlock → check → activate. Pass
// config.source to change rollout, toggledPackages, or attributes.
await toggle.update(
  { featureToggleName: 'ZMY_FEATURE' },
  {
    sourceCode: undefined,          // not used (source is JSON)
    xmlContent: undefined,
    activateOnUpdate: true,
  },
);

// --- 8. What a feature toggle does not have ---
// Since 12.0.0 there is no readTransport(), and no getVersions()/
// getVersionSource(): ADT gives a toggle no /transport sub-resource and no
// version history, so the methods are gone rather than refusing. Toggle changes
// bind to transports through the /toggle and /check endpoints instead.
```

### Standalone `PROG/I` includes (`getInclude()`)

Since 13.0.0. An include is **not** a program and **not** a function-group
include — three different things, two of them easy to confuse:

| | `getInclude()` | `getFunctionInclude()` |
|---|---|---|
| type | `PROG/I` | `FUGR/I` |
| collection | `/sap/bc/adt/programs/includes` | `/sap/bc/adt/functions/groups/{group}/includes` |
| belongs to | nothing — it stands alone | its function group |
| validation | `/sap/bc/adt/includes/validation` | none; the parent group is probed |

```typescript
const include = client.getInclude();

await include.create(
  {
    includeName: 'ZMY_INCLUDE',
    packageName: 'ZMY_PACKAGE',
    description: 'Shared form routines',
    transportRequest: 'DEVK900123',
    sourceCode: '" shared routines',
  },
  { activateOnCreate: true },
);

const source = await include.read({ includeName: 'ZMY_INCLUDE' });
await include.update(
  { includeName: 'ZMY_INCLUDE' },
  { sourceCode: '" changed', activateOnUpdate: true },
);
await include.delete({ includeName: 'ZMY_INCLUDE' });
```

Contract notes:
- **Activation is opt-in**, as `IAdtOperationOptions` says: `activateOnCreate`
  and `activateOnUpdate` both default to `false`. `options.sourceCode` wins over
  the config's, and `options.lockHandle` means you hold the lock — the handler
  then writes only, and neither locks nor unlocks.
- **An empty source is a source.** `sourceCode: ''` clears an include; only
  `undefined` means none was given. An empty include is a valid object, so
  emptiness must be expressible.
- **`deleteOnFailure`** removes the include again when a step *after* the
  metadata POST fails — without it a half-made object is left behind under a
  name your next attempt collides with. The original failure stays the reported
  one; a rollback that cannot complete is recorded beside it, never instead.
- **Creating one works on modern on-prem only.** Only there does discovery give
  the includes collection an `app:accept`, and a collection without one is not a
  POST target. Cloud answers `403 S_DEVELOP` for the type.
- The return type offers create/read/update/delete, validate, activate, lock and
  unlock — and nothing else. It is not versionable, checkable or
  transport-aware, because nothing measured says an include is.
- `programType: 'include'` on `getProgram()` now **throws**. It used to map to
  `'I'` and post a `program:abapProgram` document with `adtcore:type="PROG/P"`
  to the programs collection — the wrong object, not a wrong parameter.

### Feature Toggle — environment-specific behavior

| Environment | Create / delete | Update metadata + source | switchOn / switchOff | getRuntimeState / checkState / readSource |
|-------------|-----------------|--------------------------|---------------------|-------------------------------------------|
| Modern on-prem (BASIS ≥ 7.50) | ✅ with S_DEVELOP | ✅ with lock + transport | ✅ with transport | ✅ |
| Cloud MDD | ⚠️ usually SAP-reserved; HTTP 403 for customer creation | ⚠️ typically limited to SAP-provided toggles | ⚠️ depends on toggle's `configurable` flag | ✅ against SAP-provided toggles |
| Legacy (BASIS < 7.50, e.g. E77) | ❌ endpoint absent | ❌ | ❌ | ❌ |

### AbapGit (ADT-integrated)

`AdtAbapGitClient` is a **standalone top-level class**, not a factory on `AdtClient`. `AdtClient` is reserved for per-object-type implementations — separate clients stand on their own and are instantiated directly, same pattern as `AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, and `AdtClientsWS`.

```typescript
import {
  AdtCloudConnector,
  CloudHttpTransport,
  TokenAuthProvider,
} from '@mcp-abap-adt/connection';
import { AdtAbapGitClient } from '@mcp-abap-adt/adt-clients';
import type { IAdtAbapGitClient } from '@mcp-abap-adt/interfaces';

// abapGit needs cloud or ABAP Platform 2022+, so the cloud connector and the
// cloud wire — the one that asks for a session at
// /sap/bc/adt/core/http/sessions. Handing it the on-prem wire does not compile.
const config = {
  url: process.env.SAP_URL!,
  authType: 'jwt' as const,
  jwtToken: process.env.SAP_JWT_TOKEN!,
  client: process.env.SAP_CLIENT,
};

const connection = new AdtCloudConnector(
  config,
  // A refresher, not a bare string, for anything long-lived: the provider
  // renews on an expiry it can see, on every call that asks for a header.
  new TokenAuthProvider(config.jwtToken),
  new CloudHttpTransport(() => ({}), null, {
    client: config.client,
    baseUrl: config.url,
  }),
);
await connection.connect();

const abapGit: IAdtAbapGitClient = new AdtAbapGitClient(connection);

// Probe a remote repo before linking
const info = await abapGit.checkExternalRepo({
  url: 'https://github.com/SAP-samples/cloud-abap-rap.git',
});
console.log(info.accessMode);                        // 'PUBLIC' | 'PRIVATE' | ...
console.log(info.branches.map((b) => b.name));       // ['HEAD', 'refs/heads/main', ...]

// Link a package to a remote repo
await abapGit.link({
  package: 'ZMY_PKG',
  url: 'https://github.com/SAP-samples/cloud-abap-rap.git',
  branchName: 'refs/heads/main',
});

// Pull — awaits the async server-side job. AbortSignal stops only the
// client-side wait loop; the server may still be running.
try {
  const result = await abapGit.pull({
    package: 'ZMY_PKG',
    pollIntervalMs: 2000,
    maxPollDurationMs: 600_000,
    onProgress: (s) => console.log(`status: ${s.status} — ${s.statusText}`),
  });
  if (result.finalStatus.status === 'E' || result.finalStatus.status === 'A') {
    console.error('pull failed:', result.errorLog);
  }
} catch (err: any) {
  // AbortError / TimeoutError carry lastKnownStatus when a read succeeded
  // before the client gave up waiting. The server-side job may still be
  // running — poll getRepo(package) until status !== 'R' before retrying.
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    console.warn('pull wait stopped:', err.lastKnownStatus);
  } else {
    throw err;
  }
}

// Read status without triggering a pull
const repo = await abapGit.getRepo('ZMY_PKG');

// List all linked repos on this system
const all = await abapGit.listRepos();

// Fetch the error log as a first-class operation (not only on failed pulls)
const log = await abapGit.getErrorLog('ZMY_PKG');

// Remove the binding. DELETE /sap/bc/adt/abapgit/repos/{repositoryId}
// under the hood — repositoryId is resolved automatically from the
// package name.
await abapGit.unlink({ package: 'ZMY_PKG' });
```

**Availability.** ADT-integrated abapGit ships with SAP BTP ABAP Environment (Steampunk) and modern on-prem from ABAP Platform 2022+. Legacy kernels (E77 and older) do not expose `/sap/bc/adt/abapgit/*`. This is **not** the community abapGit that installs via SE38 — that one is a separate ABAP program with its own UI and does not go through ADT.

**Async pull contract.** The server-side pull continues independently of the client-side wait. If you abort or hit `maxPollDurationMs`, the thrown `AbortError` / `TimeoutError` carries `lastKnownStatus` (when the last `listRepos` succeeded before the client gave up). The client **must** poll `getRepo(package)` until `status !== 'R'` before re-issuing `pull` or `unlink`. Retrying `pull` while the previous server-side job is still `R` is unsupported and fails fast.

**Content-type version.** Defaults to `v3` for sapcli compatibility. Cloud MDD advertises `v4`; consumers can opt in via `new AdtAbapGitClient(conn, logger, { contentTypeVersion: 'v4' })`.

### Transport Requests (getRequest())

`client.getRequest()` returns **`IAdtRequest`** — the contract, not the class, since 16.1.0. That is what makes the compiler check the handler: `AdtRequest` has to satisfy the interface at the factory, so a method removed from it fails the build there rather than only where something happens to call it. It also means a consumer can substitute their own handler, or intersect the contract with their own types. To name the type, import it from the contract package — this one does not re-export interface types:

```typescript
import type { IAdtRequest } from '@mcp-abap-adt/interfaces';

const requests: IAdtRequest = client.getRequest();
```
 `create()` and `read()` behave as any
other handler; `list()` is the one method worth reading closely, because the
endpoint it calls is a **saved-configuration search**, not a filtered query —
sending `user`/`status`/`dateRange`/`targetSystem` as query parameters has
never worked, on any system this was probed against, and the endpoint answers
that shape with the same 309-byte empty root every time.

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

// No configUri: resolves the one saved transport search this system exposes.
// Throws if there are zero configurations (nothing to run) or more than one
// (which one is ambiguous — there is no "default" flag in the payload).
const listState = await client.getRequest().list();
console.log(listState.listResult?.data);

// Pass configUri explicitly to pick a specific saved search, or to skip
// resolution altogether (required on a batch client — see below).
// getTransportSearchConfigurations() itself is internal to list()'s
// resolution step and is not part of the public surface — discover the
// available searches in Eclipse (Project Explorer → transport view) and copy
// the configuration's href, or catch the "N transport search configurations"
// error thrown by list() with no argument, which names every available href.
await client.getRequest().list({
  configUri: '/sap/bc/adt/cts/transportrequests/searchconfigurations/<id>',
});
```

**On a batch client**, `configUri` is required. Resolving "no argument" needs
a response from `getTransportSearchConfigurations()`, and a batch connection
cannot deliver one until `batchExecute()` runs — so `batch.getRequest().list()`
throws immediately, while `batch.getRequest().list({ configUri })` records
normally and resolves after `batchExecute()`.

**Migration from filter parameters.** There is no server-side filtering to
lose — the five parameters (`user`, `status`, `date_range`, `target_system`,
`request_type`) were never read by the endpoint. Call `list()` with no
argument to run the saved search Eclipse already uses, or pass `configUri` to
pick a specific one. See [CHANGELOG.md](../../CHANGELOG.md) (11.0.0 entry) for
the before/after low-level signature.

#### `list()` — the transport tree, parsed

`list()` answers whatever the reading it was built with makes of the body, and
the shipped one parses it into requests, their tasks, and the containers each
request was nested under.

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';
import type { ITransportTree } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

const answer = await client.getRequest().list();
if (!answer.ok) throw new Error(answer.getError().message);

const tree: ITransportTree = answer.getResult().value;
for (const request of tree.requests) {
  request.attributes['tm:number']; // verbatim — never renamed to "number"
  request.containers;              // outermost first
  request.tasks;                   // each task's own attributes, links, long_desc
}
```

`listNodes()` sat beside it until 31.0.0, doing the same request and parsing the
same body — one endpoint under two names, differing only in how far the answer
was read. That is what the injected reading replaces, so the pair is one member
now. `ITransportTree` moved with it: a contract carries what is needed to use or
replace it, and a shape a replacement reading would not produce is neither, so
it is imported from `@mcp-abap-adt/adt-clients` rather than from the contracts.

**Containers are a list because the nesting is not fixed.** `?configUri=`
alone answers `tm:workbench > tm:modifiable > tm:request`; `?targets=true`
inserts a `tm:target` level in between, and that level carries a human name
(`"Local Change Requests"`) the request itself does not have — `tm:target`
alone. A parser that assumed one fixed chain would silently return zero
requests against the other shape, which is why `containers` walks by element
name rather than by a path observed on one system.

**Attributes are handed back verbatim.** `request.attributes['tm:number']`,
not `request.attributes.number` — naming a field is the consumer's decision,
not this library's.

**The parse costs no request.** With `configUri` it is one HTTP call; without
one it is two (the saved-search configuration, then the list). Reading the
document a second way never means fetching it a second time.

**Your own reading, for a payload the shipped one does not know:**

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';

const requests = client.getRequest({
  ...transportDocuments,
  list: (answer) => myParse(String(answer.data)),
});
```

`myParse` still yields a typed result instead of forcing a caller back onto raw
XML — and `rawDocument` is there for a caller who wants exactly that.

**A body the shipped reading does not recognise throws.** That is what stops
`list()`'s original defect (an empty root read as success) from recurring: a
reading that cannot read is this library failing, not the server refusing, and
it surfaces as itself rather than as a verdict about SAP. An empty `tm:root` is
different — that is **not** an error, and the answer succeeds with
`requests: []` and whatever attributes the root itself carried. A system with no
transport requests must be able to say so without being reported as broken; the
distinction is the root element and the nesting, never a count.

**Legacy systems answer the same member.** `AdtRequestLegacy.list()` reads
`/sap/bc/cts/transportrequests`, whose payload has never been captured — so the
shipped reading may well not recognise it, and will say which element it
expected and what it found. That is the cue to inject a reading for your system.

**Known limitation — `?targets=true` is not sent.** This library requests
`?configUri=` alone; Eclipse requests `?targets=true&configUri=`. With
`targets=true` the server inserts an extra `tm:target` container carrying a
human name (`"Local Change Requests"`) that the request itself does not
have — its own `tm:target` attribute is `""`. Not sending it costs nothing in
the type: `containers` is already an ordered list, so `tm:target` can be
added later without a breaking change. Whether to send it — always, never, or
behind a flag — is an open decision, not an oversight.

**`parseTransportTree()`** is also exported from the package root, for a
transport-tree response obtained some other way (a batch result, a fixture,
anything already held as a string):

```typescript
import { parseTransportTree } from '@mcp-abap-adt/adt-clients';

const tree = parseTransportTree(xmlAlreadyInHand);
```

**`create()` answers the new request, not its document.** `parseCreatedTransport`
is its shipped reading, and the number is the only thing the response is there to
deliver:

```typescript
const created = await client.getRequest().create({ description: 'my change' });
if (!created.ok) throw new Error(created.getError().message);

created.getResult().value.transportNumber;   // 'DEVK900123'
created.getResult().value.owner;             // the task's owner
```

### What `update()` refuses to write

Five object types — `domain`, `dataElement`, `package`, `tabletype`,
`functionGroup` — update by **read-modify-write**: GET the current XML, patch the
changed fields into it, PUT it back. Building the XML from scratch would drop
fields the client does not model (`abapLanguageVersion` and friends), so the
server's own body is the base.

That makes the read a hard dependency, and ADT answers a read of a not-yet-ready
object with **HTTP 200 and an empty body** — never a 404. Since **10.1.0** such a
read fails instead of being patched and sent:

```
XmlPatchError: Cannot update domain ZAC_DOM01: the read returned an empty body.
```

Before, the patch found nothing to replace, returned the body unchanged
silently, and the PUT went out without the field — which the server rejected
with a message pointing nowhere near the cause (`The description is missing`).
A slow system now surfaces as a read error naming the object.

**A patch that cannot find its target throws.** A caller reaches a patch only
when it intends the change, so "no match" means the PUT would not carry what was
asked for.

**One deliberate exception.** Setting an attribute on an element that is present
without it *adds* the attribute rather than failing, because ADT emits exactly
that for an unset reference:

| ADT returns | meaning |
|---|---|
| `<doma:valueTableRef/>` | domain with no value table |
| `<pak:superPackage/>` | package with no parent |

So `value_table` and `super_package` now take effect when set for the first
time; they were silently ignored before. If your code passes `super_package` on
a root package and relied on it doing nothing, it now moves the package.

### What `activate()` treats as a failure

`/sap/bc/adt/activation` answers **HTTP 200 even when activation fails**, so the verdict
has to be read out of the body. The rule the client applies:

> An activation failed if, and only if, the response carries an error-severity
> `<msg type="E">`. The thrown message quotes SAP's own text.

`activationExecuted="false"` is **not** a failure signal, despite how it reads. Probed
against a live system:

| scenario | HTTP | `activationExecuted` | `msg` |
|---|---|---|---|
| object already active (class) | 200 | `false` | none |
| object already active (DDIC table) | 200 | `true` | none |
| object does not exist | 200 | `false` | `E` |
| locked by another session | **403** | — | — |

An object that needs no activation reports `false` with an empty message list — by the
flag alone, indistinguishable from an object that does not exist. The flag says whether
ADT did any work, not whether the work succeeded. Note also that the two DDIC rows differ
on identical semantics: a table re-activates unconditionally, a class does not. Any
consumer reading these responses directly should branch on the messages, not the flags.

A lock held by another session is an HTTP 403 (`User … is currently editing …`) and
surfaces as a rejected request, never as a body to inspect.

Empty, unparseable, or unrecognized bodies are treated as success — object types differ
in the shape of their success body, and inferring failure from an unfamiliar one would
turn working calls into errors.

### Accept Negotiation

The client can optionally auto-correct `Accept` headers after a 406 response:

```typescript
const client = new AdtClient(connection, console, {
  enableAcceptCorrection: true,
});
```

You can also override the `Accept` header per read call:

```typescript
await client.getClass().read(
  { className: 'ZCL_TEST' },
  'active',
  { accept: 'text/plain' }
);

await client.getClass().readMetadata(
  { className: 'ZCL_TEST' },
  { accept: 'application/vnd.sap.adt.oo.classes.v4+xml', version: 'active' }
);

// Read source without version (initial post-create state)
await client.getClass().read({ className: 'ZCL_TEST' }, undefined);
```

### AdtUtils (Object Metadata/Source)

`AdtUtils.readObjectMetadata` and `AdtUtils.readObjectSource` enforce strict object types to prevent invalid inputs like `view:ZOBJ`.

```typescript
import type { AdtObjectType, AdtSourceObjectType } from '@mcp-abap-adt/interfaces';

const utils = client.getUtils();
const metadataType: AdtObjectType = 'DDLS/DF';
const sourceType: AdtSourceObjectType = 'view';

const metadata = await utils.readObjectMetadata(metadataType, 'ZOK_I_CDS_TEST');
const source = await utils.readObjectSource(
  sourceType,
  'ZOK_I_CDS_TEST',
  undefined,
  'active',
);

// Every member answers a contract. Reading the result without asking which
// half you hold does not compile.
if (source.ok) {
  source.getResult().value;   // the document, with the shipped reading
} else {
  source.getError().origin;   // 'connection' | 'refusal'
}
```

### What every member answers with

`IAdtResponse` is a discriminated union — a result **or** a failure:

| | on success | on failure |
|---|---|---|
| `answer.ok` | `true` | `false` |
| `answer.getResult()` | the member's result contract | `undefined` |
| `answer.getError()` | `undefined` | `IAdtError` |

`IAdtError` always carries `origin` and `message`; `code`, `adtType`,
`namespace`, `response` and `request` are filled in as far as the error strategy
could. `origin` is the part to act on, and there are two — both describing the
server, because that is the only thing this contract is a verdict about:

| origin | what happened | remedy |
|---|---|---|
| `connection` | no usable answer — unreachable, expired session, endpoint absent | reauthenticate, or check reachability |
| `refusal` | SAP answered about this object and said no | ask something else |

**A document this library cannot read is neither.** It is this library failing
rather than the server refusing, so it throws as itself — `AdtParseError`,
carrying what it looked for and the document it looked in. Calling that
`origin: 'parse'` (as 17.0.0 did) told a caller to go and look at a system that
had answered them correctly. A **consumer's own reading** throwing is the same
case, and surfaces untouched for the same reason.

There is no `cause`. What a library threw inside itself is not part of what a
consumer reads; what the server said is, and that is `message` and `response`.

On a legacy system `getSqlQuery` and `getTableContents` answer
`origin: 'connection'` — the endpoint is not there, which is the same remedy as an
unreachable host rather than a server refusing.

### The reading is injected once

A member's result type is a type parameter of its contract, and what fills it in
is a strategy — `(answer: IAdtWireResponse) => T` — given to the implementation
when it is built:

```typescript
import { classDocuments, rawDocument } from '@mcp-abap-adt/adt-clients';

// The shipped reading. Each member answers what it always answered.
client.getClass();

// Your own, for every member of this implementation.
const parsed = client.getClass({
  ...classDocuments,
  source: (answer) => myParser(String(answer.data)),
});
```

One set per object type is exported, named after it — `classDocuments`,
`transportDocuments`, `packageDocuments`, `utilDocuments` and the rest — beside
the interface each satisfies (`IClassResults`, …). The three building blocks are
`rawDocument` (the body as it arrived), `nothing` (for a member ADT answers with
nothing worth reading, such as an unlock) and `wireItself`.

**Chosen once, not per call.** That fits how these consumers work: a backup tool
wants documents whole for everything it touches, a script wants two fields from
every read, an MCP server picks by what its model is about to do — and none of
them changes its mind between `create` and `read` of the same object. So there
are no `parse` parameters, no `readWith`, and no second member differing only in
how far it read.

**What a reading produces is not a contract type.** `ISearchResult`,
`ITransportTree`, `ObjectVersion`, `IRepositoryNodeContents` and their
neighbours live in `@mcp-abap-adt/adt-clients`, beside the readings that build
them — inject your own reading and it is your shape that comes back, so a
contract naming one would be describing an implementation.

**The other axis is `analyse`, and it is per call**, because whether an answer is
a failure can depend on what you are doing:

```typescript
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';

await client.getClass().read({ className: 'ZCL_X' }, 'active', {
  analyse: (verdict, answer) =>
    verdict === ADT_NO_FAILURE && String(answer?.data ?? '') === ''
      ? { origin: 'refusal', message: 'ZCL_X does not exist' }
      : verdict,
});
```

The failure question is asked first, always: a reading is never handed a refusal
to make a value out of. The shipped defaults are `deletionRefusal`,
`activationRefusal`, `validationUnsupported` and their neighbours — each reading
the `<msg type="E">` or the status ADT delivers inside a 200, which nothing below
the contract can tell from a success. `activationRefusal` and `deletionRefusal`
are exported, so your own `analyse` can defer to one instead of re-deriving what
it already knows.

### Message class (MSAG) and its messages

Message classes and their individual messages are two separate handlers.
`getMessageClass()` manages the class shell (name, description, package,
`masterLanguage`); `getMessageClassMessage()` manages a single message, which is
read-modify-write over the parent class (a message has no independent write
endpoint). Message classes are **not activated**, so `activate()`/`check()` throw
`UNSUPPORTED_OPERATION`.

```typescript
// Create the class, then add/edit/remove messages on it.
await client.getMessageClass().create({
  name: 'ZMY_MSG',
  description: 'My messages',
  packageName: 'ZMY_PKG',
});

await client.getMessageClassMessage().create({
  className: 'ZMY_MSG',
  msgno: '001',
  msgtext: 'Order &1 not found',
  selfExplanatory: true,
});

// Update only the text (other message attributes round-trip unchanged).
await client.getMessageClassMessage().update({
  className: 'ZMY_MSG',
  msgno: '001',
  msgtext: 'Order &1 does not exist',
});

// Read one message (resolved from the class).
const msg = await client.getMessageClassMessage().read({
  className: 'ZMY_MSG',
  msgno: '001',
});
console.log(msg?.message?.msgtext);

// Remove a single message, then delete the whole class.
await client.getMessageClassMessage().delete({ className: 'ZMY_MSG', msgno: '001' });
await client.getMessageClass().delete({ name: 'ZMY_MSG' });
```

### Object version history

A handler whose object **has** version history exposes `getVersions(config)` (list it)
and `getVersionSource(contentUri)` (fetch one version's source). Identity is passed per
call, like the other handler methods.

Since 12.0.0 a handler whose object has none carries neither method — `getDomain()`,
`getDataElement()`, `getFunctionGroup()`, `getPackage()`, `getMessageClass()`,
`getAuthorizationField()`, `getFeatureToggle()`, `getServiceBinding()`, `getRequest()`
and the unit-test handlers. The call does not compile, rather than throwing at runtime.

```typescript
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';

const listed = await client.getClass().getVersions({ className: 'ZCL_MY_CLASS' });
if (!listed.ok) throw new Error(listed.getError().message);

const versions = listed.getResult().value;   // ObjectVersion[]
for (const v of versions) {
  console.log(`${v.versionId} by ${v.author ?? '?'} at ${v.updatedAt ?? '?'}`);
}

// Fetch the source of a specific version via its opaque contentUri.
if (versions.length > 0) {
  const src = await client.getClass().getVersionSource(versions[0].contentUri);
  if (src.ok) console.log(src.getResult().value);
}
```

A type that *does* have version history, on a system where the resource is not
available, answers a failure named
`code === AdtObjectErrorCodes.UNSUPPORTED_OPERATION` — never the raw HTTP status
for a caller to decode. That is a fact about the system, not about the contract:

```typescript
const listed = await client.getClass().getVersions({ className: 'ZCL_MY_CLASS' });
if (!listed.ok) {
  if (listed.getError().code === AdtObjectErrorCodes.UNSUPPORTED_OPERATION) {
    // this system does not answer the versions resource
  }
}
```

### AdtUtils (Where-used)

Where-used is a two-step flow:

1) `getWhereUsedScope` fetches scope XML (available object types + default selections).
2) `getWhereUsed` executes the search with that scope (defaults to server selection if scope is omitted).

`modifyWhereUsedScope` is a local helper that edits the scope XML (no ADT call).

See `docs/architecture/ARCHITECTURE.md` for the architectural overview.

```typescript
const utils = client.getUtils();

const scopeResponse = await utils.getWhereUsedScope({
  object_name: 'ZMY_CLASS',
  object_type: 'class',
});

const scopeXml = utils.modifyWhereUsedScope(scopeResponse.data, {
  enableOnly: ['CLAS/OC', 'INTF/OI'],
});

const result = await utils.getWhereUsed({
  object_name: 'ZMY_CLASS',
  object_type: 'class',
  scopeXml,
});
```

`getWhereUsedList` is a convenience wrapper that performs the scope fetch, search, and
XML parsing in one call and returns structured `references`. Use `enableOnlyTypes` to
restrict the search to specific ADT object types — SAP applies the selection server-side,
so it never searches (nor returns) the unwanted types, e.g. hundreds of `CLAS/OC`:

> On systems that do not expose the `/usageReferences/scope` sub-resource (some S/4
> releases answer it with HTTP 404), server-side filtering is unavailable: the search
> falls back to an unscoped query and `enableOnlyTypes` / `disableTypes` are then applied
> to the parsed `references` client-side, so callers still receive the narrowed set.

```typescript
const utils = client.getUtils();

// Only structures/tables — not the dozens of other referencing types.
const result = await utils.getWhereUsedList({
  object_name: 'ZMY_TABLE',
  object_type: 'table',
  enableOnlyTypes: ['TABL/DS', 'TABL/DT'],
});

console.log(`Found ${result.totalReferences} references`);
for (const ref of result.references) {
  console.log(`${ref.name} (${ref.type}) in ${ref.packageName}`);
}

// Or keep the default SAP scope but prune a noisy type:
await utils.getWhereUsedList({
  object_name: 'ZMY_TABLE',
  object_type: 'table',
  disableTypes: ['CLAS/OC'],
});

// `enableAllTypes: true` selects every type (Eclipse "select all"); `enableOnlyTypes`
// takes precedence over it, and `disableTypes` is applied on top.
```

## AdtRuntimeClient

`AdtRuntimeClient` exposes all runtime operations through domain object factories. Each factory returns a stateless domain object that wraps a set of related ADT endpoints.

```typescript
import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';

const runtime = new AdtRuntimeClient(connection, logger);
```

### Profiler Traces

Since 13.0.0 the profiler **reads**; configuring a measurement belongs to the
executors. The two never share a vocabulary: scheduling yields a *request id*,
reading takes a *trace id*.

```typescript
import { compareRecordedAt } from '@mcp-abap-adt/adt-clients';

const profiler = runtime.getProfiler();

// What traces exist — parsed entries, not a raw response.
const traces = await profiler.list({ user: 'SOMEONE' });
// Not `a.recordedAt > b.recordedAt`: that compares ISO timestamps as text and
// gets the answer wrong across UTC offsets. See the note below.
// The guard is not decoration: an empty feed is normal — nothing profiled yet —
// and `reduce` with no initial value throws `TypeError` on `[]`.
const newest = traces.length
  ? traces.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b))
  : undefined;
if (!newest) return;

// What is inside one. The result is the view's own type.
const hitList = await profiler.read(newest.id, 'hitlist', {
  withSystemEvents: false,
});
const statements = await profiler.read(newest.id, 'statements');
const dbAccesses = await profiler.read(newest.id, 'dbAccesses');

console.log(hitList.entries.length, dbAccesses.accesses[0]?.accessTime?.total);

// And take it back out when done — since 15.0.0.
await profiler.delete(newest.id);
```

Configuring and scheduling live on the executors:

```typescript
const classExecutor = new AdtExecutor(connection, logger).getClassExecutor();

const objectTypes = await classExecutor.listObjectTypes();   // INamedItem[]
const processTypes = await classExecutor.listProcessTypes();
const scheduled = await classExecutor.listRequests();        // ITraceRequestEntry[]

const requestId = await classExecutor.scheduleTrace({
  description: 'CI trace run',
  sqlTrace: true,
  maxTimeForTracing: 1800,
});
```

Contract notes:
- `read()` refuses a view this family does not have — at compile time, not with
  a 404. The three are `hitlist`, `statements` and `dbAccesses`. A JavaScript
  caller who reaches it anyway gets a throw before any request goes out: it is
  their mistake, not a verdict about a server nobody asked.
- **A consumer who needs the document read differently implements `IProfiler`**,
  which is generic in what its views answer. `readWith(parse, …)` sat beside
  `read()` until 31.0.0 — the same endpoint under a second name, differing only
  in who read the body — and went with every other member of that shape.
- **The parsers do not validate.** Judging SAP's own documents is not this
  library's job; the server is the authority on its responses, and where a check
  is needed ADT has an endpoint (`getInclude().validate()`). A body the shipped
  mapping does not recognise yields empty rather than an exception. Searching and
  filtering belong to the server too.
- **A run does not promise a trace.** SAP writes it asynchronously, so when
  `runWithProfiling` returns there may be no trace, there may never be one, and
  you may legitimately read it a week later. To find the one your run produced,
  note the ids before running and look for a new one — see
  `src/__tests__/helpers/traceHelpers.ts`.
- **Position in the feed is not age.** A feed's first entries have been measured
  minutes old while its last were eight days older, so "the first id in the
  document" is a trace chosen at random. Compare `recordedAt`.
- `scheduleTrace()` answers with the request id and nothing else: reading the
  created parameters resource back gives `200` with an empty body.
- `grossTime` and `traceEventNetTime` are `{ time, percentage }` since 14.0.0,
  measured from a raw capture. The **unit of `time` is not named** — the wire
  gives a figure and no unit; `percentage` is of the trace total, which is what
  makes a row comparable without knowing it.
- A trace entry carries more than an id: `system`, `client`, `host`, `size`,
  `runtime` and its three parts, `isAggregated`, `amdpFileSize`. `client` is a
  **string**, because `010` is not `10`.
- Comparing `recordedAt` as a **string** is wrong: `09:00:00Z` is later than
  `10:00:00+02:00` and sorts lower as text. Use the exported `compareRecordedAt`.
  There is no `latestTraceId()` since 15.0.0 — it lived on the concrete class
  where `getProfiler()` never exposed it, so no consumer could call it:

  ```typescript
  const traces = await profiler.list();
  // `latestTraceId()` answered `undefined` on an empty feed. Keep that: an
  // empty feed is normal, and `reduce` with no initial value throws on `[]`.
  const newest = traces.length
    ? traces.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b))
    : undefined;
  ```
- **`delete(traceId)` takes an id or a full URI**, so the `uri` from `list()`
  can go straight back. What a missing id does is **not measured**: a `404`
  rejects, so cleanup code has to catch.

### Cross-Trace Analysis

```typescript
const crossTrace = runtime.getCrossTrace();

const list = await crossTrace.list();
const trace = await crossTrace.getById(traceId);
const records = await crossTrace.getRecords(traceId);
const content = await crossTrace.getRecordContent(traceId, recordNumber);
const activations = await crossTrace.getActivations();
```

### ST05 Performance Traces

```typescript
const st05 = runtime.getSt05Trace();

const state = await st05.getState();
const directory = await st05.getDirectory();
```

### Application Log

```typescript
const appLog = runtime.getApplicationLog();

const logObject = await appLog.getObject('Z_MY_LOG');
const logSource = await appLog.getSource('Z_MY_LOG');
```

### ATC check runs

`runtime.getAtc()` starts a check run, asks whether it is done, and reads what
it found. Three capabilities and no more — a check run is not created, locked,
activated or versioned, and the returned handler's type says so.

Objects are named by kind, not by URI: the client builds the URI. The kinds are
`class`, `interface`, `function_group`, `package`, `ddl_source`, `table` and
`behavior_definition`. Each was confirmed by a run submitted at the URI this
client builds whose *finished* worklist then listed that object under that
type; a run being accepted proves nothing, since a URI that cannot exist is
answered `201` too. `program` and `include` are absent because ABAP Cloud
refuses to hold either, so nothing there could confirm them.

**Two modes, two shapes.** `wait` is not a timing flag — it changes what the
server answers with, and the result is a discriminated union on `waited`.

`run()` is one method with one return type, so **narrowing on `waited` is how
you reach the rest**. That is the point of the union rather than a nuisance from
it: with four optional fields on one interface, `result.runId!` would compile and
be `undefined` exactly when the caller waited.

```typescript
const atc = runtime.getAtc();

// Default: the server answers at once with a run id to poll.
const started = await atc.run({
  objects: [
    { objectType: 'class', objectName: 'ZCL_MY_CLASS' },
    { objectType: 'ddl_source', objectName: 'ZI_MY_VIEW' },
  ],
});

if (!started.waited) {
  // Narrowed to { waited: false; worklistId: string; runId: string }
  console.log(started.runId, started.worklistId);
}
```

```typescript
// Or have the server hold the request until the checks finish.
const done = await atc.run(
  { objects: [{ objectType: 'class', objectName: 'ZCL_MY_CLASS' }] },
  { wait: true },
);

if (done.waited) {
  // Narrowed to { waited: true; worklistId: string; findingStats: string }
  console.log(done.findingStats); // "0,0,1"
}
```

`findingStats` is the server's `FINDING_STATS` triple verbatim, for example
`"0,0,1"`. It is not parsed into named counts: which position is which severity
has been observed once, in a worklist with a single priority-3 finding, which
fits several orderings.

**Polling under a bound you choose.** There is no `waitForRun` helper, and its
absence is the design: waiting needs a stopping condition for a run that does
not finish, no failed or cancelled run has ever been observed, and a helper
would have to invent one. Whoever knows how long their checks take is the one
who can decide when to give up — and `status` travels beside `isFinished` so
they can report the state they last saw.

```typescript
const started = await atc.run({
  objects: [{ objectType: 'class', objectName: 'ZCL_MY_CLASS' }],
});

if (!started.waited) {
  const { runId, worklistId } = started;
  const deadline = Date.now() + 5 * 60_000; // yours to choose
  let status = await atc.getRunStatus(runId);

  while (!status.isFinished && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    status = await atc.getRunStatus(runId);
  }

  if (!status.isFinished) {
    throw new Error(`ATC run ${runId} still ${status.status} after 5 min`);
  }

  const findings = await atc.getFindings(worklistId);
}
```

`isFinished` is **completion, not success**: it says the run reached an end, not
that the end was a good one. And read the worklist only once a run reports
finished — read earlier it is empty whatever happened, which is
indistinguishable from a run that found nothing.

The worklist lists **every object the run checked**, each with its findings,
empty for the ones that were clean. `getFindings()` returns the raw
`IAdtResponse`; no finding model is published, because none has been confirmed
against more than one system.

Two options beyond `wait`:

- `checkVariant` — omitted, the client reads `systemCheckVariant` from ATC
  customizing. On a system whose variant list comes back empty, customizing is
  the only source of a usable one.
- `maximumVerdicts` — a **cap on results**, not a page size. Defaults to 100; a
  caller wanting everything raises it rather than paging. Must be a positive
  integer.

**Nothing here defaults a missing value.** Each response the chain depends on
carries one thing the next step cannot work without — the check variant, the
worklist id, the `Location`, `FINDING_STATS`, `runs:status` — and where that
thing is absent the call rejects naming it (`ATC_NO_CHECK_VARIANT`,
`ATC_NO_WORKLIST_ID`, `ATC_NO_RUN_LOCATION`, `ATC_NO_FINDING_STATS`,
`ATC_RUN_STATUS_MISSING`). The dangerous outcome on an unfamiliar system is not
an exception; it is a confident zero that reads exactly like a clean check.

### ATC Log

Different resources, same subject: `getAtcLog()` reads the execution log and the
check-failure logs, and takes an execution id rather than a worklist id.

```typescript
const atcLog = runtime.getAtcLog();

const checkFailures = await atcLog.getCheckFailureLogs();
const execLog = await atcLog.getExecutionLog(id);
```

### DDIC Activation Graph

```typescript
const graph = await runtime.getDdicActivation().getGraph();
```

### Runtime Dumps

```typescript
const dumps = runtime.getDumps();

// List with optional time-range filter (YYYYMMDDHHMMSS)
const allDumps = await dumps.list({ top: 50 });
const recentDumps = await dumps.list({
  from: '20260401000000',
  to: '20260402235959',
  top: 50,
});

// Filter by user
const userDumps = await dumps.listByUser('CB9980000423', {
  inlinecount: 'allpages',
  top: 50,
  from: '20260401000000',
  to: '20260402235959',
});

// Read dump by ID
const dumpPayload = await dumps.getById('ABCDEF1234567890');
```

Contract notes:
- `getById()` requires a plain dump ID (not full URI) and throws for empty/invalid IDs.
- Methods return raw ADT payload (`IAdtResponse`) so consumers can parse XML according to their needs.

### Feed Repository

```typescript
const feeds = runtime.getFeeds();

const catalog = await feeds.list();         // feed catalog
const variants = await feeds.variants('dumps'); // variants of one feed category
const dumps = await feeds.dumps();          // dumps via Atom feed
const sysMessages = await feeds.systemMessages(); // system messages via feed
const gwErrors = await feeds.gatewayErrors();     // gateway errors via feed
```

`variants` takes a **required** category — the id of a feed from `list()`, such
as `dumps`. Without one `/sap/bc/adt/feeds/variants` answers
`400 ExceptionParameterNotFound`, so the parameterless call earlier versions
allowed could not work. Required since `@mcp-abap-adt/interfaces@26.0.0`.

### System Messages

```typescript
const sysMsgs = runtime.getSystemMessages();

const list = await sysMsgs.list();
const msg = await sysMsgs.getById(id);
```

### Gateway Error Log

```typescript
const gwLog = runtime.getGatewayErrorLog();

const list = await gwLog.list();
const entry = await gwLog.getById(type, id);
```
