# Spec: type groups (`TYPE/DG`) in adt-clients

This spec answers to `2026-11-28-type-groups-goal.md`. Where the two disagree, the goal wins
and this spec changes.

## 1. Measurement establishes the rows

The table rows are written from measurements, and nothing is published before those
measurements are taken. The integration suite (section 5.3) verifies the public API afterwards,
against rows that are already fixed. It is not how a row gets filled.

### 1.1 How it is measured

There is one measurement script per system, sent through the connector and not through the
library's members. That keeps a member's variant gate from deciding what is asked:

- **Cloud:** run on the cloud test system.
- **On premise:** the on-premise twin, run through the tunnel.

What the script does:
- It uses only a `Z` type group of its own in the system's configured test package (on premise
  `$TMP`, or the package and transport given), and deletes it at the end, also after a
  failure.
- It addresses the object by the name exactly as given.
- It stops at once on any 401.
- It sends, in order:
  1. validation, with and without `packagename`, for a free name, a taken one, one that is too
     long, and with `objtype=typedg`;
  2. create, with `sap-language` and an optional `corrNr`;
  3. the metadata and source reads with `?version=inactive`, and a source read with
     `withLongPolling=true`;
  4. lock, a source write carrying `If-Match` from the read's etag and an optional `corrNr`,
     then unlock;
  5. activation;
  6. the reads with `?version=active`, the version list, and one entry's version source;
  7. lock, `DELETE ?lockHandle` with an optional `corrNr`, unlock, and a final read.
- Every exchange is recorded whole.

### 1.2 How an answer decides

Each operation's answer gets the goal's three-way classification:

- **Served.** The operation's own handler answered: a success, or a refusal of this object or
  these arguments, such as `400 InvalidTypeGroupName`. The operation is in the row.
- **Not offered.** The resource framework has no handler for the request: `404` "No suitable
  resource found", or `405 ExceptionMethodNotSupported`. The operation is out of the row.
- **Decides nothing.** An authorization refusal, or any answer that is neither of the above.
  The operation stays unmeasured. It is not in the cloud row (goal, availability step 4); on
  premise, discovery and then typestructure decide.

### 1.3 What the measurements show

Both runs of 1.1 are done: the cloud test system and S/4HANA 2025 on premise (the corpus cases
`type-group-cycle-*`, `type-group-reads-*`), beside the tracking issue's earlier on-premise
recordings. Not measured on either system: `corrNr` (both runs used a package without a
transport) and `withLongPolling` on the metadata read.

| Operation | On premise | ABAP Cloud (test system) |
|---|---|---|
| validate | served: valid 200, empty body; taken or too long 400 `InvalidTypeGroupName` | served: valid 200, empty body, with and without `packagename`; taken (`SLIS`) 400 `InvalidTypeGroupName` "already exists"; 7 characters 400 `InvalidTypeGroupName` (E2/129, "maximum of five characters"); `objtype=typedg` 400 |
| create | served: 200, empty body | **decides nothing:** 403 `ExceptionResourceNoAuthorization`, EU/519, `S_DEVELOP`, in the cloud test system's test package |
| readMetadata | served: 200 v3 and v2 | served: 200 v3 and v2, and `?version=active` |
| read / source | served: 200 `text/plain` | served: 200, and `?version=active`, and `withLongPolling=true` (answered at once) |
| update (source write) | served: 200, with `If-Match` from the source read's etag (`type-group-cycle-s4-2025--13`) | not measured: no object of its own (create decides nothing) |
| lock / unlock | served: 200 / 200 | not measured: no object of its own |
| activate | served: `chkl:messages`, `activationExecuted="true"` | not measured: no object of its own |
| versions: list | served: 200 atom feed | served: 200 atom feed |
| versions: version source | served: 200 `text/plain` (`…--19`) | served: 200 `text/plain` |
| delete | served: 200, then the read answers 404 | not measured: no object of its own |
| name in the path as given (upper case) | served: every request of the cycle addressed `ZTG3A` in upper case | served: `GET …/typegroups/ABAP` and `…/ABAP/source/main` 200 |

The cloud row is therefore: `validate`, `readMetadata`, `read`, `source`, `versions`.

- Create and every write stay out of the cloud row, because none can be measured there: the
  create answer is an authorization refusal, and without an object of its own no write runs.
- Discovery's empty `app:accept` for the collection agrees, though by the goal's rule it is not
  what decides.

The on-premise row is every operation of the goal: each one measured served.

