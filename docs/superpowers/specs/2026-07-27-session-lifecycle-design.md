# Session lifecycle: owned connect/disconnect and observable session identity

Design for `fr0ster/mcp-abap-connection#15`, spanning `@mcp-abap-adt/interfaces`,
`@mcp-abap-adt/connection` and `@mcp-abap-adt/adt-clients`.

## Problem

The connector has no owned session lifecycle. Three facts, all verified against
`@mcp-abap-adt/connection` 1.10.x with a local HTTP stub (no SAP involved):

1. `connect()` is optional. A request on a never-connected connector opens a
   session on the fly, so "connected" is not a state the caller controls.
2. There is no `disconnect()` on the HTTP connections (only RFC has `close()`),
   and `reset()` clears the token and cookies while leaving the connector fully
   operational.
3. After `reset()`, the next request silently opens a **new** SAP session under
   the **same** `sap-adt-connection-id`:

```
LOCK   → session #1 (SAP_SESSIONID_...=STUB-SESSION-1)
reset()
PUT    → session #2 (SAP_SESSIONID_...=STUB-SESSION-2), same connection id
```

Nothing throws, nothing informs the caller, and the PUT carries a lock handle
acquired in session #1. That is how an orphaned edit-lock (object created,
INACTIVE, locked) becomes indistinguishable from a connector regression when
read from logs: the client-side id is stable by construction, so it always looks
fine. `getSessionId()` cannot answer "is the SAP session I opened still the one
I am talking to?" — nothing can.

## Scope

In scope: the lifecycle contract, its two implementations, session-identity
observability, and the adaptation of `adt-clients` to both.

Out of scope, deliberately:

- **The `authType` conditionals in the recovery paths**
  (`AbstractAbapConnection.ts` lines 392, 451, 907). They classify errors rather
  than manage sessions, and the lifecycle never asks which auth is in play.
  Line 907 in particular means `shouldRetryCsrf` is always `false` under JWT, so
  the CSRF recovery path does not run there at all — worth its own issue, not a
  silent fix inside this change.
- **The cross-handler session-mode flip in adt-clients** (a chain finishing on
  one handler restores `stateless` while another handler still holds a lock).
  A request without the stateful marker does not end a session — Eclipse omits
  that header on everything except LOCK/UNLOCK — so this is a separate story
  about 423 on older kernels, not this defect.
- **Ending the session server-side on `disconnect()`.** See the decision below.

## Decisions

Each of these was a fork with a real alternative; the alternative and the reason
for rejecting it are recorded so the choice can be revisited on evidence rather
than reopened from scratch.

### D1 — A forced session replacement is fatal only inside a stateful window

Two kinds of recovery already exist in the connector and must not be treated
alike:

- recovery that **preserves** session identity (a CSRF token refresh with the
  cookies intact);
- recovery that **must replace** it, because the credential itself was renewed —
  after a fresh login form or a fresh JWT the old ABAP session cannot be kept.

The second kind cannot be forbidden. It is made explicit instead: transparent
outside a stateful window, fatal inside one.

Rejected: throwing on every forced replacement. It would break the automatic
recovery that read-only consumers rely on today and see no problem with.
Rejected: never throwing and only exposing identity — that relies on every
caller remembering to check, and forgetting to check is what produced the
orphaned lock.

`stateful` mode is the signal for "a lock is held". It needs no new API and our
chains already keep the whole lock window stateful.

### D2 — `disconnect()` sends no ADT session-close; it does release transport resources

`disconnect()` never sends an **ADT session-close request**. Rejected: the
`x-sap-adt-sessiontype: stateless` signal — that header value has **never** been
observed in Eclipse logs, so there is no evidence it ends a session, and
inventing a protocol move against the only reference implementation we have is a
bad bet. Eclipse simply unlocks and lets the session idle out.

That prohibition is about the ADT protocol, **not** about a transport releasing
what it owns. The two transports therefore differ, and the difference is
observable to callers, so it is stated rather than left implied:

| | HTTP | RFC |
|---|---|---|
| what `disconnect()` does | clears cookies, CSRF token, session state | the same, **plus closes the RFC client** |
| touches the network | no | yes — closing the client is a network operation |
| does the ABAP session end | no; it idles out | yes, **once the close succeeds** |
| do its locks survive | **yes** — see below | no, once the close succeeds |

