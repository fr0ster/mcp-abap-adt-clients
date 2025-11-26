/**
 * BehaviorImplementationBuilder - Extends ClassBuilder for behavior implementation classes
 *
 * Behavior implementation is a special type of class that:
 * 1. Is created as a regular class
 * 2. Has main source updated with "FOR BEHAVIOR OF" clause
 * 3. Has implementations include updated with local handler class
 *
 * @example
 * ```typescript
 * const builder = new BehaviorImplementationBuilder(connection, logger, {
 *   className: 'ZBP_OK_I_CDS_TEST',
 *   packageName: 'ZOK_TEST_PKG_01',
 *   behaviorDefinition: 'ZOK_I_CDS_TEST'
 * })
 *   .setImplementationCode('CLASS lhc_ZOK_I_CDS_TEST DEFINITION...');
 *
 * await builder
 *   .createBehaviorImplementation()
 *   .then(b => b.lock())
 *   .then(b => b.updateMainSource())
 *   .then(b => b.updateImplementations())
 *   .then(b => b.check())
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *   });
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { IAdtLogger, logErrorSafely } from '../../utils/logger';
import { ClassBuilder } from '../class/ClassBuilder';
import { ClassBuilderConfig } from '../class/types';
import { updateClass } from '../class/update';
import { updateBehaviorImplementation } from './update';
import { BehaviorImplementationBuilderConfig } from './types';

export class BehaviorImplementationBuilder extends ClassBuilder {
  private behaviorDefinition: string;
  private implementationCode?: string;

  constructor(
    connection: AbapConnection,
    logger: IAdtLogger,
    config: BehaviorImplementationBuilderConfig
  ) {
    // Convert BehaviorImplementationBuilderConfig to ClassBuilderConfig
    const classConfig: ClassBuilderConfig = {
      className: config.className,
      description: config.description || `Behavior Implementation for ${config.behaviorDefinition}`,
      packageName: config.packageName,
      transportRequest: config.transportRequest,
      final: true, // Behavior implementation classes are always final
      abstract: false,
      createProtected: false,
      masterSystem: config.masterSystem,
      responsible: config.responsible
    };

    super(connection, logger, classConfig);
    this.behaviorDefinition = config.behaviorDefinition;
    this.implementationCode = config.sourceCode;
  }

  /**
   * Set implementation source code (for implementations include)
   */
  setImplementationCode(sourceCode: string): this {
    this.implementationCode = sourceCode;
    this.logger.debug?.('Implementation code set, length:', sourceCode.length);
    return this;
  }

  /**
   * Set behavior definition name
   */
  setBehaviorDefinition(behaviorDefinition: string): this {
    this.behaviorDefinition = behaviorDefinition;
    return this;
  }

  /**
   * Create behavior implementation class
   * Overrides ClassBuilder.create() - creates a regular class
   */
  async create(): Promise<this> {
    try {
      if (!this.config.packageName) {
        throw new Error('Package name is required');
      }
      if (!this.behaviorDefinition) {
        throw new Error('Behavior definition name is required');
      }

      this.logger.info?.('Creating behavior implementation class:', this.config.className);

      // Create class as regular class (inherits from ClassBuilder)
      await super.create();

      this.logger.info?.('Behavior implementation class created successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      logErrorSafely(this.logger, 'CreateBehaviorImplementation', error);
      throw error;
    }
  }

  /**
   * Create behavior implementation - full workflow
   * 1. Create class
   * 2. Lock class
   * 3. Update main source with "FOR BEHAVIOR OF"
   * 4. Update implementations include
   * 5. Unlock class
   * 6. Activate class
   */
  async createBehaviorImplementation(): Promise<this> {
    try {
      // 1. Create class
      await this.create();

      // 2. Lock class
      await this.lock();

      // 3. Update main source with "FOR BEHAVIOR OF"
      await this.updateMainSource();

      // 4. Update implementations include (only if implementation code is provided)
      if (this.implementationCode) {
        await this.updateImplementations();
      } else {
        this.logger.warn?.('Skipping implementations update: no implementation code provided');
      }

      // 5. Unlock class
      await this.unlock();

      // 6. Activate class
      await this.activate();

      this.logger.info?.('Behavior implementation class created and activated successfully');
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'createBehaviorImplementation',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      logErrorSafely(this.logger, 'CreateBehaviorImplementation', error);
      throw error;
    }
  }

  /**
   * Update main source code with "FOR BEHAVIOR OF" clause
   * Must be called after lock()
   */
  async updateMainSource(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before update. Call lock() first.');
      }

      const mainSource = `CLASS ${this.config.className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${this.behaviorDefinition}.

ENDCLASS.

CLASS ${this.config.className} IMPLEMENTATION.

ENDCLASS.`;

      this.logger.info?.('Updating behavior implementation class main source:', this.config.className);
      const result = await updateClass(
        this.connection,
        this.config.className,
        mainSource,
        this.lockHandle,
        this.config.transportRequest
      );
      this.state.updateResult = result;
      this.logger.info?.('Behavior implementation class main source updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateMainSource',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update main source failed:', error);
      throw error;
    }
  }

  /**
   * Update implementations include with local handler class
   * Must be called after lock() and updateMainSource()
   * Uses hardcoded default implementation code
   */
  async updateImplementations(): Promise<this> {
    try {
      if (!this.lockHandle) {
        throw new Error('Class must be locked before update. Call lock() first.');
      }

      const code = this.generateDefaultImplementationCode();

      this.logger.info?.('Updating behavior implementation class implementations:', this.config.className);
      const result = await updateBehaviorImplementation(
        this.connection,
        this.config.className,
        code,
        this.lockHandle,
        this.config.transportRequest
      );
      this.state.updateResult = result;
      this.logger.info?.('Behavior implementation class implementations updated successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'updateImplementations',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Update implementations failed:', error);
      throw error;
    }
  }

  /**
   * Generate default implementation code for local handler class
   */
  private generateDefaultImplementationCode(): string {
    const localHandlerName = `lhc_${this.behaviorDefinition}`;
    return `CLASS ${localHandlerName} DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR ${this.behaviorDefinition.toLowerCase()} RESULT result.

    METHODS get_global_authorizations FOR GLOBAL AUTHORIZATION
      IMPORTING REQUEST requested_authorizations FOR ${this.behaviorDefinition.toLowerCase()} RESULT result.

ENDCLASS.

CLASS ${localHandlerName} IMPLEMENTATION.

  METHOD get_instance_authorizations.

  ENDMETHOD.

  METHOD get_global_authorizations.

  ENDMETHOD.

ENDCLASS.`;
  }

  /**
   * Get behavior definition name
   */
  getBehaviorDefinition(): string {
    return this.behaviorDefinition;
  }
}
