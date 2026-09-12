/**
 * Which call it was — the part a failure loses on the way up.
 *
 * `IAdtError.request` exists so a caller can locate a refusal: `delete()` sends
 * two requests and `create()` six, and "object is locked" means a different
 * thing depending on which of them asked.
 *
 * It arrives on its own two ways. A request that throws carries its own config,
 * and `recogniseFailure` reads it. A document `sapErrorIn` recognises becomes an
 * `AdtSAPError` built with the request beside it. What was left out is the third
 * way a refusal reaches a caller: an answer of `200 OK` whose verdict is in a
 * document nobody classifies as an exception — an activation checklist, a
 * deletion check, a publication's `<SEVERITY>` — read by a shipped `analyse`
 * instead. Those reach their strategy with the URL already gone, because the
 * connection normalises a successful answer down to four fields:
 *
 * ```
 * keys:     status, statusText, headers, data      // a 200, measured
 * config?   NONE
 * request?  NONE
 * ```
 *
 * So `withRequestTrace` below — which wraps every connection the clients are
 * given — attaches it on the way back, and this is where the vocabulary for
 * reading it lives.
 *
 * **A stand-in, deliberately.** `IAdtWireResponse.request` is already in the
 * contract, typed `unknown` and populated by nobody. Its resting place is the
 * connection filling it and the contract typing it; until then it is filled
 * here, where real traffic can be run against it.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';

/** Enough to say which call, and nothing more. Matches `IAdtError.request`. */
export interface IAdtRequestTrace {
  readonly method?: string;
  readonly url?: string;
}

/**
 * Read the trace back off an answer, for an `analyse` building a failure.
 *
 * Answers `undefined` rather than an empty object when there is nothing to
 * report — an answer from a connection no client wrapped, most often a handler
 * constructed directly rather than through `AdtClient` — so a failure carries
 * the field only when it means something.
 */
export function requestOf(
  answer?: IAdtWireResponse,
): IAdtRequestTrace | undefined {
  const carried = answer?.request as IAdtRequestTrace | undefined;
  if (!carried || (!carried.url && !carried.method)) return undefined;
  return { method: carried.method, url: carried.url };
}

/** Connections already carrying the trace. */
const traced = new WeakSet<IAbapConnection>();

/**
 * Put the request back on the answer.
 *
 * The connection normalises a successful answer down to `status`, `statusText`,
 * `headers` and `data`, dropping `config` and `request`. This is the last place
 * that information exists, so a failure built further up can say which call it
 * was. It reads nothing and decides nothing: what a body means is the caller's,
 * through their own `analyse`.
 *
 * Replaces `makeAdtRequest` and calls the method captured at install time, which
 * is how `installAcceptNegotiation` in `./acceptNegotiation` already works —
 * deliberately the same shape, because the two must compose in either order.
 *
 * A `Proxy` was tried first and is wrong here: accept-negotiation keys a
 * `WeakMap` by the connection object to remember the original method, and a
 * proxy is a different object from its target. The negotiation wrapper then
 * resolved `connection.makeAdtRequest` back through the proxy and the two called
 * each other until the stack ran out. Preserving the object's identity is not a
 * detail — another wrapper depends on it.
 */
export function withRequestTrace(connection: IAbapConnection): IAbapConnection {
  // A connection that cannot issue a request has no answer to annotate. Some
  // members compute a URI and never call out, and they are exercised with a
  // connection that offers nothing else — wrapping that would fail at
  // construction over a method the caller was never going to use.
  if (
    traced.has(connection) ||
    typeof connection?.makeAdtRequest !== 'function'
  ) {
    return connection;
  }
  traced.add(connection);

  const base = connection.makeAdtRequest.bind(connection);

  connection.makeAdtRequest = async function makeAdtRequestTraced<
    T = unknown,
    D = unknown,
  >(request: IAbapRequestOptions): Promise<IAdtWireResponse<T, D>> {
    const asked = { method: request?.method, url: request?.url };

    let response: IAdtWireResponse<T, D>;
    try {
      response = await base<T, D>(request);
    } catch (error: unknown) {
      // The path a refusal most often takes. `recogniseFailure` reads `request`
      // off whatever was thrown, and what the transport puts there is its own
      // native request object, not the two fields the contract asks for — so a
      // status the server refused was the one failure a caller could not locate
      // in a chain of six. Written onto the error rather than composed into a
      // new one: replacing it would discard the response riding alongside.
      //
      // No check that the thrown thing can carry a field. A transport that
      // throws a string is broken in a way this wrapper must not paper over,
      // and the TypeError says so where a silent skip would not.
      (error as { request?: unknown }).request = asked;
      throw error;
    }

    // A new object rather than a field written onto the connection's own: the
    // method is wrapped carefully above, and writing into the value it returns
    // would give that care away.
    return { ...response, request: asked };
  };

  return connection;
}
