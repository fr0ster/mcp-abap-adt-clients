/**
 * AdtCdsUnitTest — unit tests for a CDS view.
 *
 * A view cannot hold a test class, so the tests live in a global class written
 * for the purpose: `create` makes that class from a template, activates it, and
 * writes the tests into its `testclasses` include. Everything else is
 * {@link AdtUnitTest}'s, because everything else is the same.
 *
 * What is genuinely CDS-specific is the test-doubles check — whether the view
 * can be tested with `cl_cds_test_environment` at all — and it is asked before
 * there is anything to create.
 */

import type {
  AdtNoFailure,
  IAbapConnection,
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtWireResponse,
  ICdsTestDoubleCheckable,
  ICdsUnitTestConfig,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { answering, type IAdtOptions } from '../../utils/adtResponse';
import { requestOf } from '../../utils/requestTrace';
import { startClassUnitTestRunByObject } from '../class/run';
import { validateClassName } from '../class/validation';
import { AdtDdl } from '../ddl/AdtDdl';
import { chain } from '../shared/chain';
import { AdtUnitTest } from './AdtUnitTest';
import { checkCdsTestDoublesAvailability } from './checkCdsTestDoublesAvailability';
import {
  type IClassUnitTestDefinition,
  type IClassUnitTestRunOptions,
  type IUnitTestResults,
  runId,
  unitTestDocuments,
} from './types';

const severityParser = new XMLParser({ ignoreAttributes: false });

/**
 * The shipped reading of the CDS test-doubles check.
 *
 * Measured: the check reports its verdict inside a 200, as
 * `<SEVERITY>` with the reason in `<SHORT_TEXT>` or `<LONG_TEXT>`. Anything but
 * `OK` means the view cannot be tested with doubles, and a caller who went on
 * to create a test class against it would find out from a later, less obvious
 * failure.
 */
export const testDoublesVerdict = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict !== ADT_NO_FAILURE) return verdict;
  const data = severityParser.parse(String(answer?.data ?? ''))?.['asx:abap']?.[
    'asx:values'
  ]?.DATA;
  const severity = data?.SEVERITY;
  if (severity === 'OK') return ADT_NO_FAILURE;
  return {
    origin: 'refusal',
    message:
      data?.SHORT_TEXT ||
      data?.LONG_TEXT ||
      `CDS test doubles check failed with severity: ${severity ?? '(none)'}`,
    response: answer,
    request: requestOf(answer),
  };
};

