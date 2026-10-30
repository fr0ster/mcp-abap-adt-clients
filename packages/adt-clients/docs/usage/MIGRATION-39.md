# Migrating to 39.0.0

39.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^24.0.1` and
`@mcp-abap-adt/adt-strategies` `^0.17.0`. Two things change for a consumer:

- [The search filter takes the release's search names](#the-search-filter-takes-the-releases-search-names):
  `getUtils().search({ objectType })` takes a name of the release's object
  types list (`DEVC`, `STRU`, `ABAP_TEST_COCKPIT`), not a code (`DEVC/K`).
- [Where-used and the group members take the typed atoms' references](#where-used-and-the-group-members-take-the-typed-atoms-references):
  `VIEW/DV` compiles, a function module's reference names its group, and
  `getUtils()` is an `IAdtTypedWhereUsed<…, V>` and an
  `IAdtTypedGroupLifecycle<…, V>` instead of an `IAdtWhereUsed` /
  `IAdtGroupLifecycle`.

Code that searches without a filter, and passes literal codes with their
parents to where-used and the group members, compiles and behaves as on 38.x.
No request changes for a call that compiled on 38.x and compiles on 39.0.0.

## The search filter takes the release's search names

### What changed

`/sap/bc/adt/repository/informationsystem/search?operation=quickSearch`
filters by `objectType`, and what that parameter takes is the release's object
types list (`GET /sap/bc/adt/repository/informationsystem/objecttypes`), not
the type codes. Measured on S/4HANA 2025 and ABAP cloud (2026-10-29, read
only):

- a **name** selects what the list says of it: `DEVC` the packages, `STRU`
  only `TABL/DS`, `DTAB` only `TABL/DT`, `TABL` both, a group
  (`ABAP_TEST_COCKPIT`) its members;
- a **code** equal to an item's type selects as that item; any other code
  selects as the text before its `/` — `ENHO/XHH` answers as `ENHO`, with
  other first hits under `maxResults` — and an unknown code (`NOPE/XX`)
  answers `200` and nothing, silently;
- an **unknown name** is refused `400`.

On SAP_BASIS 7.40 there is no list (`404`); the names `DEVC`, `CLAS`, `INTF`,
`PROG`, `FUGR`, `FUNC`, `DDLS`, `MSAG`, `TABL`, `ENHO` and `ENHS` select, and
the aliases (`STRU`, `DTAB`, `REPO`, `INCL`, `BADI`) and an unknown name answer
`200` and no hits, silently.

So the filter is typed by the variant's names, `IAdtSearchObjectsParamsOf<V>`
of interfaces-adt 24.0.0: `ADT_SEARCH_TYPES_ONPREM` (385 names),
`ADT_SEARCH_TYPES_CLOUD` (372), `ADT_SEARCH_TYPES_BASIS_740` (the eleven). A
code no longer compiles as the filter, nor does a name the variant does not
take: `STRU` on a 7.40 client, `NOPE` anywhere. `AdtSearchCode<V>` is gone;
the type is interfaces-adt's `AdtSearchTypeOf<V>`. The request is the one the
library always sent: the name as the `objectType` parameter.

### What to do

Pass the search name. For a main type, take it from the table entry:

```typescript
import { ADT_TYPES_ONPREM } from '@mcp-abap-adt/interfaces-adt';

const utils = client.getUtils();

// 38.x: objectType: 'DEVC/K' — a code, which the search reads as `DEVC`.
const packages = await utils.search({
  query: 'Z*',
  objectType: ADT_TYPES_ONPREM.package.codes['DEVC/K'].main, // 'DEVC'
});

