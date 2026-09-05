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
  IAdtOperationOptions,
  IAdtResponse,
  IAdtResult,
  IAdtWireResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
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
 * It is rethrown by {@link answering} rather than dressed as a verdict about
 * SAP.
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
 * What a caller may supply to overrule the default verdict.
 *
 * Handed the default's verdict **and** the answer it was reached from, so it can
 * overrule in either direction: name a failure the default let through, or clear
 * one it raised. It answers {@link ADT_NO_FAILURE} for "not a failure here" —
 * never `undefined`, which already means "no strategy was supplied".
 */
export type IAnalyse<E extends IAdtError = IAdtError> = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
) => E | AdtNoFailure;

/**
 * The options a member takes, with the failure type its `analyse` names.
 *
 * `IAdtOperationOptions` pins `analyse` to `IAdtError`, so a consumer whose
 * strategy answers something richer got it back narrowed and had to cast — the
 * one thing a parameterised failure exists to avoid. The contract already
 * carries the parameter (`IAdtFailure<TError extends IAdtError>`); it is only
 * the options that stop it flowing.
 *
 * Declared here rather than in `@mcp-abap-adt/interfaces` on purpose: it stays
 * in this package while the shape is being proven against real traffic, and
 * moves into the contracts before release.
 */
export type IAdtOptions<E extends IAdtError = IAdtError> = Omit<
  IAdtOperationOptions,
  'analyse'
> & {
  analyse?: IAnalyse<E>;
};

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

/**
 * An answer built around a value the request function already assembled.
 *
 * Some readings are not a strategy over one answer: a package walk, a
 * where-used run and an includes listing each make several requests and build
 * one shape out of all of them, so there is no single wire for a strategy to
 * read. Those members produce the value and this wraps it — with the same
 * failure classification as {@link answering}, which is the point of not
 * hand-rolling a try/catch at each of them.
 *
 * It is deliberately not exported as a way around result strategies: a member
 * whose endpoint answers once uses `answering`.
 */
export async function answeringValue<T, E extends IAdtError = IAdtError>(
  produce: () => Promise<T>,
  analyse?: IAnalyse<E>,
): Promise<IAdtResponse<T, E>> {
  return answering(
    async () => ({
      data: (await produce()) as unknown,
      status: 200,
      statusText: 'OK',
      headers: {},
    }),
    (answer) => answer.data as T,
    analyse,
  );
}
