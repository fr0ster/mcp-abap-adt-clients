# Proposal: AuthorizationField & FunctionInclude as core-module candidates

Date: 2026-04-18
Branch: `feature/auth-field-and-function-include`
Status: Proposal for selection and verification

## 1. Goal

Identify useful object handlers from `~/prj/sapcli` that can be adopted into `@mcp-abap-adt/adt-clients` without changing the library's architectural shape.

This proposal is intentionally limited to candidates that appear to fit the existing `IAdtObject<Config, State>` model and can be exposed via `AdtClient` factory methods under `src/core/`.

Out of scope: cross-object analytics (where-used, search, hierarchy), runtime-only helpers, RFC functionality, and sapcli features that require a separate utility/client layer.

## 2. Selection criteria

An object type is a good first-stage candidate only if it satisfies all of the following:

- Fits the current `IAdtObject<Config, State>` CRUD/lifecycle pattern.
- Can be represented as a dedicated handler under `src/core/{type}/`.
- Does not require changing the current `AdtClient` public shape beyond adding one zero-argument factory method.
- Does not push cross-object logic into core handlers.
- Reuses existing connection/session/content-type/check/activation patterns instead of inventing new infrastructure.

## 3. Proposed candidates

Analysis of `sapcli` suggests two promising candidates that are not currently covered by the existing core handler set:

- **Function Group Include** (`FUGR/I`) — a source-bearing include that belongs to a function group and complements the existing `functionGroup` and `functionModule` handlers.
- **Authorization Field** (`AUTH`) — a DDIC-style authorization field object related to SUSO metadata.

The recommendation is not symmetric:

- **FunctionInclude** is a strong candidate for the first implementation wave.
- **AuthorizationField** is also a valid first-stage candidate, with the remaining risk shifted from endpoint discovery to environment-specific creation permissions and test bring-up.

## 4. Architectural constraints

The following constraints should remain unchanged:

- `AdtClient` continues to expose zero-argument factories, consistent with existing handlers such as `getProgram()`, `getFunctionGroup()`, and `getFunctionModule()`.
- Object identity continues to live in config objects passed to `create/read/update/delete`, not in `AdtClient` factory parameters.
- Core handlers remain focused on object-local CRUD and lifecycle operations only.
- Accept/content-type selection continues to flow through the existing `contentTypes` abstraction where applicable.
- If a candidate cannot be implemented cleanly within these constraints, it should move to a later scope instead of bending the architecture.

## 5. sapcli observations

### 5.1 AuthorizationField

Source: `sap/adt/authorization_field.py`.

Observed in sapcli:

- ADT object type descriptor: `AUTH`
- basepath: `aps/iam/auth`
- XML namespace `auth = http://www.sap.com/iam/auth`
- Content-Type: `application/vnd.sap.adt.blues.v1+xml`
- content element `auth:content` with fields including:
  - `fieldName`, `rollName`, `checkTable`, `exitFB`
  - `abap_language_version`
  - `search`, `objexit`, `domname`, `outputlen`, `convexit`, `orglvlinfo`
  - `col_searchhelp`, `col_searchhelp_name`, `col_searchhelp_descr`
- package reference appears to use standard `adtcore:packageRef`
- no source editor; this looks like an XML-only DDIC-style object

Current interpretation:

- This looks architecturally compatible with a DDIC-style core handler.
- Its CRUD surface is now considered sufficiently verified from repo discovery plus the sample implementation; the remaining open questions are operational rather than architectural.

### 5.2 FunctionInclude

Source: `sap/adt/function.py:426`.

Observed in sapcli:

- ADT object type descriptor: `FUGR/I`
- basepath: `functions/groups/{groupname}/includes`
- XML namespace `finclude = http://www.sap.com/adt/functions/fincludes`
- Content-Types: `application/vnd.sap.adt.functions.fincludes.v2+xml` with v1 fallback
- source editor uses `.../includes/{name}/source/main` with `text/plain`
- parent relationship uses `adtcore:containerRef` to the owning function group rather than `packageRef`
- language/master metadata is inherited from the function group, not owned by the include itself

