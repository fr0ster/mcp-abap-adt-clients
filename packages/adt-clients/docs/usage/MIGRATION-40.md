# Migrating to 40.0.0

40.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^25.0.0` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`. One thing changes for a consumer:

- [Every read takes `AdtReadVersion`](#every-read-takes-adtreadversion):
  `read(config, version)`, `readMetadata(config, { version })`,
  `getUtils().readObjectSource`, `getUtils().getObjectSourceUri`, the feature
  toggle's `readSource` and the application log's `getObject` / `getSource`
  take `'active' | 'inactive' | 'workingArea'` and send `workingArea` to
  `?version=` as they send the other two.

A call that compiled on 39.x sends the same request on 40.0.0: no read given
`active`, `inactive` or no version changes its URL.

## Every read takes `AdtReadVersion`

### What changed

interfaces-adt 25.0.0 types every read contract's version as
`AdtReadVersion` (`active`, `inactive`, `workingArea`): `IAdtReadable.read`,
`IAdtMetadataReadable.readMetadata`, `IAdtObjectAccess.readObjectSource` and
`getObjectSourceUri`, the feature toggle's source read, and
`IGetApplicationLogObjectOptions` / `IGetApplicationLogSourceOptions` (typed
`string` before). Every implementation here takes the same type — the source
reads included — and sends the value as `?version=<value>` (or as the
`version` request parameter, for the feature toggle, the service binding and
the application log).

Each metadata read sends `options.version` when it is given (39.x dropped it
on domain, data element, table type, function group, include, message class,
metadata extension and enhancement), built with `URLSearchParams` beside
`withLongPolling=true`. Without a version a read sends the 39.x request.

Three reads keep their own spelling for `inactive`, as on 39.x: a class
include (local types, definitions, macros, test classes) and an enhancement's
source ask for an inactive source as `workingArea`; a metadata extension's
source sends no version for `active`. `workingArea` is sent as itself
everywhere.

Why name it: measured on premise (2026-11-01, read only), a class with an
inactive version answered its inactive document and source to a read with no
version, to `inactive` and to `workingArea`, and the active one only to
`active`. A read without a version is not "the active version". The README's
"Name the version you mean" has the measurement per endpoint family; the
application log's object and source were measured on S/4HANA 2025
(2026-11-01): `200` for the three values, `400` for any other.

### Migrating

- Install `@mcp-abap-adt/interfaces-adt@^25.0.0` beside
  `@mcp-abap-adt/adt-clients@^40.0.0`; a consumer that types a client through
  the contracts compiles against 25's wider version.
- A class that extends a handler and overrides a read with
  `version?: 'active' | 'inactive'` widens its parameter to `AdtReadVersion`
  (an override must accept what the base accepts).
- Code that passed a version keeps its request. To read the working area, pass
  `'workingArea'`; to read what is active, pass `'active'` — not nothing.
