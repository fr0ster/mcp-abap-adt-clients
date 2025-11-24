/**
 * UnitTestBuilder - Fluent API for ABAP Unit test operations
 *
 * Supports different object types:
 * - class: Regular class unit tests (test include)
 * - cds: CDS view unit tests (full class deletion)
 *
 * @example
 * ```typescript
 * // For regular class unit tests
 * const unitTest = new UnitTestBuilder(connection, logger, {
 *   objectType: 'class',
 *   objectName: 'ZCL_TEST',
 *   testClassName: 'LTC_ZCL_TEST'
 * });
 *
 * await unitTest
 *   .lockTestClasses()
 *   .then(b => b.updateTestClass('CLASS ltc_zcl_test...'))
 *   .then(b => b.unlockTestClasses())
 *   .then(b => b.activateTestClasses())
 *   .then(b => b.runForClass())
 *   .then(b => b.clearTestClasses());
 *
 * // For CDS unit tests
 * const cdsTest = new UnitTestBuilder(connection, logger, {
 *   objectType: 'cds',
 *   objectName: 'ZCL_CDS_TEST',
 *   packageName: 'ZOK_TEST_PKG_01'
 * });
 *
 * await cdsTest
 *   .runForObject()
 *   .then(b => b.getStatus())
 *   .then(b => b.getResult());
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { IAdtLogger } from '../../utils/logger';
import {
  lockClassTestClasses,
  updateClassTestInclude,
  unlockClassTestClasses,
  activateClassTestClasses
} from './classTest';
import {
  startClassUnitTestRun,
  startClassUnitTestRunByObject,
  getClassUnitTestStatus,
  getClassUnitTestResult
} from './run';
import { UnitTestBuilderConfig, UnitTestBuilderState, ClassUnitTestDefinition, ClassUnitTestRunOptions } from './types';
import { deleteClass } from '../class/delete';

export class UnitTestBuilder {
  private connection: AbapConnection;
  private logger: IAdtLogger;
  private config: UnitTestBuilderConfig;
  private testClassSource?: string;
  private testLockHandle?: string;
  private state: UnitTestBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: UnitTestBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Configuration methods
  setTestClassName(testClassName: string): this {
    this.config.testClassName = testClassName;
    this.logger.debug?.('Test class name set:', testClassName);
    return this;
  }

  setTestClassSource(sourceCode: string): this {
    this.testClassSource = sourceCode;
    this.logger.debug?.('Test class source set, length:', sourceCode.length);
    return this;
  }

  // Class unit test methods (test include operations)
  async lockTestClasses(): Promise<this> {
    if (this.config.objectType !== 'class') {
      throw new Error('lockTestClasses is only available for class object type');
    }
    try {
      this.logger.info?.('Locking test classes for:', this.config.objectName);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.config.objectName);
      this.testLockHandle = lockHandle;
      this.state.testLockHandle = lockHandle;

      this.logger.info?.('Test classes locked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lockTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock test classes failed:', error);
      throw error;
    }
  }

  async updateTestClass(sourceCode?: string): Promise<this> {
    if (this.config.objectType !== 'class') {
      throw new Error('updateTestClass is only available for class object type');
    }
    if (!this.testLockHandle) {
      throw new Error('Test classes must be locked before update');
    }
    try {
      const code = sourceCode || this.testClassSource;
      if (!code) {
        throw new Error('Test class source code is required');
      }

      this.logger.info?.('Updating test class for:', this.config.objectName);
      const result = await updateClassTestInclude(
        this.connection,
        this.config.objectName,
        code,
        this.testLockHandle,
        this.config.transportRequest
      );
      this.state.errors = []; // Clear errors on success
      this.logger.info?.('Test class updated successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateTestClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update test class failed:', error);
      throw error;
    }
  }

  async unlockTestClasses(): Promise<this> {
    if (this.config.objectType !== 'class') {
      throw new Error('unlockTestClasses is only available for class object type');
    }
    if (!this.testLockHandle) {
      throw new Error('Test classes must be locked before unlock');
    }
    try {
      this.logger.info?.('Unlocking test classes for:', this.config.objectName);
      await unlockClassTestClasses(
        this.connection,
        this.config.objectName,
        this.testLockHandle
      );
      this.testLockHandle = undefined;
      this.state.testLockHandle = undefined;

      this.connection.setSessionType("stateless");
      this.logger.info?.('Test classes unlocked successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlockTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock test classes failed:', error);
      throw error;
    }
  }

  async activateTestClasses(): Promise<this> {
    if (this.config.objectType !== 'class') {
      throw new Error('activateTestClasses is only available for class object type');
    }
    if (!this.config.testClassName) {
      throw new Error('testClassName is required for activation');
    }
    try {
      this.logger.info?.('Activating test classes for:', this.config.objectName);
      await activateClassTestClasses(
        this.connection,
        this.config.objectName,
        this.config.testClassName
      );
      this.logger.info?.('Test classes activated successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activateTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activate test classes failed:', error);
      throw error;
    }
  }

  async clearTestClasses(): Promise<this> {
    if (this.config.objectType !== 'class') {
      throw new Error('clearTestClasses is only available for class object type');
    }
    try {
      this.logger.info?.('Clearing test classes for:', this.config.objectName);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.config.objectName);
      this.testLockHandle = lockHandle;
      this.state.testLockHandle = lockHandle;

      const emptyTestSource = '';
      await updateClassTestInclude(
        this.connection,
        this.config.objectName,
        emptyTestSource,
        lockHandle,
        this.config.transportRequest
      );

      await unlockClassTestClasses(this.connection, this.config.objectName, lockHandle);
      this.testLockHandle = undefined;
      this.state.testLockHandle = undefined;

      this.connection.setSessionType("stateless");
      this.logger.info?.('Test classes cleared successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'clearTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Clear test classes failed:', error);
      throw error;
    }
  }

  // Run methods
  async runForClass(tests: ClassUnitTestDefinition[], options?: ClassUnitTestRunOptions): Promise<this> {
    if (this.config.objectType !== 'class') {
      throw new Error('runForClass is only available for class object type');
    }
    try {
      this.logger.info?.('Starting ABAP Unit run for class:', this.config.objectName);
      const response = await startClassUnitTestRun(this.connection, tests, options);
      
      const runId = response.headers?.['location']?.split('/').pop() ||
                    response.headers?.['content-location']?.split('/').pop() ||
                    response.headers?.['sap-adt-location']?.split('/').pop();
      
      if (!runId) {
        throw new Error('Failed to extract run ID from response');
      }

      this.state.runId = runId;
      this.logger.info?.('ABAP Unit run started:', runId);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'runForClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Run ABAP Unit failed:', error);
      throw error;
    }
  }

  async runForObject(options?: ClassUnitTestRunOptions): Promise<this> {
    if (this.config.objectType !== 'cds') {
      throw new Error('runForObject is only available for cds object type');
    }
    try {
      this.logger.info?.('Starting ABAP Unit run for object:', this.config.objectName);
      const response = await startClassUnitTestRunByObject(this.connection, this.config.objectName, options);
      
      const runId = response.headers?.['location']?.split('/').pop() ||
                    response.headers?.['content-location']?.split('/').pop() ||
                    response.headers?.['sap-adt-location']?.split('/').pop();
      
      if (!runId) {
        throw new Error('Failed to extract run ID from response');
      }

      this.state.runId = runId;
      this.logger.info?.('ABAP Unit run started:', runId);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'runForObject',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Run ABAP Unit failed:', error);
      throw error;
    }
  }

  async getStatus(withLongPolling: boolean = true): Promise<this> {
    if (!this.state.runId) {
      throw new Error('Run ID is required. Call runForClass or runForObject first.');
    }
    try {
      this.logger.info?.('Getting ABAP Unit status for run:', this.state.runId);
      const response = await getClassUnitTestStatus(this.connection, this.state.runId, withLongPolling);
      this.state.runStatus = response.data;
      this.logger.info?.('ABAP Unit status retrieved');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'getStatus',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Get status failed:', error);
      throw error;
    }
  }

  async getResult(options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' }): Promise<this> {
    if (!this.state.runId) {
      throw new Error('Run ID is required. Call runForClass or runForObject first.');
    }
    try {
      this.logger.info?.('Getting ABAP Unit result for run:', this.state.runId);
      const response = await getClassUnitTestResult(this.connection, this.state.runId, options);
      this.state.runResult = response.data;
      this.logger.debug?.('ABAP Unit result data type:', typeof response.data);
      this.logger.debug?.('ABAP Unit result preview:', String(response.data).substring(0, 500));
      this.logger.info?.('ABAP Unit result retrieved');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'getResult',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Get result failed:', error);
      throw error;
    }
  }

  // Cleanup methods
  async deleteTestClass(): Promise<this> {
    if (this.config.objectType !== 'cds') {
      throw new Error('deleteTestClass is only available for cds object type');
    }
    try {
      this.logger.info?.('Deleting test class:', this.config.objectName);
      await deleteClass(this.connection, {
        class_name: this.config.objectName,
        transport_request: this.config.transportRequest
      });
      this.logger.info?.('Test class deleted successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'deleteTestClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete test class failed:', error);
      throw error;
    }
  }

  async forceUnlock(): Promise<void> {
    if (this.testLockHandle && this.config.objectType === 'class') {
      try {
        await unlockClassTestClasses(this.connection, this.config.objectName, this.testLockHandle);
        this.testLockHandle = undefined;
        this.state.testLockHandle = undefined;
        this.connection.setSessionType("stateless");
        this.logger.info?.('Force unlock successful');
      } catch (error: any) {
        this.logger.warn?.('Force unlock failed:', error);
      }
    }
  }

  // Getters
  getState(): Readonly<UnitTestBuilderState> {
    return { ...this.state };
  }

  getRunId(): string | undefined {
    return this.state.runId;
  }

  getRunStatus(): any {
    return this.state.runStatus;
  }

  getRunResult(): any {
    return this.state.runResult;
  }

  getTestLockHandle(): string | undefined {
    return this.state.testLockHandle;
  }
}

