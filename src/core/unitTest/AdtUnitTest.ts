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
 */

import {
  AdtObjectErrorCodes,
  AdtOperationError,
  type HttpError,
  type IAbapConnection,
  type IAdtCreatable,
  type IAdtDeletable,
  type IAdtLockable,
  type IAdtOperationOptions,
  type IAdtReadable,
  type IAdtResponse,
  type IAdtRunnable,
  type IAdtUpdatable,
  type IAdtValidatable,
  type ILogger,
  type ITestRunInformation,
  type IUnitTestResultOptions,
} from '@mcp-abap-adt/interfaces';
import {
  headerValueToString,
  safeErrorMessage,
} from '../../utils/internalUtils';
import { AdtClass, AdtLocalTestClass } from '../class';
import { getClassUnitTestResult, getClassUnitTestStatus } from '../class/run';
import { startClassUnitTestRun } from './run';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IUnitTestConfig,
  IUnitTestState,
} from './types';

export class AdtUnitTest
  implements
    IAdtCreatable<IUnitTestConfig, IUnitTestState>,
    IAdtReadable<IUnitTestConfig, IUnitTestState>,
    IAdtUpdatable<IUnitTestConfig, IUnitTestState>,
    IAdtDeletable<IUnitTestConfig, IUnitTestState>,
    IAdtValidatable<IUnitTestConfig, IUnitTestState>,
    IAdtLockable<IUnitTestConfig, IUnitTestState>,
    IAdtRunnable<IClassUnitTestDefinition[], string, IClassUnitTestRunOptions>,
    ITestRunInformation
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  public readonly objectType: string = 'UnitTest';

  protected lastRunId?: string;
  protected lastStatusResponse?: IAdtResponse;
  protected lastResultResponse?: IAdtResponse;

  protected adtClass: AdtClass;
  protected adtLocalTestClass: AdtLocalTestClass;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
    this.adtClass = new AdtClass(connection, logger);
    this.adtLocalTestClass = new AdtLocalTestClass(connection, logger);
  }

  /**
   * Validate before writing.
   *
   * Two halves, and which apply depends on what is about to be born. The
   * container class is validated by name only when it does not exist yet —
   * `validateClassName` takes a package and a description, parameters that mean
   * nothing for an object already in the system. The test source is checked
   * whenever there is source to check.
   */
  async validate(config: Partial<IUnitTestConfig>): Promise<IUnitTestState> {
    if (!config.className) {
      throw new Error('Container class name is required for validation');
    }

    const state: IUnitTestState = { errors: [] };

    // Only "it is not there" routes to the create path. Everything else — an
    // auth failure, a 500, a dropped connection — is a fact about this request,
    // not about the class, and validating a *name* on the back of it would
    // report something that was never asked.
    const container = await this.adtClass
      .read({ className: config.className })
      .catch((error: unknown) => {
        const status = (error as HttpError)?.response?.status;
        const code = (error as { code?: string })?.code;
        if (status === 404 || code === AdtObjectErrorCodes.OBJECT_NOT_FOUND) {
          return undefined;
        }
        throw error;
      });

    if (!container) {
      // Nothing to test against yet: this is the create path, so the name is
      // genuinely new and gets the pre-creation check.
      const nameState = await this.adtClass.validate({
        className: config.className,
        packageName: config.packageName,
        description: config.description,
      });
      state.validationResponse = nameState.validationResponse;
    } else {
      state.readResult = container.readResult;
    }

    if (config.testClassSource !== undefined) {
      const codeState = await this.adtLocalTestClass.validate({
        className: config.className,
        testClassCode: config.testClassSource,
      });
      state.checkResult = codeState.validationResponse;
    }

    return state;
  }

  /**
   * Create the tests: the container class first, then the tests inside it.
   *
   * A POST brings the class into existence, activation makes it real, and the
   * include is written under the class's lock. `AdtCdsUnitTest` is this same
   * chain with a view check in front of it.
   */
  async create(
    config: IUnitTestConfig,
    options?: IAdtOperationOptions,
  ): Promise<IUnitTestState> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    if (config.testClassSource === undefined) {
      throw new Error('Test class source is required');
    }

    const state: IUnitTestState = { errors: [] };

    try {
      this.logger?.info?.('Step 1: Creating container class', config.className);
      const createState = await this.adtClass.create({
        className: config.className,
        packageName: config.packageName as string,
        description: config.description ?? `Unit tests ${config.className}`,
        classTemplate: config.classTemplate,
        transportRequest: config.transportRequest,
      });
      state.createResult = createState.createResult;

      this.logger?.info?.('Step 2: Activating container class');
      const activateState = await this.adtClass.activate({
        className: config.className,
      });
      state.activateResult = activateState.activateResult;

      this.logger?.info?.('Step 3: Writing tests into the class');
      const writeState = await this.adtLocalTestClass.update(
        {
          className: config.className,
          testClassCode: config.testClassSource,
          transportRequest: config.transportRequest,
        },
        { activateOnUpdate: options?.activateOnCreate ?? true },
      );
      state.updateResult = writeState.updateResult;

      return state;
    } catch (error: unknown) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /** Read the tests — the whole `testclasses` include of the container class. */
  async read(
    config: Partial<IUnitTestConfig>,
    version: 'active' | 'inactive' = 'active',
  ): Promise<IUnitTestState | undefined> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }

    try {
      const state = await this.adtLocalTestClass.read(
        { className: config.className },
        version,
      );
      if (!state) return undefined;
      return { readResult: state.readResult, errors: [] };
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /** Metadata of the container class — an include carries none of its own. */
  async readMetadata(
    config: Partial<IUnitTestConfig>,
  ): Promise<IUnitTestState> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    const state = await this.adtLocalTestClass.readMetadata({
      className: config.className,
    });
    return { metadataResult: state.metadataResult, errors: [] };
  }

  /**
   * Replace the tests in a class that already exists.
   *
   * `options.lockHandle` writes inside a lock the caller already holds, which is
   * the point of having both this and {@link create}: the container's lock is
   * taken once and a caller can update the class and its tests in one window.
   */
  async update(
    config: Partial<IUnitTestConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IUnitTestState> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    if (config.testClassSource === undefined && !options?.sourceCode) {
      throw new Error('Test class source is required');
    }

    const state = await this.adtLocalTestClass.update(
      {
        className: config.className,
        testClassCode: config.testClassSource,
        transportRequest: config.transportRequest,
      },
      options,
    );
    return { updateResult: state.updateResult, errors: [] };
  }

  /**
   * Remove the tests by writing an empty include.
   *
   * This deletes no ADT object: the container class stays, and every local test
   * class in the include goes, because the include is what ADT addresses.
   */
  async delete(config: Partial<IUnitTestConfig>): Promise<IUnitTestState> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    const state = await this.adtLocalTestClass.delete({
      className: config.className,
      transportRequest: config.transportRequest,
    });
    return { updateResult: state.updateResult, errors: [] };
  }

  /** Lock the container class — an include has no lock of its own. */
  async lock(config: Partial<IUnitTestConfig>): Promise<string> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    return await this.adtLocalTestClass.lock({ className: config.className });
  }

  /** Unlock the container class. */
  async unlock(
    config: Partial<IUnitTestConfig>,
    lockHandle: string,
  ): Promise<IUnitTestState> {
    if (!config.className) {
      throw new Error('Container class name is required');
    }
    await this.adtLocalTestClass.unlock(
      { className: config.className },
      lockHandle,
    );
    return { errors: [] };
  }

  /**
   * Run the tests, and return the run's id.
   *
   * Needs no `create` and no `update`: the tests may have been in the class for
   * years. Ask about the run through {@link getStatus} and {@link getResult}.
   */
  async run(
    tests: IClassUnitTestDefinition[],
    options?: IClassUnitTestRunOptions,
  ): Promise<string> {
    if (!tests || tests.length === 0) {
      throw new Error('At least one test definition is required');
    }

    this.logger?.info?.('Starting unit test run');
    const response = await startClassUnitTestRun(
      this.connection,
      tests,
      options,
    );

    const runId = this.extractRunId(response);
    if (!runId) {
      this.logger?.error?.(
        'Failed to extract run ID from response. Response data:',
        response.data,
      );
      const failed = new AdtOperationError(
        'Failed to start unit test run: run ID not returned',
      );
      failed.code = AdtObjectErrorCodes.CREATE_FAILED;
      throw failed;
    }

    this.logger?.info?.('Unit test run started, run ID:', runId);
    this.lastRunId = runId;
    return runId;
  }

  /** Run id of the most recent {@link run}, if one has been started here. */
  getRunId(): string | undefined {
    return this.lastRunId;
  }

  /** Poll a run. */
  async getStatus(
    runId: string,
    withLongPolling: boolean = true,
  ): Promise<IAdtResponse> {
    const response = await getClassUnitTestStatus(
      this.connection,
      runId,
      withLongPolling,
    );
    this.lastStatusResponse = response;
    return response;
  }

  /** Response of the most recent {@link getStatus}, if one has been made. */
  getStatusResponse(): IAdtResponse | undefined {
    return this.lastStatusResponse;
  }

  /** Fetch the result document of a finished run. */
  async getResult(
    runId: string,
    options?: IUnitTestResultOptions,
  ): Promise<IAdtResponse> {
    const response = await getClassUnitTestResult(
      this.connection,
      runId,
      options,
    );
    this.lastResultResponse = response;
    return response;
  }

  /** Response of the most recent {@link getResult}, if one has been made. */
  getResultResponse(): IAdtResponse | undefined {
    return this.lastResultResponse;
  }

  /**
   * Extract run ID from unit test run response
   */
  protected extractRunId(response: IAdtResponse): string | undefined {
    // First, try to extract from response headers (most reliable)
    const locationHeader =
      headerValueToString(response.headers?.location) ||
      headerValueToString(response.headers?.['content-location']) ||
      headerValueToString(response.headers?.['sap-adt-location']);
    if (locationHeader) {
      const runIdMatch = locationHeader.match(/\/runs\/([^/]+)/);
      if (runIdMatch) {
        return runIdMatch[1];
      }
    }

    // Fallback: parse from response body (XML)
    // Response is XML with aunit:run element
    // URI format: /sap/bc/adt/abapunit/runs/{runId}
    const data = response.data;
    if (typeof data === 'string') {
      const uriMatch = data.match(/uri="([^"]+)"/);
      if (uriMatch) {
        const runIdMatch = uriMatch[1].match(/\/runs\/([^/]+)/);
        if (runIdMatch) {
          return runIdMatch[1];
        }
      }
      const runMatch = data.match(/<aunit:run[^>]*uri="([^"]+)"/);
      if (runMatch) {
        const runIdMatch = runMatch[1].match(/\/runs\/([^/]+)/);
        if (runIdMatch) {
          return runIdMatch[1];
        }
      }
    } else if (data?.uri) {
      const runIdMatch = data.uri.match(/\/runs\/([^/]+)/);
      if (runIdMatch) {
        return runIdMatch[1];
      }
    }
    return undefined;
  }
}
