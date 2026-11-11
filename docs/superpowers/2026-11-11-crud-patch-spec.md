# Spec: a typed patch per document type

Bound by `2026-11-11-crud-patch-goal.md`. Labels: **Measured** (seen on a system's answer),
**Code** (read in this repository or in mcp-abap-adt), **Inference** (reasoned, not yet
seen; each one is settled by a live test named below).

## 1. What ships

`@mcp-abap-adt/adt-clients` exports one pure function per type:

| Type | Function | Changes type | Root element |
|---|---|---|---|
| Domain | `patchDomainDocument` | `IDomainChanges` | `doma:domain` |
| Data element | `patchDataElementDocument` | `IDataElementChanges` | `blue:wbobj` |
| Table type | `patchTableTypeDocument` | `ITableTypeChanges` | `ttyp:tableType` |
| Function group | `patchFunctionGroupDocument` | `IFunctionGroupChanges` | `group:abapFunctionGroup` |
| Package | `patchPackageDocument` | `IPackageChanges` | `pak:package` |
| Message class | `patchMessageClassDocument` | `IMessageClassChanges` | `mc:messageClass` |

```ts
patchDomainDocument(document: string, changes: IDomainChanges): DocumentPatch<keyof IDomainChanges>
```

- The function sends no request, reads no clock or environment, and keeps nothing between
  calls. `readMetadata` and `updateMetadata` keep their contracts. A caller reads, patches
  and writes in three calls:
  `readMetadata` → `patch…Document(read, changes)` → `updateMetadata({ …, source })`.
- Each function lives in its type's module (`src/core/<type>/patch.ts`). The module's
  `index.ts` and `src/index.core.ts` export it, and so does the package root
  (`publicApiSurface.test.ts` imports it from the entry point).
- **No change in `@mcp-abap-adt/interfaces-adt`** (Code). The types are accepted by
  adt-clients' own functions, not by a member of a contract (decision 17, "a contract lives
  where it is accepted"). `IAdtUpdateOptions.source` stays a string, and the patch's output
  is that string. Data element: `typeKind` is typed as `IDataElementConfig['typeKind']`
  from interfaces-adt 27.1.0, which already declares the union, so no new contract type is
  needed.
- A field left `undefined` is not changed. Any other value, `''` included, is written.

### The result

```ts
type DocumentPatch<F extends string> =
  | { readonly ok: true; readonly document: string }
  | { readonly ok: false; readonly refusal: DocumentPatchRefusal<F> };

type DocumentPatchRefusal<F extends string> =
  | { readonly kind: 'not-a-document' }                       // empty, blank, not XML, not well-formed
  | { readonly kind: 'not-this-type'; readonly root: string }  // the root is another element
  | { readonly kind: 'element-missing'; readonly field: F; readonly path: string };
```

- A refusal is returned, not thrown. The cause is SAP's document, and decision 15.4 says a
  failure caused by SAP's answer is never thrown (Code).
- All or nothing. One refusal and no document is returned, so nothing can be written. The
  first missing field, in the order of the changes type's declaration, is the one named.
- `not-a-document` covers the empty `200` ADT answers for an object that is not ready yet
  (Code: mcp-abap-adt `xmlPatch.ts` records the live incident). It replaces the server's
  `extractXmlString`.
- Unchanged input: when no field is given, the result is `{ ok: true, document }` with the
  input string, after the same well-formedness and root checks.

## 2. Where each field is written

Paths start at the root element, and every step is a direct child. An attribute marked
"root" is on the root's start tag. When it is missing there it is added (appended at the end
of the start tag). The same attribute name on any other element is never touched. Each
element-text field replaces the element's content, and `<x/>` becomes `<x>v</x>`. An empty
string is written as `<x/>`, the form SAP answers for an empty value (Measured:
`<doma:conversionExit/>`, `<dtel:searchHelp/>`). The prefixes are the ones SAP answers, and
they are identical on cloud and onprem (Measured, 2026-11-11, reads of `ZAC_SHR_GA_DOM`,
`ZAC_SHR_AUTH_DTEL`, `ZADT_BLD_PKG03`, a Z table type, a Z function group, a Z message
class, `XFELD`, `WAERS`, `ABAP_BOOLEAN`, `BUKRS` on both systems). An element is matched by
its qualified name as SAP writes it. A document that uses other prefixes is refused
`element-missing`, never miswritten (Inference that SAP never varies them; the live tests
would show it).

