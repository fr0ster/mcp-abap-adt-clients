# Goal: the client a consumer receives is a contract

## Goal

`createAdtClient()` answers a contract, `IAdtClient`, instead of the concrete `AdtClient`
class. A consumer types its code against `IAdtClient`, can pass its own implementation
wherever the library's client is taken, and the compiler checks that `AdtClient` and
`AdtClientLegacy` each satisfy it.

`IAdtClient` names the whole surface a consumer reaches through the client:

- every factory (`getClass()`, `getProgram()`, … — 35 today), each declared once: one generic
  signature whose result set is optional, so a call without one answers over the result-set
  contract and a call with one answers over the set passed;
- the client-level members: `unlockAll()`, `pendingLocks` and `[Symbol.asyncDispose]()`.

What a factory answers is written in `IAdtClient` itself, as the atoms it offers
(`IAdtCreatable`, `IAdtReadable`, `IAdtLockable`, …). There is no named composition per object,
in interfaces-adt or in adt-clients: a consumer that wants a name for what it holds composes it
from the atoms itself. The compositions declared in `src/clients/AdtClient.ts` today
(`IClassContract<R>` and its siblings) are removed, and `AdtClient` takes its factories' types
from `IAdtClient`, so what a factory answers is defined in one place.

Only contracts move to `@mcp-abap-adt/interfaces-adt`: `IAdtClient` and every result-set contract
(`IClassResults` and its siblings, which are slots of `IResultStrategy`). Nothing concrete moves:
the default result sets (`classDocuments` and its siblings) and the types they carry stay in
adt-clients. This finishes the move of the contracts out of the implementation that was left
undone.

## Invariants

- **No behaviour changes.** Every member sends the requests it sends today and answers what
  it answers today. Only types move or are added.
- **Contracts only, no concrete types.** What goes to `@mcp-abap-adt/interfaces-adt` is contracts:
  no implementation, no result-set value and no type that mirrors one (a default result set's
  shape stays with its value in adt-clients).
- **The contract package never depends on adt-clients.** The dependency runs one way: adt-clients
  implements what interfaces-adt declares.
- **What a factory answers is written once**, in `IAdtClient`. There is no second copy, in a
  named composition or in the class, that could disagree.
- **The legacy client implements the same contract.** `AdtClientLegacy` answers refusals through
  the same `IAdtClient` (decision 11). It is not a separate contract.
- **A consumer composes its own result sets through the contract** exactly as it does through
  the class today: same generics, same inference. Through `IAdtClient` without a result set, a
  consumer gets the contract's slots as `unknown`; to get a typed answer it passes a result set,
  which is the consumer's choice anyway.
- **Dependencies come from the registry.** Each package depends on a published version: the
  contract package first, then adt-clients, then its consumers (mcp-abap-adt), in that order.
- **Breaking where the types break, nowhere else.** Answering a contract instead of the class
  is a major for adt-clients and for every consumer that typed against the class. The contract
  package takes a minor.