For HTTP there is no session-owning resource to release: sockets belong to the
agent, and the session lives on the server. For RFC the ABAP session **is** the
open client, so leaving it open would leak both a socket and a server-side
session. `RfcAbapConnection.close()` is therefore called from `disconnect()`.

### Teardown has two outcomes, not one

`disconnect()` **never throws**, on either transport. But "never throws" must not
be allowed to mean "always succeeded", so the two things it does are settled
separately:

- **Session state — unconditional.** The lifecycle goes `disconnected` whatever
  happens. A torn-down connection must never serve another request, and that
  guarantee cannot depend on a network call.
- **Transport resource — best effort, and retriable.** If the RFC close fails,
  the release stays **pending**: the client may still be open and its locks still
  held. The failure is logged at warn level.

Consequently **idempotence means "safe to call repeatedly", not "a no-op after
the first call"**: `disconnect()` on an already-disconnected connection retries a
pending release, and is a true no-op only when nothing is left to release.
Without that rule a swallowed close error would be unrecoverable through the
contract — the state would say disconnected, the second call would do nothing,
and an open client with live locks would sit there unreachable.

The contract owes the caller honesty about the limit here: a failed release is
**not** reported through the return value, since `disconnect()` resolves either
way. A caller that needs certainty either calls `disconnect()` again, or uses
`RfcAbapConnection.close()` directly on the concrete class, where the error
surfaces. Widening the interface to carry a release outcome was considered and
rejected — it would put a transport-specific concern into a contract that four
other implementations do not have.

**Consequence to state plainly: over HTTP, `disconnect()` does not release
locks.** The ABAP session lives on until its timeout, along with whatever enqueue
locks it held. Callers unlock first — `unlockAll()` remains the mechanism — and
only then disconnect. Do not generalise the RFC behaviour to HTTP; the whole
point of the table above is that this is the one place they genuinely differ.

That RFC's session end releases its enqueue locks is standard SAP behaviour but
we have not exercised it here; it joins the live-probe list rather than being
assumed.

### D3 — The contract gains identity, not an error class

`IAbapConnection` gains `disconnect()`, `isConnected()` and
`getSessionIdentity()`. Error signalling uses string-code constants in
interfaces, not a class: the contract package holds types, interfaces and
constants only.

Rejected: the minimum without identity — then D1 is unverifiable, since a caller
could only catch an exception and never ask "is this still the same session?".
Rejected: adding a typed error class to interfaces — it would be the first class
in a package that deliberately has none.

### D4 — One lifecycle implementation, composed twice

`RfcAbapConnection implements AbapConnection` directly; it does not extend
`AbstractAbapConnection`. A `SessionLifecycle` unit is therefore composed by
both rather than inherited by one.

Rejected: implementing the state machine twice — two copies of one contract
diverge at the first edit. Rejected: HTTP only, RFC later — then `isConnected()`
means different things per transport and the contract becomes a half-truth.

`AbstractAbapConnection` is already ~900 lines; composition keeps this concern
out of it.

## Contract surface

```ts
/**
 * Establish the session. Idempotent: a second call on a connected connection is
 * a no-op.
 *
 * REJECTS if the session could not be established, and the connection is then
 * guaranteed to be left disconnected — isConnected() === false. A resolved
 * promise means, and is the only thing that means, that a session exists.
 */
connect(): Promise<void>;            // signature unchanged, semantics tightened
/**
 * Tear the session down. Never throws — which is not a claim that it always
 * succeeded: the state always goes disconnected, while releasing a transport
 * resource (the RFC client) is best effort. Idempotent in the sense of "safe to
 * call repeatedly": a repeat call retries a release that previously failed.
 * Sends no ADT session-close. Over HTTP it does NOT release locks — see D2.
 */
disconnect(): Promise<void>;
isConnected(): boolean;
/**
 * Fingerprint of the SAP-side session, or null when no fingerprint is
 * available — which covers both "not connected yet" and "connected, but this
 * server issues no session cookie". Use isConnected() to tell those apart;
 * null never means "the session changed".
 */
getSessionIdentity(): string | null;
```

