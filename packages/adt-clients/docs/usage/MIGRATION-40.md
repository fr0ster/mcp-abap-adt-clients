# Migrating to 40.0.0

40.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^25.0.0` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`. One thing changes for a consumer:

- [Every read sends exactly the version it is given](#every-read-sends-exactly-the-version-it-is-given):
  `read(config, version)`, `readMetadata(config, { version })`,
  `getUtils().readObjectSource` / `readObjectMetadata` / `getObjectSourceUri`,
  the feature toggle's `readSource` and the application log's `getObject` /
  `getSource` take `AdtReadVersion` — `'active' | 'inactive' |
  'workingArea'` — and send the value as given: none is dropped or
  rewritten.

**A read given no version sends the request it sent on 39.x**, its old
default included. **A read given a version now sends that version** — for
most reads this is the request 39.x sent too; the reads listed under
[Requests that change](#requests-that-change) dropped or rewrote a given
version on 39.x and now send it as given.

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
the application log). The library never substitutes a version for the one
the caller named.

Why: measured on premise (2026-11-01, read only), a class with an inactive
version answered its inactive document and source to a read with no version,
to `inactive` and to `workingArea`, and the active ones only to `active`. A
read without a version is not "the active version", and a read that
rewrites the version answers something the caller did not ask for. The
README's "Name the version you mean" has the measurement per endpoint
family; the application log's object and source were measured on S/4HANA
2025 (2026-11-01): `200` for the three values, `400` for any other.

### Requests that change

A correction of what 39.x sent for a given version:

| Read | 39.x with a version | 40.0.0 |
|---|---|---|
| `readMetadata` of domain, data element, table type, function group, include, message class, metadata extension, enhancement | no `version` at all | `?version=<given>` |
| `read` of a class include (local types, definitions, macros, test classes) | `inactive` sent as `version=workingArea` | `version=inactive` |
| `read` of an enhancement, and `getObjectSourceUri('ENHO/XHH', …)` / `readObjectSource('ENHO/XHH', …)` | `inactive` sent as `version=workingArea` | `version=inactive` |
| `read` of a metadata extension | `active` sent as no `version` | `version=active` |
| `getBehaviorImplementationImplementations(…, 'active')` | `active` sent as no `version` | `version=active` |
| `read` / `readMetadata` of a message class message | version dropped | `?version=<given>` |
| any read given `workingArea` | not accepted by the type | `version=workingArea` |

Measured on premise (2026-11-01, read only): a class include and a metadata
extension source answer `version=active` and `version=inactive` with `200`.

### Migrating

- Install `@mcp-abap-adt/interfaces-adt@^25.0.0` beside
  `@mcp-abap-adt/adt-clients@^40.0.0`.
- A class that extends a handler and overrides a read with
  `version?: 'active' | 'inactive'` widens its parameter to `AdtReadVersion`
  (an override must accept what the base accepts).
- A caller that relied on a rewrite names what it means: a class include's or
  an enhancement's working area is `'workingArea'`; a read of what is active
  is `'active'`, not nothing.
