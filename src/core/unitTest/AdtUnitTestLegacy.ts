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

import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { safeErrorMessage } from '../../utils/internalUtils';
import { AdtUnitTest } from './AdtUnitTest';
import { startClassUnitTestRunLegacy } from './runLegacy';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
} from './types';

/** Synthetic run ID for legacy synchronous results */
const LEGACY_SYNC_RUN_ID = 'legacy-sync';

export class AdtUnitTestLegacy extends AdtUnitTest {
  /**
   * Run the tests. The result comes back with the POST, so the id returned
   * here is synthetic — it exists so {@link getStatus} and {@link getResult}
   * keep the same shape they have on a modern system.
   */
  override async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions,
  ): Promise<string> {
    if (!tests || tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    try {
      this.logger?.info?.('Starting unit test run (legacy)');
      const response = await startClassUnitTestRunLegacy(
        this.connection,
        tests,
        options,
      );

      this.logger?.debug?.('Unit test run response status:', response.status);

      // Legacy answers with the finished result — store it as both, since a
      // caller asking for either is asking about the same document.
      this.lastStatusResponse = response;
      this.lastResultResponse = response;
      this.lastRunId = LEGACY_SYNC_RUN_ID;

      this.logger?.info?.('Unit test run completed (legacy, synchronous)');
      return LEGACY_SYNC_RUN_ID;
    } catch (error: unknown) {
      this.logger?.error('Run failed (legacy):', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Status of a run — the response the run itself returned, since a legacy
   * system finishes before it answers and exposes nothing to poll.
   */
  override async getStatus(
    _runId: string,
    _withLongPolling: boolean = true,
  ): Promise<IAdtWireResponse> {
    if (this.lastStatusResponse) {
      return this.lastStatusResponse;
    }
    throw new Error(
      'No status available. A legacy system returns the result from run(), so there is nothing to poll before one has been started here.',
    );
  }

  /** Result of a run — same document, same reason. */
  override async getResult(
    _runId: string,
    _options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' },
  ): Promise<IAdtWireResponse> {
    if (this.lastResultResponse) {
      return this.lastResultResponse;
    }
    throw new Error(
      'No result available. A legacy system returns the result from run(), so there is nothing to fetch before one has been started here.',
    );
  }
}
