/**
 * ClassTestRunnerLegacy — running ABAP Unit on legacy SAP systems (BASIS < 7.50).
 *
 * One endpoint differs and one behaviour differs:
 * - `/sap/bc/adt/abapunit/testruns` instead of `/sap/bc/adt/abapunit/runs`,
 *   with `application/xml` rather than the versioned
 *   `application/vnd.sap.adt.api.abapunit.*` types;
 * - the POST answers with the finished result (`aunit:runResult`), so there is
 *   no run to poll.
 *
 * The legacy format addresses classes, never a test class inside one, so a run
 * given test definitions runs each distinct container whole.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassUnitTestRunOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { startClassUnitTestRunLegacy } from '../../core/class/runLegacy';
import { answering, failed } from '../../utils/adtResponse';
import {
  ClassTestRunner,
  type classTestRunnerDocuments,
  type IClassTestRunnerResults,
  type IClassTestRunTarget,
} from './ClassTestRunner';

export class ClassTestRunnerLegacy<
  R extends IClassTestRunnerResults = typeof classTestRunnerDocuments,
> extends ClassTestRunner<R> {
  /**
   * Run the tests. On a legacy system the POST answers the finished result.
   *
   * So the answer is read by this runner's `run` strategy as it came — the
   * result document itself, not an id.
   */
  override async run<E extends IAdtError = IAdtError>(
    target: IClassTestRunTarget,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    const classNames =
      typeof target === 'string'
        ? [target]
        : [...new Set(target.map((test) => test.containerClass))];
    return answering(
      () => startClassUnitTestRunLegacy(this.connection, classNames),
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
