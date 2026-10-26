/**
 * What the legacy ABAP Unit runners share (SAP_BASIS 7.40 SP04, over RFC).
 *
 * 7.40 has no `/sap/bc/adt/abapunit/runs`: `POST /sap/bc/adt/abapunit/testruns`
 * is the run, and it answers the finished result. Measured with `<options>` for
 * a class, a report, a function group and a function module — the body every
 * modern runner's `runSync` sends — and the class's without `<options>` too:
 * each answered the finished result. So a legacy `run` sends that request, and
 * there is no run id to poll or fetch by.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassUnitTestRunOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { startUnitTestRunSync } from '../core/shared/abapUnit';
import { answering, failed } from '../utils/adtResponse';

/**
 * Run the tests of whole objects, named by their ADT URIs: the request the
 * modern `runSync` sends, byte for byte. `runOptions` is an object even when
 * the caller gave none, so the `<options>` element is always sent. The answer
 * is read by the strategy given — `run`'s for a legacy `run` —, and judged by
 * `options.analyse`.
 */
export function runSyncLegacy<T, E extends IAdtError>(
  connection: IAbapConnection,
  objectUris: string[],
  strategy: IResultStrategy<T>,
  options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
): Promise<IAdtResponse<T, E>> {
  const { analyse, ...runOptions } = options ?? {};
  return answering(
    () => startUnitTestRunSync(connection, objectUris, runOptions),
    strategy,
    analyse,
  );
}

/** `getStatus` on a legacy system: refused without a request. */
export function noRunToPoll<T, E extends IAdtError>(): IAdtResponse<T, E> {
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message:
      'getStatus: a legacy system has no run to poll — it has no /sap/bc/adt/abapunit/runs, and run() answers the finished result, with no run id.',
  } as E);
}

/** `getResult` on a legacy system: refused without a request. */
export function noResultToFetch<T, E extends IAdtError>(): IAdtResponse<T, E> {
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message:
      'getResult: a legacy system has no result to fetch — it has no /sap/bc/adt/abapunit/results, and run() answers the finished result, with no run id.',
  } as E);
}
