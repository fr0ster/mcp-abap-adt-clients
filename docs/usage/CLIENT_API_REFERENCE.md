# Client API Reference

This project exposes the following client classes:

- `AdtClient` - high-level CRUD operations for ADT objects.
- `AdtRuntimeClient` - runtime operations (ABAP debugger, traces, dumps, logs, feeds, ATC check runs, etc.).

`ReadOnlyClient` and `CrudClient` have been removed in the builderless API.

**Every member issues one ADT request.** `create` is the POST, `update` is the
write and carries `options.lockHandle` as given, `delete` is the DELETE,
`checkDeletion` is the approval ADT wants first — both on `IAdtDeletable`, since
anything that can be deleted can be asked whether it can be deleted *now* — and
`lock`/`unlock` are the window. You compose them — see
[OBJECT_LIFECYCLE.md](OBJECT_LIFECYCLE.md) for the flow they make and the one
type where it does not hold.

**Nothing is read into an answer unless you ask for it.** Since 23.0.0 every
implementation answers the document as it arrived, unless you build it with a
reading of your own; whether an answer is a failure is the `analyse` you pass
with the call. The readings and verdicts this package used to apply on its own
live in [`@mcp-abap-adt/adt-strategies`](../../packages/adt-strategies), and
[MIGRATION-23.md](MIGRATION-23.md) maps each removed behaviour to the code that
replaces it.

## AdtClient

```typescript
import { AdtClient } from '@mcp-abap-adt/adt-clients';

const client = new AdtClient(connection);

// One member, one request: this is the POST.
await client.getClass().create({
  className: 'ZCL_TEST',
  packageName: 'ZPACKAGE',
  description: 'Test class',
});

const read = await client.getClass().read({ className: 'ZCL_TEST' });
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
// Available on modern on-prem (ABAP Platform 2022+) and cloud MDD; absent on legacy systems.
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
// `create` is the POST and carries no source; writing it is `update` under a lock.
await fincl.create({
  functionGroupName: 'ZFGROUP',
  includeName: 'LZFGROUPF01',
  description: 'Forms include',
});

const source = await fincl.read({
  functionGroupName: 'ZFGROUP',
  includeName: 'LZFGROUPF01',
});

// Feature Toggle (FTG2/FT) — SAP feature-gate artifact with JSON source payload.
// Available on modern on-prem and cloud MDD; absent on legacy kernels (BASIS < 7.50).
// Endpoint: /sap/bc/adt/sfw/featuretoggles/{name}
// Besides the CRUD atoms a toggle has five members of its own (switchOn,
// switchOff, getRuntimeState, checkState, readSource), each answering its own
// slot of the result set. The default answers every document as it arrived;
// the two JSON readings are in @mcp-abap-adt/adt-strategies:
//
//   import { featureToggleDocuments } from '@mcp-abap-adt/adt-clients';
//   import {
//     featureToggleCheckState,
//     featureToggleRuntimeState,
//   } from '@mcp-abap-adt/adt-strategies';
const toggle = client.getFeatureToggle({
  ...featureToggleDocuments,
  runtimeState: featureToggleRuntimeState,
  checkState: featureToggleCheckState,
});

// --- 1. Create a custom feature toggle ---
// CREATE typically requires SAP_DEVELOPER-equivalent authorization. On cloud
// On some systems FTG2/FT creation is SAP-reserved — expect HTTP 403.
// On modern on-prem (BASIS ≥ 7.50) with developer auth, this works.
// `create` is the POST and carries no source: the toggle is created empty.
await toggle.create({
  featureToggleName: 'ZMY_FEATURE',
  packageName: 'ZMY_PKG',
  description: 'My feature toggle',
  transportRequest: 'DEVK900123',
});

// The JSON source is a write of its own, under the toggle's lock.
const toggleLock = await toggle.lock({ featureToggleName: 'ZMY_FEATURE' });
if (!toggleLock.ok) throw new Error(toggleLock.getError().message);
await toggle.update(
  {
    featureToggleName: 'ZMY_FEATURE',
    transportRequest: 'DEVK900123',
    source: {
      rollout: {
        lifecycleStatus: 'inValidation',
        strategy: 'immediate',
        configurable: false,
        defaultEnabledFor: 'none',
        reversible: true,
      },
      toggledPackages: ['ZMY_PKG'],
    },
  },
  { lockHandle: toggleLock.getResult().value },
);
await toggle.unlock(
  { featureToggleName: 'ZMY_FEATURE' },
  toggleLock.getResult().value,
);

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
// checkState() answers the `…/check` JSON: current state plus transport
// binding info. Call it before switchOn/switchOff when you need to know whether
// a customising transport is allowed and which package / object URI the change
// would bind to. Read by featureToggleCheckState:
const preflight = await toggle.checkState({ featureToggleName: 'ZMY_FEATURE' });
if (preflight.ok) console.log(preflight.getResult().value);
// { currentState: 'off', transportPackage: 'ZMY_PKG',
//   transportUri: '/sap/bc/adt/vit/wb/object_type/sf01/object_name/zmy_feature',
//   customizingTransportAllowed: true }

// --- 5. Read runtime state (all levels) ---
// The `…/states` JSON: the client-level aggregate for the current session plus
// the full per-client and per-user breakdowns. Read by featureToggleRuntimeState:
const runtime = await toggle.getRuntimeState({ featureToggleName: 'ZMY_FEATURE' });
if (runtime.ok) console.log(runtime.getResult().value);
// {
//   name: 'ZMY_FEATURE',
//   clientState: 'on',
//   userState: 'undefined',
//   clientStates: [{ client: '100', description: '...', state: 'on' }, ...],
//   userStates:   [],
// }

// --- 6. Read the JSON source body (rollout / toggledPackages / attributes) ---
// Unlike ABAP source, feature-toggle source is structured JSON. readSource()
// answers it as it arrived (the `sourceDocument` slot); parsing it into
// IFeatureToggleSource is a reading of your own.
const sourceDoc = await toggle.readSource(
  { featureToggleName: 'ZMY_FEATURE' },
  'active', // or 'inactive'
);
if (sourceDoc.ok) {
  // The body as the server sent it: rollout, toggledPackages, attributes.
  const parsed = JSON.parse(String(sourceDoc.getResult().value));
}

// --- 7. Update the toggle (one request: the write) ---
// Since 18.0.0 `update` is the write and nothing else. Lock it first if the
// system asks for a handle, and activate afterwards if you want it active.
// `lock` answers the handle SAP sent, or '' when its answer carried none —
// since 23.0.0 that is an answer, not a thrown "Failed to obtain lock handle".
const locked = await toggle.lock({ featureToggleName: 'ZMY_FEATURE' });
const lockHandle = locked.ok ? locked.getResult().value : undefined;
await toggle.update({ featureToggleName: 'ZMY_FEATURE' }, { lockHandle });
if (lockHandle) {
  await toggle.unlock({ featureToggleName: 'ZMY_FEATURE' }, lockHandle);
}
await toggle.activate({ featureToggleName: 'ZMY_FEATURE' });

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

// The POST that makes the include. It does not write the source.
await include.create({
  includeName: 'ZMY_INCLUDE',
  packageName: 'ZMY_PACKAGE',
  description: 'Shared form routines',
  transportRequest: 'DEVK900123',
});

const source = await include.read({ includeName: 'ZMY_INCLUDE' });
await include.update(
  { includeName: 'ZMY_INCLUDE' },
  { source: '" changed' },
);
await include.activate({ includeName: 'ZMY_INCLUDE' });
await include.delete({ includeName: 'ZMY_INCLUDE' });
```

