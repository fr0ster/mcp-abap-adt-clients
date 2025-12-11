/**
 * CdsUnitTestBuilder - Builder for CDS unit tests (full class lifecycle)
 * 
 * Extends ClassBuilder for full class operations and adds CDS-specific validation
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { IClassBuilderConfig } from '../class';
import { BaseUnitTestBuilder } from './BaseUnitTestBuilder';
import { validateCdsForUnitTest } from './validateCdsForUnitTest';
import { ClassUnitTestRunOptions } from './types';

export interface CdsUnitTestBuilderConfig {
  className: string;
  packageName: string;
  cdsViewName: string;  // CDS view name for generating test class source
  transportRequest?: string;
  description?: string;
  testClassSource?: string;
  classTemplate?: string;
}

/**
 * Builder for CDS unit tests (full class lifecycle)
 * 
 * Extends BaseUnitTestBuilder and overrides create() to create class with CDS template,
 * then lock and add test class source
 * 
 * @example
 * ```typescript
 * const builder = new CdsUnitTestBuilder(connection, logger, {
 *   className: 'ZCL_CDS_TEST',
 *   packageName: 'ZOK_TEST_PKG_01',
 *   classTemplate: '<template>...</template>',
 *   testClassSource: 'CLASS ltc_test...'
 * });
 * 
 * await builder
 *   .validateCdsForUnitTest('ZCDS_MY_VIEW')
 *   .then(b => b.create())  // Creates empty class, locks, adds test class
 *   .then(b => b.unlock())
 *   .then(b => b.activate())
 *   .then(b => b.runForObject())
 *   .then(b => b.getStatus())
 *   .then(b => b.getResult());
 * ```
 */
export class CdsUnitTestBuilder extends BaseUnitTestBuilder {
  private cdsConfig: CdsUnitTestBuilderConfig;

  constructor(
    connection: IAbapConnection,
    config: CdsUnitTestBuilderConfig,
    logger?: ILogger
  ) {
    const classConfig: IClassBuilderConfig = {
      className: config.className,
      description: config.description || `CDS unit test for ${config.className}`,
      packageName: config.packageName,
      transportRequest: config.transportRequest,
      testClassCode: config.testClassSource,
      classTemplate: config.classTemplate,
      final: true
    };
    super(connection, classConfig, logger);
    
    this.cdsConfig = config;
  }

  /**
   * Override create() to:
   * 1. Create empty class with CDS template (via super.create())
   * 2. Lock class
   * 3. Add test class source (via update())
   * 4. Unlock class (required before activation)
   */
  async create(): Promise<this> {
    try {
      // Ensure classTemplate is set (required for CDS unit test)
      if (!this.cdsConfig.classTemplate) {
        throw new Error('classTemplate is required for CDS unit test class creation');
      }

      // Ensure testClassSource is set
      if (!this.cdsConfig.testClassSource) {
        throw new Error('testClassSource is required for CDS unit test class creation');
      }

      // Step 1: Create empty class with CDS template (includes testclasses include)
      this.logger?.info('Creating CDS unit test class with template:', this.cdsConfig.className);
      await super.create();

      // Step 2: Lock class (required for updating test class)
      this.logger?.info('Locking class for test class update:', this.cdsConfig.className);
      await this.lock();

      // Step 3: Add test class source (uses lock handle from step 2)
      this.logger?.info('Adding test class source:', this.cdsConfig.className);
      await this.update(this.cdsConfig.testClassSource);

      // Step 4: Unlock class (required before activation can proceed)
      this.logger?.info('Unlocking class after test class update:', this.cdsConfig.className);
      await this.unlock();

      return this;
    } catch (error: any) {
      this.logger?.error('Create CDS unit test class failed:', error);
      throw error;
    }
  }

  /**
   * Validate CDS view for unit test doubles
   * This validation is required before creating a CDS unit test class
   */
  async validateCdsForUnitTest(cdsViewName: string): Promise<this> {
    try {
      this.logger?.info('Validating CDS view for unit test doubles:', cdsViewName);
      const response = await validateCdsForUnitTest(this.connection, cdsViewName);
      
      // Check if validation succeeded (SEVERITY=OK)
      if (response?.status === 200) {
        const { XMLParser } = require('fast-xml-parser');
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(response.data);
        const severity = parsed?.['asx:abap']?.['asx:values']?.['DATA']?.['SEVERITY'];
        
        if (severity !== 'OK') {
          const shortText = parsed?.['asx:abap']?.['asx:values']?.['DATA']?.['SHORT_TEXT'] || '';
          const longText = parsed?.['asx:abap']?.['asx:values']?.['DATA']?.['LONG_TEXT'] || '';
          const errorMessage = shortText || longText || `Validation failed with severity: ${severity}`;
          throw new Error(`CDS view ${cdsViewName} validation for unit test doubles failed: ${errorMessage}`);
        }
        
        this.logger?.info('CDS view validated successfully for unit test doubles');
        return this;
      } else {
        throw new Error(`CDS view validation failed with HTTP ${response.status}`);
      }
    } catch (error: any) {
      this.logger?.error('Validate CDS for unit test failed:', error);
      throw error;
    }
  }

  /**
   * Start unit test run by object (for CDS unit tests)
   * Override to use className from config
   */
  async runForObject(className?: string, options?: ClassUnitTestRunOptions): Promise<this> {
    // Use className from config if not provided
    const targetClassName = className || this.cdsConfig.className;
    return await super.runForObject(targetClassName, options);
  }

  /**
   * Delete test class
   */
  async deleteTestClass(): Promise<this> {
    try {
      this.logger?.info('Deleting test class:', this.cdsConfig.className);
      await this.delete();
      this.logger?.info('Test class deleted successfully');
      return this;
    } catch (error: any) {
      this.logger?.error('Delete test class failed:', error);
      throw error;
    }
  }
}

