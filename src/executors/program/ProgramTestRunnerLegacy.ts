/**
 * ProgramTestRunnerLegacy — a report's ABAP Unit tests on a legacy system
 * (BASIS < 7.50), which has no `/abapunit/runs`.
 *
 * Refused without a request. The legacy endpoint, `/abapunit/testruns`, was
 * given a report's URI on premise (2026-09-30) and answered an empty result for
 * a report whose tests `/abapunit/runs` found — so sending it would answer "no
 * tests" where there are some. It stays refused until a legacy system is
 * measured.
 */

import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { refusedBelow750 } from '../abapUnitRunner';
import {
  type IProgramTestRunnerResults,
  ProgramTestRunner,
  type programTestRunnerDocuments,
} from './ProgramTestRunner';

export class ProgramTestRunnerLegacy<
  R extends IProgramTestRunnerResults = typeof programTestRunnerDocuments,
> extends ProgramTestRunner<R> {
  override async run<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['run']>, E>
  > {
    return refusedBelow750<ReturnType<R['run']>, E>("a report's");
  }

  override async getStatus<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['status']>, E>
  > {
    return refusedBelow750<ReturnType<R['status']>, E>("a report's");
  }

  override async getResult<E extends IAdtError = IAdtError>(): Promise<
    IAdtResponse<ReturnType<R['result']>, E>
  > {
    return refusedBelow750<ReturnType<R['result']>, E>("a report's");
  }
}
