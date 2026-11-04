# Migrating to 43.0.0

43.0.0 stays on `@mcp-abap-adt/interfaces-adt` `^25.2.0` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`. Five things change for a consumer,
and one is added:

- [A create invents no language](#a-create-invents-no-language)
- [The function-module validation takes a description](#the-function-module-validation-takes-a-description)
- [Class create takes no `abstract`, program create no program type](#class-create-takes-no-abstract-program-create-no-program-type)
- [A customizing request is a Customizing Request](#a-customizing-request-is-a-customizing-request)
- [A run id of `.` or `..` is refused](#a-run-id-of--or--is-refused)
- [Added: an object's outline](#added-an-objects-outline)

## A create invents no language

### What changed

SAP takes a new object's original language from the request's logon language
and ignores `adtcore:masterLanguage` in the create body (measured on ABAP
cloud, 2026-11-04: logon EN with a body in DE made an EN object, and
`sap-language: DE` on the create's POST alone made a DE one).

Since 43.0.0 every create resolves its language one way — the config's
`masterLanguage`, else the client's system context's, a blank value counting
as none — and, given one, writes `adtcore:language` and
`adtcore:masterLanguage` and sends the header `sap-language`, all that one
value. Given none, it writes neither attribute and sends no header; SAP uses
the logon language (measured on ABAP cloud: a class create with neither
attribute answered `200`, and the class read back in the logon language).
Before, a create with no language wrote `EN`.

### What to do

A caller that relied on `EN` without naming it names it:

```typescript
await client.getClass().create(
  { className: 'ZCL_X', packageName: 'ZPKG', description: 'd', masterLanguage: 'EN' },
  { headers },
);
// or once, for every create of the client:
const client = new AdtClient(connection, logger, { masterLanguage: 'EN' });
```

An on-premise system whose ICF node fixes the logon language answers in that
language whatever the request says.

## The function-module validation takes a description

`AdtFunctionModule.validate` requires `description`: the endpoint answers
`400` without one (measured). A call without one does not compile; pass the
description the module will be created with. The domain, data element,
authorization field and behaviour definition validations, whose configs keep
`description` optional, no longer send `description=undefined` — a value not
given is not sent.

## Class create takes no `abstract`, program create no program type

SAP ignores both on create (measured on premise, 2026-11-04): a class create
carrying `class:abstract="true"` answered `200` and left the class not
abstract, while `class:final` in the same body was taken; programs created
with `modulePool`, `subroutinePool`, `M` or `F` all read back
`executableProgram`, and one created with no program type read back the same.

`AdtClass.create` types `abstract?: never` and `AdtProgram.create` types
`programType?: never`, so passing either does not compile, and the program
create body carries no `program:programType`. Set them afterwards: a class is
abstract by its source's `ABSTRACT`; a program's type is the program's
attribute, changed after the create.

## A customizing request is a Customizing Request

### What changed

`AdtRequest.create` with `transportType: 'customizing'` sends `tm:type="W"`,
a Customizing Request. On 42.x it sent `tm:type="T"`, which is CTS's code for a
Transport of Copies (DD07T of domain TRFUNCTION, read on premise: `K` Workbench
Request, `W` Customizing Request, `T` Transport of Copies). SAP refused that
create without a real target — with target `LOCAL` it answered SCTS_ADT_MSG
009 (measured) — while `W` with `LOCAL` or an empty target answered `201`.
`workbench`, and no type, stay `K`.

### What to do

A caller asking for `customizing` needs nothing: it now gets the customizing
request it asked for. A caller that relied on `customizing` to get a Transport
of Copies loses that: no member of this library creates a Transport of Copies
any longer, and no dedicated path exists in its place. Such a request is
created in the Transport Organizer (SE01); a consumer that POSTs its own
document to `/sap/bc/adt/cts/transportrequests` with `tm:type="T"` must give a
real target (not measured here).

## A run id of `.` or `..` is refused

The ABAP Unit run status and result requests percent-encode the run id, so an
id with `/`, `?`, `#` or `%` stays one path segment. A run id of exactly `.`
or `..` cannot: URL parsing resolves it as a path step. It is refused before
anything is sent, in fixed words (`An ABAP Unit run id of "…" is a path step,
not a run: nothing was sent.`). A run id SAP hands out is neither.

## Added: an object's outline

`AdtUtils.getObjectOutline(objectType, objectName, options?)` is new: one GET
of `<object uri>/objectstructure` (Accept
`application/vnd.sap.adt.objectstructure.v2+xml`) for `CLAS/OC`, `INTF/OI`,
`PROG/P`, `PROG/I` and `FUGR/F` — the structure Eclipse's Outline view reads,
with each component's source positions for a class and an interface. It
answers the document as it came; `@mcp-abap-adt/adt-strategies` 0.19.0 reads
it into a tree with `readObjectOutline(xml)`, or `objectOutline` as a result
strategy.

`getObjectStructure` is unchanged and is something else: the repository's
object structure (`/sap/bc/adt/repository/objectstructure`, the project
explorer's view). Nothing that calls it needs to change.
