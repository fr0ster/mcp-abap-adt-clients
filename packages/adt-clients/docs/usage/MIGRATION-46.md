# Migrating to 46.0.0

46.0.0 is on `@mcp-abap-adt/interfaces-adt` `^30.0.0` and pairs with
`@mcp-abap-adt/adt-strategies` 0.25.0 and `@mcp-abap-adt/adt-clients-legacy`
0.11.0. It carries the table settings of 45.6.0 — tagged, never published —
and the text elements. Everything else is an addition.

- [Where-used of a program's or a function group's text elements names its container](#where-used-of-a-programs-or-a-function-groups-text-elements-names-its-container)
- [A class's text elements are not asked of](#a-classs-text-elements-are-not-asked-of)
- [A map over the client's codes or APIs adds the text elements](#a-map-over-the-clients-codes-or-apis-adds-the-text-elements)

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

`AdtClientOnPrem` and `AdtClientCloud` gain `getTextElements()`; the code
sets the client is typed by (interfaces-adt's `AdtTypeCode`, `AdtApiName`,
`AdtObjectKind` and their projections) gain `PROG/PX`, `CLAS/OCX`,
`textElements` and `text_elements`. A consumer's exhaustive map or `switch`
over any of them adds the members — interfaces-adt 30.0.0's README,
"Migrating to 30.0.0", lists every union.
