# Spec: type groups (`TYPE/DG`) in adt-clients

This spec answers to `2026-11-28-type-groups-goal.md`. Where the two disagree, the goal wins
and this spec changes.

## 1. The contract package: `@mcp-abap-adt/interfaces-adt` (a minor)

Types and constants only, as the package holds no logic.

### 1.1 API name and config

- `AdtApiName` gains `'typeGroup'`.
- `ITypeGroupConfig` (new file `adt/IAdtTypeGroup.d.ts` in the source tree):

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

  The fields match those of `ITransformationConfig`, without `transformationType`. A type group
  has no subtype: the measured create body carries `adtcore:type="TYPE/DG"` and nothing that
  selects a kind.

- `ITypeGroupResults`, one `IResultStrategy<unknown>` per slot the members answer:
  - `validation`, `created`, `metadata`, `source`, `updated`, `activation`, `deletion`,
    `versions`, `versionSource`.
  - It has no `check`, `metadataUpdated`, `transport` or `deletionCheck` slot: those operations
    are out of this task.

### 1.2 The new atom `IAdtLockedDeletable`

`IAdtDeletable` does not fit, for two reasons:
- it pairs `delete` with `checkDeletion`, and the deletion check is out of this task;
- its `delete` takes no lock handle, while the type group's delete is the measured
  `DELETE …/{name}?lockHandle=…` under the caller's lock.

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

The handle is required by type, as every locked write's is (`IAdtLockedWrite`). No other
type's atoms change.

### 1.3 The table rows

The rows go into `ADT_TYPES_ONPREM` and `ADT_TYPES_CLOUD`, in the DDIC group beside
`tableType`:

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

- **On premise** (`s4-2025`), operations: `validate`, `create`, `readMetadata`, `read`,
  `source`, `update`, `lock`, `unlock`, `activate`, `versions`, `delete`.
  - All of them are measured except the version source (`versions` names both halves). The live
    suite measures it before the release (section 4.3).
  - If it is not served there, `versions` leaves the row.
- **ABAP Cloud** (`abap-cloud`), operations: exactly those the trial measures served before the
  release, by the goal's availability rule.
  - Measured served today: `readMetadata`, `read`, `source`, and the version list.
  - The rest are measured in the live cloud suite: `validate`, `create`, `lock`, `unlock`,
    `update`, `activate`, `delete`, and the version source.
  - A measurement outranks discovery's empty `app:accept`.
  - The cloud row is written in the last step before the release, from the trial's results.
- `nameMaxLength` 5 is typestructure's `OBJNAME_MAXLENGTH` on both releases. `read` and
  `source` name the source read, as on every other source object's row.

The type code `TYPE/DG` enters the tables' code types, so a literal `'TYPE/DG'` in adt-clients
compiles (`typeCodeScan.ts`).

## 2. adt-clients (a minor)

### 2.1 Files

- `src/core/typeGroup/`, laid out like `transformation/`:
  - the module files: `AdtTypeGroup.ts`, `types.ts`, `validation.ts`, `create.ts`, `read.ts`,
    `update.ts`, `lock.ts`, `unlock.ts`, `activation.ts`, `versions.ts`, `delete.ts`,
    `index.ts`;
  - no `check.ts`.
- `src/endpoints/objects.ts`: a `TYPE_GROUP` record in the registry:

  ```ts
  export const TYPE_GROUP = {
    collection: '/sap/bc/adt/ddic/typegroups',
    validation: '/sap/bc/adt/ddic/typegroups/validation',
    uri: (name: string) => `/sap/bc/adt/ddic/typegroups/${seg(name)}`,
  };
  ```

  `seg` lower-cases and encodes, as the record's siblings do. The measured requests address the
  object in lower case.
- `src/constants/contentTypes.ts`: `ACCEPT_TYPE_GROUP =
  'application/vnd.sap.adt.ddic.typegroups.v3+xml'`.
- `src/core/typeGroup/types.ts`:
  - `typeGroupDocuments`, `rawDocument` in every slot, `satisfies ITypeGroupResults`;
  - the snake_case `ICreateTypeGroupParams`, `IUpdateTypeGroupParams` and
    `IDeleteTypeGroupParams`.
- `AdtClient.getTypeGroup()`: two overloads, gated `this: this & AdtServedBy<'typeGroup'>`, as
  `getTransformation()` is.
- `src/index.ts` exports:
  - `AdtTypeGroup`, `TypeGroupValues` and `typeGroupDocuments`;
  - `ITypeGroupConfig` / `ITypeGroupResults` stay in the contract package, not re-exported.

### 2.2 `AdtTypeGroup<T, V>` and its members

The class declaration:

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
- The constructor and the lock tracker are as in `AdtTransformation`.
- Every member takes `timeout` through `withCallTimeout` and answers through `answering`.
  That includes `activate`, which uses `answering` and not `answeringActivation`.