Contract notes:
- **Activation is a call, not an option.** `activate()` is its own member and
  runs when you call it. **A write takes its source from `options.source`
  and nowhere else** — the config's field used to serve as a second channel for
  the same value and no longer does; it belongs to `check`, which compiles a
  source that is not on the server yet. `options.lockHandle` is passed to the
  write as given — including not at all,
  in which case ADT decides whether an unlocked write is allowed and says so in
  the answer.
- **No deadline unless you set one.** Since 18.0.0 this library sends no
  client-side timeout: `SAP_TIMEOUT_DEFAULT` defaults to `0`, and every request
  waits for the server. Aborting a request mid-flight ends nothing on the server
  — it ends what this side knows — and over HTTP it costs the session: the ICF
  layer is replaced and the ABAP layer beneath it keeps the enqueue locks, whose
  handles died with the cookie. Pass `options.timeout` when a deadline is worth
  that risk, or set `SAP_TIMEOUT_DEFAULT` for a floor across the process.
- **An empty source is a source.** `source: ''` clears an include; only
  `undefined` means none was given. An empty include is a valid object, so
  emptiness must be expressible.
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
| Legacy (BASIS < 7.50, BASIS < 7.50) | ❌ endpoint absent | ❌ | ❌ | ❌ |

### AbapGit (ADT-integrated)

`AdtAbapGitClient` is a **standalone top-level class**, not a factory on `AdtClient`. `AdtClient` is reserved for per-object-type implementations — separate clients stand on their own and are instantiated directly, same pattern as `AdtClient`, `AdtRuntimeClient`, `AdtExecutor`, and `AdtClientsWS`.

```typescript
import {
  AdtCloudConnector,
  CloudHttpTransport,
  TokenAuthProvider,
} from '@mcp-abap-adt/connection';
import {
  AdtAbapGitClient,
  abapGitDocuments,
} from '@mcp-abap-adt/adt-clients';
import {
  abapGitErrorLog,
  abapGitExternalRepo,
  abapGitRepos,
} from '@mcp-abap-adt/adt-strategies';

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

// The client answers every document as it arrived (`abapGitDocuments`) and
// `unlink` answers nothing. The shapes below are readings you ask for, once,
// when you build it.
const abapGit = new AdtAbapGitClient(connection, undefined, undefined, {
  ...abapGitDocuments,
  repos: abapGitRepos,
  errorLog: abapGitErrorLog,
  externalRepo: abapGitExternalRepo,
});

// Probe a remote repo before linking
const info = await abapGit.checkExternalRepo({
  url: 'https://github.com/SAP-samples/cloud-abap-rap.git',
});
if (info.ok) {
  console.log(info.getResult().value.accessMode);                    // 'PUBLIC' | 'PRIVATE' | ...
  console.log(info.getResult().value.branches.map((b) => b.name));   // ['HEAD', 'refs/heads/main', ...]
}

// Link a package to a remote repo
await abapGit.link({
  package: 'ZMY_PKG',
  url: 'https://github.com/SAP-samples/cloud-abap-rap.git',
  branchName: 'refs/heads/main',
});

// Every member is addressed by what `listRepos` reported: the pull link, the
// log link, the repository key. A member never looks them up for you.
const findRepo = async () => {
  const repos = await abapGit.listRepos();
  if (!repos.ok) throw new Error(repos.getError().message);
  const repo = repos.getResult().value.find((r) => r.package === 'ZMY_PKG');
  if (!repo) throw new Error('ZMY_PKG is not linked');
  return repo;
};

// Pull — one POST, to the link `listRepos` reported. It does not wait.
const linked = await findRepo();
if (!linked.pullLink) throw new Error('ZMY_PKG reports no pull link');

const started = await abapGit.pull({
  package: 'ZMY_PKG',
  pullLink: linked.pullLink,
  branchName: 'refs/heads/main',
});
if (!started.ok) throw new Error(started.getError().message);

// The wait is yours: how long, how often, and what to do when it does not
// finish. Until 19.0.0 `pull` ran this loop, and an AbortSignal passed to it
// stopped only this loop — never the server's job. Written here, that is
// visible instead of explained.
// Read once before testing the condition: `linked` was fetched before the POST,
// so its status says nothing about this pull.
const deadline = Date.now() + 600_000;
let repo = await findRepo();
while (repo.status === 'R' && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  repo = await findRepo();
  console.log(`status: ${repo.status} — ${repo.statusText}`);
}

// The error log is read from the link the repository reports — on a failed
// pull, or any time.
if ((repo.status === 'E' || repo.status === 'A') && repo.logLink) {
  const log = await abapGit.getErrorLog(repo.logLink);
  console.error('pull failed:', log.ok ? log.getResult().value : log.getError());
}

// Remove the binding: DELETE /sap/bc/adt/abapgit/repos/{repositoryId}, by the
// key `listRepos` reported.
if (repo.repositoryId) {
  await abapGit.unlink({ repositoryId: repo.repositoryId });
}
```

**Availability.** ADT-integrated abapGit ships with SAP BTP ABAP Environment (Steampunk) and modern on-prem from ABAP Platform 2022+. Legacy kernels (BASIS < 7.50) do not expose `/sap/bc/adt/abapgit/*`. This is **not** the community abapGit that installs via SE38 — that one is a separate ABAP program with its own UI and does not go through ADT.

**Async pull contract.** `pull` starts the server-side job and answers. The job then runs on its own, and nothing you do on this side stops it — which is why the wait above is written in your code rather than hidden in a member with a timeout option. Poll `listRepos()` until the repository's `status !== 'R'` before re-issuing `pull` or `unlink`: starting a second pull while the first is still `R` is unsupported and fails fast.

**No `getRepo`, since 23.0.0.** It listed every repository and picked one for a package — a filter over a document, which is a reading, and a "not found" the library composed from its own search. `listRepos` and your own `find` are the same request. For the same reason `unlink` takes the `repositoryId` and `getErrorLog` the `logLink` that `listRepos` reports, instead of a package name each looked up on its own. `abapGitRepos` reads the key verbatim: the reading it replaces turned `000001` into `1`, which is not the key `unlink` is addressed by.

**Content-type version.** Defaults to `v3` for sapcli compatibility. Cloud MDD advertises `v4`; consumers can opt in via `new AdtAbapGitClient(conn, logger, { contentTypeVersion: 'v4' })`.

### Transport Requests (getRequest())

`client.getRequest()` returns **`IAdtRequest`** — the contract, not the class, since 16.1.0. That is what makes the compiler check the handler: `AdtRequest` has to satisfy the interface at the factory, so a method removed from it fails the build there rather than only where something happens to call it. It also means a consumer can substitute their own handler, or intersect the contract with their own types. To name the type, import it from the contract package — this one does not re-export interface types:

```typescript
import type { IAdtRequest } from '@mcp-abap-adt/interfaces-adt';

// The type argument is what `list` answers — `unknown` for the shipped document.
const requests: IAdtRequest<unknown> = client.getRequest();
```
 `create()` and `read()` behave as any
other handler; `list()` is the one method worth reading closely, because the
endpoint it calls is a **saved-configuration search**, not a filtered query —
sending `user`/`status`/`dateRange`/`targetSystem` as query parameters has
never worked, on any system this was probed against, and the endpoint answers
that shape with the same 309-byte empty root every time.

