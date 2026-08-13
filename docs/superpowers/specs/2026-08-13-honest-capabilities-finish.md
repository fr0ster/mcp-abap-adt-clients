# Finishing the honest capabilities

**Status:** design, for review.
**Date:** 2026-08-13

## Why this exists

Release 8.0.0 was called "honest capability types" and split the ADT contract into atoms so a
handler would declare what it can actually do. It did not finish. Measured across all 30
handler modules on 2026-08-13:

| | modules | stubbed methods |
|---|---|---|
| clean | 19 | — |
| version stubs only | 9 | `getVersions`, `getVersionSource` |
| `readTransport` stub | 4 | `readTransport` |
| deep cases | 4 | `transport` 9, `unitTest` 8, `messageClass` 5, `service` 4 |

**11 of 30 handlers declare a contract wider than they implement.** A caller reading the type
is told an operation exists; calling it throws. That is the defect 8.0.0 set out to remove.

The trigger for this spec was narrower — the maintainer asked for `IAdtDeletable` as its own
interface. It is needed, but the inventory shows it closes none of the eleven cases on its
own: only two handlers stub `delete`, and in one of them the stub is **wrong** rather than
honest.

## What is actually broken, by cluster

### 1. Versions — nine handlers, and the fix already exists

`dataElement`, `domain`, `functionGroup`, `messageClass`, `authorizationField`,
`featureToggle`, `package`, `transport`, `unitTest` all throw from `getVersions` and
`getVersionSource`.

`IAdtNonVersionedObject` exists in `IAdtComposites.ts` for exactly this and is the same as
`IAdtSourceObject` minus `IAdtVersionable`. This is not a design problem; it is a migration
that stopped halfway.

### 2. `readTransport` — four handlers

`messageClass`, `authorizationField`, `featureToggle`, `functionInclude` throw from it, while
`IAdtTransportAware` is part of both composites. Same shape as cluster 1: an atom exists, the
composite includes it unconditionally.

### 3. The four deep cases — four different diagnoses

**`transport` — a CRUD object with its hands tied, and two stubs that lie.**
Real: `validate`, `create`, `read`, `readMetadata`, `list`, `listNodes`.
Stubbed: `update`, `delete`, `activate`, `check`, `readTransport`, `lock`, `unlock`,
`getVersions`, `getVersionSource`.

Two of those stubs are **false**: ADT changes a request's description, and deletes an **empty**
request via `DELETE /cts/transportrequests/<NR>`. The stubs say "immutable after creation" and
"cannot be deleted via ADT". Compare `package`, which implements both against the same server.
**This is a code defect, not a typing one** — and it must be fixed before the type is narrowed,
or the narrowing will make the lie permanent.

**`unitTest` — not a CRUD object at all.**
Real: `validate`, `create`, `read`, `readMetadata`, `readTransport`, `run`, `getStatus`,
`getResult`. Stubbed: eight, including `update` and `delete`.
`create` means "start a run" and `read` means "read the result". Declaring it through
`IAdtCrud` promises seven methods that throw. It needs its own composite, not an atom removed.

**`messageClass`** — no activation, no check, no versions, no `readTransport`.
**`service`** — 25 real methods, stubs only on `lock`/`unlock` and versions.

## The shape of the fix

### Atoms

Split `IAdtModifiable` — today it is `update` **and** `delete` in one interface, so a handler
that can change an object but not remove it (or the reverse) cannot say so:

```ts
export interface IAdtUpdatable<TConfig, TReadResult = TConfig> {
  update(config: Partial<TConfig>, options?: IAdtOperationOptions): Promise<TReadResult>;
}

export interface IAdtDeletable<TConfig, TReadResult = TConfig> {
  delete(config: Partial<TConfig>): Promise<TReadResult>;
}

export interface IAdtModifiable<TConfig, TReadResult = TConfig>
  extends IAdtUpdatable<TConfig, TReadResult>,
    IAdtDeletable<TConfig, TReadResult> {}
```

`IAdtModifiable` **stays**, as the composite of the two. `IAdtCrud` is unchanged in shape, so
nothing that already implements everything notices. Only code naming `IAdtModifiable` where it
means one half is affected — and that is the point.

This mirrors what the package already does with `IAdtCrud`: keep the assembled name, add the
parts, prefer the part you actually mean.

### Composites

- Apply `IAdtNonVersionedObject` to the nine version-stubbing handlers.
- A composite without `IAdtTransportAware` for the four that stub `readTransport`. Name and
  membership to be settled in the plan, from what those four actually share.
- **`IAdtRunnable`** for `unitTest`: `validate`, `create`, `read`, `readMetadata`, `run`,
  `getStatus`, `getResult`, `readTransport`. No update, no delete, no activate, no lock, no
  versions.

### Code, before the types

`transport.update()` and `transport.delete()` are implementable and must be implemented first:
description change, and deletion of an empty request. Narrowing the type around a stub that
lies would carve the lie into the contract.

## What this is not

- **Not a rename.** Every existing name survives; atoms are added beneath them.
- **Not a behaviour change** anywhere except `transport`, where two operations start working.
- **Not `IAdtDeletable` alone.** Shipping only the atom would remove one stub of the eleven
  cases' many and leave the rest declaring what they cannot do.

## Order of work

1. **`transport.update` / `transport.delete`** — code, with tests. Independent of everything
   below and shippable on its own.
2. **Atoms** in `@mcp-abap-adt/interfaces`: `IAdtUpdatable`, `IAdtDeletable`,
   `IAdtModifiable` as their composite. Additive — a minor.
3. **Composites**: `IAdtRunnable`, and whatever the `readTransport` cluster needs. Additive.
4. **Publish interfaces**, then narrow the eleven handlers in adt-clients to the composite each
   one actually satisfies. **Breaking** for a consumer that named a wide type — a major.
5. Delete each stub as its handler stops declaring the method.

Steps 2 and 3 are one interfaces release. Step 4 is one adt-clients major.

## How this is verified

A stub is a method whose body throws "not supported" or calls `throwUnsupportedVersions`. The
inventory above came from parsing every `src/core/*/Adt*.ts`, and the same script is the check:
**after step 5, no handler may declare a method it stubs.** That is a test, not a review note —
it can be written as a unit test that walks the handlers and fails on any stub whose name is
still in the declared contract.

Without that test this regresses the moment a new object type is added by copying an existing
one, which is how the current eleven arose.

## Open questions

1. **`service`** stubs `lock`/`unlock`. Is that ADT's truth or an unimplemented feature? If the
   latter, it belongs with `transport` in step 1, not in a narrowed composite.
2. **`messageClass`** stubs `activate` and `check`. Same question.
3. Does the `readTransport` cluster share anything else, or does each need its own composite?
   Four handlers is enough to justify a name only if they are actually alike.

## Related

- 8.0.0 — the release that introduced the atoms and stopped short
- `IAdtCapabilities.ts`, `IAdtComposites.ts` — where the atoms and the two composites live
