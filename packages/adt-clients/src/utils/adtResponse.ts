/**
 * The shipped default strategies, and the composition that runs them.
 *
 * Decision 19 in `@mcp-abap-adt/interfaces` describes two strategies over one
 * answer — one deciding whether it is a failure at all, one deciding what a
 * non-failure becomes — and a fixed order for asking them. This is that rule,
 * with the defaults this library ships behind each half.
 *
 * **The order is fixed.** The failure question is answered first, because a
 * result strategy must not be asked to make a value out of a refusal.
 *
 * **The error strategy describes the server.** Since `interfaces@31.0.0` an
 * origin is `'connection'` or `'refusal'`: what SAP said, or the absence of an
 * answer. A document *this library* cannot read is not a server failure and is
 * not described by that contract — it throws, and the caller sees an exception
 * from a library that could not do its job rather than a verdict about SAP.
 *
 * **A verdict of "fine" is named.** `analyse` answers `ADT_NO_FAILURE`, not
 * `undefined`: the option is optional, so `undefined` already means "there is no
 * strategy here", and one value cannot also mean "this answer is fine".
 *
 * **Failures come back, they do not fly past.** A member answers `IAdtFailure`
 * where it used to throw, because `getError()` on the contract is what makes
 * handling visible to the compiler. The connection layer still throws for a
 * status the transport refuses; that is caught here and turned into the answer.
 */

import type {
  AdtNoFailure,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtSAPError } from './adtErrors';

/**
 * An answer that succeeded, carrying the value a result strategy made.
 *
 * One method, not two. Since `interfaces@31.0.0` a success declares no
 * `getError` and a failure no `getResult`, so reaching either requires narrowing
 * on `ok` first — a forgotten check is a type error rather than an `undefined`
 * that reads like an empty answer.
 */
export function succeeded<T, E extends IAdtError = IAdtError>(
  value: T,
): IAdtResponse<T, E> {
  return {
    ok: true,
    getResult: () => ({ value }),
  };
}

/** An answer that failed, carrying what the error strategy made of it. */
export function failed<T, E extends IAdtError = IAdtError>(
  error: E,
): IAdtResponse<T, E> {
  return {
    ok: false,
    getError: () => error,
  };
}

/** What the transport attaches to a status it refused. */
interface IWithResponse {
  response?: IAdtWireResponse;
  message?: string;
  request?: { method?: string; url?: string };
}

/**
 * A refusal of the credential, as `@mcp-abap-adt/connection` raises it
 * (`AuthRefusedError`): an own `refusal` object naming its `kind` and `reason`,
 * an own `at` naming the moment, the wire's error — or the provider's throw — as
 * `cause`.
 *
 * Recognised by shape, not by `instanceof`: this package does not depend on the
 * connection, and a consumer may carry another copy of it. The shape is a
 * passthrough convention, not proof that the refusal was minted: anything that
 * carries it is passed on as it came, which is all this library does with it.
 * Only own data properties are read, so a getter is never run. A value with a
 * `response` of its own is a transport failure first and is not one of these.
 */
interface ICredentialRefusal {
  /** The response SAP refused the credential with, when SAP was asked. */
  readonly answered?: IWithResponse;
}