Current interpretation:

- This looks like a strong fit for an `IAdtObject` handler.
- It is close to existing source-bearing object patterns already present in the repo.

## 6. Current evidence vs unknowns

### 6.1 FunctionInclude

Confirmed from repo discovery (`docs/discovery/discovery_e19_raw.xml`, `endpoints_*.txt`):

- Collection endpoint exposed as template link under Function Groups:
  - `/sap/bc/adt/functions/groups/{groupname}/includes`
  - type `application/vnd.sap.adt.functions.fincludes.v2+xml` (matches sapcli)
  - sibling template: `{groupname}/fmodules` with `application/vnd.sap.adt.functions.fmodules.v3+xml`
- Parent collection `/sap/bc/adt/functions/groups` accepts `application/vnd.sap.adt.functions.groups.v3+xml`
- Availability: present on E77 (legacy on-prem), E19 (modern on-prem), cloud MDD

Cross-checked against sapcli (`sap/adt/objects.py` base class + `sap/adt/function.py:426` override):

- Single-object URL: `/sap/bc/adt/functions/groups/{groupname}/includes/{includename}` (standard ADT `basepath/name` composition).
- `LOCK` / `UNLOCK`: standard ADT contract — `POST` to object URI with `?_action=LOCK&accessMode=MODIFY` and `?_action=UNLOCK&lockHandle=…`; lock handle extracted from the response `LOCK_HANDLE` element. No deviation for FUGR/I — it reuses the shared `ADTObject.lock()` / `unlock()`.
- `DELETE`: standard ADT delete flow on the object URI.
- Source update: `PUT` to `.../{includename}/source/main` with `text/plain` body (`ADTObjectSourceEditorWithResponse`). Charset suffix (`; charset=utf-8` vs bare) follows the existing project rule driven by `SAP_UNICODE`.
- Content-Type for metadata: primary `application/vnd.sap.adt.functions.fincludes.v2+xml` (from discovery). sapcli additionally lists `…fincludes+xml` as v1 fallback; discovery on E19 does not advertise it, so treat v1 as best-effort fallback via accept-negotiation, not a guaranteed path.
- Per-include language/master/responsible are NOT carried on the include — sapcli explicitly returns `None` for these; the configuration shape in this proposal already excludes them.

No live-trace-only unknowns remain for FunctionInclude.

### 6.2 AuthorizationField

Confirmed from repo discovery:

- Collection endpoint: `/sap/bc/adt/aps/iam/auth`
  - title `Authorization Field`
  - Accept `application/vnd.sap.adt.blues.v1+xml` (matches sapcli) and `text/html`
  - category `auth` in scheme `http://www.sap.com/aps/iam`
- Validation resource: `/sap/bc/adt/aps/iam/auth/validation` (present in endpoint lists)
- Supporting template links on the collection:
  - `$authobjects{?name}` — related authorization objects lookup
  - `$authsearchhelp{?authFieldName,authObjectName,searchHelpName}` — search help
  - `$syncfieldsbuffer{?name}` — buffer sync
- Value-help sub-resources: `authField/valueHelp`, `authcolsearchhelp`, `authdtelallowed`, `checktable/values`, `dataelement/values`, `objfldsearchhelp`
- Availability: present on E19 (modern on-prem) and cloud MDD. **Absent on E77 (legacy)** — too old a kernel; any on-prem fallback path must reflect this.

Cross-checked against sapcli (`sap/adt/authorization_field.py` + `sap/adt/objects.py` base class):

