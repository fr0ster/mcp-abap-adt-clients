# Spec: no casts and no regular expressions in production code

The goal is `docs/superpowers/2026-11-26-no-casts-no-regex-goal.md`. This spec covers six
things:

- every site that breaks the goal's two rules;
- what replaces each group of sites;
- the owner's decisions D1–D3 and C1–C7;
- the guard test;
- how equivalence is proved, and the release order.

A replacement keeps behaviour and API exactly, except for D1–D3, C1–C5 and C7, which are
the owner's decisions. There is no exception list.

## 1. The forbidden forms: one definition

The inventory (section 2) and the guard (section 6) use the same definition. The plan's
first step implements it once, in `tools/sourceRules.js`, and takes the inventory again with
that module. Any difference from section 2 is reported before anything else changes.

**Scope.** The definition reads the production `src` of `packages/adt-strategies`,
`packages/adt-clients` and `packages/adt-clients-legacy`: every `.ts` file outside
`__tests__`, without `*.test.ts` or `*.d.ts`. Each package is read as a TypeScript program
built from its own `tsconfig.json`, so that every rule below can ask the type checker.

**C — cast.** Every node of these kinds counts once, even when several share a line:

- an `AsExpression` whose type node is not `const`;
- a `TypeAssertionExpression` (`<T>x`).

An import or export alias (`import { a as b }`) is a different node and does not count, and
neither does `satisfies`. The checker sorts each cast into a kind (K1–K8, section 2) by
comparing the expression's type with the target type.

**Y — `any`.** Two forms count:

- an `AnyKeyword` in any type position;
- **any-flow**: an expression the checker types `any` (a dependency's `parse`, `JSON.parse`,
  `Reflect.get`, `Function.prototype.bind`, …) that is not either
  - the initializer of a declaration annotated `unknown`, or
  - an argument to a parameter declared `unknown`.

  Any other use counts: a property read on it, a return, an argument to a typed parameter,
  an assignment.

**N — hand-narrowed contract value.** This form is defined by provenance, not by counting
call sites:

- A binding declared `unknown` (a parameter or a variable) is **from outside** when each
  value that reaches it is itself from outside. A value is from outside when it is one of:
  - a catch variable;
  - a promise's rejection reason;
  - a dependency's `any` bound per Y;
  - a member that a dependency's declaration types `unknown` (`IAdtWireResponse.data`,
    `IHttpWireResponse.request` and `config`, …);
  - a parameter of a boundary reader (below).
- A value whose static type is not `unknown` or `any` and that reaches an `unknown` binding
  is a **widening**. The checker follows these flows: argument to parameter, initializer,
  assignment, return, and property of an object literal. The owner decided how a value's
  type is judged: by its binding's declared type, or by its initializer's type when the
  binding has no annotation, and not by the type control flow narrowed it to. An `unknown`
  checked with `typeof` and handed on is still the value from outside it was.