```ts
export const ADT_SESSION_ERROR = {
  NOT_CONNECTED: 'ADT_NOT_CONNECTED',
  SESSION_REPLACED: 'ADT_SESSION_REPLACED',
} as const;
```

The connector throws a plain `Error` carrying `code`; consumers match the
constant.

`getSessionIdentity()` is **not** `getSessionId()`. The first answers "which
server session am I talking to" and changes on replacement; the second returns
our client-side conversation id, stable by construction. Both stay — conflating
them is what made the defect invisible.

**Breaking-change surface:** adding required methods breaks every implementor of
`IAbapConnection`. In this repo there is exactly one, and it is easy to miss:
`src/batch/BatchRecordingConnection.ts:13`.

## SessionLifecycle

```ts
class SessionLifecycle {
  get connected(): boolean;
  get identity(): string | null;
  markConnected(identity: string | null): void;
  markDisconnected(): void;
  /** Classifies a freshly observed identity. */
  observe(identity: string | null): 'unchanged' | 'established' | 'replaced';
  /** Throws with code NOT_CONNECTED. */
  assertUsable(): void;
}
```

States: `disconnected` (initial) → `connected` → `disconnected`. `connect()` on a
connected connection is a no-op; `disconnect()` on a disconnected one is a no-op
**only when no release is pending** (D2);
`connect()` after `disconnect()` is allowed and starts a fresh session with a new
identity — explicit, therefore unproblematic.

### connect() failure semantics

`markConnected()` is called **only after** a session has actually been
established — the credential accepted and the token/cookies obtained. If
establishment fails, `connect()` **rejects** and the state stays `disconnected`.
There is no third outcome: no "connected but unusable", no resolved promise over
an empty jar.

This is a behavioural change to existing code, not a restatement, and it is the
change most likely to surprise a consumer. `BaseAbapConnection.connect()`
currently **swallows** the failure — it logs `Could not connect to SAP system
upfront: … Will retry on first request` and resolves anyway, deferring
establishment to the first request. That is precisely the implicit connect this
design removes: with the lazy path gone, a swallowed failure would leave a
connector that reports success, holds nothing, and then refuses every request
with `NOT_CONNECTED` — the least informative failure available. Every `connect()`
implementation (basic, JWT, SAML, certificate, Kerberos, RFC) either marks
connected after a verified establishment or rejects.

A server that issues no session cookie is **not** a failure: the credential was
accepted, so the connection is connected with a `null` identity.

The unit knows nothing about session mode, locks or auth. The connection asks
`observe(newIdentity)`, and applies the D1 policy in one readable place: result
`'replaced'` **and** mode `stateful` → throw `SESSION_REPLACED`.

**`reset()` now transitions to `disconnected`.** Today it clears cookies and the
token while leaving the connector usable, which is the hole itself. Afterwards a
request fails with `NOT_CONNECTED` until `connect()` is called.

**Who may re-establish, precisely.** The rule bans a *silent session swap*, not
every re-establishment:

- A **fresh** request on a disconnected connector always throws
  `NOT_CONNECTED`. The connector never connects on a caller's behalf.
- Inside a **recovery it is already performing** — a bounded, logged reaction to
  a request that has already failed (paths C, D-second-branch, E) — the connector
  may re-establish, and only when the mode is not `stateful`. This is the
  transparent recovery D1 keeps; it is bounded to one in-flight request, it is
  logged, and the resulting identity change is recorded.

Both readings of "no lazy re-establishment" would otherwise be defensible, so
the distinction is normative: bounded recovery of a failed request, yes; opening
a session for a fresh request, never.

## Credential renewal is a lifecycle event

Authentication is injected — the consumer decides whether it is JWT, basic, or
something a future provider supplies. The lifecycle must not branch on it:

```ts
/**
 * The credential backing this session was renewed — no ABAP session survives
 * it. This is a KNOWN replacement: it needs no identity comparison, because we
 * already know the old session is gone.
 */
protected onCredentialRenewed(): void {
  const wasStateful = this.sessionMode === 'stateful';
  this.lifecycle.markDisconnected();
  if (wasStateful) {
    throw sessionError(ADT_SESSION_ERROR.SESSION_REPLACED);
  }
}
```

