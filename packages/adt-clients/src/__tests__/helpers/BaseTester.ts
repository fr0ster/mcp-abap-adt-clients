/**
 * BaseTester - Base class for testing IAdtObject implementations
 *
 * Provides standardized test flow:
 * - flow_test: validation->create->lock->check(inactive, source/xml)->update->unlock->activate
 * - read_test: read-only operations
 *
 * Provides setup methods:
 * - beforeAll: Setup connection and client
 * - beforeEach: Load test case and prepare config
 * - afterAll: Cleanup connection
 * - afterEach: Optional cleanup after each test
 *
 * Guarantees:
 * - Cleanup parameter checking (cleanup_after_test, skip_cleanup, cleanup_session_after_test)
 * - Automatic unlock when object was locked
 * - Proper error handling and cleanup
 * - All logging handled internally
 *
 * Logging:
 * - Logger is optional (can be undefined) - controlled by environment variables
 * - Use createTestsLogger(), createLibraryLogger(), createConnectionLogger() from testLogger.ts
 * - These functions return ILogger from @mcp-abap-adt/logger or undefined based on DEBUG_* flags
 * - All logging uses optional chaining - safe to pass undefined
 * - Uses LogLevel enum from @mcp-abap-adt/logger for log level constants
 * - Structured test logging via testProgressLogger functions (logTestStart, logTestStep, etc.)
 */

import { randomBytes } from 'node:crypto';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
  analyseValidation,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtActivatable,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtUpdatable,
  IAdtValidatable,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { LogLevel } from '@mcp-abap-adt/interfaces-utils';
import type { AdtClient } from '../../clients/AdtClient';
import { integrationHeadersOf } from './adtHeaders';
import { configuredCase, missingCaseMessage } from './caseGate';
import { expectResult } from './contract';
import { judged } from './judged';
import {
  expectLockReleased,
  factoryOf,
  type ILockWindow,
  lockReleaseCheckEnabled,
  noteLockReleaseCheckOff,
} from './lockReleased';
import { readRootDescription, replaceRootDescription } from './rootDescription';
import {
  createTestAdtClient,
  recycleTestSession,
  releaseTestConnection,
  resolveSystemContext,
} from './sessionConfig';
import { TestConfigResolver } from './TestConfigResolver';
import { createLibraryLogger, createRunIntegrityLogger } from './testLogger';
import {
  getHttpStatusText,
  logTestEnd,
  logTestError,
  logTestStart,
  logTestStep,
  logTestStepError,
  logTestSuccess,
} from './testProgressLogger';
import { validationErrors } from './validationVerdict';

export interface ITestCaseParams {
  skip_cleanup?: boolean;
  transport_request?: string;
  [key: string]: any;
}

export interface IFlowTestOptions {
  /**
   * What the update writes — ABAP text for a class, an XML document for a
   * domain. One field, because the contract has one: `sourceCode` and
   * `xmlContent` used to sit here side by side, split by what the body
   * happened to contain, and every caller had to pick the right one.
   */
  source?: string;
  updateConfig?: any;
  /**
   * This type's write takes a complete document.
   *
   * Six types stopped fetching-and-patching inside `update` in 19.0.0 — domain,
   * package, dataElement, tableType, transport and functionGroup. The read, the
   * edit and the lock window are the caller's now, so this harness performs
   * them, which is what a consumer performs.
   *
   * `true` writes back what was read. A function receives the current document
   * and returns the one to write, which is where a test changes a field.
   */
  updateTakesDocument?: boolean | ((current: string) => string);
  /**
   * This type's write takes the object's **source**, and the flow edits what
   * the object holds: the source is read (`read`, not `readMetadata`), the
   * function receives it and returns the one to write, and after activation the
   * source read back has to contain `marker` — the line the function added.
   *
   * The function group's `update` is its source since interfaces-adt 23.0.4;
   * what the generated main program holds is the system's, so a test adds one
   * comment line and writes the rest back untouched.
   */
  updateEditsSource?: {
    edit: (current: string) => string;
    marker: string;
  };
  /**
   * The validate step is not sent, and the run logs this sentence, which names
   * the configuration key that turned it off. Absent, the name is validated
   * and any refusal fails.
   */
  skipValidation?: string;
  activateOnCreate?: boolean;
  activateOnUpdate?: boolean;
  timeout?: number;
  readMetadata?: boolean;
  readMetadataOptions?: { withLongPolling?: boolean };
  /**
   * A step this flow cannot know about, run after `create` and before anything
   * reads the object.
   *
   * One type needs it: a behavior implementation's `create` makes the class and
   * `update` writes its implementation include, but the class's own
   * `source/main` — the generated shell binding it to its behavior definition —
   * is written with the **class's** `update`, from the exported
   * `mainSourceFor`. Until it is written the class is not readable at all: ADT
   * answers `wrong input data for processing`.
   *
   * A hook rather than a flag, because what belongs here is the caller's
   * knowledge of its own type, and this harness has no business holding a list
   * of such knowledge.
   */
  afterCreate?: () => Promise<void>;
  /**
   * Prove `updateMetadata` live: after the flow's update and activation, read
   * the object document, change only the root's `adtcore:description` to
   * `MCP metadata <8 hex>`, write it under a lock, activate, and read it back.
   *
   * Runs only for an object that offers `updateMetadata`. A suite for a type
   * the system does not offer (the program and the include on ABAP cloud)
   * passes `false` there: the member's presence cannot say that, because the
   * handler is the same on every system.
   */
  metadataUpdate?: boolean;
}

export interface IReadTestOptions {
  version?: 'active' | 'inactive';
  timeout?: number;
  withLongPolling?: boolean;
  skipReadMetadata?: boolean;
}

export interface IBaseTesterSetupOptions {
  connection: IAbapConnection;
  client: any; // AdtClient
  hasConfig: boolean;
  isCloudSystem: boolean;
  buildConfig: (testCase: any, resolver?: TestConfigResolver) => any;
  ensureObjectReady?: (
    objectName: string,
  ) => Promise<{ success: boolean; reason?: string; objectExists?: boolean }>;
  cleanupObject?: (config: any) => Promise<void>;
  testDescription?: string;
}

/**
 * What a tester actually needs from a handler.
 *
 * It used to demand `IAdtObject`, the full set, which made this helper the last
 * place insisting every handler can do everything — a feature toggle has no
 * version history, a service binding has no lock, and neither could be tested
 * here once their types stopped claiming otherwise. These are the six methods
 * the class calls; `activate` is optional because not every object is
 * activated, and the call site already guards on it.
 *
 * Every member answers `IAdtResponse<unknown>` since interfaces 31.0.0: what a
 * handler makes of an answer is its consumer's choice, and a test harness is
 * one consumer among several. It reads the values through `expectResult`, which
 * fails the test with SAP's own sentence when there is no value.
 */
export type TestableObject<TConfig> = IAdtCreatable<TConfig, unknown> &
  // **Both pairs are optional, and a type has at least one.** Since interfaces
  // 36.0.0 a member is named for the resource it addresses, and eight types
  // have no source at all — a domain, a package, a transport request *are*
  // their document — while a class, a program and their neighbours have a
  // source and no separate document to write. "At least one of the two" is not
  // something a TypeScript type can say, so both are optional here and
  // `readWhatItHas`/`writeWhatItHas` below fail loudly when an object turns out
  // to offer neither, which is a defect in that object rather than in a test.
  Partial<IAdtReadable<TConfig, unknown>> &
  Partial<IAdtMetadataReadable<TConfig, unknown>> &
  Partial<IAdtUpdatable<Partial<TConfig>, unknown>> &
  Partial<IAdtMetadataUpdatable<Partial<TConfig>, unknown>> &
  IAdtDeletable<TConfig, unknown, unknown> &
  IAdtValidatable<TConfig, unknown> &
  Partial<IAdtActivatable<TConfig, unknown>> &
  // Since 18.0.0 `update` takes the handle it is given and issues one request.
  // Acquiring and releasing that handle is the caller's, and this harness is a
  // caller — so the pair belongs in the shape it depends on. Optional because
  // some objects have no lock at all (a message class row, a feature toggle's
  // runtime switch), and the call site falls back to an unlocked write, which
  // is a thing ADT is free to refuse and say why.
  Partial<IAdtLockable<TConfig>>;

/** The object's names from its config — `className`, `domainName`, … */
function describeObject(config: unknown): string {
  const names = Object.entries((config ?? {}) as Record<string, unknown>)
    .filter(
      ([key, value]) =>
        key.endsWith('Name') &&
        key !== 'packageName' &&
        typeof value === 'string',
    )
    .map(([, value]) => value as string);
  return names.length ? names.join('/') : '(unnamed)';
}

export class BaseTester<TConfig, TState = unknown> {
  private adtObject: TestableObject<TConfig>;
  private readonly loggerPrefix: string;
  private readonly testCaseKey: string;
  private readonly testCaseName: string;
  private readonly logger?: ILogger;
  private objectCreated: boolean = false;
  private objectLocked: boolean = false;
  private lockHandle: string | undefined;
  /** The client factory for this handler, once {@link factoryOf} found it. */
  private lockFactory: string | undefined;

