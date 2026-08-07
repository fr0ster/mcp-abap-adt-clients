# Transport list via `configUri` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AdtClient.getRequest().list()` return transport requests, which it has never
done, by referencing a saved search configuration instead of sending filter parameters the
server does not read.

**Architecture:** The ADT transport list is a saved-configuration search. The low level takes
a required `configUri` and issues exactly one request; the high level resolves a configuration
when the caller names none, and only that resolution path is forbidden on a batch connection,
because only it awaits a response mid-recording. Parsing the returned tree is a separate,
later piece of work gated on evidence this plan does not have.

**Tech Stack:** TypeScript (strict, CommonJS), Jest, Biome, `fast-xml-parser`, two npm
packages — `@mcp-abap-adt/interfaces` (types) and `@mcp-abap-adt/adt-clients` (this repo).

**Spec:** `docs/superpowers/specs/2026-08-07-transport-list-and-structural-parsing-design.md`
(approved 2026-08-07). Work order steps A, B, C, G. **Steps D and E are deliberately not in
this plan** — see "What this plan does not contain" at the end.

**Companion plan:** `2026-08-07-interfaces-contract-consolidation.md`. Interfaces release A is
**shared** — that plan's Task 8 cuts one release carrying both its 34 promoted types and this
plan's Tasks 1–2. Do not cut two releases. Two symbols this plan first put in adt-clients —
`TransportSearchConfigurationMissing` and `TRANSPORT_SEARCH_CONFIGURATIONS_URL` — live in
`interfaces` by the ruling recorded there: anything a consumer imports in order to *use* the
library belongs in the contract package. Likewise step E adds `transportListParser` to
`IAdtClientOptions` **in interfaces**, where that type now lives.

## Global Constraints

- All repository artifacts — code, comments, commit messages, docs — in **English**.
- Types, interfaces and constants live in `@mcp-abap-adt/interfaces` and are imported; never
  redefined locally, never re-exported from this package.
- **Publish the dependency first.** `@mcp-abap-adt/interfaces` must be on npm before
  adt-clients imports anything new from it. No `file:`, no tarball, no `"link": true` in
  `package-lock.json` — verify after every `npm install`.
- **Never change `package.json` version without asking.** Each release task asks the user
  which version to use before bumping. After bumping, run `npm install --package-lock-only`
  and include the lockfile in the same commit.
- Claude opens PRs, merges **reviewed** PRs, tags, and creates GitHub releases. `npm publish`
  is the user's — always stop and hand over.
- PRs are for **code**. Specs and plans go straight to `main`.
- All diagnostics through the injected `ILogger`. `console.*` is a lint error in production
  code and a warning in tests.
- Biome: single quotes, semicolons, 2-space indent. `npm run lint` before every commit.
- **One SAP-touching run at a time**, and no edits under `src/` while a run is in flight.
- Never pipe test output through `grep`/`tail`/`head`. Save the whole log, then read it:
  `npm test 2>&1 | tee test-run.log`.
- Unit tests run without SAP: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`.
- Integration tests take supporting objects from `shared_dependencies`; package and transport
  come from `test-config.yaml`, never hardcoded.

## Repositories

| repo | path | role in this plan |
|---|---|---|
| interfaces | `/home/okyslytsia/prj/mcp-abap-adt-interfaces` | Tasks 1–3 |
| adt-clients | `/home/okyslytsia/prj/mcp-abap-adt-clients` | Tasks 4–9, 10, 11 |

---

## Phase A — interfaces (unblocked)

### Task 1: Transport parameter and search-configuration types

**Files:**
- Modify: `../mcp-abap-adt-interfaces/src/adt/IAdtTransport.ts:14-21`
- Modify: `../mcp-abap-adt-interfaces/src/index.ts:290-295`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/transportSearch.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `IListTransportsParams { configUri: string }`,
  `IListTransportsOptions { configUri?: string }`,
  `ITransportSearchConfiguration { uri: string; etag?: string; attributes: Record<string, string> }`.
  Tasks 4, 6, 7 import all three.

**Branch first:**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git checkout main && git pull --ff-only
git checkout -b feat/transport-search-configuration
```

- [ ] **Step 1: Write the compile-only assertion**

Create `src/__typechecks__/transportSearch.ts`:

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import type {
  IListTransportsOptions,
  IListTransportsParams,
  ITransportSearchConfiguration,
} from '../adt/IAdtTransport';

// The low level cannot be called without naming a configuration. This is the
// whole point of the split: that layer requests, it does not resolve.
const _low: IListTransportsParams = { configUri: '/sap/bc/adt/cts/x' };
void _low;

// @ts-expect-error configUri is required at the low level.
const _lowEmpty: IListTransportsParams = {};
void _lowEmpty;

// The high level may omit it, which opts into resolution.
const _highEmpty: IListTransportsOptions = {};
const _highNamed: IListTransportsOptions = { configUri: '/sap/bc/adt/cts/x' };
void _highEmpty;
void _highNamed;

// A configuration is addressable and carries its attributes verbatim. There is
// no name and no default marker in the payload — do not add one to the type.
const _config: ITransportSearchConfiguration = {
  uri: '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
  etag: '20260807095048',
  attributes: { createdBy: 'CB9980008038', client: '100' },
};
void _config;

// etag is optional: a link may not carry one.
const _noEtag: ITransportSearchConfiguration = { uri: '/x', attributes: {} };
void _noEtag;
```

- [ ] **Step 2: Run the typecheck to verify it fails**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check
```

Expected: FAIL — `IListTransportsOptions` and `ITransportSearchConfiguration` are not
exported from `./adt/IAdtTransport`, and `_lowEmpty` does **not** error yet (so the
`@ts-expect-error` itself reports "Unused '@ts-expect-error' directive").

- [ ] **Step 3: Replace the parameter type and add the two new ones**

In `src/adt/IAdtTransport.ts`, replace the whole `IListTransportsParams` block:

```ts
export interface IListTransportsParams {
  user: string;
  status?: string; // D = modifiable, R = released
  date_range?: string; // e.g. "20260101-20260326"
  target_system?: string;
  request_type?: string; // K = workbench, T = customizing
}
```

with:

```ts
/**
 * Low level. `configUri` is REQUIRED: this layer requests, it does not resolve.
 *
 * The five filter fields this replaces were never read by the server. Probed on
 * the trial 2026-08-07: `/sap/bc/adt/cts/transportrequests` answers with the
 * same 309-byte empty root for `?user=`, for `?status=`, for the configuration's
 * own property spellings, and for no parameters at all — while 15 requests
 * existed. The transport list is a saved-configuration search: reference the
 * search, do not restate it.
 */
export interface IListTransportsParams {
  /** href of a saved search configuration, verbatim from the configurations document. */
  configUri: string;
}

/** High level. Omitting `configUri` opts into the resolution rule in `AdtRequest`. */
export interface IListTransportsOptions {
  configUri?: string;
}

/**
 * One saved transport search configuration.
 *
 * The payload carries no name and no default marker: the element holds
 * authorship and client, while the href and its etag live on an `atom:link`
 * child. Attributes are handed back verbatim — naming them is the consumer's
 * decision, not this library's.
 */
export interface ITransportSearchConfiguration {
  /** href from the `atom:link` child, verbatim — pass back as `configUri`. */
  uri: string;
  /** etag from the same link, when present. */
  etag?: string;
  /** createdBy, createdAt, changedBy, changedAt, client — verbatim, no renaming. */
  attributes: Record<string, string>;
}
```

