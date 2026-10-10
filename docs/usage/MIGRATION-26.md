# Migrating to 26.0.0

26.0.0 adds the ABAP and AMDP debuggers and memory snapshots. What can break a
consumer on 25.x is the contract packages it now builds against.

## 1. `@mcp-abap-adt/interfaces-adt` 13 and `interfaces-adt-connection` 2

adt-clients depends on `@mcp-abap-adt/interfaces-adt` `^13.1.0` and
`@mcp-abap-adt/interfaces-adt-connection` `^2.0.0`. If your package imports
either, declare the same ranges, so npm installs one copy of each:

```
npm ls @mcp-abap-adt/interfaces-adt @mcp-abap-adt/interfaces-adt-connection
```

must show one version of each. What changed is in
`interfaces-adt-connection` 2.0.0: `IAdtWireResponse` defaults its type
parameters to `unknown`, not `any`. Two things stop compiling:

- **Reading fields off an untyped answer's `data`.** Narrow it first —
  `typeof answer.data === 'string'` for an ADT document — or name the type where
  it is stored (`IAdtWireResponse<string>`).
- **A stub of `makeAdtRequest` returning a fixed shape.** Declare it generic:

  ```typescript
  makeAdtRequest: async <T = unknown, D = unknown>(
    request: { url: string },
  ): Promise<IAdtWireResponse<T, D>> =>
    ({ status: 200, statusText: 'OK', headers: {}, data: body }) as IAdtWireResponse<T, D>,
  ```

In this package the move cost eight such edits, exactly the ones that note
predicts.

## 2. `@mcp-abap-adt/adt-strategies` 0.8.0

If you use the strategies, take 0.8.0: it declares the same contract ranges,
and adds `analyseDebuggeeEnd`.

## Nothing else

No member of 25.x changed or left. The debugger classes are new; see
[Debugging](CLIENT_API_REFERENCE.md#debugging).
