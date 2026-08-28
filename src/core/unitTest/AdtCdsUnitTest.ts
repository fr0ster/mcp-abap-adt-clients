/**
 * AdtCdsUnitTest - High-level CRUD operations for CDS Unit Test objects
 *
 * Extends AdtUnitTest with CDS-specific functionality:
 * - Checks CDS view availability for unit test doubles
 * - Creates test classes with CDS templates
 * - Manages test class lifecycle (create, update, delete)
 * - Runs unit tests for CDS views
 *
 * Uses AdtClass for test class lifecycle operations and AdtUnitTest for test execution.
 */

import {
  AdtObjectErrorCodes,
  AdtOperationError,
  type HttpError,
  type IAbapConnection,
  type ICdsTestDoubleCheckable,
  type ICdsUnitTestConfig,
  type ICdsUnitTestState,
  type ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  headerValueToString,
  safeErrorMessage,
  safeStringify,
} from '../../utils/internalUtils';
import { startClassUnitTestRunByObject } from '../class/run';
import { validateClassName } from '../class/validation';
import { AdtDdl } from '../ddl/AdtDdl';
import { AdtUnitTest } from './AdtUnitTest';
import { checkCdsTestDoublesAvailability } from './checkCdsTestDoublesAvailability';
import type {
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
} from './types';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICdsUnitTestConfig,
  ICdsUnitTestState,
} from '@mcp-abap-adt/interfaces';

/**
 * AdtCdsUnitTest - CDS-specific unit test operations
 *
 * Combines AdtClass for test class lifecycle and AdtUnitTest for test execution
 */
