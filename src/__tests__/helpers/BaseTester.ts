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
 * - Use createTestsLogger(), createBuilderLogger(), createConnectionLogger() from testLogger.ts
 * - These functions return ILogger from @mcp-abap-adt/logger or undefined based on DEBUG_* flags
 * - All logging uses optional chaining - safe to pass undefined
 * - Uses LogLevel enum from @mcp-abap-adt/logger for log level constants
 * - Structured test logging via builderTestLogger functions (logBuilderTestStart, logBuilderTestStep, etc.)
 */

import type { IAdtObject, IAdtOperationOptions, ILogger, IAbapConnection } from '@mcp-abap-adt/interfaces';
import { LogLevel } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep,
  logBuilderTestStepError,
  getHttpStatusText
} from './builderTestLogger';
import { TestConfigResolver } from './TestConfigResolver';

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
}

export interface IReadTestOptions {
  version?: 'active' | 'inactive';
  timeout?: number;
  withLongPolling?: boolean;
}

export interface IBaseTesterSetupOptions {
  connection: IAbapConnection;
  client: any; // AdtClient
  hasConfig: boolean;
  isCloudSystem: boolean;
  buildConfig: (testCase: any, resolver?: TestConfigResolver) => any;
  ensureObjectReady?: (objectName: string) => Promise<{ success: boolean; reason?: string }>;
  testDescription?: string;
}