The order matters and is normative. `markDisconnected()` drops the identity, so
a later `connect()` would classify the new session as `established`, never as
`replaced` — comparing identities across a credential renewal cannot work, and an
earlier draft of this spec promised exactly that. The stateful check therefore
happens **before** the teardown and does not depend on any comparison. State is
still marked disconnected first, so the connector is never left `connected` with
a dead credential, whichever way the throw goes.

Replacement is thus detected by two independent mechanisms, and both are needed:

- **known** — a credential renewal (the code above). No comparison involved.
- **observed** — a tracked session cookie changes value under us, with no
  credential renewal in play (a proxy landing us on another app server, a server
  restart). This is what identity comparison is for.

This removes two special cases instead of adding a third: `JwtAbapConnection`
calls the hook after a successful `tryRefreshToken()` instead of `reset()`, and
the basic login-form-401 path calls the same hook instead of
`invalidateSession()`.

## Session identity

### Two different sessions

These are separate things and the design must not conflate them:

- the **HTTP/REST session**, carried by cookies;
- the **ABAP session** on the server, which is what holds the enqueue lock.

A cookie is the *carrier* that binds a request to an ABAP session. Its presence
is not proof the ABAP session is alive: in the E19 incident the session cookie
was in the jar and the server still answered 400 "Session not found". So identity
comparison detects a **swap** (the carrier now points somewhere else) and cannot
detect a **death** (same carrier, dead ABAP session). Death is only observable
from the server's answer — see "Detecting a dead session" below. Both lead to the
same conclusion for a caller holding a lock, and must be reported alike.

`SAP_SESSIONID_<SID>_<CLNT>` is the cookie through which the stateful ABAP
session is kept; it is the authoritative source for the fingerprint.

| cookie | in the fingerprint | why |
|---|---|---|
| `SAP_SESSIONID_<SID>_<CLNT>` | yes — authoritative | the carrier of the stateful ABAP session |
| `sap-XSRF_*` | **no** | changes on a token refresh **within the same session** |
| `sap-usercontext` | **no** | we overwrite it ourselves with the configured client |
| `sap-contextid` | **unverified — do not rely on it** | see below |

Excluding `sap-XSRF_*` is a correctness condition, not cosmetics: were it
included, an ordinary token refresh with live cookies would read as a replacement
and would fail exactly where nothing is wrong. The fingerprint must react to a
session change and must not react to a token change.

**On `sap-contextid`.** It appears in the E19 raw log
(`"setCookieNames":["sap-contextid"]` on the LOCK response, and in `jarAfter`),
which is where this spec first took it from — not from documentation. Whether it
is an ADT/ICF cookie at all, a Gateway soft-state artifact, or something the
proxy in that landscape injected, is **unverified**. It must not be given a role
until a probe says what it is. An earlier draft made it the primary fingerprint
source, which was wrong twice over: unverified, and it broke the additive rule
below.

### Additive rule

The fingerprint is a map of tracked cookie name → value, not a single string
picked by priority. Classification:

- a tracked name whose **value changes** → `replaced`;
- a name **appearing** where none was tracked → `established`, never `replaced`;
- nothing tracked and nothing appearing → `unchanged`.

Without this rule the first LOCK breaks the design: a second identifier for the
same session shows up mid-window, a priority-based fingerprint switches source,
the value changes, the mode is already `stateful` — and the connector throws
`SESSION_REPLACED` immediately after successfully acquiring the lock. A
fingerprint must stay stable when an additional identifier for the same session
appears.

The same rule covers RFC, where the identity starts as the fact of an open RFC
client and a captured cookie may appear later
(`RfcAbapConnection.ts:326`): the appearance is `established`, not a swap.

### Where it is computed

`updateCookiesFromResponse` computes the fingerprint after every response and
returns the classification. It throws nothing — `makeAdtRequest` applies the
policy after the response and before returning it, so cookie parsing stays free
of policy and no exception fires mid-state-update.

When the server issues no session cookie at all (a purely stateless consumer),
nothing is ever tracked, every classification is `unchanged`, and nothing throws.
Read-only consumers see no change.

For RFC: one ABAP session per connection, so the identity is set at `connect()`
and cleared when the client closes — which `disconnect()` performs (D2). The
identity and the open client have the same lifetime, which is why RFC needs no
separate teardown of the two.