export class AdtCdsUnitTest<
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
  >
  extends AdtUnitTest<R>
  implements ICdsTestDoubleCheckable<ReturnType<R['cdsCheck']>>
{
  protected adtView: AdtDdl;
  private cdsViewName?: string;
  private className?: string;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    results: R = unitTestDocuments as unknown as R,
  ) {
    super(connection, logger, results);
    // adtClass and adtLocalTestClass come from the parent; this one is for the
    // view the tests are written against.
    this.adtView = new AdtDdl(connection, logger);
  }

  /**
   * Whether the view can be tested with test doubles.
   *
   * Unlike `validate`, which checks a name before a create, this asks about the
   * view itself — and it is asked first, because a view the doubles framework
   * cannot handle makes everything after it pointless.
   */
  async checkCdsTestDoubles(
    cdsViewName: string,
  ): Promise<IAdtResponse<ReturnType<R['cdsCheck']>>> {
    this.logger?.info?.(
      'Checking CDS view for unit test doubles:',
      cdsViewName,
    );

    const answer = await answering(
      () => checkCdsTestDoublesAvailability(this.connection, cdsViewName),
      this.results.cdsCheck as IResultStrategy<ReturnType<R['cdsCheck']>>,
      testDoublesVerdict,
    );

    if (answer.ok) {
      this.logger?.info?.('CDS view available for unit test doubles');
      this.cdsViewName = cdsViewName;
    }
    return answer;
  }

  /**
   * Validate what `create` is about to build.
   *
   * With a template there are two halves, both new: the global class's name,
   * and the test source that goes inside it. Without one this is a plain run
   * against a class that already exists, which is the parent's question.
   */
  override async validate<E extends IAdtError = IAdtError>(
    config: Partial<ICdsUnitTestConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    if (!(config.className && config.classTemplate && config.testClassSource)) {
      return super.validate(config, options);
    }

    const name = config.className;
    const source = config.testClassSource;
    // The validation endpoint requires `packagename`; without it the server
    // answers 400, so this cannot be left to the wire.
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }
    const packageName = config.packageName;

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Validating CDS unit test class name:', name);
      const named = await step(
        answering(
          () =>
            validateClassName(
              this.connection,
              name,
              packageName,
              config.description || `CDS unit test for ${name}`,
            ),
          this.results.validation as IResultStrategy<
            ReturnType<R['validation']>
          >,
          options?.analyse,
        ),
      );

      this.logger?.info?.('Validating CDS local test class code');
      await step(
        this.adtLocalTestClass.validate(
          { className: name, testClassCode: source },
          options,
        ),
      );

      return named;
    });
  }

  /**
   * Create the test class from a CDS template, and write the tests into it.
   *
   * Without a template there is no CDS-specific chain: creating the container
   * class and writing the tests into it is what the parent does.
   */
  override async create<E extends IAdtError = IAdtError>(
    config: ICdsUnitTestConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    if (!(config.className && config.classTemplate && config.testClassSource)) {
      return super.create(config, options);
    }

    const name = config.className;
    const source = config.testClassSource;
    this.className = name;

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Step 1: Creating global class with template');
      const created = (await step(
        this.adtClass.create(
          {
            className: name,
            packageName: config.packageName as string,
            description: config.description || `CDS unit test for ${name}`,
            classTemplate: config.classTemplate,
            transportRequest: config.transportRequest,
            final: true,
          },
          options,
        ),
      )) as ReturnType<R['created']>;

      // Activation is required before the testclasses include can be locked.
      this.logger?.info?.('Step 1.5: Activating global class');
      await step(this.adtClass.activate({ className: name }, options));

      // An include is not created — it exists because its class does — so this
      // is update, and adtLocalTestClass handles the locking internally.
      this.logger?.info?.('Step 2: Writing test class into global class');
      await step(
        this.adtLocalTestClass.update(
          {
            className: name,
            testClassCode: source,
            transportRequest: config.transportRequest,
          },
          { activateOnUpdate: true },
        ),
      );

      return created;
    });
  }

  /**
   * Replace the tests, and activate the container after the write.
   *
   * The forced activation is the difference from the parent: a CDS test class
   * that is written but not активated cannot be run.
   */
  override async update<E extends IAdtError = IAdtError>(
    config: Partial<ICdsUnitTestConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!(config.className && config.testClassSource)) {
      return super.update(config, options);
    }

    this.logger?.info?.('Updating CDS test class source:', config.className);
    return this.adtLocalTestClass.update(
      {
        className: config.className,
        testClassCode: config.testClassSource,
        transportRequest: config.transportRequest,
      },
      { ...options, activateOnUpdate: true },
    ) as Promise<IAdtResponse<ReturnType<R['updated']>, E>>;
  }

  /**
   * Delete the whole container class.
   *
   * The difference from the parent, which empties the include and leaves the
   * class: a CDS test class exists only to hold these tests, so removing the
   * tests means removing it.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<ICdsUnitTestConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deleted']>, E>> {
    if (!config.className) {
      return super.delete(config, options);
    }

    this.logger?.info?.(
      'Deleting CDS test class (global class):',
      config.className,
    );
    const answer = await this.adtClass.delete(
      {
        className: config.className,
        transportRequest: config.transportRequest,
      },
      options,
    );
    if (answer.ok) this.className = undefined;
    return answer as IAdtResponse<ReturnType<R['deleted']>, E>;
  }

  /**
   * Run the tests.
   *
   * A class name runs every test in that class by object name; an array of test
   * definitions is the parent's route.
   */
  override async run(
    testsOrClassName: IClassUnitTestDefinition[] | string,
    options?: IClassUnitTestRunOptions,
  ): Promise<IAdtResponse<ReturnType<R['run']>>> {
    if (typeof testsOrClassName !== 'string') {
      return super.run(testsOrClassName, options);
    }

    const className = testsOrClassName;
    if (!className) {
      throw new Error('Class name is required');
    }

    this.logger?.info?.('Starting unit test run for object:', className);
    const answer = await answering(
      () => startClassUnitTestRunByObject(this.connection, className, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      (verdict, wire) => {
        if (verdict !== ADT_NO_FAILURE) return verdict;
        return wire && runId(wire)
          ? ADT_NO_FAILURE
          : {
              origin: 'refusal' as const,
              message: 'Failed to start unit test run: run ID not returned',
              response: wire,
              request: requestOf(wire),
            };
      },
    );

    if (answer.ok) {
      this.lastRunId = String(answer.getResult().value);
      this.logger?.info?.('Unit test run started, runId:', this.lastRunId);
    }
    return answer;
  }

  /** The container class this instance created, if it made one. */
  getClassName(): string | undefined {
    return this.className;
  }

  /** The view this instance checked, if it checked one. */
  getCdsViewName(): string | undefined {
    return this.cdsViewName;
  }
}
