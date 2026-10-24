# Goal: the client a consumer receives is a contract

## Goal

`createAdtClient()` answers a contract, `IAdtClient`, instead of the concrete `AdtClient`
class. A consumer types its code against `IAdtClient`, can pass its own implementation
wherever the library's client is taken, and the compiler checks that `AdtClient` and
`AdtClientLegacy` each satisfy it.

`IAdtClient` names the whole surface a consumer reaches through the client:

- every factory (`getClass()`, `getProgram()`, … — 35 today), each in both its overloads:
  without a result set it answers the default composition, and with one it answers the same
  composition for the result set passed;
- the client-level members: `unlockAll()`, `pendingLocks` and `[Symbol.asyncDispose]()`.

Each object's composition stays defined once (today `IClassContract<R>` and its siblings in
`src/clients/AdtClient.ts`), and both the factory overloads and `IAdtClient` read that one
definition.

All of it is a contract, so all of it lives in `@mcp-abap-adt/interfaces-adt`: `IAdtClient`, every
composition, every result-set interface (`IClassResults` and its siblings, which are slots of
`IResultStrategy`), and each default result set as a type. adt-clients keeps only the values:
the default result sets (`classDocuments` and its siblings). Each is checked against its type
with `satisfies`, so the value and the contract cannot drift apart. This finishes the move of
the contracts out of the implementation that was left undone.

## Invariants

- **No behaviour changes.** Every member sends the requests it sends today and answers what
  it answers today. Only types move or are added.
- **The contract carries no logic.** What goes to `@mcp-abap-adt/interfaces-adt` is types only.
  No implementation, and no result-set value: the values stay in adt-clients.
- **The contract package never depends on adt-clients.** The dependency runs one way: adt-clients
  implements what interfaces-adt declares.
- **One definition per composition.** No composition is written twice, so two copies can never
  disagree.
- **The legacy client implements the same contract.** `AdtClientLegacy` answers refusals through
  the same compositions (decision 11). It is not a separate contract.
- **A consumer composes its own result sets through the contract** exactly as it does through
  the class today: same generics, same inference.
- **Dependencies come from the registry.** Each package depends on a published version: the
  contract package first, then adt-clients, then its consumers (mcp-abap-adt), in that order.
- **Breaking where the types break, nowhere else.** Answering a contract instead of the class
  is a major for adt-clients and for every consumer that typed against the class. The contract
  package takes a minor.