export class AdtCdsUnitTest
  extends AdtUnitTest
  implements ICdsTestDoubleCheckable
{
  protected adtView: AdtDdl;
  private cdsViewName?: string;
  private className?: string;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    super(connection, logger);
    // adtClass and adtLocalTestClass are already available from parent class
    // adtView is for working with CDS views
    this.adtView = new AdtDdl(connection, logger);
  }

  /**
   * Check CDS view availability for unit test doubles
   * This check is required before creating a CDS unit test class.
   *
   * Unlike validate() (which checks name/params before create), this checks whether
   * a CDS view can be used with the test doubles framework (cl_cds_test_environment).
   */
  async checkCdsTestDoubles(cdsViewName: string): Promise<ICdsUnitTestState> {
    try {
      this.logger?.info?.(
        'Checking CDS view for unit test doubles:',
        cdsViewName,
      );
      const response = await checkCdsTestDoublesAvailability(
        this.connection,
        cdsViewName,
      );

      // Check if the check succeeded (SEVERITY=OK)
      if (response?.status === 200) {
        const { XMLParser } = require('fast-xml-parser');
        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(response.data);
        const severity = parsed?.['asx:abap']?.['asx:values']?.DATA?.SEVERITY;

        if (severity !== 'OK') {
          const shortText =
            parsed?.['asx:abap']?.['asx:values']?.DATA?.SHORT_TEXT || '';
          const longText =
            parsed?.['asx:abap']?.['asx:values']?.DATA?.LONG_TEXT || '';
          const errorMessage =
            shortText ||
            longText ||
            `CDS test doubles check failed with severity: ${severity}`;
          throw new Error(
            `CDS view ${cdsViewName} is not available for unit test doubles: ${errorMessage}`,
          );
        }

        this.logger?.info?.('CDS view available for unit test doubles');
        this.cdsViewName = cdsViewName;
        const state: ICdsUnitTestState = {
          cdsCheckResponse: response,
          errors: [],
        };
        return state;
      } else {
        throw new Error(
          `CDS test doubles check failed with HTTP ${response.status}`,
        );
      }
    } catch (error: unknown) {
      this.logger?.error(
        'checkCdsTestDoubles failed:',
        safeErrorMessage(error),
      );
      throw error;
    }
  }

  /**
   * Override: Validate what `create()` is about to build.
   *
   * When `className`, `classTemplate` and `testClassSource` are all present —
   * the same combination `create()` uses to pick its class-creation path —
   * this checks both halves of what that path builds:
   *
   * 1. `validateClassName` for the dummy global class Step 1 of `create()`
   *    creates. This is the one place in unit testing where a name is
   *    genuinely new, unlike the container class `AdtUnitTest.validate()`
   *    checks (which already exists).
   * 2. `checkClassLocalTestClass`, via `this.adtLocalTestClass`, for the
   *    local test class Step 2 of `create()` puts inside it — the same check
   *    `AdtLocalTestClass.validate()` performs.
   *
   * Otherwise this is a plain test run (no class being created), so it
   * defers to the parent's validate (confirms the container class exists).
   */
  async validate(
    config: Partial<ICdsUnitTestConfig>,
  ): Promise<ICdsUnitTestState> {
    if (config.className && config.classTemplate && config.testClassSource) {
      this.logger?.info?.(
        'Validating CDS unit test class name:',
        config.className,
      );

      // The validation endpoint requires `packagename`; without it the server
      // answers 400, so this cannot be left to the wire.
      if (!config.packageName) {
        throw new Error('Package name is required for validation');
      }

      let validationResponse: Awaited<ReturnType<typeof validateClassName>>;
      try {
        validationResponse = await validateClassName(
          this.connection,
          config.className,
          config.packageName,
          config.description || `CDS unit test for ${config.className}`,
        );
      } catch (error: unknown) {
        // Mirrors AdtClass.validate()'s catch block: a 4xx here means the
        // name itself was rejected, so it is reported the same way.
        const e = error as HttpError;
        const status = e.response?.status;
        const statusText = e.response?.statusText;
        const errorMessage = e.response?.data
          ? typeof e.response.data === 'string'
            ? e.response.data.substring(0, 500)
            : safeStringify(e.response.data).substring(0, 500)
          : e.message || 'Unknown error';

        this.logger?.error?.(
          `Validate failed: HTTP ${status || '?'} ${statusText || ''}`,
          { status, statusText, message: errorMessage },
        );

        if (status && status >= 400 && status < 500) {
          const customError = new AdtOperationError(
            `Validation failed for object '${config.className}': ${errorMessage}`,
          );
          customError.code = AdtObjectErrorCodes.VALIDATION_FAILED;
          customError.status = status;
          customError.statusText = statusText;
          customError.originalError = error;
          throw customError;
        }

        throw error;
      }

      this.logger?.info?.('Validating CDS local test class code');
      const testClassState = await this.adtLocalTestClass.validate({
        className: config.className,
        testClassCode: config.testClassSource,
      });

      return {
        validationResponse,
        testClassState,
        errors: [],
      };
    }

    // Otherwise, use parent's validate (confirms the container class exists
    // for a plain test run).
    return await super.validate(config);
  }

  /**
   * Override: Create test class with CDS template and test class source
   * For CDS: creates a global minimal class and adds local test class to it
   * If className and classTemplate are provided, creates test class; otherwise uses parent's create for test run
   */
  async create(
    config: ICdsUnitTestConfig,
    options?: import('@mcp-abap-adt/interfaces').IAdtOperationOptions,
  ): Promise<ICdsUnitTestState> {
    // If className and classTemplate are provided, create test class
    if (config.className && config.classTemplate && config.testClassSource) {
      try {
        this.logger?.info?.('Creating CDS unit test class:', config.className);
        this.className = config.className;

        // Step 1: Create empty global class with CDS template
        // Uses parent's adtClass for creating the global class
        this.logger?.info?.('Step 1: Creating global class with template');
        const createState = await this.adtClass.create({
          className: config.className,
          packageName: config.packageName as string,
          description:
            config.description || `CDS unit test for ${config.className}`,
          classTemplate: config.classTemplate,
          transportRequest: config.transportRequest,
          final: true,
        });

        // Step 1.5: Activate the class after creation (required before lock test classes)
        this.logger?.info?.('Step 1.5: Activating global class');
        const _activateState = await this.adtClass.activate({
          className: config.className,
        });
        this.logger?.info?.('Global class activated');

        // Step 2: Write the tests into the global class's testclasses include.
        // An include is not created — it exists because its class does — so this
        // is update, and adtLocalTestClass handles locking/unlocking internally.
        this.logger?.info?.('Step 2: Writing test class into global class');
        const testClassState = await this.adtLocalTestClass.update(
          {
            className: config.className,
            testClassCode: config.testClassSource,
            transportRequest: config.transportRequest,
          },
          {
            activateOnUpdate: true, // Activate the parent class after writing the tests
          },
        );

        return {
          createResult: createState.createResult,
          testClassState: {
            ...createState,
            ...testClassState,
          },
          errors: [],
        };
      } catch (error: unknown) {
        this.logger?.error('create failed:', safeErrorMessage(error));
        throw error;
      }
    }

    // Without a template there is no CDS-specific chain: creating the
    // container class and writing the tests into it is what the parent does.
    return await super.create(config, options);
  }

  /**
   * Override: Update test class source
   * If className and testClassSource are provided, updates test class; otherwise uses parent's update
   */
  async update(
    config: Partial<ICdsUnitTestConfig>,
    options?: import('@mcp-abap-adt/interfaces').IAdtOperationOptions,
  ): Promise<ICdsUnitTestState> {
    // If className and testClassSource are provided, update test class
    if (config.className && config.testClassSource) {
      try {
        this.logger?.info?.(
          'Updating CDS test class source:',
          config.className,
        );
        // Uses parent's adtLocalTestClass which handles locking/unlocking and activation internally
        const testClassState = await this.adtLocalTestClass.update(
          {
            className: config.className,
            testClassCode: config.testClassSource,
            transportRequest: config.transportRequest,
          },
          {
            activateOnUpdate: true, // Activate the parent class after updating test class
          },
        );
        return {
          testClassState,
          errors: [],
        };
      } catch (error: unknown) {
        this.logger?.error('update failed:', safeErrorMessage(error));
        throw error;
      }
    }

    // Otherwise the parent writes the include, which is the same operation
    // without the CDS-specific activation this branch forces.
    return await super.update(config, options);
  }

  /**
   * Override: Delete test class
   * If className is provided, deletes test class; otherwise uses parent's delete
   * For CDS: deletes the entire global class (not just the local test class)
   */
  async delete(
    config: Partial<ICdsUnitTestConfig>,
  ): Promise<ICdsUnitTestState> {
    // If className is provided, delete test class
    if (config.className) {
      try {
        this.logger?.info?.(
          'Deleting CDS test class (global class):',
          config.className,
        );
        // Uses parent's adtClass for deleting the global class
        const deleteState = await this.adtClass.delete({
          className: config.className,
          transportRequest: config.transportRequest,
        });
        this.className = undefined;
        return {
          testClassState: deleteState,
          errors: [],
        };
      } catch (error: unknown) {
        this.logger?.error('delete failed:', safeErrorMessage(error));
        throw error;
      }
    }

    // Otherwise the parent empties the include, leaving the class in place.
    return await super.delete(config);
  }

  /**
   * Override: Run unit tests
   * For CDS: if className is provided, runs tests for that class by object name
   * Otherwise, uses parent's run method with tests array
   */
  async run(
    testsOrClassName: IClassUnitTestDefinition[] | string,
    options?: IClassUnitTestRunOptions,
  ): Promise<string> {
    // If className is provided (string), run tests for that class by object name
    if (typeof testsOrClassName === 'string') {
      const className = testsOrClassName;
      if (!className) {
        throw new Error('Class name is required');
      }
      try {
        this.logger?.info?.('Starting unit test run for object:', className);
        const response = await startClassUnitTestRunByObject(
          this.connection,
          className,
          options,
        );
        const runId =
          headerValueToString(response.headers?.location)?.split('/').pop() ||
          headerValueToString(response.headers?.['content-location'])
            ?.split('/')
            .pop() ||
          headerValueToString(response.headers?.['sap-adt-location'])
            ?.split('/')
            .pop() ||
          this.extractRunId(response);
        if (!runId) {
          throw new Error('Failed to extract run ID from response');
        }
        this.lastRunId = runId;
        this.logger?.info?.('Unit test run started, runId:', runId);
        return runId;
      } catch (error: unknown) {
        this.logger?.error('run failed:', safeErrorMessage(error));
        throw error;
      }
    }

    // Otherwise, use parent's run method with tests array
    return await super.run(testsOrClassName, options);
  }

  /**
   * Get test class name
   */
  getClassName(): string | undefined {
    return this.className;
  }

  /**
   * Get CDS view name
   */
  getCdsViewName(): string | undefined {
    return this.cdsViewName;
  }
}