## 2. The contract package: `@mcp-abap-adt/interfaces-adt` (a minor)

Types and constants only, as the package holds no logic.

### 2.1 API name, config, results

- `AdtApiName` gains `'typeGroup'`.
- `ITypeGroupConfig`:

  ```ts
  export interface ITypeGroupConfig {
    typeGroupName: string;
    packageName?: string | undefined;
    description?: string | undefined;
    transportRequest?: string | undefined;
    masterLanguage?: string | undefined;
    source?: string | undefined;
  }
  ```

  The fields match those of `ITransformationConfig`, without its `transformationType`:
  - The measured create body carries `adtcore:type="TYPE/DG"`, and nothing in it selects a
    kind.
  - Whether type groups have subtypes is unverified. This task sends only `TYPE/DG`.

- `ITypeGroupResults`, one `IResultStrategy<unknown>` per slot the members answer: `validation`,
  `created`, `metadata`, `source`, `updated`, `activation`, `deletion`, `versions`,
  `versionSource`.
  - Lock and unlock have no slot, as for every lockable type: their answers are the atom's
    `string` and `void` (section 3.2).
  - There are no slots for operations outside the goal.

### 2.2 The new atom `IAdtLockedDeletable`

`IAdtDeletable` does not fit, for two reasons:
- it pairs `delete` with `checkDeletion`, and the deletion check is out of this task;
- its `delete` takes no lock handle, while the measured delete is `DELETE …/{name}?lockHandle=…`
  under the caller's lock.

So a new atom, beside `IAdtDeletable`:

```ts
export interface IAdtLockedDeletable<TConfig, TDeleted, TRequired extends keyof TConfig> {
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<TConfig, TRequired>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & IAdtLockedWrite & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<TDeleted, E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<TConfig, TRequired>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions & IAdtLockedWrite,
  ): Promise<IAdtResponse<TDeleted>>;
}
```

`delete` keeps `IAdtDeletable`'s own name and overload shape, adds `IAdtLockedWrite`, and drops
`checkDeletion`. No other atom changes.

### 2.3 The rows, written from section 1.3

```ts
typeGroup: {
  kind: 'type_group',
  collection: '/sap/bc/adt/ddic/typegroups',
  codes: {
    'TYPE/DG': {
      main: 'TYPE',
      parent: null,
      nameMaxLength: 5,
      operations: [ … ],
      evidence: 'system-description-<release>--07-typestructure',
    },
  },
},
```

- **`ADT_TYPES_ONPREM` (`s4-2025`):** `validate`, `create`, `readMetadata`, `read`, `source`,
  `update`, `lock`, `unlock`, `activate`, `versions`, `delete`. Each is measured served (section 1.3).
- **`ADT_TYPES_CLOUD` (`abap-cloud`):** `validate`, `readMetadata`, `read`, `source`, `versions`.
- `nameMaxLength` 5 is typestructure's `OBJNAME_MAXLENGTH` on both releases, and the cloud test system's
  E2/129 says the same.
- The code `TYPE/DG` enters the tables' code types (`typeCodeScan.ts`).

## 3. adt-clients (a minor)

### 3.1 Files

- `src/core/typeGroup/`, laid out like `transformation/`: `AdtTypeGroup.ts`, `types.ts`,
  `validation.ts`, `create.ts`, `read.ts`, `update.ts`, `lock.ts`, `unlock.ts`,
  `activation.ts`, `versions.ts`, `delete.ts`, `index.ts`.
- `src/endpoints/objects.ts`: a `TYPE_GROUP` record. Its `uri` encodes the name exactly as
  given, with `encodeURIComponent` and no case change. It does not use `seg`, which lower-cases:
  the goal's "names as given" wins over what the siblings do.

  ```ts
  export const TYPE_GROUP = {
    collection: '/sap/bc/adt/ddic/typegroups',
    validation: '/sap/bc/adt/ddic/typegroups/validation',
    uri: (name: string) => `/sap/bc/adt/ddic/typegroups/${encodeURIComponent(name)}`,
  };
  ```

- `src/constants/contentTypes.ts`: `ACCEPT_TYPE_GROUP =
  'application/vnd.sap.adt.ddic.typegroups.v3+xml'`.
- `types.ts`:
  - `typeGroupDocuments`, `rawDocument` in every slot, `satisfies ITypeGroupResults`;
  - the snake_case create, update and delete params.
- `AdtClient.getTypeGroup()`: two overloads, gated `this: this & AdtServedBy<'typeGroup'>`.
- `src/index.ts`: `AdtTypeGroup`, `TypeGroupValues` and `typeGroupDocuments`.

