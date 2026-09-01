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

import type {
  IAbapConnection,
  IAdtActivatable,
  IAdtCreatable,
  IAdtModifiable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtValidatable,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { LogLevel } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { recycleTestSession, releaseTestConnection } from './sessionConfig';
import { TestConfigResolver } from './TestConfigResolver';
import {
  getHttpStatusText,
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestStepError,
  logTestSuccess,
} from './testProgressLogger';

export interface ITestCaseParams {
  skip_cleanup?: boolean;
  transport_request?: string;
  [key: string]: any;
}

export interface IFlowTestOptions {
  sourceCode?: string;
  xmlContent?: string;
  updateConfig?: any;
  activateOnCreate?: boolean;
  activateOnUpdate?: boolean;
  timeout?: number;
  readMetadata?: boolean;
  readMetadataOptions?: { withLongPolling?: boolean };
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
  isLegacySystem?: boolean;
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
 * here once their types stopped claiming otherwise. These are the seven methods
 * the class calls; `activate` is optional because not every object is
 * activated, and the call site already guards on it.
 */
export type TestableObject<TConfig, TState> = IAdtCreatable<TConfig, TState> &
  IAdtReadable<TConfig, TState> &
  IAdtModifiable<TConfig, TState> &
  IAdtValidatable<TConfig, TState> &
  Partial<IAdtActivatable<TConfig, TState>>;

export class BaseTester<TConfig, TState> {
  private readonly adtObject: TestableObject<TConfig, TState>;
  private readonly loggerPrefix: string;
  private readonly testCaseKey: string;
  private readonly testCaseName: string;
  private readonly logger?: ILogger;
  private objectCreated: boolean = false;
  private objectLocked: boolean = false;
  private lockHandle: string | undefined;

  // Setup state
  private connection?: IAbapConnection;
  private client?: any;
  private hasConfig: boolean = false;
  private isCloudSystem: boolean = false;
  private isLegacySystem: boolean = false;
  private buildConfigFn?: (
    testCase: any,
    resolver?: TestConfigResolver,
  ) => TConfig;
  /**
   * A failure to put the system into the state the test needs.
   *
   * Kept apart from `skipReason` because the two mean opposite things and were
   * being reported the same way. `skipReason` says the test does not apply here
   * — no SAP configured, `available_in` excludes this system, the case is
   * disabled. Nothing ran and nothing should have.
   *
   * This says the test does apply and the run could not get far enough to try:
   * a leftover object that would not delete, most often. Routed through
   * `skipReason` it printed SKIP and jest counted it green, so a suite that
   * tested nothing was indistinguishable from one that passed — measured on
   * E19, where a package left behind by a failed delete made the next run
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
  private skipReason: string | null = null;
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
    adtObject: TestableObject<TConfig, TState>,
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
    try {
      logTestStep('delete (pre-existing object cleanup)', this.logger);
      if (this.cleanupObjectFn) {
        await this.cleanupObjectFn(config);
      } else {
        await this.adtObject.delete(config as Partial<TConfig>);
      }
      this.log(LogLevel.INFO, 'Pre-existing object deleted successfully');
      this.objectCreated = false;
    } catch (cleanupError) {
      // Not raised: this runs on the skip path, where the test was never going
      // to execute, and turning a legitimate skip red would say the wrong
      // thing. Recorded at ERROR because the object is still there and the run
      // after this one will meet it.
      this.log(
        LogLevel.ERROR,
        'Pre-existing object cleanup failed — it is left on the system:',
        cleanupError,
      );
    }
  }

  /**
   * Ensure object is unlocked if it was locked
   */
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
          'class',
          configAny.className,
          undefined,
          version,
        );
      }
      if (configAny.interfaceName) {
        return utils.getObjectSourceUri(
          'interface',
          configAny.interfaceName,
          undefined,
          version,
        );
      }
      if (configAny.programName) {
        return utils.getObjectSourceUri(
          'program',
          configAny.programName,
          undefined,
          version,
        );
      }
      if (configAny.functionModuleName && configAny.functionGroupName) {
        return utils.getObjectSourceUri(
          'functionmodule',
          configAny.functionModuleName,
          configAny.functionGroupName,
          version,
        );
      }
      if (configAny.ddlName) {
        return utils.getObjectSourceUri(
          'view',
          configAny.ddlName,
          undefined,
          version,
        );
      }
      if (configAny.structureName) {
        return utils.getObjectSourceUri(
          'structure',
          configAny.structureName,
          undefined,
          version,
        );
      }
      if (configAny.tableName) {
        return utils.getObjectSourceUri(
          'table',
          configAny.tableName,
          undefined,
          version,
        );
      }
      if (configAny.tableTypeName) {
        return utils.getObjectSourceUri(
          'tabletype',
          configAny.tableTypeName,
          undefined,
          version,
        );
      }

      return undefined;
    };

    const readVersion = async (
      version: 'active' | 'inactive' | undefined,
      label: string,
      withLongPolling: boolean = false,
    ): Promise<string | undefined> => {
      logTestStep(label, this.logger);
      // No source URL logging by default (keep logs concise)
      let readState: TState | undefined;
      try {
        readState = await this.adtObject.read(
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
          readState = await this.adtObject.read(
            config as Partial<TConfig>,
            version,
            undefined,
          );
        } else {
          throw error;
        }
      }
      if (!readState || !(readState as any)?.readResult) {
        throw new Error(`Read ${version} failed: no response`);
      }
      const payload = getPayloadText((readState as any)?.readResult?.data);
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
      const metadataState = await this.adtObject.readMetadata(
        config as Partial<TConfig>,
        withLongPolling ? { withLongPolling: true } : undefined,
      );
      const metadataResult =
        (metadataState as any)?.metadataResult ||
        (metadataState as any)?.readResult;
      const payload = getPayloadText(metadataResult?.data);
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
      // Skip on legacy — objectproperties endpoint does not exist on BASIS < 7.50
      if (this.isLegacySystem) {
        return;
      }
      const sourceUrl = getSourceUrl(undefined);
      if (!sourceUrl) {
        return;
      }
      const encodedUri = encodeURIComponent(sourceUrl);
      const url = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodedUri}`;
      logTestStep(label, this.logger);
      try {
        const response = await this.connection.makeAdtRequest({
          url,
          method: 'GET',
          timeout: getTimeout('default'),
          headers: {
            Accept:
              'application/vnd.sap.adt.repository.objproperties.result.v1+xml, application/vnd.sap.adt.objectproperties+xml, application/xml',
          },
        });
        const payload = getPayloadText(response?.data);
        logTestStep(
          `${label} length: ${payload?.length || 0} characters`,
          this.logger,
        );
      } catch (error: any) {
        const errorText =
          error?.message ||
          error?.response?.data ||
          'Unknown object properties error';
        logTestStep(
          `${label} failed: ${String(errorText).slice(0, 200)}`,
          this.logger,
        );
      }
    };

    const shouldSkipInitialSourceRead = (): boolean => {
      const configAny = config as any;
      return Boolean(configAny?.className || configAny?.interfaceName);
    };

    /**
     * Which version the post-create read asks for.
     *
     * Measured on E19: for an include the versionless read answered nothing and
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
      const validationState = await this.adtObject.validate(
        config as Partial<TConfig>,
      );
      const validationResponse =
        (validationState as any)?.validationResponse || validationState;

      // Check HTTP status
      if (validationResponse?.status !== 200) {
        const errorData =
          typeof validationResponse?.data === 'string'
            ? validationResponse.data
            : JSON.stringify(validationResponse?.data);
        const error = new Error(
          `Validation failed (HTTP ${validationResponse?.status}): ${errorData}`,
        );
        logTestStepError(currentStep, error);
        throw error;
      }

      // Check for error tables in validation response (even if HTTP 200)
      // Validation can return HTTP 200 but with error/warning tables in XML
      if (
        validationResponse?.data &&
        typeof validationResponse.data === 'string'
      ) {
        try {
          const { XMLParser } = require('fast-xml-parser');
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
          });
          const parsed = parser.parse(validationResponse.data);

          // Check for error table (adtcore:errorTable or similar)
          const errorTable =
            parsed['adtcore:errorTable'] ||
            parsed.errorTable ||
            parsed['adtcore:messageTable']?.['adtcore:message'] ||
            parsed.messageTable?.message;

          // Check if there are error messages (type="E" or severity="ERROR")
          const messages = Array.isArray(errorTable)
            ? errorTable
            : errorTable
              ? [errorTable]
              : [];
          const errorMessages = messages.filter((msg: any) => {
            const type =
              msg['@_adtcore:type'] || msg['@_type'] || msg.type || '';
            const severity =
              msg['@_adtcore:severity'] ||
              msg['@_severity'] ||
              msg.severity ||
              '';
            return type === 'E' || severity === 'ERROR' || type === 'ERROR';
          });

          if (errorMessages.length > 0) {
            const errorTexts = errorMessages
              .map((msg: any) => {
                return (
                  msg['@_adtcore:text'] ||
                  msg['@_text'] ||
                  msg.text ||
                  msg['adtcore:text'] ||
                  msg.text ||
                  msg['#text'] ||
                  JSON.stringify(msg)
                );
              })
              .filter(Boolean)
              .join('; ');

            const error = new Error(
              `Validation failed with errors: ${errorTexts}`,
            );
            this.log(
              LogLevel.ERROR,
              `Validation returned error table with ${errorMessages.length} error(s): ${errorTexts}`,
            );
            logTestStepError(currentStep, error);
            throw error;
          }

          // Log warnings if present (but don't fail)
          const warningMessages = messages.filter((msg: any) => {
            const type =
              msg['@_adtcore:type'] || msg['@_type'] || msg.type || '';
            const severity =
              msg['@_adtcore:severity'] ||
              msg['@_severity'] ||
              msg.severity ||
              '';
            return type === 'W' || severity === 'WARNING' || type === 'WARNING';
          });

          if (warningMessages.length > 0) {
            const warningTexts = warningMessages
              .map((msg: any) => {
                return (
                  msg['@_adtcore:text'] ||
                  msg['@_text'] ||
                  msg.text ||
                  msg['adtcore:text'] ||
                  msg.text ||
                  msg['#text'] ||
                  JSON.stringify(msg)
                );
              })
              .filter(Boolean)
              .join('; ');
            this.log(
              LogLevel.WARN,
              `Validation returned warning table with ${warningMessages.length} warning(s): ${warningTexts}`,
            );
          }
        } catch (parseError) {
          // If parsing fails, continue - validation might be in different format
          // But log the parse error for debugging
          this.log(
            LogLevel.DEBUG,
            `Could not parse validation response for error tables: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
        }
      }

      // Delay after validate
      await this.waitDelay(
        this.getOperationDelay('validate', testCaseParams),
        'validate',
      );

      // 2. Create
      currentStep = 'create';
      logTestStep(currentStep, this.logger);
      const createOptions: IAdtOperationOptions = {
        activateOnCreate: options?.activateOnCreate || false,
        timeout: options?.timeout,
        sourceCode: options?.sourceCode,
        xmlContent: options?.xmlContent,
      };
      await this.adtObject.create(config, createOptions);
      this.objectCreated = true;
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

        currentStep = 'update';
        logTestStep(currentStep, this.logger);
        const updateOptions: IAdtOperationOptions = {
          activateOnUpdate: options?.activateOnUpdate || false,
          // The UPDATE content, not the create content. Every handler resolves
          // `options.sourceCode ?? config.sourceCode` with options winning, so
          // passing the create source here overwrote the object with what it
          // already held and the update became a no-op — measured on E19 with
          // the include suite, where the stored source stayed 52 characters
          // while `update_source_code` was 62.
          sourceCode: options?.updateConfig?.sourceCode ?? options?.sourceCode,
          xmlContent: options?.updateConfig?.xmlContent ?? options?.xmlContent,
          timeout: options?.timeout,
        };
        await this.adtObject.update(
          { ...config, ...options.updateConfig } as Partial<TConfig>,
          updateOptions,
        );
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
        const activateState = await this.adtObject.activate(
          config as Partial<TConfig>,
        );
        // activate returns state object, check for errors
        const activateResponse =
          (activateState as any)?.activateResponse || activateState;
        if (
          activateResponse?.status &&
          activateResponse.status !== 200 &&
          activateResponse.status !== 204
        ) {
          const errorData =
            typeof activateResponse?.data === 'string'
              ? activateResponse.data
              : JSON.stringify(activateResponse?.data);
          const error = new Error(
            `Activation failed (HTTP ${activateResponse.status}): ${errorData}`,
          );
          logTestStepError(currentStep, error);
          throw error;
        }
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
        const updateContent =
          options.updateConfig?.sourceCode ??
          options.updateConfig?.xmlContent ??
          options.sourceCode ??
          options.xmlContent;
        const updateContentKind =
          options.updateConfig?.sourceCode !== undefined
            ? 'source'
            : options.updateConfig?.xmlContent !== undefined
              ? 'xml'
              : options.sourceCode !== undefined
                ? 'source'
                : options.xmlContent !== undefined
                  ? 'xml'
                  : 'unknown';

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

      if (options?.readMetadata) {
        currentStep = 'readMetadata';
        logTestStep(currentStep, this.logger);
        try {
          const metadataResponse = await this.adtObject.readMetadata(
            config as Partial<TConfig>,
            options.readMetadataOptions,
          );
          const responseStatus = (metadataResponse as any)?.status;
          if (
            responseStatus &&
            responseStatus !== 200 &&
            responseStatus !== 204
          ) {
            const errorData =
              typeof (metadataResponse as any)?.data === 'string'
                ? (metadataResponse as any).data
                : JSON.stringify((metadataResponse as any)?.data);
            const error = new Error(
              `Read metadata failed (HTTP ${responseStatus}): ${errorData}`,
            );
            logTestStepError(currentStep, error);
            throw error;
          }
        } catch (error: any) {
          if (error?.response?.status === 406) {
            const { isHttpStatusAllowed } = require('./test-helper');
            if (isHttpStatusAllowed(406, this.testCase)) {
              const { getAcceptHint } = require('./test-helper');
              const acceptHint = getAcceptHint(error);
              this.log(
                LogLevel.WARN,
                `readMetadata skipped: 406 Not Acceptable (allowed by config)${
                  acceptHint ? `; ${acceptHint}` : ''
                }`,
              );
              return validationState;
            }
          }
          logTestStepError(currentStep, error);
          throw error;
        }
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
            await recycleTestSession(this.connection);
          }
          await this.adtObject.delete(config as Partial<TConfig>);
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
          // workflow and report success too. Measured on E19 2026-08-31 with
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

      return validationState;
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
            await recycleTestSession(this.connection);
          }
          logTestStep('delete (cleanup)', this.logger);
          await this.adtObject.delete(config as Partial<TConfig>);
          // Delay after delete (cleanup on error)
          await this.waitDelay(
            this.getOperationDelay('delete', testCaseParams),
            'delete',
          );
        } catch (cleanupError) {
          // Not rethrown, deliberately: the test already has a failure, and it
          // is the one worth reporting. This is recorded at ERROR so the object
          // left behind is not invisible either.
          this.log(
            LogLevel.ERROR,
            'Cleanup after a failed test also failed — the object is left on the system:',
            cleanupError,
          );
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
   * Ensure the connection is open, reconnecting if needed.
   * RFC connections close on close()/disconnect() — reopen before the next test.
   */
  private async ensureConnection(): Promise<void> {
    if (!this.connection) return;
    const conn = this.connection as any;
    // RFC connections: rfcClient is set to null after close.
    // Only reconnect if the connection is actually dead.
    const isRfc = conn.rfcClient !== undefined || conn.rfcParams !== undefined;
    if (isRfc) {
      if (!conn.rfcClient?.alive) {
        this.log(LogLevel.INFO, 'Reconnecting closed RFC connection');
        await conn.connect();
      }
    }
  }

  /**
   * Read test: read-only operations
   */
  async readTest(
    config: Partial<TConfig>,
    options?: IReadTestOptions,
  ): Promise<TState | undefined> {
    // Ensure connection is open (RFC connections may close after flowTest cleanup)
    await this.ensureConnection();

    try {
      logTestStep('read', this.logger);
      const readState = await this.adtObject.read(
        config,
        options?.version || 'active',
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );

      if (!readState) {
        this.log(LogLevel.WARN, 'read failed: object not found');
        return undefined;
      }

      if (options?.skipReadMetadata) {
        return readState;
      }

      logTestStep('readMetadata', this.logger);
      try {
        await this.adtObject.readMetadata(
          config,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        );
      } catch (error: any) {
        if (error?.response?.status === 406) {
          const { isHttpStatusAllowed } = require('./test-helper');
          if (isHttpStatusAllowed(406, this.testCase)) {
            const { getAcceptHint } = require('./test-helper');
            const acceptHint = getAcceptHint(error);
            this.log(
              LogLevel.WARN,
              `readMetadata skipped: 406 Not Acceptable (allowed by config)${
                acceptHint ? `; ${acceptHint}` : ''
              }`,
            );
            return readState;
          }
        }
        throw error;
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
    const { getTestCaseDefinition } = require('./test-helper');
    return getTestCaseDefinition(this.testCaseKey, this.testCaseName);
  }

  /**
   * Get enabled test case from YAML
   */
  getEnabledTestCase(): any {
    const { getEnabledTestCase } = require('./test-helper');
    return getEnabledTestCase(this.testCaseKey, this.testCaseName);
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
        this.isLegacySystem,
      );
    }
    // Use null testCase to prioritize standard_objects registry
    const { resolveStandardObject } = require('./test-helper');
    return resolveStandardObject(
      objectType,
      this.isCloudSystem,
      null,
      this.isLegacySystem,
    );
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
    // Auto-detect legacy from client class name if not explicitly provided
    this.isLegacySystem =
      options.isLegacySystem ??
      options.client?.constructor?.name === 'AdtClientLegacy';
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
      this.skipReason = null;
      this.setupError = null;
      this.testCase = null;
      this.config = null;
      this.configResolver = null;

      if (!this.hasConfig) {
        this.skipReason = 'No SAP configuration';
        this.log(LogLevel.WARN, 'beforeEach: Skipping - No SAP configuration');
        return;
      }

      // Ensure connection is open (RFC may have been closed by previous test cleanup)
      await this.ensureConnection();

      const definition = this.getTestCaseDefinition();
      if (!definition) {
        this.skipReason = 'Test case not defined in test-config.yaml';
        this.log(LogLevel.WARN, 'beforeEach: Skipping - Test case not defined');
        return;
      }

      const {
        getEnabledTestCase,
        ensurePackageConfig,
      } = require('./test-helper');
      const tc = getEnabledTestCase(this.testCaseKey, this.testCaseName);
      if (!tc) {
        this.skipReason = 'Test case disabled or not found';
        this.log(
          LogLevel.WARN,
          'beforeEach: Skipping - Test case disabled or not found',
        );
        return;
      }

      const packageCheck = ensurePackageConfig(
        tc.params,
        `${this.loggerPrefix} - ${this.testDescription}`,
      );
      if (!packageCheck.success) {
        this.skipReason =
          packageCheck.reason || 'Default package is not configured';
        this.log(LogLevel.WARN, `beforeEach: Skipping - ${this.skipReason}`);
        return;
      }

      this.testCase = tc;

      // Initialize config resolver with test case
      this.configResolver = new TestConfigResolver({
        testCase: tc,
        isCloud: this.isCloudSystem,
        isLegacy: this.isLegacySystem,
        logger: this.logger,
      });

      // Check if test is available for current environment
      if (!this.configResolver.isAvailableForEnvironment()) {
        const envName = this.isCloudSystem
          ? 'cloud'
          : this.isLegacySystem
            ? 'legacy'
            : 'on-premise';
        this.skipReason = `Test not available for ${envName} environment (check available_in in test-config.yaml)`;
        this.log(LogLevel.WARN, `beforeEach: ${this.skipReason}`);
        this.testCase = null;
        this.configResolver = null;
        return;
      }

      // Build config - pass resolver so buildConfig can use resolved parameters
      if (this.buildConfigFn) {
        try {
          this.config = this.buildConfigFn(tc, this.configResolver);
        } catch (error: any) {
          this.skipReason = `Failed to build config: ${error.message}`;
          this.log(LogLevel.ERROR, `beforeEach: ${this.skipReason}`);
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
        const objectName =
          (this.config as any)[`${camelPrefix}Name`] ||
          (this.config as any)[`${this.loggerPrefix.toLowerCase()}Name`] ||
          (this.config as any).name ||
          (this.config as any).objectName;
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
   * Get skip reason (if test should be skipped)
   */
  getSkipReason(): string | null {
    return this.skipReason;
  }

  /**
   * Check if test should be skipped
   */
  shouldSkip(): boolean {
    return this.skipReason !== null || !this.testCase || !this.config;
  }

  /**
   * Flow test with automatic config loading
   * Uses config from beforeEach
   * Returns undefined if test should be skipped
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
      const state = await this.adtObject.read(
        config as Partial<TConfig>,
        version,
      );
      const payload = payloadOf((state as any)?.readResult?.data);
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
        activateOnUpdate: options?.activateOnUpdate || false,
        sourceCode: options?.sourceCode,
        xmlContent: options?.xmlContent,
        timeout: options?.timeout,
      };
      const updateState = await this.adtObject.update(
        { ...config, ...options?.updateConfig } as Partial<TConfig>,
        updateOptions,
      );
      await this.waitDelay(
        this.getOperationDelay('update', testCaseParams),
        'update',
      );

      // 3. Activate — the container class, which is what `activate` on an
      //    include addresses. Skipped when the update already did it.
      if (!options?.activateOnUpdate && this.adtObject.activate) {
        currentStep = 'activate';
        logTestStep(currentStep, this.logger);
        const activateState = await this.adtObject.activate(
          config as Partial<TConfig>,
        );
        const activateResponse =
          (activateState as any)?.activateResponse || activateState;
        if (
          activateResponse?.status &&
          activateResponse.status !== 200 &&
          activateResponse.status !== 204
        ) {
          const errorData =
            typeof activateResponse?.data === 'string'
              ? activateResponse.data
              : JSON.stringify(activateResponse?.data);
          const error = new Error(
            `Activation failed (HTTP ${activateResponse.status}): ${errorData}`,
          );
          logTestStepError(currentStep, error);
          throw error;
        }
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
        await this.adtObject.readMetadata(
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

    this.raiseIfSetupFailed(testName, definition);

    if (this.shouldSkip()) {
      logTestStart(this.logger, testName, definition);
      logTestSkip(
        this.logger,
        testName,
        this.skipReason || 'Test case not available',
      );
      logTestEnd(this.logger, testName);
      return undefined;
    }

    if (!this.config) {
      logTestStart(this.logger, testName, definition);
      logTestSkip(
        this.logger,
        testName,
        'Config not available - ensure beforeEach() was called',
      );
      logTestEnd(this.logger, testName);
      return undefined;
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
   * Called before `shouldSkip()` in both auto entry points so it cannot be
   * mistaken for "does not apply here".
   */
  // biome-ignore lint/suspicious/noExplicitAny: logTestStart's own parameter
  private raiseIfSetupFailed(testName: string, definition: any): void {
    if (!this.setupError) return;
    logTestStart(this.logger, testName, definition);
    const error = new Error(
      `Test could not be set up: ${this.setupError}. The system was not in a ` +
        'state this test could run against, so nothing was verified.',
    );
    logTestError(this.logger, testName, error);
    logTestEnd(this.logger, testName);
    throw error;
  }

  async flowTestAuto(options?: IFlowTestOptions): Promise<TState | undefined> {
    const testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const definition = this.getTestCaseDefinition() || {
      name: this.testCaseKey,
      params: {},
    };

    this.raiseIfSetupFailed(testName, definition);

    if (this.shouldSkip()) {
      logTestStart(this.logger, testName, definition);
      logTestSkip(
        this.logger,
        testName,
        this.skipReason || 'Test case not available',
      );
      // Cleanup pre-existing object if ensureObjectReady flagged it
      if (this.objectCreated && this.config) {
        await this.cleanupExistingObject(this.config);
      }
      logTestEnd(this.logger, testName);
      return undefined;
    }

    if (!this.config) {
      logTestStart(this.logger, testName, definition);
      logTestSkip(
        this.logger,
        testName,
        'Config not available - ensure beforeEach() was called',
      );
      logTestEnd(this.logger, testName);
      return undefined;
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
  async readTestAuto(options?: IReadTestOptions): Promise<TState | undefined> {
    const testName = `${this.loggerPrefix} - read standard object`;
    const definition = this.getTestCaseDefinition() || {
      name: this.testCaseKey,
      params: {},
    };

    if (this.shouldSkip()) {
      logTestStart(this.logger, testName, definition);
      logTestSkip(
        this.logger,
        testName,
        this.skipReason || 'Test case not available',
      );
      logTestEnd(this.logger, testName);
      throw new Error(
        `Test skipped: ${this.skipReason || 'Test case not available'}`,
      );
    }

    if (!this.config) {
      logTestStart(this.logger, testName, definition);
      logTestSkip(
        this.logger,
        testName,
        'Config not available - ensure beforeEach() was called',
      );
      logTestEnd(this.logger, testName);
      throw new Error('Config not available - ensure beforeEach() was called');
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