function ownValue(holder: unknown, key: string): unknown {
  if (holder === null || typeof holder !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(holder, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function credentialRefusal(error: unknown): ICredentialRefusal | undefined {
  if (ownValue(error, 'response') !== undefined) return undefined;
  const refusal = ownValue(error, 'refusal');
  if (
    typeof ownValue(refusal, 'kind') !== 'string' ||
    typeof ownValue(refusal, 'reason') !== 'string' ||
    typeof ownValue(error, 'at') !== 'string'
  ) {
    return undefined;
  }
  // One level down, and only there: the connection puts the wire's error as
  // the cause when SAP refused the credential, and the provider's own throw
  // when it never got that far. Only a 401 is SAP refusing the credential: a
  // provider's throw may carry a response of its own — an identity provider's
  // 400 invalid_grant — and that is not SAP answering.
  const cause = ownValue(error, 'cause');
  const response = ownValue(cause, 'response');
  if (ownValue(response, 'status') !== 401) return {};
  return {
    answered: {
      response: response as IAdtWireResponse,
      request: ownValue(cause, 'request') as IWithResponse['request'],
    },
  };
}

/**
 * Whether `error` is a credential refusal SAP was never asked about: the
 * connection's refusal with no `401` from SAP as its cause.
 *
 * Module-internal (not in the package's index). Every place in this library
 * that catches what a request threw asks this first, after its own cleanup, and
 * rethrows such a refusal as the same object — never converted, wrapped or
 * swallowed — so a caller walking many objects sees it and stops.
 */
export function isUnansweredCredentialRefusal(error: unknown): boolean {
  const refused = credentialRefusal(error);
  return refused !== undefined && refused.answered === undefined;
}

/**
 * The default error strategy: what this library recognises as a failure.
 *
 * Origin is not decoration — the two have different remedies, and a caller
 * cannot act on "something went wrong". A refusal is answered by asking the
 * server something else; a connection failure by authenticating or restoring
 * reachability.
 *
 * **An `AdtParseError` is not recognised here, and that is deliberate.** A
 * document this library could not read is its own failure, not the server's, and
 * `interfaces@31.0.0` removed `'parse'` from `AdtFailureOrigin` for that reason:
 * a strategy is free to read an answer any way it likes, or not to parse at all.
 * Thrown by a reading, it is not caught by {@link answering} and surfaces as
 * itself; thrown inside the request, it falls through to `'connection'` like
 * anything else from below.
 */
export function recogniseFailure(error: unknown): IAdtError {
  if (error instanceof AdtSAPError) {
    return {
      origin: 'refusal',
      message: error.message,
      adtType: error.adtType,
      namespace: error.namespace,
      response: error.response,
      request: error.request,
    };
  }

  // SAP refused the credential and the provider could not renew it: SAP's
  // answer, carried by the connection as the refusal's cause, is the failure,
  // in the refusal's own words.
  const answered = credentialRefusal(error)?.answered;
  if (answered) {
    return {
      origin: 'connection',
      message: (error as IWithResponse).message ?? 'The credential was refused',
      response: answered.response,
      request: answered.request,
    };
  }

  // Everything else reached us from below the ADT conversation: a status the
  // transport refused, a socket that would not open, a session that is gone.
  const carried = error as IWithResponse;
  return {
    origin: 'connection',
    message:
      carried?.message ??
      (typeof error === 'string' ? error : 'The request did not complete'),
    response: carried?.response,
    // The request, when whatever threw attached one. Omitting it here left the
    // most common failure — a status the transport refused — as the one a
    // caller could not locate in a chain of six.
    request: carried?.request,
  };
}

/**
 * The failure strategy that never finds one.
 *
 * Every exchange that produced an answer comes back as a success carrying that
 * answer, refusals included, so a caller can read the body themselves — a 403
 * with an exception document is the document, not an `IAdtError` with the
 * document buried a field down.
 *
 * This package ships no reading that turns such a body into a verdict. Which
 * documents count as a refusal depends on the system and on what the caller is
 * about to do, so the decision is theirs and this is how they take all of it.
 *
 * `answering` still fails a request that returned nothing at all. There is no
 * answer to read, and a success built from none would be a lie the type cannot
 * catch.
 */
export const nothingIsARefusal: IAnalyse<IAdtError> = () => ADT_NO_FAILURE;

/**
 * Run one request and compose the two strategies over its answer.
 *
 * The three arguments are the three things involved and nothing else: the
 * request, the reading, and the caller's own verdict.
 *
 * | what happened | wire in hand | default verdict | `analyse` may clear it | result |
 * |---|---|---|---|---|
 * | returned | yes | none | — | the value, or a failure if `analyse` names one |
 * | threw, response attached | yes | `recogniseFailure` | **yes** | cleared → the value read from that same wire |
 * | threw, no response | **no** | `recogniseFailure` | **no** | always a failure |
 * | credential refused, SAP answered `401` | **no** | `recogniseFailure`, SAP's response | **no** | always a failure |
 * | credential refused, SAP not asked | — | — | — | **rejects** with the refusal as it came |
 *
 * SAP answered only when the refusal's cause carries a response of status
 * `401` (`cause.response.status`, one level down). Any other status there — an
 * identity provider's `400 invalid_grant` a provider threw — is the provider's,
 * not SAP's, and the refusal rejects.
 *
 * **A credential refusal SAP never saw is not an answer.** The connection
 * raises one when the credential provider says no before the request reaches
 * SAP — a login that ended, a token the identity provider will not renew.
 * There is nothing to read and nothing to analyse, and every further request
 * would ask the provider again, so it rejects with the same object instead of
 * coming back as a failure. A credential SAP refused (a `401` the provider
 * could not renew) is SAP's answer: it comes back as a failure carrying that
 * response, and, the response being SAP's verdict on the credential and not a
 * document, `analyse` cannot clear it.
 *
 * **A verdict can only be cleared when there is an answer to read.** A socket
 * that would not open, a session that is gone, an authentication that failed —
 * none carries an answer, so there is nothing for the result strategy to read
 * and no honest success to build. `analyse` is still consulted, for the record,
 * but its `ADT_NO_FAILURE` cannot turn "nothing came back" into a value.
 *
 * **The reading runs outside the classification.** An exception from `read` is
 * not caught: `recogniseFailure` would call it a connection failure, which tells
 * a caller to reauthenticate over a defect in a parser — advice pointing at the
 * wrong system entirely. A document this library cannot read is its own failure
 * and surfaces as itself.
 */
export async function answering<T, E extends IAdtError = IAdtError>(
  run: () => Promise<IAdtWireResponse>,
  read: IResultStrategy<T>,
  analyse?: IAnalyse<E>,
): Promise<IAdtResponse<T, E>> {
  let wire: IAdtWireResponse | undefined;
  let verdict: IAdtError | AdtNoFailure = ADT_NO_FAILURE;

  try {
    wire = await run();
  } catch (error: unknown) {
    // The provider refused before SAP said anything: no answer exists to come
    // back, and every further request would only ask the provider again. It is
    // thrown as it came — the same object, before any strategy sees it.
    if (isUnansweredCredentialRefusal(error)) throw error;
    verdict = recogniseFailure(error);
    wire = (error as IWithResponse)?.response;
  }

  // Two casts below, and one reason for both: `E` is only ever given a value by
  // the `analyse` argument. Where the code falls back to the library's own
  // verdict — no strategy was supplied, or nothing came back for one to read —
  // `E` is its default `IAdtError`, which is what that verdict already is. The
  // compiler cannot see that from inside the body; a caller never sees either.
  if (analyse) {
    const overruled = analyse(verdict, wire);
    if (overruled !== ADT_NO_FAILURE) {
      return failed<T, E>(overruled);
    }
  } else if (verdict !== ADT_NO_FAILURE) {
    return failed<T, E>(verdict as E);
  }

  if (!wire) {
    // Cleared, but nothing came back. Enforced here rather than left to the
    // caller: a success built from no answer would be a lie the type cannot
    // catch, so the original verdict stands. A strategy that adds fields has
    // none to add about a request that never arrived.
    return failed<T, E>(
      (verdict === ADT_NO_FAILURE
        ? {
            origin: 'connection',
            message: 'The request did not complete, and carried no answer',
          }
        : verdict) as E,
    );
  }

  // Outside any catch, on purpose. The reading's own exception is the reading's.
  return succeeded<T, E>(read(wire));
}

/**
 * The value, or the failure raised — the boundary with code not yet on the
 * contract.
 *
 * Every use is a place that has not migrated, which makes the remaining work
 * countable instead of invisible. When a caller does migrate, the fix is to
 * delete the call and read the answer.
 */
export async function orThrow<T>(
  answer: IAdtResponse<T> | Promise<IAdtResponse<T>>,
): Promise<T> {
  const response = await answer;
  if (response.ok) {
    return response.getResult().value;
  }
  // The failure carries no `cause` since interfaces@31.0.0 — what a library
  // threw inside itself is not part of what a consumer reads — so the message
  // is what crosses this seam.
  throw new Error(response.getError().message);
}
