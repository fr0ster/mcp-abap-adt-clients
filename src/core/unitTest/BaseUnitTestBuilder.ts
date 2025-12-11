/**
 * BaseUnitTestBuilder - Base class for unit test operations
 * 
 * Extends ClassBuilder and overrides read() and update() to work with test class (local class)
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { ClassBuilder } from '../class/ClassBuilder';
import { IClassBuilderConfig } from '../class';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { updateClassTestInclude } from '../class/testclasses';
import {
  startClassUnitTestRun,
  startClassUnitTestRunByObject,
  getClassUnitTestStatus,
  getClassUnitTestResult
} from './run';
import { IUnitTestState, ClassUnitTestDefinition, ClassUnitTestRunOptions } from './types';

/**
 * Base class for unit test builders
 * Extends ClassBuilder and overrides read() and update() to work with test class (local class)
 * 
 * Internal class - exported for use by ClassUnitTestBuilder and CdsUnitTestBuilder,
 * but not exported from index.ts (not part of public API)
 */
export abstract class BaseUnitTestBuilder extends ClassBuilder {
  protected unitTestState: IUnitTestState;

  constructor(
    connection: IAbapConnection,
    config: IClassBuilderConfig,
    logger?: ILogger
  ) {
    super(connection, config, logger);
    this.unitTestState = {
      errors: []
    };
  }

  /**
   * Override read() to read test class (local class) source
   */
  async read(version: 'active' | 'inactive' = 'active'): Promise<IClassBuilderConfig | undefined> {
    try {
      this.logger?.info(`'Reading test class source:'  this.config.className  'version:' ${`version`}`);
      const encodedName = encodeSapObjectName(this.config.className).toLowerCase();
      const versionParam = version === 'inactive' ? '?version=inactive' : '';
      const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses${versionParam}`;

      const result = await this.connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
          'Accept': 'text/plain'
        }
      });

      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger?.info(`'Test class source read successfully:'  result.status  'bytes:' ${`result.data?.length || 0`}`);

      // Parse and return config directly
      const sourceCode = typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data);

      return {
        className: this.config.className,
        sourceCode
      };
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Read test class failed:', {
        className: this.config.className,
        version,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  /**
   * Override update() to update test class (local class) source
   * Uses updateTestClass() from ClassBuilder which uses global class lock handle
   */
  async update(sourceCode?: string, options?: { implementations?: string; testClasses?: string }): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before update. Call lock() first.');
      }

      // For unit test builder, we always update test class source
      const testClassSource = sourceCode || this.config.testClassCode;
      if (!testClassSource) {
        throw new Error('Test class source code is required. Use setTestClassCode() or pass as parameter.');
      }

      // Use updateTestClass() from ClassBuilder (uses global class lock handle)
      return await super.updateTestClass(testClassSource);
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update test class failed:', error);
      throw error;
    }
  }

  /**
   * Override check() to validate test class code instead of main class
   * 
   * For unit test builders, check() validates the test class source code,
   * not the main class. This is because unit test builders work with test classes.
   * 
   * @param version - Version to check ('active' or 'inactive')
   * @param sourceCode - Optional test class source code to check
   * @returns Promise with check result
   */
  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<any> {
    try {
      const code = sourceCode || this.config.testClassCode;
      if (!code) {
        throw new Error('Test class source code is required. Use setTestClassCode() or pass as parameter.');
      }

      this.logger?.info('Checking test class code:', this.config.className);
      
      // Use checkTestClass() from ClassBuilder
      await super.checkTestClass(code);
      
      this.logger?.info('Test class check passed');
      
      // Return this for compatibility with builder pattern
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'check',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Check failed:', error);
      throw error;
    }
  }

  /**
   * Start unit test run for class (test includes)
   */
  async runForClass(
    tests: ClassUnitTestDefinition[],
    options?: ClassUnitTestRunOptions
  ): Promise<this> {
    try {
      this.logger?.info('Starting class unit test run');
      const response = await startClassUnitTestRun(this.connection, tests, options);
      
      // Extract run ID from response headers
      const runId = response.headers?.['location']?.split('/').pop() ||
                    response.headers?.['content-location']?.split('/').pop() ||
                    response.headers?.['sap-adt-location']?.split('/').pop();
      
      if (!runId) {
        throw new Error('Failed to extract run ID from response');
      }
      
      this.unitTestState.runId = runId;
      this.logger?.info(`'Unit test run started  runId:' ${`runId`}`);
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'runForClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Run for class failed:', error);
      throw error;
    }
  }

  /**
   * Start unit test run by object (for CDS unit tests)
   */
  async runForObject(
    className: string,
    options?: ClassUnitTestRunOptions
  ): Promise<this> {
    try {
      this.logger?.info('Starting unit test run for object:', className);
      const response = await startClassUnitTestRunByObject(this.connection, className, options);
      
      // Extract run ID from response headers
      const runId = response.headers?.['location']?.split('/').pop() ||
                    response.headers?.['content-location']?.split('/').pop() ||
                    response.headers?.['sap-adt-location']?.split('/').pop();
      
      if (!runId) {
        throw new Error('Failed to extract run ID from response');
      }
      
      this.unitTestState.runId = runId;
      this.logger?.info(`'Unit test run started  runId:' ${`runId`}`);
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'runForObject',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Run for object failed:', error);
      throw error;
    }
  }

  /**
   * Get unit test run status
   */
  async getStatus(withLongPolling: boolean = true): Promise<this> {
    if (!this.unitTestState.runId) {
      throw new Error('Run ID is required. Call runForClass() or runForObject() first.');
    }
    try {
      this.logger?.info(`'Getting unit test status  runId:' ${`this.unitTestState.runId`}`);
      const response = await getClassUnitTestStatus(this.connection, this.unitTestState.runId, withLongPolling);
      this.unitTestState.runStatus = response.data;
      this.logger?.info('Unit test status retrieved');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'getStatus',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Get status failed:', error);
      throw error;
    }
  }

  /**
   * Get unit test run result
   */
  async getResult(options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' }): Promise<this> {
    if (!this.unitTestState.runId) {
      throw new Error('Run ID is required. Call runForClass() or runForObject() first.');
    }
    try {
      this.logger?.info(`'Getting unit test result  runId:' ${`this.unitTestState.runId`}`);
      const response = await getClassUnitTestResult(this.connection, this.unitTestState.runId, options);
      this.unitTestState.runResult = response.data;
      this.logger?.info('Unit test result retrieved');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'getResult',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Get result failed:', error);
      throw error;
    }
  }

  // Getters
  getUnitTestState(): Readonly<IUnitTestState> {
    return { ...this.unitTestState };
  }

  getRunId(): string | undefined {
    return this.unitTestState.runId;
  }

  getRunStatus(): any {
    return this.unitTestState.runStatus;
  }

  getRunResult(): any {
    return this.unitTestState.runResult;
  }
}

