# Migrating to 35.0.0

35.0.0 changes no type and no dependency range. It changes one default.

## Accept negotiation is off unless switched on

Until 34.x, a request SAP answered `406` (its `Accept` not served) or `415`
(its `Content-Type` not accepted) was corrected from the types SAP named and
sent once more, unless you turned that off. Now nothing is corrected or sent
again unless you turn it on: the `406`/`415` is the call's answer, like any
other status.

- `getAcceptCorrectionEnabled(connection)` is `false` without an explicit
  switch.
- `ADT_ACCEPT_CORRECTION=true` turns it on. Only the exact value `true` does;
  unset, `false` or anything else leaves it off.
- The `enableAcceptCorrection` option and `setAcceptCorrectionEnabled` are
  unchanged.

What to do if you relied on the default:

1. Switch it on: `new AdtClient(connection, logger, { enableAcceptCorrection:
   true })` (the same option on `AdtRuntimeClient`), or set
   `ADT_ACCEPT_CORRECTION=true`; or
2. Correct the request yourself. `extractSupportedAccept(error)` returns the
   media types a `406` names; `rememberAccept(connection, request, accept)`
   stores the one you choose in the connection's accept cache;
   `cachedAccept(connection, request)` reads it back. All three are exported
   from the package root; the last two read and write the cache negotiation
   itself uses, so a correction made either way serves both.

`cachedAccept` is a plain read of the cache and no longer depends on the switch.
A batch connection stays exempt from negotiation.