- Each member that a release may not serve is gated
  `this: this & AdtPerformedBy<'typeGroup', '<op>'>`. That is every member, since the cloud
  row starts with reads only.

| Member | Request | Headers sent | Body |
|---|---|---|---|
| `validate(config, options?)` | `POST /sap/bc/adt/ddic/typegroups/validation?objtype=TYPE%2FDG&objname=<NAME>[&packagename=…][&description=…]` | `Accept: application/vnd.sap.as+xml` (`ACCEPT_VALIDATION`) | none |
| `create(config, { headers, … })` | `POST /sap/bc/adt/ddic/typegroups[?corrNr=…]` | the caller's pair; `sap-language` when `masterLanguage` is given (`createRequestHeaders`) | `atypgr:abapTypeGroup` (below) |
| `readMetadata(config, options?)` | `GET /sap/bc/adt/ddic/typegroups/<name>[?version=…][&withLongPolling=true]` | `Accept: options.accept ?? ACCEPT_TYPE_GROUP` | — |
| `read(config, version?, options?)` | `GET …/<name>/source/main[?version=…][&withLongPolling=true]` | `Accept: options.accept ?? 'text/plain'` (`ACCEPT_SOURCE`) | — |
| `update(config, { headers, lockHandle, source, ifMatch? })` | `PUT …/<name>/source/main?lockHandle=…[&corrNr=…]` (`writeQuery`) | the caller's pair; `If-Match` when given (`updateRequestHeaders`) | the source as given |
| `lock(config, options?)` | `POST …/<name>?_action=LOCK&accessMode=MODIFY`, stateful for this request only (`inStatefulSession`) | `Accept: ACCEPT_LOCK` | — |
| `unlock(config, lockHandle, options?)` | `POST …/<name>?_action=UNLOCK&lockHandle=…`, stateful for this request only | none of its own | — |
| `activate(config, { headers, preauditRequested? })` | `POST /sap/bc/adt/activation?method=activate&preauditRequested=<true unless false>` (`activateObjectInSession`) | the caller's pair | `adtcore:objectReferences` naming `/sap/bc/adt/ddic/typegroups/<name>` and `<NAME>` |
| `getVersions(config, options?)` | `GET …/<name>/source/main/versions` | `Accept: application/atom+xml;type=feed` | — |
| `getVersionSource(contentUri, options?)` | `GET <contentUri>` | `Accept: text/plain` | — |
| `delete(config, { headers, lockHandle })` | `DELETE …/<name>?lockHandle=…[&corrNr=…]` | the caller's pair (`requestHeaders`) | none |

The create body is the measured one, built from the config with the module's shared helpers
(`escapeXmlAttr`, `limitDescription`, `languageAttributes`):

```xml
<?xml version="1.0" encoding="UTF-8"?><atypgr:abapTypeGroup
  xmlns:atypgr="http://www.sap.com/adt/ddic/typegroups" xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:description="…" adtcore:language="…" adtcore:masterLanguage="…"
  adtcore:name="<NAME>" adtcore:type="TYPE/DG">
  <adtcore:packageRef adtcore:name="<PACKAGE>"/>
</atypgr:abapTypeGroup>
```

Notes on the members:
- **Names.** `validate` and `create` send the name in upper case, which is what was measured.
  Addresses go through `TYPE_GROUP.uri`. The name's length is never checked (goal, "does not
  second-guess SAP").
- **What answers what.**
  - `validate`: a valid name answers an empty `200`, which is no failure under the default
    verdict (`answering`: a 2xx is the value). A refused name answers `400`, which is the
    failure. No reading is added to adt-strategies.
  - `create`: answers an empty `200`. `delete`: answers `200`.
  - `activate`: answers the checklist as it came. `activationExecuted` is the consumer's
    `analyse`'s to read (adt-strategies' `analyseActivation`).
- **Not measured for type groups**, each proven by the live suites (section 4.3) before the
  release: `packagename` on `validate`; `corrNr` on create, write and delete; `If-Match`; and
  `?version=` on the reads.
- **Lock bookkeeping.** `lock` records the handle in the client's lock registry, and `unlock`
  releases it, as every lockable type does (`createLockTracker`).

### 2.3 What changes elsewhere in adt-clients

Each of these is additive:
- The capability manifest (`__tests__/unit/capabilities/manifest.ts`) gains `typeGroup` with
  its atoms, and gains the new atom `lockedDeletable: ['delete']`.
- `activatingApis.ts` lists the type group as an activation member that sends one request: the
  follow-up read is asserted absent for it.
- `publicApiSurface.test.ts` gains the new exported values.

## 3. adt-strategies

No change. The default verdict reads every answer a type group gives (section 2.2).

## 4. Tests

### 4.1 Corpus

