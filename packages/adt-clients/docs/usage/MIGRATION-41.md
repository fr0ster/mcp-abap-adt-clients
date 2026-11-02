# Migrating to 41.0.0

41.0.0 stays on `@mcp-abap-adt/interfaces-adt` `^25.0.2` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`, as 40.1.0. One thing changes for a consumer:

- [A handler class is typed by the values its slots answer](#a-handler-class-is-typed-by-the-values-its-slots-answer):
  `AdtClass<T>`, `AdtAtc<T>`, `ClassExecutor<T, V>` and every other handler
  class take the values their result slots answer, not the result strategies.

**No request, header, URL or answer changes.** A call that compiled on 40.x —
`client.getClass()`, `client.getClass(results)`, `runtime.getAtc(results)`,
`AdtAbapGitClient.create(connection, { results })`,
`new AdtClass(connection, { results })` — compiles on 41.0.0 and answers the
same types. Only code that **names** a class's type parameter changes.

## A handler class is typed by the values its slots answer

### What changed

Until 40.x every handler class was generic over its result-strategy set,
`R extends IXResults = typeof xDocuments`, and each member answered
`ReturnType<R['slot']>`. The compiler cannot prove that `R['slot']`, for a
generic `R`, is an `IResultStrategy<ReturnType<R['slot']>>`, so every member
read its slot through a cast.

Since 41.0.0 each class is generic over the **values** its slots answer,
`T extends XValues = ResultValuesOf<typeof xDocuments>`, holds its strategies
as `ResultStrategiesOf<T>`, and each member answers `T['slot']`. A slot read
is `IResultStrategy<T['slot']>` by construction, and the casts are gone.

What the getters answer is the same type as before, written another way:

| Call | 40.x | 41.0.0 |
|---|---|---|
| `client.getClass()` | `AdtClass<typeof classDocuments, V>` | `AdtClass<ResultValuesOf<typeof classDocuments>, V>` |
| `client.getClass(results)` | `AdtClass<typeof results, V>` | `AdtClass<ResultValuesOf<typeof results>, V>` |
| `runtime.getAtc(results)` | `AdtAtc<typeof results>` | `AdtAtc<ResultValuesOf<typeof results>>` |
| `AdtAbapGitClient.create(connection)` | `AdtAbapGitClient<typeof abapGitDocuments>` | `AdtAbapGitClient<ResultValuesOf<typeof abapGitDocuments>>` |

and `read()`, `create()`, … answer what they answered: `T['source']` is the
type `ReturnType<R['source']>` was.

New exports, from the package root:

- `ResultValuesOf<R>` — the values a result set answers, slot by slot
  (`{ [K in keyof R]: R[K] extends IResultStrategy<infer X> ? X : never }`);
- `ResultStrategiesOf<T>` — the strategies that answer the values `T`
  (`{ [K in keyof T]: IResultStrategy<T[K]> }`);
- one `<X>Values` per result-set contract, the bound of its class's `T`:
  `ClassValues`, `ProgramValues`, `IncludeValues`, `DomainValues`, …,
  `AtcValues`, `ProfilerValues`, `AbapDebuggerValues`, `AbapGitValues`,
  `AbapUnitRunnerValues` (every ABAP Unit runner), `ClassExecutorValues`,
  `ProgramExecutorValues`, `TraceSchedulingValues`. Each is
  `{ readonly [K in keyof IXResults]: unknown }`, except `ProfilerValues`,
  which is `ResultValuesOf<IProfilerResults>` because that contract fixes
  `deletion` to `void`.

`IProfilerViews<T>` takes the profiler's values too. `AbapDebuggerConstructorOptions<R>`
and the getters' and `create`'s own type parameter `R` still name the
strategies — that is what a caller passes.

### Migrating

- **A type that names a class** wraps the strategies it named in
  `ResultValuesOf<…>`:

  ```typescript
  import {
    type AdtAtc,
    type AdtClass,
    type classDocuments,
    type ResultValuesOf,
  } from '@mcp-abap-adt/adt-clients';

  // 40.x: let cls: AdtClass<typeof classDocuments>;
  let cls: AdtClass<ResultValuesOf<typeof classDocuments>>;

  // 40.x: function run(atc: AdtAtc<typeof reading>) { … }
  function run(atc: AdtAtc<ResultValuesOf<typeof reading>>) {
    // …
  }
  ```

  Code that lets the compiler infer the type (`const cls = client.getClass()`)
  changes nothing.

- **A subclass** takes the values and passes them on:

  ```typescript
  import {
    AdtClass,
    type ClassValues,
    type classDocuments,
    type ResultValuesOf,
  } from '@mcp-abap-adt/adt-clients';

  // 40.x: class MyClass<R extends IClassResults = typeof classDocuments>
  //         extends AdtClass<R> { … }
  class MyClass<
    T extends ClassValues = ResultValuesOf<typeof classDocuments>,
  > extends AdtClass<T> {
    // `this.results` is `ResultStrategiesOf<T>`: `this.results.source` is an
    // `IResultStrategy<T['source']>`, no cast; a member answers `T['source']`.
  }
  ```

  A member that answered `ReturnType<R['slot']>` answers `T['slot']`.

- **A constructor called directly** infers `T` from its `results`:
  `new AdtClass(connection, { results })` answers
  `AdtClass<ResultValuesOf<typeof results>>`. Every property of those results
  must now be a strategy — a set with an extra non-function field (a marker,
  say) is refused by the constructor, while a getter still takes it and types
  the extra slot `never`.
