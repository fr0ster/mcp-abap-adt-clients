/**
 * The shipped default strategies, and the composition that runs them.
 *
 * Decision 19 in `@mcp-abap-adt/interfaces` describes two strategies over one
 * answer — one deciding what a failure is and what the caller is handed, one
 * deciding the result — and a fixed rule for combining their verdicts. This is
 * that rule, with the defaults this library ships behind each half.
 *
 * **The default error strategy recognises two things**, both from the answer
 * rather than from the status: an ADT `<exc:exception>` document, which is SAP
 * refusing, and a document the library could not read. A consumer replaces it by
 * supplying their own, and the "not an error for me" case — a probe where "not
 * found" is the answer they came for — is what that is for.
 *
 * **The default result strategy is the member's own parse.** `search` yields
 * `ISearchResult[]`, `getPackageHierarchy` a tree. A caller wanting a different
 * amount passes a parser, which narrows `T` rather than half-filling it.
 *
 * **Failures come back, they do not fly past.** A member answers `IAdtFailure`
 * where it used to throw, because `getError()` on the contract is what makes
 * handling visible to the compiler — an exception is invisible to it, and the
 * caller who never learns a failure path exists is the one this contract is for.
 * The connection layer still throws for a status the transport refuses; that is
 * caught here and turned into the answer.
 */

import type {
  IAdtError,
  IAdtResponse,
  IAdtResult,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtParseError, AdtSAPError } from './adtErrors';

/** An answer that succeeded, carrying the member's own result contract. */
export function succeeded<T>(value: T): IAdtResponse<IAdtResult<T>> {
  return {
    ok: true,
    getResult: () => ({ value }),
    getError: () => undefined,
  };
}

/** An answer that failed, carrying what the error strategy made of it. */
export function failed<T>(error: IAdtError): IAdtResponse<IAdtResult<T>> {
  return {
    ok: false,
    getResult: () => undefined,
    getError: () => error,
  };
}

/** What the transport attaches to a status it refused. */
interface IWithResponse {
  response?: IAdtWireResponse;
  message?: string;
}

/**
 * The default error strategy: what this library recognises as a failure.
 *
 * Origin is not decoration — the three have different remedies, and a caller
 * cannot act on "something went wrong". A refusal is answered by asking the
 * server something else; a parse failure by fixing a parser; a connection
 * failure by authenticating or restoring reachability.
 */
function recogniseFailure(error: unknown): IAdtError {
  if (error instanceof AdtSAPError) {
    return {
      origin: 'refusal',
      message: error.message,
      adtType: error.adtType,
      namespace: error.namespace,
      response: error.response,
      request: error.request,
      cause: error,
    };
  }

  if (error instanceof AdtParseError) {
    return {
      origin: 'parse',
      message: error.message,
      cause: error,
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
    cause: error,
  };
}

/**
 * Run a member and answer with the contract.
 *
 * Both halves see the same answer, which decision 18 requires: the result
 * strategy is `produce`, and the error strategy runs over whatever `produce`
 * raised together with what the call raised. Neither is skipped because the
 * other failed — a `produce` that throws still reaches the error strategy, and
 * what surfaces is its verdict rather than the raw exception.
 */
export async function answering<T>(
  produce: () => Promise<T>,
): Promise<IAdtResponse<IAdtResult<T>>> {
  try {
    return succeeded(await produce());
  } catch (error: unknown) {
    return failed<T>(recogniseFailure(error));
  }
}

/**
 * The same, with the caller's own work kept outside the classification.
 *
 * `read` is this library's: a request, and the refusal recognised in its answer.
 * `then` is the consumer's strategy, and **an exception from it is not caught** —
 * decision 19's composition table puts a strategy's own throw in a row of its
 * own, surfacing as itself.
 *
 * That is not tidiness. The fallback in `recogniseFailure` calls an unrecognised
 * error a connection failure, which tells a caller to reauthenticate or check
 * the network. Applied to a bug in their own parser it is advice pointing at the
 * wrong system entirely — and the first version of this file did exactly that,
 * because the parser ran inside the `try`.
 */
export async function answeringWith<TRaw, T>(
  read: () => Promise<TRaw>,
  then: (raw: TRaw) => T,
): Promise<IAdtResponse<IAdtResult<T>>> {
  let raw: TRaw;
  try {
    raw = await read();
  } catch (error: unknown) {
    return failed<T>(recogniseFailure(error));
  }

  // Outside the catch on purpose. Their exception is theirs.
  return succeeded(then(raw));
}

/**
 * The value, or the failure raised — the boundary with code not yet on the
 * contract.
 *
 * `AdtUtils` answers `IAdtResponse` because its contract says so. Most of this
 * library does not yet: the per-type handlers return state objects and signal
 * failure by throwing, and the low-level helpers between them pass a wire
 * response around. Those call sites cannot read `getError()` without becoming a
 * different design halfway.
 *
 * So this is the seam, and it is deliberately ugly to look at. Every use is a
 * place that has not migrated, which makes the remaining work countable instead
 * of invisible — and when a caller does migrate, the fix is to delete the call
 * and read the answer.
 */
export async function orThrow<T>(
  answer: IAdtResponse<IAdtResult<T>> | Promise<IAdtResponse<IAdtResult<T>>>,
): Promise<T> {
  const response = await answer;
  if (response.ok) {
    return response.getResult().value;
  }
  const failure = response.getError();
  // `cause` is the error the default strategy recognised, so the original type
  // and stack survive the round trip rather than being flattened to a message.
  throw failure.cause instanceof Error
    ? failure.cause
    : new Error(failure.message);
}
