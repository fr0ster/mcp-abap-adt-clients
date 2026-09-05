/**
 * Unit test for getObjectStructure shared function
 * Tests getObjectStructure function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/objectStructure.test
 */

import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../clients/AdtClient';
import { failed } from '../../../utils/adtResponse';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import type { TestableObject } from '../../helpers/BaseTester';
import { BaseTester } from '../../helpers/BaseTester';
import {
  createTestAdtClient,
  createTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import type { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

interface IObjectStructureParams {
  object_type: string;
  object_name: string;
}

const {
  getTimeout,
  isHttpStatusAllowed,
} = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

/**
 * The state type is a document, not the envelope.
 *
 * `getUtils()` returns contracts as of this release, and `getObjectStructure`
 * answers the body. A shim that still declared `IAdtWireResponse` would have to
 * invent a status to satisfy itself — so it declares what it actually gets.
 */
class ObjectStructureObject implements TestableObject<IObjectStructureParams> {
  private client: AdtClient;

  constructor(client: AdtClient) {
    this.client = client;
  }

  /**
   * Every member this resource does not have.
   *
   * Answered, not thrown: the contract says a member answers `IAdtResponse`,
   * and a shim that threw would make the harness treat "this resource has no
   * create" differently from "the server refused the create".
   */
  private unsupported<T>(operation: string): Promise<IAdtResponse<T>> {
    return Promise.resolve(
      failed<T>({
        origin: 'refusal',
        code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        message: `Object structure does not support ${operation}`,
      }),
    );
  }

  validate() {
    return this.unsupported<unknown>('validate');
  }

  create() {
    return this.unsupported<unknown>('create');
  }

  read(config: Partial<IObjectStructureParams>): Promise<IAdtResponse<string>> {
    if (!config.object_type || !config.object_name) {
      return Promise.reject(new Error('object_type and object_name required'));
    }
    return this.client
      .getUtils()
      .getObjectStructure(config.object_type, config.object_name);
  }

  readMetadata() {
    return this.unsupported<unknown>('readMetadata');
  }

  update() {
    return this.unsupported<unknown>('update');
  }

  delete() {
    return this.unsupported<unknown>('delete');
  }

  activate() {
    return this.unsupported<unknown>('activate');
  }
}

describe('Shared - getObjectStructure', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;
  let tester: BaseTester<IObjectStructureParams>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      const objectStructureObject = new ObjectStructureObject(client);
      tester = new BaseTester(
        objectStructureObject,
        'ObjectStructure',
        'object_structure',
        'get_object_structure',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (_testCase: any, resolver?: TestConfigResolver) => {
          const objectType = resolver?.getParam('object_type', 'CLAS/OC');
          const objectName =
            resolver?.getParam('object_name') ||
            resolver?.getObjectName('class_name', 'class');

          if (!objectName) {
            throw new Error('object_name not configured');
          }

          return {
            object_type: objectType,
            object_name: objectName,
          };
        },
        testDescription: 'Fetch object structure',
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  beforeEach(() => tester?.beforeEach()());
  afterEach(() => tester?.afterEach()());

  it(
    'should fetch object structure',
    async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'ObjectStructure - fetch',
          'No SAP configuration',
        );
        return;
      }

      if (!tester) {
        logTestSkip(
          testsLogger,
          'ObjectStructure - fetch',
          'Tester not initialized',
        );
        return;
      }

      const testName = 'ObjectStructure - fetch';
      const testCase = tester.getTestCase() || {
        name: 'get_object_structure',
        params: {},
      };
      logTestStart(testsLogger, testName, testCase);

      if (tester.shouldSkip()) {
        logTestSkip(
          testsLogger,
          testName,
          tester.getSkipReason() || 'Test case not available',
        );
        logTestEnd(testsLogger, testName);
        return;
      }

      const config = tester.getConfig();
      if (!config) {
        logTestSkip(testsLogger, testName, 'Config not available');
        logTestEnd(testsLogger, testName);
        return;
      }

      try {
        // The document itself, not an envelope: a status check never saw the
        // refusals ADT delivers inside a 200, and `readTest` already turns a
        // failure into a failed test naming what SAP said.
        const result = (await tester.readTest(config, {
          skipReadMetadata: true,
        })) as string;
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        logTestSuccess(testsLogger, testName);
      } catch (error: any) {
        if (error?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'Endpoint not supported or Accept header not accepted (406)',
            );
            logTestEnd(testsLogger, testName);
            return;
          }
          logTestError(
            testsLogger,
            testName,
            new Error(
              '406 Not Acceptable: endpoint not supported or Accept header rejected',
            ),
          );
          throw error;
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