### 3.2 `AdtTypeGroup<T, V>` and its members

```ts
export class AdtTypeGroup<T extends TypeGroupValues = ResultValuesOf<typeof typeGroupDocuments>,
                          V extends AdtVariant = AdtModernVariant>
  implements IAdtValidatable<ITypeGroupConfig, T['validation'], 'typeGroupName'>,
             IAdtCreatable<ITypeGroupConfig, T['created']>,
             IAdtMetadataReadable<ITypeGroupConfig, T['metadata'], 'typeGroupName'>,
             IAdtReadable<ITypeGroupConfig, T['source'], 'typeGroupName'>,
             IAdtUpdatable<Partial<ITypeGroupConfig>, T['updated'], 'typeGroupName', 'source'>,
             IAdtLockable<ITypeGroupConfig, 'typeGroupName'>,
             IAdtActivatable<ITypeGroupConfig, T['activation'], 'typeGroupName'>,
             IAdtVersionable<ITypeGroupConfig, T['versions'], T['versionSource'], 'typeGroupName'>,
             IAdtLockedDeletable<ITypeGroupConfig, T['deletion'], 'typeGroupName'>
```

How the members are built:
- Every member takes `timeout` through `withCallTimeout`.
- `create`, `update`, `lock`, `unlock`, `activate` and `delete` are gated
  `this: this & AdtPerformedBy<'typeGroup', '<op>'>`, since the cloud row lacks them.
- `validate`, the reads and `versions` are served on both variants, so they need no gate.

How each member answers:
- Every member but `lock` and `unlock` answers through `answering(send, this.results.<slot>,
  options?.analyse)`. That is one request, and the slot and the caller's `analyse` are applied
  to it.
- `activate` uses `answering` too, never `answeringActivation`: one request, and no read after
  it.
- `lock` answers through `answering` with `lockHandleOf` as its strategy: the handle, `''` when
  SAP sent none. It records the handle in the lock registry (`createLockTracker`).
- `unlock` answers with `nothing`, and releases the handle in the registry.

| Member | Request | Headers sent | Evidence |
|---|---|---|---|
| `validate(config, options?)` | `POST …/typegroups/validation?objtype=TYPE%2FDG&objname=<name>[&packagename=<pkg>][&description=<d>]` | `Accept: application/vnd.sap.as+xml` | on premise: issue recordings `40`/`53`–`56`; cloud: `validate-*`, `packagename` included |
| `create(config, { headers, … })` | `POST …/typegroups[?corrNr=<t>]` | the caller's pair; `sap-language` when `masterLanguage` is given | body: issue `62-create`; `sap-language` with the v3 pair: `type-group-cycle-s4-2025--07`. `corrNr`: unverified |
| `readMetadata(config, options?)` | `GET …/typegroups/<name>[?version=…][&withLongPolling=true]` | `Accept: options.accept ?? ACCEPT_TYPE_GROUP` | both measured, with `version=inactive` / `active` (`…--09`, `…--16`, cloud `14`); `withLongPolling`: unverified |
| `read(config, version?, options?)` | `GET …/<name>/source/main[?version=…][&withLongPolling=true]` | `Accept: options.accept ?? 'text/plain'` | both measured; cloud also `version=active` and `withLongPolling` |
| `update(config, { headers, lockHandle, source, ifMatch? })` | `PUT …/<name>/source/main?lockHandle=<h>[&corrNr=<t>]` | the caller's pair; `If-Match` when given | issue `66-write-source`; `If-Match`: `type-group-cycle-s4-2025--13`; `corrNr`: unverified |
| `lock(config, options?)` | `POST …/<name>?_action=LOCK&accessMode=MODIFY`, stateful for this request only | `Accept: ACCEPT_LOCK` | issue `65-lock`, `71-lock-for-delete` |
| `unlock(config, lockHandle, options?)` | `POST …/<name>?_action=UNLOCK&lockHandle=<h>`, stateful for this request only | none of its own | issue `67-unlock`, `73-unlock-after-delete` |
| `activate(config, { headers, preauditRequested? })` | `POST /sap/bc/adt/activation?method=activate&preauditRequested=<true unless false>` | the caller's pair (measured: `Accept: application/xml`, `Content-Type: application/vnd.sap.adt.activation+xml`) | issue `68-activate` |
| `getVersions(config, options?)` | `GET …/<name>/source/main/versions` | `Accept: application/atom+xml;type=feed` | issue `37-slis-versions`; cloud `05-versions` |
| `getVersionSource(contentUri, options?)` | `GET <contentUri>` | `Accept: text/plain` | `type-group-cycle-s4-2025--19`; cloud `12-version-source` |
| `delete(config, { headers, lockHandle })` | `DELETE …/<name>?lockHandle=<h>[&corrNr=<t>]` | the caller's pair | issue `72-delete`, `type-group-cycle-s4-2025--21`; `corrNr`: unverified |

