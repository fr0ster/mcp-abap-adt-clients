/**
 * TestConfigResolver - Centralized YAML configuration resolver for tests
 *
 * Automatically resolves test parameters with priority:
 * 1. Test case specific params (testCase.params.*)
 * 2. Global environment defaults (environment.default_*)
 * 3. Environment variables (process.env.SAP_*)
 *
 * Usage:
 *   const resolver = new TestConfigResolver(testCase);
 *   const packageName = resolver.getPackageName();
 *   const transportRequest = resolver.getTransportRequest();
 *   const className = resolver.getParam('class_name');
 */

import type { ILogger } from '@mcp-abap-adt/interfaces';

const {
  getTestCaseDefinition,
  getEnvironmentConfig,
  resolvePackageName,
  resolveTransportRequest,
  resolveStandardObject,
} = require('./test-helper');

export interface ITestConfigResolverOptions {
  testCase?: any;
  handlerName?: string;
  testCaseName?: string;
  isCloud?: boolean;
  logger?: ILogger;
}

export class TestConfigResolver {
  private testCase: any;
  private envConfig: any;
  private isCloud: boolean;
  private logger?: ILogger;

  constructor(options: ITestConfigResolverOptions = {}) {
    // Resolve test case
    if (options.testCase) {
      this.testCase = options.testCase;
    } else if (options.handlerName && options.testCaseName) {
      this.testCase = getTestCaseDefinition(
        options.handlerName,
        options.testCaseName,
      );
    } else if (options.handlerName) {
      // Try to get first enabled test case
      const { getEnabledTestCase } = require('./test-helper');
      this.testCase = getEnabledTestCase(options.handlerName);
    }

    this.envConfig = getEnvironmentConfig();
    this.isCloud = options.isCloud ?? false;
    this.logger = options.logger;
  }

  /**
   * Get test case definition
   */
  getTestCase(): any {
    return this.testCase;
  }

  /**
   * Get raw params from test case
   */
  getParams(): any {
    return this.testCase?.params || {};
  }

  /**
   * Get a specific parameter with fallback to global defaults
   * @param paramName - Parameter name (e.g., 'class_name', 'package_name')
   * @param defaultValue - Optional default value if not found
   * @returns Parameter value or defaultValue
   */
  getParam(paramName: string, defaultValue?: any): any {
    const params = this.getParams();

    // First try test case params
    if (params[paramName] !== undefined && params[paramName] !== null) {
      return params[paramName];
    }

    // Try environment-specific param (e.g., package_name_cloud, package_name_onprem)
    const envSuffix = this.isCloud ? '_cloud' : '_onprem';
    const envParamName = `${paramName}${envSuffix}`;
    if (params[envParamName] !== undefined && params[envParamName] !== null) {
      return params[envParamName];
    }

    // Try global environment config
    const globalKey = `default_${paramName}`;
    if (
      this.envConfig[globalKey] !== undefined &&
      this.envConfig[globalKey] !== null
    ) {
      return this.envConfig[globalKey];
    }

    // Try environment variable
    const envVarName = `SAP_${paramName.toUpperCase()}`;
    if (
      process.env[envVarName] !== undefined &&
      process.env[envVarName] !== null
    ) {
      return process.env[envVarName];
    }

    return defaultValue;
  }

  /**
   * Get package name (resolved with priority: testCase.params.package_name > global default)
   */
  getPackageName(): string {
    const params = this.getParams();
    return resolvePackageName(params.package_name);
  }

  /**
   * Get transport request (resolved with priority: testCase.params.transport_request > global default)
   */
  getTransportRequest(): string {
    const params = this.getParams();
    return resolveTransportRequest(params.transport_request);
  }

  /**
   * Get standard object from registry
   * @param objectType - Type of object ('class', 'domain', 'table', etc.)
   * @returns Object with name (and optional group for function modules) or null
   */
  getStandardObject(
    objectType: string,
  ): { name: string; group?: string } | null {
    return resolveStandardObject(objectType, this.isCloud, this.testCase);
  }

  /**
   * Get object name with fallback to standard object
   * @param paramName - Parameter name for object name (e.g., 'class_name', 'domain_name')
   * @param standardObjectType - Type for standard_objects registry lookup (e.g., 'class', 'domain')
   * @returns Object name or null
   */
  getObjectName(paramName: string, standardObjectType?: string): string | null {
    const params = this.getParams();

    // First try test case param
    if (params[paramName]) {
      return params[paramName];
    }

    // Try standard object if type provided
    if (standardObjectType) {
      const standardObject = this.getStandardObject(standardObjectType);
      if (standardObject?.name) {
        return standardObject.name;
      }
    }

    return null;
  }

  /**
   * Check if test case is enabled
   */
  isEnabled(): boolean {
    return this.testCase?.enabled === true;
  }

  /**
   * Check if test case is available for current environment (cloud/on-premise)
   * @returns true if test is available for current environment, false otherwise
   */
  isAvailableForEnvironment(): boolean {
    if (!this.testCase) {
      return false;
    }

    // If available_in is not specified, test is available for all environments
    const availableIn = this.testCase.available_in;
    if (
      !availableIn ||
      !Array.isArray(availableIn) ||
      availableIn.length === 0
    ) {
      return true;
    }

    // Check if current environment is in the list
    const currentEnv = this.isCloud ? 'cloud' : 'onprem';
    return availableIn.includes(currentEnv);
  }

  /**
   * Get test case name
   */
  getTestCaseName(): string | null {
    return this.testCase?.name || null;
  }

  /**
   * Get test case description
   */
  getDescription(): string | null {
    return this.testCase?.description || null;
  }

  /**
   * Create a new resolver for a different test case
   * Useful for getting params from another test case (e.g., read_transport test getting params from create_class)
   */
  createForTestCase(
    handlerName: string,
    testCaseName?: string,
  ): TestConfigResolver {
    return new TestConfigResolver({
      handlerName,
      testCaseName,
      isCloud: this.isCloud,
      logger: this.logger,
    });
  }

  /**
   * Try to get test case from multiple handlers (fallback chain)
   * @param handlers - Array of {handlerName, testCaseName} pairs to try
   * @returns New resolver with first found test case, or null if none found
   */
  tryMultipleHandlers(
    handlers: Array<{ handlerName: string; testCaseName?: string }>,
  ): TestConfigResolver | null {
    for (const handler of handlers) {
      const resolver = this.createForTestCase(
        handler.handlerName,
        handler.testCaseName,
      );
      if (resolver.getTestCase()) {
        return resolver;
      }
    }
    return null;
  }
}