```typescript
import { AdtClient, transportDocuments } from '@mcp-abap-adt/adt-clients';
import {
  transportSearchConfigurations,
  transportTree,
} from '@mcp-abap-adt/adt-strategies';

const client = new AdtClient(connection);

// The documents as they arrived, unless you ask for a reading.
const request = client.getRequest({
  ...transportDocuments,
  list: transportTree,
  searchConfigurations: transportSearchConfigurations,
});

// Where a configUri comes from: ask. searchConfigurations() is one request.
const configurations = await request.searchConfigurations();
if (!configurations.ok) throw new Error(configurations.getError().message);

// Which saved search to run is yours to choose — the payload carries no name
// and no "default" flag, so there is nothing to choose by but what you know.
for (const { uri } of configurations.getResult().value) {
  const listed = await request.list({ configUri: uri });
  if (listed.ok) console.log(listed.getResult().value.requests.length);
}
```

#### `searchConfigurations()` — where a `configUri` comes from

**`list()` requires a `configUri` since 23.0.0** (`IListTransportsOptions` in
`@mcp-abap-adt/interfaces-adt` 11). Until then `list()` with no argument read
the configurations itself and chose: one was used, several were refused with
`TransportSearchConfigurationMissing`. That was two requests behind one member,
the first of them out of reach of any `analyse` or reading, and a choice about
the caller's system made without the caller. Now the two requests are yours:

| | requests |
|---|---|
| `searchConfigurations()` + `list({ configUri })` | two, both yours |
| `list({ configUri })` with a `configUri` you kept | one |

`searchConfigurations(options?)` answers the configurations document as it
arrived. `transportSearchConfigurations` from `@mcp-abap-adt/adt-strategies`
reads it into `ITransportSearchConfiguration[]` — `uri`, `etag`, and the
configuration's own attributes unrenamed — which is as much of the document as
it takes to address one. A configuration's `uri` does not change between runs,
so a caller who has found theirs can keep it and skip the first request.

#### The object list: `readObjects()`, `removeObject()`, `addObject()`, `createTask()`, `changeTaskType()`

Deleting an ABAP object does not free its name. The CTS object-directory entry
stays on the request that carried it — SAP says so as it happens: *"Release
transport … to remove the object directory entry."* Until that entry is
detached, creating the same name again is refused with `CTS_WBO_API 019`,
**even when the same request is passed as `corrNr`**. Before these members the
ways out were releasing the whole request, shipping everything else in it, or
SE09 by hand.

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';
import { transportObjectEntries } from '@mcp-abap-adt/adt-strategies';

const request = client.getRequest({
  ...transportDocuments,
  objects: transportObjectEntries,
});

// What the task holds, each entry with the position the removal needs.
const listed = await request.readObjects('E19K905942');
const entry = listed.ok
  ? listed.getResult().value.find((o) => o.name === 'ZMCP_BLD_FGR_H1')
  : undefined;

// Free a name: detach the entry from the TASK that holds it.
// `position` is optional on a listed entry: one the server described without
// it cannot be removed, and the compiler asks rather than sending an empty
// value that would remove nothing while answering 200.
if (entry?.position)
  await request.removeObject('E19K905942', { ...entry, position: entry.position });

// Confirm it: the action's own answer only echoes what it was asked.
const log = await request.readActionLog('E19K905942');
// → "OKYSLYTSIA deleted following object R3TR FUGR ZMCP_BLD_FGR_H1"

// A task of your own under a shared request, to work in without touching it.
const task = await request.createTask('E19K905941', { targetUser: 'OKYSLYTSIA' });

// And the other direction.
await request.addObject('E19K907073', { name: 'Z_CL_000001', type: 'CLAS' });

// A task is created without a type; this is how one is given.
await request.changeTaskType('E19K907073', 'S'); // Development/Correction
```

Four things worth knowing before the first call, three of them measured
against an on-premise system on 2026-09-21 — the first run these members ever
had:

- **`position` is required, and it is what makes `removeObject()` do
  anything.** Twenty-two objects asked for by `type` and `name` alone each
  answered `200` with the usual echo document, and re-reading the task found
  all twenty-two still on it. The same documents carrying `tm:position`
  removed every one. `readObjects()` is where the number comes from.
- **`readObjects()` exists for the parsing, not for the representation.** With
  `transportObjectEntries` it answers the entries as values, each with the
  `position` `removeObject()` needs, rather than a document to dig through (its
  default, like every member's, is the document). The header it
  sends changes nothing: measured against an on-premise system, 2026-09-21,
  the same URL with and without
  `application/vnd.sap.adt.transportorganizer.v1+xml` came back byte for byte
  identical — 95411 bytes and 166 `tm:abap_object` for a request, 55549 and 88
  for a task. `readMetadata()` sees the same entries; it just hands you the
  XML.
- **A `200` from `removeObject()` is not evidence.** The endpoint echoes
  whatever it was asked, for an entry that exists and for one that never did.
  `readActionLog()`, or a re-read of the task, is what says a removal landed.
- **`targetUser` is required for `createTask()`.** Left out, the server
  resolves the owner to an empty name and refuses: `400 SCTS_ADT_MSG 009`,
  *"User  does not exist in the system (or locked)"* — two spaces, because the
  name was empty. Eclipse sends the attribute on every `newtask`, which is why
  no capture of Eclipse showed the gap. This client cannot fill it in: the
  connection does not say who is authenticated, and asking would cost a second
  request.
- **A task created explicitly through `createTask()` is born unclassified,
  and the creating call cannot change that.** Measured against BTP ABAP on
  2026-09-23: `tm:type` passed to `newtask` is accepted and ignored, and every
  task on that system read back as `Unclassified`. That system is a trial with
  no transport system configured, so the CTS edit flow never creates a request
  there and every request and task is made by hand. All of them came through
  `newtask`, from this library's tests and from mcp-abap-adt's, and until
  `changeTaskType()` existed neither changed a task's type. When locking an object starts the normal CTS flow and
  the user creates a request, CTS creates and correctly classifies its task; it
  can also classify an existing task selected in that flow. The direct `addobject` action is not that flow. On premise, 2026-09-25,
  `addObject()` onto a fresh Unclassified task was refused with
  `SCTS_ADT_MSG 009` / TK127; after `changeTaskType(task, 'S')` the same call
  answered 200. Classify a task before adding objects directly — SAP states
  the same rule in [Changing a Task Type](https://help.sap.com/docs/ABAP_Cloud/bbcee501b99848bdadecd4e290db3ae4/36fa0d5b537d499ab361d862bcfa51ce.html):
  *"You cannot add any objects if the task type is Unclassified. You need to
  change the task type to Development/Correction or Repair."* The measured
  vocabulary is `S` (Development/Correction), `R` (Repair) and `X` (back to
  Unclassified); `Q` is a customizing type and is refused on a workbench
  request, and `K`/`W` are *request* types, refused as unknown.

  The type goes on a `tm:task` child of the document, not on its root — six
  spellings on the root were each answered `400 "Specified request type or
  task type  is unknown"`, with two spaces where the value belongs.
- **Objects live on tasks, so address the task**, not the request above it.
  `createTask()` answers a number that is itself a request resource — it
  reads, writes and releases like one.

