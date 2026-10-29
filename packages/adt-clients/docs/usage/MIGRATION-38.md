# Migrating to 38.0.0

38.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^23.1.1` and
`@mcp-abap-adt/adt-strategies` `^0.16.0`, and carries two changes of contract.

**A contract lives where it is accepted** (#216). Only types move or go:

- [The result-set contracts come from `@mcp-abap-adt/interfaces-adt`](#the-result-set-contracts-come-from-mcp-abap-adtinterfaces-adt):
  `IClassResults` and its 29 siblings, and `IServiceBindingPublicationConfig`.
- [The compositions are gone; each factory answers its class](#the-compositions-are-gone-each-factory-answers-its-class):
  `IClassContract<R>` and its 34 siblings are no longer declared or exported.

**The ADT type tables decide** (#282). interfaces-adt declares, per release
variant, every API the library offers, its codes and the operations each
performs — `ADT_TYPES_ONPREM` (S/4HANA 2025), `ADT_TYPES_CLOUD` (ABAP cloud),
`ADT_TYPES_BASIS_740` (SAP_BASIS 7.40) — and the library is typed by them:

- [A client is fixed to its release variant](#a-client-is-fixed-to-its-release-variant):
  `AdtClient<V>`, `AdtClientOnPrem`, `AdtClientCloud`, and
  `createAdtClient(connection, { variant })`.
- [Every type code is a code of the tables](#every-type-code-is-a-code-of-the-tables):
  the `AdtObjectType*` unions are gone, and so are the codes no table holds.
- [`getUtils()` takes the codes its variant serves](#getutils-takes-the-codes-its-variant-serves).
- [An API with a parent takes it](#an-api-with-a-parent-takes-it):
  a function module or function include names its group.
- [An answered object is `type` or `unknownType`](#an-answered-object-is-type-or-unknowntype)
  (adt-strategies 0.16.0).
- [New members](#new-members): `updateMetadata` for fifteen types, a function
  group's source, and its activation with its main program.
- [A getter answers what it was given; a constructor takes an options object](#a-getter-answers-what-it-was-given-a-constructor-takes-an-options-object):
  a custom result set without its results no longer compiles, a handler
  constructed directly takes `(connection, { results, logger, … })`, and the
  four classes no client hands out have a static `create`.

Code that imports none of the moved types, builds its result sets by spreading
the shipped `<x>Documents`, constructs `new AdtClient(connection, logger)` (no handler directly) and
passes codes of the tables (`'CLAS/OC'`, `'FUGR/FF'`) compiles and behaves as
on 37.x, but for the [function group](#new-members)'s activation and metadata
Accept.

## The result-set contracts come from `@mcp-abap-adt/interfaces-adt`

### What changed

A factory accepts a result set (`client.getClass(results)`), so the shape of
that set is a contract, and a contract lives in the contract package. The 30
client result-set contracts and the service binding's publication config are
declared in `@mcp-abap-adt/interfaces-adt` 20.2.0 under the same names, with the
same slots, and this package no longer exports them:

`IAccessControlResults`, `IAppendStructureResults`, `IAuthorizationFieldResults`,
`IBehaviorDefinitionResults`, `IClassResults` (class, behavior implementation and
the four local includes), `IDataElementResults`, `IDdlResults`, `IDomainResults`,
`IEnhancementResults`, `IFeatureToggleResults`, `IFunctionGroupResults`,
`IFunctionIncludeResults`, `IFunctionModuleResults`, `IIncludeResults`,
`IInterfaceResults`, `IMessageClassResults`, `IMessageClassMessageResults`,
`IMetadataExtensionResults`, `IPackageResults`, `IProgramResults`,
`IScalarFunctionResults`, `IScalarFunctionImplementationResults`, `IServiceResults`,
`IServiceDefinitionResults`, `IStructureResults`, `ITableResults`,
`ITableTypeResults`, `ITransformationResults`, `ITransportResults`, `IUtilResults`;
and `IServiceBindingPublicationConfig`.

The values stay here: every `<x>Documents` default, `rawDocument`, `nothing`,
`wireItself` and `nothingIsARefusal`. Each default still `satisfies` its contract
and keeps its narrow slots. The executor, runtime, abapGit and WebSocket result
sets (`IClassExecutorResults`, `IAtcResults`, …) are unchanged and still
exported from here.

### What a caller does

Before (37.x), the contract came from this package:

```typescript
// import { classDocuments, type IClassResults } from '@mcp-abap-adt/adt-clients';
```

Now (38.0.0):

```typescript
import { classDocuments } from '@mcp-abap-adt/adt-clients';
import type { IClassResults } from '@mcp-abap-adt/interfaces-adt';
```

Add `@mcp-abap-adt/interfaces-adt` `^20.2.0` to your dependencies if you name
one of these types and do not depend on it yet.

## The compositions are gone; each factory answers its class

### What changed

Each factory had two overloads answering a named composition of capability
atoms (`getClass(): IClassContract<typeof classDocuments>`). It now has one
signature and answers its own class:

```typescript
getClass<R extends IClassResults = typeof classDocuments>(results?: R): AdtClass<R>;
```

The class implements every atom the composition named, so every member you
called is still there, typed over the same result set. Without a result set the
slots are exactly as narrow as before. What a class has beyond its old
composition is now on the type too:

- `getUtils()` answers `AdtUtils`, whose public members are those of the seven
  atoms the composition named;
- `getMessageClassMessage()` answers `AdtMessageClassMessage`, which also has
  `readMetadata` (the same request as `read`, the parent class's document);
- a member's own signature is the class's — one generic signature where the
  atom declares two call signatures (with and without `analyse`). Assigning the
  class to the atom still compiles.

`IClassContract`, `IProgramContract`, `IIncludeContract`, `IInterfaceContract`,
`IDomainContract`, `IDataElementContract`, `IAuthorizationFieldContract`,
`IStructureContract`, `ITableContract`, `ITableTypeContract`, `IDdlContract`,
`IFunctionGroupContract`, `IFunctionModuleContract`, `IFunctionIncludeContract`,
`IPackageContract`, `IMessageClassContract`, `IMessageClassMessageContract`,
`IAccessControlContract`, `ITransformationContract`, `IServiceDefinitionContract`,
`IScalarFunctionContract`, `IScalarFunctionImplementationContract`,
`IUtilsContract`, `IServiceBindingContract`, `IFeatureToggleContract`,
`IAppendStructureContract`, `IBehaviorDefinitionContract`,
`IBehaviorImplementationContract`, `IMetadataExtensionContract`,
`IEnhancementContract`, `IRequestContract`, `ILocalTestClassContract`,
`ILocalTypesContract`, `ILocalDefinitionsContract` and `ILocalMacrosContract`
are gone, the eleven exported for subclasses in other packages (from the
root and from `@mcp-abap-adt/adt-clients/core`) among them.

### What a caller does

A consumer that only calls the client changes nothing.

A consumer that names the type of what it holds composes the contract it
accepts — the factories and atoms it calls — from `@mcp-abap-adt/interfaces-adt`
alone, and types its code against that. The compiler checks, where the client is
taken, that `AdtClient` (or `AdtClientLegacy`, or the consumer's own
implementation) satisfies it:

```typescript
import type {
  IAdtLockable,
  IAdtReadable,
  IAdtUpdatable,
  IClassConfig,
  IClassResults,
} from '@mcp-abap-adt/interfaces-adt';
import { createAdtClient } from '@mcp-abap-adt/adt-clients';