- Single-object URL: `/sap/bc/adt/aps/iam/auth/{name}` (standard ADT `basepath/name` composition; sapcli builds the URI the same way as for any other `ADTObject`).
- Metadata Content-Type: `application/vnd.sap.adt.blues.v1+xml` — confirmed both by sapcli and by our discovery XML.
- `LOCK` / `UNLOCK` / `DELETE` / activation: standard `ADTObject` base-class flow. sapcli does not override these for `AuthorizationField`, which means the common contract applies (`?_action=LOCK|UNLOCK`, shared activation endpoint).
- No source editor (`editor_factory=None`). Update is XML-based via `PUT` to the object URI with the `blues.v1+xml` payload.
- Validation: `/sap/bc/adt/aps/iam/auth/validation` (own collection in our endpoint lists). Used for pre-create/pre-update check.
- Supporting resources usable during editing but not part of CRUD: `$authobjects{?name}`, `$authsearchhelp{...}`, `$syncfieldsbuffer{?name}`, and value-help endpoints. These are **not** required for first-stage CRUD and can be exposed later if consumer use cases demand it.

Remaining operational risks (not architectural — do not block implementation):

- Creation rights on the cloud trial account: authorization fields are often SAP-reserved; customer Z-prefixed creation may or may not be permitted. First-wave tests should be marked `available_in: ["onprem"]` and widened only after validation on a live trial.

## 7. Proposed public API shape

If implemented, both candidates should follow the existing `AdtClient` pattern:

- `getAuthorizationField(): IAdtObject<IAuthorizationFieldConfig, IAuthorizationFieldState>`
- `getFunctionInclude(): IAdtObject<IFunctionIncludeConfig, IFunctionIncludeState>`

This proposal explicitly does **not** recommend:

- `getAuthorizationField(name: string)`
- `getFunctionInclude(groupName: string, includeName: string)`

Those signatures would diverge from the current factory pattern and are unnecessary.

## 8. Proposed config shape

The config naming should remain consistent with existing modules: explicit object names, `packageName`, `sourceCode`, `transportRequest`, and similar camelCase fields.

### 8.1 AuthorizationField

Recommended high-level shape:

```ts
export interface IAuthorizationFieldConfig {
  authorizationFieldName: string;
  packageName?: string;
  description?: string;
  transportRequest?: string;

  fieldName?: string;
  rollName?: string;
  checkTable?: string;
  exitFb?: string;
  abapLanguageVersion?: string;
  search?: string;
  objexit?: string;
  domname?: string;
  outputlen?: string;
  convexit?: string;
  orglvlinfo?: string;
  colSearchhelp?: string;
  colSearchhelpName?: string;
  colSearchhelpDescr?: string;

  onLock?: (lockHandle: string) => void;
}

export interface IAuthorizationFieldState extends IAdtObjectState {}
```

Notes:

- `authorizationFieldName` follows the existing DDIC-handler naming pattern (`dataElementName`, `domainName`, `tableName`).
- Some native content fields (`domname`, `objexit`, `orglvlinfo`, `convexit`, `outputlen`) are kept as-is rather than forced into English camelCase — they are DDIC terms of art and consumers will recognise them by the ABAP name.
- Low-level parameter objects may still use snake_case where the wire format requires it.
- All content fields should be carried through to avoid lossy round-trips.

### 8.2 FunctionInclude

Recommended high-level shape:

```ts
export interface IFunctionIncludeConfig {
  functionGroupName: string;
  includeName: string;
  sourceCode?: string;
  description?: string;
  transportRequest?: string;
  onLock?: (lockHandle: string) => void;
}

export interface IFunctionIncludeState extends IAdtObjectState {}
```

Notes:

- Do not add `packageName` unless implementation evidence shows it is truly required on create.
- Package ownership is expected to be inherited from the parent function group.

## 9. Candidate module layout

If implemented, both modules should follow the normal `src/core/{type}/` layout.

Probable shape:

```text
src/core/
  authorizationField/
    AdtAuthorizationField.ts
    types.ts
    create.ts
    read.ts
    update.ts
    delete.ts
    lock.ts
    unlock.ts
    check.ts
    validation.ts
    activation.ts
    index.ts

  functionInclude/
    AdtFunctionInclude.ts
    types.ts
    create.ts
    read.ts
    update.ts
    updateSource.ts
    delete.ts
    lock.ts
    unlock.ts
    check.ts
    validation.ts
    activation.ts
    index.ts
```

