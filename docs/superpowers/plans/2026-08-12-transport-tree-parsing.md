# Transport Tree Parsing — Implementation Plan (spec steps D and E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `getRequest()` a typed view of the transport tree — requests, their tasks, and
the containers they were nested under — without the library deciding which fields matter.

**Architecture:** Four types in `@mcp-abap-adt/interfaces`, one pure parser in adt-clients, and
`listNodes()` with an optional call-site parser so a consumer whose payload differs still gets
a type rather than raw XML.

**The governing rule — what the implementation does is what the consumer gets.** The type
declares exactly what the parser produces, never more. Concretely, and enforced by the
typecheck in Task 1:

- `containers` and `tasks` are **required**, not optional — the parser always builds them, an
  empty list when there is nothing, so a `?` would describe a state that cannot occur.
- `attributes` is `Record<string, string | undefined>` with no named field. Declaring
  `tm:number` as a required property would promise something the parser cannot guarantee on a
  shape we have not seen. The `| undefined` is not decoration: `noUncheckedIndexedAccess` is
  **not** set in either repo, so a plain `Record<string, string>` types every missing key as
  `string` — a lie the compiler would help tell.
- **Nothing on the root, a request or a task is dropped** — the root's own attributes, every
  `atom:link`, every `tm:long_desc`. That is the guarantee, stated at the scope it actually
  holds: the parser walks root → containers → requests → tasks, so an element outside that
  walk is out of scope, not silently discarded. An earlier draft
  skipped both as noise; the fixtures hold **233 links and 16 long_desc**, and the links carry
  the operation URIs — `release`, `newreleasejobs`, `addobject`, `changeowner`, `merge`,
  `protectrequest`, `newtask`, `reassign`, `consistencycheck`. A consumer that wants to
  release a transport would otherwise have to rebuild those URLs by convention, which is
  exactly the ADT knowledge this library exists to hold.
- With a caller's parser, `listNodes(myParse)` returns `T` as inferred from `myParse` —
  unwrapped, unvalidated, uncoerced. What that parser built is what the caller gets; our part
  ends at handing it the raw body.

**Tech Stack:** TypeScript (strict, CommonJS), Jest, Biome, `fast-xml-parser`.

