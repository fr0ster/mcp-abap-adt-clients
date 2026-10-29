# Migrating to 38.0.0

38.0.0 moves to `@mcp-abap-adt/interfaces-adt` `^20.2.0` and puts every contract
where it is accepted. No request and no answer changes; only types move or go.

- [The result-set contracts come from `@mcp-abap-adt/interfaces-adt`](#the-result-set-contracts-come-from-mcp-abap-adtinterfaces-adt):
  `IClassResults` and its 29 siblings, and `IServiceBindingPublicationConfig`.
- [The compositions are gone; each factory answers its class](#the-compositions-are-gone-each-factory-answers-its-class):
  `IClassContract<R>` and its 34 siblings are no longer declared or exported.

Code that imports neither — builds its result sets by spreading the shipped
`<x>Documents` and holds what a factory answers without naming its type —
compiles and behaves as on 37.x.

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

const client: IMyClient = await createAdtClient(connection, logger);
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

## The legacy package

`@mcp-abap-adt/adt-clients-legacy` 0.2.0 follows: it depends on
`@mcp-abap-adt/adt-clients` `^38.0.0`, and its getters answer classes. See its
[CHANGELOG](../../../adt-clients-legacy/CHANGELOG.md).
