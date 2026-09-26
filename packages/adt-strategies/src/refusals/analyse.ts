import type { IAdtError, IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import {
  ADT_NO_FAILURE,
  AdtObjectErrorCodes,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  type AdtMessage,
  type AdtRefusal,
  readActivationRefusal,
  readAdtRefusal,
  readCdsTestDoublesRefusal,
  readCheckRunRefusal,
  readDeletionRefusal,
  readExceptionRefusal,
  readMessageClassMessageAbsence,
  readPublicationRefusal,
  readUnitTestRefusal,
  readValidationRefusal,
} from './read';

/**
 * The error axis: readings, injected.
 *
 * `read.ts` holds the readings — pure functions over a document. This file is
 * what makes them strategies: `analyse` is an option on every call, and these
 * are what gets passed.
 *
 * **Why this matters most for a write.** A create answers 200 with zero bytes
 * on a class and 201 with the whole object on a domain; either way the useful
 * information in a failed create is the refusal, not the result. The result
 * strategy for such a member can be trivial. This one cannot.
 */

/** What our strategies answer: the contract, plus the normalised messages. */
export interface IAdtMessageFailure extends IAdtError {
  readonly messages: ReadonlyArray<AdtMessage>;
}

/**
 * Turn a reading into a failure.
 *
 * `origin` is always `'refusal'`: a reading only ever sees a document, and a
 * document means SAP answered. `connection` is the library's to give, and when
 * it has given one this never runs.
 */
function asFailure(
  refusal: AdtRefusal,
  answer: IAdtWireResponse | undefined,
): IAdtMessageFailure {
  return {
    origin: 'refusal',
    code: refusal.code,
    message: refusal.message,
    adtType: refusal.adtType,
    namespace: refusal.namespace,
    messages: refusal.messages,
    response: answer,
    request: requestOf(answer),
  };
}

/**
 * Method and url, copied by name. Never the object the transport held.
 *
 * **`request` first, and that is the fix for a real bug.** This read `config`
 * alone, which is axios's field — correct in the repository this came from,
 * wrong here. `@mcp-abap-adt/adt-clients` writes the trace onto
 * `IAdtWireResponse.request`, the field the contract declares for it, so every
 * failure this package built carried no request at all: a refusal in a chain
 * of six calls could not be located, which is the one thing the field exists
 * for.
 *
 * `config` stays as a fallback, for an answer handed over by a transport that
 * was never wrapped.
 */
function requestOf(
  answer: IAdtWireResponse | undefined,
): { method?: string; url?: string } | undefined {
  const carried = (answer as { request?: { method?: unknown; url?: unknown } })
    ?.request;
  const config = (answer as { config?: { method?: unknown; url?: unknown } })
    ?.config;

  for (const source of [carried, config]) {
    const method =
      typeof source?.method === 'string' ? source.method : undefined;
    const url = typeof source?.url === 'string' ? source.url : undefined;
    if (method || url) return { method, url };
  }
  return undefined;
}

/**
 * The library's own verdict, enriched from the document rather than replaced.
 *
 * When the status was already a failure the library has built an `IAdtError`
 * with the message. The document it came on carries more — the exception's
 * `type id`, its namespace, and the T100 key with the values substituted into
 * the sentence — and that is the only thing in the corpus a caller can match on
 * without reading English. Throwing it away because the library got there first
 * would be the whole point of injecting a strategy, missed.
 */
function enrich(
  verdict: IAdtError,
  answer: IAdtWireResponse | undefined,
): IAdtMessageFailure {
  const refusal = readExceptionRefusal(
    (answer as { data?: unknown } | undefined)?.data,
  );
  if (!refusal) {
    return { ...verdict, messages: [{ type: 'E', text: verdict.message }] };
  }
  return {
    ...verdict,
    adtType: verdict.adtType ?? refusal.adtType,
    namespace: verdict.namespace ?? refusal.namespace,
    messages: refusal.messages,
  };
}

/**
 * Build an `analyse` from a reading.
 *
 * The shape is the same for all of them, and it is three decisions:
 *
 * 1. The library already called it a failure — enrich, never discard.
 * 2. The library saw no failure and the document says otherwise — this is the
 *    HTTP-200-with-a-refusal-inside case the whole design exists for.
 * 3. Neither — `ADT_NO_FAILURE`, a verdict rather than an absence.
 */
function analyser(
  read: (document: unknown) => AdtRefusal | null,
): IAnalyse<IAdtMessageFailure> {
  return (verdict, answer) => {
    if (verdict !== ADT_NO_FAILURE) return enrich(verdict, answer);
    const refusal = read((answer as { data?: unknown } | undefined)?.data);
    return refusal ? asFailure(refusal, answer) : ADT_NO_FAILURE;
  };
}

/** `chkl:messages` — `activationExecuted="false"` or a message of type `E`. */
export const analyseActivation = analyser(readActivationRefusal);

/** `del:deletionResult` and `del:checkResponse` — the verdict is an attribute. */
export const analyseDeletion = analyser(readDeletionRefusal);

/** `chkrun:checkRunReports` — the status first, then the messages. */
export const analyseCheck = analyser(readCheckRunRefusal);

/** Name admissibility. Three families refuse with the status, two with a body. */
export const analyseValidation = analyser(readValidationRefusal);

/** `aunit:runResult` — alerts on the method that failed. */
export const analyseUnitTest = analyser(readUnitTestRefusal);

/**
 * For a member whose refusals arrive as `exc:exception` and nothing else —
 * a read, a lock, a create, a write.
 *
 * It still enriches, which is the point: the library's verdict has the
 * sentence, and the document has the identity.
 */
export const analyseException = analyser(readExceptionRefusal);

/**
 * When the form is not known in advance.
 *
 * Dispatches on the root element. Use a named reading where the form IS known:
 * a dispatcher that meets a document it does not recognise answers `null`, and
 * `null` here means "not a failure".
 */
export const analyseAny = analyser(readAdtRefusal);

/** A service binding's publication — `SEVERITY` other than `OK` refuses. */
export const analysePublication = analyser(readPublicationRefusal);

/** The CDS test-doubles check — anything but `SEVERITY` `OK` refuses. */
export const analyseCdsTestDoubles = analyser(readCdsTestDoublesRefusal);

/**
 * Reading one message of a class: the class answering is not the message
 * existing. Built for the message number asked about.
 */
export const analyseMessageClassMessage = (
  msgno: string,
): IAnalyse<IAdtMessageFailure> =>
  analyser((document) => readMessageClassMessageAbsence(document, msgno));

/**
 * A unit-test run that started without saying which run it is.
 *
 * ADT answers a started run with its id in a header — `Location`,
 * `Content-Location` or `sap-adt-location` — or in `aunit:run@uri`, and the
 * recorded start answers 201 with an empty body and the id in `Location`. An
 * answer carrying neither is not a run a caller can ask about. Moved from
 * adt-clients' `startedRun`, which was hard-wired into `run`.
 */
export const analyseUnitTestStart: IAnalyse<IAdtMessageFailure> = (
  verdict,
  answer,
) => {
  if (verdict !== ADT_NO_FAILURE) return enrich(verdict, answer);
  const headers = (answer?.headers ?? {}) as Record<string, unknown>;
  const header = [
    headers.location,
    headers['content-location'],
    headers['sap-adt-location'],
  ]
    .map((v) => (Array.isArray(v) ? v[0] : v))
    .find((v) => typeof v === 'string' && /\/runs\/[^/]+/.test(v));
  const body = typeof answer?.data === 'string' ? answer.data : '';
  const inBody = /<aunit:run[^>]*uri="[^"]*\/runs\/[^/"]+/.test(body);
  if (header || inBody) return ADT_NO_FAILURE;
  const message = 'Failed to start unit test run: run ID not returned';
  return {
    origin: 'refusal',
    code: AdtObjectErrorCodes.CREATE_FAILED,
    message,
    messages: [{ type: 'E', text: message }],
    response: answer,
    request: requestOf(answer),
  };
};

/**
 * A system that does not offer a resource, told apart from a refusal.
 *
 * Some systems answer 404, 405 or 501 for a validation resource they do not
 * have. That is not a verdict about the name, so this renames the failure
 * `UNSUPPORTED_OPERATION` and says what is missing; any other failure passes
 * through as it came. Moved from adt-clients' `validationUnsupported` (404, 405
 * and 501, three families) and `validationUnavailable` (404, transformations).
 */
export const analyseUnsupportedStatus = (
  statuses: ReadonlyArray<number>,
  what: string,
): IAnalyse<IAdtError> => {
  const set = new Set(statuses);
  return (verdict, answer) => {
    if (verdict === ADT_NO_FAILURE) return ADT_NO_FAILURE;
    const status = verdict.response?.status ?? answer?.status;
    return status !== undefined && set.has(status)
      ? {
          ...verdict,
          code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
          message: `This system does not offer ${what} (HTTP ${status})`,
        }
      : verdict;
  };
};
