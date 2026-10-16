# Migrating to 34.0.0

34.0.0 changes no type and no dependency range. It changes what a batch does
with a `406` or `415`.

## A batch corrects and resends nothing

Until 33.x, a member recorded through `AdtBatchConnection` kept accept
negotiation: a part SAP answered `406` (its `Accept` not served) or `415` (its
`Content-Type` not accepted) was corrected from the supported types SAP named
and recorded again, and `execute()` sent it in a follow-up envelope. The call
resolved with the corrected request's answer, and SAP's `406`/`415` was gone.

Now a batch connection is exempt from accept negotiation:

- a part's `406` or `415` is that call's answer, a failure carrying SAP's
  response, like any other status;
- an `AdtClient` built over a batch connection does not wrap it, whatever
  `enableAcceptCorrection` it is given, and a member that negotiates by itself
  sends through it once;
- a `406`/`415` answered to the envelope itself, on a connection an `AdtClient`
  wrapped with correction on, reaches `execute()` and the envelope's parts as it
  came; the envelope is not sent again.

A batch is yours: read each answer and decide what to send again, in a batch of
your own. The supported types are in the failure's `response` (headers and
body), where accept negotiation used to read them.

The connection's own handling of the envelope request — credential renewal,
CSRF recovery, session — is unchanged.

Outside a batch nothing changes: accept negotiation works as before.