- **N counts** a narrowing construct (`typeof`, `instanceof`, `in`, `Array.isArray`,
  equality with a literal) applied to a binding reached by a widening. Handing a binding
  to a boundary reader is not narrowing (the owner's decision): a reader that takes
  `unknown` and passes it straight to `field()` delegates, and narrows nothing by hand. That covers mixed callers, exported functions and locally widened
  bindings alike. A binding reached only from outside is not counted.
- **Boundary readers** are the modules whose job is to read values from outside:
  `adt-strategies/src/parsed.ts` and the property readers of section 3.5. Their own
  `unknown` parameters are from outside by definition, so a typed value passed to them is
  not a widening. The list is part of the rule, fixed in `tools/sourceRules.js`, and each
  entry names the outside data it reads. It changes only with the owner's approval. It is
  not an exception list: nothing in it is a cast, an `any` or a regex.

**R — regular expression.** These forms count, found by symbol and type, not by spelling:

- a `RegularExpressionLiteral`;
- any expression whose type is `RegExp` or derives from it (a value from a dependency, an
  alias, a computed access);
- any reference that resolves to the `RegExp` constructor or to a member of the `RegExp`
  interface;
- any reference, called or not, that resolves to the lib declaration of
  `String.prototype.match`, `matchAll` or `search`. Each of these turns a string argument
  into a regex, whatever the receiver's type: `string`, a literal, a union, a method
  reference, or `s['match']`;
- any reference to `Symbol.match`, `Symbol.matchAll`, `Symbol.replace`, `Symbol.search` or
  `Symbol.split`.

`replace`, `replaceAll` and `split` called with a string count only when an argument is
typed `RegExp`, which the second form above already catches.

**P — explicit type predicate (C6).** A user-defined `x is T` or `asserts x is T` is an
assertion the compiler does not check. It is allowed only in a reader of data from outside
the type system, and anywhere else it counts as a cast. A predicate is in such a reader when
two things hold:

- its function sits in a boundary module, or in a reader of SAP answers (adt-strategies'
  `results/` and `refusals/`, and adt-clients' readers of answers, parsed XML or JSON, and
  files);
- the narrowed parameter is from outside under N's provenance rule.

The list of reader modules is fixed in `tools/sourceRules.js`, next to the boundary
readers. The owner decided its adt-clients entries: `core/messageClass/xml.ts` and
`core/tableSettings/readDocument.ts`, because they only read SAP's answer. A reader that
also sends a request is not one: `utils/activationUtils.ts` reads the inactive objects as a
second request. Its reading of the answer therefore moves to a module of its own,
`utils/activationReading.ts`. That module is pure reading, is on the list instead, and has
an oracle test over SAP's recorded activation answers.

Not counted: comments (JSDoc examples), and inferred predicates (TypeScript 5.5 and later),
which the compiler proves.

## 2. Inventory

| Kind | adt-strategies | adt-clients | adt-clients-legacy | Total |
|---|---:|---:|---:|---:|
| K1 redundant cast | 11 | 36 | 2 | 49 |
| K2 cast asserting a caller's optional field present | 0 | 217 | 20 | 237 |
| K3 cast asserting an SAP answer's field present | 28 | 0 | 0 | 28 |
| K4 cast standing in for a generic the code cannot produce | 0 | 11 | 30 | 41 |
| K5 cast re-typing a value from outside the type system | 13 | 29 | 0 | 42 |
| K6 cast on a hand-narrowed contract value | 0 | 3 | 0 | 3 |
| K7 cast narrowing a typed union by hand | 0 | 4 | 0 | 4 |
| K8 cast completing an object's type | 0 | 1 | 0 | 1 |
| **C — casts** | **52** | **301** | **52** | **405** |
| Y — `any` keyword | 0 | 0 | 0 | 0 |
| Y — any-flow | 9 | 9 | 1 | 19 |
| N — hand-narrowed (known so far) | 5 | 1 | 0 | 6 |
| R — regular expression | 14 | 18 | 0 | 32 |
| P — explicit type predicate | 8 | 9 | 0 | 17 |

In the per-site lists, a line holding several casts is marked `(×n)`. The lists account for
all 405 casts. The scan found no `@ts-ignore`, `@ts-expect-error`, non-null `!` or definite
assignment `!:` in production `src`. Line numbers are those of the base this branch started
from. The regex count covers the 32 regex-producing nodes. The three `match`/`matchAll`
calls that consume them (`whereUsed.ts:67`, `utils.ts:566`, `wire.ts:72`) sit on lines
already listed.

### K1 — redundant casts

The expression's type is already assignable to the target type. Some of these casts are
no-ops. Others widen a value: a contract's header map cast to `Record<string, unknown>`, or a
parser's `any` cast to `Node`.

- `adt-clients-legacy/src/core/functionModule/AdtFunctionModuleLegacy.ts`: 58, 116
- `adt-clients/src/batch/AdtBatchConnection.ts`: 45
- `adt-clients/src/clients/AdtAbapGitClient.ts`: 226, 292, 295, 302 (×2), 329, 344, 355, 374, 416, 424, 427 (×2)
- `adt-clients/src/core/behaviorDefinition/update.ts`: 66
- `adt-clients/src/core/class/AdtClass.ts`: 214
- `adt-clients/src/core/enhancement/update.ts`: 56
- `adt-clients/src/core/featureToggle/xmlBuilder.ts`: 23
- `adt-clients/src/core/functionGroup/AdtFunctionGroup.ts`: 221, 375
- `adt-clients/src/core/functionGroup/update.ts`: 38
- `adt-clients/src/core/functionInclude/AdtFunctionInclude.ts`: 162
- `adt-clients/src/core/functionModule/AdtFunctionModule.ts`: 165
- `adt-clients/src/core/interface/AdtInterface.ts`: 180
- `adt-clients/src/core/messageClass/AdtMessageClassMessage.ts`: 196
- `adt-clients/src/core/program/AdtProgram.ts`: 231
- `adt-clients/src/core/scalarFunctionImplementation/AdtScalarFunctionImplementation.ts`: 200
- `adt-clients/src/core/service/AdtService.ts`: 481, 915
- `adt-clients/src/core/shared/search.ts`: 24
- `adt-clients/src/core/structure/update.ts`: 27
- `adt-clients/src/runtime/atc/run.ts`: 87
- `adt-clients/src/runtime/debugger/abap.ts`: 117, 409
- `adt-clients/src/utils/adtErrors.ts`: 174
- `adt-clients/src/utils/callTimeout.ts`: 40
- `adt-strategies/src/refusals/analyse.ts`: 225, 347, 449
- `adt-strategies/src/result.ts`: 27
- `adt-strategies/src/results/abapGitFacts.ts`: 235
- `adt-strategies/src/results/atc.ts`: 45, 133
- `adt-strategies/src/results/traces.ts`: 270
- `adt-strategies/src/results/transport/parseSearchConfigurations.ts`: 23
- `adt-strategies/src/results/unitTest.ts`: 26
- `adt-strategies/src/results/utils.ts`: 579

### K2 — a caller's optional field asserted present

The members take `AdtObjectIdentity<TConfig, TParent>`, which is interfaces-adt's `Partial`
with the parents required. They then cast a field to `string` or to its union. The fields
and their members are listed in section 4, D1.

- `adt-clients-legacy/src/core/class/AdtClassLegacy.ts`: 57, 113
- `adt-clients-legacy/src/core/class/AdtLocalDefinitionsLegacy.ts`: 40
- `adt-clients-legacy/src/core/class/AdtLocalMacrosLegacy.ts`: 40
- `adt-clients-legacy/src/core/class/AdtLocalTestClassLegacy.ts`: 40
- `adt-clients-legacy/src/core/class/AdtLocalTypesLegacy.ts`: 40
- `adt-clients-legacy/src/core/ddl/AdtDdlLegacy.ts`: 63, 133, 148
- `adt-clients-legacy/src/core/functionGroup/AdtFunctionGroupLegacy.ts`: 59, 99, 120
- `adt-clients-legacy/src/core/functionModule/AdtFunctionModuleLegacy.ts`: 61, 117
- `adt-clients-legacy/src/core/include/AdtIncludeLegacy.ts`: 97
- `adt-clients-legacy/src/core/interface/AdtInterfaceLegacy.ts`: 55, 111
- `adt-clients-legacy/src/core/messageClass/AdtMessageClassLegacy.ts`: 64
- `adt-clients-legacy/src/core/program/AdtProgramLegacy.ts`: 55, 111
- `adt-clients/src/core/accessControl/AdtAccessControl.ts`: 135, 295, 330
- `adt-clients/src/core/accessControl/versions.ts`: 26
- `adt-clients/src/core/appendStructure/AdtAppendStructure.ts`: 128, 179, 182, 307, 310
- `adt-clients/src/core/appendStructure/versions.ts`: 25
- `adt-clients/src/core/authorizationField/AdtAuthorizationField.ts`: 118
- `adt-clients/src/core/behaviorDefinition/AdtBehaviorDefinition.ts`: 148, 208, 210, 324, 358
- `adt-clients/src/core/behaviorDefinition/versions.ts`: 28
- `adt-clients/src/core/behaviorImplementation/AdtBehaviorImplementation.ts`: 143, 365
- `adt-clients/src/core/behaviorImplementation/versions.ts`: 24
- `adt-clients/src/core/class/AdtClass.ts`: 119, 132, 155, 257, 305, 306, 339, 340, 363, 387, 419, 443, 457
- `adt-clients/src/core/class/AdtClassMemberBase.ts`: 132, 160, 199, 231, 252
- `adt-clients/src/core/class/AdtLocalDefinitions.ts`: 108, 109, 135, 173, 187, 222, 223, 238
- `adt-clients/src/core/class/AdtLocalMacros.ts`: 107, 108, 134, 172, 186, 221, 222, 236
- `adt-clients/src/core/class/AdtLocalTestClass.ts`: 107, 108, 134, 172, 186, 221, 222, 237
- `adt-clients/src/core/class/AdtLocalTypes.ts`: 107, 108, 134, 172, 186, 221, 222, 237
- `adt-clients/src/core/dataElement/AdtDataElement.ts`: 114, 255
- `adt-clients/src/core/ddl/AdtDdl.ts`: 135, 293, 328
- `adt-clients/src/core/ddl/versions.ts`: 24
- `adt-clients/src/core/domain/AdtDomain.ts`: 112, 172, 261
- `adt-clients/src/core/enhancement/AdtEnhancement.ts`: 158, 175, 187, 344, 415
- `adt-clients/src/core/enhancement/versions.ts`: 25, 26
- `adt-clients/src/core/featureToggle/AdtFeatureToggle.ts`: 132, 283, 320
- `adt-clients/src/core/functionGroup/AdtFunctionGroup.ts`: 151, 168, 187, 231, 261, 285, 306, 339, 340, 341, 367, 377, 386, 408, 432, 458, 483, 500, 521
- `adt-clients/src/core/functionGroup/update.ts`: 37
- `adt-clients/src/core/functionInclude/AdtFunctionInclude.ts`: 163, 314, 366
- `adt-clients/src/core/functionInclude/versions.ts`: 27 (×2)
- `adt-clients/src/core/functionModule/AdtFunctionModule.ts`: 166, 216, 319, 320, 356
- `adt-clients/src/core/functionModule/versions.ts`: 27 (×2)
- `adt-clients/src/core/include/AdtInclude.ts`: 72, 134, 152, 341, 375
- `adt-clients/src/core/interface/AdtInterface.ts`: 146, 190, 220, 241, 267, 282, 283, 315, 316, 340, 364, 390, 415, 438, 457, 478
- `adt-clients/src/core/interface/versions.ts`: 22
- `adt-clients/src/core/messageClass/AdtMessageClass.ts`: 115, 181, 249
- `adt-clients/src/core/messageClass/AdtMessageClassMessage.ts`: 112
- `adt-clients/src/core/metadataExtension/AdtMetadataExtension.ts`: 144, 199, 302, 337
- `adt-clients/src/core/metadataExtension/versions.ts`: 27
- `adt-clients/src/core/package/AdtPackage.ts`: 114, 131, 178, 251, 282, 283
- `adt-clients/src/core/package/create.ts`: 36
- `adt-clients/src/core/program/AdtProgram.ts`: 157, 171, 195, 278, 297, 321, 337, 338, 371, 372, 396, 424, 450, 475, 498, 517, 538
- `adt-clients/src/core/program/versions.ts`: 22
- `adt-clients/src/core/scalarFunction/AdtScalarFunction.ts`: 137, 189, 298, 333
- `adt-clients/src/core/scalarFunction/versions.ts`: 27
- `adt-clients/src/core/scalarFunctionImplementation/AdtScalarFunctionImplementation.ts`: 145, 204, 327, 365
- `adt-clients/src/core/scalarFunctionImplementation/versions.ts`: 28
- `adt-clients/src/core/service/AdtService.ts`: 139, 368, 370, 377, 380, 381, 631
- `adt-clients/src/core/serviceDefinition/AdtServiceDefinition.ts`: 143, 297, 332
- `adt-clients/src/core/serviceDefinition/versions.ts`: 27
- `adt-clients/src/core/structure/AdtStructure.ts`: 134, 186, 290, 325
- `adt-clients/src/core/structure/versions.ts`: 22
- `adt-clients/src/core/table/AdtTable.ts`: 132, 291, 326
- `adt-clients/src/core/table/versions.ts`: 22
- `adt-clients/src/core/tabletype/AdtDdicTableType.ts`: 116, 251
- `adt-clients/src/core/tabletype/versions.ts`: 25
- `adt-clients/src/core/transformation/AdtTransformation.ts`: 137, 305, 340
- `adt-clients/src/core/transformation/versions.ts`: 27
- `adt-clients/src/core/transport/AdtRequest.ts`: 153, 325
- `adt-clients/src/core/transport/create.ts`: 58

### K3 — an SAP answer's field asserted present

`readTraceEntries` and the trace view readers cast `text(…)`, `attr(…)` and `numberOf(…)`,
which are `string | undefined` or `number | undefined`, to the required fields of
`ITraceEntry` and of the view rows.

- `adt-strategies/src/results/traces.ts`: 380, 381, 489, 491, 496, 498, 500, 501, 503, 505, 509, 510, 512, 513, 514, 515, 516, 518, 519, 532, 534, 546, 564, 565, 599, 620, 621, 642

### K4 — a generic the code cannot produce

- **The verdict `E`** (37 casts): the library's own `IAdtError` is cast to the caller's `E`.
  This happens in `answering`, `systemInfo`, `chain`, the abapGit exchange and every legacy
  refusal.
- **`AdtBatchConnection.makeAdtRequest<T, D>`** (`AdtBatchConnection.ts:70`, cast at `:93`).
- **`AdtAbapGitClient`'s result-slot lookup** (`:231`).
- **`AdtClientsWS.request`'s caller-chosen `TResponse`** (`:126`).
- **`absentOnLegacy<T>`** (`absentOnLegacy.ts:77`).

- `adt-clients-legacy/src/clients/absentOnLegacy.ts`: 77
- `adt-clients-legacy/src/core/ddl/AdtDdlLegacy.ts`: 86
- `adt-clients-legacy/src/core/package/AdtPackageLegacy.ts`: 61, 67, 73, 79, 85
- `adt-clients-legacy/src/core/shared/AdtUtilsLegacy.ts`: 541
- `adt-clients-legacy/src/core/shared/refusalLegacy.ts`: 23, 40, 71, 91
- `adt-clients-legacy/src/core/transport/AdtRequestLegacy.ts`: 79, 136, 155, 167, 180, 191, 205, 219, 234, 249, 265, 279, 295, 310
- `adt-clients-legacy/src/executors/abapUnit/AbapUnitTestRunnerLegacy.ts`: 39
- `adt-clients-legacy/src/executors/abapUnitRunLegacy.ts`: 50, 60
- `adt-clients-legacy/src/executors/functionModule/FunctionModuleTestRunnerLegacy.ts`: 33
- `adt-clients/src/batch/AdtBatchConnection.ts`: 93
- `adt-clients/src/clients/AdtAbapGitClient.ts`: 231
- `adt-clients/src/clients/AdtClientsWS.ts`: 126
- `adt-clients/src/clients/abapGit/structuredExchange.ts`: 193, 197
- `adt-clients/src/core/shared/chain.ts`: 183, 191
- `adt-clients/src/utils/adtResponse.ts`: 513, 522
- `adt-clients/src/utils/systemInfo.ts`: 189, 194

### K5 — a value from outside the type system, re-typed

These are thrown values cast to `HttpError`, `IWithResponse` or `{ response?: { status } }`;
parsed XML or JSON cast to `Node` or `Record<string, unknown>`; and contract fields typed
`unknown` cast to a shape.

- `adt-clients/src/batch/AdtBatchConnection.ts`: 112
- `adt-clients/src/batch/wire.ts`: 39
- `adt-clients/src/core/class/create.ts`: 110
- `adt-clients/src/core/enhancement/create.ts`: 100
- `adt-clients/src/core/enhancement/update.ts`: 91
- `adt-clients/src/core/functionGroup/create.ts`: 96
- `adt-clients/src/core/interface/create.ts`: 90
- `adt-clients/src/core/messageClass/lock.ts`: 127, 128, 163, 164
- `adt-clients/src/core/tabletype/read.ts`: 43
- `adt-clients/src/utils/adtErrors.ts`: 137, 148, 175
- `adt-clients/src/utils/adtResponse.ts`: 136, 137, 322, 330, 493
- `adt-clients/src/utils/discoveryEndpoints.ts`: 61
- `adt-clients/src/utils/internalUtils.ts`: 78, 82
- `adt-clients/src/utils/requestTrace.ts`: 57
- `adt-clients/src/utils/supportedMediaTypes.ts`: 45, 74
- `adt-clients/src/utils/systemInfo.ts`: 40, 69, 150
- `adt-strategies/src/refusals/analyse.ts`: 100, 102
- `adt-strategies/src/results/atc.ts`: 149, 150, 179, 180, 197, 198
- `adt-strategies/src/results/traces.ts`: 272, 289, 307, 676
- `adt-strategies/src/results/transport/parseSearchConfigurations.ts`: 71

### K6 — a hand-narrowed contract value, with its casts

`ProfilerDomain.viewResponse(traceId, view, options: unknown)` gets typed
`ViewOptions<IProfilerViews<T>, K>` from its one caller (`:214`) and casts `options` once
per view.

- `adt-clients/src/runtime/traces/ProfilerDomain.ts`: 171, 177, 183

### K7 — a typed union narrowed by hand

- `adt-clients/src/clients/AdtAbapGitClient.ts`: 285, 409
- `adt-clients/src/core/service/AdtService.ts`: 932, 939

### K8 — an object's type completed by a cast

- `adt-clients/src/clients/AdtClient.ts`: 320

### Y — any-flow

- adt-strategies: `parsed.ts:222`, `refusals/analyse.ts:450`, `refusals/read.ts:226, 262`,
  `results/abapGit.ts:258`, `results/atc.ts:45`, `results/featureToggle.ts:64`,
  `results/traces.ts:270`, `results/versions.ts:33`
- adt-clients: `core/messageClass/xml.ts:59`, `core/tableSettings/readDocument.ts:85`,
  `runtime/debugger/abap.ts:405`, `utils/activationUtils.ts:189`, `utils/adtErrors.ts:174`,
  `utils/callTimeout.ts:35, 37`, `utils/lockHandle.ts:36`, `utils/systemInfo.ts:61`
- adt-clients-legacy: `clients/absentOnLegacy.ts:32`

### N — hand-narrowed (known so far)

- adt-strategies:
  - `results/tableSettings.ts:86, 96`, where every call passes a `ParsedElement`;
  - `results/abapGitFacts.ts:242`, `results/unitTest.ts:5` and `results/utils.ts:551`,
    which receive a contract header value (`IHttpHeaderValue`) widened by a K1 cast.
- adt-clients: `runtime/traces/ProfilerDomain.ts:164`.

The provenance rule finds more once it runs on the whole program. The plan's first step
lists them, and each one gets the K6/N treatment.

### R — regular expressions

- `adt-clients/src/batch/wire.ts`: 8, 55, 61, 65, 78, 88, 94
- `adt-clients/src/core/shared/discovery.ts`: 24
- `adt-clients/src/core/shared/whereUsed.ts`: 64, 67, 92, 94, 99, 258, 259, 260
- `adt-clients/src/utils/discoveryEndpoints.ts`: 47
- `adt-clients/src/utils/systemInfo.ts`: 222
- `adt-strategies/src/refusals/analyse.ts`: 456, 458
- `adt-strategies/src/refusals/read.ts`: 328, 833, 836
- `adt-strategies/src/results/atc.ts`: 67
- `adt-strategies/src/results/traces.ts`: 385, 388, 391
- `adt-strategies/src/results/unitTest.ts`: 31, 37, 38, 39
- `adt-strategies/src/results/utils.ts`: 566

### P — explicit type predicates

- adt-strategies: `refusals/read.ts:774, 839`, `results/answeredObject.ts:27`,
  `results/atc.ts:57`, `results/traces.ts:639`, `results/transport/parseTransportTree.ts:36`,
  and two predicates over `unknown`.
- adt-clients: `clients/AdtClient.ts:225`, `core/shared/codeSets.ts:93, 98`,
  `core/transport/AdtRequest.ts:93`, `endpoints/codes.ts:121`,
  `utils/criticalSection.ts:35`, and three predicates over `unknown`.

Under C6, the six adt-clients predicates over typed parameters count as casts and are
replaced:

- **`AdtClient.ts:225`, `criticalSection.ts:35`** (connection capabilities): `in` and
  `typeof … === 'function'` narrowing, which the compiler checks.
- **`codeSets.ts:93, 98`, `endpoints/codes.ts:121`** (a string to a code union): a typed
  lookup (`ReadonlyMap<string, Code>`) whose `get` answers `Code | undefined`.
- **`AdtRequest.ts:93`**: narrowing on the union's own discriminant.

The eleven predicates that remain sit in readers of SAP answers. The plan checks each
narrowed value's provenance with the rule, and any that fails is replaced in the same way.

## 3. Replacements

### 3.1 K1

The cast is deleted. Where the code needs the wider view, the binding is declared with the
wider type: an annotation, not a cast. This change is type-only.

### 3.2 K2, K3, K4

These follow D1, D2 and D3 (section 4) and C1–C5 (section 5).

### 3.3 K6 and N

The parameter takes the type its callers pass: `ParsedElement` for the `tableSettings`
readers, and `IHttpHeaderValue | undefined` for the header readers.

`ProfilerDomain` uses TypeScript's correlated-union form, which compiles under `strict` in a
reduced model of these types (measured with this repository's `tsc`):

- a handler map typed per view, `{ [K in keyof IProfilerViews<T>]: (options:
  ViewOptions<IProfilerViews<T>, K>) => Promise<IAdtWireResponse> }`;
- the call is `const handler: (options: ViewOptions<…, K>) => … = this.handlers[view]`.

A switch over a separate `view: K` does not narrow `options` (also measured), so the switch
goes. JavaScript callers that pass an unknown view keep today's error:
`Object.hasOwn(handlers, view)` is tested first, and on `false` the same
`Unknown trace view: …` is thrown. The runtime changes, so section 7 proves it.

### 3.4 K7 and K8

- **`AdtService.ts:932, 939`**: the K1 widenings at `:481` and `:915` go, so `serviceType`
  keeps its `'odatav2' | 'odatav4'` type and no cast is left. This change is type-only.
- **`AdtAbapGitClient.ts:285, 409`**: C4 removes the old form, so `link` and
  `checkExternalRepo` take only the new args and options. No union is left, so no cast is
  left. With it go the casts at `:292, 295, 302 (×2), 416, 424, 427 (×2)` and
  `DeprecatedOptions`.
- **`AdtClient.ts:320`** (K8): `Object.assign(new Error(…), { code })`, whose type is the
  intersection. The thrown object stays an `Error` with an own enumerable `code`, as the
  cast-then-assign produced. Section 7 shows its shape.

### 3.5 K5 — readers that keep each site's access policy

These values come from outside, so a runtime check stays. It moves into typed readers in
adt-clients (`utils/ownValue.ts`) and adt-strategies (`parsed.ts`). Today's code uses two
access policies, and both are kept, each where it is used now:

- **`ownValue(holder, key)`** (`adtResponse.ts:110`, as it stands): own data properties
  only, no inherited property and no accessor. It is used only where `ownValue` is used
  today.
- **`propertyOf(holder, key): unknown`**: the same as today's direct read `holder?.key`,
  inherited properties and getters included. It returns `undefined` for `null`,
  `undefined` and primitives, as a direct read does for the keys read here (`response`,
  `status`, `data`, `request`, `config`, `params`). It reads with `Reflect.get` bound to
  `unknown` for objects and functions. It is used at every K5 site that reads directly
  today:
  - `class/create.ts:110`, `enhancement/create.ts:100`, `enhancement/update.ts:91`,
    `functionGroup/create.ts:96`, `interface/create.ts:90` and `tabletype/read.ts:43`;
  - `messageClass/lock.ts:127, 128, 163, 164`;
  - `discoveryEndpoints.ts:61`;
  - `systemInfo.ts:40, 150`;
  - `supportedMediaTypes.ts:45, 74`;
  - `internalUtils.ts:78, 82`;
  - `adtResponse.ts:322, 330, 493`;
  - `requestTrace.ts:57`.
- On top of either policy, `asNumber`, `asString` and `asRecord` return the value only when
  `typeof` matches, or `undefined` otherwise. That is the check the consuming code already
  applies after the cast (for example `typeof status === 'number'`). Where a site uses the
  value without such a check today, it keeps using the `unknown` as it did.
- **Parsed XML** (`atc.ts`, `traces.ts`, `parseSearchConfigurations.ts`, `adtErrors.ts`,
  `systemInfo.ts:69`): `parsed.ts`'s `isElement`, `field` and `listOf`. These read own
  properties of a parser's plain object, the same values as today.
- **`analyse.ts:100, 102`**: `propertyOf(answer, 'request')` and
  `propertyOf(answer, 'config')`, then `propertyOf(…, 'method' | 'url')`.
- **`wire.ts:39`, `AdtBatchConnection.ts:112`**: the request's `params`, read as its
  contract types it. A non-record keeps today's path.

### 3.6 Y — any-flow

Every `any` from a dependency is bound to `unknown` at its first use, as
`refusals/read.ts:226` already does, and is then read with the readers above. These changes
are type-only, except as noted:

- **`callTimeout.ts:35, 37, 40`**: the Proxy stays.
  - `const value: unknown = Reflect.get(target, property, receiver)`.
  - `typeof value !== 'function'` returns it.
  - Otherwise `const bound: unknown = value.bind(target)` is returned.
  - For `makeAdtRequest`, the trap returns `(request) => target.makeAdtRequest({ ...request,
    timeout })`, which is the same call the cast value made on an ordinary connection.

  Section 7 proves forwarding.
- **`absentOnLegacy.ts:32`**: `Object.getPrototypeOf` is bound to `object | null`.
- **`versions.ts:33`**: the callback's parameter is typed from the list.

### 3.7 R — exact scanners, one per pattern

Each regex is replaced by plain linear string code. The code reproduces that regex's exact
semantics on every input: leftmost match, greedy backtracking, `\b`, `/i` and global
non-overlap. It is not a parser and not a "close enough" reading. For `/i`, the scanners
compare with the regex's own folding: ECMAScript's non-Unicode `Canonicalize`, a
character's single-character upper case, where a non-ASCII character never folds to ASCII.
Each scanner's behaviour on adversarial input is pinned by the differential test of
section 7.

adt-strategies gets its own helpers, because it cannot import adt-clients.

- **`/\/runs\/([^/]+)/`**, at `unitTest.ts:31, 39` and `utils.ts:566`
  (`/activation/runs/`), and the same test without capture at `analyse.ts:456`. Take the
  first `/runs/` that one or more non-`/` characters follow, and those characters are the
  id. Otherwise look at the next occurrence.
- **`/<aunit:run[^>]*uri="([^"]+)"/`**, at `unitTest.ts:37` and `analyse.ts:458` (there
  with `uri="[^"]*\/runs\/[^/"]+`). Go through each `<aunit:run` left to right. Within it,
  up to the first `>`, take the **last** `uri="` (the greedy `[^>]*`) that a non-empty run
  of non-`"` characters and a closing `"` follow. That run may cross a `>`, as `[^"]` does.
  Then backtrack to earlier `uri="` occurrences as the regex would.
- **The fallback `/uri="([^"]+)"/`** (`unitTest.ts:38`): the first `uri="` that a non-empty
  value and `"` follow, in any element. That is why `<run uri="/runs/123"/>` still yields
  `123`. The three steps keep their order: header, then `aunit:run`, then any `uri`.
- **`/^T100KEY-V\d+$/`** (`read.ts:328`): `startsWith('T100KEY-V')`, and the rest is one or
  more ASCII digits.
- **`/\/messageclass\/([^/]+)\/messages\/([^/?]+)/i`** (`read.ts:833`): the leftmost
  `/messageclass/` (folded), then **one** non-empty segment of non-`/` characters (the id),
  then `/messages/` (folded), then a non-empty run of characters that are neither `/` nor
  `?` (the number). When a later part fails, the next `/messageclass/` is tried. Both
  captures are decoded as today.
- **`/&amp;/g`** (`read.ts:836`): `replaceAll('&amp;', '&')`.
- **`/\/+$/`** (`atc.ts:67`): drop trailing `/` characters.
- **`ID_IN_URI`** (`traces.ts:385`): the leftmost `abaptraces/` that 16 or more
  `[A-Za-z0-9]` characters follow, greedy, then `/` or the end. The regex backtracks the
  run, so the scanner does too: it takes the longest run that is still followed by `/` or
  the end, never shorter than 16.
- **`SUB_MILLI`** (`traces.ts:388`): the first `.` that one or more digits follow, and
  those digits.
- **`LEAP_SECOND`** (`traces.ts:391`): the greedy `^(.*T\d{2}:\d{2}:)60(\D.*)?$`, which
  takes the **last** `T` such that `dd:dd:60` follows and then either the end or a
  non-digit and the rest. No line terminator may sit before it, since `.` excludes line
  terminators. The scanner keeps both captures.
- **`/-/g`** (`wire.ts:8`, `discovery.ts:24`): `replaceAll('-', '')`.
- **The multipart reader** (`wire.ts:55, 61, 65, 78, 88, 94`):
  - **boundary**: the leftmost case-folded `boundary=`, then either a quoted non-empty
    value or a non-empty run of characters that are neither `;` nor ECMAScript whitespace
    (`\s` as defined, not ASCII-only);
  - **delimiter lines**: from the start or after `\n` or `\r\n`, `--` and the boundary text
    compared literally (no escaping is needed, because no pattern is built), then an
    optional `--`, then spaces or tabs, then `\r\n`, `\n` or the end. The search goes left
    to right without overlap, as `matchAll` does;
  - **inner status line**: the first `HTTP/1.` + one digit + whitespace (`\s+`) + three
    digits + whitespace (`\s*`) + the rest of the line, from the start or after a line
    break;
  - **header and body split**: a line break at the very start, else the first blank line;
  - **header lines**: split on `\n`, with a trailing `\r` removed.
- **The where-used scope** (`whereUsed.ts:64–99`). The rewrite stays as it is: a raw-text
  scanner, not the document scanner.
  - It finds each `<` + letter + `[\w-]*` + `:type`, followed by a `\b` (a non-word
    character or the end). The lazy `[^>]*?` follows, then the `/>` closest to it. These
    are prefixed, self-closing `type` tags only, as today.
  - In each tag, it takes the first `name="…"` preceded by a word boundary.
  - It tests and replaces the first `isSelected="true"` or `isSelected="false"` preceded by
    a word boundary.
  - Where there is none, it inserts the attribute after the tag name, as today.
  - A malformed document is rewritten exactly as the regexes rewrite it. No new refusal
    appears.
- **The scope rewrap** (`whereUsed.ts:258–260`): remove the first `<?xml` … `?>`, with no
  `>` between them. Rename the first `<prefix:usageScopeResult` + `\b` + attributes + `>`,
  and the first `</prefix:usageScopeResult>`, with each prefix read as
  `[A-Za-z][\w-]*`.
- **Discovery hrefs** (`discoveryEndpoints.ts:47`): a raw-text scan for every `href="` with
  no word boundary required, as in the regex, so `xhref="` also matches. The value runs to
  the next `"`. An empty value is skipped and the search resumes one character later, which
  is `exec`'s behaviour after a failed attempt. The raw text is kept as it is, entity
  spellings included, and the result is filtered to values starting with `/`, as today.
- **The cloud host test** (`systemInfo.ts:222`): a folded, unanchored search for
  `.hana.ondemand.com`.

## 4. Decisions

### D1 — K2: required fields, enumerated

interfaces-adt changes in its own PR, published first (section 8). Exactly these fields
become required, and only on the capabilities named:

1. **The object's own name**, on every capability that addresses one object:
   `className`, `interfaceName`, `programName`, `functionGroupName` (the group's own),
   `functionModuleName`, `includeName`, `ddlName`, `name` (message class, generic),
   `accessControlName`, `appendStructureName`, `enhancementName`, `scalarFunctionName`,
   `implementationName`, `structureName`, `tableName`, `tableTypeName`,
   `transformationName`, `authorizationFieldName`, `dataElementName`, `domainName`,
   `featureToggleName`, `packageName` (the package's own), `bindingName`,
   `serviceDefinitionName` (its own), `transportNumber` (the request's own). These are 144
   of the 237 casts, including the parent names (`functionGroupName` on a module or
   include, `className` on a local class). Those are already required where the capability
   names them as `TParent`, and they become required where it does not but the member
   sends them.
2. **`source`**, on these members only. Each sends a source.
   - `update`, for every source-carrying type: `options.source`, 20 casts, counting
     `options?.source` and the local `source` read from it.
   - `updateMetadata`, where the metadata document travels as `options.source`: 24 casts,
     one per type, from `AdtAccessControl.ts:330` to `AdtRequest.ts:325`.
   - `validate` and `check` of the four local class includes (`AdtLocal*.ts:108/109,
     222/223`): `config.source`, 8 casts.

   That is 52 casts in all.
3. **`lockHandle`**, on `update` (9 casts) and `updateMetadata` (2), as
   `options.lockHandle`, and in the internal `updateFunctionGroup` params
   (`functionGroup/update.ts:37`, which then follows from the member's option): 12 casts.

The remaining 29 casts are covered under "What D1 does not require" below, so
144 + 52 + 12 + 29 = 237. Two counts must not be confused:

- the inventory counts all 237 casts;
- the type-only remediation covers 208 of them (144 + 52 + 12), whose deletion leaves the
  emitted JavaScript identical (section 7, type-only changes).

The other 29 are runtime conversions with oracle tests.

**The members' own parameters.** The members of adt-clients and adt-clients-legacy still
declare their configs as `Partial<I…Config>`: 455 parameter sites in 54 files in
adt-clients, and 39 in adt-clients-legacy (for example `AdtClassLegacy.ts:54`). By method
bivariance such a member accepts the interface's narrower identity, so the field stays
optional inside it. Each of these parameters therefore takes the interface's identity type
or the required options type, and only then is the K2 cast deleted, because the field is
`string`. The class's declaration narrows with it, which is D1's consumer impact. The
emitted JavaScript of those sites does not change. K2 by package: adt-clients 217,
adt-clients-legacy 20.

**What D1 does not require.** These fields are not names, sources or lock handles, so D1
does not cover them. Making them required would be a consumer change the goal does not
name:

- `description` (11);
- `superPackage` (3);
- `baseObject`;
- `implementationType`;
- `enhancementType` (2, plus the `Map.get` at `AdtEnhancement.ts:158`);
- `serviceName` and `serviceVersion`, and `serviceDefinitionName` as a binding's
  referenced definition;
- `bindingVariant`;
- `master_system`;
- `owner`;
- the feature toggle's `source` (`IFeatureToggleSource`);
- the full-config casts at `AdtFeatureToggle.ts:283` and `AdtFunctionInclude.ts:314`.

These are 29 casts.

Each of these keeps its behaviour with no cast and no new requirement. The internal function
that receives the field takes the type the contract gives it (`string | undefined`, or the
union with `undefined`). Where a builtin needed a `string` and received `undefined`
implicitly, the conversion becomes explicit with the same result. For example,
`encodeURIComponent(v)` with `v` undefined gives `'undefined'`, and so does
``encodeURIComponent(`${v}`)``, and a query parameter object keeps the `undefined` it held.
Every one of these sites is a runtime change and gets the oracle test of section 7.

`AdtEnhancement.ts:158` needs a different fix. The release callback receives only `name` and
`lockHandle` (`LockRegistry.ts:143`), so the enhancement type is carried with the lock
instead:

- `createLockTracker` takes a per-lock datum (`track(name, handle, datum)`), and the
  release receives it (`unlock(name, handle, datum)`). The other trackers pass `undefined`.
- `AdtEnhancement.lock` passes the type it locked with (`:553`). That is the value
  `lockedTypes` held, since the map is set right before `track` and is never deleted. The
  map goes.

The request sent is the same, and section 7 proves it.

**Consumer impact**, the goal's first change: a caller that omits one of the fields in 1–3
gets a compile error.

### D2 — K3: a reading throws on a missing required field (28 casts)

The trace readers read each field the result type requires with a reader that throws a
`trc:… is missing` error naming it, in the form of `tableSettings.ts:86, 96`. Numbers and the
boolean throw when absent. What a reading's throw becomes in `answering` is unchanged.
Optional fields are read with no cast.

### D3 — K4: the declared overloads, and what they cannot cover alone

Every member implementation of the form `<E extends IAdtError = IAdtError>(…, options?:
…<E>)` gets the interfaces' two overloads: a generic one that requires `analyse`, and a
plain one. That is 703 signatures in 86 files. By package, adt-clients has 598 in 63
files, and adt-clients-legacy has 105 in 23, which covers every legacy override, refusing or
not (such as `ClassTestRunnerLegacy.ts:43`). The shared helpers take the same pair: `answering`, `answeringExchange`, `answeringActivation`, `systemInfo`'s answer,
`chain`, the abapGit facts exchange and the legacy refusals.

**Overloads alone do not make these sound.** TypeScript accepts an implementation whose
return type the overload's return type is merely assignable to. A body that returns the
library's `IAdtError` under the generic overload is therefore still the lie the cast was.
These paths do that even when `analyse` is given:

- `adtResponse.ts:502–522`, `systemInfo.ts:185–194` and `structuredExchange.ts:189–197`:
  `analyse` is called first, with the verdict and the answer (`undefined` when none came).
  When it clears the verdict and no answer came back, the library's own verdict stands.
- `chain.ts:183, 191`: a step answered without a strategy, so its failure is an
  `IAdtError`. The rollback message is added to it.
- The legacy refusals (`refusalLegacy.ts:6`): by design, no request is sent and `analyse`
  is not called.

These paths are typed by C3. Every other generic path, where the returned error is
`analyse`'s own, is typed by the overload and needs no cast. The four other generic
stand-ins and the abapGit args are C1, C2, C4 and C5.

### D4 — the owner's decisions during the adt-clients stage

These are the owner's decisions, taken when the stage met cases the sections
above did not settle.

- **The abapGit slot lookup** (`AdtAbapGitClient.ts:226, 231`): the constructor's
  options type becomes `AdtHandlerOptions<AbapGitStrategiesOf<T> & FactsReaders<T>,
  'logger'>`, so the compiler checks that each slot has a reader of the value it
  answers. The lookup then indexes a map typed per slot, with no cast. The `.d.ts`
  change is accepted, and it goes into the migration note.
- **Values from outside the type system are shape-checked** where they fill a typed
  field:
  - from a thrown value, `message` is kept only when it is a string; `response` only
    when it is an object whose `status` is an integer; `request` as only its string
    `method` and `url`;
  - a batch request's `params` is accepted when it is a string, a `URLSearchParams`,
    or a plain object whose values are strings, numbers or booleans, and anything
    else is refused with the library's own error.

  These are intended changes for odd values. Each gets a test that fails against the
  old code first, and each is named in the migration note.
- **The absent-field failures of the 29 D1 does not require stay as they are** (step
  37). The same inputs give the same results, the `TypeError`s included. Each site
  keeps them in a form without a cast; a site for which none exists is reported to
  the owner with its grounds, and nothing is invented.
- **The abapGit slot map is complete** (a further decision, replacing the first one's
  wording): `FactsReaders<T>` names a reader for each of the 14 new-form slots, and
  `abapGitFactsDefaults` holds the default ones. `create()` spreads the result set over
  the defaults. A direct `new AdtAbapGitClient(connection, { results })` passes all 14
  readers and an explicit `T`; the migration note says so, with an example. The casts at
  `AdtAbapGitClient.ts:226, 231` go.
- **The 13 absent-field crashes become required fields** (replacing "stay as they are"):
  a field the request builder always reads is required in the member's type, as D1 does
  for identity — the description of the behaviour definition, function group, function
  module, interface, metadata extension, structure and service binding; the service
  binding's `serviceName`, `serviceDefinitionName`, `serviceVersion` and `bindingVariant`;
  and the enhancement type of `create`. Omitting one is a compile error instead of a
  runtime `TypeError`, each pinned by a type check that fails first, and named in the
  migration note. They are required in adt-clients' own member parameters; a type of
  interfaces-adt is not changed without the owner's decision (another release).
- **The enhancement's `readMetadata` requires `enhancementType`** (the owner's
  decision): the type names the read's `Accept`, so an absent one would send
  `Accept: undefined`. It is required like the 13 fields above, with a type check
  that fails first, and the last cast of adt-clients goes: its baseline is empty.
- **interfaces-adt 33.0.0, inside this task** (the owner's decision): the 13 fields
  and `enhancementType` on `readMetadata` become required in interfaces-adt's own
  config types too, each pinned by a type check that fails against 32, and the
  `IAdtObject` example that reads `answer.getError().t100` narrows `E | IAdtError`
  first. It goes in its own PR in that repository, linked to #304 and #333. Once it
  is published, one commit raises all three packages to `^33.0.0` from the registry,
  as step 40 did for 32.
- **K5, a rejection with `null` or `undefined`**: the six catch blocks rethrow it as
  it came instead of the `TypeError` of their own. Accepted, and named in the
  migration note.
- **The parsed readers are copied into adt-clients** (`utils/ownValue.ts`: `isElement`,
  `field`, `at`), because adt-strategies' `parsed.ts` is not public. Accepted.

## 5. Consumer changes C1–C7, as decided

- **C1: `AdtBatchConnection.makeAdtRequest`** (`AdtBatchConnection.ts:70`, cast `:93`).
  `<T, D>` is removed. The signature is the contract's,
  `makeAdtRequest(options: IAbapRequestOptions): Promise<IAdtWireResponse>`, and the queued
  promise resolves with the part as it is, with no cast. A caller that named `T` drops it
  and reads `data` as `unknown`, as it does from any connection.
- **C2: `AdtClientsWS.request`** (`AdtClientsWS.ts:94`, cast `:126`). Two overloads replace
  the caller-chosen `TResponse`:
  - `request(…)` answers `unknown`;
  - `request(…, { read })` answers `TResponse`, where `read: (payload: unknown) =>
    TResponse` runs on the payload before the promise settles.

  A reader that throws rejects that request alone, with the reader's error, and the pending
  entry is removed exactly as on any other settlement. `TPayload` stays: it types what the
  caller sends, which the caller owns.
- **C3: `E | IAdtError` on the library's own paths.** In interfaces-adt, the generic
  overload of every member whose implementation can answer the library's own error with
  `analyse` given answers `IAdtResponse<T, E | IAdtError>`. Those paths are the no-answer
  verdict (`answering`, `answeringExchange`, `systemInfo`, the abapGit facts exchange,
  which gives `E | IAbapGitStructuredError`), a chain whose step answered without a
  strategy, and the legacy refusals. `analyse` is called exactly where it is called today.
  On the no-answer path it runs first, with `undefined` for the answer, and the library's
  verdict is the fallback when it clears. A legacy refusal never calls it. The helpers
  return that union with no cast, and the members on paths that only ever return
  `analyse`'s error keep `IAdtResponse<T, E>`. The interfaces-adt PR settles which members
  are which. The list is drawn from the helper each member calls, in adt-clients **and** in
  adt-clients-legacy, whose refusals and overrides decide it as much as the modern members
  do.
- **C4: the old abapGit form is removed.** Removed: the `@deprecated` overloads of `link` and
  `checkExternalRepo` (args with `remoteUser` and `remotePassword`, `DeprecatedOptions`), the
  old-form request builders they alone reach (`linkRepo` and the old external-repo check),
  and their result slots, together with interfaces-adt's declarations of them where it
  carries them. The new form is unchanged.
- **C5: refusing subclasses** (`absentOnLegacy.ts`). `AdtClientLegacy` answers **20** types
  as absent, through 20 `absentOnLegacy` calls at `AdtClientLegacy.ts:588–1009`:
  `AdtAccessControl`, `AdtAppendStructure`, `AdtAuthorizationField`,
  `AdtBehaviorDefinition`, `AdtBehaviorImplementation`, `AdtDataElement`,
  `AdtDdicTableType`, `AdtDomain`, `AdtEnhancement`, `AdtFeatureToggle`,
  `AdtMetadataExtension`, `AdtScalarFunction`, `AdtScalarFunctionImplementation`,
  `AdtServiceBinding`, `AdtServiceDefinition`, `AdtStructure`, `AdtTable`,
  `AdtTableSettings`, `AdtTextElements` and `AdtTransformation`. Each gets a
  `*AbsentLegacy` class.

  **What is overridden.** Today `membersOf` (`absentOnLegacy.ts:22–35`) walks the prototype
  chain at run time. It refuses every function there, the TypeScript-private helpers
  included (`AdtDomain.ts:111` `private name`, `AdtTable.ts:131` `private name`). A subclass
  cannot declare a member under the name of a base class's private member (TS2415), so the
  subclass overrides only the **public and protected** members, which are the class's
  operations. The private helpers stay the modern ones.

  The refusal still holds, for two reasons:

  - Every overridden operation answers the refusal without calling anything. The private
    helpers are reached only from the operations, so none of them runs. This was read for
    `AdtDomain.ts` (11 `this.name(…)` calls, none in the constructor) and `AdtTable.ts` (13).
    For all 20 classes it is inference until the test below runs.
  - A test enumerates the modern prototype chain, splits it into public or protected
    members and private ones by the TypeScript declarations (the compiler API over the
    modern class), and proves two things. Every public or protected member is overridden.
    Calling each one on the subclass, with a recording connection, answers the refusal and
    sends no request.

  **What a caller sees differently** (part of C5):

  - `instanceof` the modern class is true;
  - the operations sit on the subclass's prototype, not on the object;
  - the private helpers are reachable from JavaScript as the modern ones.

  The factory constructs each subclass with the connection and options it already holds.
  The modern constructor sends no request, and the test shows it. `absentOnLegacy` and its
  record-plus-cast go.

  **The C3 inventory** includes all 20 types' operations, typed `E | IAdtError`, since each
  answers the library's refusal under a generic call.
- **C6: type predicates.** See section 1, P, and the replacements listed under section 2, P.

- **C7: one endpoint, one method.** The owner's words: «Не мають на рівні
  adt-clients самі ставити локи як не передано локхендл, оце як раз порушення
  правила один метод один ендпойнт.»

  A member sends one request. It never locks, unlocks or chains another
  endpoint for itself: lock, write and unlock are separate members, and the
  caller composes them. interfaces-adt 32.0.0 carries the contracts
  (`IAdtLockedWrite`, `IAdtLockFreeUpdatable`, `IAdtLockFreeMetadataUpdatable`,
  `IAdtMessageClassMessageLockable`, `IAdtMessageClassMessageUpdatable`).

  **The inventory** covers both packages, tests excluded. It was found by
  reading every public member's call graph down to `makeAdtRequest`, and by the
  AST scan for `lock*`/`unlock*` calls made from any other function.

  - **No member locks when no handle is given.** No `update` or
    `updateMetadata` branches on a missing `lockHandle` to lock for itself, in
    either package. A missing handle is sent as nothing:
    - `functionGroup/update.ts:38`, `featureToggle/update.ts:27` and
      `featureToggle/updateSource.ts:23` drop the parameter;
    - `program/update.ts:25` sends `lockHandle=undefined`.

    So the change here is the type: `lockHandle` becomes required wherever a
    member sends it, and a call without one is a compile error. The members
    above then always send the handle they are given.
  - **The two writes that take no lock** move to the lock-free atoms, with no
    `lockHandle` at all:
    - `AdtService.update` (`service/AdtService.ts:458`, the publication
      `POST …/publishjobs`), as `IAdtLockFreeUpdatable<
      IServiceBindingPublicationConfig, …>`;
    - `AdtRequest.updateMetadata` (`transport/AdtRequest.ts:307`), as
      `IAdtLockFreeMetadataUpdatable`.
  - **The one lock chain is split.** `AdtMessageClassMessage.create`,
    `update` and `delete` (`messageClass/AdtMessageClassMessage.ts:163, 177,
    192`) run `writeClass` (`:209`), and `messageClass/lock.ts:86` calls that
    "the approved exception to one member, one request". Today the chain is:
    1. GET the class source (working area);
    2. LOCK_MSG on a stateful session (`lockMessageIfGranted`; a 403 is
       swallowed);
    3. LOCK the class for the message (`lockClassForMessageOrPlain`; a 403
       falls back to the plain class LOCK);
    4. PUT the class document on a stateless session;
    5. UNLOCK the class, then UNLOCK_ALL on the message, both stateful.

    It becomes four members of the message handler, one request each:
    - `lockMessage` (LOCK_MSG);
    - `lockClassForMessage` (LOCK with `msgNo` and `onSave=X`);
    - `update` (the PUT of the class document, given `classDocument`,
      `classLockHandle` and `messageLockHandle`; an upsert requires `msgtext`,
      and `removeMessage: true` removes the message from the document);
    - `unlockMessages` (UNLOCK_ALL).

    The class's own `lock`, `read` and `unlock` stay the message class's
    members. The variant tables list `lockMessage`, `lockClassForMessage`,
    `update` and `unlockMessages` for `MSAG/NN` in place of `create` and
    `delete` (interfaces-adt 32.0.0). Neither 403 fallback stays in the
    library: they become steps of the caller's recipe. The old code did not
    tell a system that grants no message lock from another user's lock, and
    the recipe says so; the caller reads the refusal before it falls back. The
    recipe also gives the locks up on every way out: `unlockMessages` after a
    failed class lock, and the class unlock and then `unlockMessages` after a
    failed read or `update`, as the old chain's scope ends did. The recipe keeps the session rule the code comments
    record: locks and unlocks on the stateful session, the PUT stateless, and
    the class unlocked before the message. It goes into the README, the
    migration note and the mcp-abap-adt follow-up (section 8).
    `lockClassForMessageOrPlain` and `lockMessageIfGranted` leave.
  - **The stale "Without it, this locks…" doc comments**, which describe a
    self-locking chain the code does not have, are corrected at all 20 sites,
    each a "With `options.lockHandle` the caller holds the lock and owns the
    chain…" block in `core/`:
    - `tabletype/AdtDdicTableType.ts:218`, `functionModule/AdtFunctionModule.ts:291`,
      `functionInclude/AdtFunctionInclude.ts:300`,
      `functionGroup/AdtFunctionGroup.ts:352`,
      `serviceDefinition/AdtServiceDefinition.ts:266`,
      `metadataExtension/AdtMetadataExtension.ts:272`, `program/AdtProgram.ts:306`;
    - `transformation/AdtTransformation.ts:274`, `domain/AdtDomain.ts:222`,
      `interface/AdtInterface.ts:252`, `scalarFunction/AdtScalarFunction.ts:267`,
      `accessControl/AdtAccessControl.ts:264`, `table/AdtTable.ts:265`;
    - `scalarFunctionImplementation/AdtScalarFunctionImplementation.ts:296`,
      `behaviorDefinition/AdtBehaviorDefinition.ts:297`,
      `dataElement/AdtDataElement.ts:224`, `structure/AdtStructure.ts:264`,
      `enhancement/AdtEnhancement.ts:381`, `ddl/AdtDdl.ts:268`,
      `authorizationField/AdtAuthorizationField.ts:218`.
  - **The other multi-request members**, listed and not changed here. The owner
    rules on them later.
    - Every `activate`, plus `AdtUtils.activateObjects` and
      `AdtClass.activateTestClasses`, through `activationExchange`
      (`utils/activationUtils.ts:321–357`). When an activation answers with
      no stated outcome, it reads the inactive objects (`fetchInactiveObjects`,
      `:332`) as a second request. The 28 members:
      - `accessControl/AdtAccessControl.ts:394`, `appendStructure/AdtAppendStructure.ts:368`,
        `authorizationField/AdtAuthorizationField.ts:324`,
        `behaviorDefinition/AdtBehaviorDefinition.ts:420`,
        `class/AdtClassMemberBase.ts:183`, `class/AdtClass.ts:433`,
        `behaviorImplementation/AdtBehaviorImplementation.ts:408`;
      - `dataElement/AdtDataElement.ts:318`, `ddl/AdtDdl.ts:393`,
        `domain/AdtDomain.ts:324`, `enhancement/AdtEnhancement.ts:482`,
        `featureToggle/AdtFeatureToggle.ts:386`,
        `functionGroup/AdtFunctionGroup.ts:445`,
        `functionInclude/AdtFunctionInclude.ts:430`;
      - `functionModule/AdtFunctionModule.ts:419`, `include/AdtInclude.ts:442`,
        `interface/AdtInterface.ts:377`,
        `metadataExtension/AdtMetadataExtension.ts:395`,
        `program/AdtProgram.ts:437`, `scalarFunction/AdtScalarFunction.ts:397`,
        `scalarFunctionImplementation/AdtScalarFunctionImplementation.ts:430`;
      - `service/AdtService.ts:690`, `serviceDefinition/AdtServiceDefinition.ts:396`,
        `shared/AdtUtils.ts:596`, `structure/AdtStructure.ts:389`,
        `table/AdtTable.ts:390`, `tabletype/AdtDdicTableType.ts:314` and
        `transformation/AdtTransformation.ts:404`.
    - `AdtTableSettings.patchMetadata` (`tableSettings/AdtTableSettings.ts:303`)
      reads and writes in one member, as interfaces-adt decision 51 approved.
  - **Reached by the call graph, and not chains as far as read.**
    `AdtService.update`, `ProfilerDomain.read` and the two tracker locks were
    read in the code. The three `check`/`run` members are inference from the
    call graph. The plan's one-request tests settle every one of them:
    - `AdtService.update` and `ProfilerDomain.read` choose one endpoint per
      call;
    - `AdtFunctionModule.lock` and `AdtFunctionInclude.lock` register the
      unlock with the tracker, which sends it only on `unlockAll()`;
    - `AdtDomain.check`, `AdtDataElement.check` and `ClassTestRunner.run`
      choose one of two endpoints;
    - the abapGit `link` and `checkExternalRepo` choose between their old and
      new forms, and C4 removes the old one.

    Legacy: the scan found no chain and no self-lock.

## 6. The guard test

`tools/sourceRules.js` (CommonJS, using only the repository's own `typescript`) implements
section 1 and exports `findForbidden(tsconfigPath)`. Its result is
`{ file, line, column, rule, kind, text }[]`, where `text` is the node's source text with
whitespace runs collapsed. The baseline keys on `{ file, rule, kind, text }`, which a line
move does not change. It compares findings as a **multiset**: two identical casts in one
file are two entries. A finding beyond the baseline's count of its key fails the test, and
so does a baseline entry with fewer findings than its count. The same module prints the inventory
(`node tools/sourceRules.js --inventory`), so the two cannot drift. Each package's unit suite
runs it in `src/__tests__/unit/sourceRules.test.ts` on that package's `tsconfig.json`. The
test asserts the result is `[]` and, on failure, lists every finding. The module runs no
regex over source.

**Its own tests** feed in-memory programs, one or more per rule. Each forbidden form must
yield exactly its rule, and each allowed form nothing:

- **C**: `x as T` and `<T>x` are refused. These are allowed: `as const`, an import alias,
  an export alias, `satisfies`, and two casts on one line counted as two.
- **Y**:
  - Refused: an `any` annotation; a `JSON.parse` result read as `.x`, returned, passed to a
    typed parameter, or assigned to a typed variable.
  - Allowed: a `JSON.parse` result bound to `unknown`, or passed to an `unknown` parameter.
- **N**:
  - Refused: a typed value passed to an `unknown` parameter that is narrowed; the same with
    one typed and one `unknown` caller; an exported function narrowing a parameter one of
    whose internal callers is typed; a local `const v: unknown = typed` that is then
    narrowed.
  - Allowed: a catch variable narrowed; a `.data` of `IAdtWireResponse` narrowed; a typed
    value passed to a boundary reader.
- **R**:
  - Refused: a literal; `new RegExp`, `RegExp(…)` and an alias `const R = RegExp`; a
    `RegExp` value received from a dependency's declaration and used; `s.match('x')`,
    `s.matchAll('x')` and `s.search('x')`, also on a literal or a union receiver;
    `s['match']`; `const m = s.match`; `Symbol.replace`.
  - Allowed: `s.replace('a', 'b')`, `s.replaceAll('-', '')` and `s.split(',')`.
- **P**: each predicate is counted, and refused or not as C6 decides.

**Proving it load-bearing**: the plan breaks each rule once in real `src`, watches the
suite go red, and reverts. There is no exception list. The boundary-reader list (section 1)
is part of the rule. The existing `noRegexInDocumentPatches.test.ts` stays.

## 7. Proving equivalence, per site

- **Type-only changes** (K1, K2's deletions under D1, the N/K6 parameter types, the K7
  `AdtService` change, the D3 overloads, and Y bindings that add no runtime code): each
  package's emitted `dist/**/*.js` before and after is compared by
  `tools/compare-emit.js`. Each file is parsed and printed without its redundant
  parentheses, because deleting `(x as T)` leaves `(x)` in TypeScript's output and the
  parentheses change no evaluation. A new module that holds only types, and so emits only
  the module marker, is no difference. Everything else must be identical, outside the
  files the plan lists as runtime changes.
- **Two kinds of runtime test**, kept apart:
  - **Equivalence tests** prove unchanged behaviour. They are green against the old code
    and stay green after the change. These cover the R scanners, the K5 readers, the Y
    sites, the D1 conversions, the lock datum, `callTimeout`, `ProfilerDomain`, K8 and C6.
  - **Intended-change tests** prove a decided change. Each one is written to **fail against
    the old code**, the failure is watched, and it then passes after the change. These
    cover D2 (a reading throws on a missing field), C1 and C4 (the type checks refusing the
    old forms), C2 (the reader decides the answer type, and a readerless call answers
    `unknown`), C3 (the `E | IAdtError` type checks) and C5 (an absent handler is an
    instance of its modern class, and every public or protected member is overridden).

  Per site:
  - **R scanners**: a differential test against an oracle, which is the old regex
    implementation copied into the test, where regexes are allowed. The test runs on three
    input sets:
    - SAP's recorded inputs (below);
    - hand-written edge cases: empty, absent, case variants, CRLF and LF, a boundary-like
      line in a body, `?` in a uri, and the greedy and backtracking cases named in 3.7;
    - every string up to a bounded length over a small alphabet built from each pattern's
      significant characters (for example `< > " / = : a u r i n T 6 0 1 - \r \n` and a
      space), plus random strings from it under a fixed seed.

    Any difference fails the test.
  - **K5 readers**: a table test per reader. The inputs are each recorded `refusal-*`
    answer, an `Error` with `response` set, an object whose `response` is inherited, a
    getter-defined `response`, a primitive and `null`. Each site's result equals the result
    taken from the code before the change, which proves each site kept its access policy.
  - **D1 conversions**: each internal function that now takes `string | undefined` is
    called with `undefined` and with a value, and the request it builds (URL, params, body)
    equals the old code's.
  - **The enhancement lock datum**: `unlockAll()` on an abandoned enhancement lock sends the
    same unlock request as before. The other trackers still release as before.
  - **`callTimeout`**: through the Proxy, `makeAdtRequest` carries the deadline; other
    methods are bound to the target; non-function members, a method that is not part of
    `IAbapConnection` and an absent member are read as before.
  - **`ProfilerDomain`**: each view reaches its endpoint with its options, and an unknown
    view from JavaScript throws the same error.
  - **K8**: the thrown error is `instanceof Error`, has an own enumerable `code` equal to
    `ADT_SESSION_ERROR.NOT_CONNECTED` and the same `message`, and has no other own
    enumerable property.
  - **D2**: one test per required trace field. When that field is removed from a recorded
    feed, the reading throws and names it. The recorded feeds read as before.
  - **C1**: a batch member still gets its part's answer, and a type check shows the generic
    form is refused.
  - **C2**: settlement on answer, on close and on timeout, with and without a reader. A
    reader that throws rejects that request only, and the next request on the same id
    settles normally.
  - **C3**: type checks that the no-answer path, a chain step and a legacy refusal are typed
    `E | IAdtError`. A spy shows that `analyse` sees exactly the calls it saw before the
    change: one call with the verdict and `undefined` on the no-answer path, and none on a
    legacy refusal.
  - **C4**: type checks that the old-form calls are refused. The new form's existing tests
    stay green.
  - **C5**: for each of the 20 types, these are intended-change tests:
    - the absent handler is an instance of the modern class and of its `*AbsentLegacy`
      class;
    - every public or protected member is overridden.

    These are equivalence tests:
    - each operation answers the same refusal as before (origin, code and message) and
      sends no request;
    - construction sends none.

    The legacy test helpers that recognise an absent handler as a plain object move to the
    subclass form, with the same strictness: `legacyRegistrations.ts:284–305`
    (`isAbsentOnLegacy`) and `legacyMemberInventory.test.ts:293–305`.
  - **C6**: each replaced predicate's callers get the same narrowing results on the same
    inputs.
  - **C7**, intended-change tests, each failing against the old code first:
    - with a recording connection, each of the four message members sends
      exactly one request: `lockMessage` one LOCK_MSG POST,
      `lockClassForMessage` one LOCK POST with `msgNo` and `onSave=X`, `update`
      one PUT carrying both handles, and `unlockMessages` one UNLOCK_ALL
      POST. Against the old code, `update` sends six;
    - the recipe composed from them sends the same requests in the same order
      and sessions as the old chain did. The old chain's recording is the
      oracle;
    - type checks that a write without `lockHandle` is refused, that a
      lock-free write refuses one, that the message's `create` and `delete`
      are gone, and that its `update` requires both handles, the class
      document and, for an upsert, `msgtext`;
    - for the members that dropped an absent handle
      (`functionGroup/update.ts:38`, `featureToggle/update.ts:27`,
      `featureToggle/updateSource.ts:23`), the request now always carries the
      handle given.

- **Type checks**: test-only `*.typecheck.ts` files use `@ts-expect-error`. They live under
  `src/__tests__/` of adt-clients, where `tsconfig.test.json` (`src/**/*`, and adt-strategies'
  `src`) includes them, and of adt-clients-legacy (its own `tsconfig.test.json`). Both run in
  `test:check`, which the root `npm run check` runs. They show, per capability family:
  - **compile errors**: an omitted name; an omitted `source` on `update`, `updateMetadata`
    and the local includes' `validate` and `check`; an omitted `lockHandle`; a generic call
    without `analyse`;
  - **compiles**: a generic call with `analyse`; a default call with no `E`;
  - **unchanged signatures**: every other exported signature. An `.d.ts` snapshot of each
    package's public surface is compared before and after, and the only differences allowed
    are the ones D1–D3 and C1–C5 name.
- **Recorded inputs**:
  - **run ids**: `unittest-run-passing`, `refusal-unittest-run-failing` and the
    `activation-*` runs;
  - **refusals**: the refusal recordings with `T100KEY-V` and longtext links;
  - **discovery**: `corpus/adt/discovery/`;
  - **traces**: the trace recordings and the strategies' feed fixtures;
  - **new in this task**: the recordings below.
  - **The recordings this task added.** These are read-only, on the shared class
    `ZAC_SHR_RUN01` and the shared domain `ZAC_SHR_GA_DOM`, on premise (`s4-2025`) and on
    ABAP Cloud (`abap-cloud`). They are in `packages/adt-clients/corpus/adt/answers/`, one
    `.json` per step beside its body:
    - `batch-get-parts-<release>--01-batch`: a `$batch` envelope of two GET parts (the
      class's and the domain's metadata), answered `202` with its multipart body
      (`.body.txt`, byte for byte). These are the inputs of `batch/wire.ts`.
    - `where-used-scope-class-<release>--01-usagereferences-scope`: the where-used scope of
      the class. It is the input of `whereUsed.ts`'s `modifyWhereUsedScope` and of the
      `usageScopeResult` rewrap.
    - `atc-worklist-class-<release>--01-customizing`, `--02-worklist-create`, `--03-run`
      and `--04-worklist`: the ATC customizing, the worklist id, a waiting run and the
      worklist. These are the inputs of `atc.ts`'s customizing, waiting-run and worklist
      readers.

    Every field was scrubbed before commit:
    - credentials and the session headers are redacted;
    - the host is replaced by `sap.example.com` and the user by `SAPUSER01`;
    - the system id is replaced by `SYS` and the client by `000`;
    - IP addresses become `0.0.0.0` and e-mail addresses `user@example.com`;
    - every 32-hex id is replaced by a numbered id of the same shape, consistently across a
      case's files, so a multipart boundary still matches its body.
  The existing corpus was also checked. `read-where-used-list-structure--01-informationsystem-usagereferences.body.xml:20`
  carries an unscrubbed `responsible`. It is the owner of `ZLOCAL`, the package the ABAP
  Cloud trial creates itself: `_SAPSUPPORT`, an SAP-defined support identity, not a
  person's account (inference from where it appears; no person uses it). It is kept as it
  is.
- **Live**: the changed members run once on premise and on ABAP Cloud through the
  existing integration suites.

## 8. Release order and documentation

**Order.** interfaces-adt goes first, in its own repository and its own PR, released in its
own versioning and published. Then adt-strategies, adt-clients and adt-clients-legacy follow,
in `publishOrder`. They are published the way `tools/publish-changed.js` works:

- all three are tagged at the merge commit;
- one `npm run release:publish` runs `npm run check` once, then publishes every pending
  package in `publishOrder` (strategies, clients, legacy);
- at the end it verifies that the registry serves each version.

Its guard requires a tag at HEAD for every pending package (`publish-changed.js:303` and
after), so the three are not tagged one by one. The dependency order comes from
`publishOrder`. Inside the repository the check builds through the workspace siblings,
which is the standing exception. Each package raises its
`@mcp-abap-adt/interfaces-adt` range to the published version, resolved from the npm
registry. No `file:`, `link:` or workspace link to interfaces-adt is used. After each
install, the lockfile is checked: interfaces-adt must resolve from the registry and must not
be `"link": true`.

**Versions:**

- **adt-clients** and **adt-clients-legacy**: breaking releases (majors).
- **adt-strategies**: a breaking 0.x release. D2 changes its public trace readings, and its
  interfaces-adt range crosses that package's breaking release.
- **interfaces-adt**: its own versioning.
- **mcp-abap-adt**: takes the new majors deliberately, outside this task.

**Sibling versions and ranges move in one commit.** One commit sets the three new versions
and every range between the siblings:

- adt-clients' `dependencies` on adt-strategies (`^0.28.2` today);
- adt-clients-legacy's `devDependencies` on adt-strategies (`^0.28.0`) and on adt-clients
  (`^47.0.0`);
- adt-clients-legacy's `peerDependencies` on adt-clients (`^46.1.0 || ^47.0.0`).

Each becomes the new breaking version, so every range stays satisfiable by what this
release publishes, and none points across it. The lockfile is regenerated by npm in the
same commit.

Before tagging:

- every third-party and interfaces-adt range resolves on the registry, and each
  workspace-sibling range names the version this release publishes;
- the only `"link": true` entries are the repository's own workspace siblings.

After the publish run, a clean install of each of the three from the registry, outside the
repository, proves it installs.

The release gate is the root `npm run check`.

**Documentation**, in the release that ships the change, per package:

- **`CHANGELOG.md`**: D1–D3 and C1–C6.
- **A migration note** (`docs/usage/MIGRATION-<version>.md`, linked from the README's
  migration list) saying what a consumer on the old contract must do. That means: give the
  name, the `source` or the `lockHandle` where now required; pass `analyse` wherever `E` is
  named; and expect a trace reading to throw on a feed lacking a required field. It also
  covers C1–C5: drop `<T>` on the batch connection; pass a reader to `AdtClientsWS.request`
  for a typed answer; narrow `E | IAdtError` where a member now answers it; move from the
  old abapGit form to the new one; and stop relying on an absent legacy handler not being
  an instance of its modern class.
  It also covers C7: pass `lockHandle` to every write; move the binding's
  publication and the transport's document write to the lock-free atoms; and
  compose a message's write from `lockMessage`, `lockClassForMessage`, the
  class's `read`, `update`, the class's `unlock` and `unlockMessages`, with the
  locks and unlocks on the stateful session and the PUT stateless. The same
  recipe goes into the mcp-abap-adt follow-up in the PR description.
- **Where each package's note ships.**
  - adt-clients: `docs/usage/MIGRATION-<major>.md`.
  - adt-clients-legacy: a migration section in its README, and `docs/LEGACY.md`.
  - adt-strategies publishes only `dist`, `README.md`, `LICENSE`, `COPYING` and `ERRATA.md`
    (`package.json` `files`), so a note in a `docs/` directory would not reach its
    consumers. Its migration note is therefore a "Migrating to <version>" section of its
    `README.md`, and its D2 entry goes into the `ERRATA.md` it publishes.
- **Usage examples**: every README and `docs/usage/` example that calls a member whose
  signature changes is updated and compiled. The examples directory is in
  `tsconfig.test.json`'s `include`.
- **Affected guides**: every document that mentions a changed API is reviewed, as a search
  finds them at this branch's base:
  - **batches (C1)**: adt-clients `README.md`, `docs/usage/BATCH.md` and
    `docs/usage/CLIENT_API_REFERENCE.md`, and adt-clients-legacy `docs/LEGACY.md`;
  - **WebSocket (C2)**: adt-clients `README.md`, `docs/usage/CLIENT_API_REFERENCE.md`,
    `docs/usage/ADT_OBJECT_ENTITIES.md` and `docs/architecture/ARCHITECTURE.md`, and
    adt-clients-legacy `docs/LEGACY.md`;
  - **abapGit (C4)**: adt-clients `README.md` and `docs/usage/CLIENT_API_REFERENCE.md`;
  - **`analyse` and the error type (D3, C3)**: adt-clients `README.md`, `docs/README.md`,
    `docs/usage/` (`OBJECT_LIFECYCLE.md`, `STATEFUL_SESSION_GUIDE.md`,
    `CLIENT_API_REFERENCE.md`, `ERRATA.md`, `BATCH.md`, `CHECK_LOCAL_TEST_CLASS.md`,
    `ANSWER_SHAPES.md`) and `docs/architecture/` (`ARCHITECTURE.md`, `DECISIONS.md`); the
    adt-strategies `README.md`; and adt-clients-legacy `docs/LEGACY.md`;
  - **trace readings (D2)**: adt-clients `README.md`, `docs/README.md`,
    `docs/usage/CLIENT_API_REFERENCE.md`, `docs/usage/ADT_OBJECT_ENTITIES.md`,
    `docs/architecture/ARCHITECTURE.md` and `docs/architecture/discovery.md`; and the
    adt-strategies `README.md` and `ERRATA.md`;
  - **absent legacy handlers (C5)**: adt-clients-legacy `README.md`, `docs/LEGACY.md` and
    `docs/LIVE_TESTING.md`;
  - **identities (D1)**: every guide whose examples pass a config, all checked by
    compiling the examples.

  Earlier `MIGRATION-*.md` notes are history and stay as they are.

## 9. Not in this spec

- Test code, and tooling other than the guard, as the goal states. Comments are not code.
- The plan's step order, and how the 703 overload pairs are written.
- The exact parameter shape of the interfaces-adt change, which its own PR settles.