`addObject()` is refused when the object is held by an unrelated task, with
`SCTS_ADT_MSG 009` and a longtext naming the holder: *"There are no links to
this request/task."* That is a third lock flavour, distinct from the enqueue
lock and from the request-versus-task one, and it is the server's verdict to
read rather than a state the client checks for first. On premise,
2026-09-25, the same message with longtext TK127 was returned for an
Unclassified target task; classify it with `changeTaskType()` before adding
objects directly. `pgmid` defaults to `R3TR`,
and `obj_desc` is sent only when given.

`IAbapObjectEntry`, the type those two members take, comes from
`@mcp-abap-adt/interfaces-adt` — import it from there rather than from this
package.

Every slot of `ITransportResults` is required, and every default hands the
document back untouched — `createdTask` and `created` included. The new number
is read by `transportCreated`, and the object list's entries (with the
`position` `removeObject()` needs) by `transportObjectEntries`, both from
`@mcp-abap-adt/adt-strategies`:

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';
import {
  transportCreated,
  transportObjectEntries,
} from '@mcp-abap-adt/adt-strategies';

const request = client.getRequest({
  ...transportDocuments,
  created: transportCreated,
  createdTask: transportCreated,
  objects: transportObjectEntries,
});
```

The `readObjects()` and `createTask()` examples above assume that set.

**On a batch client** `list({ configUri })` records normally and resolves after
`batchExecute()`, like any other member: it is one request now, so there is no
first answer a batch would have to deliver early.

**Migration from filter parameters.** There is no server-side filtering to
lose — the five parameters (`user`, `status`, `date_range`, `target_system`,
`request_type`) were never read by the endpoint. Pass the `configUri` of the
saved search you mean — Eclipse's own is among those `searchConfigurations()`
answers. See [CHANGELOG.md](../../CHANGELOG.md) (11.0.0 entry) for the
before/after low-level signature.

#### `list()` — the transport tree

`list()` answers whatever the reading it was built with makes of the body. The
default is the document; `transportTree` from `@mcp-abap-adt/adt-strategies`
reads it into requests, their tasks, and the containers each request was nested
under.

```typescript
import { AdtClient, transportDocuments } from '@mcp-abap-adt/adt-clients';
import { type ITransportTree, transportTree } from '@mcp-abap-adt/adt-strategies';

const client = new AdtClient(connection);
const requests = client.getRequest({ ...transportDocuments, list: transportTree });

const answer = await requests.list({ configUri });
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
now. `ITransportTree` is not a contract type: a contract carries what is needed
to use or replace it, and a shape a replacement reading would not produce is
neither. It lives beside the reading that builds it, in
`@mcp-abap-adt/adt-strategies` since 23.0.0.

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

**The parse costs no request.** `list()` is one HTTP call. Reading the document
a second way never means fetching it a second time.

**Your own reading, for a payload the shipped one does not know:**

```typescript
import { transportDocuments } from '@mcp-abap-adt/adt-clients';

const requests = client.getRequest({
  ...transportDocuments,
  list: (answer) => myParse(String(answer.data)),
});
```

`myParse` still yields a typed result instead of forcing a caller back onto raw
XML — and the default, `rawDocument`, is there for a caller who wants exactly
that.

**A body `transportTree` does not recognise throws.** That is what stops
`list()`'s original defect (an empty root read as success) from recurring: a
reading that cannot read is the reading failing, not the server refusing, and
it surfaces as itself rather than as a verdict about SAP. An empty `tm:root` is
different — that is **not** an error, and the answer succeeds with
`requests: []` and whatever attributes the root itself carried. A system with no
transport requests must be able to say so without being reported as broken; the
distinction is the root element and the nesting, never a count.

**Legacy systems answer the same member.** `AdtRequestLegacy.list()` reads
`/sap/bc/cts/transportrequests`, whose payload has never been captured — so
`transportTree` may well not recognise it, and will say which element it
expected and what it found. That is the cue to inject a reading for your system.
That endpoint is not a saved search, so `AdtRequestLegacy.list()` keeps
`configUri` optional and refuses one that is given.

**Known limitation — `?targets=true` is not sent.** This library requests
`?configUri=` alone; Eclipse requests `?targets=true&configUri=`. With
`targets=true` the server inserts an extra `tm:target` container carrying a
human name (`"Local Change Requests"`) that the request itself does not
have — its own `tm:target` attribute is `""`. Not sending it costs nothing in
the type: `containers` is already an ordered list, so `tm:target` can be
added later without a breaking change. Whether to send it — always, never, or
behind a flag — is an open decision, not an oversight.

**A response obtained some other way** (a batch result, a fixture, anything
already held) is read by the same strategy — it is a function of the wire
response, and needs no connection:

```typescript
import { transportTree } from '@mcp-abap-adt/adt-strategies';

const tree = transportTree({ status: 200, statusText: 'OK', headers: {}, data: xmlAlreadyInHand });
```

**`create()` answers the document; `transportCreated` reads the new request out
of it**, and the number is the only thing the response is there to deliver:

```typescript
const created = await client
  .getRequest({ ...transportDocuments, created: transportCreated })
  .create({ description: 'my change' });
if (!created.ok) throw new Error(created.getError().message);

created.getResult().value.transportNumber;   // 'DEVK900123'
created.getResult().value.owner;             // the task's owner
```

### `update()` writes the whole content

**Every type, every time: `update` replaces. It never merges.**

ADT's `PUT` overwrites what the object holds, and this package sends what you
hand it. Read the object, change what you mean to change, pass the result.
Anything you leave out is gone, because nothing is read on your behalf to keep
it.

What "the whole content" is depends on the type, and on nothing else:

| types | the whole content | passed as |
|---|---|---|
| class, program, interface, DDL, and the other source-bearing types | the full source | `options.source` |
| domain, package, dataElement, tableType, transport, functionGroup | the object's own document | `config.document` |

```typescript
// A source type. Sending one method body replaces the class with that body.
const cls = client.getClass();
const current = await cls.read({ className: 'ZCL_X' }, 'active');
if (!current.ok) throw new Error(current.getError().message);
const edited = addAMethod(String(current.getResult().value));

const classLock = await cls.lock({ className: 'ZCL_X' });
if (!classLock.ok) throw new Error(classLock.getError().message);
const handle = classLock.getResult().value;
await cls.update({ className: 'ZCL_X' }, { source: edited, lockHandle: handle });
await cls.unlock({ className: 'ZCL_X' }, handle);

// A document type. Same shape, different noun: the document goes in
// `options.source` of `updateMetadata`.
const domain = client.getDomain();
const doc = await domain.readMetadata({ domainName: 'ZD' });
if (!doc.ok) throw new Error(doc.getError().message);
const patched = patchTheDescription(String(doc.getResult().value), 'new');

const domainLock = await domain.lock({ domainName: 'ZD' });
if (!domainLock.ok) throw new Error(domainLock.getError().message);
const lock = domainLock.getResult().value;
await domain.updateMetadata({ domainName: 'ZD' }, { source: patched, lockHandle: lock });
await domain.unlock({ domainName: 'ZD' }, lock);
```

**Until 19.0.0 the six document types hid this.** They fetched the current
document, patched the config's named fields into it, and PUT the result — so a
caller could pass a description alone and the rest survived. That read is gone,
along with the patch helpers (`patchDomainXml` and its four siblings) and the
`XmlPatchError` this section used to describe. The object is not read on your
behalf any more, so nothing preserves what you omit.