### Detecting a dead session

A swap is observable locally; a death is not. When the server reports that the
session it was given no longer exists — the E19 shape was HTTP 400 with
`statusText: "Session not found"`, arriving in ~60 ms with the cookie present —
the connector classifies it as a lost session and surfaces
`SESSION_REPLACED` semantics: the lock handle is dead, and no internal retry is
attempted.

**On that classification the connector marks the lifecycle disconnected**, the
same as for a known replacement. This is load-bearing, not bookkeeping: a dead
session leaves the cookie — and therefore the fingerprint — completely unchanged,
so identity comparison cannot see it. Only the state can. Anything downstream
that needs to know whether a session is still usable must ask the connector, and
must never infer usability from an unchanged fingerprint.

The exact status/text match is landscape-specific, so the probe
listed under Testing must record what the target systems actually return before
this classification is relied upon; until then it is a documented gap rather than
a silent one.

## Recovery paths under the new rules

One rule: **recovery that preserves session identity is untouched; recovery that
must replace it is transparent outside a stateful window and fatal inside one.**

| path | today | after |
|---|---|---|
| **LOCK itself** | — | the lock response may add a second identifier for the same session. Additive rule → `established`, **not** `replaced`. Acquiring a lock must never throw |
| **A.** first token on a mutation | implicit `connect()` | not connected → `NOT_CONNECTED`. Connected but no token → fetch allowed; cookies alive, identity `unchanged` |
| **B.** CSRF retry on 403 | fetch with cookies, retry | **unchanged.** The fingerprint ignores `sap-XSRF_*`, so `unchanged` — the path works as before |
| **C.** login-form 401 (basic) | `invalidateSession()` → new session, silently | credential renewal → `onCredentialRenewed()`. Outside stateful: explicit internal `connect()`, continue, replacement logged. Inside stateful: `SESSION_REPLACED` |
| **D.** 401 on GET | cookies present → retry; absent → fetch | first branch unchanged (same identity); the second means the session is already gone → as C |
| **E.** JWT 401/403 | `tryRefreshToken()` → `reset()` → silent retry in a new session | the same `onCredentialRenewed()` and the same fork; no JWT-specific code |

Automatic recovery for ordinary operations is therefore **kept**. A consumer that
reads objects and holds no locks sees no change.

Two consequences drawn from the E19 log:

- **No internal retry on `SESSION_REPLACED`.** The log shows `SESSION_RETRY_KEEP`
  — a blind retry that produced further locks instead of stopping. The error goes
  to the caller; the decision is theirs.
- **`SESSION_REPLACED` means the lock handle is dead.** Not "retry" but "your
  lock is lost; the object may remain locked on the server". For adt-clients that
  is not a signal to `unlockAll()` (a dead session has nothing to unlock with)
  but to report a dangling lock, which then needs a new session or an
  administrator.

## adt-clients adaptation

- **`BatchRecordingConnection`** implements the three new methods: `isConnected()`
  and `getSessionIdentity()` proxy the real connection; `disconnect()` is a
  logged no-op, since a batch holds no session.
- **`AdtClient`** gains an early check. Calling `connect()` stays the consumer's
  job — the library does not own the connection and must not connect on its
  behalf. But a missing connect would otherwise surface mid-chain, after
  `validate` and `create`, once the object already exists. Checking
  `connection.isConnected()` before the first `IAdtObject` operation turns
  "object created, then an error" into "nothing happened".
- **`LockRegistry`** captures the fingerprint alongside the handle at `lock()`.
  Before unlocking it evaluates a precondition with **two** parts, and both are
  required:

  ```
  send UNLOCK  iff  connection.isConnected()  AND  identity === captured identity
  ```

  The state comes first on purpose. A dead ABAP session leaves the cookie — and
  therefore the fingerprint — unchanged, so comparison alone would happily send
  an UNLOCK into a session that no longer exists, which is precisely the internal
  retry this design forbids. When the precondition fails, the lock is returned in
  `LockFailure[]` (the structure already exists) with "session lost, lock left on
  the server". `unlockAll()` stops producing noise and starts telling the truth.
