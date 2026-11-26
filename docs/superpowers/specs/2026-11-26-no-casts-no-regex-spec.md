# Spec: no casts and no regular expressions in production code

The goal is `docs/superpowers/2026-11-26-no-casts-no-regex-goal.md`. This spec lists every
site that breaks the goal's two rules. It says what replaces each group of sites, how the
guard test finds the forbidden forms, how unchanged behaviour is proved, and the release
order. Section 4 records the owner's decisions on the sites where a contract had to be
made true.

## 1. How the inventory was taken

The inventory covers the production `src` of `packages/adt-strategies`,
`packages/adt-clients` and `packages/adt-clients-legacy`: every `.ts` file outside
`__tests__`, without `*.test.ts` or `*.d.ts`. Line numbers are those of the base this branch
started from. Each package was read with the TypeScript compiler API, as a program built from
its own `tsconfig.json`, so the type checker could classify what it found:

- **A cast** is an `AsExpression` whose type is not `const`, or a `<T>x` type assertion.
  An import or export alias (`import { a as b }`) is not a cast and is not counted. Each cast
  was classified by the checker. It is *redundant* when the expression's type is already
  assignable to the target. It *asserts presence* when only `undefined` stands between them.
  Otherwise it *re-types* the value.
- **`any`** means two things. One is the `any` keyword written in the source. The other is
  an `any` that enters the code from a dependency's declaration, such as `XMLParser.parse`,
  `JSON.parse` or `Reflect.get`, and is used without being bound to `unknown` first.
- **A hand-narrowed contract value** is a parameter declared `unknown` and then narrowed by
  hand (`typeof`, `Array.isArray`, a field reader), where every call site passes a value the
  type system already types. Parameters that receive thrown values, parsed documents or a
  field that a contract itself types `unknown` are not counted.
- **A regular expression** is a regex literal, or `RegExp` called or constructed. Regexes
  inside comments (JSDoc examples) are not code and are not counted.

The scan found no `@ts-ignore`, `@ts-expect-error` or non-null `!` in production `src`.

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
| **Casts** | **52** | **301** | **52** | **405** |
| `any` keyword | 0 | 0 | 0 | 0 |
| A — `any` from a dependency, used untyped | 9 | 9 | 1 | 19 |
| U — hand-narrowed `unknown` parameter | 5 | 1 | 0 | 6 |
| R — regular expression | 14 | 18 | 0 | 32 |

### K1 — redundant casts

The expression's type is already assignable to the target type. Some of these casts are
no-ops (`string as string`, `IAnalyse<E> | undefined` cast to itself). Others widen a value:
a contract's header map cast to `Record<string, unknown>`, a parser's `any` cast to `Node`.

- `adt-clients-legacy/src/core/functionModule/AdtFunctionModuleLegacy.ts`: 58, 116
- `adt-clients/src/batch/AdtBatchConnection.ts`: 45
- `adt-clients/src/clients/AdtAbapGitClient.ts`: 226, 292, 295, 302, 329, 344, 355, 374, 416, 424, 427
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

The members take `AdtObjectIdentity<TConfig, TParent>`, which is interfaces-adt's
`Partial<TConfig>` with the parent required. They then cast the name, the source or the lock
handle to `string`. With the field absent, the request goes to a URL holding `undefined`, or
a string method throws inside the exchange. This group also holds `Partial<…Config>` cast to
the full config (`AdtFeatureToggle.ts:283`, `AdtFunctionInclude.ts:314`), a string-union
option cast to its union (`EnhancementType`, `BehaviorDefinitionImplementationType`,
`ServiceBindingVariant`, `IFeatureToggleSource`), and a `Map.get` asserted present
(`AdtEnhancement.ts:158`).

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
- `adt-clients/src/core/functionInclude/versions.ts`: 27
- `adt-clients/src/core/functionModule/AdtFunctionModule.ts`: 166, 216, 319, 320, 356
- `adt-clients/src/core/functionModule/versions.ts`: 27
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

- The verdict `E`. When no `analyse` is given, the library's own `IAdtError` is cast to the
  caller's `E`: in `answering`, in `systemInfo`, in `chain`, in the abapGit exchange, and in
  every legacy refusal.
- `AdtBatchConnection.makeAdtRequest<T, D>`: the class's own generic is wider than
  `IAbapConnection.makeAdtRequest`, which is not generic.