- [ ] **Step 4: Export the new types from the barrel**

In `src/index.ts`, replace:

```ts
export type {
  ICreateTransportParams,
  IListTransportsParams,
  ITransportConfig,
  ITransportState,
} from './adt/IAdtTransport';
```

with:

```ts
export type {
  ICreateTransportParams,
  IListTransportsOptions,
  IListTransportsParams,
  ITransportConfig,
  ITransportSearchConfiguration,
  ITransportState,
} from './adt/IAdtTransport';
```

- [ ] **Step 5: Run the typecheck to verify it passes**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

Expected: both PASS. The `@ts-expect-error` is now satisfied because `{}` genuinely fails to
satisfy a required `configUri`.

- [ ] **Step 6: Commit**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git add src/adt/IAdtTransport.ts src/index.ts src/__typechecks__/transportSearch.ts
git commit -m "feat(transport)!: configUri replaces the filter fields that were never read

BREAKING CHANGE: IListTransportsParams no longer carries user, status,
date_range, target_system or request_type. The endpoint never read them —
probed 2026-08-07, it answers with the same empty root with them, without
them, and with its own property spellings. It takes a required configUri
instead, and IListTransportsOptions makes it optional one level up."
```

---

### Task 2: Deferred-response connection capability

**Files:**
- Modify: `../mcp-abap-adt-interfaces/src/connection/IConnectionCapabilities.ts` (append)
- Modify: `../mcp-abap-adt-interfaces/src/index.ts:345-348`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/connectionCapabilities.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `IDeferredResponseConnection { readonly responsesAreDeferred: true }` and
  `hasDeferredResponses<T extends object>(connection: T): connection is T & IDeferredResponseConnection`.
  Task 5 implements the interface; Task 6 calls the guard.

- [ ] **Step 1: Write the compile-only assertion**

Append to `src/__typechecks__/connectionCapabilities.ts`:

```ts
// A batch recorder is a legitimate IAbapConnection whose responses arrive late.
// The atom says so; nothing in IAbapConnection can.
import {
  hasDeferredResponses,
  type IDeferredResponseConnection,
} from '../connection/IConnectionCapabilities';

const _deferring: IAbapConnection & IDeferredResponseConnection = {
  ..._sessionless,
  responsesAreDeferred: true,
};
void _deferring;

// The guard narrows whatever the caller holds, without the caller importing the
// atom's shape.
const _narrowed: IAbapConnection = _sessionless;
if (hasDeferredResponses(_narrowed)) {
  const _flag: true = _narrowed.responsesAreDeferred;
  void _flag;
}

// @ts-expect-error the flag is `true`, not `boolean`: "sometimes deferred" is not a state.
const _sometimes: IDeferredResponseConnection = { responsesAreDeferred: false };
void _sometimes;
```

- [ ] **Step 2: Run the typecheck to verify it fails**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check
```

Expected: FAIL — `hasDeferredResponses` and `IDeferredResponseConnection` are not exported
from `./connection/IConnectionCapabilities`.

- [ ] **Step 3: Add the atom and its guard**

Append to `src/connection/IConnectionCapabilities.ts`:

```ts
/**
 * A connection whose responses resolve only after a later flush.
 *
 * A batch recorder collects requests and settles their promises when the batch
 * executes. Awaiting one of those promises mid-recording deadlocks: the caller
 * is blocked inside the very code that would have reached `execute()`.
 *
 * Deferral belongs to the connection, not to how a client was configured —
 * which is why it is declared here rather than passed as an option. A consumer
 * that wraps a recorder itself, without going through the batch client, still
 * gets the guard.
 */
export interface IDeferredResponseConnection {
  /** Always `true`. "Sometimes deferred" is not a state a caller could act on. */
  readonly responsesAreDeferred: true;
}

/**
 * Whether awaiting this connection's responses is safe right now.
 *
 * Generic so the atom carries no dependency on `IAbapConnection`: it narrows
 * whatever the caller already holds.
 *
 * Not a proof of absence — a third-party connection that defers responses
 * without declaring it will still deadlock. It makes the known case honest.
 */
export function hasDeferredResponses<T extends object>(
  connection: T,
): connection is T & IDeferredResponseConnection {
  return (
    (connection as Partial<IDeferredResponseConnection>).responsesAreDeferred ===
    true
  );
}
```

- [ ] **Step 4: Export it from the barrel**

In `src/index.ts`, replace:

```ts
export type {
  AdtSessionErrorCode,
  ISessionLifecycleAware,
} from './connection/IConnectionCapabilities';
export { ADT_SESSION_ERROR } from './connection/IConnectionCapabilities';
```

with:

```ts
export type {
  AdtSessionErrorCode,
  IDeferredResponseConnection,
  ISessionLifecycleAware,
} from './connection/IConnectionCapabilities';
export {
  ADT_SESSION_ERROR,
  hasDeferredResponses,
} from './connection/IConnectionCapabilities';
```

- [ ] **Step 5: Run the typecheck and lint to verify they pass**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git add src/connection/IConnectionCapabilities.ts src/index.ts \
        src/__typechecks__/connectionCapabilities.ts
git commit -m "feat(connection): declare when a connection's responses are deferred

A batch recorder settles its response promises only at execute(). Awaiting
one mid-recording deadlocks, and nothing in IAbapConnection lets a consumer
tell the two kinds of connection apart. Adds the atom and a generic guard so
the caller narrows what it already holds."
```

---

### Task 3: Release interfaces

**Files:**
- Modify: `../mcp-abap-adt-interfaces/package.json` (version)
- Modify: `../mcp-abap-adt-interfaces/package-lock.json`
- Modify: `../mcp-abap-adt-interfaces/CHANGELOG.md`
- Modify: `../mcp-abap-adt-interfaces/README.md` and anything under `docs/` that documents
  transport parameters or connection capabilities

- [ ] **Step 1: Ask the user which version**

Do not guess. State the assessment and ask:

> `IListTransportsParams` loses five fields and gains a required one — existing callers stop
> compiling. By semver that is a major: 13.1.0 → **14.0.0**. Confirm, or name the version.

Wait for the answer before touching `package.json`.

- [ ] **Step 2: Find every document that describes the old contract**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rn "IListTransportsParams\|date_range\|target_system" README.md docs/ 2>/dev/null
```

Update each hit. A changelog entry is for someone already watching; the docs are what
everyone else reads, and a doc still describing the removed fields is worse than none.

- [ ] **Step 3: Write the CHANGELOG entry**

Under a new version heading, with a migration note:

