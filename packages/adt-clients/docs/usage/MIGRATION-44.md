# Migrating to 44.0.0

44.0.0 moves to `@mcp-abap-adt/interfaces-adt-connection` `^4.0.0`, where
`IAbapConnection.getBaseUrl()` answers `Promise<string | undefined>`: an RFC
connection has no HTTP origin and answers `undefined`. It pairs with
`@mcp-abap-adt/adt-strategies` 0.21.0 and `@mcp-abap-adt/adt-clients-legacy`
0.8.0, which declare the same range. No request changes.

- [`getBaseUrl()` may answer `undefined`](#getbaseurl-may-answer-undefined)
- [The test configuration over RFC states its address](#the-test-configuration-over-rfc-states-its-address)

## `getBaseUrl()` may answer `undefined`

### What changed

`AdtBatchConnection.getBaseUrl()` answers `Promise<string | undefined>` and
hands on what the wrapped connection answers, `undefined` included.
`isCloudEnvironment(connection)` already skipped a missing URL: with
`undefined` it asks `systeminformation`, as it did for an empty one.

### What to do

A caller that reads `getBaseUrl()` from this package's types narrows before it
uses the answer:

```typescript
const origin = await batch.getBaseUrl();
if (origin !== undefined) {
  // an HTTP connection: its origin
}
```

Install `@mcp-abap-adt/interfaces-adt-connection@^4.0.0` beside this package
(and `@mcp-abap-adt/connection` 20 for a concrete connection), so one copy of
the contract is installed. A connection of your own that answers a string
still conforms.

## The test configuration over RFC states its address

This concerns a run of this repository's tests, not the library.

### What changed

The test helpers take `@mcp-abap-adt/connection` 20, where an RFC config has
no URL. With `environment.connection_type: "rfc"`, the session file names the
address and no `SAP_URL`:

```env
SAP_ASHOST=saphost      # the host your SAP_URL named
SAP_SYSNR=00            # the two digits of its 80NN port
SAP_CLIENT=100
SAP_LANGUAGE=EN
```

— or a message server: `SAP_MSHOST` with `SAP_MSSERV` and/or `SAP_SYSID` and
`SAP_GROUP`. `SAP_SAPROUTER` is taken when stated. Nothing is derived from a URL
and nothing is defaulted.

### What to do

Remove `SAP_URL` from an RFC session file and add `SAP_ASHOST`, `SAP_SYSNR`,
`SAP_CLIENT` and `SAP_LANGUAGE` (`000` and `EN` were the old defaults). The
helper refuses, naming the keys, an RFC file that states `SAP_URL`, two
addresses, none, an incomplete one, or no client or language; an HTTP file
that states an RFC address key; and ABAP Cloud over RFC. See
[RFC_TESTING.md](../development/RFC_TESTING.md).
