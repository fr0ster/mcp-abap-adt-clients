/**
 * ClassBuilder - Fluent API for class operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.validate().then(b => b.create()).then(b => b.lock())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * @example
 * ```typescript
 * const builder = new ClassBuilder(connection, logger, {
 *   className: 'ZCL_TEST',
 *   packageName: 'ZOK_TEST_PKG_01'
 * })
 *   .setCode('CLASS ZCL_TEST DEFINITION...');
 *
 * await builder
 *   .validate()
 *   .then(b => b.create())
 *   .then(b => b.lock())
 *   .then(b => b.update())
 *   .then(b => b.check())
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *     // Handle error
 *   })
 *   .finally(() => {
 *     // Cleanup - always executes
 *   });
 * ```
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { validateClassName } from './validation';
import { create as createClassObject } from './create';
import { getClassSource, getClassMetadata, getClassTransport } from './read';
import { lockClass } from './lock';
import { updateClass } from './update';
import {
  updateClassTestInclude,
  lockClassTestClasses,
  unlockClassTestClasses
} from './testclasses';
import { checkClass } from './check';
import { unlockClass } from './unlock';
import { activateClass } from './activation';
import { deleteClass } from './delete';
import { IClassConfig, IClassState } from './types';

export class ClassBuilder {
  protected connection: IAbapConnection;
  protected logger?: ILogger;
  protected config: IClassConfig;
  protected sourceCode?: string;
  protected lockHandle?: string;
  protected testLockHandle?: string;
  protected state: IClassState;

  constructor(
    connection: IAbapConnection,
    config: IClassConfig,
    logger?: ILogger
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setPackage(packageName: string): this {
    this.config.packageName = packageName;
    this.logger?.debug('Package set:', packageName);
    return this;
  }

  setRequest(transportRequest: string): this {
    this.config.transportRequest = transportRequest;
    this.logger?.debug('Transport request set:', transportRequest);
    return this;
  }

  setName(className: string): this {
    this.config.className = className;
    this.logger?.debug('Class name set:', className);
    return this;
  }

  setCode(sourceCode: string): this {
    this.sourceCode = sourceCode;
    this.logger?.debug(`Source code set, length: ${sourceCode.length}`);
    return this;
  }

  setTestClassCode(sourceCode: string): this {
    this.config.testClassCode = sourceCode;
    this.logger?.debug(`Test class code set, length: ${sourceCode.length}`);
    return this;
  }

  setTestClassName(testClassName: string): this {
    this.config.testClassName = testClassName;
    this.logger?.debug('Test class name set:', testClassName);
    return this;
  }

  setLocalTypesCode(localTypesCode: string): this {
    this.config.localTypesCode = localTypesCode;
    this.logger?.debug(`Local types code set, length: ${localTypesCode.length}`);
    return this;
  }

  setDefinitionsCode(definitionsCode: string): this {
    this.config.definitionsCode = definitionsCode;
    this.logger?.debug(`'Definitions code set  length:' ${`definitionsCode.length`}`);
    return this;
  }

  setMacrosCode(macrosCode: string): this {
    this.config.macrosCode = macrosCode;
    this.logger?.debug(`Macros code set, length: ${macrosCode.length}`);
    return this;
  }

  setClassTemplate(templateXml: string): this {
    this.config.classTemplate = templateXml;
    this.logger?.debug(`Class template set, length: ${templateXml.length}`);
    return this;
  }

  setDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  setSuperclass(superclass: string): this {
    this.config.superclass = superclass;
    return this;
  }

  setFinal(final: boolean): this {
    this.config.final = final;
    return this;
  }

  setAbstract(abstract: boolean): this {
    this.config.abstract = abstract;
    return this;
  }

  setCreateProtected(createProtected: boolean): this {
    this.config.createProtected = createProtected;
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  // Chain is interrupted on error (standard Promise behavior)
  async validate(): Promise<AxiosResponse> {
    try {
      this.logger?.info('Validating class:', this.config.className);
      const result = await validateClassName(
        this.connection,
        this.config.className,
        this.config.packageName,
        this.config.description,
        this.config.superclass
      );
      // Store raw response for backward compatibility
      this.state.validationResponse = result;
      this.logger?.info('Validation successful');
      return result;
    } catch (error: any) {
      // For validation, HTTP 400 might indicate object exists or validation error - store response for analysis
      if (error.response && error.response.status === 400) {
        this.state.validationResponse = error.response;
        this.logger?.info('Class validation returned 400 - object may already exist or validation error');
        return error.response;
      }
      // Store error response if available
      if (error.response) {
        this.state.validationResponse = error.response;
      }
      
      this.state.errors.push({
        method: 'validate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Validation failed:', error);
      throw error;
    }
  }

  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      this.logger?.info('Creating class:', this.config.className);

      
      const result = await createClassObject(this.connection, {
        class_name: this.config.className,
        package_name: this.config.packageName,
        transport_request: this.config.transportRequest,
        description: this.config.description,
        superclass: this.config.superclass,
        final: this.config.final,
        abstract: this.config.abstract,
        create_protected: this.config.createProtected,
        master_system: this.config.masterSystem,
        responsible: this.config.responsible,
        template_xml: this.config.classTemplate
      });
      this.state.createResult = result;
      this.logger?.info('Class created successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      throw error; // Interrupts chain
    }
  }

  async read(
    version: 'active' | 'inactive' = 'active',
    options?: { withLongPolling?: boolean }
  ): Promise<IClassConfig | undefined> {
    try {
      this.logger?.info(`Reading class source: ${this.config.className}, version: ${version}`);
      const result = await getClassSource(
        this.connection,
        this.config.className,
        version,
        options?.withLongPolling !== undefined ? { withLongPolling: options.withLongPolling } : undefined
      );
      // Store raw response for backward compatibility
      this.state.readResult = result;
      this.logger?.info(`Class source read successfully: ${result.status}, bytes: ${result.data?.length || 0}`);
      
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
      this.logger?.error('Read failed:', {
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

  async readMetadata(): Promise<this> {
    try {
      this.logger?.info('Reading class metadata:', this.config.className);
      const result = await getClassMetadata(this.connection, this.config.className);
      this.state.metadataResult = result;
      this.logger?.info('Class metadata read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readMetadata',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Read metadata failed:', error);
      throw error; // Interrupts chain
    }
  }

  async readTransport(): Promise<this> {
    try {
      this.logger?.info('Reading transport request for class:', this.config.className);
      const result = await getClassTransport(this.connection, this.config.className);
      this.state.transportResult = result;
      this.logger?.info('Transport request read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'readTransport',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Read transport failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lock(): Promise<this> {
    try {
      this.logger?.info('Locking class:', this.config.className);
      
      // Enable stateful session mode
      this.connection.setSessionType("stateful");
      
      const lockHandle = await lockClass(
        this.connection,
        this.config.className
      );
      this.lockHandle = lockHandle;
      this.state.lockHandle = lockHandle;

      this.logger?.info(`'Class locked  handle:' ${`lockHandle`}`);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Lock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async lockTestClasses(): Promise<this> {
    try {
      this.logger?.info('Locking test classes for:', this.config.className);
      this.connection.setSessionType('stateful');
      const lockHandle = await lockClassTestClasses(this.connection, this.config.className);
      this.testLockHandle = lockHandle;
      this.state.testLockHandle = lockHandle;
      this.logger?.info(`Test classes locked, handle: ${lockHandle}`);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'lockTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Lock test classes failed:', error);
      throw error;
    }
  }

  /**
   * Check test class code
   * 
   * Validates ABAP Unit test class source code using SAP check run.
   * This is a separate validation from main class check because test classes
   * use a different URI (/includes/testclasses vs /source/main).
   * 
   * @param testClassSource - Optional test class source code. If not provided, uses stored testClassCode
   * @returns this for chaining
   * @throws Error if check finds errors (chkrun:type="E")
   */
  async checkTestClass(testClassSource?: string): Promise<this> {
    try {
      const code = testClassSource || this.config.testClassCode;
      if (!code) {
        throw new Error('Test class source code is required. Use setTestClassCode() or pass as parameter.');
      }
      
      this.logger?.info('Checking test class code:', this.config.className);
      const { checkClassLocalTestClass } = await import('./check');
      await checkClassLocalTestClass(this.connection, this.config.className, code, 'inactive');
      this.logger?.info('Test class code check passed');
      
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'checkTestClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Test class check failed:', error);
      throw error;
    }
  }

  async checkLocalTypes(localTypesSource?: string): Promise<this> {
    try {
      const code = localTypesSource || this.config.localTypesCode;
      if (!code) {
        throw new Error('Local types source code is required. Use setLocalTypesCode() or pass as parameter.');
      }
      
      this.logger?.info('Checking local types code:', this.config.className);
      const { checkClassLocalTypes } = await import('./check');
      await checkClassLocalTypes(this.connection, this.config.className, code, 'inactive');
      this.logger?.info('Local types code check passed');
      
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'checkLocalTypes',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Local types check failed:', error);
      throw error;
    }
  }

  async checkDefinitions(definitionsSource?: string): Promise<this> {
    try {
      const code = definitionsSource || this.config.definitionsCode;
      if (!code) {
        throw new Error('Definitions source code is required. Use setDefinitionsCode() or pass as parameter.');
      }
      
      this.logger?.info('Checking definitions code:', this.config.className);
      const { checkClassDefinitions } = await import('./check');
      await checkClassDefinitions(this.connection, this.config.className, code, 'inactive');
      this.logger?.info('Definitions code check passed');
      
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'checkDefinitions',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Definitions check failed:', error);
      throw error;
    }
  }

  async checkMacros(macrosSource?: string): Promise<this> {
    try {
      const code = macrosSource || this.config.macrosCode;
      if (!code) {
        throw new Error('Macros source code is required. Use setMacrosCode() or pass as parameter.');
      }
      
      this.logger?.info('Checking macros code:', this.config.className);
      const { checkClassMacros } = await import('./check');
      await checkClassMacros(this.connection, this.config.className, code, 'inactive');
      this.logger?.info('Macros code check passed');
      
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'checkMacros',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Macros check failed:', error);
      throw error;
    }
  }

  async update(sourceCode?: string, options?: { implementations?: string; testClasses?: string }): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before update. Call lock() first.');
      }

      // Update main source if provided
      if (sourceCode || this.sourceCode) {
        const code = sourceCode || this.sourceCode;
        if (!code) {
          throw new Error('Source code is required. Use setCode() or pass as parameter.');
        }
        this.logger?.info('Updating class main source:', this.config.className);
        const result = await updateClass(
          this.connection,
          this.config.className,
          code,
          this.lockHandle,
          this.config.transportRequest
        );
        this.state.updateResult = result;
        this.logger?.info('Class main source updated successfully:', result.status);
      }

      // Update implementations include if provided
      if (options?.implementations) {
        const { updateClassImplementations } = await import('./update');
        this.logger?.info('Updating class implementations include:', this.config.className);
        const result = await updateClassImplementations(
          this.connection,
          this.config.className,
          options.implementations,
          this.lockHandle,
          this.config.transportRequest
        );
        this.state.updateResult = result;
        this.logger?.info('Class implementations updated successfully:', result.status);
      }

      // Update test classes if provided (uses same lock handle as main source)
      if (options?.testClasses) {
        const { updateClassTestInclude } = await import('./testclasses');
        this.logger?.info('Updating class test classes:', this.config.className);
        const result = await updateClassTestInclude(
          this.connection,
          this.config.className,
          options.testClasses,
          this.lockHandle,
          this.config.transportRequest
        );
        this.state.testClassesResult = result;
        this.logger?.info('Class test classes updated successfully:', result.status);
      }

      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'update',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update failed:', error);
      throw error; // Interrupts chain
    }
  }

  /**
   * Update test class (local class) using global class lock handle
   * This method uses the lock handle from lock() (global class lock)
   * Use this for CDS unit tests and other cases where test class is updated
   * as part of the main class workflow
   */
  async updateTestClass(testClassSource?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before updating test class. Call lock() first.');
      }
      const code = testClassSource || this.config.testClassCode;
      if (!code) {
        throw new Error('Test class source code is required. Use setTestClassCode() or pass as parameter.');
      }
      
      this.logger?.info('Updating test class (local class):', this.config.className);
      const result = await updateClassTestInclude(
        this.connection,
        this.config.className,
        code,
        this.lockHandle, // Use global class lock handle
        this.config.transportRequest
      );
      this.state.testClassesResult = result;
      this.logger?.info('Test class updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateTestClass',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update test class failed:', error);
      throw error;
    }
  }

  /**
   * Update test classes using separate test classes lock handle
   * This method uses a separate lock handle from lockTestClasses()
   * Use this for standalone test class operations
   * @deprecated Consider using updateTestClass() with global lock handle instead
   */
  async updateTestClasses(testClassSource?: string): Promise<this> {
    try {
      if (!this.testLockHandle) {
        throw new Error('Test classes must be locked before update. Call lockTestClasses() first.');
      }
      const code = testClassSource || this.config.testClassCode;
      if (!code) {
        throw new Error('Test class source code is required. Use setTestClassCode() or pass as parameter.');
      }
      
      // Check test class code before update using dedicated method
      await this.checkTestClass(code);
      
      this.logger?.info('Updating class test include:', this.config.className);
      const result = await updateClassTestInclude(
        this.connection,
        this.config.className,
        code,
        this.testLockHandle,
        this.config.transportRequest
      );
      this.state.testClassesResult = result;
      this.logger?.info('Class test include updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update test classes failed:', error);
      throw error;
    }
  }

  async updateLocalTypes(localTypesSource?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before updating local types. Call lock() first.');
      }
      const code = localTypesSource || this.config.localTypesCode;
      if (!code) {
        throw new Error('Local types source code is required. Use setLocalTypesCode() or pass as parameter.');
      }
      
      this.logger?.info('Updating local types:', this.config.className);
      const { updateClassLocalTypes } = await import('./includes');
      const result = await updateClassLocalTypes(
        this.connection,
        this.config.className,
        code,
        this.lockHandle,
        this.config.transportRequest
      );
      this.logger?.info('Local types updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateLocalTypes',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update local types failed:', error);
      throw error;
    }
  }

  async updateDefinitions(definitionsSource?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before updating definitions. Call lock() first.');
      }
      const code = definitionsSource || this.config.definitionsCode;
      if (!code) {
        throw new Error('Definitions source code is required. Use setDefinitionsCode() or pass as parameter.');
      }
      
      this.logger?.info('Updating definitions:', this.config.className);
      const { updateClassDefinitions } = await import('./includes');
      const result = await updateClassDefinitions(
        this.connection,
        this.config.className,
        code,
        this.lockHandle,
        this.config.transportRequest
      );
      this.logger?.info('Definitions updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateDefinitions',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update definitions failed:', error);
      throw error;
    }
  }

  async updateMacros(macrosSource?: string): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before updating macros. Call lock() first.');
      }
      const code = macrosSource || this.config.macrosCode;
      if (!code) {
        throw new Error('Macros source code is required. Use setMacrosCode() or pass as parameter.');
      }
      
      this.logger?.info('Updating macros:', this.config.className);
      const { updateClassMacros } = await import('./includes');
      const result = await updateClassMacros(
        this.connection,
        this.config.className,
        code,
        this.lockHandle,
        this.config.transportRequest
      );
      this.logger?.info('Macros updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateMacros',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Update macros failed:', error);
      throw error;
    }
  }

  async check(version: 'active' | 'inactive' = 'inactive', sourceCode?: string): Promise<AxiosResponse> {
    try {
      this.logger?.info(`Checking class: ${this.config.className}, version: ${version}`);
      
      // Use provided source code or stored source code
      const codeToCheck = sourceCode || this.sourceCode;
      
      const result = await checkClass(
        this.connection,
        this.config.className,
        version,
        codeToCheck
      );
      // Store result for backward compatibility
      this.state.checkResult = result;
      this.logger?.info('Class check successful:', result.status);
      return result;
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

  async unlock(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class is not locked. Call lock() first.');
      }
      this.logger?.info('Unlocking class:', this.config.className);
      const result = await unlockClass(
        this.connection,
        this.config.className,
        this.lockHandle
      );
      this.state.unlockResult = result;
      this.lockHandle = undefined;
      this.state.lockHandle = undefined;
      
      // Disable stateful session mode after unlock
      this.connection.setSessionType("stateless");
      
      this.logger?.info('Class unlocked successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlock',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Unlock failed:', error);
      throw error; // Interrupts chain
    }
  }

  async unlockTestClasses(): Promise<this> {
    try {
      if (!this.testLockHandle) {
        this.logger?.warn('Test classes are not locked.');
        return this;
      }
      this.logger?.info('Unlocking test classes:', this.config.className);
      const result = await unlockClassTestClasses(
        this.connection,
        this.config.className,
        this.testLockHandle
      );
      this.state.testLockHandle = undefined;
      this.testLockHandle = undefined;
      this.logger?.info('Test classes unlocked successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'unlockTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Unlock test classes failed:', error);
      throw error;
    }
  }

  async activate(): Promise<this> {
    try {
      this.logger?.info('Activating class:', this.config.className);
      const result = await activateClass(
        this.connection,
        this.config.className
      );
      this.state.activateResult = result;
      this.logger?.info('Class activated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activate',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Activate failed:', error);
      throw error; // Interrupts chain
    }
  }

  async activateTestClasses(): Promise<this> {
    try {
      this.logger?.info('Activating test classes via class activation:', this.config.className);
      const result = await activateClass(
        this.connection,
        this.config.className
      );
      this.state.testActivateResult = result;
      this.logger?.info('Test classes activated within class activation:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'activateTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Activate test classes failed:', error);
      throw error;
    }
  }

  async delete(): Promise<this> {
    try {
      this.logger?.info('Deleting class:', this.config.className);
      const result = await deleteClass(
        this.connection,
        {
          class_name: this.config.className,
          transport_request: this.config.transportRequest
        }
      );
      this.state.deleteResult = result;
      this.logger?.info('Class deleted successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'delete',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Delete failed:', error);
      throw error; // Interrupts chain
    }
  }

  async clearTestClasses(): Promise<this> {
    try {
      this.logger?.info('Clearing test classes for:', this.config.className);
      this.connection.setSessionType('stateful');
      
      const lockHandle = await lockClassTestClasses(this.connection, this.config.className);
      this.testLockHandle = lockHandle;
      this.state.testLockHandle = lockHandle;

      const emptyTestSource = '';
      const result = await updateClassTestInclude(
        this.connection,
        this.config.className,
        emptyTestSource,
        lockHandle,
        this.config.transportRequest
      );
      this.state.testClassesResult = result;

      await unlockClassTestClasses(this.connection, this.config.className, lockHandle);
      this.testLockHandle = undefined;
      this.state.testLockHandle = undefined;

      this.connection.setSessionType("stateless");
      this.logger?.info('Test classes cleared successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'clearTestClasses',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger?.error('Clear test classes failed:', error);
      throw error;
    }
  }

  async forceUnlock(): Promise<void> {
    if (!this.lockHandle && !this.testLockHandle) {
      return;
    }
    try {
      if (this.lockHandle) {
        await unlockClass(
          this.connection,
          this.config.className,
          this.lockHandle
        );
        this.lockHandle = undefined;
        this.state.lockHandle = undefined;
      }

      if (this.testLockHandle) {
        await unlockClassTestClasses(
          this.connection,
          this.config.className,
          this.testLockHandle
        );
        this.testLockHandle = undefined;
        this.state.testLockHandle = undefined;
      }

      this.connection.setSessionType("stateless");
      this.logger?.info('Force unlock successful for', this.config.className);
    } catch (error: any) {
      this.logger?.warn('Force unlock failed:', error);
    }
  }

  // Getters for accessing results
  getState(): Readonly<IClassState> {
    return { ...this.state };
  }

  getValidationResponse(): AxiosResponse | undefined {
    return this.state.validationResponse;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getReadResult(): IClassConfig | undefined {
    if (!this.state.readResult) {
      return undefined;
    }

    // Class read() returns source code (plain text)
    const sourceCode = typeof this.state.readResult.data === 'string'
      ? this.state.readResult.data
      : JSON.stringify(this.state.readResult.data);

    return {
      className: this.config.className,
      sourceCode
    };
  }

  getMetadataResult(): AxiosResponse | undefined {
    return this.state.metadataResult;
  }

  getTransportResult(): AxiosResponse | undefined {
    return this.state.transportResult;
  }

  getLockHandle(): string | undefined {
    return this.lockHandle;
  }

  getUpdateResult(): AxiosResponse | undefined {
    return this.state.updateResult;
  }

  getCheckResult(): AxiosResponse | undefined {
    return this.state.checkResult;
  }

  getTestClassesResult(): AxiosResponse | undefined {
    return this.state.testClassesResult;
  }

  getTestClassesLockHandle(): string | undefined {
    return this.state.testLockHandle;
  }

  getTestClassesActivateResult(): AxiosResponse | undefined {
    return this.state.testActivateResult;
  }

  getUnlockResult(): AxiosResponse | undefined {
    return this.state.unlockResult;
  }

  getActivateResult(): AxiosResponse | undefined {
    return this.state.activateResult;
  }

  getDeleteResult(): AxiosResponse | undefined {
    return this.state.deleteResult;
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  getClassName(): string {
    return this.config.className;
  }

  getSessionId(): string | null {
    return this.connection.getSessionId();
  }

  // Helper method to get all results
  getResults(): {
    validation?: AxiosResponse;
    create?: AxiosResponse;
    read?: AxiosResponse;
    metadata?: AxiosResponse;
    update?: AxiosResponse;
    testClasses?: AxiosResponse;
    testClassesActivation?: AxiosResponse;
    check?: AxiosResponse;
    unlock?: AxiosResponse;
    activate?: AxiosResponse;
    delete?: AxiosResponse;
    lockHandle?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      validation: this.state.validationResponse,
      create: this.state.createResult,
      read: this.state.readResult,
      metadata: this.state.metadataResult,
      update: this.state.updateResult,
      testClasses: this.state.testClassesResult,
      testClassesActivation: this.state.testActivateResult,
      check: this.state.checkResult,
      unlock: this.state.unlockResult,
      activate: this.state.activateResult,
      delete: this.state.deleteResult,
      lockHandle: this.lockHandle,
      errors: [...this.state.errors]
    };
  }
}

