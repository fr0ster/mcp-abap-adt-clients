# Goal: no casts and no regular expressions in production code

## Goal

The production code of adt-strategies, adt-clients and adt-clients-legacy follows the
owner's two base rules: what static typing can verify is verified statically, and no
regular expression runs in it. A value the compiler can type is typed by its contract, not
cast or held as `unknown` and narrowed by hand; a value from outside the type system — SAP's
answers, parsed XML or JSON, files — is checked at run time, by typed code. Text and XML are
read with plain linear string code, a scanner, or the platform's or the XML parser, never a
regular expression: over SAP's input a regex costs more than it solves, in correctness and in
the review it needs. A guard test keeps both rules true from then on, so code that breaks
them cannot be merged again.

Where a cast hid a contract that promised less than the code needs, the contract is made
true instead. In `@mcp-abap-adt/interfaces-adt`, `AdtObjectIdentity` requires the object's
own name, and also the source and the lock handle where a member needs them. The classes
declare the two overloads their interfaces declare, so a caller who names the error type
`E` also passes `analyse`. A reading of SAP's answer that lacks a field its result type
requires throws, as the table-settings readings already do. Where the library answers with
its own error (no answer came back, a chain step, a legacy refusal), the type says so:
`E | IAdtError`. The last generic stand-ins go: the batch connection's `<T, D>` and the
WebSocket client's caller-chosen response type. The abapGit forms deprecated since 46.2.0
also go, and the legacy package's absent handlers become refusing subclasses. And every
member sends one request: one endpoint, one method. A write needs the caller's lock handle
and never locks or unlocks for itself, and a message class message's lock chain becomes the
caller's to compose. Nothing else changes for consumers.

## Invariants

- **Static typing first.** No `as` cast in production `src` (`as const` excepted), no
  `any`, and no `unknown` narrowed by hand where a contract types the value. A runtime check
  remains only where the compiler cannot see the value: data from outside the type system,
  such as network answers, parsed XML or JSON, and files. A user-defined type predicate is
  allowed only in a reader of such data. Anywhere else it counts as a cast. There is no
  exception list.
- **One endpoint, one method.** A member sends one request. It never locks, unlocks or
  chains another endpoint for itself; lock, write and unlock are separate members, and the
  caller composes them. A write that sends a lock handle requires it.
- **No regular expressions in production code.** No regex literal, no `RegExp`, and no API
  called with one, in production `src`. Linear string code, a scanner, or the platform or
  XML parser does the work instead.
- **A guard test holds both rules.** It runs in every package's unit suite and fails on any
  cast, `any`, hand-narrowed contract value or regular expression in production `src`. It
  is shown to be load-bearing: reintroducing each forbidden form turns it red. The guard and
  the inventory share one definition of the forbidden forms.
- **Every public API and every answer stays the same, except for D1–D3, C1–C5 and C7.**
  Exports, the requests sent, and the results, errors and refusals returned stay as they
  are. The consumer sees only these changes:
  - A caller that omits an object's name, or a source or lock handle a member needs, now
    gets a compile error. This holds on the classes of both adt-clients and
    adt-clients-legacy, whose members take the interfaces' identity types instead of
    `Partial` configs.
  - A caller that names `E` on a class member without passing `analyse` now gets a compile
    error.
  - A reading of an SAP answer that lacks a field its result type requires now throws.
    Before, it returned `undefined` under a type that said otherwise.
  - **C1**: `AdtBatchConnection.makeAdtRequest` has no `<T, D>`. It answers
    `IAdtWireResponse`, as `IAbapConnection` declares.
  - **C2**: `AdtClientsWS.request` answers a typed `TResponse` only through a reader
    `(payload: unknown) => TResponse` that the caller passes. Without a reader it answers
    `unknown`.
  - **C3**: a member's generic answer is typed `E | IAdtError` (in interfaces-adt) on the
    paths where the library answers with its own error. `analyse` is called exactly where it
    is called today: before the fallback on the no-answer path, and not at all on a legacy
    refusal.
  - **C4**: the abapGit `link` and `checkExternalRepo` forms deprecated since 46.2.0 are
    removed.
  - **C5**: a legacy handler for a type that 7.40 does not serve is a subclass of the modern
    handler that overrides every member with the refusal. It is now `instanceof` that class.
  - **C7**: every write that sends a lock handle requires it, and a call without one is a
    compile error. The two writes that take no lock (a service binding's publication, a
    transport request's document) refuse one. A message class message's `create`,
    `update` and `delete`, which locked and unlocked for themselves, become `lockMessage`,
    `lockClassForMessage`, `update` and `unlockMessages`, each one request. The caller
    composes them with the class's `lock`, `read` and `unlock`, keeping the locks on the
    stateful session and the write stateless.
  - A migration note in each breaking package says what a caller on the old contract must
    do for each of these changes, the C7 recipe included.
- **Behaviour is proved unchanged, in the way the change allows.**
  - A **type-only** change (a cast deleted, an annotation, an overload) leaves the emitted
    JavaScript byte-identical, and the build output before and after shows it.
  - A **runtime** change (a regex replaced by string code, a reader replacing a cast)
    behaves the same as the code it replaces on every input that code accepted. Unit tests
    show this against the old code as an oracle, on SAP's recorded answers wherever the
    site reads them.
- **interfaces-adt first, from the registry.** The interfaces-adt change is its own PR in
  its own repository, released in its own versioning and published first. The packages
  here then depend on that published version from the npm registry only, never through a
  local link.
- **Releases.** These go out in the repository's publish order, after interfaces-adt:
  - **adt-clients and adt-clients-legacy** ship as breaking releases (majors).
  - **adt-strategies** breaks too, so it is not a patch. Its trace readings are public
    exports, and D2 makes them throw where they returned an object. Its interfaces-adt range
    also crosses that package's breaking release. It ships as a breaking 0.x release.
  - **interfaces-adt** follows its own versioning.
  - **mcp-abap-adt** takes the new majors deliberately, in its own work.

## Out of scope

- Test code, unless a test file is touched for another reason.
- Tooling and scripts outside the packages' production `src`, except the guard's own
  tooling, which is in scope.
- Any change of behaviour, API or answer other than D1–D3 and those the owner approves by
  name, and any new feature.
- Other repositories than interfaces-adt, and a backport to an earlier major.
