/**
 * AdtUnitTest — managing a class's tests, and running them.
 *
 * Two different things, and until 12.0.0 they shared one method: `create`
 * meant "start a run", which is why `update` and `delete` looked like
 * capabilities ADT withheld. They are not — the tests live in a class's
 * `testclasses` include, and `AdtLocalTestClass` has written them all along.
 *
 * | method | subject |
 * |---|---|
 * | `create` | the container class **and** its include — POST the class, activate it, PUT the tests in |
 * | `read`/`update`/`delete`/`validate` | the include of a class that already exists |
 * | `lock`/`unlock` | the container class, which is what ADT locks |
 * | `run` | a run, any number of times, needing no CRUD call at all |
 *
 * The container need not be the class under test: tests can live in a separate
 * class written for the purpose, which is what the CDS flavour does because a
 * view cannot hold a test class. So `className` here names the container; the
 * class under test appears only inside the ABAP source of the tests.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
  AdtNoFailure,
  IAbapConnection,
  IAdtCreatable,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtRunnable,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
  ITestRunInformation,
  IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE, AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { answering, type IAdtOptions } from '../../utils/adtResponse';
import { requestOf } from '../../utils/requestTrace';
import { AdtClass, AdtLocalTestClass } from '../class';
import { getClassUnitTestResult, getClassUnitTestStatus } from '../class/run';
import { chain } from '../shared/chain';
import { startClassUnitTestRun } from './run';
import {
  type IClassUnitTestDefinition,
  type IClassUnitTestRunOptions,
  type IUnitTestConfig,
  type IUnitTestResults,
  runId,
  unitTestDocuments,
} from './types';

/**
 * The shipped reading of a run that started without saying so.
 *
 * ADT answers a started run with its id in a header or in `aunit:run@uri`. An
 * answer carrying neither is not a run a caller can ask about, so it is a
 * failure named {@link AdtObjectErrorCodes.CREATE_FAILED} rather than an empty
 * string handed back as if it were an id.
 */
export const startedRun = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict !== ADT_NO_FAILURE) return verdict;
  return answer && runId(answer)
    ? ADT_NO_FAILURE
    : {
        origin: 'refusal',
        code: AdtObjectErrorCodes.CREATE_FAILED,
        message: 'Failed to start unit test run: run ID not returned',
        response: answer,
        request: requestOf(answer),
      };
};

