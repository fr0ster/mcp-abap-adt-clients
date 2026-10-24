/**
 * One ABAP Unit run, start to finish, for an integration test: start it, poll
 * it to the end, fetch the result, and say which test methods ran and which
 * alerts they raised. The same for every runner, so each test asserts the
 * same thing — that the tests it wrote were found and passed.
 */

import { analyseUnitTestStart } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { expectResult } from './contract';
import { attributeOf, elementsNamed, parseXmlDocument } from './xmlTree';

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
  return { runId, ...readRunResult(result), result };
}

/**
 * The test methods that ran and the failures they raised, read from a result
 * document in the format it was asked for: `abapunit` (`testMethod` names and
 * `alert` kinds) or `junit` (`testcase` names, and `failure` / `error`
 * elements). The document is parsed, so attribute order, whitespace and
 * namespace prefixes do not matter. Any other format is a defect of the
 * caller, thrown; so is a document that does not parse.
 */
export function readRunResult(
  result: string,
  format: 'abapunit' | 'junit' | string = 'abapunit',
): { methods: string[]; alerts: string[] } {
  if (format !== 'abapunit' && format !== 'junit') {
    throw new Error(
      `an ABAP Unit result in format ${JSON.stringify(format)} cannot be read: "abapunit" or "junit"`,
    );
  }
  const tree = parseXmlDocument(result, 'the ABAP Unit result');
  const attribute = attributeOf;
  if (format === 'abapunit') {
    return {
      methods: elementsNamed(tree, 'testMethod').map((m) =>
        attribute(m, 'name'),
      ),
      alerts: elementsNamed(tree, 'alert').map(
        (a) => attribute(a, 'kind') || 'alert',
      ),
    };
  }
  return {
    methods: elementsNamed(tree, 'testcase').map((t) => attribute(t, 'name')),
    alerts: [
      ...elementsNamed(tree, 'failure').map(() => 'failure'),
      ...elementsNamed(tree, 'error').map(() => 'error'),
    ],
  };
}

/** One test method of an abapunit result, with its class and its alerts. */
export interface IMethodVerdict {
  testClass: string;
  name: string;
  /** `kind` of every alert under the method. */
  alerts: string[];
}

/**
 * Every test method of an abapunit result with the alerts under it, and the
 * `type` of every `program` element — read from the parsed document, so
 * attribute order, whitespace and namespace prefixes do not matter. A
 * document that does not parse throws.
 */
export function readMethodVerdicts(result: string): {
  methods: IMethodVerdict[];
  programTypes: string[];
} {
  const tree = parseXmlDocument(result, 'the ABAP Unit result');
  const attribute = attributeOf;
  const programTypes = elementsNamed(tree, 'program').map((p) =>
    attribute(p, 'type'),
  );
  const methods: IMethodVerdict[] = [];
  for (const testClass of elementsNamed(tree, 'testClass')) {
    for (const method of elementsNamed(testClass, 'testMethod')) {
      methods.push({
        testClass: attribute(testClass, 'name'),
        name: attribute(method, 'name'),
        alerts: elementsNamed(method, 'alert').map(
          (a) => attribute(a, 'kind') || 'alert',
        ),
      });
    }
  }
  return { methods, programTypes };
}