interface IMyClient {
  getClass<R extends IClassResults>(
    results: R,
  ): IAdtReadable<IClassConfig, ReturnType<R['source']>> &
    IAdtLockable<IClassConfig> &
    IAdtUpdatable<Partial<IClassConfig>, ReturnType<R['updated']>>;
}

const client: IMyClient = await createAdtClient(connection, {
  variant: 'onprem',
  logger,
});
```

Before (37.x), naming a composition:

```typescript
// import type { IClassContract } from '@mcp-abap-adt/adt-clients';
// let cls: IClassContract<typeof classDocuments>;
```

Now, either your own contract as above, or the class:

```typescript
import { type AdtClass, classDocuments } from '@mcp-abap-adt/adt-clients';
let cls: AdtClass<typeof classDocuments>;
```

`ReturnType<AdtClient['getClass']>` instantiates `R` at its constraint
(`IClassResults`, every slot `unknown`), as it did on 37.x; the type of a call,
`client.getClass()`, takes the default.

## A client is fixed to its release variant

### What changed

`AdtClient` is generic in the release variant it serves:
`AdtClient<V extends AdtVariant = AdtModernVariant>`. A factory is callable
only for an API the variant's table holds, and a member only where the table
lists its operation for one of the API's codes; anything else is a compile
error naming the API:

```typescript
import { AdtClientCloud, AdtClientOnPrem } from '@mcp-abap-adt/adt-clients';

