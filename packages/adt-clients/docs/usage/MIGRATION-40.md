# Migrating to 40.0.0

40.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^25.0.0` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`. One thing changes for a consumer:

- [Every read sends exactly the version it is given](#every-read-sends-exactly-the-version-it-is-given):
  `read(config, version)`, `readMetadata(config, { version })`,
  `getUtils().readObjectSource` / `readObjectMetadata` / `getObjectSourceUri`,
  the feature toggle's `readSource` and the application log's `getObject` /
  `getSource` take `AdtReadVersion` — `'active' | 'inactive' |
  'workingArea'` — and send the value as given: none is dropped, rewritten
  or defaulted.

**A read given a version sends exactly that version. A read given no version
sends no version** — the library substitutes none. For most reads both are
the request 39.x sent; the reads listed under
[Requests that change](#requests-that-change) dropped, rewrote or defaulted
the version on 39.x.

## Every read sends exactly the version it is given

### What changed

interfaces-adt 25.0.0 types every read contract's version as
`AdtReadVersion` (`active`, `inactive`, `workingArea`): `IAdtReadable.read`,
`IAdtMetadataReadable.readMetadata`, `IAdtObjectAccess.readObjectSource` and
`getObjectSourceUri`, the feature toggle's source read, and
`IGetApplicationLogObjectOptions` / `IGetApplicationLogSourceOptions` (typed
`string` before). Every implementation here takes the same type — the source
reads included — and sends the value as `?version=<value>` (or as the
`version` request parameter, for the feature toggle, the service binding and
the application log). The library never substitutes a version: not for the
one the caller named, and not where the caller named none — what ADT answers
to a read without a version is ADT's (measured: the working area, the
inactive version where one exists).

Why: measured on premise (2026-11-01, read only), a class with an inactive
version answered its inactive document and source to a read with no version,
to `inactive` and to `workingArea`, and the active ones only to `active`. A
read without a version is not "the active version", and a read that
rewrites the version answers something the caller did not ask for. The
README's "Name the version you mean" has the measurement per endpoint
family; the application log's object and source were measured on S/4HANA
2025 (2026-11-01): `200` for the three values, `400` for any other.

### Requests that change

A correction of what 39.x sent:

| Read | 39.x with a version | 40.0.0 |
|---|---|---|
| `readMetadata` of domain, data element, table type, function group, include, message class, metadata extension, enhancement | no `version` at all | `?version=<given>` |
| `read` of a class include (local types, definitions, macros, test classes) | `inactive` sent as `version=workingArea` | `version=inactive` |
| `read` of an enhancement, and the address `getObjectSourceUri('ENHO/XHH', …)` builds (`readObjectSource` reads no `ENHO/XHH`) | `inactive` sent as `version=workingArea` | `version=inactive` |
| `read` of a metadata extension | `active` sent as no `version` | `version=active` |
| `getBehaviorImplementationImplementations(…, 'active')` | `active` sent as no `version` | `version=active` |
| `read` / `readMetadata` of a message class message | version dropped | `?version=<given>` |
| any read given `workingArea` | not accepted by the type | `version=workingArea` |
| `readMetadata` with **no version** of package, function include, service definition, access control, behavior definition, transformation, scalar function, authorization field, feature toggle | `version=active` | no `version` |
| `readMetadata` with **no version** of scalar function implementation, append structure | `version=inactive` | no `version` |
| `read` with **no version** of a class include, enhancement, function include, service definition, access control, behavior definition, transformation, scalar function, feature toggle (`read` and `readSource`) | `version=active` | no `version` |
| `read` with **no version** of scalar function implementation, append structure | `version=inactive` | no `version` |

Measured on premise (2026-11-01, read only): a class include and a metadata
extension source answer `version=active` and `version=inactive` with `200`.

### Migrating

- Install `@mcp-abap-adt/interfaces-adt@^25.0.0` beside
  `@mcp-abap-adt/adt-clients@^40.0.0`.
- A class that extends a handler and overrides a read with
  `version?: 'active' | 'inactive'` widens its parameter to `AdtReadVersion`
  (an override must accept what the base accepts).
- **Pass the version you mean.** A caller that relied on a default or a
  rewrite names what it means: `'active'` for what is active (no version is
  no longer `active` anywhere), `'inactive'` / `'workingArea'` for the
  working area.