export class AdtUnitTest<
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
> implements
    IAdtCreatable<IUnitTestConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IUnitTestConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IUnitTestConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IUnitTestConfig, ReturnType<R['deleted']>>,
    IAdtValidatable<IUnitTestConfig, ReturnType<R['validation']>>,
    IAdtLockable<IUnitTestConfig>,
    IAdtRunnable<
      IClassUnitTestDefinition[],
      ReturnType<R['run']>,
      IClassUnitTestRunOptions
    >,
    ITestRunInformation<ReturnType<R['status']>, ReturnType<R['result']>>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  public readonly objectType: string = 'UnitTest';

  protected lastRunId?: string;
  protected lastStatusResponse?: IAdtWireResponse;
  protected lastResultResponse?: IAdtWireResponse;

  protected adtClass: AdtClass;
  protected adtLocalTestClass: AdtLocalTestClass;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = unitTestDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = new AdtClass(connection, logger);
    this.adtLocalTestClass = new AdtLocalTestClass(connection, logger);
  }

  /** The container class's name, or the caller's mistake. */
  protected name(config: Partial<IUnitTestConfig>): string {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    return config.className;
  }

  /**
   * Validate what is about to be written.
   *
   * Two halves, and which apply depends on what is about to be born. The
   * container class is validated by name only when it does not exist yet —
   * `validateClassName` takes a package and a description, parameters that mean
   * nothing for an object already in the system. The test source is checked
   * whenever there is source to check.
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IUnitTestConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      // Which half of this runs depends on whether the container is there, and
      // only two answers mean "it is not": an empty body, which is how ADT says
      // absence on the systems measured, and a 404 from one that answers that
      // way instead. Anything else is a fact about the *request* — routing a
      // 500 into the create path would validate a NAME for a class that exists
      // and report something nobody asked (caught in review, 2026-08-14) — so
      // it is returned as the failure it is.
      const container = await this.adtClass.read({ className: name });
      const absent =
        !container.ok && container.getError().response?.status === 404;
      // Not `absent`, so `step` gets it: on success it is the source, and on
      // any other failure it abandons the chain carrying what SAP said.
      const source = absent ? '' : await step(Promise.resolve(container));
      const exists = String(source) !== '';

      let verdict = undefined as ReturnType<R['validation']>;
      if (!exists) {
        verdict = (await step(
          this.adtClass.validate(
            {
              className: name,
              packageName: config.packageName,
              description: config.description,
            },
            options,
          ),
        )) as ReturnType<R['validation']>;
      }

      if (config.testClassSource !== undefined) {
        verdict = (await step(
          this.adtLocalTestClass.validate(
            { className: name, testClassCode: config.testClassSource },
            options,
          ),
        )) as ReturnType<R['validation']>;
      }

      return verdict;
    });
  }

  /**
   * Create the tests: the container class first, then the tests inside it.
   *
   * A POST brings the class into existence, activation makes it real, and the
   * include is written under the class's lock. `AdtCdsUnitTest` is this same
   * chain with a view check in front of it.
   *
   * The answer is the class create's. Whether the tests were written after it
   * is this implementation's business — and a failure there is still returned,
   * because it is why the tests are not what was asked for.
   */
  async create<E extends IAdtError = IAdtError>(
    config: IUnitTestConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    if (config.testClassSource === undefined) {
      throw new Error('Test class source is required');
    }
    const source = config.testClassSource;

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Step 1: Creating container class', name);
      const created = (await step(
        this.adtClass.create(
          {
            className: name,
            packageName: config.packageName as string,
            description: config.description ?? `Unit tests ${name}`,
            classTemplate: config.classTemplate,
            transportRequest: config.transportRequest,
          },
          options,
        ),
      )) as ReturnType<R['created']>;

      this.logger?.info?.('Step 2: Activating container class');
      await step(this.adtClass.activate({ className: name }, options));

      this.logger?.info?.('Step 3: Writing tests into the class');
      await step(
        this.adtLocalTestClass.update(
          {
            className: name,
            testClassCode: source,
            transportRequest: config.transportRequest,
          },
          { activateOnUpdate: options?.activateOnCreate ?? true },
        ),
      );

      return created;
    });
  }

  /** Read the tests — the whole `testclasses` include of the container class. */
  async read(
    config: Partial<IUnitTestConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);
    return this.adtLocalTestClass.read(
      { className: name },
      version,
      options,
    ) as Promise<IAdtResponse<ReturnType<R['source']>>>;
  }

  /** Metadata of the container class — an include carries none of its own. */
  async readMetadata(
    config: Partial<IUnitTestConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);
    return this.adtLocalTestClass.readMetadata(
      { className: name },
      options,
    ) as Promise<IAdtResponse<ReturnType<R['metadata']>>>;
  }

  /**
   * Replace the tests in a class that already exists.
   *
   * `options.lockHandle` writes inside a lock the caller already holds, which is
   * the point of having both this and {@link create}: the container's lock is
   * taken once and a caller can update the class and its tests in one window.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IUnitTestConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    if (
      config.testClassSource === undefined &&
      options?.sourceCode === undefined
    ) {
      throw new Error('Test class source is required');
    }

    return this.adtLocalTestClass.update(
      {
        className: name,
        testClassCode: config.testClassSource,
        transportRequest: config.transportRequest,
      },
      options,
    ) as Promise<IAdtResponse<ReturnType<R['updated']>, E>>;
  }

  /**
   * Remove the tests by writing an empty include.
   *
   * This deletes no ADT object: the container class stays, and every local test
   * class in the include goes, because the include is what ADT addresses.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IUnitTestConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deleted']>, E>> {
    const name = this.name(config);
    return this.adtLocalTestClass.delete(
      { className: name, transportRequest: config.transportRequest },
      options,
    ) as Promise<IAdtResponse<ReturnType<R['deleted']>, E>>;
  }

  /** Lock the container class — an include has no lock of its own. */
  async lock(config: Partial<IUnitTestConfig>): Promise<IAdtResponse<string>> {
    return this.adtLocalTestClass.lock({ className: this.name(config) });
  }

  /** Unlock the container class. */
  async unlock(
    config: Partial<IUnitTestConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    return this.adtLocalTestClass.unlock(
      { className: this.name(config) },
      lockHandle,
    );
  }

  /**
   * Run the tests, and answer the run's id.
   *
   * Needs no `create` and no `update`: the tests may have been in the class for
   * years. Ask about the run through {@link getStatus} and {@link getResult}.
   */
  async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions,
  ): Promise<IAdtResponse<ReturnType<R['run']>>> {
    if (!tests || tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    this.logger?.info?.('Starting unit test run');
    const answer = await answering(
      () => startClassUnitTestRun(this.connection, tests, options),
      this.results.run as IResultStrategy<ReturnType<R['run']>>,
      startedRun,
    );

    if (answer.ok) {
      // Remembered for getRunId(), which exists so a caller can ask later
      // without threading the id through their own code.
      this.lastRunId = String(answer.getResult().value);
      this.logger?.info?.('Unit test run started, run ID:', this.lastRunId);
    }
    return answer;
  }

  /** Run id of the most recent {@link run}, if one has been started here. */
  getRunId(): string | undefined {
    return this.lastRunId;
  }

  /** Poll a run. */
  async getStatus(
    runIdentifier: string,
    withLongPolling: boolean = true,
  ): Promise<IAdtResponse<ReturnType<R['status']>>> {
    return answering(
      async () => {
        const response = await getClassUnitTestStatus(
          this.connection,
          runIdentifier,
          withLongPolling,
        );
        this.lastStatusResponse = response;
        return response;
      },
      this.results.status as IResultStrategy<ReturnType<R['status']>>,
    );
  }

  /** Answer of the most recent {@link getStatus}, if one has been made. */
  getStatusResponse(): IAdtWireResponse | undefined {
    return this.lastStatusResponse;
  }

  /** Fetch the result document of a finished run. */
  async getResult(
    runIdentifier: string,
    options?: IUnitTestResultOptions,
  ): Promise<IAdtResponse<ReturnType<R['result']>>> {
    return answering(
      async () => {
        const response = await getClassUnitTestResult(
          this.connection,
          runIdentifier,
          options,
        );
        this.lastResultResponse = response;
        return response;
      },
      this.results.result as IResultStrategy<ReturnType<R['result']>>,
    );
  }

  /** Answer of the most recent {@link getResult}, if one has been made. */
  getResultResponse(): IAdtWireResponse | undefined {
    return this.lastResultResponse;
  }
}