**Spec:** `docs/superpowers/specs/2026-08-07-transport-list-and-structural-parsing-design.md`
— steps A, B, C are done and sit unreleased on `feat/11.0.0-contract-and-transport`. This plan
is D and E, and **11.0.0 does not ship until they land** (maintainer's decision, 2026-08-12).

## Global Constraints

- All repository artifacts in **English**.
- Types live in `@mcp-abap-adt/interfaces` and are imported; never redefined locally.
- **Publish the dependency first.** interfaces must be on npm before adt-clients imports it.
  No `file:`, no tarball, no `"link": true` — verify after every `npm install`.
- Claude opens PRs, merges **reviewed** PRs, tags. `npm publish` is the user's.
- Biome: single quotes, semicolons, 2-space indent. `npm run lint` before every commit.
- Unit tests: `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`.
  Baseline **85 suites / 464 tests**.
- **Announce the target package before creating anything in SAP.** No SAP run is needed by
  this plan; the fixtures are already captured.

## Repositories and branches

| repo | branch | note |
|---|---|---|
| `/home/okyslytsia/prj/mcp-abap-adt-interfaces` | `feat/transport-tree` off **`master`** | default branch is master, not main |
| `/home/okyslytsia/prj/mcp-abap-adt-clients` | `feat/11.0.0-contract-and-transport` (exists) | head `655220e` |

## The fixtures this plan is built on

Both captured from the same trial 2026-08-12, both committed:

| file | shape | contents |
|---|---|---|
| `src/__tests__/fixtures/transport/transportTree.noTargets.xml` | `workbench > modifiable > request > task` | 7 requests, 7 tasks, 60 KB |
| `src/__tests__/fixtures/transport/transportTree.withTargets.xml` | `workbench > target > modifiable > request > task` | 1 request, 1 task |

The chain differs because the request differs (`?targets=true`). **A parser that walks a fixed
path passes one fixture and silently returns zero on the other** — that is the single most
important thing these two files exist to catch.

---

## Phase D — interfaces

### Task 1: The four tree types

**Files:**
- Modify: `../mcp-abap-adt-interfaces/src/adt/IAdtTransport.ts` (append)
- Modify: `../mcp-abap-adt-interfaces/src/index.ts`
- Test: `../mcp-abap-adt-interfaces/src/__typechecks__/transportTree.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces **five** types: `ITransportTreeLink`, `ITransportTreeNode`, `ITransportTreeTask`,
  `ITransportTreeRequest`, `ITransportTree`. Tasks 3 and 4 import them.

**Note there is no `TransportTreeParser` type.** The parser is a call-site generic
(`(data: unknown) => T`), so nothing about it belongs in the contract.

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
git checkout master && git pull --ff-only
git checkout -b feat/transport-tree
```

- [ ] **Step 1: Write the compile-only assertion**

Create `src/__typechecks__/transportTree.ts`:

```ts
// Compile-only assertions. If these stop compiling, the types regressed.

import type {
  ITransportTree,
  ITransportTreeRequest,
} from '../adt/IAdtTransport';

// Attributes are handed back verbatim: the tm: prefix survives, and nothing is
// renamed into camelCase. A type that promised `number` would be the library
// deciding what the field means.
const request: ITransportTreeRequest = {
  attributes: { 'tm:number': 'TRLK900454', 'tm:status': 'D' },
  containers: [
    { element: 'workbench', attributes: { 'tm:category': 'Workbench' } },
    { element: 'modifiable', attributes: { 'tm:status': 'Modifiable' } },
  ],
  // The operation URIs. A consumer releasing a transport needs these hrefs;
  // rebuilding them by convention is the ADT knowledge we are here to hold.
  links: [
    {
      attributes: {
        href: '/sap/bc/adt/cts/transportrequests/TRLK900454/releasejobs',
        rel: 'http://www.sap.com/cts/relations/releasejobs',
      },
    },
  ],
  longDesc: '',
  tasks: [{ attributes: { 'tm:number': 'TRLK900455' }, links: [], longDesc: '' }],
};

// A missing key reads as `string | undefined`, so a caller must handle absence.
// Without the `| undefined` the compiler would hand back `string` for a key that
// was never in the payload — noUncheckedIndexedAccess is not set in this repo.
const missing: string | undefined = request.attributes['tm:no_such_attribute'];
void missing;

const tree: ITransportTree = {
  // Whose list this is — the root carries it and nothing else does.
  attributes: { 'adtcore:name': 'CB9900000000', 'adtcore:changedAt': '2026-08-12T13:15:12Z' },
  requests: [request],
};
void tree;

// Absent and present-but-empty are different states, and the type keeps them apart.
const absent: string | undefined = request.longDesc;
void absent;

// Containers are an ordered LIST, not a fixed triple: the chain is two levels
// without ?targets=true and three with it.
const withTarget: ITransportTreeRequest = {
  ...request,
  containers: [
    { element: 'workbench', attributes: {} },
    { element: 'target', attributes: { 'tm:name': 'Local Change Requests' } },
    { element: 'modifiable', attributes: {} },
  ],
};
void withTarget;

// @ts-expect-error containers is required — a request that forgot where it came from
const _noContainers: ITransportTreeRequest = {
  attributes: {}, tasks: [], links: [], longDesc: '',
};
void _noContainers;

// @ts-expect-error tasks is required — absent tasks are [], never undefined
const _noTasks: ITransportTreeRequest = {
  attributes: {}, containers: [], links: [], longDesc: '',
};
void _noTasks;

// @ts-expect-error links is required — the payload always has them, so the type says so
const _noLinks: ITransportTreeRequest = {
  attributes: {}, containers: [], tasks: [], longDesc: '',
};
void _noLinks;
```

- [ ] **Step 2: Run the typecheck to verify it fails**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check
```

Expected: FAIL — the five types are not exported from `./adt/IAdtTransport`.

- [ ] **Step 3: Append the declarations**

To `src/adt/IAdtTransport.ts`:

```ts
/**
 * One container a request was nested under — `tm:workbench`, `tm:target`,
 * `tm:modifiable` and whatever else a system groups by.
 *
 * A list rather than named fields because the chain is not fixed: `?targets=true`
 * inserts a `tm:target` level, and a parser that assumed a shape would return
 * nothing on the other form.
 */
export interface ITransportTreeNode {
  /** Element name without its prefix: "workbench", "target", "modifiable" … */
  element: string;
  /** The container's own attributes, verbatim. */
  attributes: Record<string, string | undefined>;
}

/** A task under a request. Carries the same attribute set the request does. */
export interface ITransportTreeLink {
  /** href, rel, type, title — verbatim, unprefixed of the parser's own marker. */
  attributes: Record<string, string | undefined>;
}

export interface ITransportTreeTask {
  /** tm:number, tm:parent, tm:owner, tm:desc, tm:type, tm:status … verbatim. */
  attributes: Record<string, string | undefined>;
  /**
   * Every `atom:link`, in document order. These carry the operation URIs —
   * release, reassign, addobject, consistencycheck — so dropping them would
   * force a consumer to rebuild ADT URLs by convention.
   */
  links: ITransportTreeLink[];
  /**
   * `tm:long_desc` text. `''` when present and empty, `undefined` when absent.
   */
  longDesc: string | undefined;
}

/**
 * One transport request, with its tasks and the containers it was found under.
 *
 * The containers are kept because they carry information the request does not:
 * `tm:target` has a human name (`"Local Change Requests"`) where the request has
 * `tm:target=""`. Dropping them would be this library deciding what a consumer
 * needs.
 */
export interface ITransportTreeRequest {
  /** Attributes verbatim — `tm:number`, not `number`. No renaming, no selection. */
  attributes: Record<string, string | undefined>;
  /** Ancestors, outermost first. Empty only if the server nested it under nothing. */
  containers: ITransportTreeNode[];
  /** Every `atom:link` on the request, in document order. */
  links: ITransportTreeLink[];
  /**
   * `tm:long_desc` text. `''` when the element is present and empty;
   * `undefined` when the element is absent. The two are not the same thing and
   * the type does not pretend they are.
   */
  longDesc: string | undefined;
  /** Empty when the request has no tasks — never undefined. */
  tasks: ITransportTreeTask[];
}

/**
 * The parsed transport tree. Empty `requests` is a legitimate answer, not a failure.
 *
 * `attributes` are the root's own — `adtcore:name` is the user the saved search
 * ran for, plus the four created/changed stamps. They are the only record of
 * *whose* list this is, so dropping them would leave a caller unable to tell two
 * lists apart.
 */
export interface ITransportTree {
  attributes: Record<string, string | undefined>;
  requests: ITransportTreeRequest[];
}
```

- [ ] **Step 4: Export from the barrel**

Add **all five** names to the existing `export type { … } from './adt/IAdtTransport';` block in
`src/index.ts`, alphabetically:

```ts
  ITransportTree,
  ITransportTreeLink,
  ITransportTreeNode,
  ITransportTreeRequest,
  ITransportTreeTask,
```

`ITransportTreeLink` appears in the public shape of both request and task, so leaving it
unexported would hand a consumer a type it cannot name.

- [ ] **Step 5: Verify**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm run test:check && npm run lint:check
```

Both clean. Then prove the typecheck is load-bearing: make `containers` optional, re-run
`test:check`, confirm the `@ts-expect-error` reports TS2578, then revert **that one edit**
exactly and re-run clean.

Do **not** expect `git status --porcelain` to be empty here — this task's three files are new
or modified and not yet committed. What must be true is narrower: `git diff` on
`src/adt/IAdtTransport.ts` shows the mutation gone. Check that, not a clean tree.

- [ ] **Step 6: Commit**

```bash
git add src/adt/IAdtTransport.ts src/index.ts src/__typechecks__/transportTree.ts
git commit -m "feat(transport): the parsed transport tree contract

Requests, their tasks, and the containers they were nested under. Containers
are a list, not named fields: ?targets=true inserts a tm:target level, so the
chain is two deep on one form and three on the other."
```

---

### Task 2: Release interfaces 14.1.0

Additive — nothing is removed and no shape changes — so a **minor**.

- [ ] **Step 1: Sweep the docs**

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-interfaces
grep -rn "ITransportTree\|transport tree\|IListTransports" README.md docs/ 2>/dev/null
```

Update every hit. If the README lists what the package covers, the tree contract belongs there.

- [ ] **Step 2: CHANGELOG**

A `14.1.0` section, Added only:

```markdown
### Added

- `ITransportTree`, `ITransportTreeRequest`, `ITransportTreeTask`,
  `ITransportTreeNode` — the parsed shape of the CTS transport tree.

  Containers are an ordered list rather than named fields because the chain is
  not fixed: captured on one trial 2026-08-12, `?configUri=` alone returns
  `tm:workbench > tm:modifiable > tm:request`, while Eclipse's
  `?targets=true&configUri=` returns `tm:workbench > tm:target > tm:modifiable >
  tm:request`. They are kept rather than flattened away because `tm:target`
  carries a human name the request itself does not have.

  Attributes are verbatim — `tm:number`, not `number`.
```

- [ ] **Step 3: Bump, lock, build**

```bash
npm version 14.1.0 --no-git-tag-version
npm install --package-lock-only
grep -n '"link": true' package-lock.json || echo "no local links — good"
npm run build 2>&1 | tee build.log
```

Read the log.

- [ ] **Step 4: Commit, push, PR**

```bash
git add -A
git commit -m "release(14.1.0): the parsed transport tree contract"
git push -u origin feat/transport-tree
gh pr create --base master --title "release(14.1.0): the parsed transport tree contract" --body "…"
```

The PR body carries the two captured chains and why containers are a list.

- [ ] **Step 5: Maintainer reviews. Then merge, tag, hand over — STOP**

```bash
gh pr merge <N> --squash --delete-branch
git checkout master && git pull --ff-only
git tag -a v14.1.0 -m "the parsed transport tree contract" && git push --tags
```

Tell the user: `cd /home/okyslytsia/prj/mcp-abap-adt-interfaces && npm publish`.
**Do not start Phase E until `npm view @mcp-abap-adt/interfaces version` reports 14.1.0.**

---

## Phase E — adt-clients

Branch `feat/11.0.0-contract-and-transport` already exists and is checked out.

```bash
cd /home/okyslytsia/prj/mcp-abap-adt-clients
rm -rf node_modules/@mcp-abap-adt/interfaces
npm install @mcp-abap-adt/interfaces@14.1.0 --save
grep '"version"' node_modules/@mcp-abap-adt/interfaces/package.json
```

Note `--save`, not `--save-dev`: interfaces is a **runtime** dependency here — eight modules
in `dist/` carry a real `require()` of it.

### Task 3: `parseTransportTree`

**Files:**
- Create: `src/core/transport/parseTransportTree.ts`
- Modify: `src/index.core.ts` (export it, beside `parseSearchResults`)
- Test: `src/__tests__/unit/core/transport/parseTransportTree.test.ts` (create)

**Interfaces:**
- Consumes: the five types from Task 1.
- Produces: `parseTransportTree(data: unknown): ITransportTree`. Task 4 calls it.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/transport/parseTransportTree.test.ts`:

```ts
/**
 * The tree is parsed from two real payloads, not from a shape we imagined.
 *
 * Both come from the same trial on 2026-08-12 and differ only because the
 * request differed: `?targets=true` inserts a `tm:target` container. A parser
 * that walks a fixed path passes one of these and silently returns zero
 * requests on the other — which is the failure mode this whole design exists
 * to remove.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTransportTree } from '../../../../core/transport/parseTransportTree';

const fixture = (name: string): string =>
  readFileSync(
    join(__dirname, '../../../fixtures/transport', name),
    'utf8',
  );

describe('parseTransportTree reads both captured shapes', () => {
  it('reads the two-level chain (no targets)', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));

    expect(tree.requests).toHaveLength(7);
    expect(tree.requests[0].containers.map((c) => c.element)).toEqual([
      'workbench',
      'modifiable',
    ]);
  });

  it('reads the three-level chain (targets=true)', () => {
    const tree = parseTransportTree(fixture('transportTree.withTargets.xml'));

    expect(tree.requests).toHaveLength(1);
    expect(tree.requests[0].containers.map((c) => c.element)).toEqual([
      'workbench',
      'target',
      'modifiable',
    ]);
  });

  it('keeps what the containers carry and the request does not', () => {
    const tree = parseTransportTree(fixture('transportTree.withTargets.xml'));
    const target = tree.requests[0].containers.find((c) => c.element === 'target');

    // The request says tm:target="" — the name exists only on the container.
    expect(tree.requests[0].attributes['tm:target']).toBe('');
    expect(target?.attributes['tm:name']).toBe('Local Change Requests');
  });

  it('nests each task under its own request', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));

    expect(tree.requests).toHaveLength(7);
    for (const request of tree.requests) {
      expect(request.tasks).toHaveLength(1);
      expect(request.tasks[0].attributes['tm:parent']).toBe(
        request.attributes['tm:number'],
      );
    }
  });

  it('keeps the root attributes — the only record of whose list this is', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));

    expect(tree.attributes['adtcore:name']).toBe('CB9900000000');
    expect(tree.attributes['adtcore:changedAt']).toBeDefined();
    expect(Object.keys(tree.attributes).some((k) => k.startsWith('xmlns'))).toBe(false);
  });

  it('keeps every link and long_desc, because they are not ours to drop', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));
    const links = tree.requests.flatMap((r) => [
      ...r.links,
      ...r.tasks.flatMap((t) => t.links),
    ]);

    // 231 in the fixture; an earlier draft skipped atom:link as noise.
    expect(links).toHaveLength(231);
    expect(links.some((l) => String(l.attributes.rel).endsWith('/releasejobs'))).toBe(true);

    // Present and empty on this trial — captured as '', not dropped, and not
    // flattened into undefined, which would mean "no element at all".
    expect(tree.requests[0].longDesc).toBe('');
  });

  it('hands attributes back verbatim, prefix and all', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));
    const keys = Object.keys(tree.requests[0].attributes);

    expect(keys).toContain('tm:number');
    expect(keys).not.toContain('number');
    expect(keys).not.toContain('description');
  });

  it('returns no requests for an empty root, without throwing', () => {
    const tree = parseTransportTree(
      '<?xml version="1.0"?><tm:root xmlns:tm="http://www.sap.com/cts/adt/tm"/>',
    );

    expect(tree.requests).toEqual([]);
  });

  it('throws on a body it does not recognise, carrying the payload', () => {
    expect(() => parseTransportTree('<html><body>Gateway timeout</body></html>')).toThrow(
      /tm:root/,
    );
    expect(() => parseTransportTree('')).toThrow();
    expect(() => parseTransportTree(undefined)).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/parseTransportTree.test.ts 2>&1 | tee unit-run.log
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the parser**

Create `src/core/transport/parseTransportTree.ts`. Follow the house style of
`parseSearchConfigurations.ts` — same `XMLParser` options, same `@_` attribute prefix.

Requirements the tests pin, and the reasons:

- **Descend by element name.** Recurse from `tm:root`, and whenever a node's key ends in
  `:request` (or is `request`), that is a request — whatever nesting got you there. Collect the
  containers walked through, outermost first. Do NOT hardcode `workbench`/`modifiable`.
- A container is any element on the way to a request that is not `request` or `task`. Its
  `element` is the key with the namespace prefix stripped.
- Tasks are the `tm:task` children of a request; `tasks` is `[]` when there are none.
- **`atom:link` and `tm:long_desc` are captured, not skipped**, on both requests and tasks —
  231 links and 14 long_desc in the `noTargets` fixture alone. Assert the counts, or the next
  draft quietly drops them again.
- Attributes keep their prefix: strip only the parser's own `@_`, so `@_tm:number` becomes
  `tm:number`. Skip `xmlns` declarations — they describe the document, not the request.
- **The root's own attributes go into `tree.attributes`**, verbatim, `xmlns` skipped.
  `adtcore:name` is the user the saved search ran for.
- **`longDesc` distinguishes absent from empty.** `<tm:long_desc/>` yields `''`; no element at
  all yields `undefined`. Do not normalise one into the other — that is the same class of
  silent flattening as dropping the containers.
- **Recognition is structural.** Root must be `tm:root` (or `root`). If it is not, throw an
  error naming what was found and quoting the first 200 characters of the payload. An empty
  `tm:root` returns `{ requests: [] }` and must never warn: a system holding no transport
  requests answers exactly that, permanently and correctly.

- [ ] **Step 4: Export it from the barrel**

In `src/index.core.ts`, beside `parseSearchResults`:

```ts
export { parseTransportTree } from './core/transport/parseTransportTree';
```

- [ ] **Step 5: Verify**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
npx tsc -p tsconfig.json
npm run lint
```

Expected: PASS, 86 suites / 471 tests (7 new). `publicApiSurface.test.ts` must still pass —
if it fails, the barrel is unwired; fix the barrel, not the test.

- [ ] **Step 6: Commit**

```bash
git add src/core/transport/parseTransportTree.ts src/index.core.ts \
        src/__tests__/unit/core/transport/parseTransportTree.test.ts
git commit -m "feat(transport): parse the transport tree, by element name not by path

Both captured shapes go through the same code: the chain is two levels
without ?targets=true and three with it, and a fixed-path walk would return
zero requests on one of them without saying so."
```

---

### Task 4: `listNodes()`

**Files:**
- Modify: `src/core/transport/AdtRequest.ts` (add the method)
- Modify: `src/core/transport/AdtRequestLegacy.ts` (override, throw)
- Test: `src/__tests__/unit/core/transport/listNodes.test.ts` (create)

**Interfaces:**
- Consumes: `parseTransportTree` (Task 3), `ITransportTree` (Task 1), the existing
  `list()` and `resolveSearchConfiguration()`.
- Produces: `AdtRequest.listNodes()` overloads.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/core/transport/listNodes.test.ts`, asserting:

1. `listNodes()` over a stub connection returning the `noTargets` fixture yields 7 requests,
   and makes **the same number of requests as `list()`** — parsing adds no round trip.
2. `listNodes(myParse)` returns exactly what `myParse` returned, and the default parser is
   **not** called (use a stub parser returning a sentinel object).
3. `listNodes({ configUri })` on a connection declaring `responsesAreDeferred` records one
   part and does not throw; `listNodes()` without `configUri` on the same connection throws
   **fast** (assert elapsed < 1000 ms — a deadlock would otherwise read as a slow pass).
4. `AdtRequestLegacy.listNodes()` throws, naming that the legacy payload has never been
   captured.

Reuse the stub-connection helper shape already in
`src/__tests__/unit/core/transport/listResolution.test.ts`.

- [ ] **Step 2: Run it to verify it fails**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit/core/transport/listNodes.test.ts 2>&1 | tee unit-run.log
```

- [ ] **Step 3: Add the method**

To `AdtRequest`:

```ts
  /**
   * The transport tree, parsed.
   *
   * Adds no request to `list()` — with a `configUri` that is one call, without
   * one it is two, exactly as `list()` alone.
   *
   * A consumer whose system answers in a shape the default parser does not fit
   * passes its own and keeps a type; telling it to fall back on the raw
   * response would be telling it to go untyped, which is the defect this
   * exists to remove.
   */
  async listNodes(options?: IListTransportsOptions): Promise<ITransportTree>;
  // NB: the doc comment above MUST state that this rejects on an unrecognised
  // body. The signature promises ITransportTree, and a reader takes a signature
  // for a guarantee — so say plainly that the guarantee is "this shape or an
  // error", never a silently empty tree. See "Honesty of the signature" below.
  async listNodes<T>(
    parse: (data: unknown) => T,
    options?: IListTransportsOptions,
  ): Promise<T>;
  async listNodes<T>(
    first?: IListTransportsOptions | ((data: unknown) => T),
    second?: IListTransportsOptions,
  ): Promise<ITransportTree | T> {
    const parse = typeof first === 'function' ? first : undefined;
    const options = typeof first === 'function' ? second : first;

    const state = await this.list(options);
    const data = state.listResult?.data;

    return parse ? parse(data) : parseTransportTree(data);
  }
```

To `AdtRequestLegacy`:

```ts
  /**
   * Not supported on legacy systems.
   *
   * `/sap/bc/cts/transportrequests` has never been captured, and assuming the
   * modern parser fits it would be exactly the guess this design exists to
   * stop. Supported once someone captures a legacy payload.
   */
  override async listNodes(): Promise<never> {
    throw new Error(
      'listNodes() is not supported on legacy SAP systems: the payload of ' +
        '/sap/bc/cts/transportrequests has never been captured, so no parser can ' +
        'honestly claim to read it. Use list() and parse the response yourself.',
    );
  }
```

- [ ] **Step 4: Verify**

```bash
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
npx tsc -p tsconfig.json
npm run lint
```

All green; suite count rises by one file.

- [ ] **Step 5: Commit**

```bash
git add src/core/transport/AdtRequest.ts src/core/transport/AdtRequestLegacy.ts \
        src/__tests__/unit/core/transport/listNodes.test.ts
git commit -m "feat(transport): listNodes() — the tree, typed, with a replaceable parser

The parser is a call-site argument rather than a client option so the return
type follows it: a consumer passing its own gets its own type, with no cast
and no fall back to an untyped response."
```

---

### Task 5: Amend the 11.0.0 release commit

The release commit `4d0b23b` already exists on this branch and describes A and B only.

- [ ] **Step 1: Extend the CHANGELOG's `11.0.0` section**

Under Added:

```markdown
- `getRequest().listNodes()` — the transport tree, parsed: requests, their tasks,
  and the containers they were nested under. Adds no request to `list()`.

  ```ts
  const tree = await client.getRequest().listNodes();
  tree.requests[0].attributes['tm:number'];   // verbatim, never renamed
  tree.requests[0].tasks;
  tree.requests[0].containers;                // outermost first
  ```

  Pass your own parser when the default does not fit your system — the return
  type follows it:

  ```ts
  const mine = await client.getRequest().listNodes(myParse);
  ```

  Not supported on legacy systems: the `/sap/bc/cts/transportrequests` payload
  has never been captured.

- `parseTransportTree()` — exported standalone, for a response obtained elsewhere.
```

- [ ] **Step 2: Update the usage docs**

`docs/usage/CLIENT_API_REFERENCE.md` gained a Transport Requests section in `4d0b23b`; add
`listNodes()` to it. Check `README.md` too.

Migration `before/after` import examples belong **only** in `CHANGELOG.md` —
`docsImportsResolve.test.ts` scans every other markdown file for imports that must resolve.

- [ ] **Step 3: Verify and commit**

```bash
npm run build 2>&1 | tee build.log
MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit 2>&1 | tee unit-run.log
npm run test:check
git add -A && git commit -m "docs(11.0.0): listNodes() and parseTransportTree in the changelog"
```

- [ ] **Step 4: Push to PR #106 and hand over for review — STOP**

The maintainer reviews, then Claude merges, tags `v11.0.0`, creates the GitHub release, and
the user publishes.

---

## Honesty of the signature

`listNodes()` is typed `Promise<ITransportTree>`, but on a body the parser does not recognise
it **rejects**. A signature is read as a guarantee, so the guarantee must be stated where it
is read — in the method's own doc comment, not only here:

> Resolves with the parsed tree, or **rejects** if the response is not a `tm:root` document.
> An empty `tm:root` is not an error: it resolves with `requests: []`, which is the permanent
> and correct answer on a system holding no transport requests, or when the saved search
> configuration matches none.

Both halves matter, and they pull in opposite directions:

- **Rejecting on an unrecognised body** is what stops the original defect returning. A parser
  that answered `{ requests: [] }` to anything it could not read would reproduce
  `{"success": true, "count": 0}` over 55 real requests — the downstream failure this design
  began with.
- **Resolving on an empty root** is what stops the opposite lie. A system with no transport
  requests must be able to say so without being reported as broken. No heuristic may treat
  emptiness as suspicious.

The distinction is structural — the root element and the nesting — and never a count.

## What this plan does not do

- **`?targets=true` is not sent.** Whether to send it is undecided in the spec and is the
  maintainer's call. It cannot change the type — containers are a list — so it can be added
  later without breaking anything.
- **No SAP run.** Both fixtures are captured; every test here is a unit test. The integration
  test added in `dafd9e0` already covers `list()` against a live system.
- **The transport-request leak is untouched.** `Transport.test.ts` creates a request per run
  and never deletes it; `AdtRequest.delete()` throws "not supported" although ADT does delete
  an empty request. Separate defect, separate work.
