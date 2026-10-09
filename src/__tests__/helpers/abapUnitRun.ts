/**
 * One ABAP Unit run, start to finish, for an integration test: start it, poll
 * it to the end, fetch the result, and say which test methods ran and which
 * alerts they raised. The same for every runner, so each test asserts the
 * same thing — that the tests it wrote were found and passed.
 */

import { analyseUnitTestStart } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { expectResult } from './contract';

interface IRunner<T> {
  run(target: T, options?: object): Promise<IAdtResponse<unknown>>;
  getStatus(
    runId: string,
    withLongPolling?: boolean,
  ): Promise<IAdtResponse<unknown>>;
  getResult(runId: string): Promise<IAdtResponse<unknown>>;
}

export interface IFinishedRun {
  runId: string;
  /** Test method names in the result document, as ADT spells them. */
  methods: string[];
  /** `kind` of every alert — `failedAssertion`, `exception`, … */
  alerts: string[];
  result: string;
}

/** The runner must be built with `unitTestRunId` for `run`. */
export async function runToCompletion<T>(
  runner: IRunner<T>,
  target: T,
  options: object = {},
): Promise<IFinishedRun> {
  const runId = String(
    expectResult(
      await runner.run(target, { ...options, analyse: analyseUnitTestStart }),
      'start an ABAP Unit run',
    ),
  );
  expectResult(await runner.getStatus(runId, true), 'poll the run');
  const result = String(
    expectResult(await runner.getResult(runId), 'fetch the run result'),
  );
  return {
    runId,
    methods: [
      ...result.matchAll(/testMethod [^>]*adtcore:name="([^"]+)"/g),
    ].map((m) => m[1]),
    alerts: [...result.matchAll(/<alert kind="([^"]+)"/g)].map((m) => m[1]),
    result,
  };
}
