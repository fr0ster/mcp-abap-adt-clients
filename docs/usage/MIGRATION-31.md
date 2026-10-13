# Migrating to 31.0.0

31.0.0 moves the contract packages a major: `@mcp-abap-adt/interfaces-adt`
`^16.0.0` and `@mcp-abap-adt/interfaces-adt-connection` `^3.0.0`. Their types
are this package's public API, which is why this is a major too. No member
answers differently.

## 1. Declare the new ranges

If your package imports the contracts, declare the same ranges, so npm installs
one copy of each — `npm ls @mcp-abap-adt/interfaces-adt` and
`npm ls @mcp-abap-adt/interfaces-adt-connection` must each show one version.
`@mcp-abap-adt/adt-strategies` 0.11.0 declares the same ranges.

```json
"@mcp-abap-adt/interfaces-adt": "^16.0.0",
"@mcp-abap-adt/interfaces-adt-connection": "^3.0.0"
```

## 2. What the contracts removed

`interfaces-adt` 16.0.0 removes `IAdtClientOptions.signal` and
`IAdtError.refusal`; `interfaces-adt-connection` 3.0.0 removes
`IAbapRequestOptions.signal`, `ADT_REQUEST_ERROR` and `AdtRequestErrorCode`. All
of them arrived in 15.4.0 / 2.1.0, which 30.x did not declare — so code written
for 30.x compiles unchanged. Code that took them up drops them: no `signal` in
client or request options, no read of `refusal`, no match on
`ADT_REQUEST_ERROR`. An `IAbapConnection` implementation of your own drops the
same.

## 3. The connection you build (if it is `@mcp-abap-adt/connection` 16)

Not this package's contract, but what a consumer moving with it meets: one
connection instance is one SAP session. `connect()` after `disconnect()` — or
after a lost session — rejects, and a second `disconnect()` rejects
`NOT_CONNECTED`; a new session is a new instance, built with the constructors
or `createConnection({ system, transport, … })`. Anything built over the old
instance (an `AdtClient`, a handler) is built again over the new one.
