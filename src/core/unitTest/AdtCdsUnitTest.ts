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
  IAdtAnalyseOptions,
  IAdtCreateOptions,
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  ICdsTestDoubleCheckable,
  ICdsUnitTestConfig,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { startClassUnitTestRunByObject } from '../class/run';
import { validateClassName } from '../class/validation';
import { AdtDdl } from '../ddl/AdtDdl';
import { AdtUnitTest } from './AdtUnitTest';
import { checkCdsTestDoublesAvailability } from './checkCdsTestDoublesAvailability';
import {
  type IClassUnitTestDefinition,
  type IClassUnitTestRunOptions,
  type IUnitTestResults,
  unitTestDocuments,
} from './types';

export class AdtCdsUnitTest<
    R extends IUnitTestResults = typeof unitTestDocuments,
  >
  extends AdtUnitTest<R>
  implements ICdsTestDoubleCheckable<ReturnType<R['cdsCheck']>>
{
  protected adtView: AdtDdl;

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
  async checkCdsTestDoubles<E extends IAdtError = IAdtError>(
    cdsViewName: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['cdsCheck']>, E>> {
    this.logger?.info?.(
      'Checking CDS view for unit test doubles:',
      cdsViewName,
    );
    // The verdict is `SEVERITY` inside a 200; `analyseCdsTestDoubles` in
    // @mcp-abap-adt/adt-strategies reads it for a caller who passes it.
    return answering(
      () => checkCdsTestDoublesAvailability(this.connection, cdsViewName),
      this.results.cdsCheck as IResultStrategy<ReturnType<R['cdsCheck']>>,
      options?.analyse,
    );
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    if (!(config.className && config.classTemplate && config.source)) {
      return super.validate(config, options);
    }

    const name = config.className as string;
    // The validation endpoint requires `packagename`; without it the server
    // answers 400, so this cannot be left to the wire.
    const packageName = config.packageName as string;

    return answering(
      () =>
        validateClassName(
          this.connection,
          name,
          packageName,
          config.description || `CDS unit test for ${name}`,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /**
   * Create the test class from a CDS template.
   *
   * Without a template there is no CDS-specific chain: creating the container
   * class is what the parent does. The tests go in afterwards, through
   * {@link update}, under the caller's lock.
   *
   * **The template is what selects this path, and it is the only thing that
   * can.** This used to require a source as well — `className && classTemplate
   * && testClassSource` — and the source was then never used in the branch
   * below, which posts the class and nothing else. `IAdtCreatable.create`
   * excludes the payload from its config as of `interfaces-adt` 6.0.0, so that
   * condition could no longer be met by anyone and the template path became
   * unreachable. The template alone says what this create is for.
   */
  override async create<E extends IAdtError = IAdtError>(
    config: Omit<ICdsUnitTestConfig, 'source'> & { source?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    if (!(config.className && config.classTemplate)) {
      return super.create(config, options);
    }

    const name = config.className as string;

    return this.adtClass.create(
      {
        className: name,
        packageName: config.packageName as string,
        description: config.description || `CDS unit test for ${name}`,
        classTemplate: config.classTemplate,
        transportRequest: config.transportRequest,
        final: true,
      },
      options,
    ) as Promise<IAdtResponse<ReturnType<R['created']>, E>>;
  }

  /**
   * Replace the tests, and activate the container after the write.
   *
   * The forced activation is the difference from the parent: a CDS test class
   * that is written but not activated cannot be run.
   */
  override async update<E extends IAdtError = IAdtError>(
    config: Partial<ICdsUnitTestConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!(config.className && config.source)) {
      return super.update(config, options);
    }

    this.logger?.info?.('Updating CDS test class source:', config.className);
    return this.adtLocalTestClass.update(
      {
        className: config.className,
        source: config.source,
        transportRequest: config.transportRequest,
      },
      options,
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
    options?: IAdtOperationOptions<E>,
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
    return answer as IAdtResponse<ReturnType<R['deleted']>, E>;
  }

  /**
   * Run the tests.
   *
   * A class name runs every test in that class by object name; an array of test
   * definitions is the parent's route.
   */
  override async run<E extends IAdtError = IAdtError>(
    testsOrClassName: IClassUnitTestDefinition[] | string,
    options?: IClassUnitTestRunOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    if (typeof testsOrClassName !== 'string') {
      return super.run(testsOrClassName, options);
    }

    const className = testsOrClassName;
    this.logger?.info?.('Starting unit test run for object:', className);
    return answering(
      () => startClassUnitTestRunByObject(this.connection, className, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      options?.analyse,
    );
  }
}