**An incomplete write does not announce itself.** The server accepts a valid
document that happens to say less, and the object becomes what you sent. Only an
*empty* body draws a `400`. This is the failure mode to watch for when porting
from 18.x.

**Validity is yours to guarantee, and the server's to rule on.** This package
does not inspect what you pass and could not usefully: whether a document is
complete depends on what your system accepts, which is a question it answers
itself, on the write, in its own words. So there is no guard here to catch a
short document — which is exactly why a caller has to know the rule.

One read-modify-write stays, and it is the one no endpoint can replace:
`AdtMessageClassMessage` writes a message that is a row inside its class's
document.

### What `activate()` answers, and who judges it

`/sap/bc/adt/activation` answers **HTTP 200 even when activation fails**, so the
verdict is in the body. **This package no longer reads it.**

Until 19.0.0 it applied a rule of its own — a response carrying `<msg type="E">`
was a failure — and threw. That strategy is gone, with its two siblings. An
activation now comes back as a success carrying the checklist, and turning that
into a failure is the `analyse` you pass:

```typescript
await client.getClass().activate({ className: 'ZCL_X' }, {
  analyse: (verdict, answer) =>
    /type="E"/.test(String(answer?.data ?? ''))
      ? { origin: 'refusal', message: String(answer?.data) }
      : verdict,
});
```

Build yours from your own corpus of answers rather than from the sketch above.
The measurements below are what this package saw before it stopped judging, and
they are offered as evidence, not as a rule.

`activationExecuted="false"` is **not** a failure signal, despite how it reads:

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

Object types differ in the shape of their success body, which is why inferring a
failure from an unfamiliar one turns working calls into errors — and why the
judgement moved to the caller, who knows which types they are activating.

### Accept Negotiation

The client can optionally auto-correct `Accept` headers after a 406 response:

```typescript
const client = new AdtClient(connection, console, {
  enableAcceptCorrection: true,
});
```

The switch and the corrections it learns belong to **the connection**, not to
the process. Until 23.0.0 they were module globals: an `Accept` corrected on one
system was sent to every other, keyed by method and URL alone, and one client's
`enableAcceptCorrection` switched it for all. This is protocol mechanics — a
retry with a type the server named — not a reading of SAP's verdict, which is
why it stays in the library.

There is no per-call `Accept` override on the object members: the header each
member sends is the one its endpoint takes, and negotiation corrects it when a
system answers `406`. Reading a source without a version (the state right after
a create) is `read(config, undefined)`.

### AdtUtils (Object Metadata/Source)

`AdtUtils.readObjectMetadata` and `AdtUtils.readObjectSource` enforce strict object types to prevent invalid inputs like `view:ZOBJ`.

```typescript
import type { AdtObjectType, AdtSourceObjectType } from '@mcp-abap-adt/interfaces-adt';

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

**A reading that cannot read is neither.** Every default is the document as it
arrived, so nothing this package ships parses an answer on its way to you. A
reading you inject — your own, or one from `@mcp-abap-adt/adt-strategies` — that
throws is a failure of the reading, not the server refusing, so it surfaces as
itself, outside the classification. Calling that `origin: 'parse'` (as 17.0.0
did) told a caller to go and look at a system that had answered them correctly.

**What throws, and what answers.** A cause on SAP's side — a status, a refusal
in a body, an answer missing what you expected — comes back through the
strategies, never as a throw and never rewrapped in an error that drops the
response. A throw is reserved for causes inside this library: an argument you
did not give that the request cannot be built without (a where-used type no
address exists for, an ATC run over no objects), or a bug.

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
the interface each satisfies (`IClassResults`, …). **Every default answers the
document as it arrived**, or nothing where ADT answers nothing. The three
building blocks are `rawDocument` (the body as it arrived), `nothing` (for a
member ADT answers with nothing worth reading) and `wireItself` (the whole
exchange: status, headers, body).

The readings — the transport tree, the version feed, search hits, a unit-test
run id, the ATC and profiler views, the abapGit list — are strategies in
[`@mcp-abap-adt/adt-strategies`](../../packages/adt-strategies), and you put the
ones you want into the set:

```typescript
import { classDocuments } from '@mcp-abap-adt/adt-clients';
import { objectVersions } from '@mcp-abap-adt/adt-strategies';

const classes = client.getClass({ ...classDocuments, versions: objectVersions });
```

The runtime client and the executor work the same way: `getProfiler(results)`,
`getAtc(results)`, `getClassExecutor(results)` and the rest take a set, and each
call builds a fresh implementation — a cached one kept the first caller's
readings for everyone after.

**A set covers every member that makes a request.** `utilDocuments` is the
largest, at twenty slots — one for each member of `AdtUtils` that reaches ADT.
The three that reach nothing (`modifyWhereUsedScope`, `supportsSourceCode`,
`getObjectSourceUri`) have no slot, because a strategy reads an answer and they
have none.

**Chosen once, not per call.** That fits how these consumers work: a backup tool
wants documents whole for everything it touches, a script wants two fields from
every read, an MCP server picks by what its model is about to do — and none of
them changes its mind between `create` and `read` of the same object. So there
are no `parse` parameters, no `readWith`, and no second member differing only in
how far it read.

**What a reading produces is not a contract type.** `ISearchResult`,
`ITransportTree`, `IObjectVersion`, `IRepositoryNodeContents` and their
neighbours live in `@mcp-abap-adt/adt-strategies`, beside the readings that
build them — inject your own reading and it is your shape that comes back, so a
contract naming one would be describing an implementation.

**The other axis is `analyse`, and it is per call**, because whether an answer is
a failure can depend on what you are doing:

```typescript
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';

await client.getClass().read({ className: 'ZCL_X' }, 'active', {
  analyse: (verdict, answer) =>
    verdict === ADT_NO_FAILURE && String(answer?.data ?? '') === ''
      ? { origin: 'refusal', message: 'ZCL_X does not exist' }
      : verdict,
});
```

The failure question is asked first, always: a reading is never handed a refusal
to make a value out of. **No error strategy ships from this package, and no
member supplies one of its own.** ADT delivers some refusals inside a `200` —
an activation checklist carrying `<msg type="E">`, a validation carrying
`<SEVERITY>ERROR</SEVERITY>`, a deletion check saying no — and nothing below
the contract can tell those from a success. Which of them your application
should treat as a failure depends on your system and what you are about to do,
so the `analyse` is yours: write it, or take one from
`@mcp-abap-adt/adt-strategies` (`analyseActivation`, `analyseDeletion`,
`analysePublication`, `analyseUnitTestStart`, …). Until 23.0.0 ten members
applied a verdict of their own when you passed none; each now hands on what you
gave it, or nothing.

Omit `analyse` and you still get a failure when the transport itself failed,
carrying the response and the request it arrived on. Pass `nothingIsARefusal`
and you do not even get that: every exchange that produced an answer comes back
as a success carrying it, so a `403` and its document are yours to read.

```typescript
import { nothingIsARefusal, wireItself } from '@mcp-abap-adt/adt-clients';