```markdown
### Breaking

- `IListTransportsParams` now takes a single required `configUri` and no longer
  carries `user`, `status`, `date_range`, `target_system` or `request_type`.
  The endpoint never read them: probed on the trial 2026-08-07,
  `/sap/bc/adt/cts/transportrequests` answers with the same 309-byte empty root
  with them, without them, and with the configuration's own property spellings,
  while 15 requests existed on the system.

  **Migration:** obtain an href from
  `/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations` and pass
  it as `configUri`. Filtering is a property of the saved configuration, which is
  created in Eclipse. There was no server-side filtering to lose.

### Added

- `IListTransportsOptions` — the same field, optional, for the level that resolves.
- `ITransportSearchConfiguration` — one saved search: `uri`, optional `etag`, and
  its attributes verbatim.
- `IDeferredResponseConnection` and `hasDeferredResponses()` — a connection whose
  responses settle only at a later flush, so a caller can refuse to await one.
```

- [ ] **Step 4: Bump the version and the lockfile**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
npm version <agreed version> --no-git-tag-version
npm install --package-lock-only
grep -n '"link": true' package-lock.json || echo "no local links — good"
```

- [ ] **Step 5: Build and verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run build 2>&1 | tee build.log
```

Read `build.log`. Expected: clean.

- [ ] **Step 6: Commit, push, open the PR**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git add -A
git commit -m "release(<version>): transport configUri contract + deferred-response atom"
git push -u origin feat/transport-search-configuration
gh pr create --title "release(<version>): transport configUri contract + deferred-response atom" \
             --body "$(cat <<'BODY'
## What changes

`IListTransportsParams` takes a required `configUri` and loses `user`,
`status`, `date_range`, `target_system`, `request_type`.

Adds `IListTransportsOptions`, `ITransportSearchConfiguration`,
`IDeferredResponseConnection` and `hasDeferredResponses()`.

## Why

The five filter fields were never read by the server. Probed on the trial
2026-08-07: `/sap/bc/adt/cts/transportrequests` answered with the same
309-byte empty root for `?user=`, `?status=`, the configuration's own
property spellings, and no parameters at all — while 15 requests existed
and `read` returned them one by one. `?configUri=<href>` returned 137 181
bytes and 16 requests from the same system in the same minute.

## Migration

Obtain an href from
`/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations` and
pass it as `configUri`. Filtering is a property of the saved configuration,
created in Eclipse. There was no server-side filtering to lose.

Design: `mcp-abap-adt-clients/docs/superpowers/specs/2026-08-07-transport-list-and-structural-parsing-design.md`
BODY
)"
```

- [ ] **Step 7: Wait for the user's review, then merge and tag**

Merge only after the user reviews. Then:

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
gh pr merge <N> --squash --delete-branch
git checkout main && git pull --ff-only
git tag -a v<version> -m "transport configUri contract + deferred-response atom

BREAKING: IListTransportsParams takes a required configUri and loses the
five filter fields the server never read." && git push --tags
```

- [ ] **Step 8: Hand over the publish — STOP HERE**

Tell the user: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm publish`.

**Do not start Task 4 until the user confirms the version is on npm.** Verify:

```bash
npm view @mcp-abap-adt/interfaces version
```

---

## Phase B — adt-clients, the call fix (unblocked once Task 3 is published)

### Task 4: Low-level `listTransports` and `getTransportSearchConfigurations`

**Files:**
- Modify: `src/core/transport/list.ts` (rewrite)
- Create: `src/core/transport/parseSearchConfigurations.ts`
- Modify: `src/constants/contentTypes.ts:45-52`
- Modify: `src/core/transport/types.ts:6-11`
- Test: `src/__tests__/unit/core/transport/listTransports.test.ts` (create)

**Interfaces:**
- Consumes: `IListTransportsParams`, `ITransportSearchConfiguration` from Task 1.
- Produces:
  - `listTransports(connection: IAbapConnection, params: IListTransportsParams): Promise<IAdtResponse>`
  - `getTransportSearchConfigurations(connection: IAbapConnection): Promise<ITransportSearchConfiguration[]>`
  - `parseSearchConfigurations(data: unknown): ITransportSearchConfiguration[]`
  - `class TransportSearchConfigurationMissing extends Error`
  - `const TRANSPORT_SEARCH_CONFIGURATIONS_URL: string`

  Task 6 imports `getTransportSearchConfigurations`, `listTransports`,
  `TransportSearchConfigurationMissing` and `TRANSPORT_SEARCH_CONFIGURATIONS_URL`.

**First, take the new interfaces version:**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
git checkout main && git pull --ff-only
git checkout -b fix/transport-list-configuri
rm -rf node_modules/@mcp-abap-adt/interfaces
npm install @mcp-abap-adt/interfaces@<version> --save-dev
grep '"version"' node_modules/@mcp-abap-adt/interfaces/package.json
grep -n '"link": true' package-lock.json || echo "no local links — good"
```

The `grep` on `node_modules` is the check that counts: `npm view` reports the registry, not
what got installed.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/transport/listTransports.test.ts`:

```ts
/**
 * The low level requests; it does not resolve.
 *
 * `listTransports` had five filter parameters the server never read, so the call
 * returned a 309-byte empty root for two weeks while 15 requests sat on the
 * system. These fix the two halves of the replacement: one request, always, to
 * the configUri form — and a configurations reader that never guesses a shape.
 */
import type {
  IAbapConnection,
  IAdtResponse,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces';
import {
  getTransportSearchConfigurations,
  listTransports,
  parseSearchConfigurations,
} from '../../../../core/transport/list';

const CONFIGURATIONS_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<configurations:configurations xmlns:configurations="http://www.sap.com/adt/configurations">' +
  '<configuration:configuration createdBy="CB9980008038" createdAt="2026-08-07T09:50:48Z" ' +
  'changedBy="CB9980008038" changedAt="2026-08-07T09:50:48Z" client="100" ' +
  'xmlns:configuration="http://www.sap.com/adt/configuration">' +
  '<atom:link href="/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B" ' +
  'rel="http://www.sap.com/adt/categories/configurations" ' +
  'type="application/vnd.sap.adt.configuration.v1+xml" etag="20260807095048" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"/>' +
  '</configuration:configuration>' +
  '</configurations:configurations>';

const recordingConnection = (body: string) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: body,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('listTransports issues one request and never resolves', () => {
  it('puts configUri in the query, encoded', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, {
      configUri: '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests?configUri=' +
        '%2Fsap%2Fbc%2Fadt%2Fcts%2Ftransportrequests%2Fsearchconfiguration%2Fconfigurations%2F7E5B',
    );
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.transportorganizertree.v1+xml',
    );
  });

  it('never touches the configurations endpoint, whatever it is given', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, { configUri: '/x' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain('searchconfiguration');
  });

  it('refuses an empty configUri rather than sending the request that returns nothing', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await expect(
      listTransports(connection, { configUri: '' }),
    ).rejects.toThrow(/configUri/);
    expect(calls).toHaveLength(0);
  });
});

