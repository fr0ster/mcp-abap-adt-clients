# Spec: an activation activates, or says it did not

Goal: `2026-11-09-activation-751-goal.md` (fr0ster/mcp-abap-adt#351). This file is the
specification only. Every fact is tagged **Measured** (a recorded answer or a live
run, with where it is recorded), **Code** (`file:line`, paths relative to the
repository named in the section) or **Inference**. Releases are named, systems are
not (`notesNameNoSystem.test.ts` scans `docs/`): *S/4HANA 2025* (on-premise),
*ABAP cloud*, *SAP_BASIS 7.40 SP04*, and *751* (the issue's S/4HANA 1610,
SAP_BASIS 751 SP02).

Repositories: adt-clients (this one: `packages/adt-clients`,
`packages/adt-strategies`, `packages/adt-clients-legacy`), interfaces
(`packages/interfaces-adt` of `mcp-abap-adt-interfaces`), and the server
(`mcp-abap-adt`, branch `refactor/static-types`, PR #346).

---

## 1. What is there today

### 1.1 Every activation request adt-clients sends

| Path | Member | Request | `preauditRequested` | Answer handed back |
|---|---|---|---|---|
| single object, via the shared helper | `activate` of class (and its four local includes, which activate the container class), interface, program, include, function module, function include, DDL, domain, structure, table, table type, enhancement, behaviour definition, metadata extension; `class.activateTestClasses` | `POST /sap/bc/adt/activation?method=activate&preauditRequested=…`, one `adtcore:objectReference` (uri + name, no type) | `true`, hard-coded at every call site | the wire answer, through `answering` with the caller's `analyse` |
| single object, own request | `activate` of access control, append structure, authorization field, data element, feature toggle, scalar function, scalar function implementation, service definition, transformation | same URL, written out per file | `true`, a literal in the URL | same |
| function group | `AdtFunctionGroup.activate` | same URL, **two** references: the group and `FUGR/I SAPL<group>` | `true` literal | same |
| service binding | `AdtService.activate` | same URL | `true`: the private `activateRequest` takes `preauditRequested` but `activate` always passes `true` | same |
| behaviour implementation | `AdtBehaviorImplementation.activate` | delegates to the class's `activate` | `true` (the class's) | same |
| group | `AdtUtils.activateObjectsGroup(objects, preauditRequested = false, options)` | `POST /sap/bc/adt/activation/runs?method=activate&preauditRequested=…`, references with uri, type, name | positional, default `false` | `202` + `Location` as it came; `getActivationRun` / `getActivationResults` are the caller's next requests |
| group, 7.40 | `AdtUtilsLegacy.activateObjectsGroup` (override) | `POST /sap/bc/adt/activation?method=activate&preauditRequested=…`, same body | positional, default `false` | the `200` as it came, read through the same `activation` slot |
| function group, 7.40 | `AdtFunctionGroupLegacy.activate` (override) | `/activation`, the group alone | `true` literal | same |

Code (adt-clients):
- the helper: `packages/adt-clients/src/utils/activationUtils.ts:113-140`
  (`activateObjectInSession(…, preaudit = true)`); every caller passes `true`:
  `src/core/class/activation.ts:25-31`, `src/core/class/testclasses.ts:51-56`,
  `src/core/{ddl,domain,enhancement,functionInclude,functionModule,include,interface,program,structure,table,tabletype}/activation.ts`
  (the `true` argument at lines 26-37 of each);
  `src/core/behaviorDefinition/activation.ts:35` and
  `src/core/metadataExtension/activate.ts:33` have a `preaudit` parameter
  defaulting to `true`, and their members never pass it;
- own URL literals: `src/core/accessControl/activation.ts:31`,
  `appendStructure/activation.ts:21`, `authorizationField/activation.ts:29`,
  `dataElement/activation.ts:36`, `featureToggle/activation.ts:29`,
  `functionGroup/activation.ts:37`, `scalarFunction/activation.ts:21`,
  `scalarFunctionImplementation/activation.ts:21`,
  `serviceDefinition/activation.ts:36`, `transformation/activation.ts:31`;
- service binding: `src/core/service/AdtService.ts:687-705` (passes `true`),
  `:975-991` (`activateRequest`);
- the class member: `src/core/class/AdtClassMemberBase.ts:181-197`; behaviour
  implementation: `src/core/behaviorImplementation/AdtBehaviorImplementation.ts:407-412`;
- group: `src/core/shared/groupActivation.ts:100-128`,
  `src/core/shared/AdtUtils.ts:533-555`; run and results:
  `groupActivation.ts:30-64`, `AdtUtils.ts:564-597`;
- legacy: `packages/adt-clients-legacy/src/core/shared/AdtUtilsLegacy.ts:233-282`
  (group), `:458-485` (`getActivationRun` / `getActivationResults` refused, no
  request); `src/core/functionGroup/AdtFunctionGroupLegacy.ts:100-130`.

Every single-object member takes `options: { headers } & IAdtOperationOptions<E>`
(interfaces-adt `src/adt/IAdtCapabilities.ts:520-540`), which has no preaudit
field (Code: `src/adt/IAdtObject.ts:166-…`). So the single-object path cannot send
`preauditRequested=false` — Code, and the issue's tool table (Measured on 751).

### 1.2 How an activation answer is judged today

- **The library judges nothing past the transport.** `answering`
  (`packages/adt-clients/src/utils/adtResponse.ts:253-301`): a `2xx` is
  `ADT_NO_FAILURE`; a thrown transport status is `recogniseFailure`'s verdict; the
  caller's `analyse` may name a failure on a `2xx` or clear one that carries a
  response. Without `analyse`, every `200` is a success whatever its body. Code.
- **The reading is `analyseActivation`** in adt-strategies
  (`packages/adt-strategies/src/refusals/analyse.ts:145`, over
  `readActivationRefusal`, `src/refusals/read.ts:259-375`). It looks for a
  `chkl:messages` root and nothing else (`field(parseXml(document), 'messages')`,
  `read.ts:327-328`):
  - `chkl:messages` with a `msg type="E"` → refusal `form: 'activation'` with
    the messages; `activationExecuted="false"` with no message → no failure
    ("nothing to activate", Measured on ABAP cloud 2026-09-16, corpus
    `activation-nothing-to-activate`); `activationExecuted="true"` without `E` →
    no failure. Code.
  - **`ioc:inactiveObjects`** → no `chkl:messages` root → `null` → **no
    failure**. Code (`read.ts:328`).
  - **an empty body** → nothing parsed → `null` → **no failure**. Code.
- **The consumer names or clears**: `IAnalyse<E> = (verdict, answer?) => E |
  AdtNoFailure` (interfaces-adt `src/adt/IAdtObject.ts:125-128`). The answer it
  gets carries `request` (method, url with its query) — put back on every answer by
  `withRequestTrace` (`packages/adt-clients/src/utils/requestTrace.ts:111`,
  applied in each client's constructor, e.g. `AdtUtils.ts:323`). Code.

### 1.3 Discovery

- `AdtUtils.getDiscovery(params)` — one `GET /sap/bc/adt/discovery`, through
  `answering`, slot `discovery` (default `rawDocument`). Code:
  `src/core/shared/discovery.ts:20-36`, `AdtUtils.ts:844-850`,
  `src/core/shared/utilResultSet.ts:55`.
- `fetchDiscoveryEndpoints` / `isEndpointInDiscovery`
  (`src/utils/discoveryEndpoints.ts:30-87`): a **regex** over the body, a
  `404`/`405`/`501` answered as an **empty set** (so "discovery not readable" and
  "nothing listed" are the same answer there), and a **prefix** match
  (`/sap/bc/adt/activation` would match any path that starts with it). Code.
  Neither fits the owner's rules (no regex; no answer invented for an unread
  discovery).
- adt-strategies has **no** discovery reading. Code (`grep -rl iscovery
  packages/adt-strategies/src` finds nothing).
- Recorded discovery (`packages/adt-clients/corpus/adt/discovery/`, captured
  2026-10-27), `href`s under `/sap/bc/adt/activation` — Measured:

  | Release | `/activation` | `/activation/inactiveobjects` | `/activation/runs` | `/activation/results` |
  |---|---|---|---|---|
  | S/4HANA 2025 | listed | listed | **listed** | listed |
  | ABAP cloud | listed | listed | **listed** | listed |
  | SAP_BASIS 7.40 SP04 | listed | listed | **absent** | absent |
  | 751 (the issue) | listed | listed | **absent** | — |

### 1.4 What 7.40 answers (Measured, records under the legacy package's live runs, 2026-10-23)

- single object, `preauditRequested=true` (class, program, function group,
  function module, function include): **`200`, empty body**; the steps after it
  ran on the active version (the class cycle's `check … 'active'` and ABAP Unit
  `testruns` answered). `docs/LEGACY.md` lists `activate` as measured for these
  types. Whether the empty answer itself means "activated" is an Inference from
  those later steps; no inactive-objects read followed it.
- group, `preauditRequested=false` on `/activation`: **`200`, empty body**, six
  objects activated, the inactive list read afterwards named none of them
  (`packages/adt-clients-legacy/docs/LEGACY.md:434-437`).
- `/activation/inactiveobjects` answers a flat `adtcore:objectReferences`, not
  `ioc:inactiveObjects` (`LEGACY.md:428-433`).

### 1.5 What 751 answers (Measured, the issue, 2026-11-09)

| Request | Answer | Activated |
|---|---|---|
| `/activation`, `preauditRequested=true`, the class alone | `200`, `ioc:inactiveObjects`, 8 entries (the class, its includes, OSI/OSO/OSU), no `msg` | no |
| `/activation/runs`, `preauditRequested=false` | `404` | no |
| `/activation`, `preauditRequested=false`, the class alone | `200`, empty | **yes** |
| `/activation`, `preauditRequested=false`, all 11 refs of the `ioc` list | `200`, empty | yes |
| `/activation`, `preauditRequested=false`, a syntax error in a method | `200`, `chkl:messages` with `msg type="E"` | no |

### 1.6 Earlier records of `ioc:inactiveObjects` on S/4HANA 2025

- The server's corpus `tests/fixtures/adt/activation-still-inactive--01-activation`
  (Measured 2026-09-21, RFC, on premise): a function group activated alone with
  `preauditRequested=true` answered `200 ioc:inactiveObjects` (a transport
  entry, the group, its `source/main`). The server's comment
  (`src/lib/strategies/projections.ts:123-128`) records that a
  `GetInactiveObjects` read straight afterwards answered `count: 0`.
- adt-clients `ac5bd5d9` (Measured 2026-10-29, S/4HANA 2025): activating the group
  alone **left both inactive** in a transportable package; the group plus its
  `FUGR/I` main program activates (`src/core/functionGroup/activation.ts:13-22`).
- So on S/4HANA 2025 one record says the `ioc` answer came with nothing left
  inactive, a later one that the same request left the objects inactive. Which
  held for the `ioc` answer itself is not recorded. See §8, live measurement L3.

### 1.7 The server (mcp-abap-adt, `refactor/static-types`, read only)

- **`activation_not_stated`** is made by `terseActivation`
  (`src/lib/strategies/projections.ts:91-159`): a `chkl:messages` root →
  `{ activated, generated, nothing_to_activate?, messages? }`; an
  `ioc:inactiveObjects` root → `{ activation_not_stated: true, objects }`
  (`:140-156`); anything else → `undefined` (→ `projection_failed`). It is the
  projection of a **success**: `analyseActivation` raised nothing (§1.2), so
  `isError` is not set. Code; Measured by the issue.
- **Who uses it**: `ActivateClass`/`ActivateClassLow`
  (`src/handlers/class/low/handleActivateClass.ts:20-60`), the 15 other
  `Activate*Low` handlers, and `ActivateObjects` / `ActivateObjectLow` /
  `HandlerActivate` on the single-object path
  (`src/handlers/common/low/handleActivateObject.ts:369-497`), each with
  `analyse: analyseActivation`. Code.
- **`UpdateClass` with `activate: true`**: lock → check → update → unlock →
  `obj.activate({ className }, { headers, analyse: analyseActivation })`
  (`src/handlers/class/high/handleUpdateClass.ts:158-170`), projected by
  `terseWrite` (`projections.ts:71-72`): any `2xx` → `SUCCESS`. So an `ioc`
  answer is `SUCCESS`. Code; Measured by the issue. 34 other handlers outside `low/` (high-level
  creates and updates, the local-include writes and deletes, the unit-test
  writer) pass `analyseActivation` the same way (Code: `grep -rln
  analyseActivation src/handlers`).
- **`preaudit`**: on `ActivateObjectLow` / `ActivateObjects`
  (`handleActivateObject.ts:192`, description `:146-148` says the single-object
  path "always sends preauditRequested=true") and `HandlerActivate`
  (`src/lib/compact/compactSchemas.ts:1619-1622`). The handler reads
  `preaudit = args.preaudit !== false` (`handleActivateObject.ts:519`) and passes
  it **only** to the group path (`startGroupActivation`, `:345-367`). No
  per-type `Activate*` tool and no `Update*`/`Create*` with `activate` takes
  `preaudit`. Code.
- **Group path**: `POST /activation/runs` with `analyseException`, then
  `awaitActivationRun` (status, results) and a verdict from the results'
  `chkl:messages` (`activationVerdict`, `isRefusal`;
  `handleActivateObject.ts:560-640`, `src/lib/strategies/activationRun.ts`).
  An `E` in the results is a refusal there. No discovery is read: on 751 the
  `POST` answers `404`. Code; Measured by the issue.
- The server reads discovery nowhere (Code: no `getDiscovery` /
  `fetchDiscoveryEndpoints` in `src`). The server does not use
  `adt-clients-legacy` (Code).

### 1.8 Tests that pin today's behaviour

adt-clients:
- `packages/adt-strategies/src/__tests__/analyse.test.ts:41-44, 86-99` —
  `analyseActivation` over `refusal-activation-fails`, `activation-success-verdict`,
  `activation-nothing-to-activate`;
  `readings.test.ts`, `utilReadings.test.ts`, `publicApi.test.ts` (the exported
  names).
- `packages/adt-clients/src/__tests__/unit/core/r2RequestShapes.test.ts` (the
  pinned URL of every member: `preauditRequested=true` at `:99`, `:137`, `:227`);
  `unit/core/functionGroupActivation.test.ts:29`;
  `unit/shared/activationRunSequence.test.ts:36-89` (the runs sequence, default
  `preauditRequested=false`); `unit/shared/utilsTypedAtoms.test.ts`,
  `unit/shared/servedCodes.test.ts`,
  `unit/endpoints/groupMembersRefuseUnknownTypes.test.ts`,
  `unit/utils/buildObjectUriMatchesActivate.test.ts`,
  `unit/helpers/writeAndActivateVerdict.test.ts`, `unit/publicApiSurface.test.ts`;
  integration `integration/shared/groupActivation.test.ts` and the
  `helpers/sharedActivation.ts` users.
- legacy: `unit/shared/legacyUtils.test.ts:108, 362-373`,
  `unit/core/functionGroup/legacyActivation.test.ts:30`, the live cycles
  (`integration/legacy/cycles/*Cycle.test.ts`, `analyse: judged(analyseActivation)`).

server: `src/__tests__/unit/strategyProjections.test.ts:83-85`
(`activation_not_stated` on `activation-still-inactive`),
`unit/activateObjectPreaudit.test.ts` (asserts the description's "always sends
preauditRequested=true" and the wire), `unit/activationRunWait.test.ts`,
`unit/commonLowOperations.test.ts`, `unit/failureStep.test.ts`,
`unit/activationCancelled.test.ts`, `unit/activateObjectTypeCodes.test.ts`,
`unit/projections/{activationParent,singleActivationNames,caseRule}.test.ts`,
`integration/helpers/rapFixtures.ts:310-318`.

---

## 2. D1 — "not activated" is a failure, read by the shipped strategy

Carries: *A system's answer that activates nothing is not a success*, *A refusal
stays a refusal*.

- **Where**: adt-strategies, `readActivationRefusal` / `analyseActivation`. The
  library keeps judging nothing past the transport (decision 15); the strict
  default verdict is the shipped strategy's, and the consumer names or clears it
  with its own `analyse` (owner rule). No `analyse ??` fallback is added. The one
  exception is the read of Q7 below: the library adds one `GET` in one case, so
  the reading has the facts to judge it.
- **The table the reading answers** (rows marked new):

  | Answer (`2xx`) | Verdict |
  |---|---|
  | `chkl:messages`, `activationExecuted="true"`, no `E` | activated |
  | `chkl:messages`, a `msg type="E"` | refused, the messages (unchanged) |
  | `chkl:messages`, `activationExecuted="false"`, no message (changed, Q7) | the inactive list is read once: a named object still listed → **not activated**, `stillInactive` the listed entries of the named objects; none listed → activated — nothing to activate |
  | `chkl:messages`, the other rows of `read.ts:275-282` | refused (unchanged) |
  | **`ioc:inactiveObjects`** (new) | **not activated**, the objects named |
  | **empty body** (new rule, Q1) | activated, whatever `preauditRequested` was |
  | **any other document** (new) | **not activated**: the answer does not state the activation |

- **The failure's shape** (static, no cast): a new exported type in
  adt-strategies,

  ```ts
  interface IAdtActivationFailure extends IAdtMessageFailure {
    /** What SAP listed as still inactive; empty for a chkl refusal. */
    readonly stillInactive: ReadonlyArray<IAdtStillInactive>;
  }
  interface IAdtStillInactive {
    readonly uri: string;
    readonly type: string;
    readonly name: string;
    readonly parentUri?: string;
  }
  ```

  `analyseActivation: IAnalyse<IAdtActivationFailure>`. Each listed entry with an
  `ioc:ref` carrying a name becomes one `IAdtStillInactive` (the transport-only
  entry is skipped, as `utilInactiveObjects` skips it,
  `src/results/utils.ts:346-357`); the values are the document's attributes as
  sent. `messages` carries one `E` with a sentence about the document ("SAP
  answered the objects still inactive; nothing was activated" / "the answer does
  not state the activation"), as the reading already composes one for a silent
  checklist (`read.ts:359-362`). `form: 'activation'`. Decided by Q2 (a).
- **The read for `activationExecuted="false"` without a message (Q7).** Measured
  on S/4HANA 2025 (D8): the same document answered an activation that left the
  objects inactive (L5) and the re-activation of an object already active (L7);
  the document alone cannot tell them apart. So, **only for that document**, the
  member that sent the activation reads `GET /sap/bc/adt/activation/inactiveobjects`
  once, after the answer, and the reading judges with it:
  - *the named objects* are the references of the activation request;
  - an entry counts when its `ioc:ref` (on 7.40 the flat `adtcore:objectReference`)
    has the `uri` of a named object, or a `parentUri` that is one; the
    transport-only entry never counts;
  - any entry counts → not activated, those entries as `stillInactive`; none →
    nothing to activate, a success.
  The read changes nothing on the system (a `GET`) and activates nothing; it costs
  one request, in this case only — every other answer is judged as it came. A
  re-activation of an already active object must not become a false failure, and
  without the read the reading could only call both cases one thing. Where the
  list travels to the reading (the answer handed to `analyse`) is the plan's to
  fix. A failed read is the call's failure, naming that the activation's outcome
  could not be decided — no verdict is invented (as D2 does for discovery). Checked
  against both recordings: L5's list holds the group's own uri → not activated;
  L7's list is empty → nothing to activate.
- **Parsing**: `fast-xml-parser`, as the other readings; no regex. A document
  that does not parse is "does not state the activation".
- **No path turns it into success**: the library does not (it judges nothing; its
  one read, Q7, only gives the reading the facts); the server does not (D6). A consumer that clears it does so by its own `analyse`,
  which is the contract.

## 3. D2 — the group endpoint is chosen from discovery, by the consumer

Carries: *An endpoint is used only where the system offers it*, *Nothing is
tried*, one endpoint one member.

- **Two members, one endpoint each.** `activateObjectsGroup` stays
  `POST /activation/runs` (unchanged request). A new member on `AdtUtils`:

  ```ts
  activateObjects<E extends IAdtError = IAdtError>(
    objects: IAdtCodedReference<AdtActivationCode<V>>[],
    preauditRequested: boolean = false,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['objectActivation'], E>>
  ```

  — one `POST /sap/bc/adt/activation?method=activate&preauditRequested=…` with the
  same body `activateObjectsGroup` builds (uri, type, name per reference), read
  through a new result slot `objectActivation` (default `rawDocument`). Its own
  slot, because the document differs from the runs answer (`202` + `Location`
  there; `chkl:messages`, `ioc:inactiveObjects` or empty here). The default
  `false` is the group member's (the request it replaces on a system without
  runs). Name and slot name are proposals; the precedent is #286's `run` /
  `runSync` (two members, the caller picks).
- **Who reads discovery**: the consumer, before it calls one of the two. No member
  reads discovery and then sends: that would be two requests in one member and a
  lookup the caller cannot see.
- **The reading**: adt-strategies gains `utilDiscoveryCollections:
  IResultStrategy<ReadonlySet<string>>` for the `discovery` slot — every
  `app:collection/@href` that is a path, read with `fast-xml-parser` (no regex) —
  and the check is **exact** membership of `/sap/bc/adt/activation/runs`
  (`collections.has(ACTIVATION_RUNS)`), not a prefix match.
- **Discovery that cannot be read** (a failure answer, or a `2xx` the reading
  finds no `app:service` in): the consumer answers that failure, naming that the
  activation endpoint could not be decided, and sends **no** activation request.
  No default endpoint, no try-then-fall-back, no `404` retry. A `404` from
  `/activation/runs` stays the call's failure.
- `fetchDiscoveryEndpoints` / `isEndpointInDiscovery` are left as they are (out of
  the goal); nothing new uses them.

## 4. D3 — `preauditRequested` on every path

Carries: *The caller chooses the next step*, *Every system that activates today
still activates, with the same requests*.

- **interfaces-adt**: a new options type,

  ```ts
  interface IAdtActivationOptions<E extends IAdtError = IAdtError>
    extends IAdtOperationOptions<E> {
    /** Sent as `preauditRequested`. Absent: the member's default. */
    preauditRequested?: boolean;
  }
  ```

  and `IAdtActivatable.activate` takes `{ headers } & IAdtActivationOptions<E>`
  (both overloads). An implementer declaring the narrower `IAdtOperationOptions`
  still conforms (method parameters are bivariant), so this is a minor of
  interfaces-adt — Inference, proved by `test:check` of adt-clients and the server
  before release.
- **adt-clients, every single-object member** (the 26 `activate` members of §1.1,
  `class.activateTestClasses`, the legacy function group override) sends
  `options.preauditRequested ?? true`. **Default `true`**, the value every one of
  them sends today, so no request changes unless the caller asks. The helper's
  parameter loses its default (`activateObjectInSession(…, preaudit: boolean)`),
  so the value is decided once, in the member, from the option. The service
  binding passes the option to `activateRequest`; the behaviour implementation
  passes its options on to the class, unchanged.
- **Group members**: `activateObjectsGroup` and `activateObjects` keep the
  positional `preauditRequested`, default `false` (unchanged for the first).
- The library takes no second activation (its one read, Q7, activates nothing): an
  `ioc` failure is returned; re-posting with
  `preauditRequested=false` is the caller's next call, on whichever member it
  names (`activate` of the object, or `activateObjects` with the references it
  chooses — the failure's `stillInactive` lists what SAP named, which may include
  objects the caller did not name). Measured (D8, L6): re-posting every reference
  of the `ioc` answer, as given, with `preauditRequested=false` activates a
  function group on S/4HANA 2025.

## 5. D4 — `chkl:messages` with `E` stays a refusal on every path

- single object and `activateObjects`: `analyseActivation` (unchanged rows of D1);
- `/activation/runs`: the results document carries `chkl:messages`; the server's
  `activationVerdict` / `isRefusal` already read `E` as a refusal (Code §1.7) and
  stay; a consumer of the library alone passes `analyseActivation` to
  `getActivationResults`.
- Each path is pinned by a test on `refusal-activation-fails` and on the issue's
  751 refusal (D7).

## 6. D5 — 7.40 (adt-clients-legacy)

- **Declared, not discovered.** A 7.40 consumer constructs the legacy classes
  (`CLAUDE.md`); the legacy group is already synchronous. The legacy package reads
  no discovery.
- **The new `activateObjects`** is inherited unchanged: it is exactly the request
  `AdtUtilsLegacy.activateObjectsGroup` sends today, and it is the 7.40 group
  activation (Q3 (a)). **`AdtUtilsLegacy.activateObjectsGroup` refuses** with no
  request, as `getActivationRun` / `getActivationResults` do, because 7.40
  advertises no `/activation/runs` (D8, L2): one endpoint, one member.
- **Single-object `preauditRequested`** reaches the legacy function group override
  (`AdtFunctionGroupLegacy.ts:100-130`) the same way; default `true`.
- **The verdict on 7.40's answers**: every recorded 7.40 activation answer is an
  empty `200` (§1.4, D8 L1), read as activated (Q1 (a)). Q7's read, if 7.40 ever
  answers `activationExecuted="false"` without a message, reads the flat
  `adtcore:objectReferences` list (not measured on 7.40: no such answer seen).
- Legacy changes are a minor (owner, 2026-10-24).

## 7. D6 — the server (mcp-abap-adt#346)

- **Projection**: `terseActivation` loses its `ioc:inactiveObjects` branch and
  `activation_not_stated`; that answer is now a failure before any projection
  runs (D1). `answer.ts` renders `stillInactive` of an `IAdtActivationFailure` as
  `still_inactive: [{ name, type, uri, parent_uri? }]`, field by field as it does
  `messages`. Every tool that passes `analyseActivation` — the `Activate*` tools,
  `ActivateObjects`/`HandlerActivate`, and the 34 other handlers with an
  activate step (step `activate`) — then answers `isError` on an `ioc` answer.
  `UpdateClass` keeps `terseWrite` for its success: the failure comes from the
  activate step.
- **The single-object path honours `preaudit`**: `activateFamily` passes
  `preauditRequested: preaudit`; `preaudit` keeps its default `true` on
  `ActivateObjects`/`ActivateObjectLow`/`HandlerActivate` (today's request);
  `preauditDescription` says it is sent on both paths. Only these three tools take
  `preaudit` (Q4 (a)); a caller of a per-type `Activate*` tool that gets "not
  activated" takes its next step through `ActivateObjects`.
- **The group path reads discovery on every group activation** (Q5 (a); no
  state kept): `getUtils(…).getDiscovery` with `utilDiscoveryCollections`;
  `/activation/runs` listed → today's three requests unchanged; not listed →
  `activateObjects(references, preaudit, { headers, analyse: analyseActivation })`
  projected by `terseActivation`; discovery not readable → that failure, step
  `discovery`, nothing sent. The `detail` description stops saying the group path
  ignores it where the synchronous path answers a document.
- **Header pairs**: a new key `utils.activateObjects` (the member names its
  endpoint).
- **Ranges**: interfaces-adt, adt-strategies and adt-clients from the registry,
  after they are published.

## 8. D7 — tests (no SAP system)

New corpus recordings in `packages/adt-clients/corpus/adt/answers/` (sidecar +
body, the issue as the source, `capturedAt` 2026-11-09, a `note` naming the issue;
object names as the issue gives them):
- `activation-preaudit-still-inactive-751` — the issue's request #1 with its 8-entry
  `ioc:inactiveObjects` (the issue shows two entries in full and names the other
  six by type; the recording carries what the issue shows, and the `note` says so);
- `activation-sync-activated-751` — request #3, `200`, empty body;
- no 751 refusal recording: the `E` path is pinned on the existing
  `refusal-activation-fails` recording (Q6); the reporter is asked in the issue
  for the real body, and it is added when it arrives;
- `activation-runs-absent-751` — request #2, `404`;
- the 751 discovery's activation collections as the issue lists them (a partial
  document, said so in its `note`).

Measured recordings already in the corpus (D8): `activation-class-transportable-s4-2025`,
`activation-group-alone-s4-2025`, `activation-group-second-step-s4-2025`,
`activation-reactivate-active-s4-2025`, `activation-class-basis-740`.

Tests:
- adt-strategies: `analyseActivation` over each row of D1 — the 751 `ioc`
  answer (`stillInactive` lists the 8, transport entry skipped), the server's
  `activation-still-inactive` (copied into this corpus: transport entry + 2
  objects), empty with `preauditRequested=true` and with `false` (activated, Q1),
  an unknown document, the three existing fixtures (the ABAP cloud
  `activation-nothing-to-activate` now with Q7's read: an empty list), and Q7 on
  the two S/4HANA 2025 recordings — `activation-group-alone-s4-2025` 04 with list
  05 → not activated, the group in `stillInactive`;
  `activation-reactivate-active-s4-2025` 03 with list 04 → nothing to activate;
  an entry counted by `parentUri`; the transport-only entry never counted;
  `utilDiscoveryCollections` over the three recorded discovery documents (runs
  listed on S/4HANA 2025 and ABAP cloud, absent on 7.40) and the 751 partial one;
  exact membership (a collection that only starts with the path does not count).
- adt-clients: request shapes — every single-object member with no option sends
  `preauditRequested=true` (today's, `r2RequestShapes` unchanged) and with
  `preauditRequested: false` sends `false`; Q7's `GET /activation/inactiveobjects`
  is sent after an `activationExecuted="false"` answer without a message and
  after no other answer, and a failed read is the call's failure; `activateObjects` sends one `POST
  /activation` with the references and its default `false`; `activateObjectsGroup`
  unchanged; the public surface and the typed-atom tests name the new member and
  slot.
- legacy: `activateObjects` inherited; `activateObjectsGroup` refused with no
  request (Q3); `preauditRequested` on the function group override.
- Each new rule is proved load-bearing: delete it, watch its test go red, restore.
- server (#346): `ActivateClass`, `ActivateObjects` single and group, and
  `UpdateClass activate: true` over the 751 recordings answer `isError` with
  `still_inactive`; `preaudit: false` reaches the single-object wire; the group
  path picks the endpoint from each recorded discovery and sends nothing when
  discovery fails; `activateObjectPreaudit.test.ts` and
  `strategyProjections.test.ts:83-85` are rewritten to the new contract.

## 9. D8 — live measurements (run 2026-11-09, owner's go)

**How.** A hand-run probe (deleted after the run) created each object fresh,
saved it inactive (one method in a class; a changed main program `source/main` in
a function group, since a freshly created group is not inactive — Measured, the
first group run), and sent the single-object request adt-clients sends: `POST
/sap/bc/adt/activation?method=activate&preauditRequested=…`, one
`adtcore:objectReference` (uri and name, no type), Content-Type
`application/vnd.sap.adt.activation+xml`, Accept `application/xml`. After each
activation it read `GET /sap/bc/adt/activation/inactiveobjects` at once and again
about 10 s later, and for a class `GET …/source/main?version=active` (does it
carry the method body). `preauditRequested=false` on the same reference was sent
only where the object was still inactive. Each object was deleted at the end and
its absence confirmed (metadata `404`, quick search empty). The S/4HANA 2025 system
was measured over HTTP (stateful session); the 7.40 system over RFC, because over
HTTP the source `PUT` under a lock answers `423` there (`LEGACY.md`, and again on
this run's first attempt). Records: `packages/adt-clients/corpus/adt/answers/`,
cases `activation-class-transportable-s4-2025`, `activation-group-alone-s4-2025`,
`activation-class-basis-740` (D7's place; transport numbers and the user are
placeholders).

| # | Release, object, package | Request | Answer | Inactive after: at once / ~10 s | Active source |
|---|---|---|---|---|---|
| L1 | 7.40, class, `$TMP` | `preauditRequested=true` | `200`, **empty body** | no / no — **activated** | method body present |
| L3a | S/4HANA 2025, class, `$TMP` | `preauditRequested=true` | `200`, `chkl:messages`, `activationExecuted="true"`, no `msg` | no / no — activated | method body present |
| L3b | S/4HANA 2025, class, transportable | `preauditRequested=true` | `200`, `chkl:messages`, `activationExecuted="true"`, no `msg` | no / no — activated | method body present |
| L3c | S/4HANA 2025, function group alone, transportable | `preauditRequested=true` | `200`, **`ioc:inactiveObjects`**: the transport request, the group (`FUGR/F`), its `source/main` (typed `FUGR/F` in the answer) | **yes / yes** — not activated | — |
| L5 | same group, same single reference | `preauditRequested=false` | `200`, `chkl:messages`, **`activationExecuted="false"`, no `msg`** | **yes / yes** — not activated | — |
| L6 | S/4HANA 2025, another fresh group, transportable, after its own L3c-like `ioc` answer | `preauditRequested=false`, **every reference of the `ioc` answer as given**: the group (`FUGR/F`) and its `source/main` (typed `FUGR/F` by that answer, with `parentUri`) | `200`, `chkl:messages`, `activationExecuted="true"`, no `msg` | no / no — **activated** | — |
| L7 | S/4HANA 2025, class, transportable, **already active** (activated with `true` first) | `preauditRequested=false`, the class alone | `200`, `chkl:messages`, `checkExecuted="false"` **`activationExecuted="false"`** `generationExecuted="true"`, no `msg` | no / no — nothing was inactive | — |

The inactive list after L3c and L5 names the group and `SAPL<group>` (`FUGR/I`,
uri `…/source/main`, on the task of the request), unchanged between the two reads.
L6 and L7 were run second, the same way (records `activation-group-second-step-s4-2025`,
`activation-reactivate-active-s4-2025`). L6 sent the `ioc` answer's references as
they came; that answer types `source/main` `FUGR/F` with the group's name, while
the inactive list names it `FUGR/I` `SAPL<group>`. L5 and L7 differ only in
`generationExecuted` (`false` / `true`); that attribute is not read as a verdict
(Inference: one pair of recordings is no rule).

Discovery (`GET /sap/bc/adt/discovery`), the collections under
`/sap/bc/adt/activation` — Measured:
- **L2**, 7.40 (over RFC; 34 609 characters, the recorded document's size):
  `/activation`, `/activation/inactiveobjects`; **no `/activation/runs`** — the
  2026-10-27 recording confirmed.
- **L4**, S/4HANA 2025 (over HTTP): `/activation`, `/activation/inactiveobjects`,
  `/activation/results`, **`/activation/runs`** — the recording confirmed.

**What the measurements settle** (Measured, the rows above):
- **F2 — `ioc:inactiveObjects` means "not activated", not "activation still
  running".** On S/4HANA 2025 the `ioc` answer (L3c) left the objects inactive in
  both reads, 10 s apart. D1's `ioc` row holds for that release as it does for 751.
  (The server's 2026-09-21 record of a `count: 0` read after an `ioc` answer is not
  reproduced.)
- **Q1 — an empty `200`.** On 7.40 the empty answer to `preauditRequested=true`
  activated (L1, the inactive list and the active source both say so). Neither
  S/4HANA 2025 nor 7.40 answered an empty body to anything that did not activate.
  This supports Q1 (a) for every release measured; an empty answer to `true` was
  not seen on S/4HANA 2025 (it answers `chkl:messages` there).
- **New — F5: `activationExecuted="false"` without a message is not always
  "nothing to activate".** L5 answered it while the group and its main program
  stayed inactive. D1's row "`activationExecuted="false"`, no message → activated —
  nothing to activate" rests on ABAP cloud, where nothing was inactive (§1.2); on
  S/4HANA 2025 the same document came back when something inactive was not
  activated. Read alone, the document cannot tell the two apart (L7 is the same
  document for a re-activation that had nothing to do). See §11 F5; decided by Q7.
- **Q7's read rule holds against both recordings**: after L5 the inactive list
  holds the named group's own uri → not activated; after L7 it is empty → nothing
  to activate.
- **The caller's second step works on S/4HANA 2025** (L6): every reference of the
  `ioc` answer, as given, with `preauditRequested=false` activates the group.
- **L5 is answered for the group only**: `preauditRequested=false` on the
  single-object path gives `chkl:messages`, not an empty body, on S/4HANA 2025.
  For a class `false` was not sent, because `true` had already activated it.
- The class on S/4HANA 2025 is not the 751 case: the same request activated it in
  `$TMP` and in a transportable package.

On 751: the reporter offered to run a branch build (issue, "Workaround in use");
the empty answer to `preauditRequested=true`, if it occurs there, and the full
`chkl:messages` body of the refused activation are the two things worth asking.

## 10. Semver and order

interfaces-adt (minor: `IAdtActivationOptions`; a new atom for `activateObjects`,
beside `IAdtTypedGroupLifecycle`, as 22.0.0 added typed atoms; **major** if the
`objectActivation` slot is added to `IUtilResults`, which every full result set
must then name) → adt-strategies 0.22.0 (`analyseActivation` stricter,
`IAdtActivationFailure`, `utilDiscoveryCollections`) → adt-clients 44.x minor (new
member and slot, the option) → adt-clients-legacy minor → the server (#346). Each
from the registry, published in that order (global rule). No 23.x backport.

## 11. Findings against the goal

- **F1 — an empty answer to a preaudit is a recorded activation on 7.40.** The
  goal's invariant names "an empty answer to a preaudit" as not a success. Every
  single-object activation recorded on SAP_BASIS 7.40 SP04 is
  `preauditRequested=true` answered `200` empty, and the steps after it ran on the
  active version (§1.4). Read literally, the invariant turns every 7.40
  single-object activation into "not activated", against *Every system that
  activates today still activates*. Decided by Q1 (a); confirmed by D8 L1.
- **F2 — S/4HANA 2025 has one record of an `ioc` answer with nothing left
  inactive** (§1.6). Settled by D8 (L3c, L5): the `ioc` answer left the objects
  inactive in both reads 10 s apart; D1's `ioc` row holds for that release.
- **F3 — the goal file names systems.** `docs/superpowers/2026-11-09-activation-751-goal.md`
  names the two test systems by id; `notesNameNoSystem.test.ts` scans `docs/` and
  fails on it. This spec names releases only. The goal is the owner's to edit.
- **F4 — 7.40's group member already sends the request the new member sends**
  (§1.1, D5). Decided by Q3 (a): the legacy `activateObjectsGroup` refuses.
- **F5 — `chkl:messages` `activationExecuted="false"` with no message answered an
  activation that left objects inactive** (D8, L5, S/4HANA 2025, Measured
  2026-11-09: a function group's reference alone with `preauditRequested=false`).
  D1 keeps that document as "activated — nothing to activate", which the goal's
  first invariant ("any answer that does not state the activation … reaches the
  caller as not activated") does not allow when something was left inactive.
  Decided by Q7: one read of the inactive list, in this case only (D1).

## 12. Decisions (owner, 2026-11-09)

Each question as it was asked, with the owner's decision.

**Q1 — What is an empty `200` to an activation?**
- (a) **Activated, whatever `preauditRequested` was.** Pro: every empty answer
  recorded is an activation (7.40 both values, 751 with `false`); 7.40 keeps its
  verdict; one rule. Con: departs from the goal's wording; an empty answer to
  `preauditRequested=true` on 751 or S/4HANA 2025 is not recorded, so it is
  trusted unmeasured.
- (b) **Activated for `preauditRequested=false`, not activated for `true`**, read
  from the answer's own `request.url` (`URLSearchParams`, data from the wire).
  Pro: matches the goal's wording on modern releases. Con: every 7.40
  single-object activation becomes a failure under the shipped strategy — the
  legacy cycles and any 7.40 consumer must clear it with their own `analyse`,
  i.e. a verdict known to be wrong on 7.40 ships as the default.
- (c) **(b) in `analyseActivation`, plus a 7.40 strategy** that reads an empty
  answer as activated, for a legacy consumer to pass. Pro: each release judged by
  what was measured on it. Con: a second activation strategy to keep in step;
  adt-strategies grows release-specific readings (today it has none).

**Decided: (a)** — an empty `200` is activated, whatever `preauditRequested` was.
D8 recorded no empty answer that did not activate (L1 activated).

**Q2 — How the failure names the objects.**
- (a) **A typed field `stillInactive`** (D1). Pro: static, reusable for a next
  call, no parsing of text. Con: a new failure type; the server renders one more
  field.
- (b) **One `E` message per object** (`text` "ZCL_X (CLAS/OC) is still inactive",
  `uri`). Pro: no new type; every consumer that shows messages shows them. Con:
  the type and name live in composed text; `messages` is meant to hold what SAP
  said, and here SAP said no message.

**Decided: (a)** — a typed `stillInactive` field on `IAdtActivationFailure`.

**Q3 — 7.40's two members on one request.** With `activateObjects` added,
`AdtUtilsLegacy.activateObjectsGroup` sends the identical request.
- (a) **Refuse `activateObjectsGroup` on 7.40** like `getActivationRun` (runs not
  advertised), no request; `activateObjects` is the 7.40 group activation. Pro:
  one endpoint, one member; the same choice on every release, by discovery's
  facts. Con: a legacy consumer's working call becomes a refusal (a minor by the
  owner's legacy rule; the server does not use the legacy package).
- (b) **Keep both.** Pro: nothing changes for a legacy consumer. Con: two members,
  one endpoint, on 7.40.

**Decided: (a)** — on 7.40 `AdtUtilsLegacy.activateObjectsGroup` refuses with no request, because `/activation/runs` is not advertised; `activateObjects` is the 7.40 group activation.

**Q4 — Which server tools take `preaudit`.**
- (a) **Only the tools that already declare it** (`ActivateObjects`,
  `ActivateObjectLow`, `HandlerActivate`), now honoured on the single-object path.
  Pro: no new parameter; one tool is the next step after any "not activated".
  Con: `ActivateClass` and the other per-type tools cannot send `false`; a caller
  switches tools for the second step.
- (b) **Also every per-type `Activate*` tool.** Pro: the next step on the tool the
  caller used. Con: 17 schemas and descriptions grow a parameter.
- (c) **(b) plus `Create*`/`Update*` with `activate: true`.** Pro: one call can save
  and activate on 751. Con: up to 34 more schemas; a write tool grows an activation
  detail.

**Decided: (a)** — only `ActivateObjects`, `ActivateObjectLow` and `HandlerActivate` take `preaudit`, now honoured on the single-object path too.

**Q5 — When the server reads discovery for a group activation.**
- (a) **On every group activation**, one `GET /discovery` before the `POST`. Pro:
  no state, nothing to invalidate, nothing the server remembers about a system.
  Con: one more request per group activation.
- (b) **Once per connection**, kept with the connection for its lifetime. Pro: one
  read. Con: state the server holds; a discovery read failure must be retried by
  a later call, and the cache needs an owner.

**Decided: (a)** — discovery is read on every group activation.

**Q6 — The 751 refusal body.** The issue describes the `chkl:messages` `E`
answer but does not quote it.
- (a) **Record it as described** (a reconstructed body, the `note` says so). Pro:
  no wait. Con: a recording that is not a capture.
- (b) **Ask the reporter for the body** (they offered to run builds). Pro: a real
  capture. Con: waits on them.
- (c) **Pin the `E` path on the existing `refusal-activation-fails` recording
  only.** Pro: real bytes. Con: no 751 bytes for that case.

**Decided: (c), with (b) asked** — the `E` path is pinned on the existing
`refusal-activation-fails` recording; the reporter is asked in the issue for the
real body, which replaces nothing until it arrives and is then added.

**Q7 — `chkl:messages` `activationExecuted="false"` with no message (F5).** The
same document answered an activation that left objects inactive (D8 L5) and the
re-activation of an object already active (L7).

**Decided:** for that document only, the library reads
`GET /sap/bc/adt/activation/inactiveobjects` once, limited to the named objects
(the references the activation request sent; an entry counts by its `uri` or its
`parentUri`). Any still listed → "not activated", with `stillInactive`; none →
"nothing to activate", a success. Rationale: the document cannot tell the two
cases apart, and a re-activation of an already active object must not become a
false failure — nor may an activation that left objects inactive pass as a
success. The read changes nothing on the system and activates nothing. Cost: one
extra `GET`, in this case only; every other answer is judged as it came (D1).