const cls = client.getClass({ ...classDocuments, source: wireItself });
const answer = await cls.read(config, 'active', { analyse: nothingIsARefusal });
if (answer.ok) {
  const exchange = answer.getResult().value; // status, headers, body
}
```

A request that never completed is still a failure — there is no answer to read,
and a success built from none would be a lie.

### Service bindings: publishing is the editing

A service binding is not edited the way a class is. It is created once, and
after that it is **published** and **unpublished** — and that is what its ADT
lock is for.

Measured from Eclipse (ADT 3.60.3), publishing looks like this:

```
POST …/bindings/zac_srvb01?_action=LOCK&accessMode=MODIFY   200   stateful
POST …/businessservices/odatav4/publishjobs                 200   stateless, ~133 s
…
POST …/bindings/zac_srvb01?_action=UNLOCK&lockHandle=6B35…  200   "Closing editor"
```

Unpublishing is the same, against `…/unpublishjobs`.

**The lock is yours to take and yours to give back.** `update()` does not take
it for you:

```typescript
import { analysePublication } from '@mcp-abap-adt/adt-strategies';

const bindings = client.getServiceBinding();

const locked = await bindings.lock({ bindingName: 'ZAC_SRVB01' });
if (!locked.ok) throw new Error(locked.getError().message);
const lockHandle = locked.getResult().value;

try {
  const answer = await bindings.update(
    {
      bindingName: 'ZAC_SRVB01',
      desiredPublicationState: 'published',
      serviceType: 'odatav4',
    },
    // ~133 seconds on the systems measured, both directions. The 120s default
    // is under that, so a caller that does not raise it will be told the
    // request timed out while the job goes on to finish.
    // analysePublication (@mcp-abap-adt/adt-strategies) reads the job's
    // <SEVERITY> into a failure; without it the document is the answer.
    { timeout: 300_000, analyse: analysePublication },
  );
  if (!answer.ok) throw new Error(answer.getError().message);
} finally {
  await bindings.unlock({ bindingName: 'ZAC_SRVB01' }, lockHandle);
}
```

Why the library does not do that for you: **how long a lock is held is a
policy**, and it is not one policy. Eclipse holds a binding's lock for as long
as an editor is open — across several publishes, if that is what the person
does — and releases it when the editor closes. A script holds one for a single
call. The connection is usually shared by everything a consumer is doing, so a
library that locked and unlocked around its own operation would be choosing for
every other user of that session.

**What it costs to skip it.** A binding whose lock was never released refuses
its own delete with `You are already editing ZAC_SRVB01`, and any later
`_action=LOCK` — another session, another process, the same user — is answered
`403 ExceptionResourceNoAccess: User … is currently editing`. A session recycle
does not clear it; only the unlock does.

**`serviceType` is required — and since `@mcp-abap-adt/interfaces@37.0.0` the
compiler says so.** `update` takes `IServiceBindingPublicationConfig`, which
requires the binding, the state and the protocol; the write capability atoms
take a config as given rather than flattening it to `Partial`, so the demand
travels to a caller holding the binding through `IAdtUpdatable` and not only to
one holding the class. Before that it was a runtime throw before the wire, which
is a requirement stated where the caller cannot see it.

**The service name and version are not taken at all.** The job is posted with no
query string, to a body naming the target by type and name — captured from
Eclipse, both directions — so there is nowhere for a service name or version to
go. `serviceType` selects the endpoint,
`odatav2` or `odatav4`, and a caller holding a binding knows it from the
variant (`ODATA_V4_UI` → `odatav4`).

This member used to read the binding first and fill all three in from its own
document. That read made one member two requests, which is what this release
exists to stop — and the state check it also did is the server's answer anyway:
an invalid transition comes back as `SEVERITY` in the job's document. To decide
beforehand, read the binding yourself and look at `srvb:allowedAction`.

**`desiredPublicationState: 'unchanged'` is refused.** A binding's `update` *is*
its publication, so there is no request that changes nothing — do not call it.
The value stays legitimate on a binding's *config*, where it says a create
should not publish.

**Nothing here waits.** The job answers its own verdict — `<SEVERITY>OK` with a
`<SHORT_TEXT>` — inside a `200`. Pass `analysePublication` from
`@mcp-abap-adt/adt-strategies` in the `update` options and a refused publish
comes back as the failure half; pass nothing and it comes back as the document,
yours to read. Until 23.0.0 the member applied that reading itself. It takes about two minutes of server time on the
systems measured; that is the operation, not a timeout to tune. If you want to
watch the result settle, read the service group yourself:

```typescript
const group = await bindings.getServiceGroup({
  objectname: 'ZAC_SRVB01',
  serviceType: 'odatav4',
  servicename: 'ZAC_SRVD01',
  serviceversion: '0001',
});
```

That is a read of the OData service group — its URL prefix, its collections,
its deployment state — which carries `published` among them. It is not a
job-status endpoint, and polling it is the consumer's to write.

### Message class (MSAG) and its messages

Message classes and their individual messages are two separate handlers.
`getMessageClass()` manages the class shell (name, description, package,
`masterLanguage`); `getMessageClassMessage()` manages a single message, which is
read-modify-write over the parent class (a message has no independent write
endpoint — the one exception to "one member, one request"). Message classes are
**not activated**, and the handler carries no `activate()` or `check()` at all.

`getMessageClass().updateMetadata()` is one `PUT` of the document you pass in
`options.source`, under your `options.lockHandle`. Until 23.0.0 it read the
class itself and patched `config.description` into it; now you read it
(`readMetadata`), change what you mean to change, and pass the whole document.

```typescript
import { analyseMessageClassMessage } from '@mcp-abap-adt/adt-strategies';

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

// Read one message. The answer is the class's document — there is no resource
// for a single message. analyseMessageClassMessage (@mcp-abap-adt/adt-strategies)
// turns a message number the class does not carry into a failure; without it,
// the class answering is a success whether or not the message is there.
const msg = await client.getMessageClassMessage().read(
  { className: 'ZMY_MSG', msgno: '001' },
  undefined,
  { analyse: analyseMessageClassMessage('001') },
);
if (msg.ok) console.log(msg.getResult().value);   // the class document

// Remove a single message, then delete the whole class.
// `delete` is on the class, not on the contract `getMessageClassMessage()`
// answers — construct it against the connection you hold.
await new AdtMessageClassMessage(connection).delete({ className: 'ZMY_MSG', msgno: '001' });
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

`getVersions` answers the Atom feed and `getVersionSource` the source, each as
it arrived, through the `versions` and `versionSource` slots of the result set.
`objectVersions` from `@mcp-abap-adt/adt-strategies` reads the feed into
`IObjectVersion[]`:

```typescript
import { classDocuments } from '@mcp-abap-adt/adt-clients';
import { objectVersions } from '@mcp-abap-adt/adt-strategies';

const classes = client.getClass({ ...classDocuments, versions: objectVersions });

const listed = await classes.getVersions({ className: 'ZCL_MY_CLASS' });
if (!listed.ok) throw new Error(listed.getError().message);

const versions = listed.getResult().value;   // IObjectVersion[]
for (const v of versions) {
  console.log(`${v.versionId} by ${v.author ?? '?'} at ${v.updatedAt ?? '?'}`);
}

// Fetch the source of a specific version via its opaque contentUri.
if (versions.length > 0) {
  const src = await classes.getVersionSource(versions[0].contentUri);
  if (src.ok) console.log(src.getResult().value);
}
```

A type that *does* have version history, on a system where the resource is not
available, answers what the transport said — a `404` or `406` failure with its
response. Until 23.0.0 the member threw `UNSUPPORTED_OPERATION` in its place,
which is a verdict about the system this package had no business making. If you
want it named, say so per call:

