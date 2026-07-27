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
pending release, and skips work only when nothing is left to release and no
window is waiting — while still reporting what it found either way.
Without that rule a swallowed close error would be unrecoverable through the
contract — the state would say disconnected, the second call would do nothing,
and an open client with live locks would sit there unreachable.

**Revised decision, recorded rather than smoothed over.** An earlier draft had
`disconnect()` return `void` and rejected reporting the release outcome, on the
grounds that a transport-specific concern did not belong in a contract four
other implementations do not share. That reasoning was sound for a
release-outcome flag alone; it stopped being sufficient once this design
promised to record an abandoned lock window on timeout, which is **not**
transport-specific and needs a channel that "never throws, returns nothing"
cannot provide.

`disconnect()` therefore resolves with a `TeardownReport`. It still never
throws: the report describes what did not finish rather than failing. A caller
who wants certainty about a pending release can also call `disconnect()` again
or use `RfcAbapConnection.close()` directly, where the error surfaces.

### A pending release must survive, and must block reconnection

"Retriable" is empty unless the thing to retry still exists, and today it does
not. Two facts in `RfcAbapConnection` make a pending release unreachable:

- `close()` sets `this.rfcClient = null` **outside** the catch, so a failed close
  drops the only reference to a client that is still open;
- `connect()` assigns `this.rfcClient = new Client(...)` unconditionally, so a
  reconnect overwrites whatever was there.

Either one alone loses an open ABAP session together with its locks — permanently
and silently, which is the exact failure class this design exists to remove. Both
are therefore part of this change:

1. **A failed close retains the client.** It stays in a dedicated pending slot
   that `connect()` never assigns to. Only a successful close clears it.
2. **`connect()` with a pending release retries that release first.** On success
   it proceeds normally. On failure it **rejects** with `RELEASE_PENDING`, leaving
   the state `disconnected` and the pending client untouched — refusing to open a
   second session while the first is still held.

Rejected: letting `connect()` proceed and keeping the leaked clients in a list.
That is bookkeeping without a mechanism — nothing would ever retry them, and the
list would only record how many sessions we have abandoned.

The cost is real and worth stating: a landscape where close permanently fails
leaves the connector unusable. That is preferable to a connector that quietly
accumulates open ABAP sessions holding enqueue locks, and in the common cause of
a failed close — the network is gone — `connect()` would fail anyway.

`reset()` needs the same treatment for a different reason: it is synchronous
(`reset(): void { this.close(); }`) and cannot await the close, so it currently
drops the promise on the floor. Its full semantics are settled under
"A synchronous reset() must not tear down under a live request" below.

None of this applies to HTTP, which holds no session-owning resource and can
never have a release pending.

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
 * resource (the RFC client) is best effort. The report says what did not
 * finish. Idempotent in the sense of "safe to call repeatedly": a repeat call
 * retries a release that previously failed. Sends no ADT session-close. Over
 * HTTP it does NOT release locks — see D2.
 */
disconnect(): Promise<TeardownReport>;
isConnected(): boolean;
/**
 * Fingerprint of the SAP-side session, or null when no fingerprint is
 * available — which covers both "not connected yet" and "connected, but this
 * server issues no session cookie". Use isConnected() to tell those apart;
 * null never means "the session changed".
 */
getSessionIdentity(): string | null;
/**
 * Open a lock window. Throws NOT_CONNECTED when a teardown is pending: a lock
 * outlives the request that takes it, so it is the one thing a pending teardown
 * must refuse outright. A teardown waits for every window to close.
 *
 * NOT paired with endWindow() in a bare finally, however habitual that is: a
 * window says "a lock may be held", so it closes on EVIDENCE — a confirmed
 * UNLOCK, or a confirmed failure of the LOCK itself. A finally would close it
 * after an unlock that failed, was never sent, or whose outcome is unknown,
 * which is precisely when the lock is most likely still there.
 *
 * `label` is REQUIRED and opaque — the connector attaches no meaning to it,
 * but it must exist. An unnamed window cannot be reported: it would either
 * vanish from the teardown report or appear as an empty string, and a
 * guarantee that names what was abandoned is worth nothing if a caller can
 * opt out of naming. adt-clients passes the lock key LockRegistry already
 * computes (`Class/ZCL_FOO`); any other consumer names its own window.
 *
 * A label names a window; it does NOT identify one. Two windows can legitimately
 * carry the same label — the same object locked by two flows, and in any case
 * beginWindow() runs BEFORE the LOCK succeeds, so nothing has made it unique
 * yet. Closing by label would let one flow's endWindow() retire an entry the
 * other still holds, after which the drain completes and the teardown proceeds
 * under a live operation. So beginWindow() returns a token identifying THAT
 * window, and endWindow() takes the token. The token also makes a double close
 * or a mismatched close detectable instead of silently decrementing something.
 */
beginWindow(label: string): WindowToken;
endWindow(token: WindowToken): void;
```

```ts
/**
 * Opaque handle for one open lock window: `Symbol(label)`.
 *
 * A symbol, not a branded object, because EVERY implementation of
 * IAbapConnection has to be able to make one — the batch recorder included —
 * and a brand only the lifecycle can construct forces everyone else into a type
 * assertion, which is a cast pretending to be a guarantee. A symbol is unique by
 * construction, cannot be confused with a label, needs no factory in a contract
 * package that holds no functions, and carries the label as its description for
 * debugging.
 *
 * Provenance is not what the type has to prove: endWindow() checks membership at
 * runtime, so a token from elsewhere, or a second close of the same window, is
 * a token that matches no open window — logged and ignored. That check is
 * stronger than a brand, since it also catches a token this very connection
 * issued and already retired.
 */
type WindowToken = symbol;

