/**
 * UnitTestBuilder - Fluent API for ABAP Unit test operations
 *
 * Supports different object types:
 * - class: Regular class unit tests (test include) - uses test include operations
 * - cds: CDS view unit tests (full class) - extends ClassBuilder for full class lifecycle
 *
 * @example
 * ```typescript
 * // For regular class unit tests (test include)
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
 * // For CDS unit tests (full class - extends ClassBuilder)
 * const cdsTest = new UnitTestBuilder(connection, logger, {
 *   objectType: 'cds',
 *   objectName: 'ZCL_CDS_TEST',
 *   packageName: 'ZOK_TEST_PKG_01',
 *   testClassSource: 'CLASS zcl_cds_test...'
 * });
 *
 * await cdsTest
 *   .create()  // from ClassBuilder
 *   .then(b => b.lock())  // from ClassBuilder
 *   .then(b => b.update())  // from ClassBuilder
 *   .then(b => b.unlock())  // from ClassBuilder
 *   .then(b => b.activate())  // from ClassBuilder
 *   .then(b => b.runForObject())
 *   .then(b => b.getStatus())
 *   .then(b => b.getResult());
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { IAdtLogger } from '../../utils/logger';
import { ClassBuilder } from '../class/ClassBuilder';
import { ClassBuilderConfig } from '../class/types';
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

/**
 * UnitTestBuilder - extends ClassBuilder for CDS unit test classes, standalone for class test includes
 * 
 * For objectType='cds': extends ClassBuilder (full class lifecycle)
 * For objectType='class': standalone builder (test include operations only)
 */