- `AdtAbapGitClient`'s result-slot lookup.
- `AdtClientsWS.request`'s caller-chosen `TResponse` over a WebSocket payload.
- `absentOnLegacy<T>`, which builds a `T` from a record of refusing handlers.

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
`unknown` (`IHttpWireResponse.request` and `config`, a batch part's `params`) cast to a
shape.

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
`ViewOptions<IProfilerViews<T>, K>` from its one caller and casts `options` once per view.

- `adt-clients/src/runtime/traces/ProfilerDomain.ts`: 171, 177, 183

### K7 — a typed union narrowed by hand

- `AdtAbapGitClient.ts:285, 409`: `IAbapGitLinkArgs | IAbapGitLinkNewArgs` is cast to one
  member after a test on `options.credentials`, not on the args themselves.
- `AdtService.ts:932, 939`: a `string` is cast to `'odatav2' | 'odatav4'`.

- `adt-clients/src/clients/AdtAbapGitClient.ts`: 285, 409
- `adt-clients/src/core/service/AdtService.ts`: 932, 939

### K8 — an object's type completed by a cast

- `adt-clients/src/clients/AdtClient.ts`: 320

### A — `any` from a dependency, used untyped

- adt-strategies: `parsed.ts:222`, `refusals/analyse.ts:450`, `refusals/read.ts:226, 262`,
  `results/abapGit.ts:258`, `results/atc.ts:45`, `results/featureToggle.ts:64`,
  `results/traces.ts:270`, `results/versions.ts:33`
- adt-clients: `core/messageClass/xml.ts:59`, `core/tableSettings/readDocument.ts:85`,
  `runtime/debugger/abap.ts:405`, `utils/activationUtils.ts:189`, `utils/adtErrors.ts:174`,
  `utils/callTimeout.ts:35, 37`, `utils/lockHandle.ts:36`, `utils/systemInfo.ts:61`
- adt-clients-legacy: `clients/absentOnLegacy.ts:32`

### U — hand-narrowed `unknown` parameters

- adt-strategies: `results/tableSettings.ts:86` (`text`) and `:96` (`attribute`). Every call
  passes a `ParsedElement`.
- adt-strategies: `results/abapGitFacts.ts:242` (`isTextPlain`), `results/unitTest.ts:5` and
  `results/utils.ts:551` (`headerText`). They receive a contract header value
  (`IHttpHeaderValue`), which reaches them as `unknown` only through a K1 cast.
- adt-clients: `runtime/traces/ProfilerDomain.ts:164` (`viewResponse`'s `options`; see K6).

Once the K1 widening casts are removed, more parameters will fall under this rule. The
guard's U rule (section 5) finds them, and the plan re-runs the inventory after K1.

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

## 3. Replacements

### K1

The cast is deleted. Where the code needs the wider view, the binding is declared with the
wider type: an annotation, not a cast. This applies to a header map read as
`Record<string, IHttpHeaderValue>`, for example. A cast of a parser's `any` is handled under
A.

### K2, K3, K4

These follow the decisions in section 4: D1 for K2, D2 for K3, and D3 for K4 and the abapGit
K7 casts.

### K5 — a typed reader, and the runtime check it carries

These values come from outside the type system, so a runtime check stays here. It moves out
of the cast and into a reader:

- **Thrown values and `unknown` contract fields** are read with one shared set of property
  readers in adt-clients. They grow from `ownValue(holder, key)` (`utils/adtResponse.ts:110`)
  into `ownValue`, `ownRecord`, `ownString` and `ownNumber`. Each takes `unknown` and returns
  the typed value or `undefined`. A status is read as `ownNumber(ownValue(error,
  'response'), 'status')`. `HttpError`, `IWithResponse` and the inline shapes are no longer
  asserted. Each is a value the readers return, built from what was found.
- **Parsed XML in adt-strategies** is read with `parsed.ts`'s readers (`isElement`, `field`,
  `at`, `listOf`, `leafText`). A `Node` cast becomes an `isElement` test that yields
  `ParsedElement`. The ad hoc `Node` aliases in `atc.ts` and `traces.ts` go.
- **Parsed XML or JSON in adt-clients** (`adtErrors.ts`, `systemInfo.ts`, the batch part's
  `params`) uses the same property readers.
- **`analyse.ts:100, 102`** reads `answer?.request` and `answer?.config` as their contract
  types them (`unknown`, `D = unknown`), then reads `method` and `url` with the readers.
- **`traces.ts:676`** reads the contract's header map as typed. Its value type is
  `IHttpHeaderValue`, not a cast record.

### K6 and U

The parameter takes the type its callers already pass: `ParsedElement` for the
`tableSettings` readers, `IHttpHeaderValue | undefined` for the header readers.
`viewResponse` is typed per view. Its options become `ViewOptions<IProfilerViews<T>, K>`,
selected in each branch through a map from view to options type (`ProfilerViewOptions[K]`),
so the switch narrows them with no cast.

### K7

- **abapGit args** (`AdtAbapGitClient.ts:285, 409`): `IAbapGitLinkArgs` and
  `IAbapGitLinkNewArgs` (and the two external-repo shapes) differ only in
  `remoteUser?: string` versus `remoteUser?: never`. Nothing in the args lets the compiler
  narrow the union. Only the overloads tie a shape to `options.credentials`, and the
  implementation signature cannot see that link. It is resolved under D3.
- **`AdtService` service type**: the value is read from `params.serviceType`, which is
  already `'odatav2' | 'odatav4'` (see the K1 entries at `AdtService.ts:481, 915`). Without
  the earlier widening to `string`, no cast is left.

### K8

`AdtClient.ts:320`: the error is built as `Object.assign(new Error(…), { code })`, whose type
is the intersection. The thrown object is the same as today: an `Error` with an own `code`.

### A

Every `any` from a dependency is bound to `unknown` at its first use:
`const parsed: unknown = parser.parse(…)`, as `refusals/read.ts:226` already does. It is then
read with the typed readers above. Three cases differ:

- `callTimeout.ts` (`Reflect.get` and `bind` inside a Proxy) is rewritten as an object that
  forwards each `IAbapConnection` member by name. A Proxy of `any` is no longer needed.
- `absentOnLegacy.ts:32` (`Object.getPrototypeOf`) binds to `object | null`.
- `versions.ts:33` types the callback's parameter from the list, not as `unknown`.

### R — what replaces each regex

adt-strategies cannot import adt-clients, so it gets its own small plain-code helpers, and
adt-clients gets its own.

- **The run id after `/runs/`.** This covers `analyse.ts:456`, `unitTest.ts:31, 39` and
  `utils.ts:566` (`/activation/runs/`). One helper, `segmentAfter(text, marker)`, finds the
  marker with `indexOf` and takes the text up to the next `/` (or `"` where the regex
  excluded it).
- **The `aunit:run` uri inside a body** (`analyse.ts:458`, `unitTest.ts:37, 38`). The body
  is read with the strategies' XML parser, and the uri is the root `aunit:run`'s `@uri`.
  The regex took the first matching tag anywhere. Section 6 compares the two on every
  recorded run, and any difference is reported before the site changes.
- **`T100KEY-V<digits>`** (`read.ts:328`): `startsWith('T100KEY-V')` and an all-digits
  test on the rest, which must not be empty.
- **The message class longtext link** (`read.ts:833`): the path is cut at the first `?`,
  split on `/`, and searched case-insensitively for `messageclass` followed by two segments
  and then `messages`. `&amp;` (`:836`) becomes `replaceAll('&amp;', '&')`.
- **Trailing slashes** (`atc.ts:67`): a loop that drops the last character while it is `/`.
- **Trace ids and times** (`traces.ts:385, 388, 391`). A scanner finds `abaptraces/`, takes
  a run of `[A-Za-z0-9]` of at least 16 characters, and requires `/` or the end after it. The
  sub-millisecond digits are read after the first `.`. The leap second is found by
  locating `T`, checking `hh:mm:` digit by digit, then `60`, then a non-digit or the end.
- **`replace(/-/g, '')`** (`batch/wire.ts:8`, `core/shared/discovery.ts:24`) becomes
  `replaceAll('-', '')`.
- **The multipart batch answer** (`batch/wire.ts:55–94`):
  - The `boundary` is read by a Content-Type parameter reader: split on `;`, trim, match
    the key case-insensitively, unquote a quoted value.
  - A line scanner over the body finds the delimiter lines: a line that is exactly
    `--<boundary>` or `--<boundary>--`, followed by optional spaces or tabs and a line end,
    after `\n` or `\r\n` or at the start.
  - The inner status line is the first line starting `HTTP/1.` followed by one digit, then
    whitespace and three digits.
  - The header block ends at the first empty line, keeping today's rule for a part that
    starts with a line break.
  - Header lines are split on `\n`, with a trailing `\r` removed.
  - No `escapeRegExp` is needed, because nothing builds a pattern.
- **The where-used scope** (`core/shared/whereUsed.ts:64–99, 258–260`) is edited through
  adt-clients' own document scanner (`utils/documentEdit.ts`: `scanDocument`, `childAt`,
  `applySplices`), as the metadata patches do:
  - every element whose local name is `type` gets its `isSelected` attribute set or
    inserted, read by name wherever it sits;
  - the root `*:usageScopeResult` is renamed to `*:scope` by splicing its open and close
    tag names, keeping its prefix and attributes;
  - the XML declaration is dropped by slicing before the root.

  The scanner refuses a document that is not well formed, where the regex rewrote whatever
  it found. This happens only on a malformed scope answer, and the plan states it in the
  member's errata.