The activation body is the measured `adtcore:objectReferences`. It names `TYPE_GROUP.uri(name)`
and the name as given.

The create body is the measured one (issue `62-create`), with every value XML-escaped and
nothing else changed:

```xml
<?xml version="1.0" encoding="UTF-8"?><atypgr:abapTypeGroup
  xmlns:atypgr="http://www.sap.com/adt/ddic/typegroups" xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="<description>" adtcore:language="<language>" adtcore:masterLanguage="<language>"
  adtcore:name="<name>" adtcore:type="TYPE/DG">
  <adtcore:packageRef adtcore:name="<package>"/>
</atypgr:abapTypeGroup>
```

- **Names as given.** The name and the package are sent as the caller gave them: no upper- or
  lower-casing, no trimming. The only change is the encoding the context needs: URL encoding in
  a path or query, XML escaping in a body. The name's length is never checked.
- **No description truncation.** The description is sent whole. `limitDescription` is not used,
  because no measurement and no SAP handler shows a limit for type groups; SAP refuses a value it
  does not take.
- **Optional parts are sent only when the caller gives them.**
  - The language attributes (measured in `62-create`) and `sap-language` are written only when
    `masterLanguage` is given (`languageAttributes`, `createRequestHeaders`). No value is
    invented.
  - `corrNr` is sent only when `transportRequest` is given.
  - `sap-language` is measured served on premise (`type-group-cycle-s4-2025--07`).
  - `corrNr` and the metadata read's `withLongPolling` are unverified: no run had a transport,
    and none sent long polling on the metadata. They are kept, as every source type sends them,
    and the on-premise live suite proves them before adt-clients is tagged: a case in a
    transportable package with the overlay's transport, and a metadata read with long polling.
    One that is refused is removed from the member before the tag.

## 4. adt-strategies

No change. Under the default verdict a 2xx is the value and anything else the failure, and that
reads every measured answer (section 1.3). A consumer's `analyse` judges anything further,
`activationExecuted` included.

## 5. Tests

### 5.1 Corpus

Everything goes into `corpus/adt/answers/` in the existing JSON + body format, scrubbed by the
corpus rule:
- **Scrubbing.** Every field is scrubbed: params, headers, bodies and escaped JSON. Host, SID,
  client, user, load-balancer and session headers are replaced by the corpus placeholders. The
  probe object's own name and its package stay.
- **The recordings that go in:**
  - the tracking issue's S/4HANA 2025 recordings (cycle, validation, reads);
  - the read-only probes of both systems;
  - the cloud test system's measurement run: the validation answers, the create refusal, the version
    source, the upper-case and `withLongPolling` reads;
  - the on-premise measurement run (`type-group-cycle-s4-2025`), refusals included.
- **Names.** Case names are `type-group-<step>-s4-2025` and `type-group-<step>-abap-cloud`.

### 5.2 Unit tests (no SAP system), `core/typeGroup/typeGroup.test.ts`

- **The request.** Each member against a recording connection:
  - sends exactly one request, the table's: URL, method, every header and the body;
  - takes the name as given: a mixed-case name arrives unchanged in the path, query and body;
  - sends a long description whole.
- **`activate`** sends one request, and nothing more after any checklist, including one with
  `activationExecuted="false"` and no message.
- **The session.** Only `lock` and `unlock` touch the session type
  (`capabilities/behaviour.test.ts`).
- **The answers.** Each member answers its corpus recording through `typeGroupDocuments`
  unchanged: the validation's empty 200 is no failure, its 400 `InvalidTypeGroupName` is a
  failure carrying the response, and the cloud create's 403 is a failure.
- **Strategies are forwarded.**
  - Each member built with a custom result set answers what that set's slot made of the wire
    answer.
  - A caller's `analyse` is called once per member with that wire answer, and its verdict is
    the result's.
  - For `activate`, `analyse` gets no `context`: no second request and no verdict of the
    library's.
- **`lock` and `unlock`.** `lock` answers the handle from a lock recording and `''` without one;
  `unlock` answers nothing.
