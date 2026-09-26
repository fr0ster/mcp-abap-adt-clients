/**
 * AdtUnitTestLegacy — running ABAP Unit on legacy SAP systems (BASIS < 7.50).
 *
 * One endpoint differs and one behaviour differs:
 * - `/sap/bc/adt/abapunit/testruns` instead of `/sap/bc/adt/abapunit/runs`,
 *   with `application/xml` rather than the versioned
 *   `application/vnd.sap.adt.api.abapunit.*` types;
 * - the POST answers with the finished result (`aunit:runResult`), so there is
 *   no run to poll.
 *
 * Both differences live behind `run`, which is where running belongs. Until
 * 12.0.0 they lived behind an override of `create`, from when `create` meant
 * "start a run" — and managing a class's tests, which is what `create` means
 * now, is identical on a legacy system.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { answering, failed } from '../../utils/adtResponse';
import { AdtUnitTest } from './AdtUnitTest';
import { startClassUnitTestRunLegacy } from './runLegacy';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestResults,
  unitTestDocuments,
} from './types';

export class AdtUnitTestLegacy<
  R extends IUnitTestResults = typeof unitTestDocuments,
> extends AdtUnitTest<R> {
  /**
   * Run the tests. On a legacy system the POST answers the finished result.
   *
   * So the answer is read by this implementation's `run` strategy as it came —
   * the result document itself, not an id. It used to be replaced by a
   * synthetic id and kept for `getStatus` and `getResult` to replay; nothing
   * here remembers a run any more, because the contract says every member
   * takes the run it is about.
   */
  override async run<E extends IAdtError = IAdtError>(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    this.logger?.info?.('Starting unit test run (legacy)');
    return answering(
      () => startClassUnitTestRunLegacy(this.connection, tests, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options?.analyse,
    );
  }

  /**
   * Refused without a request: a legacy system finishes a run before it
   * answers and exposes no run to poll. `run`'s own answer is the result.
   */
  override async getStatus<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['status']>, E>
  > {
    return failed<ReturnType<R['status']>, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'A legacy system has no run to poll: run() answers the finished result.',
    } as E);
  }

  /** Refused for the same reason: `run`'s answer is the result document. */
  override async getResult<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['result']>, E>
  > {
    return failed<ReturnType<R['result']>, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'A legacy system has no result to fetch: run() answers the finished result.',
    } as E);
  }
}