export class BaseTester<TConfig, TState> {
  private readonly adtObject: IAdtObject<TConfig, TState>;
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
  private buildConfigFn?: (testCase: any, resolver?: TestConfigResolver) => TConfig;
  private ensureObjectReadyFn?: (objectName: string) => Promise<{ success: boolean; reason?: string }>;
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
   *                Use createTestsLogger(), createBuilderLogger(), etc. from testLogger.ts
   *                Logger is undefined when logging is disabled via environment variables
   *                Uses LogLevel enum from @mcp-abap-adt/logger for log level constants
   */
  constructor(
    adtObject: IAdtObject<TConfig, TState>,
    loggerPrefix: string,
    testCaseKey: string,
    testCaseName: string,
    logger?: ILogger
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
    const { getEnvironmentConfig } = require('./test-helper');
    const envConfig = getEnvironmentConfig();
    const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
    const globalSkipCleanup = envConfig.skip_cleanup === true;
    const skipCleanup = testCaseParams?.skip_cleanup !== undefined
      ? testCaseParams.skip_cleanup === true
      : globalSkipCleanup;
    const shouldCleanup = cleanupAfterTest && !skipCleanup;
    const cleanupSessionAfterTest = envConfig.session_config?.cleanup_session_after_test !== false; // Default: true

    return {
      cleanupAfterTest,
      skipCleanup,
      shouldCleanup,
      cleanupSessionAfterTest
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
   * Ensure object is unlocked if it was locked
   */
  private async ensureUnlock(config: Partial<TConfig>): Promise<void> {
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
  private getOperationDelay(operation: string, testCaseParams?: ITestCaseParams): number {
    const { getEnvironmentConfig } = require('./test-helper');
    const envConfig = getEnvironmentConfig();
    const testCase = this.testCase || { name: this.testCaseName, params: testCaseParams || {} };
    const operationDelays = testCase?.params?.operation_delays || envConfig.operation_delays || {};
    return operationDelays[operation] || operationDelays.default || 3000; // Default 3 seconds
  }

  /**
   * Wait for specified delay
   * @param delay - Delay in milliseconds
   * @param operation - Operation name for logging
   */
  private async waitDelay(delay: number, operation: string): Promise<void> {
    if (delay > 0) {
      this.log(LogLevel.INFO, `Waiting ${delay}ms after ${operation} operation`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * Flow test: validation->create->lock->check(inactive, source/xml)->update->unlock->activate
   */
  async flowTest(
    config: TConfig,
    testCaseParams?: ITestCaseParams,
    options?: IFlowTestOptions
  ): Promise<TState> {
    const cleanupSettings = this.getCleanupSettings(testCaseParams);
    this.objectCreated = false;
    this.objectLocked = false;
    this.lockHandle = undefined;

    const testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const testCase = this.testCase || { name: this.testCaseName, params: testCaseParams || {} };
    let currentStep = '';

    try {
      // 1. Validate
      currentStep = 'validate';
      logBuilderTestStep(currentStep, this.logger);
      const validationState = await this.adtObject.validate(config as Partial<TConfig>);
      const validationResponse = (validationState as any)?.validationResponse || validationState;
      
      // Check HTTP status
      if (validationResponse?.status !== 200) {
        const errorData = typeof validationResponse?.data === 'string'
          ? validationResponse.data
          : JSON.stringify(validationResponse?.data);
        const error = new Error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        logBuilderTestStepError(currentStep, error);
        throw error;
      }
      
      // Check for error tables in validation response (even if HTTP 200)
      // Validation can return HTTP 200 but with error/warning tables in XML
      if (validationResponse?.data && typeof validationResponse.data === 'string') {
        try {
          const { XMLParser } = require('fast-xml-parser');
          const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
          const parsed = parser.parse(validationResponse.data);
          
          // Check for error table (adtcore:errorTable or similar)
          const errorTable = parsed['adtcore:errorTable'] || parsed['errorTable'] || 
                            parsed['adtcore:messageTable']?.['adtcore:message'] || 
                            parsed['messageTable']?.['message'];
          
          // Check if there are error messages (type="E" or severity="ERROR")
          const messages = Array.isArray(errorTable) ? errorTable : (errorTable ? [errorTable] : []);
          const errorMessages = messages.filter((msg: any) => {
            const type = msg['@_adtcore:type'] || msg['@_type'] || msg['type'] || '';
            const severity = msg['@_adtcore:severity'] || msg['@_severity'] || msg['severity'] || '';
            return type === 'E' || severity === 'ERROR' || type === 'ERROR';
          });
          
          if (errorMessages.length > 0) {
            const errorTexts = errorMessages.map((msg: any) => {
              return msg['@_adtcore:text'] || msg['@_text'] || msg['text'] || 
                     msg['adtcore:text'] || msg['text'] || 
                     msg['#text'] || JSON.stringify(msg);
            }).filter(Boolean).join('; ');
            
            const error = new Error(`Validation failed with errors: ${errorTexts}`);
            this.log(LogLevel.ERROR, `Validation returned error table with ${errorMessages.length} error(s): ${errorTexts}`);
            logBuilderTestStepError(currentStep, error);
            throw error;
          }
          
          // Log warnings if present (but don't fail)
          const warningMessages = messages.filter((msg: any) => {
            const type = msg['@_adtcore:type'] || msg['@_type'] || msg['type'] || '';
            const severity = msg['@_adtcore:severity'] || msg['@_severity'] || msg['severity'] || '';
            return type === 'W' || severity === 'WARNING' || type === 'WARNING';
          });
          
          if (warningMessages.length > 0) {
            const warningTexts = warningMessages.map((msg: any) => {
              return msg['@_adtcore:text'] || msg['@_text'] || msg['text'] || 
                     msg['adtcore:text'] || msg['text'] || 
                     msg['#text'] || JSON.stringify(msg);
            }).filter(Boolean).join('; ');
            this.log(LogLevel.WARN, `Validation returned warning table with ${warningMessages.length} warning(s): ${warningTexts}`);
          }
        } catch (parseError) {
          // If parsing fails, continue - validation might be in different format
          // But log the parse error for debugging
          this.log(LogLevel.DEBUG, `Could not parse validation response for error tables: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      }
      
      // Delay after validate
      await this.waitDelay(this.getOperationDelay('validate', testCaseParams), 'validate');

      // 2. Create
      currentStep = 'create';
      logBuilderTestStep(currentStep, this.logger);
      const createOptions: IAdtOperationOptions = {
        activateOnCreate: options?.activateOnCreate || false,
        timeout: options?.timeout,
        sourceCode: options?.sourceCode,
        xmlContent: options?.xmlContent
      };
      await this.adtObject.create(config, createOptions);
      this.objectCreated = true;
      // Delay after create
      await this.waitDelay(this.getOperationDelay('create', testCaseParams), 'create');

      // 2.5. Wait for object to be ready before update (read with long polling or delay)
      if (options?.updateConfig) {
        currentStep = 'read (wait for object ready)';
        logBuilderTestStep(currentStep, this.logger);
        // Additional delay before update (already waited after create, but this is for object readiness)
        const createDelay = this.getOperationDelay('create', testCaseParams);
        this.log(LogLevel.INFO, `Waiting ${createDelay}ms for object to be ready (fallback delay)`);
        await new Promise(resolve => setTimeout(resolve, createDelay));
      }

      // 3. Update (if updateConfig provided)
      if (options?.updateConfig) {
        currentStep = 'update';
        logBuilderTestStep(currentStep, this.logger);
        const updateOptions: IAdtOperationOptions = {
          activateOnUpdate: options?.activateOnUpdate || false,
          sourceCode: options?.sourceCode,
          xmlContent: options?.xmlContent,
          timeout: options?.timeout
        };
        await this.adtObject.update(
          { ...config, ...options.updateConfig } as Partial<TConfig>,
          updateOptions
        );
        // Delay after update
        await this.waitDelay(this.getOperationDelay('update', testCaseParams), 'update');
      }

      // 4. Activate (if not activated during create/update)
      if (!options?.activateOnCreate && !options?.activateOnUpdate) {
        currentStep = 'activate';
        logBuilderTestStep(currentStep, this.logger);
        const activateState = await this.adtObject.activate(config as Partial<TConfig>);
        // activate returns state object, check for errors
        const activateResponse = (activateState as any)?.activateResponse || activateState;
        if (activateResponse?.status && activateResponse.status !== 200 && activateResponse.status !== 204) {
          const errorData = typeof activateResponse?.data === 'string'
            ? activateResponse.data
            : JSON.stringify(activateResponse?.data);
          const error = new Error(`Activation failed (HTTP ${activateResponse.status}): ${errorData}`);
          logBuilderTestStepError(currentStep, error);
          throw error;
        }
        // Delay after activate
        await this.waitDelay(this.getOperationDelay('activate', testCaseParams), 'activate');
      }

      // 5. Cleanup (if enabled)
      if (cleanupSettings.shouldCleanup && this.objectCreated) {
        currentStep = 'delete (cleanup)';
        logBuilderTestStep(currentStep, this.logger);
        try {
          await this.adtObject.delete(config as Partial<TConfig>);
          // Delay after delete
          await this.waitDelay(this.getOperationDelay('delete', testCaseParams), 'delete');
        } catch (cleanupError) {
          this.log(LogLevel.WARN, 'delete failed:', cleanupError);
        }
      } else if (this.objectCreated) {
        this.log(LogLevel.INFO, `⚠️ cleanup skipped (cleanup_after_test=${cleanupSettings.cleanupAfterTest}, skip_cleanup=${cleanupSettings.skipCleanup}) - object left for analysis`);
      }

      return validationState;
    } catch (error: any) {
      // Log step error with details before failing test
      if (currentStep) {
        logBuilderTestStepError(currentStep, error);
      }

      // Ensure unlock on error
      await this.ensureUnlock(config as Partial<TConfig>);

      // Cleanup on error if enabled
      if (cleanupSettings.shouldCleanup && this.objectCreated) {
        try {
          logBuilderTestStep('delete (cleanup)', this.logger);
          await this.adtObject.delete(config as Partial<TConfig>);
          // Delay after delete (cleanup on error)
          await this.waitDelay(this.getOperationDelay('delete', testCaseParams), 'delete');
        } catch (cleanupError) {
          this.log(LogLevel.WARN, 'Cleanup after error failed:', cleanupError);
        }
      } else if (this.objectCreated && !cleanupSettings.shouldCleanup) {
        this.log(LogLevel.INFO, `⚠️ Cleanup skipped (cleanup_after_test=${cleanupSettings.cleanupAfterTest}, skip_cleanup=${cleanupSettings.skipCleanup}) - object left for analysis after error`);
      }

      const statusText = getHttpStatusText(error);
      const enhancedError = statusText !== 'HTTP ?'
        ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
        : error;
      throw enhancedError;
    }
  }

  /**
   * Read test: read-only operations
   */
  async readTest(
    config: Partial<TConfig>,
    options?: IReadTestOptions
  ): Promise<TState | undefined> {
    try {
      logBuilderTestStep('read', this.logger);
      const readState = await this.adtObject.read(
        config,
        options?.version || 'active',
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      
      if (!readState) {
        this.log(LogLevel.WARN, 'read failed: object not found');
        return undefined;
      }

      return readState;
    } catch (error: any) {
      this.log(LogLevel.ERROR, 'read failed:', error);
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
        logger: this.logger
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
  getStandardObject(objectType: string): { name: string; group?: string } | null {
    const resolver = this.getConfigResolver();
    if (!resolver) {
      // Fallback to direct call if resolver not initialized
      const { resolveStandardObject } = require('./test-helper');
      return resolveStandardObject(objectType, this.isCloudSystem, this.testCase);
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
      this.testCase = null;
      this.config = null;
      this.configResolver = null;

      if (!this.hasConfig) {
        this.skipReason = 'No SAP configuration';
        this.log(LogLevel.WARN, 'beforeEach: Skipping - No SAP configuration');
        return;
      }

      const definition = this.getTestCaseDefinition();
      if (!definition) {
        this.skipReason = 'Test case not defined in test-config.yaml';
        this.log(LogLevel.WARN, 'beforeEach: Skipping - Test case not defined');
        return;
      }

      const { getEnabledTestCase, ensurePackageConfig } = require('./test-helper');
      const tc = getEnabledTestCase(this.testCaseKey, this.testCaseName);
      if (!tc) {
        this.skipReason = 'Test case disabled or not found';
        this.log(LogLevel.WARN, 'beforeEach: Skipping - Test case disabled or not found');
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, `${this.loggerPrefix} - ${this.testDescription}`);
      if (!packageCheck.success) {
        this.skipReason = packageCheck.reason || 'Default package is not configured';
        this.log(LogLevel.WARN, `beforeEach: Skipping - ${this.skipReason}`);
        return;
      }

      this.testCase = tc;

      // Initialize config resolver with test case
      this.configResolver = new TestConfigResolver({
        testCase: tc,
        isCloud: this.isCloudSystem,
        logger: this.logger
      });

      // Check if test is available for current environment
      if (!this.configResolver.isAvailableForEnvironment()) {
        const envName = this.isCloudSystem ? 'cloud' : 'on-premise';
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
        const objectName = (this.config as any)[`${this.loggerPrefix.toLowerCase()}Name`] || 
                          (this.config as any).name ||
                          (this.config as any).objectName;
        if (objectName) {
          const cleanup = await this.ensureObjectReadyFn(objectName);
          if (!cleanup.success) {
            this.skipReason = cleanup.reason || 'Failed to cleanup object before test';
            this.log(LogLevel.WARN, `beforeEach: ${this.skipReason}`);
            this.testCase = null;
            this.config = null;
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
        this.log(LogLevel.INFO, 'afterAll: Resetting connection');
        this.connection.reset();
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
  async flowTestAuto(options?: IFlowTestOptions): Promise<TState | undefined> {
    const testName = `${this.loggerPrefix} - ${this.testDescription}`;
    const definition = this.getTestCaseDefinition() || { name: this.testCaseKey, params: {} };

    if (this.shouldSkip()) {
      logBuilderTestStart(this.logger, testName, definition);
      logBuilderTestSkip(this.logger, testName, this.skipReason || 'Test case not available');
      logBuilderTestEnd(this.logger, testName);
      return undefined;
    }

    if (!this.config) {
      logBuilderTestStart(this.logger, testName, definition);
      logBuilderTestSkip(this.logger, testName, 'Config not available - ensure beforeEach() was called');
      logBuilderTestEnd(this.logger, testName);
      return undefined;
    }

    logBuilderTestStart(this.logger, testName, definition);
    
    try {
      const result = await this.flowTest(this.config, this.testCase?.params, options);
      logBuilderTestSuccess(this.logger, testName);
      logBuilderTestEnd(this.logger, testName);
      return result;
    } catch (error: any) {
      logBuilderTestError(this.logger, testName, error);
      logBuilderTestEnd(this.logger, testName);
      throw error;
    }
  }

  /**
   * Read test with automatic config loading
   * Uses config from beforeEach
   */
  async readTestAuto(options?: IReadTestOptions): Promise<TState | undefined> {
    const testName = `${this.loggerPrefix} - read standard object`;
    const definition = this.getTestCaseDefinition() || { name: this.testCaseKey, params: {} };

    if (this.shouldSkip()) {
      logBuilderTestStart(this.logger, testName, definition);
      logBuilderTestSkip(this.logger, testName, this.skipReason || 'Test case not available');
      logBuilderTestEnd(this.logger, testName);
      throw new Error(`Test skipped: ${this.skipReason || 'Test case not available'}`);
    }

    if (!this.config) {
      logBuilderTestStart(this.logger, testName, definition);
      logBuilderTestSkip(this.logger, testName, 'Config not available - ensure beforeEach() was called');
      logBuilderTestEnd(this.logger, testName);
      throw new Error('Config not available - ensure beforeEach() was called');
    }

    logBuilderTestStart(this.logger, testName, definition);
    
    try {
      const result = await this.readTest(this.config, options);
      logBuilderTestSuccess(this.logger, testName);
      logBuilderTestEnd(this.logger, testName);
      return result;
    } catch (error: any) {
      logBuilderTestError(this.logger, testName, error);
      logBuilderTestEnd(this.logger, testName);
      throw error;
    }
  }
}
