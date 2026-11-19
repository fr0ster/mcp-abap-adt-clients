# Migrating to 46.0.0

46.0.0 is on `@mcp-abap-adt/interfaces-adt` `^30.0.0` and pairs with
`@mcp-abap-adt/adt-strategies` 0.25.0 and `@mcp-abap-adt/adt-clients-legacy`
0.11.0. It carries the table settings of 45.6.0 — tagged, never published —
and the text elements. Everything else is an addition.

- [Where-used of a program's or a function group's text elements names its container](#where-used-of-a-programs-or-a-function-groups-text-elements-names-its-container)
- [A class's text elements are not asked of](#a-classs-text-elements-are-not-asked-of)
- [A map over the client's codes or APIs adds the text elements](#a-map-over-the-clients-codes-or-apis-adds-the-text-elements)
- [The where-used parameters are type aliases, their code and container readonly](#the-where-used-parameters-are-type-aliases-their-code-and-container-readonly)

Each case below compiled against adt-clients 45.5.5 (interfaces-adt 27.4.0,
from the registry) and fails against 46.0.0 with the error named; each
remedy compiles against 46.0.0.

## Where-used of a program's or a function group's text elements names its container

### What changed

interfaces-adt 30.0.0 adds `PROG/PX` — a program's text elements, and a
function group's — to the codes `getUtils().getWhereUsed` and
`getWhereUsedScope` take, and requires `container: 'program' |
'functionGroup'` with it: the two are one code at two addresses
(`/sap/bc/adt/textelements/programs/{name}`,
`…/functiongroups/{name}`). Every other code refuses a `container`.

A call whose `object_type` is a variable of the whole where-used union no
longer compiles (`TS2345`), because the code may be `PROG/PX`:

```typescript
// 45.x: compiled
async function whereUsed(code: AdtWhereUsedCode<AdtModernVariant>) {
  return utils.getWhereUsed({ object_name: name, object_type: code }, { headers });
}
```

### What to do

Exclude `PROG/PX` from the input, or handle it apart with its container:

```typescript
async function whereUsed(
  code: Exclude<AdtWhereUsedCode<AdtModernVariant>, 'PROG/PX'>,
) {
  return utils.getWhereUsed({ object_name: name, object_type: code }, { headers });
}

await utils.getWhereUsed(
  { object_name: 'SEUF', object_type: 'PROG/PX', container: 'functionGroup' },
  { headers },
);
```

`examples/where-used.ts` takes the first form.

## A class's text elements are not asked of

`CLAS/OCX` is in none of the where-used codes: the on-premise and cloud
systems measured answer "Where-Used List is not supported for Text Element:
Class." A caller never passed it before — it was no code of 29.0.0 — so
nothing that compiled stops on it.

## A map over the client's codes or APIs adds the text elements

`AdtClientOnPrem` and `AdtClientCloud` gain `getTableSettings()` and
`getTextElements()`; the code sets the client is typed by (interfaces-adt's
`AdtTypeCode`, `AdtApiName`, `AdtObjectKind` and their projections) gain
`TABL/DTT` and `tableSettings` (28.0.0), and `PROG/PX`, `CLAS/OCX`,
`textElements` and `text_elements` (30.0.0). A consumer on 45.5.5 skipped
the unpublished 45.6.0, so it meets both at once:

```typescript
// 45.5.5: compiled with its 29 codes. 46.0.0: TS2739, missing
// "TABL/DTT", "PROG/PX", "CLAS/OCX".
const kinds: Record<AdtTypeCode, string> = { 'CLAS/OC': 'class', /* … */ };
```

Add the three codes. Any other exhaustive map or `switch` over these unions
adds the members — interfaces-adt's README, "Migrating to 28.0.0" and
"Migrating to 30.0.0", list every union.

## The where-used parameters are type aliases, their code and container readonly

interfaces-adt 30.0.0 makes `IGetWhereUsedParams` and
`IGetWhereUsedScopeParams` type aliases (an object joined with "`PROG/PX` and
its container, or another code without one"), constrains their code to every
code but `CLAS/OCX`, and makes `object_type` and `container` readonly.

| 45.5.5 code | 46.0.0 | what to do |
|---|---|---|
| `interface X extends IGetWhereUsedParams { … }` (or the scope params) | `TS2312` | `type X = IGetWhereUsedParams & { … }` |
| `params.object_type = 'CLAS/OC'` | `TS2540` (readonly) | build a new value: `{ object_name: params.object_name, object_type: 'CLAS/OC' }` |
| `IGetWhereUsedParams<AdtTypeCode>` (or the scope params) | `TS2344` | drop the argument (the default is every code where-used is asked of), or `IGetWhereUsedParams<Exclude<AdtTypeCode, 'CLAS/OCX'>>` |