const onPrem = new AdtClientOnPrem(connection, logger); // ADT_TYPES_ONPREM
const cloud = new AdtClientCloud(connection, logger);   // ADT_TYPES_CLOUD
// onPrem.getProgram().updateMetadata(…) compiles; on `cloud` it does not:
// ABAP cloud's table lists no updateMetadata for a program.
```

A plain `AdtClient` (the default `AdtModernVariant`, on premise or cloud) is
served what **both** modern tables serve. `AdtClientOnPrem` and
`AdtClientCloud` are assignable to it; `AdtClientLegacy` (SAP_BASIS 7.40, from
`@mcp-abap-adt/adt-clients-legacy`) extends `AdtClient<'basis740'>` and is
not. The executors and ABAP Unit runners are gated the same way
(`AdtExecutor<V>`). The gates are types only: nothing is probed, and nothing
is checked at run time for a caller inside the type system.

`createAdtClient` takes the variant, declared:

```typescript
// 37.x: createAdtClient(connection, logger, options)
const client = await createAdtClient(connection, {
  variant: 'onprem', // or 'cloud'
  logger,
  // …the IAdtClientOptions it took as its third argument
});
// AdtClientOnPrem for 'onprem', AdtClientCloud for 'cloud', AdtClient for a
// variant typed only as AdtModernVariant.
```

### What a caller does

- Replace `createAdtClient(connection, logger, options)` with
  `createAdtClient(connection, { variant, logger, ...options })`, or
  construct `AdtClientOnPrem` / `AdtClientCloud` directly. `new
  AdtClient(connection, logger, options)` still compiles and serves what both
  modern tables serve.
- A call that no longer compiles names an API or operation your variant's
  table does not hold: use the variant's own client, or drop the call.
- A function typed `(client: AdtClient)` takes every modern client; to accept
  one variant's gates, type it `AdtClient<'onprem'>` (or the class).

## Every type code is a code of the tables

### What changed

`AdtObjectType`, `AdtObjectTypeLower`, `AdtSourceObjectType` and
`AdtSourceObjectTypeLower` are removed from interfaces-adt (21.0.0). Every code
the library takes is an `AdtTypeCode` — a code of a table — or a subset of it:
`IObjectReference.type`, `ISearchObjectsParams.objectType`, where-used's
`object_type`, every `getUtils()` member that takes a code.

Gone with the unions, because no table holds them:

| Gone | Use |
|---|---|
| friendly names: `class`, `interface`, `program`, `functionmodule`, `view`, `structure`, `table`, `tabletype`, … | the code: `CLAS/OC`, `INTF/OI`, `PROG/P`, `FUGR/FF`, `DDLS/DF`, `TABL/DS`, `TABL/DT`, `TTYP/DA`, … |
| lower-case spellings: `clas/oc`, `stru/dt`, `ttyp/df`, `fugr`, … | the upper-case code of the tables |
| bare R3TR types: `CLAS`, `PROG`, `DOMA`, `TABL`, … | the code with its subtype |
| `FUNC` | `FUGR/FF`, with the group as parent |
| `STRU/DS`, `STRU/DT` | `TABL/DS` |
| `TTYP/DF`, `TTYP/TT` | `TTYP/DA` |
| `INTF/IF` | `INTF/OI` |

New from the tables: `TTYP/DA` (table type) and `MSAG/N` (message class).
`VIEW/DV`, a DDIC database view no API serves, stays for group activation,
group deletion and where-used, which addressed it before; it is a group-only
code (`AdtGroupOnlyCode`), in no API table.

Every object's address is built from the tables (`buildObjectUri`): the code's
collection, then the name, and a parented code under its parent's address.
`MSAG/NN`, a message, has no address of its own: it is a row of its class, read
from the class's document.

### What a caller does

Pass the code, typed by the tables — never a `string`:

```typescript
import type { AdtTypeCode } from '@mcp-abap-adt/interfaces-adt';

