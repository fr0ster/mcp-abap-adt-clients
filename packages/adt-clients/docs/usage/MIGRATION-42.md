# Migrating to 42.0.0

42.0.0 stays on `@mcp-abap-adt/interfaces-adt` `^25.0.2` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`, as 41.0.1. Two things change for a
consumer:

- [A create takes its package in the type](#a-create-takes-its-package-in-the-type):
  `create` of every handler whose request needs a package, and `validate` of
  `AdtProgram` and `AdtInclude`, take `packageName: string`, required.
- [A validate without a package sends it empty](#a-validate-without-a-package-sends-it-empty):
  every other validate — no type change; `packagename=` instead of
  `packagename=undefined`.

**A call that passes a package sends the same request as on 41.x** — the same
URL, headers and body — and answers the same types.

## A create takes its package in the type

### What changed

Each of these members took a config in which `packageName` is optional
(`IXConfig` from interfaces-adt declares `packageName?: string`), and most read
it as `config.packageName as string`. A call without a package compiled; at
run time the guard `packageName is required for create: …` refused an absent
or empty one, and nothing stopped the text `undefined` reaching the request
from a caller that built the config loosely.

Since 42.0.0 the config type requires it:

```typescript
// 41.x
create(config: Omit<IClassConfig, 'source'> & { source?: never }, options)
// 42.0.0
create(
  config: Omit<IClassConfig, 'source'> & { source?: never; packageName: string },
  options,
)
```

The members:

| Handler | Member |
|---|---|
| `AdtAccessControl` | `create` |
| `AdtAppendStructure` | `create` |
| `AdtAuthorizationField` | `create` |
| `AdtBehaviorDefinition` | `create` |
| `AdtBehaviorImplementation` | `create` |
| `AdtClass` | `create` |
| `AdtDataElement` | `create` |
| `AdtDdl` | `create` |
| `AdtDdicTableType` | `create` |
| `AdtDomain` | `create` |
| `AdtEnhancement` | `create` |
| `AdtFeatureToggle` | `create` |
| `AdtFunctionGroup` | `create` |
| `AdtInclude` | `create`, `validate` |
| `AdtInterface` | `create` |
| `AdtMessageClass` | `create` |
| `AdtMetadataExtension` | `create` |
| `AdtProgram` | `create`, `validate` |
| `AdtScalarFunction` | `create` |
| `AdtScalarFunctionImplementation` | `create` |
| `AdtServiceBinding` | `create` |
| `AdtServiceDefinition` | `create` |
| `AdtStructure` | `create` |
| `AdtTable` | `create` |
| `AdtTransformation` | `create` |

Unchanged: objects created inside another (`AdtFunctionModule`,
`AdtFunctionInclude`, the class local includes, `AdtMessageClassMessage`),
`AdtPackage` (its `packageName` is its own name, already required) and
`AdtRequest`.

Why, read in SAP's handlers on an on-premise system (2026-11-02): SAP creates
nothing without a package. The class, interface and function group handlers
refuse it; every other create is refused by the transport system (CTS_WBO_API
018, "Object cannot be created without a package"); a message class is
answered `201 Created` with nothing created. Program and include name
validation refuses an empty package (SEDI_ADT 003).

The runtime guard against an **empty** package on a create stays: the type
cannot rule out `''`. Its message is now `packageName is required for
create: SAP creates nothing without one`.

### Migrating

- **A literal config** names the package:

  ```typescript
  await client.getClass().create(
    { className: 'ZCL_MY', packageName: 'ZMY_PACKAGE', description: 'My class' },
    { headers },
  );
  ```

- **A config typed by interfaces-adt** (`IClassConfig`, `IDomainConfig`, …)
  is typed with the package where it reaches a create:

  ```typescript
  import type { IDomainConfig } from '@mcp-abap-adt/interfaces-adt';

  // 41.x: function make(config: IDomainConfig) { … }
  function make(config: IDomainConfig & { packageName: string }) {
    return client.getDomain().create(config, { headers });
  }
  ```

  Where the package comes from outside the type system (a file, the
  environment), check it once where it is read and build the config from the
  checked value.

- **`AdtProgram.validate` / `AdtInclude.validate`** name the package:
  `validate({ programName, packageName, description }, options)`.

## A validate without a package sends it empty

`validate` of `AdtAccessControl`, `AdtBehaviorDefinition`,
`AdtBehaviorImplementation`, `AdtClass`, `AdtDdl`, `AdtInterface` and
`AdtMetadataExtension` sent `packagename=undefined` when the config had no
package; they send `packagename=` (empty). `AdtServiceBinding.validate` threw a
`TypeError` before any request; it now sends the empty value too, and
`AdtServiceBinding.readTransport` sends an empty `DEVCLASS` instead of the text
`undefined` (SAP's transport check falls back to the package TADIR records).

The config type stays `Partial<IXConfig>`: these validations need no package.
SAP's handlers accept an empty value — a parameter declared mandatory is
refused only when absent — and use the package only for a namespace check or,
when given, an existence check. Measured for a class name: an empty
`packagename` is answered as a real one; no parameter `400 Parameter
packagename could not be found`. Nothing to change in a consumer.