- **Variant gates (`clients/variantGates.test.ts`).**
  - On cloud, `create`, `update`, `lock`, `unlock`, `activate` and `delete` do not compile, and
    the other members do.
  - On premise all of them compile.
- **Tables and records.**
  - `endpoints/typeTables.test.ts`: the rows' evidence names a typestructure case of its
    release, and `nameMaxLength` equals its `OBJNAME_MAXLENGTH`.
  - `endpoints/objects.test.ts`: the record keeps a name's case.
- **The capability manifest** gains `typeGroup` and the atom `lockedDeletable: ['delete']`.
  `activatingApis.ts` lists the type group as one-request activation.
- **The guards stay green:** `publicApiSurface`, `noHardcodedObjectAddresses`, `typeCodeScan` and
  `onlyCorpusStrategiesShip`.

### 5.3 Integration tests (live), `integration/core/typeGroup/TypeGroup.test.ts`

The suite verifies the public API on the fixed rows. Every operation in a variant's row has a
case of its own, enabled by that row, and `lock` never runs without its `unlock`.

The test-config template gains a `type_groups` section: names of at most 5 characters under the
customer mask, and the package, transport, description and source. An overlay gives a system's
values.

- **On premise**, one case per operation, each asserting its own answer:
  1. validate a free name, a taken one (`SLIS`), and one that is too long;
  2. create;
  3. read the metadata and the source, with `version` inactive;
  4. lock, write the source with `If-Match`, unlock, and prove the lock released
     (`expectLockReleased`);
  5. activate;
  6. read active;
  7. list the versions, and read one version's source;
  8. lock, delete, unlock;
  9. read again: 404;
  10. in a transportable package with the overlay's transport: create, write and delete carrying
      `corrNr`, and a metadata read with `withLongPolling=true`.
- **On ABAP Cloud**, one case per operation in its row:
  - validation: a free name, a taken one (`SLIS`), one too long;
  - the metadata and the source of an SAP type group (`ABAP`), with and without
    `version=active`;
  - its version list, and one version's source.
  - The cloud row has no create, lock, unlock, update, activate or delete, so the suite has no
    case for them. That operations outside the row do not compile is the unit gate test.
- **Package.** The test package and its transport come from the overlay.
  - On premise `$TMP` may be used.
  - On cloud the cloud test system's test package is used, since a create into `$TMP` on the cloud test system is
    refused. An earlier probe in this project measured that refusal, but no recording of it is
    in the corpus, so for this spec it is unverified.
- **Cleanup.** Whatever the suite creates it deletes, also on failure, and a failing case logs
  SAP's status and message.

## 6. Release order

1. **Measure.** Both runs are done (section 1.3), and they settle both rows.
2. **interfaces-adt minor:** `'typeGroup'`, `ITypeGroupConfig`, `ITypeGroupResults`,
   `IAdtLockedDeletable`, and both rows as section 2.3 fixes them. It is published, and a clean
   install of it from the registry, outside the repository, is checked.
3. **adt-clients,** against the published range:
   - the module, the corpus and the unit tests;
   - the live suite, run on premise and on the cloud test system against the published rows.
   - A live failure that shows a row wrong stops the release. The measurement is redone, and the
     row is corrected before adt-clients is tagged. No patch is planned to finish a row.
4. **adt-clients minor:**
   - Before tagging, every `package.json` of the release declares only semver ranges, every
     range resolves on the registry, and the lockfile holds no link but the workspace siblings.
   - It is tagged `adt-clients-v<version>` and published, then a clean install from the registry,
     outside the repository, is checked.
   - adt-strategies and adt-clients-legacy have no change and no release.
5. **mcp-abap-adt** takes the published adt-clients and adds its tools in its own change.

## 7. Documentation

- **adt-clients:**
  - `README.md`: the type group in the object and factory lists, its members per variant, and
    its activation as one request;
  - `docs/usage/`: the members and their requests;
  - `docs/usage/ERRATA.md`, one entry per measured ambiguity: validation's `objtype` must be
    `TYPE/DG`; a valid name answers an empty 200; the metadata read without any Accept answers
    400; and the cloud create's 403 next to discovery's empty `app:accept`;
  - `docs/architecture/` where it lists object types or atoms;
  - `CHANGELOG.md`.
- **interfaces-adt:**
  - `README.md` and its docs where they list API names, atoms or the tables;
  - `CHANGELOG.md`: the name, the types, the atom and the rows.
- Each repository's docs are swept for every list of object types the change extends.
