/**
 * ClassUnitTestBuilder - Builder for class unit tests (test includes)
 * 
 * Handles test include operations: lock, update, unlock, activate
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { IAdtLogger } from '../../utils/logger';
import { ClassBuilderConfig } from '../class/types';
import {
  lockClassTestClasses,
  updateClassTestInclude,
  unlockClassTestClasses,
  activateClassTestClasses
} from './classTest';
import { BaseUnitTestBuilder } from './BaseUnitTestBuilder';
import { ClassUnitTestDefinition, ClassUnitTestRunOptions } from './types';

export interface ClassUnitTestBuilderConfig {
  className: string;
  packageName?: string;
  transportRequest?: string;
  testClassName?: string;
  testClassSource?: string;
}

/**
 * Builder for class unit tests (test includes)
 * 
 * @example
 * ```typescript
 * const builder = new ClassUnitTestBuilder(connection, logger, {
 *   className: 'ZCL_TEST',
 *   testClassName: 'LTC_ZCL_TEST'
 * });
 * 
 * await builder
 *   .lockTestClasses()
 *   .then(b => b.updateTestClass('CLASS ltc_zcl_test...'))
 *   .then(b => b.unlockTestClasses())
 *   .then(b => b.activateTestClasses())
 *   .then(b => b.runForClass([{ containerClass: 'ZCL_TEST', testClass: 'LTC_ZCL_TEST' }]))
 *   .then(b => b.getStatus())
 *   .then(b => b.getResult());
 * ```
 */
export class ClassUnitTestBuilder extends BaseUnitTestBuilder {
  protected config: ClassUnitTestBuilderConfig;
  private testClassSource?: string;
  // testLockHandle is inherited from ClassBuilder (protected)

  constructor(
    connection: IAbapConnection,
    logger: IAdtLogger,
    config: ClassUnitTestBuilderConfig
  ) {
    // Create ClassBuilderConfig for base class
    const classConfig: ClassBuilderConfig = {
      className: config.className,
      description: '',
      packageName: config.packageName,
      transportRequest: config.transportRequest,
      testClassCode: config.testClassSource
    };
    super(connection, logger, classConfig);
    
    this.config = config;
    this.testClassSource = config.testClassSource;
  }

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

  async lockTestClasses(): Promise<this> {
    try {
      this.logger.info?.('Locking test classes for:', this.config.className);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.config.className);
      this.testLockHandle = lockHandle;

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
    // Use base class update() method which works with test class
    const code = sourceCode || this.testClassSource;
    if (code) {
      this.setTestClassCode(code);
    }
    return await this.update(code);
  }

  async unlockTestClasses(): Promise<this> {
    if (!this.testLockHandle) {
      throw new Error('Test classes must be locked before unlock');
    }
    try {
      this.logger.info?.('Unlocking test classes for:', this.config.className);
      await unlockClassTestClasses(
        this.connection,
        this.config.className,
        this.testLockHandle!
      );
      this.testLockHandle = undefined;
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
    if (!this.config.testClassName) {
      throw new Error('testClassName is required for activation');
    }
    try {
      this.logger.info?.('Activating test classes for:', this.config.className);
      await activateClassTestClasses(
        this.connection,
        this.config.className,
        this.config.testClassName
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
    try {
      this.logger.info?.('Clearing test classes for:', this.config.className);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.config.className);
      this.testLockHandle = lockHandle;

      const emptyTestSource = '';
      await updateClassTestInclude(
        this.connection,
        this.config.className,
        emptyTestSource,
        lockHandle,
        this.config.transportRequest
      );

      await unlockClassTestClasses(this.connection, this.config.className, lockHandle);
      this.testLockHandle = undefined;

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

  async runForClass(
    tests: ClassUnitTestDefinition[],
    options?: ClassUnitTestRunOptions
  ): Promise<this> {
    return super.runForClass(tests, options);
  }

  async forceUnlock(): Promise<void> {
    if (this.testLockHandle) {
      try {
        await unlockClassTestClasses(this.connection, this.config.className, this.testLockHandle);
        this.testLockHandle = undefined;
        this.connection.setSessionType("stateless");
        this.logger.info?.('Force unlock successful');
      } catch (error: any) {
        this.logger.warn?.('Force unlock failed:', error);
      }
    }
    // Call parent forceUnlock() (from ClassBuilder)
    await super.forceUnlock();
  }

  getTestLockHandle(): string | undefined {
    return this.testLockHandle;
  }
}