describe('parseSearchConfigurations reads the href off the link, not the element', () => {
  it('reads uri, etag and the element attributes verbatim', () => {
    const configurations = parseSearchConfigurations(CONFIGURATIONS_XML);

    expect(configurations).toEqual([
      {
        uri: '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
        etag: '20260807095048',
        attributes: {
          createdBy: 'CB9980008038',
          createdAt: '2026-08-07T09:50:48Z',
          changedBy: 'CB9980008038',
          changedAt: '2026-08-07T09:50:48Z',
          client: '100',
        },
      },
    ]);
  });

  it('returns none for a system with no saved configuration', () => {
    expect(
      parseSearchConfigurations(
        '<configurations:configurations xmlns:configurations="c"/>',
      ),
    ).toEqual([]);
  });

  it('returns none for an empty body rather than throwing', () => {
    expect(parseSearchConfigurations('')).toEqual([]);
    expect(parseSearchConfigurations(undefined)).toEqual([]);
  });

  it('drops a configuration with no href, since it cannot be addressed', () => {
    const xml =
      '<configurations:configurations xmlns:configurations="c">' +
      '<configuration:configuration client="100" xmlns:configuration="k"/>' +
      '</configurations:configurations>';

    expect(parseSearchConfigurations(xml)).toEqual([]);
  });
});

describe('getTransportSearchConfigurations', () => {
  it('asks the configurations endpoint with its own content type', async () => {
    const { connection, calls } = recordingConnection(CONFIGURATIONS_XML);

    const configurations = await getTransportSearchConfigurations(connection);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations',
    );
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.configurations.v1+xml',
    );
    expect(configurations).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/listTransports.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `getTransportSearchConfigurations` and `parseSearchConfigurations` are not
exported from `core/transport/list`.

- [ ] **Step 3: Add the configurations content type**

In `src/constants/contentTypes.ts`, after `ACCEPT_TRANSPORT_LIST`:

```ts
export const ACCEPT_TRANSPORT_CONFIGURATIONS =
  'application/vnd.sap.adt.configurations.v1+xml';
```

- [ ] **Step 4: Write the configurations parser**

Create `src/core/transport/parseSearchConfigurations.ts`:

```ts
/**
 * Read the saved transport search configurations.
 *
 * Exactly as much parsing as it takes to address a configuration: its href, its
 * etag, and its own attributes handed back unrenamed. What any of those mean is
 * the consumer's business.
 */

import type { ITransportSearchConfiguration } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

const asArray = (value: unknown): Record<string, unknown>[] => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]) as Record<string, unknown>[];
};

/**
 * Read an attribute whether or not ADT namespace-qualifies it.
 *
 * The same reason `parseSearchResults` does this: releases differ on whether
 * these attributes carry a prefix, and pinning one spelling returns empty
 * strings on a system using the other.
 */
const attr = (
  node: Record<string, unknown>,
  name: string,
): string | undefined => {
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_')) continue;
    const bare = key.slice(2).split(':').pop();
    if (bare !== name) continue;
    const text = String(node[key]).trim();
    return text.length > 0 ? text : undefined;
  }
  return undefined;
};

const ownAttributes = (
  node: Record<string, unknown>,
): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (!key.startsWith('@_')) continue;
    const name = key.slice(2);
    // Namespace declarations describe the document, not the configuration.
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    attributes[name] = String(node[key]);
  }
  return attributes;
};

export function parseSearchConfigurations(
  data: unknown,
): ITransportSearchConfiguration[] {
  const xml = typeof data === 'string' ? data.trim() : '';
  if (xml === '') {
    return [];
  }

  const parsed = xmlParser.parse(xml) as Record<string, unknown>;
  const root = (parsed['configurations:configurations'] ??
    parsed.configurations) as Record<string, unknown> | undefined;
  if (!root) {
    return [];
  }

  const nodes = asArray(
    root['configuration:configuration'] ?? root.configuration,
  );

  const configurations: ITransportSearchConfiguration[] = [];
  for (const node of nodes) {
    const links = asArray(node['atom:link'] ?? node.link);
    const self = links.find((link) => attr(link, 'href') !== undefined);
    const uri = self ? attr(self, 'href') : undefined;
    // A configuration we cannot address is not one we can search with.
    if (!uri) continue;

    const configuration: ITransportSearchConfiguration = {
      uri,
      attributes: ownAttributes(node),
    };
    const etag = self ? attr(self, 'etag') : undefined;
    if (etag) {
      configuration.etag = etag;
    }
    configurations.push(configuration);
  }
  return configurations;
}
```

- [ ] **Step 5: Nothing to write — the error type lives in interfaces**

`TransportSearchConfigurationMissing` and `TRANSPORT_SEARCH_CONFIGURATIONS_URL` are declared
in `@mcp-abap-adt/interfaces`, not here: a consumer catches the error and may want the URL to
fetch a `configUri` itself, and anything a consumer imports to use the library belongs in the
contract package. They ship in the same interfaces release as Tasks 1–2 — see
`2026-08-07-interfaces-contract-consolidation.md`, Task 8 Step 1.

Their declarations, for reference while writing the interfaces side:

```ts
// @mcp-abap-adt/interfaces — src/adt/IAdtTransport.ts
export const TRANSPORT_SEARCH_CONFIGURATIONS_URL =
  '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations';

/**
 * A system with no saved transport search has nothing for `list()` to run.
 *
 * Named rather than a bare Error because a caller may reasonably want to react
 * to it — by creating a configuration in Eclipse, or by supplying a configUri
 * it already knows.
 */
export class TransportSearchConfigurationMissing extends Error {
  constructor(public readonly endpoint: string) {
    super(
      'No transport search configuration exists on this system. The transport ' +
        'list is a saved-configuration search, so there is nothing to run: create ' +
        'a configuration in Eclipse, or pass configUri explicitly. Configurations ' +
        `live at ${endpoint}`,
    );
    this.name = 'TransportSearchConfigurationMissing';
  }
}
```

- [ ] **Step 6: Rewrite `list.ts`**

Replace the whole of `src/core/transport/list.ts`:

```ts
/**
 * Transport list operations — the low level.
 *
 * One request per function, always. Resolving which saved search to run is the
 * high level's job (`AdtRequest`), because it needs a response to do it and
 * that is precisely what a batch connection cannot supply mid-recording.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  IListTransportsParams,
  ITransportSearchConfiguration,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_TRANSPORT_CONFIGURATIONS,
  ACCEPT_TRANSPORT_LIST,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import { TRANSPORT_SEARCH_CONFIGURATIONS_URL } from '@mcp-abap-adt/interfaces';
import { parseSearchConfigurations } from './parseSearchConfigurations';

export { parseSearchConfigurations };

/**
 * List ABAP transport requests for a saved search.
 *
 * `configUri` is required and is used verbatim. Sending filter parameters
 * instead returns an empty root — the search must be referenced, not restated.
 */
export async function listTransports(
  connection: IAbapConnection,
  params: IListTransportsParams,
): Promise<IAdtResponse> {
  if (!params.configUri) {
    throw new Error(
      'listTransports requires configUri: the transport list is a saved-configuration ' +
        `search. Obtain an href from ${TRANSPORT_SEARCH_CONFIGURATIONS_URL}`,
    );
  }

  const url = `/sap/bc/adt/cts/transportrequests?configUri=${encodeURIComponent(
    params.configUri,
  )}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT_LIST },
  });
}

