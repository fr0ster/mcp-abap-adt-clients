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

import type { IAdtResponse, IResultStrategy } from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { answering, failed } from '../../utils/adtResponse';
import { AdtUnitTest } from './AdtUnitTest';
import { startClassUnitTestRunLegacy } from './runLegacy';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestResults,
} from './types';

/** Synthetic run ID for legacy synchronous results */
const LEGACY_SYNC_RUN_ID = 'legacy-sync';

export class AdtUnitTestLegacy<
  R extends IUnitTestResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IUnitTestResults,
> extends AdtUnitTest<R> {
  /**
   * Run the tests.
   *
   * The result comes back with the POST, so the id this answers is synthetic —
   * it exists so {@link getStatus} and {@link getResult} keep the same shape
   * they have on a modern system. The run's own reading is bypassed for that
   * reason: there is no id in the answer to read.
   */
  override async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions,
  ): Promise<IAdtResponse<ReturnType<R['run']>>> {
    if (!tests || tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    this.logger?.info?.('Starting unit test run (legacy)');
    const answer = await answering(
      async () => {
        const response = await startClassUnitTestRunLegacy(
          this.connection,
          tests,
          options,
        );
        // Legacy answers with the finished result — kept as both, since a
        // caller asking for either is asking about the same document.
        this.lastStatusResponse = response;
        this.lastResultResponse = response;
        this.lastRunId = LEGACY_SYNC_RUN_ID;
        return response;
      },
      () => LEGACY_SYNC_RUN_ID as ReturnType<R['run']>,
    );

    if (answer.ok) {
      this.logger?.info?.('Unit test run completed (legacy, synchronous)');
    }
    return answer;
  }

  /**
   * Status of a run — the answer the run itself returned, since a legacy
   * system finishes before it answers and exposes nothing to poll.
   */
  override async getStatus(): Promise<IAdtResponse<ReturnType<R['status']>>> {
    const held = this.lastStatusResponse;
    if (!held) {
      return failed({
        origin: 'refusal',
        code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        message:
          'No status available. A legacy system returns the result from run(), so there is nothing to poll before one has been started here.',
      });
    }
    return answering(
      async () => held,
      this.results.status as IResultStrategy<ReturnType<R['status']>>,
    );
  }

  /** Result of a run — same document, same reason. */
  override async getResult(): Promise<IAdtResponse<ReturnType<R['result']>>> {
    const held = this.lastResultResponse;
    if (!held) {
      return failed({
        origin: 'refusal',
        code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        message:
          'No result available. A legacy system returns the result from run(), so there is nothing to fetch before one has been started here.',
      });
    }
    return answering(
      async () => held,
      this.results.result as IResultStrategy<ReturnType<R['result']>>,
    );
  }
}