// A subtype is searched by its alias: structures alone.
const structures = await utils.search({ query: 'Z*', objectType: 'STRU' });
```

A subtype without an alias (`ENHO/XHH`) cannot be searched alone: search its
main type (`ENHO`) and keep the hits of the code you want.

`adt-clients-legacy` 0.3.0's `AdtUtilsLegacy.search` takes
`IAdtSearchObjectsParamsOf<'basis740'>`: a name 7.40 is not measured to select
does not compile there, and from a caller outside the type system it is
refused without a request (the refusal names `ADT_SEARCH_TYPES_BASIS_740`) —
an alias would answer no hits, which the caller could not tell from an empty
search.

## Where-used and the group members take the typed atoms' references

### What changed

interfaces-adt 22.0.0 added `IAdtTypedGroupLifecycle<…, V>` and
`IAdtTypedWhereUsed<…, V>`: the group and where-used members over the
references each request serves on variant `V` (`IAdtGroupActivationReference<V>`,
`IAdtGroupDeletionCheckReference<V>`, `IAdtGroupDeletionReference<V>`,
`IAdtWhereUsedParamsOf<V>`, `IAdtWhereUsedScopeParamsOf<V>`). 38.0.0's
members did not satisfy them, so a consumer composing its contract from them
could not take `getUtils()`. Now:

- **`VIEW/DV` compiles** in `activateObjectsGroup`, `deleteObjectsGroup`,
  `getWhereUsed` and `getWhereUsedScope` — on 7.40 too for the group
  activation, which 7.40's utility table lists — and is sent under
  `/sap/bc/adt/ddic/views/<name>`, as 38.x sent it for a caller outside the
  type system.
- **A parented code requires `parentName`** in a group reference
  (`IAdtCodedReference<C>`): `{ type: 'FUGR/FF', name }` without the group no
  longer compiles; it threw before any request on 38.x.
- **The code sets** (`AdtActivationCode<V>`, `AdtDeletionCheckCode<V>`,
  `AdtDeletionCode<V>`, `AdtWhereUsedCode<V>`) equal interfaces-adt's
  (`AdtGroupActivationCode<V>`, …), per variant — held by a compile check.
- **`getUtils()` declares the typed atoms' signatures**, not the 21.0.0
  atoms': `AdtUtils<R, V>` no longer implements `IAdtInformationSystem`,
  `IAdtWhereUsed`, or the three group members of `IAdtGroupLifecycle`, whose
  `IObjectReference` holds only an `AdtTypeCode` and so cannot carry
  `VIEW/DV`. It still implements `IAdtObjectSearch`, `IAdtVirtualFolders`,
  `IAdtTypeCatalogue` and `IAdtGroupLifecycle`'s run and inactive members
  (`getInactiveObjects`, `getActivationRun`, `getActivationResults`), and
  `AdtUtils<R, 'onprem'>`, `<R, 'cloud'>`, `<R, 'basis740'>` and the modern
  default are each assignable to both typed atoms of their variant.

### What to do

A reference whose code is known only by its set names its parent, or is
typed as a code without one:

```typescript
import type {
  AdtParentedTypeCode,
  IAdtGroupActivationReference,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtActivationCode, AdtModernVariant } from '@mcp-abap-adt/adt-clients';

declare const code: Exclude<AdtActivationCode<AdtModernVariant>, AdtParentedTypeCode>;

const objects: IAdtGroupActivationReference<AdtModernVariant>[] = [
  { type: code, name: 'ZOBJECT' },
  { type: 'FUGR/FF', name: 'Z_MY_FM', parentName: 'Z_MY_GROUP' },
  { type: 'VIEW/DV', name: 'ZMY_VIEW' },
];
await client.getUtils().activateObjectsGroup(objects, undefined, { headers });
```

A consumer that typed `getUtils()` as `IAdtInformationSystem`,
`IAdtWhereUsed` or `IAdtGroupLifecycle` composes the typed atoms instead:

```typescript
import type {
  IAdtObjectSearch,
  IAdtTypedGroupLifecycle,
  IAdtTypedWhereUsed,
} from '@mcp-abap-adt/interfaces-adt';

type Utils<V extends 'onprem' | 'cloud'> = IAdtObjectSearch<string> &
  IAdtTypedWhereUsed<string, string, V> &
  IAdtTypedGroupLifecycle<string, string, string, V>;

const utils: Utils<'onprem'> = onPremClient.getUtils();
```