Formatting is the patch's job. It takes typed values and writes SAP's form: a 6-digit
length or decimals (`000010`, Measured), a 2-digit label length (`06`, `10`, `55`,
Measured), `true` / `false` (Measured), and a 4-digit fixed-value position (`0001`,
Measured). Choosing a value is the caller's: label-length defaults, upper-casing,
`typeName` fallbacks, defaults on create.

### Domain — `doma:domain`

| Field | Type | Written to |
|---|---|---|
| `description` | `string` | root `adtcore:description` |
| `dataType` | `string` | `doma:content/doma:typeInformation/doma:datatype` |
| `length` | `number` | `doma:content/doma:typeInformation/doma:length` (6 digits) |
| `decimals` | `number` | `doma:content/doma:typeInformation/doma:decimals` (6 digits) |
| `conversionExit` | `string` | `doma:content/doma:outputInformation/doma:conversionExit` |
| `signExists` | `boolean` | `doma:content/doma:outputInformation/doma:signExists` |
| `lowercase` | `boolean` | `doma:content/doma:outputInformation/doma:lowercase` |
| `valueTable` | `string` | `doma:content/doma:valueInformation/doma:valueTableRef`: its attributes replaced by a single `adtcore:name` (see "A reference changed by name"; `<doma:valueTableRef/>` is SAP's unset form, Measured) |
| `fixedValues` | `ReadonlyArray<{ low: string; high?: string; text: string }>` | `doma:content/doma:valueInformation/doma:fixValues`, replaced whole: one `doma:fixValue` per entry holding `doma:position` (4 digits, 1-based), `doma:low`, `doma:high` (`<doma:high/>` when `high` is absent), `doma:text`. `[]` gives `<doma:fixValues/>` |

`doma:length` occurs twice, under `typeInformation` and `outputInformation` (Measured).
Only the first is the caller's, and the output length is not touched. The server's
first-match patch reached the right one only because of document order (Code).

### Data element — `blue:wbobj`, content `dtel:dataElement`

| Field | Type | Written to |
|---|---|---|
| `description` | `string` | root `adtcore:description` |
| `typeKind` | `IDataElementConfig['typeKind']` | `dtel:dataElement/dtel:typeKind` |
| `typeName` | `string` | `dtel:dataElement/dtel:typeName` (as given) |
| `dataType` | `string` | `dtel:dataElement/dtel:dataType` |
| `length` | `number` | `dtel:dataElement/dtel:dataTypeLength` (6 digits) |
| `decimals` | `number` | `dtel:dataElement/dtel:dataTypeDecimals` (6 digits) |
| `shortLabel`, `mediumLabel`, `longLabel`, `headingLabel` | `string` | `dtel:shortFieldLabel`, `dtel:mediumFieldLabel`, `dtel:longFieldLabel`, `dtel:headingFieldLabel` |
| `shortLength`, `mediumLength`, `longLength`, `headingLength` | `number` | `dtel:shortFieldLength`, … (2 digits). Never derived from the label: the caller sets it |
| `searchHelp`, `searchHelpParameter`, `setGetParameter` | `string` | `dtel:searchHelp`, `dtel:searchHelpParameter`, `dtel:setGetParameter` |

The `*MaxLength` elements are SAP's and are not written.

### Table type — `ttyp:tableType`

| Field | Type | Written to |
|---|---|---|
| `description` | `string` | root `adtcore:description` |
| `rowTypeKind` | `string` | `ttyp:rowType/ttyp:typeKind` |
| `rowTypeName` | `string` | `ttyp:rowType/ttyp:typeName` |
| `dataType` | `string` | `ttyp:rowType/ttyp:builtInType/ttyp:dataType` |
| `length` | `number` | `ttyp:rowType/ttyp:builtInType/ttyp:length` (6 digits) |
| `decimals` | `number` | `ttyp:rowType/ttyp:builtInType/ttyp:decimals` (6 digits) |
| `accessType` | `string` | `ttyp:accessType` |
| `keyDefinition` | `string` | `ttyp:primaryKey/ttyp:definition` |
| `keyKind` | `string` | `ttyp:primaryKey/ttyp:kind` |

`ttyp:valueHelps` holds many `ttyp:valueHelp adtcore:description=""` (Measured). The patch
never touches them.

### Function group — `group:abapFunctionGroup`

| Field | Type | Written to |
|---|---|---|
| `description` | `string` | root `adtcore:description` |

### Package — `pak:package`

| Field | Type | Written to |
|---|---|---|
| `description` | `string` | root `adtcore:description` |
| `responsible` | `string` | root `adtcore:responsible` |
| `masterSystem` | `string` | root `adtcore:masterSystem` |
| `packageType` | `string` | `pak:attributes` `@pak:packageType` |
| `recordChanges` | `boolean` | `pak:attributes` `@pak:recordChanges` |
| `superPackage` | `string` | `pak:superPackage`: its attributes replaced by a single `adtcore:name` (see "A reference changed by name") |
| `softwareComponent` | `string` | `pak:transport/pak:softwareComponent` `@pak:name` |
| `transportLayer` | `string` | `pak:transport/pak:transportLayer` `@pak:name` |

`pak:softwareComponent` and `pak:transportLayer` sit under `pak:transport` on both systems
(Measured), so their path is the fixed `pak:package/pak:transport/pak:softwareComponent` and
`pak:package/pak:transport/pak:transportLayer`, never the first element of that name. `adtcore:packageRef`, `pak:superPackage` and every
`pak:subPackages/pak:packageRef` carry an `adtcore:description` of another package
(Measured). None of them is written for `description`.

### Message class — `mc:messageClass`

| Field | Type | Written to |
|---|---|---|
| `description` | `string` | root `adtcore:description` |

The messages (`mc:messages`) carry no `adtcore:description` on either system (Measured: one
`adtcore:description` per document, the root's). The server's comment that "every message
carries one too" does not hold for these reads.

### A reference changed by name

`valueTable` (domain) and `superPackage` (package) name another object. The element SAP
answers carries that object's `adtcore:uri`, `adtcore:type` and, for a package,
`adtcore:description` beside `adtcore:name` (Measured: `WAERS` →
`<doma:valueTableRef adtcore:uri="…/tcurc" adtcore:type="TABL/DT" adtcore:name="TCURC"/>`;
`ZADT_BLD_PKG03` → `pak:superPackage` with all four). On a change, the element's attributes
are replaced by a single `adtcore:name`, so nothing of the old target is left behind; the
element's other content and every other byte stay as read.

SAP accepts a reference carrying only the name (**Measured**, 2026-11-11, the plan's A1
probe, on ABAP Cloud and on premise alike): a domain's `doma:valueTableRef` holding only
`adtcore:name`, written empty → table A and then A → table B, and a package's
`pak:superPackage` holding only `adtcore:name`, moved from the build package to the shared
package; every PUT answered ok, and each read-back carried SAP's own `adtcore:uri` and
`adtcore:type` for the new target (and, for the package, its `adtcore:description`). The
control in the full form SAP answers was accepted the same way.

### The description is passed as given

No truncation and no check of its length: the patch writes the description as given, and
SAP's answer reaches the caller as it is. What SAP answers for a description ten characters
over the limit depends on the type, and is the same on cloud and on onprem (**Measured**,
2026-11-11, each type's live suite on both systems):

| Type | Limit | SAP's answer |
|---|---|---|
| Domain, data element, table type, package | 60 | `400 ExceptionInvalidData`, T100 `SWB_TOOL` `018` "The description is too long. Maximum length: 60 characters" (value `60`), subtype `src_prop_decr_too_long`; nothing stored |
| Function group | 40 (`adtcore:descriptionTextLimit="40"`) | `400`, T100 `FUNC_ADT` `103` "Description of <group> longer than 40 characters." (values: the group, `40`); nothing stored |
| Message class | 60 | accepted (`200`); SAP stores the first 60 characters |

The live tests write a description of exactly the limit and read it back whole, then one ten
characters over it, and assert each type's answer: the refusal and the stored description
unchanged, or, for the message class, the first 60 characters stored.

### A root without a description

ADT's read-back of a freshly created, not yet activated domain, data element and table type
carries no `adtcore:description` on the root, and the package reference carries the
package's (**Measured**, 2026-11-11, recorded from the live suites on cloud and on onprem:
`corpus/adt/documents/<release>/read-<type>-fresh--01-read-metadata`). A package's and a
message class's first read after the create carries it on the root, on both systems
(Measured, same runs; both are active at once). The function group's flow reads no metadata
document before its update, so its fresh shape is not seen (Inference: same rule as the
domain's). The patch adds the attribute when it is missing, either way.

## 3. How the XML is handled — no regular expression

- **Validation:** `XMLValidator.validate` from `fast-xml-parser` (already a dependency,
  used in `activationUtils.ts`, Code). A blank body or one that is not well-formed is
  `not-a-document`, which catches a truncated read the parser alone would close.
- **Location and edit:** one shared, linear scanner in plain string code
  (`src/utils/documentEdit.ts`, internal, not exported). It walks the document once:
  declaration, comments, processing instructions, CDATA, start, end and empty tags, quoted
  attribute values. It reports, for a path from the root, the element's start-tag range,
  its content range and each attribute's value range. Edits are splices applied from the
  end of the document backwards. Every byte outside the spliced ranges comes back as it was
  read: attribute order, quoting, entities, whitespace, attributes unknown to the library.
  This is why no parse-and-rebuild is used: the server's ordered round trip already
  rewrites some characters (`&apos;`, Code: mcp-abap-adt `xml/ordered`).
- **Escaping:** element text escapes `&`, `<`, `>` and CR (`&#13;`). An attribute value
  escapes `&`, `<`, `>`, both quotes, and LF, tab and CR (`&#10;`, `&#9;`, `&#13;`), so a
  conforming parser reads back exactly the value given (XML 1.0 §2.11, §3.3.3). A new
  attribute is written with `"`. The creates and every other body the library writes
  escape the same way, through the same two functions (`src/utils/xml.ts`).
- **A document is well-formed or refused:** every `&` starts a predefined entity or a
  character reference to an XML Char; an attribute value holds no `<`; text holds no `]]>`.
  Anything else is `not-a-document`.
- Nothing is held as `unknown` and narrowed by casts. The scanner returns typed ranges,
  and a missing path is a typed absence. No `as`, `any`, `@ts-ignore` or `!` in the new
  code.

## 4. Errors and the library's rules

- No timeout, retry or polling. The functions make no request.
- `noInputValidation.test.ts` stays green. The patch checks SAP's document (outside the
  type system), never the caller's typed changes.
- Decision 15 ("the library interprets nothing") is met. The patch is not a member's hidden
  step and no default: the caller calls it by name, and a reading of SAP's answer stays in
  a result strategy. `docs/architecture/DECISIONS.md` gets decision 19, which records this,
  the three-call sequence, and why the message-class read-and-patch removed under decision
  15 does not come back.

## 5. Tests

### Unit (jest, no SAP; `src/__tests__/unit/core/<type>/patch.test.ts`, `unit/utils/documentEdit.test.ts`)

Fixtures are the measured reads, recorded into `corpus/adt/documents/abap-cloud/` and
`corpus/adt/documents/s4-2025/`, each body with its JSON sidecar as `corpus/README.md`
describes, scrubbed as `corpusCarriesNoIdentity.test.ts` requires
(user ids, system ids, application servers replaced by its placeholders). The fresh
no-description read-backs are recorded during the live run (§5 live) and added the same
way. For each rule, the test names the mutation that turns it red. The mutation is run once
while the test is written, and the PR records it.

| Rule | Assertion | Mutation that must turn it red |
|---|---|---|
| Root scoping | root without description, `packageRef` with one: the root gets it, `packageRef` byte-equal | first attribute of that name anywhere |
| Added when missing | root without the attribute gets it | replace-only |
| Path scoping | domain `length`: type length changed, output length byte-equal; package `description` leaves `superPackage` / `subPackages` alone | first element of that name anywhere |
| Nothing else changes | every byte outside the spliced ranges equals the input, on every fixture | parse-and-rebuild |
| All or nothing | a missing element gives `element-missing` naming the field and path, and no document | write the fields found, skip the missing one |
| Not a document | `''`, blank, `<a>` cut short, non-XML: `not-a-document` | drop the validator |
| Not this type | a domain document to `patchTableTypeDocument`: `not-this-type` | drop the root check |
| Formatting | 6-digit lengths, 2-digit label lengths, `true` / `false`, `fixValues` block (positions, `high` given and absent → `<doma:high/>`, `[]` → `<doma:fixValues/>`) | unpadded / string form |
| Reference by name | `valueTable` / `superPackage` on an element carrying `uri`, `type`, `description`: the element holds `adtcore:name` alone; on `<doma:valueTableRef/>` it gains it | set `adtcore:name` and keep the old attributes |
| Escaping | `&`, `<`, `>`, the quote, LF/tab/CR — read back exactly by a conforming parser; malformed references refused | unescaped write; an unchecked reference |
| Undefined is unchanged | a field left `undefined` leaves its element byte-equal | write `''` for undefined |

A source scan (`noRegexInDocumentPatches.test.ts`, with the TypeScript parser like
`noHardcodedObjectAddresses.test.ts`) refuses a regex literal or a `RegExp` call in
`src/core/*/patch.ts` and `src/utils/documentEdit.ts`.

### Live (integration; cloud and onprem, per type)

For each of the six types, the type's integration flow patches through the shipped
function (`updateTakesDocument` → `patch…Document`). It then reads back and asserts each
changed field's stored value and the root's description:

- every field of §2 that the system takes, set once in the update step;
- the description on a fresh object (create → read-back without root description → patch
  → write accepted): the table type's cloud failure, now passing;
- a description of exactly the limit, stored whole; one ten characters over it, answered
  as §2 measured for the type (refused and the stored description unchanged, or, for the
  message class, its first 60 characters stored);
- `fixedValues` with `high`, without it and with `[]`; `valueTable` set on
  `<doma:valueTableRef/>` and changed from one table to another; `superPackage` changed —
  each read back with SAP's own `uri` / `type` for the new target (the first measurement
  above, now as a regression test).
- The limit of the live proof: the package's `responsible`, `masterSystem`,
  `softwareComponent` and `transportLayer` are written live only with the package's own
  values — another responsible is another SAP user, and neither system offers the package
  another master system, software component or transport layer. That the patch writes each
  of them is proved by the unit tests and their mutations; live, `packageType` and
  `recordChanges` reach SAP and are refused as measured.

### The other cloud failures

- **TableType.test, Package.test, domain/IfMatch.test** patch through the shipped functions.
  `src/utils/xmlPatch.ts` (regex, first match, used by these tests and by the `describe`
  command of `scripts/transport-admin.ts`, Code) and `unit/utils/xmlPatchFailsLoudly.test.ts`
  are deleted, and the `describe` command with them: no first-match patcher is left in the
  repository. `helpers/rootDescription.ts` stays:
  BaseTester and ScalarFunction use it for types outside this change.
- **MasterLanguage.test** follows the library, in two cases. Without a configured language
  the create body carries no `adtcore:masterLanguage` and no `adtcore:language`, and the
  test asserts that. With `default_master_language` configured the body carries it, and
  that case is registered `it.skip`, its title stating that no language is configured.
  Cause (Code): `createLanguage` answers `undefined` for `""`, and `languageAttributes`
  writes nothing, by design since 2026-11-04. The test still expected `EN`.
- **deletionCheck.test, transport request:** registered `it.skip` when
  `environment.default_transport` is empty, the title stating so (it is `""` on cloud,
  Code: overlay).
- **Transport.test, list through a saved search:** a new required overlay key,
  `environment.transport_search_configured` (boolean; `false` on cloud), states whether the
  account holds a saved transport search configuration, as `environment.verify_lock_released`
  states its fact. `false` registers the case `it.skip`, its title stating that the account
  has no saved search configuration; `true` runs it and an empty list fails. The key goes
  into `helpers/overlays/` (both forms), `check:config` and
  `docs/development/TEST_CONFIG_SCHEMA.md`.

## 6. What mcp-abap-adt then removes (its own PR, after the release is published)

- `src/lib/strategies/domainPatch.ts`, `dataElementPatch.ts`, `functionGroupPatch.ts` and
  `packagePatch.ts`; the patch half of `tableTypePatch.ts`
  (`readTableTypeDefinition` / `StoredTableTypeDefinition` move into `tableTypeStored.ts`,
  which stays on the server); `extractXmlString`, `patchXml*`, `patchIf` and
  `XmlPatchError` — `xmlPatch.ts` is deleted whole; the unit tests of each. The domain fix
  79f62d7c goes with `domainPatch.ts`.
- `IncludeHighHandlers.test.ts`, the one remaining user of the server's `patchXmlAttribute`
  (an include, outside the six types), moves to a root-scoped description helper in plain
  string code, as adt-clients' `helpers/rootDescription.ts` is.
- `handleUpdateMessageClass.ts`'s own `patchXmlAttribute`.
- Every handler listed in the goal's facts (domain, data element, table type high
  create/update and low update; function group high update; package high/low update;
  message class high update) maps its tool arguments to the typed changes, choosing values
  (defaults on create, upper-casing, label lengths, `type_name` fallback, the
  string-or-boolean flags turned into booleans, lengths into numbers), and answers a
  `DocumentPatch` refusal as a failure of the step "patch", naming the field.
