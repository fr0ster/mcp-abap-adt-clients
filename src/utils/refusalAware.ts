/**
 * One place where a refusal from SAP stops being mistaken for an answer.
 *
 * **The status code is the channel; the response is the result.** A 200 says the
 * request reached the server and came back — nothing more. What the server
 * decided is in the body, and ADT answers some refusals with a 2xx carrying an
 * `<exc:exception>` document. The transport is right to admit it, so nothing
 * below throws, and everything above treats that body as a result.
 *
 * Measured before this existed, with a connection answering 200 and
 * "Object ZNOPE is locked by user XYZ" to every request:
 *
 * | call | `state.errors` | what the caller was told |
 * |---|---|---|
 * | `getClass().create()` | 0 | the class was created |
 * | `getClass().delete()` | 0 | the class was deleted |
 * | `getClass().activate()` | 0 | the class was activated |
 * | `getDomain().create()` | 0 | the domain was created |
 * | `getClass().read()` | 0 | it was read |
 *
 * Five of seven probed chains reported success on a refusal, and three of those
 * are writes: a caller believed an object existed that did not, and that one had
 * been deleted that had not. The refusal sat in `state.createResult.data` the
 * whole time — but nothing said to look, and a successful call is not read
 * twice. The two that did throw invented their own reason ("may be locked by
 * another user") and never showed the caller `XYZ`, which is the part worth
 * having.
 *
 * **Why here and not at the call sites.** 466 direct `makeAdtRequest` calls
 * across 300 files, and 241 places that assign a response into a state object —
 * none of which looked at the body. A rule applied in 241 places has 241 chances
 * to be forgotten, and the next member written would be the 242nd.
 *
 * **What it does not do.** It does not judge documents, which this library
 * leaves to the server. It raises only on `<exc:exception>` — the server's own
 * statement that it refused — and passes everything else through untouched,
 * including an empty body, which is a faithful "nothing" rather than an error.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces';
import { adtExceptionIn } from './adtException';

/** Connections already carrying the check. */
const installed = new WeakSet<IAbapConnection>();

/**
 * Install the check on a connection, once.
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
export function withRefusalDetection(
  connection: IAbapConnection,
): IAbapConnection {
  // A connection that cannot issue a request has no answer to inspect. Some
  // members compute a URI and never call out, and they are exercised with a
  // connection that offers nothing else — wrapping that would fail at
  // construction over a method the caller was never going to use.
  if (
    installed.has(connection) ||
    typeof connection?.makeAdtRequest !== 'function'
  ) {
    return connection;
  }
  installed.add(connection);

  const base = connection.makeAdtRequest.bind(connection);

  connection.makeAdtRequest = async function makeAdtRequestRefusalAware<
    T = unknown,
    D = unknown,
  >(request: IAbapRequestOptions): Promise<IAdtResponse<T, D>> {
    const response = await base<T, D>(request);

    // A status the transport rejected never reaches here — it threw, carrying
    // the response. What arrives is a request the channel considers finished,
    // and only the body says what the server decided about it.
    const body = (response as IAdtResponse).data;
    if (typeof body === 'string') {
      const refusal = adtExceptionIn(body);
      if (refusal) {
        throw refusal;
      }
    }

    return response;
  };

  return connection;
}
