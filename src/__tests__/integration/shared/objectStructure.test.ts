/**
 * Unit test for getObjectStructure shared function
 * Tests getObjectStructure function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/objectStructure.test
 */

import { createAbapConnection } from '@mcp-abap-adt/connection';
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { BaseTester } from '../../helpers/BaseTester';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../helpers/testProgressLogger';
import { getConfig } from '../../helpers/sessionConfig';
import type { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createLibraryLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

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

class ObjectStructureObject
  implements IAdtObject<IObjectStructureParams, AxiosResponse>
{
  private client: AdtClient;

  constructor(client: AdtClient) {
    this.client = client;
  }

  private rejectUnsupported<T>(operation: string): Promise<T> {
    return Promise.reject(
      new Error(`Object structure does not support ${operation} operation`),
    );
  }

  validate(_config: Partial<IObjectStructureParams>): Promise<AxiosResponse> {
    return this.rejectUnsupported('validate');
  }

  create(
    _config: IObjectStructureParams,
    _options?: IAdtOperationOptions,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('create');
  }

  read(
    config: Partial<IObjectStructureParams>,
    _version?: 'active' | 'inactive',
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse | undefined> {
    if (!config.object_type || !config.object_name) {
      return Promise.reject(new Error('object_type and object_name required'));
    }
    return this.client
      .getUtils()
      .getObjectStructure(config.object_type, config.object_name);
  }

  readMetadata(
    _config: Partial<IObjectStructureParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('readMetadata');
  }

  update(
    _config: Partial<IObjectStructureParams>,
    _options?: IAdtOperationOptions,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('update');
  }

  delete(_config: Partial<IObjectStructureParams>): Promise<AxiosResponse> {
    return this.rejectUnsupported('delete');
  }

  activate(_config: Partial<IObjectStructureParams>): Promise<AxiosResponse> {
    return this.rejectUnsupported('activate');
  }

  check(
    _config: Partial<IObjectStructureParams>,
    _status?: string,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('check');
  }

  readTransport(
    _config: Partial<IObjectStructureParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('readTransport');
  }

  lock(_config: Partial<IObjectStructureParams>): Promise<string> {
    return this.rejectUnsupported('lock');
  }

  unlock(
    _config: Partial<IObjectStructureParams>,
    _lockHandle: string,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('unlock');
  }
}

describe('Shared - getObjectStructure', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IObjectStructureParams, AxiosResponse>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
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
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
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
    } catch (_error) {
      hasConfig = false;
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
        const result = await tester.readTest(config, {
          skipReadMetadata: true,
        });
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();
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
