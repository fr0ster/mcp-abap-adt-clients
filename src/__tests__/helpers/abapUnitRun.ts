/**
 * One ABAP Unit run, start to finish, for an integration test: start it, poll
 * it to the end, fetch the result, and say which test methods ran and which
 * alerts they raised. The same for every runner, so each test asserts the
 * same thing — that the tests it wrote were found and passed.
 */

import {
  analyseException,
  analyseUnitTestStart,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtRunnable,
  ITestRunInformation,
} from '@mcp-abap-adt/interfaces-adt';
import { expectResult } from './contract';
import {
  attributeOf,
  elementsNamed,
  parseXmlDocument,
  textOf,
  type XmlElement,
} from './xmlTree';

/**
 * A runner as the client declares it: `IAdtRunnable` to start a run and
 * `ITestRunInformation` to poll it and fetch its result. Built from the
 * contract types rather than narrowed by hand, so the `analyse` option of
 * every call is the compiler's to keep.
 */
type IRunner<T> = IAdtRunnable<T, unknown, object> &
  ITestRunInformation<unknown, unknown>;

export interface IFinishedRun {
  runId: string;
  /** Test method names in the result document, as ADT spells them. */
  methods: string[];
  /** `kind` of every alert, at every scope — `failedAssertion`, `exception`, … */
  alerts: string[];
  /** The alerts that are failures, run- and class-level ones included. */
  failures: IRunAlert[];
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
  // Every answer is judged: an exception document inside a 200 is a refused
  // poll or result, not a run that went on.
  expectResult(
    await runner.getStatus(runId, true, { analyse: analyseException }),
    'poll the run',
  );
  const result = String(
    expectResult(
      await runner.getResult(runId, { analyse: analyseException }),
      'fetch the run result',
    ),
  );
  return { runId, ...readRunResult(result), result };
}

/** One alert of an abapunit result, and where in the run it was raised. */
export interface IRunAlert {
  kind: string;
  severity: string;
  scope: 'run' | 'class' | 'method';
}

/**
 * An alert that is a failure: everything but a `tolerable` one and a
 * `warning`. A run-level or class-level failure — a run that could not
 * start, a class whose setup dumped — counts as much as a method's.
 */
export function isFailureAlert(alert: IRunAlert): boolean {
  return alert.severity !== 'tolerable' && alert.kind !== 'warning';
}

/** The root element's name (prefix dropped) and the element itself. */
function rootOf(tree: unknown): { name: string; element: XmlElement } {
  const entry = Object.entries((tree ?? {}) as XmlElement).find(
    ([key]) => !key.startsWith('?') && !key.startsWith('@_'),
  );
  const [name, element] = entry ?? ['', {}];
  return {
    name,
    element:
      element && typeof element === 'object' ? (element as XmlElement) : {},
  };
}

/** The tree of a result document whose root is one of `roots`; anything else throws. */
function resultTree(result: string, roots: readonly string[]): unknown {
  const tree = parseXmlDocument(result, 'the ABAP Unit result');
  const { name, element } = rootOf(tree);
  if (name === 'exception') {
    const message = elementsNamed(element, 'message')[0];
    throw new Error(
      `the ABAP Unit result is an exception document: ${message ? textOf(message) : JSON.stringify(element).slice(0, 300)}`,
    );
  }
  if (!roots.includes(name)) {
    throw new Error(
      `the ABAP Unit result has root "${name}", not ${roots.map((r) => `"${r}"`).join(' or ')}`,
    );
  }
  return tree;
}

/** Every alert under `node`, with the scope it was raised in. */
function alertsIn(node: unknown): IRunAlert[] {
  const found: IRunAlert[] = [];
  const visit = (value: unknown, scope: IRunAlert['scope']) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, scope);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('@_')) continue;
      const inner: IRunAlert['scope'] =
        key === 'testMethod'
          ? 'method'
          : key === 'testClass' && scope === 'run'
            ? 'class'
            : scope;
      if (key === 'alert') {
        for (const item of Array.isArray(child) ? child : [child]) {
          const alert = (
            item && typeof item === 'object' ? item : {}
          ) as XmlElement;
          found.push({
            kind: attributeOf(alert, 'kind') || 'alert',
            severity: attributeOf(alert, 'severity'),
            scope,
          });
        }
      }
      visit(child, inner);
    }
  };
  visit(node, 'run');
  return found;
}

/**
 * The test methods that ran and the failures they raised, read from a result
 * document in the format it was asked for: `abapunit` (`testMethod` names and
 * the `alert` kinds at every scope — run, class and method) or `junit`
 * (`testcase` names, and `failure` / `error` elements). The document is
 * parsed, so attribute order, whitespace and namespace prefixes do not matter.
 * Its root must be the format's (`runResult`; `testsuites` / `testsuite`): an
 * exception document, or any other root, throws. So do a document that does
 * not parse and a format this cannot read.
 */
export function readRunResult(
  result: string,
  format: 'abapunit' | 'junit' | string = 'abapunit',
): { methods: string[]; alerts: string[]; failures: IRunAlert[] } {
  if (format !== 'abapunit' && format !== 'junit') {
    throw new Error(
      `an ABAP Unit result in format ${JSON.stringify(format)} cannot be read: "abapunit" or "junit"`,
    );
  }
  if (format === 'abapunit') {
    const tree = resultTree(result, ['runResult']);
    const alerts = alertsIn(tree);
    return {
      methods: elementsNamed(tree, 'testMethod').map((m) =>
        attributeOf(m, 'name'),
      ),
      alerts: alerts.map((a) => a.kind),
      failures: alerts.filter(isFailureAlert),
    };
  }
  const tree = resultTree(result, ['testsuites', 'testsuite']);
  const failures: IRunAlert[] = [
    ...elementsNamed(tree, 'failure').map(
      () => ({ kind: 'failure', severity: '', scope: 'method' }) as IRunAlert,
    ),
    ...elementsNamed(tree, 'error').map(
      () => ({ kind: 'error', severity: '', scope: 'method' }) as IRunAlert,
    ),
  ];
  return {
    methods: elementsNamed(tree, 'testcase').map((t) => attributeOf(t, 'name')),
    alerts: failures.map((f) => f.kind),
    failures,
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
 * Every test method of an abapunit result with the alerts under it, every
 * alert of the run at every scope, and the `type` of every `program` element —
 * read from the parsed document, so attribute order, whitespace and namespace
 * prefixes do not matter. The root must be `runResult`: an exception document,
 * another root, or a document that does not parse throws.
 */
export function readMethodVerdicts(result: string): {
  methods: IMethodVerdict[];
  alerts: IRunAlert[];
  programTypes: string[];
} {
  const tree = resultTree(result, ['runResult']);
  const programTypes = elementsNamed(tree, 'program').map((p) =>
    attributeOf(p, 'type'),
  );
  const methods: IMethodVerdict[] = [];
  for (const testClass of elementsNamed(tree, 'testClass')) {
    for (const method of elementsNamed(testClass, 'testMethod')) {
      methods.push({
        testClass: attributeOf(testClass, 'name'),
        name: attributeOf(method, 'name'),
        alerts: alertsIn(method).map((a) => a.kind),
      });
    }
  }
  return { methods, alerts: alertsIn(tree), programTypes };
}
