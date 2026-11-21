/**
 * The facts exchange: the boundary every new abapGit form crosses (spec §5.3).
 *
 * One request, and before anything sees its outcome — the caller's reader,
 * the caller's analyser, this library's logger — the outcome is reduced:
 *
 * | what happened | reduced by | handed on |
 * |---|---|---|
 * | answered, 2xx, the route's document | `abapGitFacts[route]` | the facts, to the analyser and the reader |
 * | answered, 2xx, not the route's document | — | `unreadableAnswer`, its status |
 * | answered, any other status | `abapGitErrorFacts` | `refused` / `refusedWithMessage` / `gitHostRefused` |
 * | threw, with SAP's answer | `abapGitErrorFacts` | the same three |
 * | threw, no answer | — | `noResponse`, status `0` |
 * | the SAP credential refused before SAP was asked | — | `noResponse`, status `0`: the thrown refusal never leaves |
 *
 * The error is built fresh: its message is one of `ABAPGIT_ERROR_MESSAGES`,
 * its facts the status and the T100 key, its request the method and the path
 * without the query. No response, no thrown message, no SAP text: nothing in
 * it can carry a credential. The legacy forms never come here; this never
 * calls `answeringExchange`.
 *
 * Strict by default: every non-2xx is an error. An analyser may judge, but it
 * can clear a failure only where there are facts to read — a refusal's
 * document is no route's success, so a failure stays one.
 */

import { abapGitErrorFacts } from '@mcp-abap-adt/adt-strategies';
import {
  ABAPGIT_ERROR_MESSAGES,
  type AbapGitErrorMessage,
  ADT_NO_FAILURE,
  type AdtNoFailure,
  type IAbapGitErrorFacts,
  type IAbapGitFactsAnalyse,
  type IAbapGitFactsResponse,
  type IAbapGitFactsResultStrategy,
  type IAbapGitStructuredError,
  type IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  failed,
  isUnansweredCredentialRefusal,
  succeeded,
} from '../../utils/adtResponse';
import type { AbapGitFactsSlot } from './types';

/** The request an error describes: the method, and the path without its query. */
export interface IAbapGitSentRequest {
  readonly method: string;
  readonly path: string;
}

/** What the request was, for the error: `params` are the query, never kept. */
export function sentRequest(request: IAbapRequestOptions): IAbapGitSentRequest {
  const at = request.url.indexOf('?');
  return {
    method: request.method,
    path: at < 0 ? request.url : request.url.slice(0, at),
  };
}

/** An own data property, never a getter: a thrown value is outside the types. */
function ownData(holder: unknown, key: string): unknown {
  if (holder === null || typeof holder !== 'object') return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(holder, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * SAP's answer a thrown value carries: its own `response`, or — for a refused
 * SAP credential SAP answered — its `cause`'s. Read field by field, so the
 * answer handed to the reducer holds the status and the body alone.
 */
function answerOf(thrown: unknown): IAdtWireResponse | undefined {
  const response =
    ownData(thrown, 'response') ??
    ownData(ownData(thrown, 'cause'), 'response');
  const status = ownData(response, 'status');
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
  return {
    status,
    statusText: '',
    headers: {},
    data: ownData(response, 'data'),
  };
}

function messageFor(facts: IAbapGitErrorFacts): AbapGitErrorMessage {
  if (facts.gitHttpStatus !== undefined)
    return ABAPGIT_ERROR_MESSAGES.gitHostRefused;
  if (facts.messageClass !== undefined && facts.messageNumber !== undefined)
    return ABAPGIT_ERROR_MESSAGES.refusedWithMessage;
  return ABAPGIT_ERROR_MESSAGES.refused;
}

function structuredError(
  message: AbapGitErrorMessage,
  facts: IAbapGitErrorFacts,
  request: IAbapGitSentRequest,
): IAbapGitStructuredError {
  return {
    origin: 'connection',
    message,
    facts,
    request: { method: request.method, path: request.path },
  };
}

/** A refusal SAP answered: its status and T100 key, in fixed words. */
function refusal(
  answer: IAdtWireResponse,
  request: IAbapGitSentRequest,
  route: AbapGitFactsSlot,
): IAbapGitStructuredError {
  // `http_status` — and with it `gitHostRefused` — is R11's alone.
  const facts = abapGitErrorFacts(answer, route);
  return structuredError(messageFor(facts), facts, request);
}

/**
 * Run one request of a new form and answer it through the facts.
 *
 * `run` sends the request; `reduce` is the route's `abapGitFacts` reducer;
 * `read` the slot's facts reader; `analyse` the caller's judge of the facts.
 */
export async function answeringFactsExchange<
  T,
  F,
  E extends IAbapGitStructuredError = IAbapGitStructuredError,
>(
  run: () => Promise<IAdtWireResponse>,
  reduce: (wire: IAdtWireResponse) => IAbapGitFactsResponse<F>,
  read: IAbapGitFactsResultStrategy<T, F>,
  analyse: IAbapGitFactsAnalyse<F, E> | undefined,
  request: IAbapGitSentRequest,
  route: AbapGitFactsSlot,
): Promise<IAdtResponse<T, E>> {
  let verdict: IAbapGitStructuredError | AdtNoFailure = ADT_NO_FAILURE;
  let answer: IAbapGitFactsResponse<F> | undefined;
  let lost: IAdtWireResponse['sessionLost'];

  try {
    const wire = await run();
    lost = wire.sessionLost;
    if (wire.status < 200 || wire.status >= 300) {
      verdict = refusal(wire, request, route);
    } else {
      try {
        answer = reduce(wire);
      } catch {
        // The reducer's own failure is fixed words (`unreadableAnswer`); its
        // message is not read either way.
        verdict = structuredError(
          ABAPGIT_ERROR_MESSAGES.unreadableAnswer,
          { status: wire.status },
          request,
        );
      }
    }
  } catch (error: unknown) {
    // A refusal of the SAP credential SAP never saw carries no answer of
    // SAP's — its cause may hold an identity provider's headers and body —
    // so it leaves as `noResponse`, like anything else without one: no error
    // a new form answers with is the object that was thrown (review of #326).
    const wire = isUnansweredCredentialRefusal(error)
      ? undefined
      : answerOf(error);
    verdict =
      wire === undefined
        ? structuredError(
            ABAPGIT_ERROR_MESSAGES.noResponse,
            { status: 0 },
            request,
          )
        : refusal(wire, request, route);
  }

  // `E` gets a value only from `analyse`; without one the verdict is the
  // library's own, which is what `E` defaults to. The compiler cannot see
  // that from inside the body; a caller never sees the casts.
  if (analyse) {
    const judged = analyse(verdict, answer);
    if (judged !== ADT_NO_FAILURE) return failed<T, E>(judged);
  } else if (verdict !== ADT_NO_FAILURE) {
    return failed<T, E>(verdict as E);
  }
  if (answer === undefined) {
    // Cleared, but there are no facts to read: the verdict stands.
    return failed<T, E>(verdict as E);
  }
  // Outside any catch: the reader is the caller's, and so is its exception.
  return succeeded<T, E>(read(answer), lost);
}
