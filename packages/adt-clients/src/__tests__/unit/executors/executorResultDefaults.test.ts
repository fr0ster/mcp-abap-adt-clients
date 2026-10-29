/**
 * What an executor's getter answers is typed by what it was given, and by
 * nothing else (compile-time checks; `npm run test:check` runs them).
 *
 * Until this, every getter and every runner constructor had
 * `results: R = <x>Documents as unknown as R`: a caller naming its own `R`
 * and passing nothing got the shipped documents back, typed as `R`. Now each
 * getter has two overloads — no argument answers the shipped documents' type,
 * a custom `R` needs its results — and each constructor takes `results`.
 */

import { AdtExecutor } from '../../../clients/AdtExecutor';
import type { AdtModernVariant } from '../../../clients/variant';
import {
  type AbapUnitTestRunner,
  abapUnitTestRunnerDocuments,
} from '../../../executors/abapUnitTestRunner';
import {
  ClassExecutor,
  type classExecutorDocuments,
} from '../../../executors/class/ClassExecutor';
import {
  ClassTestRunner,
  type classTestRunnerDocuments,
} from '../../../executors/class/ClassTestRunner';
import type { functionGroupTestRunnerDocuments } from '../../../executors/functionGroup/FunctionGroupTestRunner';
import type { functionModuleTestRunnerDocuments } from '../../../executors/functionModule/FunctionModuleTestRunner';
import type { programExecutorDocuments } from '../../../executors/program/ProgramExecutor';
import type { programTestRunnerDocuments } from '../../../executors/program/ProgramTestRunner';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** `true` only when `A` and `B` are the same type. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** A result set of its own: the shipped one, and a marker the default lacks. */
type Marked<D> = D & { readonly marker: true };
const marked = <D extends object>(documents: D): Marked<D> => ({
  ...documents,
  marker: true,
});

function getterTypes(executor: AdtExecutor): void {
  // No argument: the shipped documents' type, inferred.
  const runner = executor.getAbapUnitTestRunner();
  const isDefault: Equal<
    typeof runner,
    AbapUnitTestRunner<typeof abapUnitTestRunnerDocuments, AdtModernVariant>
  > = true;
  void isDefault;

  // Given results: their type.
  const own = executor.getAbapUnitTestRunner(
    marked(abapUnitTestRunnerDocuments),
  );
  const isOwn: Equal<
    typeof own,
    AbapUnitTestRunner<
      Marked<typeof abapUnitTestRunnerDocuments>,
      AdtModernVariant
    >
  > = true;
  void isOwn;

  // A custom R names its results: no getter answers R without them.
  // @ts-expect-error -- R without results
  executor.getAbapUnitTestRunner<Marked<typeof abapUnitTestRunnerDocuments>>();
  // @ts-expect-error -- R without results
  executor.getClassTestRunner<Marked<typeof classTestRunnerDocuments>>();
  // @ts-expect-error -- R without results
  executor.getClassExecutor<Marked<typeof classExecutorDocuments>>();
  // @ts-expect-error -- R without results
  executor.getProgramExecutor<Marked<typeof programExecutorDocuments>>();
  // @ts-expect-error -- R without results
  executor.getProgramTestRunner<Marked<typeof programTestRunnerDocuments>>();
  // @ts-expect-error -- R without results
  executor.getFunctionGroupTestRunner<
    Marked<typeof functionGroupTestRunnerDocuments>
  >();
  // @ts-expect-error -- R without results
  executor.getFunctionModuleTestRunner<
    Marked<typeof functionModuleTestRunnerDocuments>
  >();

  // A constructor takes its results.
  const connection = new RecordingConnection();
  // @ts-expect-error -- results are required
  new ClassTestRunner<Marked<typeof classTestRunnerDocuments>>(connection);
  // @ts-expect-error -- results are required
  new ClassExecutor(connection, undefined);
}

describe('executor getters and runner constructors', () => {
  it('are typed by what they are given (checked by npm run test:check)', () => {
    expect(typeof getterTypes).toBe('function');
  });

  it('answer the shipped documents when given none', async () => {
    const connection = new RecordingConnection();
    const runner = new AdtExecutor(connection).getAbapUnitTestRunner();

    const answer = await runner.getResult('RUN');

    expect(answer.ok).toBe(true);
    expect(connection.sent).toHaveLength(1);
  });
});