/** The saved transport searches this system holds. One request, parsed. */
export async function getTransportSearchConfigurations(
  connection: IAbapConnection,
): Promise<ITransportSearchConfiguration[]> {
  const response = await connection.makeAdtRequest({
    url: TRANSPORT_SEARCH_CONFIGURATIONS_URL,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT_CONFIGURATIONS },
  });

  return parseSearchConfigurations(response.data);
}
```

**Leave `src/core/transport/types.ts` alone.** It already re-exports `IListTransportsParams`,
which still exists, so it keeps compiling — and the new types are imported straight from
`@mcp-abap-adt/interfaces` where they are used. Adding them to that barrel would widen a
re-export the project deliberately avoids.

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/listTransports.test.ts 2>&1 | tee unit-run.log
```

Expected: PASS, 9 tests.

- [ ] **Step 8: Commit**

```bash
git add src/core/transport/list.ts src/core/transport/parseSearchConfigurations.ts \
        src/constants/contentTypes.ts \
        src/__tests__/unit/core/transport/listTransports.test.ts
git commit -m "fix(transport)!: list by configUri, the only form that returns requests

BREAKING CHANGE: listTransports takes configUri instead of the five filter
parameters. Those were never read: the endpoint answered with the same
309-byte empty root with them and without them while 15 requests existed.
Adds getTransportSearchConfigurations to find an href to pass."
```

---

### Task 5: `BatchRecordingConnection` declares its responses deferred

**Files:**
- Modify: `src/batch/BatchRecordingConnection.ts:13-20`
- Test: `src/__tests__/unit/batch/deferredResponses.test.ts` (create)

**Interfaces:**
- Consumes: `IDeferredResponseConnection` from Task 2.
- Produces: `BatchRecordingConnection.responsesAreDeferred === true`. Task 6's guard reads it.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/batch/deferredResponses.test.ts`:

```ts
/**
 * The recorder says out loud that its responses arrive late.
 *
 * Without this, a handler holding an IAbapConnection cannot tell a batch
 * recorder from a live connection, and code that awaits a response to build the
 * next request deadlocks instead of failing.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { hasDeferredResponses } from '@mcp-abap-adt/interfaces';
import { BatchRecordingConnection } from '../../../batch/BatchRecordingConnection';

const stubConnection = {
  connect: async () => {},
  getBaseUrl: async () => 'https://example',
  getSessionId: () => null,
  setSessionType: () => {},
  makeAdtRequest: async () => ({
    data: '',
    status: 200,
    statusText: 'OK',
    headers: {},
  }),
} as unknown as IAbapConnection;

describe('a batch recorder declares its deferral', () => {
  it('is recognised by the capability guard', () => {
    const recorder = new BatchRecordingConnection(stubConnection);

    expect(hasDeferredResponses(recorder)).toBe(true);
  });

  it('leaves an ordinary connection unmarked', () => {
    expect(hasDeferredResponses(stubConnection)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/batch/deferredResponses.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `hasDeferredResponses(recorder)` is `false`.

- [ ] **Step 3: Declare the capability**

In `src/batch/BatchRecordingConnection.ts`, change the imports and the class head:

```ts
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtResponse,
  IDeferredResponseConnection,
} from '@mcp-abap-adt/interfaces';
import type { IBatchRequestPart, IBatchResponsePart } from './types';

interface IDeferredResponse {
  resolve: (value: IAdtResponse) => void;
  reject: (reason: Error) => void;
}