```typescript
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { analyseUnsupportedStatus } from '@mcp-abap-adt/adt-strategies';

const listed = await classes.getVersions(
  { className: 'ZCL_MY_CLASS' },
  { analyse: analyseUnsupportedStatus([404, 406], 'version history') },
);
if (!listed.ok) {
  if (listed.getError().code === AdtObjectErrorCodes.UNSUPPORTED_OPERATION) {
    // this system does not answer the versions resource
  }
}
```

### AdtUtils (Where-used)

Where-used is two requests, and both are yours:

1) `getWhereUsedScope` fetches the scope XML (available object types + default selections).
2) `getWhereUsed` executes the search with that scope (the server's default selection if scope is omitted).

`modifyWhereUsedScope` edits the scope XML locally — no ADT call.

See `docs/architecture/ARCHITECTURE.md` for the architectural overview.

```typescript
import { utilDocuments } from '@mcp-abap-adt/adt-clients';
import { utilWhereUsedReferences } from '@mcp-abap-adt/adt-strategies';

const utils = client.getUtils({
  ...utilDocuments,
  whereUsed: utilWhereUsedReferences,
});

const scope = await utils.getWhereUsedScope({
  object_name: 'ZMY_TABLE',
  object_type: 'table',
});
if (!scope.ok) throw new Error(scope.getError().message);

// Only structures/tables — not the dozens of other referencing types. SAP
// applies the selection server-side, so it never searches the unwanted ones.
const scopeXml = utils.modifyWhereUsedScope(String(scope.getResult().value), {
  enableOnly: ['TABL/DS', 'TABL/DT'],   // or disable: ['CLAS/OC'], or enableAll: true
});

const result = await utils.getWhereUsed({
  object_name: 'ZMY_TABLE',
  object_type: 'table',
  scopeXml,
});
if (result.ok) {
  const found = result.getResult().value;
  console.log(`Found ${found.totalReferences} references`);
  for (const ref of found.references) {
    console.log(`${ref.name} (${ref.type}) in ${ref.packageName}`);
  }
}
```

`getWhereUsedList`, which joined the scope and the search and filtered on the
client when a system had no `/usageReferences/scope` (some S/4 releases answer
it with `404`), left in 19.0.0: what to do on such a system is a decision about
your system, not a fallback hidden in here. Without `utilWhereUsedReferences`,
`getWhereUsed` answers the document.

**`object_type`** is an ADT type code (`CLAS/OC`, `BDEF/BDO`, …, any case) or
one of the friendly names `class`, `program`, `include`, `function`,
`functiongroup`, `interface`, `package`, `table`, `structure`, `domain`,
`dataelement`, `view`, `functionmodule`. A function module is named
`GROUP|FM_NAME`. Since 23.0.0 the address is built by the same `buildObjectUri`
each family's activation is checked against; the separate vocabulary where-used
kept before accepted `intf/if` and `stru/dt`, which are not ADT codes, and those
are now refused — thrown before any request, because the argument is what is
wrong, not anything the server said.

## AdtRuntimeClient

`AdtRuntimeClient` exposes all runtime operations through domain object factories. Each factory takes a result set, builds a fresh implementation on every call, and returns it — nothing is cached, so one caller's readings never become another's. Every default answers the document as it arrived; the readings are in `@mcp-abap-adt/adt-strategies`. Every member takes `analyse` in its options.

```typescript
import { AdtRuntimeClient } from '@mcp-abap-adt/adt-clients';

const runtime = new AdtRuntimeClient(connection, logger);
```

### Profiler Traces

Since 13.0.0 the profiler **reads**; configuring a measurement belongs to the
executors. The two never share a vocabulary: scheduling yields a *request id*,
reading takes a *trace id*.

```typescript
import { profilerDocuments } from '@mcp-abap-adt/adt-clients';
import {
  compareRecordedAt,
  profilerDbAccesses,
  profilerHitList,
  profilerStatements,
  profilerTraceEntries,
} from '@mcp-abap-adt/adt-strategies';

const profiler = runtime.getProfiler({
  ...profilerDocuments,
  list: profilerTraceEntries,
  hitlist: profilerHitList,
  statements: profilerStatements,
  dbAccesses: profilerDbAccesses,
});

// What traces exist.
const listed = await profiler.list({ user: 'SOMEONE' });
if (!listed.ok) throw new Error(listed.getError().message);
const traces = listed.getResult().value;   // IAbapTraceEntry[]
// Not `a.recordedAt > b.recordedAt`: that compares ISO timestamps as text and
// gets the answer wrong across UTC offsets. See the note below.
// The guard is not decoration: an empty feed is normal — nothing profiled yet —
// and `reduce` with no initial value throws `TypeError` on `[]`.
const newest = traces.length
  ? traces.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b))
  : undefined;
if (!newest) return;

// What is inside one. The result is what that view's strategy makes of it.
const hitList = await profiler.read(newest.id, 'hitlist', {
  withSystemEvents: false,
});
const statements = await profiler.read(newest.id, 'statements');
const dbAccesses = await profiler.read(newest.id, 'dbAccesses');

if (hitList.ok && dbAccesses.ok) {
  console.log(
    hitList.getResult().value.entries.length,
    dbAccesses.getResult().value.accesses[0]?.accessTime?.total,
  );
}

// And take it back out when done — since 15.0.0.
await profiler.delete(newest.id);
```

Configuring and scheduling live on the executors:

```typescript
import { AdtExecutor, classExecutorDocuments } from '@mcp-abap-adt/adt-clients';
import {
  traceSchedulingProfilerId,
  traceSchedulingRequests,
  traceSchedulingTypes,
} from '@mcp-abap-adt/adt-strategies';

const classExecutor = new AdtExecutor(connection, logger).getClassExecutor({
  ...classExecutorDocuments,
  types: traceSchedulingTypes,
  requests: traceSchedulingRequests,
  scheduled: traceSchedulingProfilerId,
});

const objectTypes = await classExecutor.listObjectTypes();   // ITraceCatalogueItem[]
const processTypes = await classExecutor.listProcessTypes();
const scheduled = await classExecutor.listRequests();        // ITraceRequestEntry[]

// The request id is in `Location` and nowhere else — the default reading,
// which reads the body, answers ''.
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
- **The readings do not validate.** Judging SAP's own documents is not a
  reading's job; the server is the authority on its responses, and where a check
  is needed ADT has an endpoint (`getInclude().validate()`). A body the
  `profiler*` readings do not recognise yields empty rather than an exception.
  Searching and filtering belong to the server too.
- **A run does not promise a trace.** SAP writes it asynchronously, so when
  `runWithProfiler` returns there may be no trace, there may never be one, and
  you may legitimately read it a week later. To find the one your run produced,
  note the ids before running and look for a new one — see
  `src/__tests__/helpers/traceHelpers.ts`.
- **Position in the feed is not age.** A feed's first entries have been measured
  minutes old while its last were eight days older, so "the first id in the
  document" is a trace chosen at random. Compare `recordedAt`.
- `scheduleTrace()` answers what SAP sent; the answer carries the request id, and
  `traceSchedulingProfilerId` reads it. Keep it: reading the created parameters
  resource back gives `200` with an empty body.
- `grossTime` and `traceEventNetTime` are `{ time, percentage }` since 14.0.0,
  measured from a raw capture. The **unit of `time` is not named** — the wire
  gives a figure and no unit; `percentage` is of the trace total, which is what
  makes a row comparable without knowing it.
- A trace entry carries more than an id: `system`, `client`, `host`, `size`,
  `runtime` and its three parts, `isAggregated`, `amdpFileSize`. `client` is a
  **string**, because `010` is not `10`.
- Comparing `recordedAt` as a **string** is wrong: `09:00:00Z` is later than
  `10:00:00+02:00` and sorts lower as text. Use `compareRecordedAt` from
  `@mcp-abap-adt/adt-strategies`, beside the reading that produces the field.
  There is no `latestTraceId()` since 15.0.0 — it lived on the concrete class
  where `getProfiler()` never exposed it, so no consumer could call it:

  ```typescript
  const listed = await profiler.list();
  const traces = listed.ok ? listed.getResult().value : [];
  // `latestTraceId()` answered `undefined` on an empty feed. Keep that: an
  // empty feed is normal, and `reduce` with no initial value throws on `[]`.
  const newest = traces.length
    ? traces.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b))
    : undefined;
  ```
- **`delete(traceId)` takes an id or a full URI**, so the `uri` from `list()`
  can go straight back. What a missing id does is **not measured**: a caller who
  must tolerate one reads `ok`, or passes an `analyse` that says what it means.

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

`runtime.getAtc()` makes one request per member. An ATC run is three requests —
the check variant, a worklist for it, the run — and since 19.0.0 they are three
members you call in the order you want: `resolveCheckVariant()`,
`createWorklist(checkVariant)`, `startRun(worklistId, target, options)`. Then
`getRunStatus(runId)` and `getFindings(worklistId)`. A check run is not
created, locked, activated or versioned, and the returned handler's type says
so.

Objects are named by kind, not by URI: the client builds the URI. The kinds are
`class`, `interface`, `function_group`, `package`, `ddl_source`, `table` and
`behavior_definition`. Each was confirmed by a run submitted at the URI this
client builds whose *finished* worklist then listed that object under that
type; a run being accepted proves nothing, since a URI that cannot exist is
answered `201` too. `program` and `include` are absent because ABAP Cloud
refuses to hold either, so nothing there could confirm them.

Every member answers the document as it arrived — `createWorklist` and
`resolveCheckVariant` included, which answer `IAdtResponse` like the rest since
23.0.0. The readings are in `@mcp-abap-adt/adt-strategies`:

```typescript
import { atcDocuments } from '@mcp-abap-adt/adt-clients';
import {
  atcRunStatus,
  atcStartedRun,
  atcSystemCheckVariant,
  atcWaitingRun,
  atcWorklistId,
} from '@mcp-abap-adt/adt-strategies';

