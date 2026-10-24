# Goal: a contract lives where it is accepted

## Goal

Every contract lives in the package that accepts it as a parameter. The consumer decides where
that contract's implementation comes from: the library's, or its own.

For the ADT client this means two things.

- **adt-clients accepts result sets.** `getClass(results)` and its 34 siblings take a result set,
  so the result-set contracts (`IClassResults` and its siblings, slots of `IResultStrategy`) are
  contracts. They move to `@mcp-abap-adt/interfaces-adt`, the package of the contracts adt-clients
  accepts, beside the atoms and the config types already there. A consumer passes the library's
  result sets (`classDocuments`, …) or its own. adt-clients keeps the values; they are
  implementations of the contracts.
- **The consumer accepts the client.** mcp-abap-adt takes a client and calls part of it, so it
  defines the client contract it needs. That contract is composed from the atoms
  (`IAdtCreatable`, `IAdtReadable`, `IAdtLockable`, …) and names only what the server calls. The
  server's code is typed against it, and the server decides where the implementation comes from:
  adt-clients' `createAdtClient()`, or its own. The compiler checks, at the consumer, that the
  implementation it takes satisfies its contract.

adt-clients declares no composition of its own. The named compositions in
`src/clients/AdtClient.ts` (`IClassContract<R>` and its 34 siblings) are removed, and each factory
answers its own class (`AdtClass<R>`, …). What a factory offers is the class's members, read by
the compiler wherever a consumer's contract asks for them.

## Invariants

- **No behaviour changes.** Every member sends the requests it sends today and answers what it
  answers today. Only types move, go or are added.
- **Contracts only in the contract package.** What moves to `@mcp-abap-adt/interfaces-adt` is
  contracts: no implementation, no result-set value and no type that mirrors one. A default
  result set and its shape stay with their value in adt-clients.
- **The dependency runs one way.** The contract package never depends on adt-clients, and
  adt-clients never depends on a consumer.
- **Nothing is written twice.** No composition is declared by the library beside the one a
  consumer composes for itself.
- **The legacy client stays a subclass** that answers refusals through the same members
  (decision 11). A consumer's contract is satisfied by it or by `AdtClient`, as the compiler
  checks.
- **A consumer composes its own result sets** exactly as it does today, with the same generics and
  the same inference.
- **Dependencies come from the registry**, in order: interfaces-adt is published first, then
  adt-clients, then mcp-abap-adt.
- **Breaking where the types break, nowhere else.** For adt-clients, removing the compositions and
  the local result-set contracts is a major. For mcp-abap-adt, typing against its own contract is
  a major. For interfaces-adt, adding the result-set contracts is a minor.
