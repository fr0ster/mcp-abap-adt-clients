# Goal: the client a consumer receives is a contract

## Goal

`createAdtClient()` answers a contract, `IAdtClient`, instead of the concrete `AdtClient`
class. A consumer types its code against `IAdtClient`, can pass its own implementation
wherever the library's client is taken, and the compiler checks that `AdtClient` and
`AdtClientLegacy` each satisfy it.

`IAdtClient` names the whole surface a consumer reaches through the client:

- every factory (`getClass()`, `getProgram()`, … — 35 today), each in both its overloads:
  without a result set it answers the composition over the result-set contract, and with one it
  answers the same composition for the result set passed;
- the client-level members: `unlockAll()`, `pendingLocks` and `[Symbol.asyncDispose]()`.

Each object's composition stays defined once (today `IClassContract<R>` and its siblings in
`src/clients/AdtClient.ts`), and both the factory overloads and `IAdtClient` read that one
definition.

Only contracts move to `@mcp-abap-adt/interfaces-adt`: `IAdtClient`, every composition, and every
result-set contract (`IClassResults` and its siblings, which are slots of `IResultStrategy`).
Nothing concrete moves: the default result sets (`classDocuments` and its siblings) and the
types they carry stay in adt-clients. So in `IAdtClient` the overload without a result set
answers the composition over the result-set contract (`getClass(): IClassContract<IClassResults>`),
and `AdtClient` keeps answering the narrower composition over its own defaults, which the compiler
checks is assignable to the contract. This finishes the move of the contracts out of the
implementation that was left undone.

## Invariants

- **No behaviour changes.** Every member sends the requests it sends today and answers what
  it answers today. Only types move or are added.
- **Contracts only, no concrete types.** What goes to `@mcp-abap-adt/interfaces-adt` is contracts:
  no implementation, no result-set value and no type that mirrors one (a default result set's
  shape stays with its value in adt-clients).
- **The contract package never depends on adt-clients.** The dependency runs one way: adt-clients
  implements what interfaces-adt declares.
- **One definition per composition.** No composition is written twice, so two copies can never
  disagree.
- **The legacy client implements the same contract.** `AdtClientLegacy` answers refusals through
  the same compositions (decision 11). It is not a separate contract.
- **A consumer composes its own result sets through the contract** exactly as it does through
  the class today: same generics, same inference. Through `IAdtClient` without a result set, a
  consumer gets the contract's slots as `unknown`; to get a typed answer it passes a result set,
  which is the consumer's choice anyway.
- **Dependencies come from the registry.** Each package depends on a published version: the
  contract package first, then adt-clients, then its consumers (mcp-abap-adt), in that order.
- **Breaking where the types break, nowhere else.** Answering a contract instead of the class
  is a major for adt-clients and for every consumer that typed against the class. The contract
  package takes a minor.
