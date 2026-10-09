# Migrating to 25.0.0

25.0.0 brings ATC to programs and every kind of include, and builds every
object address in one place. Three changes can break a consumer on 24.x.

## 1. `@mcp-abap-adt/interfaces-adt` 12

adt-clients depends on `@mcp-abap-adt/interfaces-adt` `^12.0.0`. If your
package imports `interfaces-adt` too, declare `^12.0.0` as well. Otherwise npm
installs two copies, and TypeScript treats a type from one copy as foreign to
the other (`TS2742`, or an object that "is not assignable" to its own type).

`npm ls @mcp-abap-adt/interfaces-adt` must show one version.

What changed in the contract is `IAtcObjectRef`. It is now a union carrying what
each kind's address needs:

```typescript
import type { IAtcObjectRef } from '@mcp-abap-adt/interfaces-adt';

const refs: IAtcObjectRef[] = [
  { objectType: 'class', objectName: 'ZCL_MY_CLASS' },          // unchanged
  { objectType: 'program', objectName: 'Z_MY_REPORT' },          // new
  { objectType: 'program_include', objectName: 'Z_MY_REPORT_TOP' }, // new
  { objectType: 'function_include', objectName: 'LZ_MY_GROUPTOP', functionGroup: 'Z_MY_GROUP' }, // new
  { objectType: 'class_include', objectName: 'ZCL_MY_CLASS', includeKind: 'testclasses' },      // new
];
```

A reference of one of the seven earlier kinds compiles unchanged. Code that
**exhausts** `AtcObjectType` (a `Record<AtcObjectType, …>`, or a `switch` with a
`never` check) must handle the four new kinds.

ATC checks an include as the object that owns it: the worklist lists the main
program, the function group or the class. The findings are not limited to the
include sent, and a finding's `location` says where it is. See
[ATC check runs](CLIENT_API_REFERENCE.md#atc-check-runs).

## 2. Group operations refuse a reference they cannot address

`activateObjectsGroup`, `checkDeletionGroup`, `deleteObjectsGroup` and
where-used now **throw before any request** for:

- a reference without a type;
- a type this library has no address for;
- a function module (`FUGR/FF`) or function include (`FUGR/I`) without
  `parentName`, its function group.

On 24.x such a reference was sent anyway. A missing type was guessed from the
name (`ZCL_…` → class, anything else → program), and an unknown type built
`/sap/bc/adt/<type>/<name>`, an address that exists nowhere. SAP answered the
latter with its complaint inside a `200`.

What to do: give every reference its ADT type code, and `parentName` for a
module or a function include.

```typescript
await utils.activateObjectsGroup([
  { name: 'ZCL_MY_CLASS', type: 'CLAS/OC' },
  { name: 'Z_MY_FM', type: 'FUGR/FF', parentName: 'Z_MY_GROUP' },
]);
```

## 3. Legacy systems: absent types answer a refusal

On a legacy system (BASIS < 7.50), `AdtClientLegacy` used to **throw** from the
factory of an object type the system lacks. Now the factory returns a handler,
and every member of it answers, without a request:

```
ok: false
origin: 'refusal'
code: UNSUPPORTED_OPERATION
```

This affects `getDomain`, `getDataElement`, `getStructure`, `getTable`,
`getTableType`, `getAccessControl`, `getServiceDefinition`, `getServiceBinding`
(and the deprecated `getService`), `getBehaviorDefinition`,
`getBehaviorImplementation`, `getMetadataExtension` and `getEnhancement`.
`getAuthorizationField` and `getFeatureToggle` join them: until now they sent
their requests to a system that has no such endpoint.

What to do: a `try`/`catch` around those factories no longer catches anything.
Read `ok` on the answer instead, as on every other member.

## Not breaking, but different

- `getVersions()` on a DDL source, an access control, a function include or a
  table type now reaches the version history. On 24.x it asked an address SAP
  answers with `404`.
- Object names go out lowercase, with a namespace as `%2F`, as ADT's own
  addresses are. A transport request number keeps its case, because SAP reads it
  case-sensitively. Measured on an on-premise and a cloud system: the same
  objects answer as before.