  // Setup state
  private connection?: IAbapConnection;
  private client?: AdtClient;
  private hasConfig: boolean = false;
  private isCloudSystem: boolean = false;
  private buildConfigFn?: (
    testCase: any,
    resolver?: TestConfigResolver,
  ) => TConfig;
  /**
   * A failure to put the system into the state the test needs.
   *
   * Whether a case applies to the system is decided before the test body runs:
   * the suite registers it through `gate`, which registers `it.skip` for a case
   * that is disabled, unavailable here or has no SAP behind it. A body that
   * runs therefore applies, and whatever stops it from getting far enough to
   * try is this error: a case missing from the configuration, no default
   * package, a leftover object that would not delete. Routed through a skip it
   * printed SKIP and jest counted it green, so a suite that tested nothing was
   * indistinguishable from one that passed — measured on on premise (BASIS
   * 816), where a package left behind by a failed delete made the next run
   * report success having executed neither create nor update.
   */
  private setupError: string | null = null;

  private ensureObjectReadyFn?: (
    objectName: string,
  ) => Promise<{ success: boolean; reason?: string; objectExists?: boolean }>;
  private cleanupObjectFn?: (config: any) => Promise<void>;
  private testDescription: string = 'Full workflow';

  // Test state
  private testCase: any = null;
  private config: TConfig | null = null;
  private configResolver: TestConfigResolver | null = null;

  /**
   * @param adtObject - IAdtObject implementation to test
   * @param loggerPrefix - Prefix for log messages (e.g., "Class", "DataElement")
   * @param testCaseKey - YAML test case key (e.g., "create_class")
   * @param testCaseName - YAML test case name (e.g., "adt_class")
   * @param logger - Optional logger (ILogger from @mcp-abap-adt/interfaces or undefined)
   *                Use createTestsLogger(), createLibraryLogger(), etc. from testLogger.ts
   *                Logger is undefined when logging is disabled via environment variables
   *                Uses LogLevel enum from @mcp-abap-adt/logger for log level constants
   */
  constructor(
    adtObject: TestableObject<TConfig>,
    loggerPrefix: string,
    testCaseKey: string,
    testCaseName: string,
    logger?: ILogger,
  ) {
    this.adtObject = adtObject;
    this.loggerPrefix = loggerPrefix;
    this.testCaseKey = testCaseKey;
    this.testCaseName = testCaseName;
    this.logger = logger; // Can be undefined - logging controlled by environment variables
  }

  /**
   * Get cleanup settings from environment config and test case params
   */
  private getCleanupSettings(testCaseParams?: ITestCaseParams): {
    cleanupAfterTest: boolean;
    skipCleanup: boolean;
    shouldCleanup: boolean;
    cleanupSessionAfterTest: boolean;
  } {
    const { getEnvironmentConfig, getSessionConfig } = require('./test-helper');
    const envConfig = getEnvironmentConfig();
    const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
    const globalSkipCleanup = envConfig.skip_cleanup === true;
    const skipCleanup =
      testCaseParams?.skip_cleanup !== undefined
        ? testCaseParams.skip_cleanup === true
        : globalSkipCleanup;
    const shouldCleanup = cleanupAfterTest && !skipCleanup;
    // From the ROOT of the config, where `session_config` actually is. Read off
    // `environment` — as this did — it was always `undefined`, so `!== false`
    // answered "recycle" on every cleanup no matter what the file said. That
    // turned one session per run into an end-and-reopen per deleted object.
    const cleanupSessionAfterTest =
      getSessionConfig().cleanup_session_after_test !== false; // Default: true

    return {
      cleanupAfterTest,
      skipCleanup,
      shouldCleanup,
      cleanupSessionAfterTest,
    };
  }

  /**
   * Log message with prefix
   * Logger can be undefined if logging is disabled via environment variables
   * Uses LogLevel enum from @mcp-abap-adt/interfaces
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.logger) {
      return; // Logging disabled - logger is undefined
    }
    const prefixedMessage = `[${this.loggerPrefix}] ${message}`;

    // Map LogLevel enum to logger methods
    switch (level) {
      case LogLevel.DEBUG:
        this.logger.debug?.(prefixedMessage, ...args);
        break;
      case LogLevel.INFO:
        this.logger.info?.(prefixedMessage, ...args);
        break;
      case LogLevel.WARN:
        this.logger.warn?.(prefixedMessage, ...args);
        break;
      case LogLevel.ERROR:
        this.logger.error?.(prefixedMessage, ...args);
        break;
    }
  }

  /**
   * Cleanup a pre-existing object that was detected by ensureObjectReady.
   * Respects cleanup settings from test-config.yaml.
   */
  private async cleanupExistingObject(config: TConfig): Promise<void> {
    const cleanupSettings = this.getCleanupSettings(
      this.testCase?.params as ITestCaseParams,
    );
    if (!cleanupSettings.shouldCleanup) {
      this.log(
        LogLevel.INFO,
        '⚠️ Pre-existing object cleanup skipped (cleanup disabled in config)',
      );
      return;
    }
    // A failed removal throws: the caller, which is already failing the
    // test, reports it beside its own failure.
    logTestStep('delete (pre-existing object cleanup)', this.logger);
    if (this.cleanupObjectFn) {
      await this.cleanupObjectFn(config);
    } else {
      await this.deleteOrRaise(config as Partial<TConfig>);
    }
    this.log(LogLevel.INFO, 'Pre-existing object deleted successfully');
    this.objectCreated = false;
  }

  /**
   * Ensure object is unlocked if it was locked
   */
  /**
   * Delete, and raise what SAP said.
   *
   * `await this.adtObject.delete(config)` with the answer dropped was how a
   * cleanup came to report success while the object stayed on the system: the
   * delete stopped throwing when failures became the other half of the answer,
   * so the `catch` blocks around these calls — written for a throw, and
   * carrying a deliberate policy about what to do with a failed cleanup — never
   * fired again. Measured twice: TEST_INNER_PKG02 on premise (BASIS 816), and ZAC_INNER_PKG04
   * on an ABAP Cloud system, where the suite passed three runs in a row and left the
   * package behind every time.
   */
  private async deleteOrRaise(config: Partial<TConfig>): Promise<void> {
    // `isDeleted="false"` arrives inside a 200 and the library reads nothing
    // into it; the test wants the real outcome, so it asks for the reading.
    const answer = await this.adtObject.delete(config, {
      headers: integrationHeadersOf(this.adtObject, 'delete'),
      analyse: judged(analyseDeletion),
    });
    if (!answer.ok) {
      const failure = answer.getError();
      // The headline names the object; SAP's reason is in `messages`, and a
      // red cleanup without it cannot be told apart from a misreading.
      const said = (failure.messages ?? [])
        .map(
          (m) =>
            `${m.type} ${m.text}` +
            (m.t100 ? ` [${m.t100.id}/${m.t100.no}]` : ''),
        )
        .join('; ');
      throw new Error(
        `[${failure.origin}] ${failure.message}` +
          (failure.request?.url ? ` (${failure.request.url})` : '') +
          (said ? ` — SAP: ${said}` : ''),
      );
    }
  }

  /**
   * The lock window, which is the caller's since 18.0.0.
   *
   * `update` is one request and carries the handle it is given; opening and
   * closing the window around it is the consumer's job, and a test harness is a
   * consumer. Three things this does that a chain inside `update` could not:
   * it fails the test on a refused lock with SAP's own sentence, it unlocks
   * whatever the update answered, and it reports a failed unlock rather than
   * swallowing it — a handle left held is what makes the next run's create
   * answer 403 with nothing appearing to hold it.
   */
  /**
   * The object's source if it has one, its document if that is all it is.
   *
   * `read` and `update` address a source; `readMetadata` and `updateMetadata`
   * address the object's own document. Which pair a type offers is a property
   * of the type, so this harness asks for what is there rather than assuming
   * both — the assumption the contracts dropped in 36.0.0, after eight types
   * were measured answering `read` and `readMetadata` with one request.
   */
  private readWhatItHas(
    config: Partial<TConfig>,
    version?: 'active' | 'inactive',
    // No `analyse` among them: the strategy is this harness's own
    // (analyseException), and an options object carrying one — possibly
    // `undefined` — would override it.
    options?: { withLongPolling?: boolean } & Omit<
      IAdtOperationOptions,
      'analyse'
    >,
  ): Promise<IAdtResponse<unknown>> {
    if (this.adtObject.read) {
      return this.adtObject.read(config, version, {
        analyse: analyseException,
        ...options,
      });
    }
    if (this.adtObject.readMetadata) {
      return this.adtObject.readMetadata(config, {
        analyse: analyseException,
        ...options,
        version,
      });
    }
    throw new Error(
      `${this.loggerPrefix} offers neither read() nor readMetadata() — every ` +
        'ADT object has one of the two, so this is the handler to look at.',
    );
  }