interface TeardownReport {
  /**
   * Labels of lock windows still open when the bounded wait expired,
   * deduplicated — instances are tracked separately inside, but two abandoned
   * windows over one object say the same thing to a reader. Empty when nothing
   * was abandoned; every entry is a real, named window, because beginWindow()
   * requires a label.
   */
  abandonedWindows: string[];
  /** A transport release did not complete and stays pending (D2). */
  releasePending: boolean;
}
```

```ts
export const ADT_SESSION_ERROR = {
  NOT_CONNECTED: 'ADT_NOT_CONNECTED',
  SESSION_REPLACED: 'ADT_SESSION_REPLACED',
  /** connect() refused: a previous transport release has not completed (D2). */
  RELEASE_PENDING: 'ADT_RELEASE_PENDING',
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
interface RequestLease {
  /** Teardown epoch at admission — the baseline for this request's recovery. */
  readonly epoch: number;
  /** Call once the request settles. Safe to call twice. */
  release(): void;
}

class SessionLifecycle {
  get connected(): boolean;
  get identity(): string | null;
  /**
   * Publishes usability. The caller must first check that the teardown epoch has
   * not moved since its transition started: a connect that finished after a
   * teardown was requested must not republish usability.
   */
  markConnected(identity: string | null): void;
  markDisconnected(): void;
  /**
   * Runs a lifecycle transition on the serializing tail. A call joins the
   * in-flight promise only when the queue TAIL is the same `kind` — never
   * overtaking anything queued behind it. Otherwise it is appended and
   * re-evaluates its precondition on its turn.
   */
  /**
   * `connect` and `disconnect` may join the queue tail of the same kind — two
   * callers wanting the same thing get one execution and the same answer.
   *
   * `recover` and `cleanup` NEVER join and are never joined. A `recover` carries
   * the baseline of its own request, so a shared promise would propagate one
   * request's cancellation to another. A `cleanup` is an internal teardown that
   * owes its result to nobody, while a caller's `disconnect()` owes a
   * TeardownReport — join them and the caller's own execution is skipped and its
   * report never produced.
   */
  transition(
    kind: 'connect' | 'disconnect' | 'recover' | 'cleanup',
    run: () => Promise<void>,
  ): Promise<void>;
  /**
   * Marks the session unusable synchronously, before a teardown's first await.
   * Two independent axes, and conflating them was a defect:
   *
   * `origin` decides the EPOCH. 'caller' bumps it, cancelling any recovery
   * belonging to a request admitted earlier — queued, being prepared, or not yet
   * failed. 'internal' (a cleanup from inside request handling) must not bump,
   * or a recovery would cancel itself.
   *
   * `sessionLost` decides ADMISSION. false — the session is alive and the caller
   * simply wants out — defers the close so an open window's requests can finish
   * (its UNLOCK is worth sending). true — the credential was replaced, or the
   * server said the session is gone — closes admission at once regardless of
   * open windows, and drops the identity immediately, because there is nothing
   * left to finish and an UNLOCK sent over a replaced session is the internal
   * retry this design forbids.
   */
  beginTeardown(opts: {
    origin: 'caller' | 'internal';
    sessionLost: boolean;
  }): void;
  /**
   * Opens a lock window under a required label. Throws NOT_CONNECTED if a
   * teardown is pending — a lock outlives the request that takes it, so it is
   * the one thing a pending teardown must refuse outright.
   */
  beginWindow(label: string): WindowToken;
  /**
   * Closes the window that token identifies; a token matching no open window is
   * logged and ignored, which covers a double close and a foreign token alike.
   * The drain completes when none are left open. Closing by label instead would
   * let one flow retire another flow's window when both carry the same name.
   */
  endWindow(token: WindowToken): void;
  /** Labels of the windows currently open, one entry per open instance. */
  get openWindows(): readonly string[];
  /**
   * The CURRENT epoch, read at a recovery's turn and compared against the
   * baseline its RequestLease captured at admission; a difference means
   * "abandon". Never capture a baseline from here — reading it when the
   * recovery is queued reopens the window this rule closes, because a teardown
   * requested between the failure and the queueing would already be reflected.
   */
  get teardownEpoch(): number;
  /**
   * Admits a request: asserts usability and counts it in, in ONE synchronous
   * step. The lease carries the teardown epoch at admission — the baseline a
   * recovery for this request compares against.
   */
  admitRequest(): RequestLease;
  /**
   * Resolves when every admitted request has settled AND every lock window has
   * closed. Bounded by the critical-section ceiling measured from the moment the
   * teardown was requested — absolute, never extended by request activity, or a
   * steady trickle of short requests would postpone expiry forever.
   *
   * On expiry, before resolving and without yielding in between: marks the
   * session unusable so nothing further is admitted, then waits once more for
   * the already-admitted requests to settle (no extra ceiling — they are
   * requests, and each carries a timeout). Only then does it resolve, with the
   * LABELS of the windows still open, which is what lets the teardown name the
   * locks it abandons instead of logging a count. Closing the gate here rather
   * than in the caller removes the gap a two-step version would have by
   * construction.
   */
  drain(): Promise<{ abandonedWindows: string[] }>;
  /** Classifies a freshly observed identity. */
  observe(identity: string | null): 'unchanged' | 'established' | 'replaced';
  /** Throws with code NOT_CONNECTED. */
  assertUsable(): void;
}
```

States: `disconnected` (initial) → `connected` → `disconnected`. `connect()` on a
connected connection is a no-op.

For `disconnect()`, **"no-op" governs the work, never the answer.** It always
resolves with a `TeardownReport` built from the current facts — windows still
open or already abandoned, and whether a release is pending — and skips only the
*work* when there is none: the state is already `disconnected`, no release is
pending, no window is waiting. Anything else and it runs.

Stated the other way round, because that is how it went wrong: a caller reaching
the queue after an internal cleanup has already torn everything down finds
nothing to do, and an earlier draft let that make the whole call a no-op —
resolving with an empty report and swallowing the abandoned lock the cleanup had
left for it to announce. Skipping work is an optimisation; skipping the report is
a false statement about the session.

`connect()` after `disconnect()` is allowed and starts a fresh session with a new
identity — explicit, therefore unproblematic — **except while a release is
pending**, where it first retries that release and rejects with
`RELEASE_PENDING` if the retry fails (D2). Reconnection must never abandon a
transport resource that is still held.

### Lifecycle transitions are serialized

Every rule above reads as if transitions happen one at a time. Nothing so far
made that true, and without it the pending-slot rule protects only against
sequential overwriting, not concurrent overwriting:

- two `connect()` calls racing both observe `disconnected`, both open a client,
  and one assignment silently discards the other — an open ABAP session with
  live locks, unreachable, exactly the outcome the pending slot was added to
  prevent;
- a `connect()` starting while a `disconnect()` still awaits a slow close finds
  a release already pending whose outcome is not yet known, so its retry can run
  concurrently with the close it is retrying — two operations on one resource.

**All lifecycle transitions run through one serializing tail: no two overlap.**
This covers `connect()`, `disconnect()`, and the bounded internal
re-establishment inside a recovery (paths C, D-second-branch, E), which must not
be allowed to race a caller's `disconnect()`.

- **A call joins the in-flight transition only when the queue tail is a
  transition of the same kind** — that is, when nothing is queued behind it.
  Two concurrent `connect()`s with an empty queue resolve from one
  establishment, and critically from one client. **Joining applies to `connect`
  and `disconnect` only. A `recover` and a `cleanup` never join anything and
  nothing joins them** — a recovery because it carries its own request's
  baseline, an internal cleanup because a caller's `disconnect()` joined to it
  would have its own execution skipped and would never produce the
  `TeardownReport` it owes.
- **Otherwise the call is appended to the tail** and **re-evaluates its
  precondition on its turn**, rather than acting on what it observed before
  waiting. A `connect()` queued behind a `disconnect()` sees the settled outcome,
  including a release left pending, and applies the `RELEASE_PENDING` rule to a
  known state rather than to a guess. A transition whose turn comes when its work
  is already done does nothing: a `connect()` reaching the front while connected,
  a `disconnect()` reaching it with nothing left to tear down — the latter still
  resolving with a report of what it found.

**Joining is restricted to the tail on purpose, and "same kind" alone is not
enough.** Take `connect()` in flight, a `disconnect()` queued behind it, then a
second `connect()`. Were the second to join the first by kind, it would overtake
the queued `disconnect()` and resolve — telling its caller a session is ready
moments before the queue tears that very session down. FIFO order with tail-only
joining keeps every caller's answer true at the moment it is given.

### Usability during a transition

Requests never join lifecycle transitions and never wait for one. Which state the
guard reports mid-transition is **asymmetric**, and the asymmetry follows one
rule: *a transition that removes usability takes effect at its start; a
transition that grants it takes effect at its end.* Always answer on the safe
side.

| in flight | `isConnected()` during it | a request then |
|---|---|---|
| `connect()` | `false` — usability is granted only once establishment succeeds | `NOT_CONNECTED` |
| `disconnect()`, no lock window was open when it was requested | `false` — **synchronously, before the first await** | `NOT_CONNECTED` |
| `disconnect()`, a lock window **was** open | `false` | ordinary requests admitted until the last window closes, so the chain can finish; a new window refused outright |
| a **session-lost** teardown | `false` | everything refused at once — no window can finish over a session that is gone |

`isConnected()` reports `false` in every teardown case: a caller asking "may I
start work" must hear no. Admissions during an open window are the finishing of
work already started, not a licence to begin more — and they end at the edge, not
at some later observation.

### Teardown drains in-flight requests

Refusing new requests is only half of "a teardown never overlaps use of the
resource". A long `makeAdtRequest()` that passed the guard *before*
`disconnect()` began keeps running, and the teardown would clear its cookies or
close the RFC client underneath it. Serialization orders transitions against each
other; it says nothing about a transition against a request already in progress.

So `disconnect()` has three steps, in this order:

1. mark the session unusable **and bump the teardown epoch** — synchronously, at
   call time, before any await — **unless a lock window was open at that
   instant**, in which case ordinary requests stay admitted until the last window
   closes so the chain can finish, while opening a new window is refused
   outright (see below);
2. **await the drain** — no request in flight **and** no open lock window
   (bounded; see below);
3. only then release the transport resource and clear the state.

**The drain needs no timeout of its own.** Every request already carries an
explicit timeout, and one inside a critical section carries the large ceiling
instead — which is the behaviour we want, since waiting for a lock-window request
is strictly better than tearing down underneath it. Adding a separate teardown
timeout would invent a second deadline that could only ever contradict the first.

Requests are counted in, not sampled: the guard check and the increment happen in
the **same synchronous step**, before any await. Anything else leaves a window
where a request has been admitted but is not yet visible to the drain — which is
this very defect, one level down.

Rejected: cancelling in-flight requests instead of draining. It would need abort
plumbing through five HTTP connection classes, and RFC cannot generally cancel a
call already in flight — so the guarantee would hold for one transport and not
the other, which is worse than waiting on both.

`disconnect()` still never throws: a request that fails during the drain settles
it just as well as one that succeeds.

### The drain must cover the lock window, not only single requests

Counting requests is not enough. A lock window spans several of them —
`LOCK … PUT … UNLOCK` — with gaps in between where **the in-flight count is
zero**. A `disconnect()` landing in such a gap drains instantly, tears the
session down, and orphans the lock: object locked and inactive, which is the
exact outcome this whole design exists to prevent, reached through the one door
we had left open.

So the drain waits on two things: **no request in flight, and no open lock
window.** Windows are declared by the chains rather than inferred from
`sessionMode`, for the reason given below: a second window opening inside the
first is invisible in a mode flag.

#### The window must be allowed to finish

Waiting for the window while refusing every new request would deadlock on
itself: step 1 makes the session unusable, so the chain's own UNLOCK is refused
with `NOT_CONNECTED`, and step 2 waits for a `stateful` flag that only that
UNLOCK would clear. The teardown would always sit out the ceiling and record a
dangling lock it caused itself.

#### Two teardowns, not one

Everything below about letting an open window finish assumes the session is
still there. That holds for a caller's `disconnect()` — the caller wants out,
the ABAP session is alive, and the chain's `UNLOCK` is worth sending. It does
not hold when the session is already gone: a replaced credential, or a server
that answered "session not found". Then there is nothing to finish, and an
`UNLOCK` sent over the replacement is exactly the internal retry this design
forbids.

So a teardown declares which it is:

| | graceful (`sessionLost: false`) | session lost (`sessionLost: true`) |
|---|---|---|
| raised by | a caller's `disconnect()` | credential renewal, dead-session detection |
| admission | deferred while a window is open, so it can finish | closed **at once**, whatever is open |
| identity | dropped by the queued cleanup | dropped **immediately** |
| open windows | waited on, then abandoned at the ceiling | abandoned immediately — nothing can close them |

Dropping the identity immediately is what makes the rest consistent without a
special case: a later `unlockAll()` compares against the captured fingerprint,
sees it changed, skips the `UNLOCK` and records a `LockFailure`. Leave the
identity in place until the queued cleanup and that same call sees a match and
sends an `UNLOCK` over a session that no longer exists — with no error in hand
to warn it, because nothing had failed in *its* flow.

#### What must be refused is what outlives the request

Refusing everything deadlocks; refusing nothing lets a second handler take a new
lock during the wait, which the teardown then abandons — a fresh orphan created
by the very operation meant to clean up. The line runs between them, and it is
not "which request belongs to the window":

- **a request is ephemeral.** Whatever it does, it settles, and the drain waits
  for it before anything is released. Admitting it during the wait is safe.
- **a lock window outlives the request that opened it.** A `LOCK` admitted during
  a pending teardown leaves state behind that nobody will release.

So during a pending teardown, **ordinary requests are admitted until the last
open window closes; opening a new window is refused outright.** That refusal is
what the earlier closing-edge rule could not express, because a second handler
opening a window while the mode is already `stateful` produces no edge at all —
its `setSessionType('stateful')` is a no-op transition.

#### Windows are counted, not inferred

The lifecycle cannot infer window boundaries from `sessionMode`: a second window
opening inside the first is invisible there. It needs them declared:

```ts
/** Opens a lock window under a required label, returning a token that
 *  identifies this one. Throws NOT_CONNECTED if a teardown is pending. */
beginWindow(label: string): WindowToken;
/** Closes the window the token identifies. The drain completes when none are
 *  left open. */
endWindow(token: WindowToken): void;
```

The connector already has this shape as
`beginCriticalSection()`/`endCriticalSection()` (1.9.0+), which this design
promotes into `IAbapConnection` and makes mandatory rather than optional. Chains
call the pair around the lock window — at the very call sites that already toggle
`setSessionType`, so adoption is mechanical and bounded to those places rather
than threaded through every request.

That is the difference from a per-request lease, which was rejected: a lease
would have to be created before `LOCK` and passed to every low-level function
until `UNLOCK`, touching every object module — to refuse unrelated requests the
drain already covers. Counting windows costs two calls per chain and refuses the
only thing that actually persists.

The teardown therefore waits for the **window count to reach zero**, not for a
mode flag, and no new window can appear while it waits. A chain that crashes
between `PUT` and `UNLOCK` never calls `endWindow()`; the ceiling below ends the
wait, and the labels of the windows still open travel out through the
`TeardownReport` so the caller can name what was abandoned.

This is not a weakening of the earlier invariant. Nothing is released in steps 1
and 2 — the teardown is only *waiting* there — so no request ever runs against a
resource being freed. The release happens in step 3, after both the window and
the in-flight requests have settled.

(`beginCriticalSection()`/`endCriticalSection()` would be a more precise marker,
being explicit rather than inferred, but adt-clients does not call them today —
they are absent from `IAbapConnection`. If they are adopted later, they become
the marker and `stateful` the fallback; nothing else in this design changes.)

**This wait needs a bound, and the earlier argument does not supply one.** The
drain over requests needs no timeout because every request carries one; a window
with gaps carries nothing. Waiting unboundedly would let a caller that crashed
between PUT and UNLOCK hang `disconnect()` forever. So: the wait is bounded by
the critical-section ceiling (`SAP_TIMEOUT_CRITICAL`) measured **from the moment
the teardown was requested** — an absolute deadline, not a sliding one — and on
expiry the teardown proceeds and records a dangling lock — the same reporting path as `SESSION_REPLACED`, since the consequence is
the same: the object stays locked on the server and needs a new session or an
administrator.

**Absolute, because activity must not extend a deadline whose purpose is to
bound activity.** Measuring from the last settled request looks kinder — it
would never cut off a chain that is visibly progressing — but ordinary requests
stay admitted while a window is open, so a steady trickle of short ones pushes
the deadline forward indefinitely and `disconnect()` never reaches expiry at
all. "Never hang forever" would then be false in exactly the situation it was
written for: a busy consumer with an orphaned window. A chain that cannot close
its window within the ceiling is already pathological, and waiting longer does
not make it less so.

The second wait, after the gate closes, keeps needing no deadline of its own for
the reason the sliding one failed: nothing more can be admitted, so the set it
waits on only shrinks, and every member of it carries a timeout.

**Expiry closes the gate before it reports, and inside `drain()`.** Until the
ceiling runs out the gate is open — that is what lets the chain finish — so
giving up has to shut it, and shutting it late is the same hole in miniature: a
request admitted between `drain()` resolving and the release would run against a
resource being freed. Expiry therefore does three things in order, without
yielding between the first two:

1. mark the session unusable **synchronously**, so nothing more is admitted —
   the marking that was deferred to a window edge that will now never come;
2. wait once more for the requests already admitted to settle. This second wait
   needs no ceiling of its own: they are requests, and every request carries a
   timeout;
3. resolve with the labels of the windows still open.

**An abandoned window stays open, but is not waited on twice.** Giving up marks
that window abandoned; it remains in `openWindows`, because the lock may still be
held and the next teardown must still name it, but the drain does not spend the
ceiling on it again. Without that flag a teardown following an internal cleanup
that already gave up — the caller's `disconnect()` right after a credential
renewal, say — would sit out a second full ceiling to reach a conclusion already
reached, and a third after that. Waiting is for windows that might still close.

Keeping this inside `drain()` rather than leaving it to the caller is deliberate:
"resolve, then the caller closes the gate" has a gap between the two steps by
construction, and a caller that forgets reintroduces the whole defect.

Never hang forever, and never orphan silently. Callers still unlock before
disconnecting — `unlockAll()` remains the mechanism, and this bound is a backstop
for the case where they could not, not a licence to skip it.

A consumer that holds no locks never enters a stateful window, so for it this
rule does not exist.

### A synchronous reset() must not tear down under a live request

`reset()` returns `void`, so it cannot await anything — yet it clears cookies and
the token, and on RFC releases the client. Called while a request is in flight it
reproduces exactly the race the drain just closed.

It cannot be fixed by making it await the drain, and the reason is not
inconvenience but **self-deadlock**: `reset()` is called from *inside* request
handling (`JwtAbapConnection` calls it in its own `makeAdtRequest` error path
before retrying), so by construction there is an admitted request in flight — its
own. Awaiting the drain there would wait for a request that is waiting for
`reset()` to return.

So `reset()` splits along the same seam as `disconnect()`:

- **synchronously**, it marks the session unusable, so no further request is
  admitted, with `sessionLost: true` in both cases — it is discarding the session
  state, and nothing can finish over what is being thrown away;
- **the cleanup is queued** as a lifecycle transition, which drains first and only
  then clears state and releases the resource.

**But `origin` differs by caller, and there are two entry points rather than a
parameter.** An earlier draft gave both the same `internal` origin, reasoning
that "throw the session away" means the same thing whoever says it. That is what
the words mean and not what `origin` decides: it decides whether a *caller asked
to stop*, and therefore whether queued recoveries are cancelled. An external
`reset()` is exactly such a request, so treating it as internal lets a recovery
admitted beforehand finish later and re-establish the session the caller had just
discarded.

- `reset()` — public on the concrete class — raises `{ origin: 'caller',
  sessionLost: true }`;
- `discardSession()` — protected, and what the recovery paths call instead —
  raises `{ origin: 'internal', sessionLost: true }`, so a recovery does not
  cancel itself.

Two entry points rather than `reset(origin)` for the reason the window label is
required rather than optional: a distinction that matters is worse as a parameter
someone can omit or pass by habit. Here the internal path has to be *reached for*
by name.

`reset()` returns immediately, having guaranteed the part that must be immediate.
The serializing tail guarantees the rest: any `connect()` arriving afterwards
queues **behind** the queued cleanup and therefore runs on a settled state — with
`RELEASE_PENDING` applying if that cleanup's release failed. There is no window
in which a reconnect races a cleanup that `reset()` started.

This generalises: **any teardown initiated from inside an admitted request marks
state synchronously and queues its cleanup; it never awaits the drain from
within.** That covers `onCredentialRenewed()` on paths C and E as well, which is
likewise called from within request handling.

### Recovery must not wait on itself

Returning immediately is not enough for paths C and E, because the request does
not stop there: after the credential is renewed it must re-establish and retry.
That closes a cycle through the queue:

```
queued cleanup  → waits for drain, which includes this request
this request    → waits for its internal re-establishment
re-establishment → queued behind the cleanup
```

Nothing in that ring can move. Note it applies only **outside** a stateful
window: inside one, `onCredentialRenewed()` throws `SESSION_REPLACED` and there
is no recovery to deadlock.

Two rules break the ring, and both are needed:

**The failed attempt leaves the drain accounting before recovery starts.** The
request releases its lease, does the bounded recovery, and re-admits before the
retry — keeping the **original** lease's epoch as its baseline, since re-admitting
would otherwise capture a fresh epoch and forget that a teardown was requested. This is not a trick to dodge the drain: between attempts the
request holds nothing — its session is gone, the credential under it was
replaced. The drain protects requests *actively using* the session, and this one
no longer is. With it gone from the set, the cleanup drains and runs, and the
ring is open.

**Recovery re-establishment is its own transition kind (`recover`), and it yields
to a caller's teardown.** A caller who said "I am done" must not have a session
resurrected under them by a retry they never saw — requests do not outrank the
lifecycle.

Checking whether a teardown *has run* cannot express this, because FIFO puts a
`disconnect()` called after `recover` was queued **behind** it: at `recover`'s
turn that teardown has not run, and never will have. What matters is whether one
was **requested**, not whether it has executed.

So the lifecycle carries a **teardown epoch**:

- a caller-initiated teardown increments it **synchronously at call time**, in
  the same step that marks the session unusable — before anything is queued and
  long before that teardown's turn arrives;
- the baseline is captured **when the request is admitted**, not when `recover`
  is queued, and `recover` abandons on its turn — no re-establishment, the
  request fails — if the epoch has moved since.

**The baseline belongs at admission because queueing is too late.** A recovery
begins the moment the attempt fails and only reaches the queue some steps later;
a `disconnect()` landing in between would bump the epoch *before* the capture, so
`recover` would compare the new value against itself, see no change, and
re-establish a session the caller had already asked to close. Capturing at
admission leaves no such window: the request entered while the session was
usable, so **any** caller teardown afterwards — before the failure, during the
recovery, or after `recover` is queued — moves the epoch away from the baseline
and cancels the retry.

That is also the right meaning rather than merely the safe one: the retry belongs
to the admitted request, so the question it must answer is "has the caller asked
to stop since this request began", not "since some later bookkeeping step".

The distinction that keeps this from eating itself: **only caller-initiated
teardown bumps the epoch.** A cleanup queued from inside request handling —
`reset()` called by a recovery path, `onCredentialRenewed()` on C and E — does
not. Were it to bump, a recovery would cancel itself on the very teardown it just
initiated, which is the deadlock's mirror image: not a hang, but a retry that can
never happen. The seam is the same one drawn earlier — caller-initiated versus
initiated from within an admitted request.

Otherwise `recover` re-establishes, the request re-admits, and the retry
proceeds.

**A `recover` is never coalesced with another one.** Kind alone does not make two
recoveries interchangeable: each carries the baseline of *its own* request. Two
of them landing side by side is not exotic — an older request whose baseline is
`e0` stalls before queueing, a caller teardown moves the epoch to `e1` and a
reconnect completes, and a newer request admitted at `e1` also needs recovery.
Joining those two produces one of two wrong answers, depending on which promise
wins: the valid `e1` recovery inherits the stale one's cancellation, or the stale
`e0` request rides the successful `e1` recovery and skips the epoch check that
exists to stop it.

So every `recover` runs its own transition and performs its own baseline check on
its turn. Two adjacent recoveries execute in sequence — the stale one abandoning,
the current one proceeding — and neither learns anything from the other's
outcome.

Rejected: joining on a compound key of `(kind, baseline epoch)`. It is sound,
since equal baselines do decide alike, but it buys one saved re-establishment in
a rare interleaving at the price of a coalescing rule subtle enough that the next
reader has to re-derive this whole paragraph to trust it.

### Why the guard's disconnect half is load-bearing

Reporting the pre-transition
state there would let a request pass the guard and run **concurrently with the
teardown** — against cookies being cleared, or an RFC client being closed
underneath it. That is precisely the overlap between a transition and use of the
resource that serialization exists to forbid, and it would arrive through the
guard rather than through the queue.

Awaiting `connect()` remains the caller's job. Making requests block on an
in-flight transition would reintroduce implicit connect through the back door —
a request that succeeds because it happened to arrive during someone else's
connect is exactly the non-determinism this design removes.

No `connecting`/`disconnecting` states are added. The guard still asks one
question — "is there a usable session right now" — and the table above is its
answer, not a second state machine.

### connect() failure semantics

`markConnected()` is called **only after** a session has actually been
established — the credential accepted and the token/cookies obtained. If
establishment fails, `connect()` **rejects** and the state stays `disconnected`.
There is no third outcome: no "connected but unusable", no resolved promise over
an empty jar.

**Success is not enough on its own: the commit phase also checks the teardown
epoch.** `connect()` captures the epoch when it starts, and before publishing
usability compares it. If a caller requested a teardown while the establishment
was in flight, `markConnected()` is **not** called: `connect()` releases what it
just established — cookies and token cleared, an RFC client closed — and then
rejects with `NOT_CONNECTED`.

Without that check a slow `connect()` running ahead of a queued `disconnect()`
would publish usability *after* the caller asked to stop, and a request could
slip in during the gap before the teardown's turn — breaking the table above,
which promises `isConnected()` is false in every teardown case. It is the same
capture-at-start, check-at-commit shape that recovery already uses, applied to
the other transition that can grant usability; the two were written apart, which
is why only one had it.

**The aborted `connect()` cleans up itself, rather than delegating.** Leaving the
resources for the queued teardown reads reasonable and does not work: the state
stays `disconnected`, and a `disconnect()` in that state skips its work unless a
release is pending — a notion HTTP does not have, so cookies and a token from a
successful establishment would simply stay behind, reported by nothing because
nothing tracks them, and the next `connect()`
would find a jar it did not fill. Locality settles it: whoever created the
resources releases them, and no "cleanup pending" marker has to exist to carry
the obligation across a queue.

If that cleanup's RFC close fails it becomes an ordinary pending release, under
the rules already written for one — retriable, and blocking the next `connect()`
with `RELEASE_PENDING`.

Rejecting rather than resolving keeps `connect()`'s own contract intact: a
resolved promise means there is a usable session. Here there is not, and nothing
is left behind.

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
`observe(newIdentity)` and applies the D1 policy in one readable place. Result
`'replaced'` **and** mode `stateful` is a lost session, so it raises one — the
throw alone is not the whole answer:

```ts
this.lifecycle.beginTeardown({ origin: 'internal', sessionLost: true });
this.lifecycle.transition('cleanup', () => this.cleanupSession());
throw sessionError(ADT_SESSION_ERROR.SESSION_REPLACED);
```

Throwing without the teardown leaves the connector usable **on the new session**
while the old one's lock can no longer be reached through it, and a later
graceful `disconnect()` then spends the whole ceiling waiting on a window
belonging to a session that is gone.

Outside a stateful window the same `'replaced'` is not a loss: nothing was being
held, so the new identity simply becomes the current one and work continues.
That is the transparent recovery D1 keeps.

### The three raisers of a session-lost teardown

Written apart, these drifted apart — each was found separately, in three
consecutive review rounds, after being introduced correctly in one place and
forgotten in the others. They are one rule with three triggers:

| trigger | how it learns |
|---|---|
| credential renewed | `onCredentialRenewed()`, told by the injected auth |
| server says the session is gone | the dead-session classifier, from a response |
| the tracked cookie changed under us, inside a window | `observe()` returning `'replaced'` |

All three do the same two things before anything else — `beginTeardown({ origin:
'internal', sessionLost: true })` and a queued `cleanup` — and only then throw or
return. A fourth trigger, if one appears, joins this list rather than inventing
its own sequence.

**`reset()` now transitions to `disconnected`.** Today it clears cookies and the
token while leaving the connector usable, which is the hole itself. Afterwards a
request fails with `NOT_CONNECTED` until `connect()` is called. The state change
is synchronous; the cleanup behind it is queued and drains first — see "A
synchronous reset() must not tear down under a live request".

**Who may re-establish, precisely.** The rule bans a *silent session swap*, not
every re-establishment:

- A **fresh** request on a disconnected connector always throws
  `NOT_CONNECTED`. The connector never connects on a caller's behalf.
- Inside a **recovery it is already performing** — a bounded, logged reaction to
  a request that has already failed (paths C, D-second-branch, E) — the connector
  may re-establish, and only when the mode is not `stateful`. This is the
  transparent recovery D1 keeps; it is bounded to one in-flight request, and the
  new identity becomes the one `getSessionIdentity()` reports, so a caller that
  captured the old one sees the change rather than being told about it.

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

  // Synchronous: admit nothing further. 'internal' because this teardown comes
  // from inside request handling — bumping the epoch here would cancel the very
  // recovery this hook exists to enable.
  this.lifecycle.beginTeardown({ origin: 'internal', sessionLost: true });

  // Queued: drains first, then clears the OLD session — cookies, CSRF token,
  // transport resources — and marks disconnected. The renewed credential is not
  // touched; it is the one thing that survives. A recovery queues behind this,
  // so it can never re-establish on top of stale transport state.
  this.lifecycle.transition('cleanup', () => this.cleanupSession());

  if (wasStateful) {
    throw sessionError(ADT_SESSION_ERROR.SESSION_REPLACED);
  }
}
```

Both halves are normative, and an earlier draft had only the flag: a hook that
merely marks the lifecycle disconnected leaves the old cookies, token and
transport in place, so the recovery re-establishes over stale state and the
cleanup → recover ordering this design relies on never exists. Marking the state
and clearing what the state described are two different jobs.

The order matters too. `markDisconnected()`, which the queued cleanup performs at
its turn, drops the identity, so a later `connect()` would classify the new
session as `established`, never as `replaced` — comparing identities across a
credential renewal cannot work, and an earlier draft of this spec promised
exactly that. The stateful check therefore
happens **before** the teardown and does not depend on any comparison. State is
still marked disconnected first, so the connector is never left `connected` with
a dead credential, whichever way the throw goes.

Replacement is thus detected by two independent mechanisms, and both are needed:

- **known** — a credential renewal (the code above). No comparison involved.
- **observed** — a tracked session cookie changes value under us, with no
  credential renewal in play (a proxy landing us on another app server, a server
  restart). This is what identity comparison is for.

This removes two special cases instead of adding a third: `JwtAbapConnection`
calls the hook after a successful `tryRefreshToken()` instead of `reset()` — the
public one, whose caller origin would cancel the very recovery it is preparing —
and
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

**On that classification the connector raises a session-lost teardown**, by the
same explicit path as the credential-renewal hook and for the same reason — the
session is gone, so nothing can finish over it:

```ts
this.lifecycle.beginTeardown({ origin: 'internal', sessionLost: true });
this.lifecycle.transition('cleanup', () => this.cleanupSession());
```

"Marks the lifecycle disconnected" is what an earlier draft said, and it no
longer expresses the transition: closing admission at once, dropping the identity
immediately, marking open windows abandoned rather than waiting on them, and
queueing the cleanup are four things, and the flag is one of them.

Dropping the identity immediately matters most here, because a dead session is
the case where comparison is blind: the cookie — and therefore the fingerprint —
is completely unchanged, so nothing downstream could tell. Only the state can,
and it has to say so at once. Anything that needs to know whether a session is
still usable asks the connector, and never infers usability from an unchanged
fingerprint.

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
| **C.** login-form 401 (basic) | `invalidateSession()` → new session, silently | credential renewal → `onCredentialRenewed()`. Outside stateful: the attempt leaves the drain accounting, a `recover` transition re-establishes, the request re-admits and retries; replacement logged. Inside stateful: `SESSION_REPLACED`, no recovery |
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

- **`BatchRecordingConnection`** implements all five. `isConnected()` and
  `getSessionIdentity()` proxy the real connection; `disconnect()` does no work,
  since a batch holds no session, and says so rather than staying silent:
  it resolves with an explicitly empty report —
  `{ abandonedWindows: [], releasePending: false }` — rather than anything
  inherited from the real connection: a recorder abandons nothing because it
  holds nothing.

  `beginWindow()` returns its own `Symbol(label)` that `endWindow()` accepts and
  discards; neither reaches the real connection. This is possible precisely
  because `WindowToken` is a symbol rather than a type only the lifecycle can
  construct. They are **no-ops**, and the reason is that during recording nothing has been sent: a
  "lock window" opened here is a note in a payload, not an ABAP lock. Proxying it
  would open a real window at recording time and hold a teardown hostage for as
  long as the caller keeps assembling the batch — a wait for a lock that does not
  exist yet.

  What the real connection does see is the **batch submission: one request**,
  which the drain already waits for. That alone is not enough, and the reason is
  worth stating because an earlier draft got it wrong: a payload containing both
  `LOCK` and `UNLOCK` is only **syntactically** self-contained. Execution can
  stop in between — an error on an intermediate part, a transport failure, a lost
  response — and then the request settles, the recorder holds nothing, and a real
  server-side lock outlives it unseen. "The UNLOCK is in the payload" is a claim
  about the text we sent, not about what the server did.

  So **every `LOCK` occurrence in the payload gets its own real window** on the
  real connection, opened before sending, labelled with that lock's key and
  holding its own token. One window per submission would be wrong for the same
  reason one token per label was: a payload may carry several pairs, for
  different objects or for the same key locked, unlocked and locked again, and a
  shared window can only be closed too early or reported too little.

  The pairing is fixed at build time, where `buildBatchPayload` already walks the
  parts to validate them: a `LOCK` pairs with the next `UNLOCK` for the same key
  after it, by occurrence rather than by key, so a key locked and unlocked twice
  in one payload stays distinguishable.

  That is only unambiguous if occurrences for one key never overlap. For
  `LOCK A, LOCK A, UNLOCK A, UNLOCK A` the rule as stated maps **both** locks to
  the first `UNLOCK`, and a single confirmed success would close both windows,
  losing the second lock entirely. So overlapping occurrences of one key are
  **rejected at build time**: a `LOCK` for a key whose previous `LOCK` has no
  intervening `UNLOCK` is a build error. `LOCK A, UNLOCK A, LOCK A, UNLOCK A`
  stays valid — nothing overlaps there.

  Rejected: resolving the ambiguity with a consuming FIFO or stack. It would be
  well defined, but it would bless a payload shape the server rejects anyway —
  one session cannot hold two locks on the same object at once — so the error
  belongs at build time, where it names the mistake, rather than at execution,
  where it arrives as a puzzling failure on the second `LOCK` part.

  The recorded pairing is what the response parser resolves against.

  What a window tracks is **"a lock may be held"**, not "an unlock happened" —
  which matters, because there are two different proofs that nothing is held:

  | that pair's `LOCK` | that pair's `UNLOCK` | window |
  |---|---|---|
  | confirmed **failed** | — | **closed** — no lock was ever taken |
  | confirmed succeeded | confirmed succeeded | **closed** — released |
  | confirmed succeeded, or unknown | not confirmed | **open** — it may be held |

  Closing on a confirmed `LOCK` failure is not a relaxation, it is the same rule
  applied honestly. An earlier draft kept the window open for everything except a
  confirmed `UNLOCK`, so a batch whose `LOCK` was rejected outright would stall
  the next teardown for the full ceiling and then report an abandoned lock that
  never existed — noise that trains a reader to ignore exactly the report this
  design exists to produce.

  Uncertainty alone keeps a window open: an error later in the pair, an error
  earlier that stopped execution, a transport failure, a response that cannot be
  parsed. In each of those the `LOCK` may have succeeded, and not knowing is
  treated as held.

  Partial success is therefore ordinary rather than exceptional: two pairs where
  one `UNLOCK` succeeded and the other did not leave exactly one window open, and
  the report names exactly that object.

  A window left open that way behaves like any other dangling lock: it blocks the
  teardown until the ceiling and then arrives named in `TeardownReport`. That is
  the honest outcome — a lock we cannot prove was released is reported, not
  assumed away.

  `buildBatchPayload` therefore throws at build time on two shapes, in the same
  walk that produces the pairing: a `LOCK` occurrence with no matching `UNLOCK`,
  and a second `LOCK` for a key whose previous one is still unclosed. That check keeps its value — it catches the
  design error of locking across batches — but it is a check on the payload, and
  the bracket above is what covers execution.
- **`AdtClient`** gains an early check. Calling `connect()` stays the consumer's
  job — the library does not own the connection and must not connect on its
  behalf. But a missing connect would otherwise surface mid-chain, after
  `validate` and `create`, once the object already exists. Checking
  `connection.isConnected()` before the first `IAdtObject` operation turns
  "object created, then an error" into "nothing happened".
- **`LockRegistry`** passes its lock key as the window label, so an abandoned
  window arrives back named (`Class/ZCL_FOO`) rather than counted, and stores the
  returned `WindowToken` next to the lock handle and the fingerprint at `lock()`.
  The token is what `endWindow()` needs — the key alone would not do, since two
  flows locking the same object share a key but hold different windows.
  Before unlocking it checks only what it can know better than the connection:

  ```
  skip UNLOCK  iff  identity !== captured identity
                    OR the error in hand is SESSION_REPLACED / NOT_CONNECTED
  otherwise    attempt it and let the connection's admission guard decide
  ```

  **`isConnected()` is deliberately not part of this.** An earlier draft gated the
  unlock on it, which breaks the case the window rule exists for: during a pending
  teardown `isConnected()` is normatively `false` while an open window's requests
  are still admitted, so the registry would refuse to send the very UNLOCK the
  teardown is waiting for, the window would run to the ceiling, and the teardown
  would manufacture the orphan it was trying to avoid. It is the same shape as the
  deadlock that made the teardown refuse the chain's own unlock — a rule blocking
  the finishing request that would let it finish.

  The property that gate was protecting is kept, and by a better route: on a dead
  session the connector has already marked itself unusable, so the attempt is
  refused there. Nothing goes on the wire, the refusal comes back as an error, and
  the lock is returned in `LockFailure[]` (the structure already exists) with
  "session lost, lock left on the server". Asking the connection is stronger than
  guessing from a flag, and it is the connection's question to answer.
  `unlockAll()` stops producing noise and starts telling the truth.
- **Operation chains close their window on evidence, not in a `finally`.** The
  rule the batch path spells out is not a batch peculiarity — it is what a window
  means, so an ordinary chain follows it too:

  | that chain's `LOCK` | its `UNLOCK` | window |
  |---|---|---|
  | confirmed failed | — | `endWindow(token)` — nothing was taken |
  | confirmed succeeded | confirmed succeeded | `endWindow(token)` — released |
  | succeeded, or unknown | failed, not sent, or unknown | **left open** |

  The third row is every path where the chain skips its unlock — a
  `SESSION_REPLACED` or `NOT_CONNECTED` in hand — and every path where the unlock
  went out and did not come back. Those are exactly the cases a `finally` would
  close, and exactly the cases where the lock is most likely still held. When
  `unlockAll()` later releases such a lock for real, it closes the window then.

- **Operation chains** decide from the **error in hand**, not from a comparison.
  If the failure that entered the catch block carries `code === SESSION_REPLACED`
  or `code === NOT_CONNECTED`, the unlock is skipped unconditionally and the lock
  is left in the registry's `pendingLocks`, so `unlockAll()` returns it as a
  `LockFailure` rather than the chain swallowing it. Only for any other failure does the chain fall
  through to the `LockRegistry` precondition above. Inferring "the session is
  probably fine" from an unchanged fingerprint is exactly the mistake this rule
  exists to prevent. Today those catch blocks attempt an unconditional unlock.

## Testing

| level | covers | SAP |
|---|---|---|
| `SessionLifecycle` | states, idempotence, `observe()` classification, **the additive rule**, **serialization: tail-only joining, opposite calls queue and re-evaluate**, **admit/drain accounting** | not needed |
| connector | the `NOT_CONNECTED` guard; `reset()` → `disconnected`; **the fingerprint ignores `sap-XSRF_*`**; **a LOCK adding a second identifier does not throw**; **credential renewal under `stateful` throws before teardown**; **a failing `connect()` rejects and leaves `isConnected() === false`**; **`disconnect()` never throws, including when the RFC close fails — and a repeat call retries that failed close instead of being a no-op**; **a failed close retains the client, and `connect()` neither overwrites it nor proceeds past it: it retries the release and rejects with `RELEASE_PENDING` if that fails**; all five recovery paths; no internal retry on `SESSION_REPLACED` | not needed |
| adt-clients | the two shields flipped; `LockRegistry` sends no unlock into a replaced session; **no unlock into a DEAD session either, where the fingerprint is unchanged**; **batch: recorder window calls stay local, a payload with an unmatched `LOCK` throws at build time, and a submission carrying a `LOCK` keeps a real window open unless the response proves the `UNLOCK` ran** | not needed |

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
5. **A reconnect never orphans a pending RFC client.** With a close forced to
   fail, `connect()` must not assign over the retained client: it retries the
   release, and rejects with `RELEASE_PENDING` when that retry fails. Get this
   wrong and an open ABAP session holding enqueue locks becomes unreachable —
   silently, and with no way back through the contract. Testable with a fake RFC
   client whose `close()` rejects; no SAP and no RFC SDK involved.
6. **Races open exactly one client.** Two `connect()` calls started without
   awaiting the first must produce **one** establishment, both resolving from it;
   and a `connect()` started while a slow `disconnect()` is still closing must run
   strictly after it and re-evaluate the pending release then, not before waiting.
   Without serialization the pending-slot rule holds only for sequential calls,
   which is the easy half of the problem. Testable with a fake client whose
   `open()`/`close()` resolve on a deferred the test controls.
7. **A request during a slow `disconnect()` gets `NOT_CONNECTED`** — with **no
   lock window open** when the teardown was requested. With the teardown held on
   a deferred, a request issued mid-teardown must be refused rather than run
   against cookies being cleared or a client being closed. This is the one guard
   answer that cannot be derived from the pre-transition state. Pair it with test
   16, which is the same situation with a window open and the opposite required
   answer; an implementation with a global refusal passes this one and deadlocks
   there.
8. **`connect()` → `disconnect()` → `connect()` resolves in order.** The second
   `connect()` must not join the first and overtake the queued `disconnect()`.
   Assert the observable consequence, not the internals: when the last
   `connect()` resolves, `isConnected()` is `true` — never a resolved connect
   whose session the queue then destroys.
9. **A slow request that started first is drained, not cut.** Mirror of test 7:
   the request is admitted, then `disconnect()` is called. The teardown must not
   release the resource until that request settles, and the request must complete
   normally rather than fail. Assert the order — request settles, then the
   release happens — rather than timing. Without this, refusing new requests only
   narrows the window instead of closing it.
10. **`reset()` under a live request queues its cleanup instead of running it.**
    Admit a slow request, call `reset()`, then `connect()`. Assert the order: the
    request settles, then the cleanup runs, then the establishment. The request
    must complete normally, and `reset()` itself must return without awaiting
    anything — an implementation that awaits the drain here deadlocks against its
    own caller, since `reset()` is invoked from inside request handling.
11. **Path E completes rather than deadlocking.** Drive the real recovery, not an
    external `reset()`: a JWT connection outside a stateful window, a 401 on a
    request, a refresher that succeeds. The request must re-establish and retry to
    completion. An implementation that keeps the failed attempt in the drain
    accounting hangs here forever — the cleanup waits for the request, the request
    waits for its re-establishment, the re-establishment waits behind the cleanup.
    Give the test a hard timeout so the failure reads as a deadlock rather than a
    slow test.
12. **A caller's `disconnect()` beats a recovery it queued behind.** Same setup,
    but `disconnect()` is called **after** the recovery is already queued — the
    order FIFO cannot resolve on its own. The recovery must still abandon: no
    re-establishment, the request fails. An implementation that asks "has a
    teardown run?" passes a weaker test and fails this one, because at the
    recovery's turn that teardown is still sitting behind it in the queue.
13. **An internal cleanup does not cancel its own recovery, and runs before it.**
    Path E again, with no caller teardown anywhere. The recovery must complete —
    and the re-establishment must observe a cleared jar, proving the queued
    cleanup ran first. An implementation whose hook only flips the lifecycle flag
    re-establishes over the old cookies and token, which no assertion on the
    final result would catch. An implementation
    that bumps the epoch from an internally-initiated cleanup cancels the retry it
    just set up — the mirror of the deadlock, silent instead of hanging.
14. **A teardown between the failure and the queueing still cancels.** Mirror of
    test 12 on the other side: `disconnect()` is called after the recovery has
    begun but **before** `recover` reaches the queue. An implementation that
    captures the baseline at queueing time compares the new epoch against itself,
    sees no change, and re-establishes — passing tests 12 and 13 while still
    resurrecting a session the caller closed. Only a baseline taken at admission
    fails this test when it is wrong.
15. **Two adjacent recoveries with different baselines decide independently.** An
    older request holding baseline `e0`, a caller teardown moving the epoch to
    `e1` with a reconnect completing, then a newer request admitted at `e1` that
    also needs recovery — both recoveries queued back to back. The stale one must
    abandon and the current one must proceed. Coalesce them by kind and one
    inherits the other's answer, so assert **both** outcomes in the same test: an
    implementation that joins gets one of them right by luck.
16. **`disconnect()` in the gap between PUT and UNLOCK waits for the window, and
    lets the UNLOCK through.** Run a lock chain, let the PUT settle, and call
    `disconnect()` while the session is still stateful and nothing is in flight.
    The UNLOCK must be **admitted** and go out on a live session; only then may
    the teardown release. Two implementations fail here for opposite reasons: a
    request-counting drain tears down immediately (the count is legitimately
    zero), and a global refusal blocks the UNLOCK it is waiting for and sits out
    the ceiling. Assert that the UNLOCK actually reached the server, not merely
    that `disconnect()` returned.

17. **A window that never closes is abandoned, and named.** Same setup, but the
    UNLOCK never comes. With the ceiling shortened for the test, `disconnect()`
    must complete rather than hang, and its `TeardownReport.abandonedWindows`
    must contain the **label** the chain passed to `beginWindow()`. Asserting
    only "it completed" would pass on an implementation that logs a count, which
    is the silent orphan this design exists to prevent.
18. **A second handler cannot take a lock during a pending teardown.** With one
    window open and `disconnect()` requested, a *different* handler calls
    `beginWindow()` before the first chain unlocks. It must get `NOT_CONNECTED`.
    This is the case a closing-edge rule cannot catch: the second window opens
    while the mode is already stateful, so it produces no edge, and the teardown
    would later abandon a lock it never saw — a fresh orphan created by the
    cleanup itself.
19. **Two windows with the same label close independently.** Open two windows
    under one label — the same object taken by two flows — and close only the
    first. The drain must NOT complete: one window is still open. Then close the
    second and it completes. An implementation keyed on labels retires the shared
    entry on the first close and tears down under a live operation; one keyed on
    tokens cannot.
20. **An unknown or already-used token is ignored, not obeyed.** Close a window
    twice, and close one with a token from another connection. Neither may
    reduce the open set — the second close of a window that was already retired
    must not retire a *different* window that happens to be open, which is what
    a bare counter would do.
21. **A batch that dies between LOCK and UNLOCK leaves its window open.** Submit
    a payload containing both, and have the stub fail an intermediate part so the
    `UNLOCK` never executes. The request settles — with an error — and the window
    must still be open, so a teardown reports the lock by name instead of passing
    over it. Pair it with the success case, where a confirmed `UNLOCK` closes the
    window: an implementation that closes on "request settled" passes that one
    and fails this one.
22. **Partial success in a multi-pair batch closes only what was confirmed.** Two
    `LOCK`/`UNLOCK` pairs over different objects, with one `UNLOCK` succeeding and
    the other failing. Exactly one window closes, and the report names the other
    object and only it. Repeat with the same key locked, unlocked and locked
    again in one payload, confirming only the first `UNLOCK`: pairing by key
    rather than by occurrence closes the wrong window here and still leaves the
    open set the right size, so assert which label remains, never how many.
23. **A confirmed `LOCK` failure closes the window.** A payload whose `LOCK` the
    stub rejects outright. The window must close on the parsed response, not
    linger: no lock was taken, so a teardown must neither wait out the ceiling
    nor name an object that was never locked. An implementation keyed on "did the
    UNLOCK succeed" reports a lock that does not exist — and a report that cries
    wolf is worth less than no report.
24. **Overlapping locks on one key are rejected at build time.**
    `LOCK A, LOCK A, UNLOCK A, UNLOCK A` must throw from `buildBatchPayload`.
    The pairing rule cannot express it — both locks would claim the first
    `UNLOCK`, one confirmed success would close both windows, and the second lock
    would vanish from the accounting. Note that test 22's `LOCK A, UNLOCK A,
    LOCK A, UNLOCK A` is the shape where the ambiguity does *not* arise, so it
    passes on an implementation that has this bug: the two cases must both be
    present.
25. **No request slips through at the expiry edge.** With a window held open and
    the ceiling shortened, issue a request at the moment the ceiling runs out: it
    must be refused. And a request admitted just BEFORE expiry must settle before
    the release happens — assert that order, not timing. An implementation that
    resolves `drain()` first and closes the gate afterwards passes every other
    test and loses here, because the gap is only a few microseconds wide and
    exists on every run.
26. **A steady stream of requests cannot postpone expiry.** An orphaned window
    plus a loop issuing short requests for longer than the shortened ceiling.
    `disconnect()` must still complete at roughly the deadline and report the
    window. A deadline measured from the last settled request never fires here —
    and this is the shape it fails on: a busy consumer, which is the case the
    bound exists for.
27. **A `disconnect()` during a slow `connect()` is never overtaken, and leaves
    nothing behind.** Start a
    `connect()` held on a deferred, call `disconnect()` while it is establishing,
    then let the establishment succeed. `isConnected()` must never once be true,
    a request issued right after the establishment must be refused, and
    `connect()` must reject. Poll the flag across the whole sequence rather than
    checking it at the end: the defect is a gap that opens and closes on its own,
    so a single observation afterwards misses it. Then assert the **state**, not
    only the flag: no cookies, no token, and for RFC a closed client. An
    implementation that merely skips `markConnected()` passes every observable
    check here while leaving a live session behind it.
28. **A caller's `disconnect()` after an internal teardown still gets its own
    report.** Trigger a credential renewal — which queues a `cleanup` — with an
    orphaned window open and, separately, with a failing RFC close, then call
    `disconnect()` immediately. It must run its own teardown and resolve with a
    report naming the abandoned window and flagging `releasePending`. An
    implementation that lets the caller join the queued cleanup skips that
    execution and resolves with nothing, losing both facts — and so does one that
    treats "already disconnected, nothing to do" as licence to skip the report. Assert also that the
    second teardown does not wait out another full ceiling for a window already
    abandoned.
29. **A failed `UNLOCK` outside a batch leaves the window open.** An ordinary
    chain whose unlock returns an error, and a variant where it never goes out at
    all. The window must remain open in both, so the next teardown names the
    lock. A `finally` passes every happy-path test and fails these two — and it
    is the shape most implementations reach for first.
30. **`unlockAll()` can still unlock during a pending teardown.** The registry
    holds a lock, a window is open, `disconnect()` is requested, and
    `unlockAll()` runs. The UNLOCK must reach the server and the window must
    close, letting the teardown proceed. A registry gated on `isConnected()`
    skips it — the flag is false throughout a pending teardown — and the window
    then runs to the ceiling, so the teardown produces the very orphan it was
    called to avoid. This is test 16 seen from the registry's side.
31. **After a credential renewal, `unlockAll()` sends nothing.** Renew the
    credential inside a stateful window, then call `unlockAll()` from a flow that
    has no error in hand. It must send no `UNLOCK` and return the lock as a
    `LockFailure`. An implementation that drops the identity only in the queued
    cleanup lets this call see an unchanged fingerprint and unlock over the
    replaced session — the internal retry, arriving through the one door with no
    failure to warn it. Pair with test 30, which requires the opposite answer for
    a graceful teardown: an implementation with a single teardown kind cannot
    pass both.
32. **A dead-session response abandons the open window immediately.** With a
    window open, have the server answer a request with the dead-session shape.
    The window must be marked abandoned there and then, and the next
    `disconnect()` must return its label **without waiting out the ceiling** —
    there is nothing that could close it. An implementation that only flips the
    lifecycle flag here waits the full ceiling first, and one that also leaves
    the identity in place lets a later `unlockAll()` unlock over the dead
    session.
33. **A changed authoritative cookie inside a window abandons it at once.** With
    a window open, have the server rotate `SAP_SESSIONID_*` mid-flight. The
    request must fail with `SESSION_REPLACED`, the window must be abandoned
    immediately, and the next `disconnect()` must return its label without
    waiting out the ceiling. An implementation that only throws leaves the
    connector usable on the new session and makes that `disconnect()` wait the
    full ceiling on a window whose session no longer exists.
34. **An external `reset()` cancels a queued recovery.** Admit a request, let it
    enter recovery so a `recover` is queued, then call `reset()` from outside.
    The recovery must abandon: no re-establishment, the request fails. An
    implementation that routes the public `reset()` through the internal origin
    lets that recovery finish and hands the caller back the session they just
    discarded. Pair with test 13, which requires the opposite for the internal
    path — the two entry points exist precisely because one answer cannot serve
    both.


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

- **interfaces** — BREAKING: five required methods break every implementor
  (`disconnect`, `isConnected`, `getSessionIdentity`, `beginWindow`,
  `endWindow`). The last two are the critical-section pair the connector has
  carried since 1.9.0, promoted into the contract and made mandatory.
- **connection** — BREAKING, on three counts: implicit connect disappears;
  requests are refused after `disconnect()`/`reset()`; and `connect()` now
  rejects on failure where `BaseAbapConnection` used to log a warning and resolve
  anyway.
- **adt-clients** — needs both new versions. Its own API barely changes, but two
  things propagate to its consumers and belong at the top of the CHANGELOG rather
  than among the details: the "connect() first" requirement, and the fact that
  every chain now brackets its lock window with `beginWindow()`/`endWindow()`.
  That bracketing is mechanical — it goes at the call sites that already toggle
  `setSessionType` — but it is not optional: a chain that skips it takes locks a
  pending teardown cannot see.

**Rollout risks to name, both intended and both belonging at the top of the
connection CHANGELOG rather than among the details:**

- consumers relying on implicit connect break at their first request;
- a `connect()` that used to resolve through a broken connection now rejects, so
  a consumer that never checked its result will start failing at startup instead
  of at the first request. That is the better failure, but it is a new one.