This is a likely structure, not yet a commitment to the exact file list.

## 10. Likely lifecycle fit

### 10.1 FunctionInclude

Likely fit with the existing canonical orchestrator pattern (see `CLAUDE.md` → Operation Chains):

- create: validate -> create -> check -> lock -> update (metadata/source as needed) -> unlock -> activate
- update: lock -> check -> update (metadata/source as needed) -> unlock -> activate
- delete: check(deletion) -> delete

Source update at `.../source/main` is expected to happen inside the lock window, after metadata update where both are needed. Endpoint semantics are considered verified; the remaining task is to choose the final chain ordering so it stays consistent with existing source-bearing core handlers (`program`, `class`) rather than mechanically copying sapcli.

### 10.2 AuthorizationField

Likely fit with the existing DDIC-style, XML-only handler pattern. Closest existing analogues are `dataElement` and `domain`:

- create/update would be XML-based rather than source-based
- read would likely return metadata XML rather than source text
- lock/check/activate steps should follow the standard repo pattern unless implementation uncovers a system-specific deviation

At this point, `AuthorizationField` should be treated as verified enough for implementation planning. The remaining uncertainty is whether specific systems, especially cloud trial environments, allow customer-side create/update flows in practice.

## 11. Content types and shared infrastructure

Implementation must not bypass existing infrastructure:

- If these handlers are added, `IAdtContentTypes` likely needs new methods for `authorizationField` and `functionInclude`.
- Accept negotiation should remain integrated with the current correction wrapper.
- Check integration must define exact object URI and artifact content type; this cannot be left implicit in the final implementation design.

## 12. Testing proposal

Integration tests remain the right level for these handlers.

Proposed initial scope:

- `functionInclude`: CRUD/lifecycle/source update tests on an on-prem target first
- `authorizationField`: CRUD/lifecycle tests on an on-prem target first, with cloud variants enabled only after creation rights are validated
- extend `src/__tests__/helpers/test-config.yaml.template` only once object shape and environment requirements are proven

Cloud stance for the first wave:

- start conservatively with `available_in: ["onprem"]` where creation rights are uncertain
- widen support only after running against a real target system

## 13. Recommendation

Recommended first-stage adoption order:

1. **Proceed with FunctionInclude as the primary candidate.**
2. **Proceed with AuthorizationField as a first-stage candidate as well, but keep cloud test enablement gated by real-system creation rights.**
3. **Do not change `AdtClient` factory semantics.**
4. **Do not start implementation until content-type and check-run contracts are written down concretely.**

## 14. Next steps

Endpoint/lifecycle verification is treated as complete based on two authoritative sources:

- **Reference implementation:** `~/prj/sapcli` (`sap/adt/authorization_field.py`, `sap/adt/function.py`, `sap/adt/objects.py` shared base class).
- **Live discovery** captured in this repo: `docs/discovery/discovery_e19_raw.xml`, `discovery_cloud_mdd_raw.xml`, plus `endpoints_onprem_modern_e19.txt` and `endpoints_cloud_mdd.txt`.

Verified contracts (see sections 6.1 and 6.2) cover:

- collection URLs and single-object URL composition
- declared metadata Content-Types
- lock/unlock/delete/source-update/activation paths via the shared `ADTObject` base contract
- on-prem vs cloud availability (E19 + cloud MDD for both; E77 only for FunctionInclude)

Next actions:

1. Produce one implementation plan covering both `functionInclude` and `authorizationField` (file layout, XML marshalling, lifecycle wiring, tests, `IAdtContentTypes` extensions, public API wiring in `AdtClient` and `src/index.ts`).
2. If cloud creation rights for `AUTH` turn out to be restricted during test-suite bring-up, gate the AUTH creation tests to `available_in: ["onprem"]` without blocking FunctionInclude.
3. Delete this proposal document after implementation lands, per the project convention of removing design specs once their implementation is complete.