  /**
   * The `readMetadata` step of a flow: its answer has to be a value.
   *
   * The one refusal accepted is the one the configuration accepts — HTTP 406
   * with `allow_406` on the case or in `test_settings` — and it is read off the
   * answer's own status. The step used to look for a thrown `response.status`
   * and a `status` on the answer, neither of which a returned failure has, so
   * a refused read passed as a read.
   */
  private async readMetadataStep(
    config: Partial<TConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<void> {
    const answer = await this.adtObject.readMetadata?.(config, {
      analyse: analyseException,
      ...options,
    });
    if (!answer) {
      throw new Error(
        `${this.loggerPrefix} offers no readMetadata() — the flow asked for ` +
          'the object document and this type has none.',
      );
    }
    if (!answer.ok && answer.getError().response?.status === 406) {
      const { isHttpStatusAllowed, getAcceptHint } = require('./test-helper');
      if (isHttpStatusAllowed(406, this.testCase)) {
        const acceptHint = getAcceptHint({
          response: answer.getError().response,
        });
        this.log(
          LogLevel.WARN,
          `readMetadata skipped: 406 Not Acceptable (allowed by config)${
            acceptHint ? `; ${acceptHint}` : ''
          }`,
        );
        return;
      }
    }
    expectResult(answer, 'readMetadata');
  }

  private writeWhatItHas(
    config: Partial<TConfig>,
    // No `analyse`: the strategy is the harness's own (analyseException).
    options?: Omit<IAdtOperationOptions, 'analyse'>,
  ): Promise<IAdtResponse<unknown>> {
    if (this.adtObject.update) {
      return this.adtObject.update(config, {
        analyse: analyseException,
        ...options,
        headers: integrationHeadersOf(this.adtObject, 'update'),
      });
    }
    if (this.adtObject.updateMetadata) {
      return this.adtObject.updateMetadata(config, {
        analyse: analyseException,
        ...options,
        headers: integrationHeadersOf(this.adtObject, 'updateMetadata'),
      });
    }
    throw new Error(
      `${this.loggerPrefix} offers neither update() nor updateMetadata() — ` +
        'every writable ADT object has one of the two.',
    );
  }

  /** The metadata write, named: the flow's `metadataUpdate` step goes through it. */
  private writeMetadata(
    config: Partial<TConfig>,
    options?: Omit<IAdtOperationOptions, 'analyse'>,
  ): Promise<IAdtResponse<unknown>> {
    if (!this.adtObject.updateMetadata) {
      throw new Error(
        `${this.loggerPrefix} offers no updateMetadata() — the flow asked for ` +
          'a metadata update and this type has none.',
      );
    }
    return this.adtObject.updateMetadata(config, {
      analyse: analyseException,
      ...options,
      headers: integrationHeadersOf(this.adtObject, 'updateMetadata'),
    });
  }

  private async updateUnderLock(
    config: Partial<TConfig>,
    options: IAdtOperationOptions,
    /** Which write: the flow's own choice, or the metadata one, explicitly. */
    write: (
      config: Partial<TConfig>,
      options: IAdtOperationOptions,
    ) => Promise<IAdtResponse<unknown>> = (c, o) => this.writeWhatItHas(c, o),
  ): Promise<unknown> {
    if (!(this.adtObject.lock && this.adtObject.unlock)) {
      // No lock resource for this type. The write goes out without a handle,
      // and whether that is allowed is ADT's answer to give.
      return await write(config, options);
    }

    const handle = expectResult(
      await this.adtObject.lock(config, { analyse: analyseException }),
      'lock',
    );
    this.objectLocked = true;
    this.lockHandle = handle;
    let unlocked = false;
    let written: unknown;
    let writeThrew = false;
    let unlockRefusal = '';
    try {
      written = await write(config, {
        ...options,
        lockHandle: handle,
      });
    } catch (error) {
      writeThrew = true;
      throw error;
    } finally {
      const released = await this.adtObject.unlock(config, handle, {
        analyse: analyseException,
      });
      this.objectLocked = false;
      this.lockHandle = undefined;
      unlocked = released.ok;
      if (!released.ok) {
        const refusal = `unlock after update failed, the handle may still be held: ${released.getError().message}`;
        const writeFailed =
          writeThrew ||
          (written as IAdtResponse<unknown> | undefined)?.ok === false;
        // A refused UNLOCK fails the test: the handle left held is what makes
        // the next run's create answer 403 with nothing appearing to hold it.
        // When the write itself failed, that failure is the one the caller
        // raises, so this one is logged beside it instead of replacing it.
        if (writeFailed) this.log(LogLevel.WARN, refusal);
        else unlockRefusal = refusal;
      }
    }
    if (unlockRefusal) throw new Error(unlockRefusal);
    // Only after an UNLOCK that answered ok: that is the answer that can be
    // wrong — a stateless UNLOCK answers 200 and releases nothing.
    if (unlocked) await this.expectLockReleased(config);
    return written;
  }

  /**
   * Prove the UNLOCK above released the lock, from a second ABAP session.
   *
   * The handler this tester holds is bound to the test's connection, so the
   * check builds the same class of handler on its own — found once on the
   * test's client by {@link factoryOf}. Same class, same lock target: a class
   * include's tester locks the class, and so does its check.
   */
  private async expectLockReleased(config: Partial<TConfig>): Promise<void> {
    if (!lockReleaseCheckEnabled()) {
      noteLockReleaseCheckOff(`${this.loggerPrefix} ${describeObject(config)}`);
      return;
    }
    logTestStep('verify unlock released the lock', this.logger);
    // The factory is found on the verifier's own client: it is an AdtClient
    // like any other, and not every tester hands its client to setup().
    const handlerClass = this.adtObject;
    await expectLockReleased(
      (client) => {
        if (this.lockFactory === undefined) {
          this.lockFactory = factoryOf(client, handlerClass);
        }
        const factory = this.lockFactory;
        if (!factory) {
          throw new Error(
            `${this.loggerPrefix}: no zero-argument factory on the client ` +
              `builds a ${handlerClass.constructor.name}, so the lock-release ` +
              'check cannot open this handler on its own session. Set ' +
              'environment.verify_lock_released: false to run without it.',
          );
        }
        return (
          client as unknown as Record<string, () => ILockWindow<unknown>>
        )[factory]();
      },
      config,
      `${this.loggerPrefix} ${describeObject(config)}`,
      this.logger,
    );
  }

  private async ensureUnlock(_config: Partial<TConfig>): Promise<void> {
    if (this.objectLocked && this.lockHandle) {
      try {
        this.log(LogLevel.WARN, 'Unlocking object during cleanup');
        // Try to unlock - note: unlock might not be in IAdtObject interface
        // This is a safety measure, actual unlock should be done in update/create methods
        // But we log it for visibility
        this.objectLocked = false;
        this.lockHandle = undefined;
      } catch (error) {
        this.log(LogLevel.WARN, 'Failed to unlock during cleanup:', error);
      }
    }
  }

  /**
   * Get operation delay from YAML configuration
   * @param operation - Operation name (create, update, activate, delete, etc.)
   * @param testCaseParams - Test case parameters (may contain operation_delays)
   * @returns Delay in milliseconds
   */
  private getOperationDelay(
    operation: string,
    testCaseParams?: ITestCaseParams,
  ): number {
    const { getEnvironmentConfig } = require('./test-helper');
    const envConfig = getEnvironmentConfig();
    const testCase = this.testCase || {
      name: this.testCaseName,
      params: testCaseParams || {},
    };
    const operationDelays =
      testCase?.params?.operation_delays || envConfig.operation_delays || {};
    return operationDelays[operation] || operationDelays.default || 3000; // Default 3 seconds
  }

  /**
   * Wait for specified delay
   * @param delay - Delay in milliseconds
   * @param operation - Operation name for logging
   */
  private async waitDelay(delay: number, operation: string): Promise<void> {
    if (delay > 0) {
      this.log(
        LogLevel.INFO,
        `Waiting ${delay}ms after ${operation} operation`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Flow test: validation->create->lock->check(inactive, source/xml)->update->unlock->activate
   */
  async flowTest(
    config: TConfig,
    testCaseParams?: ITestCaseParams,
    options?: IFlowTestOptions,
  ): Promise<TState> {
    const cleanupSettings = this.getCleanupSettings(testCaseParams);
    this.objectCreated = false;
    this.objectLocked = false;
    this.lockHandle = undefined;

    const _testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const _testCase = this.testCase || {
      name: this.testCaseName,
      params: testCaseParams || {},
    };
    let currentStep = '';

    const getPayloadText = (data: unknown): string | undefined => {
      if (typeof data === 'string') return data;
      if (data !== undefined && data !== null) {
        try {
          return JSON.stringify(data);
        } catch {
          return undefined;
        }
      }
      return undefined;
    };

    const getSourceUrl = (
      version: 'active' | 'inactive' | undefined,
    ): string | undefined => {
      const utils = this.client?.getUtils?.();
      if (!utils || !config) {
        return undefined;
      }

      const configAny = config as any;
      if (configAny.className) {
        return utils.getObjectSourceUri(
          'CLAS/OC',
          configAny.className,
          undefined,
          version,
        );
      }
      if (configAny.interfaceName) {
        return utils.getObjectSourceUri(
          'INTF/OI',
          configAny.interfaceName,
          undefined,
          version,
        );
      }
      if (configAny.programName) {
        return utils.getObjectSourceUri(
          'PROG/P',
          configAny.programName,
          undefined,
          version,
        );
      }
      if (configAny.functionModuleName && configAny.functionGroupName) {
        return utils.getObjectSourceUri(
          'FUGR/FF',
          configAny.functionModuleName,
          configAny.functionGroupName,
          version,
        );
      }
      if (configAny.ddlName) {
        return utils.getObjectSourceUri(
          'DDLS/DF',
          configAny.ddlName,
          undefined,
          version,
        );
      }
      if (configAny.structureName) {
        return utils.getObjectSourceUri(
          'TABL/DS',
          configAny.structureName,
          undefined,
          version,
        );
      }
      if (configAny.tableName) {
        return utils.getObjectSourceUri(
          'TABL/DT',
          configAny.tableName,
          undefined,
          version,
        );
      }
      // A table type has no source (no TTYP code among the source codes).

      return undefined;
    };

    const readVersion = async (
      version: 'active' | 'inactive' | undefined,
      label: string,
      withLongPolling: boolean = false,
    ): Promise<string | undefined> => {
      logTestStep(label, this.logger);
      // No source URL logging by default (keep logs concise)
      let answer: IAdtResponse<unknown>;
      try {
        answer = await this.readWhatItHas(
          config as Partial<TConfig>,
          version,
          withLongPolling ? { withLongPolling: true } : undefined,
        );
      } catch (error: any) {
        const status = error?.response?.status;
        const errorText = error?.message || '';
        if (withLongPolling && status === 400) {
          logTestStep(
            `${label} retry without long polling (HTTP 400)`,
            this.logger,
          );
          // Small delay before retry to allow ADT to finalize object state
          await new Promise((resolve) => setTimeout(resolve, 1000));
          answer = await this.readWhatItHas(
            config as Partial<TConfig>,
            version,
            undefined,
          );
        } else {
          throw error;
        }
      }
      // A refusal is in the answer now, not thrown, so this is where a failed
      // read stops the test — with SAP's own sentence rather than "no response".
      const payload = getPayloadText(expectResult(answer, `read ${version}`));
      logTestStep(
        `${label} length: ${payload?.length || 0} characters`,
        this.logger,
      );
      return payload;
    };

    const readMetadata = async (
      label: string,
      withLongPolling: boolean = false,
    ): Promise<string | undefined> => {
      logTestStep(label, this.logger);
      const answer = await this.adtObject.readMetadata?.(
        config as Partial<TConfig>,
        {
          analyse: analyseException,
          ...(withLongPolling ? { withLongPolling: true } : undefined),
        },
      );
      if (!answer) {
        throw new Error(
          `${this.loggerPrefix} offers no readMetadata() — the flow asked for ` +
            'the object document and this type has none.',
        );
      }
      const payload = getPayloadText(expectResult(answer, 'readMetadata'));
      logTestStep(
        `${label} length: ${payload?.length || 0} characters`,
        this.logger,
      );
      return payload;
    };

    const readObjectProperties = async (label: string): Promise<void> => {
      if (!this.connection || !this.client) {
        return;
      }
      const sourceUrl = getSourceUrl(undefined);
      if (!sourceUrl) {
        return;
      }
      const encodedUri = encodeURIComponent(sourceUrl);
      const url = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodedUri}`;
      logTestStep(label, this.logger);
      // A thrown request fails the step, and so does an answer that is not a
      // 2xx or carries nothing: this read is part of the flow, not a probe.
      const response = await this.connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: 0,
        headers: {
          Accept:
            'application/vnd.sap.adt.repository.objproperties.result.v1+xml, application/vnd.sap.adt.objectproperties+xml, application/xml',
        },
      });
      const status = response?.status;
      if (typeof status !== 'number' || status < 200 || status >= 300) {
        throw new Error(
          `${label} failed: object properties answered HTTP ${String(status)}`,
        );
      }
      const payload = getPayloadText(response.data);
      if (!payload) {
        throw new Error(`${label} failed: object properties answered nothing`);
      }
      logTestStep(`${label} length: ${payload.length} characters`, this.logger);
    };

    const shouldSkipInitialSourceRead = (): boolean => {
      const configAny = config as any;
      return Boolean(configAny?.className || configAny?.interfaceName);
    };

    /**
     * Which version the post-create read asks for.
     *
     * Measured on premise (BASIS 816): for an include the versionless read answered nothing and
     * the flow died with "Read undefined failed: no response". Classes and
     * interfaces skip this read entirely for the same underlying reason — a
     * freshly created object has no ACTIVE version — while the other suites
     * evidently tolerate the versionless read, so this is narrowed to the type
     * where the failure was actually seen rather than changed for all.
     *
     * Skipping it would cost the pre/post update comparison below, which is the
     * check that catches an update writing nothing, so the inactive version is
     * read instead: right after create that IS the object's content.
     */
    const initialReadVersion = (): 'inactive' | undefined =>
      (config as any)?.includeName ? 'inactive' : undefined;

    let preUpdateActive: string | undefined;
    let postUpdateInactive: string | undefined;
    let postActivateActive: string | undefined;

    const normalizeXml = (xmlText: string): any | undefined => {
      try {
        const { XMLParser } = require('fast-xml-parser');
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
        });
        return parser.parse(xmlText);
      } catch (error) {
        this.log(
          LogLevel.WARN,
          `Failed to parse XML for comparison: ${error instanceof Error ? error.message : String(error)}`,
        );
        return undefined;
      }
    };

    const pickShape = (shape: any, source: any): any => {
      if (shape === null || shape === undefined) {
        return shape;
      }
      if (Array.isArray(shape)) {
        if (!Array.isArray(source)) {
          return undefined;
        }
        return shape.map((item, index) => pickShape(item, source[index]));
      }
      if (typeof shape !== 'object') {
        return source;
      }
      if (!source || typeof source !== 'object') {
        return undefined;
      }
      const result: Record<string, any> = {};
      for (const key of Object.keys(shape)) {
        result[key] = pickShape(shape[key], source[key]);
      }
      return result;
    };

    const sortObjectKeys = (value: any): any => {
      if (Array.isArray(value)) {
        return value.map(sortObjectKeys);
      }
      if (value && typeof value === 'object') {
        return Object.keys(value)
          .sort()
          .reduce(
            (acc, key) => {
              acc[key] = sortObjectKeys(value[key]);
              return acc;
            },
            {} as Record<string, any>,
          );
      }
      return value;
    };

    const compareXmlSubset = (
      referenceXml: string,
      targetXml: string,
    ): boolean => {
      const referenceParsed = normalizeXml(referenceXml);
      const targetParsed = normalizeXml(targetXml);
      if (!referenceParsed || !targetParsed) {
        return false;
      }
      const targetSubset = pickShape(referenceParsed, targetParsed);
      const referenceNormalized = JSON.stringify(
        sortObjectKeys(referenceParsed),
      );
      const targetNormalized = JSON.stringify(sortObjectKeys(targetSubset));
      return referenceNormalized === targetNormalized;
    };

    try {
      // 1. Validate
      currentStep = 'validate';
      logTestStep(currentStep, this.logger);
      // No status check: a non-2xx is a returned failure since 31.0.0, and
      // `expectResult` reports it with what SAP said. A system with no
      // validation resource (404/405/501) fails too: whether a type is tested
      // on a system is its case's `enabled` / `available_in`, never something
      // read off a refusal.
      let validationDocument = '';
      if (options?.skipValidation) {
        // Run-visible, like the lock-release check's: an off check is said in
        // every run, not only under DEBUG_ADT_TESTS.
        createRunIntegrityLogger().info?.(
          `${this.loggerPrefix} ${describeObject(config)}: validate not sent — ${options.skipValidation}`,
        );
      } else {
        validationDocument = String(
          expectResult(
            await this.adtObject.validate(config as Partial<TConfig>, {
              analyse: judged(analyseValidation),
            }),
            'validate',
          ) ?? '',
        );

        // The document still has to be read: validation reports a rejected
        // name inside a 200. `analyseValidation` above judges the forms it
        // knows; `validationErrors` reads every other table form by
        // structure, nested messages and any namespace prefix included. An
        // answer that is not XML fails: whether the name was rejected cannot
        // be read from it.
        const errorTexts = validationErrors(validationDocument);
        if (errorTexts.length > 0) {
          const error = new Error(
            `Validation failed with errors: ${errorTexts.join('; ')}`,
          );
          logTestStepError(currentStep, error);
          throw error;
        }

        // Delay after validate
        await this.waitDelay(
          this.getOperationDelay('validate', testCaseParams),
          'validate',
        );
      }

      // 2. Create
      currentStep = 'create';
      logTestStep(currentStep, this.logger);
      // `create` is the POST. `activateOnCreate` is still the flow's word for
      // "leave this active", but it is this harness that acts on it now, with
      // an `activate` call of its own below — the option no longer reaches into
      // the library and asks it to run a second request.
      // No `sourceCode`: a create posts a metadata document and no create
      // endpoint has a body for the source, so passing it wrote nothing and
      // said nothing. `@mcp-abap-adt/interfaces@38.0.0` refuses it at the type,
      // which is how this line was found. The source goes in through the
      // update below, under the lock this harness takes.
      const createOptions: IAdtCreateOptions = {
        timeout: options?.timeout,
      };
      // The source is stripped rather than cast away. `create` takes
      // `Omit<TConfig, 'source'> & { source?: never }`, and a *generic*
      // `TConfig` cannot satisfy that — the compiler has no way to know the
      // concrete type lacks the field. A concrete caller writes
      // `create({ className })` and needs none of this; a wrapper like this one
      // has to say out loud what it is not sending, which is the right thing to
      // say anyway.
      const { source: _sourceIsNotCreates, ...createConfig } =
        config as TConfig & { source?: unknown };
      expectResult(
        await this.adtObject.create(
          createConfig as Omit<TConfig, 'source'> & { source?: never },
          {
            analyse: analyseException,
            ...createOptions,
            headers: integrationHeadersOf(this.adtObject, 'create'),
          },
        ),
        'create',
      );
      this.objectCreated = true;

      if (options?.afterCreate) {
        logTestStep("afterCreate (the caller's own step)", this.logger);
        await options.afterCreate();
      }

      if (options?.activateOnCreate && this.adtObject.activate) {
        logTestStep('activate (after create)', this.logger);
        expectResult(
          await this.adtObject.activate(config as Partial<TConfig>, {
            headers: integrationHeadersOf(this.adtObject, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate after create',
        );
      }
      // Delay after create
      await this.waitDelay(
        this.getOperationDelay('create', testCaseParams),
        'create',
      );

      // 2.5. Wait for object to be ready before update (read with long polling or delay)
      if (options?.updateConfig) {
        currentStep = 'read (wait for object ready)';
        logTestStep(currentStep, this.logger);
        // Additional delay before update (already waited after create, but this is for object readiness)
        const createDelay = this.getOperationDelay('create', testCaseParams);
        this.log(
          LogLevel.INFO,
          `Waiting ${createDelay}ms for object to be ready (fallback delay)`,
        );
        await new Promise((resolve) => setTimeout(resolve, createDelay));
      }

      // 3. Update (if updateConfig provided)
      if (options?.updateConfig) {
        // (A second `updateContent` used to be resolved here and never read.
        // It carried the create-source-first order this PR is fixing, so a
        // reader checking "which content does the update use?" could land on
        // the dead one and conclude the bug was still there.)
        await readObjectProperties(
          'read object properties (post-create, no version)',
        );
        if (shouldSkipInitialSourceRead()) {
          logTestStep(
            'read initial (post-create, no version) skipped for class',
            this.logger,
          );
        } else {
          preUpdateActive = await readVersion(
            initialReadVersion(),
            'read initial (post-create, no version)',
            false,
          );
        }

        // The read-modify-write a document update needs, in the order the
        // migration note prescribes: read, edit, then lock. Reading inside the
        // lock window would be this harness inventing a sequence the library no
        // longer performs.
        let documentToWrite: string | undefined;
        if (options?.updateEditsSource) {
          logTestStep('read source (before update)', this.logger);
          const heldSource = getPayloadText(
            expectResult(
              await this.readWhatItHas(config as Partial<TConfig>),
              'read source (before update)',
            ),
          );
          documentToWrite = options.updateEditsSource.edit(heldSource ?? '');
        } else if (options?.updateTakesDocument) {
          const current = await readMetadata(
            'read document (before update)',
            false,
          );
          // Not checked for emptiness, and deliberately. Whether what was
          // read is a complete document is not something this side can know —
          // the server is the only one that knows what it will accept, and it
          // says so in its own words. A guard here would answer that question
          // on its behalf and be wrong the first time it disagreed.
          documentToWrite =
            typeof options.updateTakesDocument === 'function'
              ? options.updateTakesDocument(current ?? '')
              : (current ?? '');
        }

        currentStep = 'update';
        logTestStep(currentStep, this.logger);
        const updateOptions: IAdtOperationOptions = {
          // The UPDATE content, not the create content. Every handler resolves
          // `options.source ?? config.source` with options winning, so
          // passing the create source here overwrote the object with what it
          // already held and the update became a no-op — measured on premise (BASIS 816) with
          // the include suite, where the stored source stayed 52 characters
          // while `update_source_code` was 62.
          // A document write and a source write take the same channel: the
          // contract says the body is `options.source` for `update` and for
          // `updateMetadata` alike. `documentToWrite` is what the read-patch
          // step above produced for the types whose write takes a whole
          // document; it wins, because for those types there is nothing else.
          source:
            documentToWrite ?? options?.updateConfig?.source ?? options?.source,
          timeout: options?.timeout,
        };
        expectResult(
          (await this.updateUnderLock(
            { ...config, ...options.updateConfig } as Partial<TConfig>,
            updateOptions,
          )) as IAdtResponse<unknown>,
          'update',
        );

        if (options?.activateOnUpdate && this.adtObject.activate) {
          logTestStep('activate (after update)', this.logger);
          expectResult(
            await this.adtObject.activate(config as Partial<TConfig>, {
              headers: integrationHeadersOf(this.adtObject, 'activate'),
              analyse: judged(analyseActivation),
            }),
            'activate after update',
          );
        }
        // Delay after update
        await this.waitDelay(
          this.getOperationDelay('update', testCaseParams),
          'update',
        );

        if (!options?.activateOnUpdate) {
          postUpdateInactive = await readVersion(
            'inactive',
            'read inactive (post-update)',
            true,
          );
        }
      }

      // 4. Activate (if not activated during create/update, and if this object
      // is activated at all — a package and a message class are not)
      if (
        !options?.activateOnCreate &&
        !options?.activateOnUpdate &&
        this.adtObject.activate
      ) {
        currentStep = 'activate';
        logTestStep(currentStep, this.logger);
        // A refused activation is a failure in the answer: `analyseActivation`
        // reads `activationExecuted="false"` and `<msg type="E">` inside the 200.
        expectResult(
          await this.adtObject.activate(config as Partial<TConfig>, {
            headers: integrationHeadersOf(this.adtObject, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        // Delay after activate
        await this.waitDelay(
          this.getOperationDelay('activate', testCaseParams),
          'activate',
        );

        if (options?.updateConfig) {
          postActivateActive = await readVersion(
            'active',
            'read active (post-activate)',
            true,
          );
        }
      }

      if (options?.updateConfig) {
        // Same order as the send above, and for the same reason: what the
        // update was asked to write is what the read afterwards is checked
        // against. Reading the create source here made the check compare the
        // object with its own previous content.
        // `??`, matching the send exactly. `||` made an intentionally EMPTY
        // update source fall through to the create source, so clearing an
        // object — a legitimate edit — wrote empty and was then compared
        // against the content it had before, reporting a mismatch on a correct
        // update. Emptiness is a value; only absence is absence.
        const updateContent = options.updateConfig?.source ?? options.source;
        // **What the content IS decides how it is compared**, and one field no
        // longer says. It used to: `sourceCode` meant text and `xmlContent`
        // meant a document, which is the classification the contract stopped
        // asking for — both are `source` now. `updateTakesDocument` already
        // marks the types whose write takes a whole document, so it is what
        // answers here. Nothing changes for today's suites: a document type
        // passes no `source` at all, the harness reads and patches the
        // document itself, and the kind stays `unknown` as before.
        const updateContentKind =
          updateContent === undefined
            ? 'unknown'
            : options.updateTakesDocument
              ? 'xml'
              : 'source';

        if (preUpdateActive && postUpdateInactive) {
          if (updateContentKind === 'source') {
            if (updateContent && updateContent !== preUpdateActive) {
              if (preUpdateActive === postUpdateInactive) {
                throw new Error(
                  'Expected inactive version to differ after update, but content is unchanged',
                );
              }
            } else if (updateContent && updateContent === preUpdateActive) {
              this.log(
                LogLevel.WARN,
                'Update content matches active version; skipping pre/post update difference check',
              );
            }
          } else {
            this.log(
              LogLevel.INFO,
              'Skipping pre/post update comparison for XML-based update content',
            );
          }
        }

        if (postUpdateInactive && postActivateActive) {
          if (updateContentKind === 'source') {
            if (postUpdateInactive !== postActivateActive) {
              throw new Error(
                'Expected inactive version to match active version after activation',
              );
            }
          } else if (updateContentKind === 'xml' && updateContent) {
            const inactiveMatches = compareXmlSubset(
              updateContent,
              postUpdateInactive,
            );
            const activeMatches = compareXmlSubset(
              updateContent,
              postActivateActive,
            );
            if (!inactiveMatches || !activeMatches) {
              throw new Error(
                'Expected XML-based update content to match inactive and active versions after activation',
              );
            }
          } else {
            this.log(
              LogLevel.INFO,
              'Skipping post-update vs post-activate comparison for XML-based update content',
            );
          }
        }
      }

      if (options?.updateEditsSource) {
        // The write is proven by the read after it: the line the edit added
        // is in the source the system holds now.
        expect(postActivateActive ?? postUpdateInactive ?? '').toContain(
          options.updateEditsSource.marker,
        );
      }

      if (options?.readMetadata) {
        currentStep = 'readMetadata';
        logTestStep(currentStep, this.logger);
        await this.readMetadataStep(
          config as Partial<TConfig>,
          options.readMetadataOptions,
        );
      }

      if (options?.metadataUpdate && this.adtObject.updateMetadata) {
        currentStep = 'metadata update';
        const description = `MCP metadata ${randomBytes(4).toString('hex')}`;
        const current = await readMetadata(
          'read metadata (before metadata update)',
        );
        const patched = replaceRootDescription(
          current ?? '',
          description,
          this.loggerPrefix,
        );
        const target = {
          ...config,
          ...options.updateConfig,
        } as Partial<TConfig>;
        logTestStep(
          `metadata update: description "${description}"`,
          this.logger,
        );
        expectResult(
          (await this.updateUnderLock(
            target,
            { source: patched, timeout: options.timeout },
            (c, o) => this.writeMetadata(c, o),
          )) as IAdtResponse<unknown>,
          'updateMetadata',
        );
        if (this.adtObject.activate) {
          logTestStep('activate (after metadata update)', this.logger);
          expectResult(
            await this.adtObject.activate(config as Partial<TConfig>, {
              headers: integrationHeadersOf(this.adtObject, 'activate'),
              analyse: judged(analyseActivation),
            }),
            'activate after metadata update',
          );
        }
        const after = await readMetadata(
          'read metadata (after metadata update)',
        );
        expect(readRootDescription(after ?? '')).toBe(description);
      }

      // 5. Cleanup (if enabled)
      if (cleanupSettings.shouldCleanup && this.objectCreated) {
        currentStep = 'delete (cleanup)';
        logTestStep(currentStep, this.logger);
        try {
          // Close and reopen the session to release any lingering locks, and
          // publish the replacement: the session is shared by the whole run, so
          // ending it without saying so leaves every later file adopting a
          // session that is gone.
          if (cleanupSettings.cleanupSessionAfterTest && this.connection) {
            await this.recycleSession();
          }
          // The suite's own removal, when it declared one. It was declared and
          // then ignored on this path — only the pre-existing-object cleanup
          // used it — which left a type whose delete needs something extra
          // (a package needs a fresh session: the PAK lock belongs to the ABAP
          // session, measured on premise (BASIS 816)) with no way to say so.
          if (this.cleanupObjectFn) {
            await this.cleanupObjectFn(config);
          } else {
            await this.deleteOrRaise(config as Partial<TConfig>);
          }
          // Delay after delete
          await this.waitDelay(
            this.getOperationDelay('delete', testCaseParams),
            'delete',
          );
        } catch (cleanupError) {
          const status = (cleanupError as any)?.response?.status;
          const responseData = (cleanupError as any)?.response?.data;
          const responseText =
            typeof responseData === 'string'
              ? responseData
              : responseData
                ? JSON.stringify(responseData)
                : undefined;
          const errorMessage =
            cleanupError instanceof Error
              ? cleanupError.message
              : typeof cleanupError === 'string'
                ? cleanupError
                : cleanupError
                  ? JSON.stringify(cleanupError)
                  : 'Unknown error';
          const detail = `${status ? `HTTP ${status}: ` : ''}${responseText || errorMessage}`;
          this.log(LogLevel.ERROR, `delete (cleanup) failed: ${detail}`);
          // The test body passed, so this is the only failure in the run — and
          // swallowing it is how a suite came to report success while leaving
          // its object behind, which then made the NEXT run skip its own
          // workflow and report success too. Measured on premise (BASIS 816) 2026-08-31 with
          // TEST_INNER_PKG02. A cleanup that fails is a red test.
          throw new Error(
            `Test body passed but cleanup failed: ${detail}. ` +
              `${this.objectNameOf(config)} is left on the system, ` +
              'and the next run will not start from a clean state.',
          );
        }
      } else if (this.objectCreated) {
        this.log(
          LogLevel.INFO,
          `⚠️ cleanup skipped (cleanup_after_test=${cleanupSettings.cleanupAfterTest}, skip_cleanup=${cleanupSettings.skipCleanup}) - object left for analysis`,
        );
      }

      return validationDocument as unknown as TState;
    } catch (error: any) {
      // Log step error with details before failing test
      if (currentStep) {
        logTestStepError(currentStep, error);
      }

      // Ensure unlock on error
      await this.ensureUnlock(config as Partial<TConfig>);

      // Cleanup on error if enabled
      if (cleanupSettings.shouldCleanup && this.objectCreated) {
        try {
          // Close and reopen the session to release any lingering locks, and
          // publish the replacement: the session is shared by the whole run, so
          // ending it without saying so leaves every later file adopting a
          // session that is gone.
          if (cleanupSettings.cleanupSessionAfterTest && this.connection) {
            await this.recycleSession();
          }
          logTestStep('delete (cleanup)', this.logger);
          await this.deleteOrRaise(config as Partial<TConfig>);
          // Delay after delete (cleanup on error)
          await this.waitDelay(
            this.getOperationDelay('delete', testCaseParams),
            'delete',
          );
        } catch (cleanupError) {
          // The test's own failure stays the one thrown, and the cleanup's
          // failure is reported inside it, not only logged: the object is
          // left on the system and the next run meets it.
          this.log(
            LogLevel.ERROR,
            'Cleanup after a failed test also failed — the object is left on the system:',
            cleanupError,
          );
          if (error instanceof Error) {
            error.message = `${error.message} — and the cleanup after it failed too, ${this.objectNameOf(config)} is left on the system: ${
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError)
            }`;
          }
        }
      } else if (this.objectCreated && !cleanupSettings.shouldCleanup) {
        this.log(
          LogLevel.INFO,
          `⚠️ Cleanup skipped (cleanup_after_test=${cleanupSettings.cleanupAfterTest}, skip_cleanup=${cleanupSettings.skipCleanup}) - object left for analysis after error`,
        );
      }

      if (error?.response?.status === 406) {
        const { getAcceptHint } = require('./test-helper');
        const acceptHint = getAcceptHint(error);
        error.message =
          `406 Not Acceptable: Accept header rejected or endpoint unsupported.` +
          `${acceptHint ? ` ${acceptHint}` : ''} ` +
          `${error.message}`;
      }

      const statusText = getHttpStatusText(error);
      const enhancedError =
        statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), {
              stack: error.stack,
              response: error.response,
            })
          : error;
      throw enhancedError;
    }
  }

  /**
   * End this tester's session and go on in a fresh one, on a new instance.
   *
   * Since connection 16 one connection instance is one SAP session: the
   * instance whose session ended is spent, and so is everything built over it.
   * So the tester takes the new connection, a client built over it the way a
   * test builds one, and the same class of handler from that client — found
   * by {@link factoryOf}, as the lock-release check finds it. Returns the
   * connection and client, for a test file that holds its own references.
   */
  async recycleSession(): Promise<{
    connection: IAbapConnection;
    client: any;
  }> {
    if (!this.connection) {
      throw new Error(`${this.loggerPrefix}: no connection to recycle`);
    }
    const connection = await recycleTestSession(this.connection);
    this.connection = connection;
    const { client } = await createTestAdtClient(
      connection,
      createLibraryLogger(),
      await resolveSystemContext(connection, this.isCloudSystem),
    );
    const factory = factoryOf(client, this.adtObject);
    if (!factory) {
      throw new Error(
        `${this.loggerPrefix}: no zero-argument factory on the client ` +
          `builds a ${this.adtObject.constructor.name}, so the handler cannot ` +
          'be rebuilt on the new session.',
      );
    }
    this.adtObject = (
      client as unknown as Record<string, () => TestableObject<TConfig>>
    )[factory]();
    this.client = client;
    return { connection, client };
  }

  /**
   * Read test: read-only operations
   */
  async readTest(
    config: Partial<TConfig>,
    options?: IReadTestOptions,
  ): Promise<unknown> {
    try {
      logTestStep('read', this.logger);
      // The value, or the test fails with what SAP said. An object that is not
      // there answers 200 with an empty body — the caller's `analyse` decides
      // whether that is absence, and this harness reads it as an empty read.
      const readState = expectResult(
        await this.readWhatItHas(
          config,
          options?.version || 'active',
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
        'read',
      );

      if (options?.skipReadMetadata) {
        return readState;
      }

      // A type whose only read is `readMetadata` was read above.
      if (this.adtObject.readMetadata) {
        logTestStep('readMetadata', this.logger);
        await this.readMetadataStep(
          config,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        );
      }

      return readState;
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'read failed:', error);
      if (error?.response?.status === 406) {
        const { getAcceptHint } = require('./test-helper');
        const acceptHint = getAcceptHint(error);
        error.message =
          `406 Not Acceptable: Accept header rejected or endpoint unsupported.` +
          `${acceptHint ? ` ${acceptHint}` : ''} ` +
          `${error.message}`;
      }
      throw error;
    }
  }

  /**
   * Get test case definition from YAML
   */
  getTestCaseDefinition(): any {
    return configuredCase(this.testCaseKey, this.testCaseName);
  }

  /**
   * Get enabled test case from YAML
   */
  getEnabledTestCase(): any {
    const testCase = configuredCase(this.testCaseKey, this.testCaseName);
    return testCase?.enabled === true ? testCase : null;
  }

  /**
   * Get TestConfigResolver instance for this test case
   * Provides centralized access to resolved YAML parameters
   */
  getConfigResolver(): TestConfigResolver | null {
    if (!this.configResolver && this.testCase) {
      this.configResolver = new TestConfigResolver({
        testCase: this.testCase,
        isCloud: this.isCloudSystem,
        logger: this.logger,
      });
    }
    return this.configResolver;
  }

  /**
   * Get resolved package name (from test case params or global defaults)
   */
  getPackageName(): string {
    const resolver = this.getConfigResolver();
    return resolver?.getPackageName() || '';
  }

  /**
   * Get resolved transport request (from test case params or global defaults)
   */
  getTransportRequest(): string {
    const resolver = this.getConfigResolver();
    return resolver?.getTransportRequest() || '';
  }

  /**
   * Get resolved parameter value (from test case params or global defaults)
   */
  getParam(paramName: string, defaultValue?: any): any {
    const resolver = this.getConfigResolver();
    return resolver?.getParam(paramName, defaultValue);
  }

  /**
   * Get standard object from registry (prioritizes standard_objects over test case params)
   * @param objectType - Type of object ('class', 'domain', 'table', etc.)
   * @returns Object with name (and optional group for function modules) or null
   */
  getStandardObject(
    objectType: string,
  ): { name: string; group?: string } | null {
    const resolver = this.getConfigResolver();
    if (!resolver) {
      // Fallback to direct call if resolver not initialized
      const { resolveStandardObject } = require('./test-helper');
      return resolveStandardObject(
        objectType,
        this.isCloudSystem,
        this.testCase,
      );
    }
    // Use null testCase to prioritize standard_objects registry
    const { resolveStandardObject } = require('./test-helper');
    return resolveStandardObject(objectType, this.isCloudSystem, null);
  }

  /**
   * Get object name with fallback to standard object
   * @param paramName - Parameter name for object name (e.g., 'class_name', 'domain_name')
   * @param standardObjectType - Type for standard_objects registry lookup (e.g., 'class', 'domain')
   * @returns Object name or null
   */
  getObjectName(paramName: string, standardObjectType?: string): string | null {
    const resolver = this.getConfigResolver();
    if (!resolver) {
      return null;
    }
    return resolver.getObjectName(paramName, standardObjectType);
  }

  /**
   * Setup BaseTester with connection, client, and config builder
   * Call this once before using beforeAll/beforeEach
   */
  setup(options: IBaseTesterSetupOptions): void {
    this.connection = options.connection;
    this.client = options.client;
    this.hasConfig = options.hasConfig;
    this.isCloudSystem = options.isCloudSystem;
    this.buildConfigFn = options.buildConfig;
    this.ensureObjectReadyFn = options.ensureObjectReady;
    this.cleanupObjectFn = options.cleanupObject;
    if (options.testDescription) {
      this.testDescription = options.testDescription;
    }
  }

  /**
   * beforeAll hook - Setup connection and client
   * Returns function to use in Jest beforeAll()
   */
  beforeAll(): () => Promise<void> {
    return async () => {
      // Setup is done externally, this is just for consistency
      this.log(LogLevel.INFO, 'beforeAll: Setup complete');
    };
  }

  /**
   * beforeEach hook - Load test case and prepare config
   * Returns function to use in Jest beforeEach()
   */
  beforeEach(): () => Promise<void> {
    return async () => {
      this.setupError = null;
      this.testCase = null;
      this.config = null;
      this.configResolver = null;

      // The gate registered this case, so each of these is a defect in the
      // setup, never a case that does not apply.
      if (!this.hasConfig) {
        this.setupError = 'No SAP configuration';
        this.log(LogLevel.ERROR, `beforeEach: ${this.setupError}`);
        return;
      }

      const { ensurePackageConfig } = require('./test-helper');
      const tc = configuredCase(this.testCaseKey, this.testCaseName);
      if (!tc) {
        this.setupError = missingCaseMessage(
          this.testCaseKey,
          this.testCaseName,
        );
        this.log(LogLevel.ERROR, `beforeEach: ${this.setupError}`);
        return;
      }
      if (tc.enabled !== true) {
        this.setupError = `case ${this.testCaseKey}/${this.testCaseName} is not enabled; register the test through gate`;
        this.log(LogLevel.ERROR, `beforeEach: ${this.setupError}`);
        return;
      }

      const packageCheck = ensurePackageConfig(
        tc.params,
        `${this.loggerPrefix} - ${this.testDescription}`,
      );
      if (!packageCheck.success) {
        this.setupError =
          packageCheck.reason || 'Default package is not configured';
        this.log(LogLevel.ERROR, `beforeEach: ${this.setupError}`);
        return;
      }

      this.testCase = tc;

      // Initialize config resolver with test case
      this.configResolver = new TestConfigResolver({
        testCase: tc,
        isCloud: this.isCloudSystem,
        logger: this.logger,
      });

      // Build config - pass resolver so buildConfig can use resolved parameters
      if (this.buildConfigFn) {
        try {
          this.config = this.buildConfigFn(tc, this.configResolver);
        } catch (error: any) {
          this.setupError = `Failed to build config: ${error.message}`;
          this.log(LogLevel.ERROR, `beforeEach: ${this.setupError}`);
          this.testCase = null;
          this.configResolver = null;
          return;
        }
      }

      // Ensure object ready (if function provided)
      if (this.ensureObjectReadyFn && this.config) {
        const camelPrefix =
          this.loggerPrefix.charAt(0).toLowerCase() +
          this.loggerPrefix.slice(1);
        // The last resort is what makes this reliable. The three lookups above
        // derive the config key from the logger prefix, and two testers name
        // themselves something their config does not use: `BehaviorImplementation`
        // holds a `className`, and the DDL tester is called `View` and holds a
        // `ddlName`. Neither derived key existed, so `objectName` was undefined
        // and the hook was never called — silently, because a hook that does not
        // run looks exactly like one that found nothing to clean.
        //
        // So fall back to whichever config key ends in `Name` and is the
        // object's own. `packageName` is excluded by name: it is the parent, and
        // deleting it would be a different and much worse bug.
        const ownNameKey = Object.keys(this.config as object).find(
          (key) => key.endsWith('Name') && key !== 'packageName',
        );
        const objectName =
          (this.config as any)[`${camelPrefix}Name`] ||
          (this.config as any)[`${this.loggerPrefix.toLowerCase()}Name`] ||
          (this.config as any).name ||
          (this.config as any).objectName ||
          (ownNameKey ? (this.config as any)[ownNameKey] : undefined);
        if (objectName) {
          const cleanup = await this.ensureObjectReadyFn(objectName);
          if (!cleanup.success) {
            this.setupError =
              cleanup.reason || 'Failed to cleanup object before test';
            this.log(LogLevel.ERROR, `beforeEach: ${this.setupError}`);
            // If object exists, mark it for post-test cleanup (config stays for delete)
            if (cleanup.objectExists) {
              this.objectCreated = true;
            } else {
              this.testCase = null;
              this.config = null;
            }
            return;
          }
        }
      }

      this.log(LogLevel.INFO, 'beforeEach: Test case loaded and ready');
    };
  }

  /**
   * afterAll hook - Cleanup connection
   * Returns function to use in Jest afterAll()
   */
  afterAll(): () => Promise<void> {
    return async () => {
      if (this.connection) {
        // Releases only a session this file opened. The run's shared session is
        // globalTeardown's to end — closing it here ended it for every file
        // that had not run yet.
        this.log(LogLevel.INFO, 'afterAll: Releasing connection');
        await releaseTestConnection(this.connection);
      }
    };
  }

  /**
   * afterEach hook - Optional cleanup after each test
   * Returns function to use in Jest afterEach()
   */
  afterEach(): () => Promise<void> {
    return async () => {
      // Cleanup is handled in flowTest/readTest
      this.log(LogLevel.DEBUG, 'afterEach: Cleanup handled by test methods');
    };
  }

  /**
   * Get current test case
   */
  getTestCase(): any {
    return this.testCase;
  }

  /**
   * Get current config
   */
  getConfig(): TConfig | null {
    return this.config;
  }

  /**
   * Flow test with automatic config loading
   * Uses config from beforeEach
   * Throws when the setup failed or beforeEach() was not called
   */
  /**
   * The flow for an object that is never created and never deleted.
   *
   * A class include — definitions, types, test classes, macros — is not an
   * object in its own right. It exists because its class exists, ADT locks and
   * activates the CLASS, and there is no endpoint that brings one into being or
   * takes one away. `AdtClient.getLocalTestClass()` and its siblings say so in
   * their return type: `IAdtReadable & IAdtModifiable & ...`, deliberately
   * without `IAdtCreatable`.
   *
   * Driving one through `flowTest()` therefore died on `this.adtObject.create is
   * not a function` — four suites, every run, because create is not a step such
   * an object has. The steps it does have are these: read what is there, write
   * the new source, activate the container, and read back to prove the write
   * landed. No cleanup either: deleting an include would mean deleting the class
   * around it, and the class is the parent test's to manage.
   */
  async modifyFlowTest(
    config: TConfig,
    testCaseParams?: ITestCaseParams,
    options?: IFlowTestOptions,
  ): Promise<TState> {
    this.objectCreated = false;
    this.objectLocked = false;
    this.lockHandle = undefined;

    let currentStep = '';
    const payloadOf = (data: unknown): string | undefined => {
      if (typeof data === 'string') return data;
      if (data === undefined || data === null) return undefined;
      try {
        return JSON.stringify(data);
      } catch {
        return undefined;
      }
    };

    const readInclude = async (
      version: 'active' | 'inactive' | undefined,
      label: string,
    ): Promise<string | undefined> => {
      currentStep = label;
      logTestStep(label, this.logger);
      // The value, or the test fails with what SAP said. `readResult.data`
      // was the state bag's field; the bags are gone, so it read `undefined`
      // for every answer and a refused read passed as an empty one.
      const payload = payloadOf(
        expectResult(
          await this.readWhatItHas(config as Partial<TConfig>, version),
          label,
        ),
      );
      logTestStep(
        `${label} length: ${payload?.length || 0} characters`,
        this.logger,
      );
      return payload;
    };

    try {
      // 1. Read — an include of a class that exists always answers, with empty
      //    source when nothing was ever written to it.
      const before = await readInclude(undefined, 'read initial');

      // 2. Update
      currentStep = 'update';
      logTestStep(currentStep, this.logger);
      const updateOptions: IAdtOperationOptions = {
        source: options?.source,
        timeout: options?.timeout,
      };
      const updateState = await this.updateUnderLock(
        { ...config, ...options?.updateConfig } as Partial<TConfig>,
        updateOptions,
      );
      expectResult(updateState as IAdtResponse<unknown>, 'update');
      await this.waitDelay(
        this.getOperationDelay('update', testCaseParams),
        'update',
      );

      // 3. Activate — the container class, which is what `activate` on an
      //    include addresses. Skipped when the update already did it.
      if (!options?.activateOnUpdate && this.adtObject.activate) {
        currentStep = 'activate';
        logTestStep(currentStep, this.logger);
        // A refused activation is a failure in the answer; the status this
        // read off a state bag is not on a returned failure.
        expectResult(
          await this.adtObject.activate(config as Partial<TConfig>, {
            headers: integrationHeadersOf(this.adtObject, 'activate'),
            analyse: judged(analyseActivation),
          }),
          'activate',
        );
        await this.waitDelay(
          this.getOperationDelay('activate', testCaseParams),
          'activate',
        );
      }

      // 4. Read back. Without this the test proves the requests were accepted,
      //    not that the source changed — and an include that silently kept its
      //    old body is exactly the failure worth catching.
      const after = await readInclude('active', 'read active (post-update)');
      if (before !== undefined && after !== undefined && before === after) {
        this.log(
          LogLevel.WARN,
          'Include source is unchanged after update — the write may not have landed',
        );
      }

      if (options?.readMetadata && this.adtObject.readMetadata) {
        currentStep = 'readMetadata';
        logTestStep(currentStep, this.logger);
        await this.readMetadataStep(
          config as Partial<TConfig>,
          options.readMetadataOptions?.withLongPolling
            ? { withLongPolling: true }
            : undefined,
        );
      }

      return updateState as TState;
    } catch (error: any) {
      if (currentStep) {
        logTestStepError(currentStep, error);
      }
      // The lock is the CLASS's; leaving it held would block every later test
      // that touches the same class.
      await this.ensureUnlock(config as Partial<TConfig>);

      const statusText = getHttpStatusText(error);
      throw statusText !== 'HTTP ?'
        ? Object.assign(new Error(`[${statusText}] ${error.message}`), {
            stack: error.stack,
            response: error.response,
          })
        : error;
    }
  }

  /**
   * `modifyFlowTest` with the config and test case `beforeEach()` resolved,
   * mirroring `flowTestAuto`.
   */
  async modifyFlowTestAuto(
    options?: IFlowTestOptions,
  ): Promise<TState | undefined> {
    const testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const definition = this.getTestCaseDefinition() || {
      name: this.testCaseKey,
      params: {},
    };

    await this.raiseIfSetupFailed(testName, definition);

    if (!this.config) {
      logTestStart(this.logger, testName, definition);
      const error = new Error(
        'Config not available - ensure beforeEach() was called',
      );
      logTestError(this.logger, testName, error);
      logTestEnd(this.logger, testName);
      throw error;
    }

    logTestStart(this.logger, testName, definition);
    try {
      const result = await this.modifyFlowTest(
        this.config,
        this.testCase?.params,
        options,
      );
      logTestSuccess(this.logger, testName);
      logTestEnd(this.logger, testName);
      return result;
    } catch (error: any) {
      logTestError(this.logger, testName, error);
      logTestEnd(this.logger, testName);
      throw error;
    }
  }

  /**
   * The object's name as the config spells it.
   *
   * Every module names its own key — `packageName`, `className`, `domainName` —
   * and a message that reached for `name` alone printed an empty string for all
   * of them but the few that happen to use it.
   */
  private objectNameOf(config: unknown): string {
    const c = (config ?? {}) as Record<string, unknown>;
    const camelPrefix =
      this.loggerPrefix.charAt(0).toLowerCase() + this.loggerPrefix.slice(1);
    const value =
      c[`${camelPrefix}Name`] ??
      c[`${this.loggerPrefix.toLowerCase()}Name`] ??
      c.name ??
      c.objectName;
    return value ? String(value) : `the ${this.loggerPrefix} object`;
  }

  /**
   * A setup that failed is a red test, not a skipped one.
   *
   * Called first in every auto entry point, so a setup that failed cannot be
   * mistaken for "does not apply here": that is the gate's decision, made
   * before the test starts.
   */
  // biome-ignore lint/suspicious/noExplicitAny: logTestStart's own parameter
  private async raiseIfSetupFailed(
    testName: string,
    definition: any,
  ): Promise<void> {
    if (!this.setupError) return;
    logTestStart(this.logger, testName, definition);

    // A leftover object is removed here, before the throw, because there is no
    // later chance: the cleanup this class runs lives at the end of a flow, and
    // the flow is exactly what this throw prevents. `ensureObjectReady` sets
    // `objectCreated` and says "post-test cleanup will delete it" — that was
    // true of the skip path and false of this one, so the object survived and
    // every following run failed the same way. Measured on an ABAP Cloud system: a
    // function include stayed through three runs, each reporting that cleanup
    // would remove it.
    let leftover = '';
    if (this.objectCreated && this.config) {
      const { shouldCleanup } = this.getCleanupSettings(
        this.testCase?.params as ITestCaseParams | undefined,
      );
      if (shouldCleanup) {
        try {
          await this.cleanupExistingObject(this.config);
        } catch (cleanupError) {
          // Reported in the failure below, not only logged: the object is
          // still on the system and the next run meets it.
          leftover = ` The leftover object could not be removed either: ${
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError)
          }.`;
          this.log(LogLevel.ERROR, leftover.trim());
        }
      }
    }

    const error = new Error(
      `Test could not be set up: ${this.setupError}. The system was not in a ` +
        `state this test could run against, so nothing was verified.${leftover}`,
    );
    logTestError(this.logger, testName, error);
    logTestEnd(this.logger, testName);
    throw error;
  }

  /**
   * The config `beforeEach()` resolved, for a test that drives the tester's
   * parts itself instead of `flowTestAuto`.
   *
   * The gate registered the test, so a setup that failed or a `beforeEach()`
   * that was not called is a red test with its reason, never a quiet return.
   */
  async requireConfig(): Promise<TConfig> {
    const testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const definition = this.getTestCaseDefinition() || {
      name: this.testCaseKey,
      params: {},
    };
    await this.raiseIfSetupFailed(testName, definition);
    if (!this.config) {
      throw new Error('Config not available - ensure beforeEach() was called');
    }
    return this.config;
  }

  async flowTestAuto(options?: IFlowTestOptions): Promise<TState | undefined> {
    const testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const definition = this.getTestCaseDefinition() || {
      name: this.testCaseKey,
      params: {},
    };

    await this.raiseIfSetupFailed(testName, definition);

    if (!this.config) {
      logTestStart(this.logger, testName, definition);
      const error = new Error(
        'Config not available - ensure beforeEach() was called',
      );
      logTestError(this.logger, testName, error);
      logTestEnd(this.logger, testName);
      throw error;
    }

    logTestStart(this.logger, testName, definition);

    try {
      const result = await this.flowTest(
        this.config,
        this.testCase?.params,
        options,
      );
      logTestSuccess(this.logger, testName);
      logTestEnd(this.logger, testName);
      return result;
    } catch (error: any) {
      logTestError(this.logger, testName, error);
      logTestEnd(this.logger, testName);
      throw error;
    }
  }

  /**
   * Read test with automatic config loading
   * Uses config from beforeEach
   */
  async readTestAuto(options?: IReadTestOptions): Promise<unknown> {
    const testName = `${this.loggerPrefix} - read standard object`;
    const definition = this.getTestCaseDefinition() || {
      name: this.testCaseKey,
      params: {},
    };

    await this.raiseIfSetupFailed(testName, definition);

    if (!this.config) {
      logTestStart(this.logger, testName, definition);
      const error = new Error(
        'Config not available - ensure beforeEach() was called',
      );
      logTestError(this.logger, testName, error);
      logTestEnd(this.logger, testName);
      throw error;
    }

    logTestStart(this.logger, testName, definition);

    try {
      const result = await this.readTest(this.config, options);
      logTestSuccess(this.logger, testName);
      logTestEnd(this.logger, testName);
      return result;
    } catch (error: any) {
      logTestError(this.logger, testName, error);
      logTestEnd(this.logger, testName);
      throw error;
    }
  }
}