export class UnitTestBuilder extends ClassBuilder {
  private unitTestConfig: UnitTestBuilderConfig;
  private testClassSource?: string;
  private unitTestState: UnitTestBuilderState;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: UnitTestBuilderConfig
  ) {
    if (config.objectType === 'cds') {
      // For CDS: extend ClassBuilder
      const classConfig: ClassBuilderConfig = {
        className: config.objectName,
        description: config.testClassSource ? '' : `Unit Test for ${config.objectName}`,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        sourceCode: config.testClassSource
      };
      super(connection, logger, classConfig);
      this.unitTestConfig = config;
      this.unitTestState = {
        errors: []
      };
    } else {
      // For class: standalone (but we still need to call super)
      // Create minimal ClassBuilder config
      const classConfig: ClassBuilderConfig = {
        className: config.objectName,
        description: '',
        packageName: config.packageName,
        transportRequest: config.transportRequest
      };
      super(connection, logger, classConfig);
      this.unitTestConfig = config;
      this.testClassSource = config.testClassSource;
      this.unitTestState = {
        errors: [],
        testLockHandle: undefined
      };
    }
  }

  // Configuration methods
  setTestClassName(testClassName: string): this {
    this.unitTestConfig.testClassName = testClassName;
    this.logger.debug?.('Test class name set:', testClassName);
    return this;
  }

  setTestClassSource(sourceCode: string): this {
    this.testClassSource = sourceCode;
    this.logger.debug?.('Test class source set, length:', sourceCode.length);
    return this;
  }

  // Class unit test methods (test include operations) - only for objectType='class'
  async lockTestClasses(): Promise<this> {
    if (this.unitTestConfig.objectType !== 'class') {
      throw new Error('lockTestClasses is only available for class object type');
    }
    try {
      this.logger.info?.('Locking test classes for:', this.unitTestConfig.objectName);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.unitTestConfig.objectName);
      this.unitTestState.testLockHandle = lockHandle;

      this.logger.info?.('Test classes locked successfully');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'lockTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Lock test classes failed:', error);
      throw error;
    }
  }

  async updateTestClass(sourceCode?: string): Promise<this> {
    if (this.unitTestConfig.objectType !== 'class') {
      throw new Error('updateTestClass is only available for class object type');
    }
    if (!this.unitTestState.testLockHandle) {
      throw new Error('Test classes must be locked before update');
    }
    try {
      const code = sourceCode || this.testClassSource;
      if (!code) {
        throw new Error('Test class source code is required');
      }

      this.logger.info?.('Updating test class for:', this.unitTestConfig.objectName);
      const result = await updateClassTestInclude(
        this.connection,
        this.unitTestConfig.objectName,
        code,
        this.unitTestState.testLockHandle!,
        this.unitTestConfig.transportRequest
      );
      this.unitTestState.errors = []; // Clear errors on success
      this.logger.info?.('Test class updated successfully');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'updateTestClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update test class failed:', error);
      throw error;
    }
  }

  async unlockTestClasses(): Promise<this> {
    if (this.unitTestConfig.objectType !== 'class') {
      throw new Error('unlockTestClasses is only available for class object type');
    }
    if (!this.unitTestState.testLockHandle) {
      throw new Error('Test classes must be locked before unlock');
    }
    try {
      this.logger.info?.('Unlocking test classes for:', this.unitTestConfig.objectName);
      await unlockClassTestClasses(
        this.connection,
        this.unitTestConfig.objectName,
        this.unitTestState.testLockHandle!
      );
      this.unitTestState.testLockHandle = undefined;

      this.connection.setSessionType("stateless");
      this.logger.info?.('Test classes unlocked successfully');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'unlockTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Unlock test classes failed:', error);
      throw error;
    }
  }

  async activateTestClasses(): Promise<this> {
    if (this.unitTestConfig.objectType !== 'class') {
      throw new Error('activateTestClasses is only available for class object type');
    }
    if (!this.unitTestConfig.testClassName) {
      throw new Error('testClassName is required for activation');
    }
    try {
      this.logger.info?.('Activating test classes for:', this.unitTestConfig.objectName);
      await activateClassTestClasses(
        this.connection,
        this.unitTestConfig.objectName,
        this.unitTestConfig.testClassName
      );
      this.logger.info?.('Test classes activated successfully');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'activateTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Activate test classes failed:', error);
      throw error;
    }
  }

  async clearTestClasses(): Promise<this> {
    if (this.unitTestConfig.objectType !== 'class') {
      throw new Error('clearTestClasses is only available for class object type');
    }
    try {
      this.logger.info?.('Clearing test classes for:', this.unitTestConfig.objectName);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.unitTestConfig.objectName);
      this.unitTestState.testLockHandle = lockHandle;

      const emptyTestSource = '';
      await updateClassTestInclude(
        this.connection,
        this.unitTestConfig.objectName,
        emptyTestSource,
        lockHandle,
        this.unitTestConfig.transportRequest
      );

      await unlockClassTestClasses(this.connection, this.unitTestConfig.objectName, lockHandle);
      this.unitTestState.testLockHandle = undefined;

      this.connection.setSessionType("stateless");
      this.logger.info?.('Test classes cleared successfully');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
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
    if (this.unitTestConfig.objectType !== 'class') {
      throw new Error('runForClass is only available for class object type');
    }
    try {
      this.logger.info?.('Starting ABAP Unit run for class:', this.unitTestConfig.objectName);
      const response = await startClassUnitTestRun(this.connection, tests, options);
      
      const runId = response.headers?.['location']?.split('/').pop() ||
                    response.headers?.['content-location']?.split('/').pop() ||
                    response.headers?.['sap-adt-location']?.split('/').pop();
      
      if (!runId) {
        throw new Error('Failed to extract run ID from response');
      }

      this.unitTestState.runId = runId;
      this.logger.info?.('ABAP Unit run started:', runId);
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'runForClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Run ABAP Unit failed:', error);
      throw error;
    }
  }

  async runForObject(options?: ClassUnitTestRunOptions): Promise<this> {
    if (this.unitTestConfig.objectType !== 'cds') {
      throw new Error('runForObject is only available for cds object type');
    }
    try {
      this.logger.info?.('Starting ABAP Unit run for object:', this.unitTestConfig.objectName);
      const response = await startClassUnitTestRunByObject(this.connection, this.unitTestConfig.objectName, options);
      
      const runId = response.headers?.['location']?.split('/').pop() ||
                    response.headers?.['content-location']?.split('/').pop() ||
                    response.headers?.['sap-adt-location']?.split('/').pop();
      
      if (!runId) {
        throw new Error('Failed to extract run ID from response');
      }

      this.unitTestState.runId = runId;
      this.logger.info?.('ABAP Unit run started:', runId);
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'runForObject',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Run ABAP Unit failed:', error);
      throw error;
    }
  }

  async getStatus(withLongPolling: boolean = true): Promise<this> {
    if (!this.unitTestState.runId) {
      throw new Error('Run ID is required. Call runForClass or runForObject first.');
    }
    try {
      this.logger.info?.('Getting ABAP Unit status for run:', this.unitTestState.runId);
      const response = await getClassUnitTestStatus(this.connection, this.unitTestState.runId, withLongPolling);
      this.unitTestState.runStatus = response.data;
      this.logger.info?.('ABAP Unit status retrieved');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'getStatus',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Get status failed:', error);
      throw error;
    }
  }

  async getResult(options?: { withNavigationUris?: boolean; format?: 'abapunit' | 'junit' }): Promise<this> {
    if (!this.unitTestState.runId) {
      throw new Error('Run ID is required. Call runForClass or runForObject first.');
    }
    try {
      this.logger.info?.('Getting ABAP Unit result for run:', this.unitTestState.runId);
      const response = await getClassUnitTestResult(this.connection, this.unitTestState.runId, options);
      this.unitTestState.runResult = response.data;
      this.logger.debug?.('ABAP Unit result data type:', typeof response.data);
      this.logger.debug?.('ABAP Unit result preview:', String(response.data).substring(0, 500));
      this.logger.info?.('ABAP Unit result retrieved');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
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
    if (this.unitTestConfig.objectType !== 'cds') {
      throw new Error('deleteTestClass is only available for cds object type');
    }
    try {
      this.logger.info?.('Deleting test class:', this.unitTestConfig.objectName);
      // Use delete() from ClassBuilder
      await super.delete();
      this.logger.info?.('Test class deleted successfully');
      return this;
    } catch (error: any) {
      this.unitTestState.errors.push({
        method: 'deleteTestClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Delete test class failed:', error);
      throw error;
    }
  }

  async forceUnlock(): Promise<void> {
    if (this.unitTestState.testLockHandle && this.unitTestConfig.objectType === 'class') {
      try {
        await unlockClassTestClasses(this.connection, this.unitTestConfig.objectName, this.unitTestState.testLockHandle);
        this.unitTestState.testLockHandle = undefined;
        this.connection.setSessionType("stateless");
        this.logger.info?.('Force unlock successful');
      } catch (error: any) {
        this.logger.warn?.('Force unlock failed:', error);
      }
    }
    // Also call parent forceUnlock for class lock
    await super.forceUnlock();
  }

  // Getters
  getUnitTestState(): Readonly<UnitTestBuilderState> {
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

  getTestLockHandle(): string | undefined {
    return this.unitTestState.testLockHandle;
  }
}