const code: AdtTypeCode = 'TABL/DT';
await utils.getWhereUsed(
  { object_name: 'ZMY_TABLE', object_type: 'TABL/DT', scopeXml },
  { headers: WHERE_USED },
);
```

A code that comes from outside the type system (a tool argument, a file) is
checked against the tables once, where it enters your code — for example with
`answeredObject(text)` of adt-strategies, which answers `type` for a code a
table holds.

## `getUtils()` takes the codes its variant serves

### What changed

`AdtUtils<R, V>` takes each code as its variant serves it, and its generic reads
take exactly the codes whose request they sent before 38.0.0:

| Member | Codes |
|---|---|
| `readObjectMetadata` (`AdtMetadataReadCode`) | `CLAS/OC`, `INTF/OI`, `PROG/P`, `FUGR/F`, `FUGR/FF`, `DDLS/DF`, `TABL/DT`, `TABL/DS`, `TTYP/DA`, `DOMA/DD`, `DTEL/DE`, `DEVC/K` |
| `readObjectSource` (`AdtSourceReadCode`; `supportsSourceCode` answers `true` for these) | `CLAS/OC`, `INTF/OI`, `PROG/P`, `FUGR/FF`, `DDLS/DF`, `TABL/DT`, `TABL/DS` |
| `activateObjectsGroup` (`AdtActivationCode<V>`) | the codes whose API lists `activate` on every variant of `V`, and `DEVC/K` on the modern variants (sent before 38.0.0) |
| `deleteObjectsGroup`, `checkDeletionGroup` (`AdtDeletionCode<V>`, `AdtDeletionCheckCode<V>`) | the codes whose API lists `delete` / `deletionCheck` |
| `getWhereUsed`, `getWhereUsedScope` (`AdtWhereUsedCode<V>`) | every addressable code but `FUGR/I` (a function module is named `GROUP\|FM`) |
| `fetchNodeStructure`, `getObjectStructure` (`AdtStructureCode<V>`) | the variant's codes, and `DEVC/K` |
| `search` (`AdtSearchCode<V>`) | the variant's codes |

Any other code does not compile; from a caller outside the type system it is
refused before any request. `getUtils().getTypeStructure({ headers })` is new:
the `typestructure` list of the system, as the document came.

### What a caller does

Pass the code (`readObjectMetadata('DDLS/DF', 'ZI_VIEW')` where it was
`readObjectMetadata('view', …)`); a code outside the member's set was a
request this library never sent, and stays the caller's to send through the
connection.

## An API with a parent takes it

### What changed

A function module (`FUGR/FF`) and a function include (`FUGR/I`) live under
their function group, and the types now require the group wherever one is
addressed:

- their configs and members take `functionGroupName`;
- `readObjectMetadata('FUGR/FF', name, group)`, `readObjectSource('FUGR/FF',
  name, group)` and `getObjectSourceUri('FUGR/FF', name, group)` require it
  (`ParentedArguments`); for any other code it stays optional;
- an `IObjectReference<'FUGR/FF'>` (and `'FUGR/I'`) requires `parentName`:
  `{ name: 'Z_MY_FM', type: 'FUGR/FF', parentName: 'ZMY_GROUP' }`.

Where-used is unchanged: a function module is named `GROUP|FM`, and it takes
no `FUGR/I`.

### What a caller does

Pass the group. An inactive-objects listing names no parent, so to activate
what it lists, the caller names the group of each function module or include
(adt-strategies' CHANGELOG has the example).

## An answered object is `type` or `unknownType`

`@mcp-abap-adt/adt-strategies` 0.16.0: a reading that takes a code from an
answer (search hits, node structure, inactive objects, where-used references,
trace program references) looks it up once against the tables and answers an
`IAdtAnsweredObject` of interfaces-adt — `{ type: AdtTypeCode }` for a code a
table holds, `{ unknownType: string }` for any other, exactly as ADT sent it.
Switch on `type` for the codes you act on and handle `unknownType`; where a
node or child had `objectType`, it has `type` / `unknownType`. See the
[adt-strategies CHANGELOG](../../../adt-strategies/CHANGELOG.md).

## New members

Each sends one request, gated by the tables:

- **`updateMetadata`** for the class, interface, program, function module,
  DDL source, access control, metadata extension, behavior definition,
  service definition, scalar function, transformation, table, structure,
  include and service binding: one PUT of the caller's whole metadata document
  (`options.source`), as it is, under the caller's `lockHandle`, with the
  caller's headers, answered through `results.metadataUpdated`. Read the
  metadata, change what you need in that document, and pass it back; the
  library builds and merges no field. The program's and the include's are on
  premise only; none is served on 7.40 by this package.
- **A function group's source:** `getFunctionGroup().read(config, version?)`
  reads its `source/main` (the function pool's main program),
  `update(config, { source, lockHandle, headers })` writes it.
- **The group's activation names its main program.**
  `getFunctionGroup().activate()` sends the group and `SAPL<group>` (`FUGR/I`)
  in one request: activating the group alone left both inactive in a
  transportable package (measured on S/4HANA 2025 and ABAP cloud).
- **A function group's metadata Accept** in `readObjectMetadata('FUGR/F', …)`
  lists `functions.groups.v3+xml` first (v2 and v1 answered `406` on S/4HANA
  2025).
- **The generic ABAP Unit runner**, `AdtExecutor.getAbapUnitTestRunner()`:
  `run({ kind: 'object', name, type })` with any `osl:object type` of
  `ABAP_UNIT_RUN_TYPES`, `run({ kind: 'package', name, includeSubpackages })`,
  and `runSync(uris, { headers })` on `/abapunit/testruns`. The four
  per-object runners stay and send what they sent. A CDS view's tests are
  assigned tests: they execute only with `scope: { foreignTests: true }`;
  with the default `addForeignTestsAsPreview: true` they are listed without
  being executed (no alerts — a failing test looks like a pass). See the
  README's [ABAP Unit](../../README.md#abap-unit) section.

**A runner subclass.** `AbapUnitRunner.startByObject(name, type, options)`
(protected) and `IUnitTestRunObject.type` take `AbapUnitRunObjectType` where
they took `string`. The type holds every value the endpoint was measured to
run or that `/abapunit/metadata` lists: a subclass that passed a `string`
variable types it `AbapUnitRunObjectType` (from interfaces-adt), and a literal
of the registry (`'CLAS'`, `'PROG/P'`, `'DDLS/DF'`) compiles as before. Any
other text no longer compiles — a narrowing for such a subclass; a run of it
answered an empty result.

A custom result set for the class, interface, program, function module, DDL
source and the nine others needs a `metadataUpdated` slot (interfaces-adt
23.0.1–23.0.3); the shipped `<x>Documents` carry it.

How the tables are held to what each release answers — in CI and live — is in
the README: [The type tables' conformance check](../../README.md#the-type-tables-conformance-check).

## A getter answers what it was given; a constructor takes an options object

### What changed

Every getter of `AdtClient`, `AdtRuntimeClient` and `AdtExecutor`, and every
handler's, runner's and executor's constructor, defaulted its result set with
`results: R = <x>Documents as unknown as R`. So `client.getClass<MyResults>()`
or `executor.getClassTestRunner<MyResults>()` compiled and answered the shipped
documents typed as `MyResults`.

- **Getters.** Each getter now has two overloads: `getX()` answers the handler
  typed by the shipped documents (`AdtClass<typeof classDocuments, V>`),
  `getX(results)` one typed by `results`. The variant gates (`this:` and the
  members' `AdtPerformedBy`) are unchanged. This covers the 35 getters of
  `AdtClient` (`getClass` … `getLocalMacros`, `getUtils`), the 11 of
  `AdtRuntimeClient` (`getProfiler`, `getCrossTrace`, `getSt05Trace`,
  `getApplicationLog`, `getAtc`, `getAtcLog`, `getDdicActivation`,
  `getDumps`, `getFeeds`, `getSystemMessages`, `getGatewayErrorLog`) and the
  7 of `AdtExecutor`.
- **Constructors.** A constructor cannot choose its generic per overload, so
  it takes its results always. Each takes `(connection, options)`:
  `options.results` is required, and every other parameter it took is an
  optional field of the same name — `logger`, `systemContext`,
  `contentTypes`, `lockRegistry`, and `AbapDebugger`'s `onConflict`. The
  type is `AdtHandlerOptions<R, K>`, `K` naming the parts the class reads; a
  part it does not read is a compile error. A logger a class required is a
  required field of its options: `AdtUtils` and the runtime handlers
  `Profiler`, `CrossTrace`, `St05Trace`, `ApplicationLog`, `AdtAtc`,
  `AtcLog`, `DdicActivation`, `RuntimeDumps`, `FeedRepository`,
  `SystemMessages`, `GatewayErrorLog` take `(connection, { logger, results })`
  (`AdtLoggedOptions<R>`), and a call without the logger does not compile.
  Every constructor has the one shape `(connection, options)`. This covers:
  - every `core/*` handler (`AdtClass`, `AdtProgram`, `AdtInclude`,
    `AdtInterface`, `AdtDomain`, `AdtDataElement`, `AdtStructure`, `AdtTable`,
    `AdtDdicTableType`, `AdtDdl`, `AdtFunctionGroup`, `AdtFunctionModule`,
    `AdtFunctionInclude`, `AdtPackage`, `AdtMessageClass`,
    `AdtMessageClassMessage`, `AdtAccessControl`, `AdtTransformation`,
    `AdtServiceDefinition`, `AdtScalarFunction`,
    `AdtScalarFunctionImplementation`, `AdtAppendStructure`,
    `AdtServiceBinding`, `AdtBehaviorDefinition`, `AdtBehaviorImplementation`,
    `AdtMetadataExtension`, `AdtEnhancement`, `AdtFeatureToggle`,
    `AdtAuthorizationField`, `AdtRequest`, `AdtUtils`, `AdtLocalTestClass`,
    `AdtLocalTypes`, `AdtLocalDefinitions`, `AdtLocalMacros`);
  - every `runtime/*` handler (`Profiler`, `CrossTrace`, `St05Trace`,
    `ApplicationLog`, `AdtAtc`, `AtcLog`, `DdicActivation`, `RuntimeDumps`,
    `FeedRepository`, `SystemMessages`, `GatewayErrorLog`, `AbapDebugger`,
    `AmdpDebugger`, `MemorySnapshots`);
  - `AdtAbapGitClient`;
  - `ClassExecutor`, `ProgramExecutor`, `ClassTestRunner`,
    `ProgramTestRunner`, `FunctionGroupTestRunner`,
    `FunctionModuleTestRunner`, `AbapUnitTestRunner`, `TraceScheduling`, and
    the abstract `AbapUnitRunner` the four object runners extend.

  The legacy classes inherit these constructors.
- **`create` where no getter is.** No client hands out `AdtAbapGitClient`,
  `AbapDebugger`, `AmdpDebugger` or `MemorySnapshots`, so each has a static
  `create` with the getters' two overloads: `X.create(connection, options?)`
  answers `X<typeof xDocuments>` (the options without `results`),
  `X.create(connection, { results, … })` answers `X<R>`.

Requests and answers do not change.

### What a caller does

- `client.getClass()`, `client.getClass({ ...classDocuments, source: mine })`,
  `executor.getClassTestRunner()`: nothing.
- `client.getClass<MyResults>()` (or any getter named with its own `R` and no
  argument): pass the results — `client.getClass(myResults)`.
- A handler constructed directly — `new AdtClass(connection)`,
  `new AdtClass(connection, logger)`: pass the options, the documents
  among them —

  ```typescript
  // 37.x
  new AdtClass(connection, logger);
  new AdtInclude(connection, logger, undefined, undefined, systemContext);
  new AdtUtils(connection, logger);
  new RuntimeDumps(connection, logger);
  // 38.0.0
  new AdtClass(connection, { logger, results: classDocuments });
  new AdtInclude(connection, { logger, systemContext, results: includeDocuments });
  new AdtUtils(connection, { logger, results: utilDocuments });
  new RuntimeDumps(connection, { logger, results: runtimeDumpsDocuments });
  ```

  — or take it from the getter, `client.getClass()`.
- A handler no getter hands out — `new AbapDebugger(connection, logger)`,
  `new AdtAbapGitClient(connection)`: use its `create` —
  `AbapDebugger.create(connection, { logger })`,
  `AbapDebugger.create(connection, { onConflict: 'takeOver' })`,
  `AdtAbapGitClient.create(connection)`, and
  `X.create(connection, { results: mine })` for results of your own; or
  construct it with its documents —
  `new AbapDebugger(connection, { logger, results: abapDebuggerDocuments })`.
  Likewise `AmdpDebugger` (`amdpDebuggerDocuments`) and `MemorySnapshots`
  (`memorySnapshotsDocuments`). `AbapDebugger`'s fourth argument,
  `{ onConflict }`, is a field of the options now.
- A runner — `new ClassTestRunner(connection, logger)`: pass the options —
  `new ClassTestRunner(connection, { logger, results: classTestRunnerDocuments })`.
- A subclass's constructor takes the options and hands them to its base:
  `super(connection, options)`.

Every `<x>Documents` is exported where its class is (the root, `/core`,
`/runtime`, `/abapgit`, `/executors`), and `AdtHandlerOptions`,
`AdtLoggedOptions`, `AdtShippedOptions` and `IAdtHandlerContext` from the
root and `/core`.

## The legacy package

`@mcp-abap-adt/adt-clients-legacy` 0.2.0 follows: it depends on
`@mcp-abap-adt/adt-clients` `^38.0.0`, its getters answer classes, and
`AdtClientLegacy` extends `AdtClient<'basis740'>` — served what
`ADT_TYPES_BASIS_740` holds, every override keeping its base's gate. See its
[CHANGELOG](../../../adt-clients-legacy/CHANGELOG.md).
