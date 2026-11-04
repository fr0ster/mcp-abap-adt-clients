# Migrating to 43.0.0

43.0.0 stays on `@mcp-abap-adt/interfaces-adt` `^25.2.0` and
`@mcp-abap-adt/adt-strategies` `^0.18.0`. Four things change for a consumer:

- [A create invents no language](#a-create-invents-no-language)
- [The function-module validation takes a description](#the-function-module-validation-takes-a-description)
- [Class create takes no `abstract`, program create no program type](#class-create-takes-no-abstract-program-create-no-program-type)
- [A run id of `.` or `..` is refused](#a-run-id-of--or--is-refused)

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

## A run id of `.` or `..` is refused

The ABAP Unit run status and result requests percent-encode the run id, so an
id with `/`, `?`, `#` or `%` stays one path segment. A run id of exactly `.`
or `..` cannot: URL parsing resolves it as a path step. It is refused before
anything is sent, in fixed words (`An ABAP Unit run id of "…" is a path step,
not a run: nothing was sent.`). A run id SAP hands out is neither.