- Its dependency on `@mcp-abap-adt/adt-clients` moves to the new minor from the registry.
- `src/lib/xml/ordered.ts` stays (reading, debugger and enhancement code use it, Code).

## 7. Version and release

- `@mcp-abap-adt/adt-clients` **45.2.0** (minor): new exports. Nothing exported is removed:
  `src/utils/xmlPatch.ts` was never exported (Code).
- `adt-strategies` and `adt-clients-legacy`: no change. Legacy depends on adt-clients as
  `^45.1.0`, which 45.2.0 satisfies, so it needs no bump (Code).
- `@mcp-abap-adt/interfaces-adt`: no release.
- The owner publishes. The server PR follows.

## 8. Documentation

- `README.md`, "`update()` writes the whole content": the three-call sequence with a
  shipped patch for the six document types.
- `docs/usage/CLIENT_API_REFERENCE.md`: the example with the placeholder
  `patchTheDescription` becomes `patchDomainDocument`, plus a section per type with the
  field table of §2, the refusals, and "the description is passed as given".
- `docs/architecture/DECISIONS.md`: decision 19 (§4).
- `corpus/README.md`: the `documents/` folder.
- `CHANGELOG.md`: 45.2.0, dated on each edit.
- No migration note: nothing a consumer relies on changes.