- **Discovery hrefs** (`utils/discoveryEndpoints.ts:47`): the discovery document is parsed,
  and every `@href` on any element is collected in document order. That is the set the
  regex collected on a well-formed document.
- **The cloud host test** (`utils/systemInfo.ts:222`):
  `baseUrl.toLowerCase().includes('.hana.ondemand.com')`. This is the same test as the
  unanchored, case-insensitive regex.

## 4. Decisions

### D1 — K2: the identity requires the name (237 casts)

The contract is made true in `@mcp-abap-adt/interfaces-adt`, in a PR of its own in that
repository:

- **The object's own name becomes required.** `AdtObjectIdentity` takes the config's name
  key as well as its parent keys. The name and the parents are required, and every other
  field stays optional. Each capability interface (`IAdtReadable`, `IAdtUpdatable`,
  `IAdtLockable`, `IAdtEnhancementHost` and the rest) names the key it requires. The
  interfaces-adt PR settles the exact parameter shape.
- **The source and the lock handle become required where a member needs them.** Today
  `IAdtOperationOptions` declares both as optional for every member. A member that sends a
  source or a lock handle, such as an update, an upload or an unlock, takes an options type
  that requires them. Every other member keeps the optional form.
- **The union-typed options** (`enhancementType`, `implementationType`, `bindingVariant`,
  the feature toggle's source) become required on the capabilities that send them.
- **The two `Partial` configs cast to full ones** (`AdtFeatureToggle.ts:283`,
  `AdtFunctionInclude.ts:314`) take the full config type where their member sends every
  field.
- **`AdtEnhancement.ts:158`** (`Map.get` cast to `EnhancementType`) reads the lock-time type
  from the map and checks it. If no type was recorded, the member's own identity supplies
  it, and that identity now requires it.

In adt-clients and adt-clients-legacy, each K2 cast is then deleted, because the field's type
is already `string`. The emitted JavaScript of those sites does not change.

**Consumer impact.** A caller that omits the name, or a source or lock handle a member needs,
now gets a compile error. Before, the request went to a URL holding `undefined`. A
JavaScript caller that omits the name sends the same request as before.

**Order.** interfaces-adt is released first, in its own versioning. adt-strategies,
adt-clients and adt-clients-legacy then raise their `@mcp-abap-adt/interfaces-adt` range to
that published version, which resolves from the npm registry. No `file:`, `link:` or
workspace link to interfaces-adt is used at any point, and after the install the lockfile is
checked: interfaces-adt must resolve from the registry and must not be `"link": true`.
Nothing in this repository builds against an unpublished interfaces-adt.

### D2 — K3: a reading throws on a missing required field (28 casts)

The trace readers in `results/traces.ts` read each field the result type requires with a
reader that throws when the field is absent, naming it (`trc:… is missing`). This is the form
the table-settings readers use (`results/tableSettings.ts`, `text` and `attribute`). What a
reading's throw becomes in `answering` is unchanged.

- Optional result fields keep their `?? undefined` reads, with no cast.
- Numbers (`numberOf`, `attrNum`) and the boolean (`booleanOf`) throw when absent or
  unreadable. They return their number or boolean typed, with no cast.

The answer changes only for a feed that lacks a required field. Every recorded feed carries
all of them (section 6).

### D3 — K4 and the abapGit K7 casts: the declared overloads (43 casts)

**The verdict `E` (37 casts).** Every member implementation of the form
`<E extends IAdtError = IAdtError>(…, options?: …<E>)` declares the two overloads its
interface declares:

- a generic one whose options require `analyse: IAnalyse<E>`;
- a plain one returning `IAdtResponse<T>`.

The implementation signature returns `IAdtResponse<T, IAdtError>`. That covers 703
signatures in 86 files, plus the shared helpers: `answering`, `answeringExchange`,
`answeringActivation`, `systemInfo`'s answer, `chain`, the abapGit facts exchange, and the
legacy refusals (`legacyRefusal`, `refusalLegacy.ts`, `AdtPackageLegacy`,
`AdtRequestLegacy`, the legacy runners). Each helper takes the same pair. With `analyse`
given, its `E` comes from `analyse`. Without it, the helper returns the library's
`IAdtError`. No cast is left. The emitted JavaScript does not change, because overloads are
erased. A caller that names `E` and passes no `analyse` gets a compile error.

**The other generic stand-ins (4 casts) go the same way.** There is no exception list:

- **`AdtBatchConnection.makeAdtRequest`** declares the contract's non-generic signature,
  `(options) => Promise<IAdtWireResponse>`. The `<T, D>` parameters go.
- **`AdtClientsWS.request`**: the `TResponse` that only the caller claimed goes. The caller
  passes a reader `(payload: unknown) => TResponse`, and the default reading is the payload
  as `unknown`. The reader sits on the same overload pair: `request(…)` answers `unknown`,
  and `request(…, { read })` answers `TResponse`.
- **`AdtAbapGitClient`'s slot lookup**: the results become a map typed per slot
  (`{ [K in AbapGitFactsSlot]?: IAbapGitFactsResultStrategy<FactsValue<T, K>, Facts<K>> }`),
  so the lookup is typed by its key.
- **`absentOnLegacy<T>`**: each legacy factory builds its refusing handler as a class that
  `extends` the modern handler and overrides every member with the refusal. This is the
  legacy package's own rule. The record-plus-cast goes.

**The abapGit args (2 casts).** The new form (`IAbapGitLinkNewArgs`,
`IAbapGitExternalRepoArgs`) and the old form (`IAbapGitLinkArgs`,
`IAbapGitExternalRepoCredentials`) reach separate private implementations. Each public
overload calls its own implementation directly, so the implementation signature is no
longer a union of the two.

## 5. The guard test

The checker is one plain module at the repository root, `tools/sourceRules.js` (CommonJS, no
dependency beyond the repository's own `typescript`). Each package's unit suite runs it in
`src/__tests__/unit/sourceRules.test.ts`, on that package's `tsconfig.json`. The test passes
when the checker reports `[]`, and on failure it lists every finding as `file:line rule`.
The checker runs no regex over source. It reads the AST and asks the type checker:

- **`cast`**: an `AsExpression` whose type node is not the type reference `const`; a
  `TypeAssertionExpression`; a `satisfies` is allowed.
- **`any`**: an `AnyKeyword` anywhere in a type position.
- **`any-flow`**: an expression the checker types `any` is refused, unless it is the
  initializer of a declaration annotated `unknown`, or an argument to a parameter typed
  `unknown`.
- **`hand-narrowed`**: a parameter declared `unknown`, of a function that is not exported,
  is refused when it has at least one call site and every call site passes an argument whose
  type is neither `unknown` nor `any`. An exported function with no call inside the package
  is part of the public surface and is left alone. This is the rule that finds the U sites.
- **`regex`**: a `RegularExpressionLiteral`; any reference to the identifier `RegExp`
  (called, constructed, aliased or read); and a call to `match`, `matchAll` or `search`
  on a receiver the checker types `string`, because each of these turns a string argument
  into a regex.

There is no exception list. A finding is fixed in the code.

**Proving it load-bearing.** The checker's own tests feed it in-memory sources: one per rule
and per form (an `as`, a `<T>` assertion, `as const` allowed, an `any` annotation, a
`JSON.parse` result bound to a typed variable, a `JSON.parse` result bound to `unknown`
allowed, a hand-narrowed parameter, a regex literal, `new RegExp`, `RegExp` aliased,
`'x'.match('y')`). Each forbidden form must yield exactly its rule and each allowed form
nothing. Then the plan breaks each rule in real `src` once, watches the suite go red, and
reverts. The existing `noRegexInDocumentPatches.test.ts` stays as it is: the new guard covers
it, and tests are out of scope unless touched for another reason.

## 6. Proving behaviour unchanged, per site

- **Type-only removals** (K1, K2 under D1, K4 and the K7 casts under D3, K6, and every
  cast that is only deleted):
  TypeScript erases them, so each package's emitted `dist/**/*.js` is compared before and
  after. Every file must be byte-identical except the files whose runtime code a K3, K5, A, R
  or K8 change touched, or a D3 restructuring (the WebSocket reader, `absentOnLegacy`, the
  abapGit split) touched. The plan lists those files, and each one gets the proof below.
- **K5 and A** (readers over thrown values and parsed documents): the existing unit tests,
  plus a table test per reader over the recorded answers. Every `refusal-*` recording in
  `packages/adt-clients/corpus/adt/answers/` feeds the exception readers (`adtErrors.ts`,
  `analyse.ts`, `read.ts`). Each reading is deep-equal to the one taken from the code
  before the change.
- **K3** (traces): the trace readers' results over every recording that holds
  `abaptraces` (6 files in the corpus) and the strategies' feed fixtures
  (`packages/adt-strategies/src/__tests__/fixtures/feeds/`) are deep-equal to the results
  before the change. Under D2, one more test per required field shows the reading throws
  when that field is absent.
- **R** (each regex site): the replaced function is tested against an oracle. The oracle is
  the old regex implementation, copied into the test, where regexes are allowed. The two are
  compared on SAP's recorded inputs and on edge cases: empty, absent, upper/lower case, CRLF
  and LF, a boundary-like line inside a body, a uri with `?`. These are the recorded inputs:
  - **run ids and `aunit:run` uris**: `unittest-run-passing` and
    `refusal-unittest-run-failing` (`corpus/adt/answers/`), where the bodies and the
    `location` headers are SAP's;
  - **activation run ids**: the `activation-*` recordings that carry a `/activation/runs/`
    location (5 files);
  - **`T100KEY-V` and longtext links**: the refusal recordings that carry them (15 and 20
    files);
  - **discovery hrefs**: `corpus/adt/discovery/`, one document per release;
  - **trace ids and times**: the `abaptraces` recordings above;
  - **the cloud host test**: a configuration value, not an answer, so the edge cases only.

  Where the oracle and the new code differ on a recorded input, the plan stops and reports
  it. Nothing is changed to match.
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
- **D1 and D3 type changes**: test-only `*.typecheck.ts` files use `@ts-expect-error` to
  show the new compile errors. One shows that an identity without its name is refused, and
  one shows that a generic call without `analyse` is refused. The emitted JavaScript
  comparison above covers both changes, since neither emits code.
- **D2**: one test per required trace field. The reading throws, naming the field, when
  that field is removed from a recorded feed.
- **Live**: the changed readers' members run once against on premise and ABAP Cloud
  through the existing integration suites. A patch runs live only the changed files' suites.

## 7. Release order

0. **`@mcp-abap-adt/interfaces-adt`**: its own PR in its own repository (D1), released in its
   own versioning and published first.
1. **`@mcp-abap-adt/adt-strategies`**: a patch (0.28.x). Its interfaces-adt range is raised
   to the published version. adt-clients depends on it as `^0.28.2` and adt-clients-legacy
   as `^0.28.0`. A 0.29.0 would fall outside both ranges and would in effect be a major, so
   it stays a patch.
2. **`@mcp-abap-adt/adt-clients`**: a minor (47.x), because D1 and D3 change what a caller
   can compile. Its interfaces-adt range is raised to the published version, and its
   strategies range to the published patch.
3. **`@mcp-abap-adt/adt-clients-legacy`**: a patch (0.11.x). Under a 0.x caret range a
   0.12.0 would in effect be a major. Its adt-clients range is raised to the published 47.x
   minor, and its interfaces-adt range to the published version.

Before each tag, every dependency range resolves on the registry, and the lockfile holds no
`"link": true` for interfaces-adt. The repository's own workspace siblings may stay linked
during development. After each publish, a clean install from the registry, outside the
repository, proves the package installs. Each package's `CHANGELOG.md`, README and docs
state the consumer impact of D1, D2 and D3 in the release that ships it. The release gate
is the root `npm run check`.

## 8. Not in this spec

- Test code, tooling outside production `src`, and comments, as the goal states.
- The plan's step order, and how the 703 overload pairs are written.
- The exact parameter shape of the interfaces-adt change, which its own PR settles.