export class BatchRecordingConnection
  implements IAbapConnection, IDeferredResponseConnection
{
  /**
   * Responses here settle only when `execute()` flushes the batch. Anything
   * that awaits one mid-recording deadlocks — the caller is blocked inside the
   * code that would have reached `execute()`.
   */
  readonly responsesAreDeferred = true as const;

  private realConnection: IAbapConnection;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/batch/deferredResponses.test.ts 2>&1 | tee unit-run.log
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/batch/BatchRecordingConnection.ts src/__tests__/unit/batch/deferredResponses.test.ts
git commit -m "feat(batch): the recorder declares that its responses are deferred"
```

---

### Task 6: `AdtRequest.list()` — resolution and the batch guard

**Files:**
- Modify: `src/core/transport/AdtRequest.ts:22-36` (imports), `:150-169` (`list`)
- Test: `src/__tests__/unit/core/transport/listResolution.test.ts` (create)

**Interfaces:**
- Consumes: `IListTransportsOptions`, `hasDeferredResponses` (Tasks 1–2);
  `listTransports`, `getTransportSearchConfigurations`,
  `TRANSPORT_SEARCH_CONFIGURATIONS_URL`, `TransportSearchConfigurationMissing` (Task 4);
  `responsesAreDeferred` (Task 5).
- Produces: `AdtRequest.list(options?: IListTransportsOptions): Promise<ITransportState>` and
  `protected resolveSearchConfiguration(): Promise<string>`. Task 7 overrides `list`.

**Deliberate narrowing of the spec's rule, flagged for the reviewer.** The spec lists four
branches, one of them "several, one marked default → use the marked one". This task
implements three: one → use it, none → throw, several → throw. The default branch is left
out because implementing it means guessing which attribute marks a default, and the captured
payload has no such attribute — a system with exactly one configuration cannot show what
several would look like. The spec sanctions this: *"If it does not, the 'several' case
collapses into 'always throw unless explicit', which is still deterministic; the rule does
not change, only how often the error fires."* Add the branch when a system with several
configurations has actually been read.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/transport/listResolution.test.ts`:

```ts
/**
 * Which saved search runs when the caller names none — and when we must refuse
 * to look it up at all.
 *
 * The refusal has a shape that is easy to get wrong in the safe-looking
 * direction: guarding before reading the explicit configUri rejects every batch
 * call, including the one that works. Both sides are asserted here for that
 * reason.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtRequest } from '../../../../core/transport/AdtRequest';

const CONFIGURATIONS = (...uris: string[]) =>
  '<configurations:configurations xmlns:configurations="c">' +
  uris
    .map(
      (uri) =>
        '<configuration:configuration client="100" xmlns:configuration="k">' +
        `<atom:link href="${uri}" xmlns:atom="a"/>` +
        '</configuration:configuration>',
    )
    .join('') +
  '</configurations:configurations>';

const connectionOver = (
  bodyFor: (url: string) => string,
  extra: Record<string, unknown> = {},
) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: bodyFor(options.url),
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtResponse;
    },
    ...extra,
  } as unknown as IAbapConnection;
  return { connection, calls };
};

const bodies = (configurationsXml: string) => (url: string) =>
  url.includes('searchconfiguration') ? configurationsXml : '<tm:root/>';

describe('resolving a search configuration', () => {
  it('uses an explicit configUri and asks for no configurations at all', async () => {
    const { connection, calls } = connectionOver(bodies(CONFIGURATIONS('/a')));

    await new AdtRequest(connection).list({ configUri: '/explicit' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('configUri=%2Fexplicit');
  });

  it('uses the only configuration when the caller names none', async () => {
    const { connection, calls } = connectionOver(bodies(CONFIGURATIONS('/only')));

    await new AdtRequest(connection).list();

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('searchconfiguration');
    expect(calls[1].url).toContain('configUri=%2Fonly');
  });

  it('refuses to choose between several, naming them', async () => {
    const { connection } = connectionOver(bodies(CONFIGURATIONS('/a', '/b')));

    await expect(new AdtRequest(connection).list()).rejects.toThrow(/\/a.*\/b/s);
  });

  it('names the endpoint when the system has no configuration', async () => {
    const { connection } = connectionOver(bodies(CONFIGURATIONS()));

    await expect(new AdtRequest(connection).list()).rejects.toThrow(
      /searchconfiguration\/configurations/,
    );
  });
});

describe('the batch guard', () => {
  const deferred = { responsesAreDeferred: true };

  it('lets an explicit configUri through and records one request', async () => {
    const { connection, calls } = connectionOver(
      bodies(CONFIGURATIONS('/a')),
      deferred,
    );

    await new AdtRequest(connection).list({ configUri: '/explicit' });

    expect(calls).toHaveLength(1);
  });

  it('refuses to resolve, rather than hanging, when no configUri is given', async () => {
    const { connection, calls } = connectionOver(
      bodies(CONFIGURATIONS('/a')),
      deferred,
    );

    const started = Date.now();
    await expect(new AdtRequest(connection).list()).rejects.toThrow(
      /configUri is required on a batch client/,
    );

    // A deadlock would surface as a timeout, which reads like a slow pass.
    expect(Date.now() - started).toBeLessThan(1000);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/listResolution.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — `list()` still requires `{ user }` and never reads configurations.

- [ ] **Step 3: Update the imports in `AdtRequest.ts`**

Replace the import block at the top of `src/core/transport/AdtRequest.ts`:

```ts
import {
  hasDeferredResponses,
  TRANSPORT_SEARCH_CONFIGURATIONS_URL,
  TransportSearchConfigurationMissing,
  type HttpError,
  type IAbapConnection,
  type IAdtObject,
  type IAdtOperationOptions,
  type IListTransportsOptions,
  type ILogger,
  type IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import { throwUnsupportedVersions } from '../shared/versions';
import { createTransport } from './create';
import { getTransportSearchConfigurations, listTransports } from './list';
import { getTransport } from './read';
import type { ITransportConfig, ITransportState } from './types';
```

- [ ] **Step 4: Replace `list()` and add the resolver**

Replace the whole `list()` method:

```ts
  /**
   * List transport requests.
   *
   * With `configUri`: one request. Without: two — the configurations, then the
   * list. The five filter parameters this used to take were never read by the
   * server; filtering is a property of the saved configuration.
   */
  async list(options?: IListTransportsOptions): Promise<ITransportState> {
    const configUri =
      options?.configUri ?? (await this.resolveSearchConfiguration());

    this.logger?.info?.('Listing transport requests', { configUri });
    const response = await listTransports(this.connection, { configUri });

    return { listResult: response, errors: [] };
  }

  /**
   * Which saved search to run when the caller named none.
   *
   * Deterministic or it throws — never "the first one", which would silently
   * run somebody else's filters.
   *
   * The deferred-connection check lives HERE and not in `list()`: an explicit
   * `configUri` waits for nothing, so a batch call that supplies one is
   * legitimate. Guarding earlier would reject it.
   */
  protected async resolveSearchConfiguration(): Promise<string> {
    if (hasDeferredResponses(this.connection)) {
      throw new Error(
        'configUri is required on a batch client: resolving a search ' +
          'configuration needs a response that a batch cannot deliver until ' +
          'execute().',
      );
    }

    const configurations = await getTransportSearchConfigurations(
      this.connection,
    );

    if (configurations.length === 0) {
      throw new TransportSearchConfigurationMissing(
        TRANSPORT_SEARCH_CONFIGURATIONS_URL,
      );
    }

    if (configurations.length === 1) {
      return configurations[0].uri;
    }

    // Several. Picking one would mean guessing which attribute marks a default,
    // and the payload on the only system we have carries no such marker — one
    // configuration cannot show what several would look like. So: say so, and
    // let the caller choose. This branch gets a rule when a system with several
    // configurations has actually been read.
    throw new Error(
      `This system has ${configurations.length} transport search configurations ` +
        'and none can be shown to be the default; pass configUri explicitly. ' +
        `Available: ${configurations.map((c) => c.uri).join(', ')}`,
    );
  }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/listResolution.test.ts 2>&1 | tee unit-run.log
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/transport/AdtRequest.ts src/__tests__/unit/core/transport/listResolution.test.ts
git commit -m "fix(transport)!: resolve a saved search when list() is given no configUri

BREAKING CHANGE: list() takes IListTransportsOptions — { configUri? } — and
no longer accepts user/status/dateRange/targetSystem/requestType.

The deferred-connection guard sits inside resolution rather than at the top
of list(): an explicit configUri awaits nothing, so a batch call that
supplies one is legitimate and must not be rejected."
```

---

### Task 7: `AdtRequestLegacy` overrides `list()`

**Files:**
- Modify: `src/core/transport/AdtRequestLegacy.ts:15-24` (imports), append the override
- Test: `src/__tests__/unit/core/transport/legacyList.test.ts` (create)

**Interfaces:**
- Consumes: `AdtRequest.list` (Task 6), `listTransportsLegacy` from `./readLegacy`.
- Produces: `AdtRequestLegacy.list(options?): Promise<ITransportState>`.

Background: `AdtRequestLegacy` inherits `list()` today, so on a legacy system it calls
`/sap/bc/adt/cts/...` which is not there — while `listTransportsLegacy()`, pointing at
`/sap/bc/cts/transportrequests`, has sat unused since it was written.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/transport/legacyList.test.ts`:

```ts
/**
 * The legacy handler must use the legacy path.
 *
 * It inherited list() and therefore called /sap/bc/adt/cts on systems that do
 * not have it, while listTransportsLegacy() — written for exactly this — was
 * never called from anywhere.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtRequestLegacy } from '../../../../core/transport/AdtRequestLegacy';

const recordingConnection = () => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: '<tm:root/>',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('legacy transport list', () => {
  it('calls the legacy CTS path, not the ADT one', async () => {
    const { connection, calls } = recordingConnection();

    const state = await new AdtRequestLegacy(connection).list();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/cts/transportrequests');
    expect(state.listResult).toBeDefined();
    expect(state.errors).toEqual([]);
  });

  it('rejects configUri instead of silently ignoring it', async () => {
    const { connection, calls } = recordingConnection();

    await expect(
      new AdtRequestLegacy(connection).list({ configUri: '/x' }),
    ).rejects.toThrow(/not supported on legacy/);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/legacyList.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — the inherited `list()` calls `/sap/bc/adt/cts/transportrequests` after
first requesting the configurations.

- [ ] **Step 3: Add the override**

In `src/core/transport/AdtRequestLegacy.ts`, extend the imports:

```ts
import type {
  HttpError,
  IAbapConnection,
  IAdtOperationOptions,
  IListTransportsOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { AdtRequest } from './AdtRequest';
import { getTransportLegacy, listTransportsLegacy } from './readLegacy';
import type { ITransportConfig, ITransportState } from './types';
```

and append this method to the class, after `read()`:

```ts
  /**
   * List transport requests (legacy path).
   *
   * `/sap/bc/cts/transportrequests` returns the full list for the current user.
   * It is not a saved-configuration search, so there is no configUri to pass —
   * and accepting one silently would report a filter that never applied.
   */
  override async list(
    options?: IListTransportsOptions,
  ): Promise<ITransportState> {
    if (options?.configUri) {
      throw new Error(
        'configUri is not supported on legacy SAP systems: ' +
          '/sap/bc/cts/transportrequests is not a saved-configuration search and ' +
          'always returns the full list for the current user.',
      );
    }

    const response = await listTransportsLegacy(this.conn);
    return { listResult: response, errors: [] };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/legacyList.test.ts 2>&1 | tee unit-run.log
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Run the whole unit suite and the type check**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
npm run test:check 2>&1 | tee typecheck.log
npm run build 2>&1 | tee build.log
```

Read each log. Expected: all clean. If `publicApiSurface.test.ts` or `subpathExports.test.ts`
fails, a barrel needs the new symbol — fix the barrel, not the test.

- [ ] **Step 6: Commit**

```bash
git add src/core/transport/AdtRequestLegacy.ts src/__tests__/unit/core/transport/legacyList.test.ts
git commit -m "fix(transport): legacy list() uses the legacy CTS path

listTransportsLegacy() had never been called from anywhere; the legacy
handler inherited list() and hit /sap/bc/adt/cts on systems without it."
```

---

### Task 8: Integration test over the raw response

**Files:**
- Modify: `src/__tests__/integration/core/transport/Transport.test.ts:242-281`

**Interfaces:**
- Consumes: `AdtRequest.list` (Task 6).
- Produces: nothing further tasks rely on.

This asserts on `listResult.data` only. Recognising a *shape* needs the parser, which does
not exist until step E — that test is written in the follow-up plan.

- [ ] **Step 1: Replace the list test**

Replace the whole `describe('List transports', ...)` block:

```ts
  describe('List transports', () => {
    it(
      'should list transport requests through a saved search configuration',
      async () => {
        logTestStart(testsLogger, 'AdtRequest - list transports', {
          name: 'list_transports',
          params: {},
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'AdtRequest - list transports',
            'No SAP configuration',
          );
          return;
        }

        try {
          logTestStep('list', testsLogger);
          const listState = await client.getRequest().list();

          expect(listState.errors.length).toBe(0);
          expect(listState.listResult).toBeDefined();

          // Assert on the BODY, not on its presence. The previous assertion was
          // `listResult).toBeDefined()`, which an empty root passes — which is
          // why a call that returned no requests at all went unnoticed from
          // 2026-07-20 until 2026-08-07.
          const body = String(listState.listResult?.data ?? '');
          expect(body).toContain('tm:root');

          const requestCount = (body.match(/<tm:request /g) ?? []).length;
          logTestStep(`requests returned: ${requestCount}`, testsLogger);

          // A system holding no transport requests is a verified case, not an
          // absent one: it must state which case it saw rather than skip.
          if (requestCount === 0) {
            expect(body).toMatch(/<tm:root[^>]*\/>|<\/tm:root>/);
          }

          logTestSuccess(testsLogger, 'AdtRequest - list transports');
        } catch (error: any) {
          logTestError(testsLogger, 'AdtRequest - list transports', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'AdtRequest - list transports');
        }
      },
      getTimeout('test'),
    );
  });
```

- [ ] **Step 2: Type-check the tests without running them**

```bash
npm run test:check:integration 2>&1 | tee typecheck.log
```

Expected: clean.

- [ ] **Step 3: Warn the user before the SAP run**

The trial integration tests need a live token and a browser with the right profile. Say so
and wait — do not launch a SAP-touching run unannounced, and make sure no other run is in
flight.

- [ ] **Step 4: Run the transport integration tests**

```bash
npm test -- integration/core/transport 2>&1 | tee test-run.log
```

Read `test-run.log` in full. Expected: the list test passes and prints a non-zero
`requests returned:` line on the trial, which currently holds 16.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/integration/core/transport/Transport.test.ts
git commit -m "test(transport): assert the list body, not that a response object exists

toBeDefined() passes over a 309-byte empty root, which is how a call that
never returned a single request stayed green for two weeks."
```

**Known, out of scope:** the create test in this file makes a transport request per run and
never removes it — 11 have accumulated since 2026-07-20. `AdtRequest.delete()` throws
"not supported", which is itself a defect: ADT does delete an *empty* request via
`DELETE /cts/transportrequests/<NR>`. Fixing the stub is separate work; do not fold it in
here, and do not pretend the accumulation is addressed.

---

### Task 9: Release adt-clients

**Files:**
- Modify: `package.json`, `package-lock.json`, `CHANGELOG.md`
- Modify: `README.md`, `docs/usage/CLIENT_API_REFERENCE.md`, and every other document that
  describes `list()`

- [ ] **Step 1: Find every document that describes the old contract**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
grep -rn "listTransports\|getRequest().list\|dateRange\|targetSystem" \
  README.md docs/ 2>/dev/null | tee docs-hits.log
```

Read `docs-hits.log` and update every hit. A release updates **all** the documentation the
change touches, not only the changelog: a doc still describing the removed parameters is
worse than no doc, because it is believed.

- [ ] **Step 2: Ask the user which version**

> `list()` and `listTransports()` change shape and old calls stop compiling — a major by
> semver: 10.1.0 → **11.0.0**. Confirm, or name the version.

Wait for the answer.

- [ ] **Step 3: Write the CHANGELOG entry with a migration note**

```markdown
### Breaking

- `getRequest().list()` takes `{ configUri? }` and no longer accepts `user`,
  `status`, `dateRange`, `targetSystem` or `requestType`; `listTransports()`
  takes a required `configUri`.

  The call had never returned a transport request since it was added in #7. The
  ADT transport list is a saved-configuration search: probed 2026-08-07,
  `/sap/bc/adt/cts/transportrequests` answers with the same 309-byte empty root
  for every filter form and for none, while `?configUri=<href>` returned 137 KB
  and 16 requests on the same system at the same moment.

  **Migration:** call `list()` with no arguments — the client resolves the saved
  configuration itself when the system has exactly one — or pass `configUri`
  explicitly. Filtering is a property of the configuration, created in Eclipse.
  There was no server-side filtering to lose.

  On a batch client `configUri` is **required**: resolving it needs a response
  the batch cannot deliver until `execute()`.

### Added

- `getTransportSearchConfigurations()` — the saved searches a system holds.
- `TransportSearchConfigurationMissing` — thrown, naming the endpoint, when a
  system has none.

### Fixed

- `AdtRequestLegacy.list()` now calls `/sap/bc/cts/transportrequests` instead of
  the ADT path legacy systems do not have.
```

- [ ] **Step 4: Bump, relock, build, full unit suite**

```bash
npm version <agreed version> --no-git-tag-version
npm install --package-lock-only
grep -n '"link": true' package-lock.json || echo "no local links — good"
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
```

Read both logs.

- [ ] **Step 5: Push and open the PR**

```bash
git add -A
git commit -m "release(<version>): transport list by configUri (BREAKING)"
git push -u origin fix/transport-list-configuri
gh pr create --title "release(<version>): transport list by configUri (BREAKING)" \
             --body "$(cat <<'BODY'
## The defect

`getRequest().list()` has never returned a transport request since #7 added
it, and `Transport.test.ts` stayed green because it asserted only
`listResult).toBeDefined()` — which an empty root passes.

## Evidence, trial system, 2026-08-07

| probe | result |
|---|---|
| `create` a request | `TRLK900494`, `errors: []` |
| `read` it back | HTTP 200, 10.6 KB |
| requests on the system | 15 |
| `?user=`, `?status=`, user GUID, server property spellings, no parameters | empty root, 309 bytes, every time |
| `?configUri=<href>` | 137 181 bytes, 16 × `tm:request` |

The transport list is a saved-configuration search: reference the search,
do not restate it.

## What changes

- `listTransports()` takes a required `configUri`; `list()` takes
  `{ configUri? }` and resolves the saved configuration when omitted.
- `getTransportSearchConfigurations()` is new.
- `AdtRequestLegacy.list()` now uses `/sap/bc/cts/transportrequests`;
  `listTransportsLegacy()` had never been called from anywhere.
- On a batch client `configUri` is required — resolving it needs a response
  the batch cannot deliver until `execute()`. The guard sits inside
  resolution, so `list({ configUri })` on a batch still works.

## Migration

`list()` with no arguments, or an explicit `configUri`. Filtering is a
property of the configuration, created in Eclipse; there was no server-side
filtering to lose.

Design: `docs/superpowers/specs/2026-08-07-transport-list-and-structural-parsing-design.md`
BODY
)"
```

- [ ] **Step 6: Wait for the user's review, then merge, tag, hand over**

```bash
gh pr merge <N> --squash --delete-branch
git checkout main && git pull --ff-only
git tag -a v<version> -m "transport list by configUri (BREAKING)

list() had never returned a transport request. The endpoint is a
saved-configuration search; the five filter parameters were never read." \
  && git push --tags
```

Then stop and tell the user: `npm publish`.

---

## Phase C — the evidence gate

### Task 10: Capture the tree body in full

**Files:**
- Run: `/tmp/claude-1000/-home-okyslytsia-prj-mcp-abap-adt-clients/83b01344-11fe-4387-8a06-e86e0b14fe85/scratchpad/capture-tree.js` (already written)
- Produce: `/tmp/claude-1000/-home-okyslytsia-prj-mcp-abap-adt-clients/83b01344-11fe-4387-8a06-e86e0b14fe85/scratchpad/capture/04-tree-configUri.xml` and its siblings

This blocks steps D and E and nothing else. It needs a live SAP token; as of 2026-08-07 the
one in `.env` expired on 2026-07-31.

- [ ] **Step 1: Confirm the token is live**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
node -e "
require('dotenv').config({path:'.env'});
const p=(process.env.SAP_JWT_TOKEN||'').split('.')[1];
if(!p){console.log('no jwt');process.exit(0);}
const c=JSON.parse(Buffer.from(p,'base64url').toString());
console.log('expires:', new Date(c.exp*1000).toISOString(), 'expired:', Date.now()>c.exp*1000);
"
```

If expired, ask the user to refresh `.env` and stop. Do not print the token.

- [ ] **Step 2: Run the capture**

```bash
node /tmp/claude-1000/-home-okyslytsia-prj-mcp-abap-adt-clients/83b01344-11fe-4387-8a06-e86e0b14fe85/scratchpad/capture-tree.js 2>&1 | tee /tmp/claude-1000/-home-okyslytsia-prj-mcp-abap-adt-clients/83b01344-11fe-4387-8a06-e86e0b14fe85/scratchpad/capture.log
```

Expected: eight files written, `04-tree-configUri.xml` around 137 KB.

- [ ] **Step 3: Answer the four open questions from the file, not from memory**

```bash
cd /tmp/claude-1000/-home-okyslytsia-prj-mcp-abap-adt-clients/83b01344-11fe-4387-8a06-e86e0b14fe85/scratchpad/capture
echo "tm:task        : $(grep -o 'tm:task ' 04-tree-configUri.xml | wc -l)"
echo "tm:request     : $(grep -o '<tm:request ' 04-tree-configUri.xml | wc -l)"
echo "containers     :"; grep -o '<tm:[a-z_]*' 04-tree-configUri.xml | sort | uniq -c
```

Record the counts in the spec's evidence table, replacing the four **open** rows. Commit that
edit to `main` directly — it is a spec, not code.

- [ ] **Step 4: Write the follow-up plan**

With the fixture in hand, the type is derivable. Write
`docs/superpowers/plans/<date>-transport-tree-parsing.md` covering spec steps D and E, using
the writing-plans skill again.

---

## Phase G — independent of everything above

### Task 11: Rewrite issue #105

**Files:** none in this repo.

- [ ] **Step 1: Read what the issue currently claims**

```bash
gh issue view 105 --repo fr0ster/mcp-abap-adt-clients
```

- [ ] **Step 2: Correct the causal claim, keep the tree**

The issue's reconstructed tree is **right** and is now confirmed by capture — leave it. Its
"What it cost" section attributes `fr0ster/mcp-abap-adt#168` to a consumer parser assuming
the wrong nesting; the evidence contradicts that. There was no `tm:request` in the response
at any depth, so no parser could have found one: the request was built wrong, upstream of
parsing.

Save the current body, edit that section, and post it back:

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
gh issue view 105 --repo fr0ster/mcp-abap-adt-clients --json body -q .body > /tmp/issue-105.md
```

Replace the "What it cost" section in `/tmp/issue-105.md` with:

```markdown
## What it cost — corrected 2026-08-07

The original text blamed a consumer parser for assuming the wrong nesting.
That is not what happened, and the correction matters because the wrong
cause points at the wrong repository.

`GET /sap/bc/adt/cts/transportrequests` with the parameters this library
sent returns a 309-byte `<tm:root/>` — no `tm:request` at any depth, so no
parser could have found one. The list is a saved-configuration search:
`?configUri=<href>` returned 137 181 bytes and 16 requests from the same
system in the same minute.

The nesting reconstructed above is correct and has since been captured
directly. Only the attributed cause was wrong.

Fixed in adt-clients by referencing the configuration; design in
`docs/superpowers/specs/2026-08-07-transport-list-and-structural-parsing-design.md`.
```

```bash
gh issue edit 105 --repo fr0ster/mcp-abap-adt-clients --body-file /tmp/issue-105.md
```

---

## What this plan does not contain

Spec steps **D** (interfaces release B: `ITransportTree`, `TransportTreeParser`) and **E**
(`parseTransportTree`, `listNodes()`, the injected parser) are absent on purpose.

Both need `ITransportTree`, and the spec is explicit that the type is derived from the
captured payload rather than declared ahead of it. Writing those tasks now would mean putting
invented field names — `tasks`, `container.target` — into a plan, which is the exact failure
the spec exists to prevent: an earlier draft did precisely that on the strength of a
1 800-character excerpt, and the fields did not survive contact with the evidence.

Task 10 produces the fixture; the follow-up plan is written from it.

Everything in Phases A, B and G is independent of that capture and can be completed now.