- **Where the recordings go.** The S/4HANA 2025 recordings of the type group cycle, validation
  and reads (the tracking issue's set), and the trial's read-only answers, go into
  `corpus/adt/answers/` in the existing JSON + body format.
- **Names.** Case names use `type-group-<step>-s4-2025` and `type-group-<step>-abap-cloud`.
- **Scrubbing.** Every field is scrubbed by the corpus rule: params, headers, bodies and escaped
  JSON. Host, SID, client, user and the load-balancer header are replaced by the corpus
  placeholders. The object name `ZTG48` and `$TMP` stay, since they name nothing of a system.
- **Discovery.** The discovery and typestructure corpus already hold both releases' entries; no
  new capture is needed.

### 4.2 Unit tests (no SAP system)

- **`core/typeGroup/typeGroup.test.ts`.** Each member against a recording connection asserts the
  table's request exactly:
  - the URL, the method, every header and the body;
  - that it sends one request and nothing more, `activate` included;
  - that no member but `lock` / `unlock` touches the session type.
- **The answers.** Each member answers the corpus recording through `typeGroupDocuments`
  unchanged. The validation answers are an empty `200` (no failure) and a `400`
  `InvalidTypeGroupName` (a failure carrying the response).
- **Variant gates (`clients/variantGates.test.ts`).**
  - `getTypeGroup()` compiles on both variants.
  - On cloud, every member outside the cloud row does not compile.
  - Type-level cases go in the existing typecheck fixtures.
- **Table and endpoint tests.**
  - `endpoints/typeTables.test.ts` covers the new rows: evidence names a typestructure case of
    its release, and `nameMaxLength` equals typestructure's `OBJNAME_MAXLENGTH`.
  - `endpoints/objects.test.ts` covers the new record.
- **The repository's guard tests** stay green: `noHardcodedObjectAddresses`, `typeCodeScan`,
  the stateful-session tests in `capabilities/behaviour.test.ts`, `activatingApis`,
  `publicApiSurface`, and `onlyCorpusStrategiesShip`.

### 4.3 Integration tests (live)

`src/__tests__/integration/core/typeGroup/TypeGroup.test.ts`. Its cases come from
`test-config.yaml.template`:
- a `type_groups` section, with names of at most 5 characters under the customer mask;
- `create_type_group`, with package, description and source.

The overlays carry the system's values. Each case is enabled by the variant's row (what the
system serves), not by a flag of convenience.

- **On premise, the whole cycle, each step its own assertion:**
  1. validate a free name, then a taken one (`SLIS`);
  2. create;
  3. read the metadata and the source;
  4. lock, write the source, unlock — and prove the lock released (`expectLockReleased`);
  5. activate, then read the source active;
  6. list the versions, then read one version's source;
  7. lock, delete, unlock;
  8. read again: 404.
- **On ABAP Cloud, each listed operation in a case of its own:**
  - validation with names of its own;
  - the reads, the version list and the version source against an SAP type group (`ABAP`);
  - lock, write, unlock, activate and delete on a type group the test creates, when create is
    served.
  - If create is not served on cloud, a write the row lists gets a case on an object named in
    the overlay that the test user may change. Without one, that write leaves the cloud row.
  - Cloud has no `$TMP`: the test package and its transport come from the overlay.
- **Cleanup.** A suite deletes what it created, also on failure, and a failing case logs SAP's
  status and message.

The cloud suite runs on the trial before the release; its results write the cloud row
(section 1.3).

## 5. Release order

1. **interfaces-adt minor:** `'typeGroup'`, `ITypeGroupConfig`, `ITypeGroupResults`,
   `IAdtLockedDeletable`, and the on-premise row. The cloud row holds the operations measured so
   far. Published.
2. **adt-clients**, against the published interfaces-adt range: the module, the unit tests and
   the live suites, run on premise and on the trial.
3. **interfaces-adt patch, if the trial measured more or fewer cloud operations** than step 1
   listed: the cloud row corrected, published. adt-clients then takes that range. Adding a
   member a closed list forgot is a patch.
4. **adt-clients minor**, tagged `adt-clients-v<version>`. adt-strategies and
   adt-clients-legacy are not released (no change).
5. **mcp-abap-adt** takes the published adt-clients and adds its type group tools in its own
   change.

At every step each dependency range resolves on the registry, and the lockfile holds no link
but the workspace siblings.

## 6. Documentation

- adt-clients `README.md`:
  - the type group in the object list and the factory list;
  - its activation, which is one request, unlike the other types.
- `docs/usage/` lists the members and their requests.
- `docs/usage/ERRATA.md` gets one entry per measured ambiguity:
  - validation's `objtype` must be `TYPE/DG`;
  - a valid name answers an empty `200`;
  - the metadata read without any Accept answers `400`;
  - cloud discovery's empty `app:accept`, with the trial's result.
- `CHANGELOG.md` gets an entry in the minor's section. interfaces-adt's CHANGELOG gets the new
  name, types, atom and rows.