const atc = runtime.getAtc({
  ...atcDocuments,
  checkVariant: atcSystemCheckVariant,
  worklist: atcWorklistId,
  startedRun: atcStartedRun,
  waitingRun: atcWaitingRun,
  runStatus: atcRunStatus,
});

// The system's variant — or name one yourself and skip this request. On a
// system whose variant list comes back empty, customizing is the only source
// of a usable one.
const variant = await atc.resolveCheckVariant();
if (!variant.ok || !variant.getResult().value) throw new Error('no check variant');

const worklist = await atc.createWorklist(variant.getResult().value);
if (!worklist.ok || !worklist.getResult().value) throw new Error('no worklist id');
const worklistId = worklist.getResult().value;

// Default: the server answers at once with a run id to poll.
const started = await atc.startRun(worklistId, {
  objects: [
    { objectType: 'class', objectName: 'ZCL_MY_CLASS' },
    { objectType: 'ddl_source', objectName: 'ZI_MY_VIEW' },
  ],
});
```

**Two modes, two shapes.** `wait` is not a timing flag — it changes what the
server answers with, so it decides which slot reads the answer: `startedRun`
(201, an empty body, the run id in `Location`) or `waitingRun` (200,
`<atcworklist:worklistRun>`).

```typescript
// Or have the server hold the request until the checks finish.
const done = await atc.startRun(
  worklistId,
  { objects: [{ objectType: 'class', objectName: 'ZCL_MY_CLASS' }] },
  { wait: true },
);

if (done.ok) console.log(done.getResult().value.findingStats); // "0,0,1"
```

`findingStats` is the server's `FINDING_STATS` triple verbatim, for example
`"0,0,1"`. It is still not parsed into named counts, but the ordering is no
longer a single observation: a worklist with one priority-3 finding read
`"0,0,1"`, and a worklist with one priority-2 finding read `"0,1,0"` (BTP
trial, 2026-09-08, `ZAC_SHR_ATC_DIRTY` under `ABAP_CLOUD_DEVELOPMENT_DEFAULT`).
Two points fitting `(priority 1, priority 2, priority 3)` and no other ordering
that survives both. Position one has still never been seen non-zero, which is
why this stays a string: `{ errors, warnings, infos }` would name a severity
nobody here has watched the server count.

**Polling under a bound you choose.** There is no `waitForRun` helper, and its
absence is the design: waiting needs a stopping condition for a run that does
not finish, no failed or cancelled run has ever been observed, and a helper
would have to invent one. Whoever knows how long their checks take is the one
who can decide when to give up — and `status` travels beside `isFinished` so
they can report the state they last saw.

```typescript
if (started.ok && started.getResult().value.runId) {
  const { runId } = started.getResult().value;
  const deadline = Date.now() + 5 * 60_000; // yours to choose
  const poll = async () => {
    const answer = await atc.getRunStatus(runId);
    if (!answer.ok) throw new Error(answer.getError().message);
    return answer.getResult().value;
  };

  let status = await poll();
  while (!status.isFinished && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    status = await poll();
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
empty for the ones that were clean. `getFindings()` answers the worklist
document; no finding model is published, because none has been confirmed
against more than one system.

`maximumVerdicts` (an option of `startRun`) is a **cap on results**, not a page
size. Defaults to 100; a caller wanting everything raises it rather than
paging. It must be a positive integer, and the object set must not be empty —
both thrown before the request, because the argument is what is wrong.

**Nothing here turns a missing value into a verdict.** Until 23.0.0 the chain
threw when an answer lacked what the next step needed (`ATC_NO_CHECK_VARIANT`,
`ATC_NO_WORKLIST_ID`, `ATC_NO_RUN_LOCATION`, `ATC_NO_FINDING_STATS`,
`ATC_RUN_STATUS_MISSING`) — a sentence about SAP's answer raised as if the
library had failed. The readings now answer `''` for what is not there
(`atcSystemCheckVariant`, `atcWorklistId`, a `runId` without `Location`, a
`findingStats` never reported — never `"0,0,0"`), which is why the checks above
look for it before the next step. The outcome to guard against on an
unfamiliar system is a confident zero that reads exactly like a clean check.

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
- `getById()` requires a plain dump ID (not a full URI); one containing `/` is
  thrown before the request.
- Every member answers the ADT payload as it arrived (`runtimeDumpsDocuments`),
  so consumers read it according to their needs.

### Feed Repository

```typescript
import { feedDocuments } from '@mcp-abap-adt/adt-clients';
import { feedDescriptors, feedEntries } from '@mcp-abap-adt/adt-strategies';

// Documents as they arrived by default; feedDescriptors, feedVariants,
// feedEntries, feedSystemMessages, feedGatewayErrors and feedGatewayErrorDetail
// read them.
const feeds = runtime.getFeeds({
  ...feedDocuments,
  feeds: feedDescriptors,
  entries: feedEntries,
});

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