- **Operation chains** decide from the **error in hand**, not from a comparison.
  If the failure that entered the catch block carries `code === SESSION_REPLACED`
  or `code === NOT_CONNECTED`, the unlock is skipped unconditionally and a
  dangling lock is recorded. Only for any other failure does the chain fall
  through to the `LockRegistry` precondition above. Inferring "the session is
  probably fine" from an unchanged fingerprint is exactly the mistake this rule
  exists to prevent. Today those catch blocks attempt an unconditional unlock.

## Testing

| level | covers | SAP |
|---|---|---|
| `SessionLifecycle` | states, idempotence, `observe()` classification, **the additive rule** | not needed |
| connector | the `NOT_CONNECTED` guard; `reset()` → `disconnected`; **the fingerprint ignores `sap-XSRF_*`**; **a LOCK adding a second identifier does not throw**; **credential renewal under `stateful` throws before teardown**; **a failing `connect()` rejects and leaves `isConnected() === false`**; **`disconnect()` never throws, including when the RFC close fails — and a repeat call retries that failed close instead of being a no-op**; all five recovery paths; no internal retry on `SESSION_REPLACED` | not needed |
| adt-clients | the two shields flipped; `LockRegistry` sends no unlock into a replaced session; **no unlock into a DEAD session either, where the fingerprint is unchanged** | not needed |

The stub in `src/__tests__/unit/session/adtStubServer.ts` already hands out a
distinct session per discovery fetch, which is what makes "replacement while
stateful throws" testable without SAP. For the additive rule it needs one
addition: a LOCK response that sets a *second* session-ish cookie alongside the
first.

Three tests guard the ways this design can fail quietly rather than loudly, and
they matter more than the rest of the set:

1. **`sap-XSRF_*` stays out of the fingerprint.** Fold it in and path B breaks —
   errors appear where nothing is wrong.
2. **A LOCK that adds a second identifier does not throw.** Get the additive rule
   wrong and every lock acquisition fails immediately after succeeding.
3. **Credential renewal under `stateful` throws before teardown.** Do it in the
   other order and `SESSION_REPLACED` can never fire on paths C and E — the very
   paths the rule exists for.
4. **A dead session sends no UNLOCK, with the fingerprint unchanged.** The stub
   answers the in-window request with the dead-session shape while leaving every
   cookie in place. Decide from the comparison alone and the cleanup path posts an
   UNLOCK into a session that no longer exists — the internal retry this design
   forbids, arriving through the back door.

**Needs a live system — four items, all preconditions for releasing the
connection package.** The stub cannot settle any of them:

1. **Which cookie carries the stateful ABAP session** on each target landscape.
   `SAP_SESSIONID_<SID>_<CLNT>` is the assumption this design is built on.
2. **What `sap-contextid` actually is** — an ADT/ICF cookie, a Gateway soft-state
   artifact, or something a proxy injected. It appears in the E19 log and nowhere
   in our code or in any documentation we have checked. Until answered it stays
   out of the fingerprint.
3. **What a dead session returns.** E19 gave HTTP 400 / "Session not found"; the
   dead-session classification must match what the target systems really send.
4. **Whether closing the RFC client releases its enqueue locks.** Standard SAP
   behaviour says an ending session releases them, which is what makes RFC's
   `disconnect()` differ from HTTP's, but we have not exercised it. Needs a
   legacy/RFC-capable system, so it is the one probe this box cannot run.

## Releases

Order: interfaces → connection → adt-clients, each published to npm before the
next consumes it. Version numbers are the user's call at each step.

- **interfaces** — BREAKING: three required methods break every implementor.
- **connection** — BREAKING, on three counts: implicit connect disappears;
  requests are refused after `disconnect()`/`reset()`; and `connect()` now
  rejects on failure where `BaseAbapConnection` used to log a warning and resolve
  anyway.
- **adt-clients** — needs both new versions. Its own API barely changes, but the
  "connect() first" requirement propagates to its consumers, so it belongs at the
  top of the CHANGELOG entry rather than among the details.

**Rollout risks to name, both intended and both belonging at the top of the
connection CHANGELOG rather than among the details:**

- consumers relying on implicit connect break at their first request;
- a `connect()` that used to resolve through a broken connection now rejects, so
  a consumer that never checked its result will start failing at startup instead
  of at the first request. That is the better failure, but it is a new one.
