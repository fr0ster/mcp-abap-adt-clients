/**
 * Unit test for fetchNodeStructure shared function
 * Tests fetchNodeStructure function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/nodeStructure.test
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
  logBuilderTestEnd,
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
} from '../../helpers/builderTestLogger';
import { getConfig } from '../../helpers/sessionConfig';
import type { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createBuilderLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

interface INodeStructureParams {
  parent_type: string;
  parent_name: string;
  node_id?: string;
  with_short_descriptions?: boolean;
}

const { getTimeout, isHttpStatusAllowed } = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const builderLogger: ILogger = createBuilderLogger();
const testsLogger: ILogger = createTestsLogger();

class NodeStructureObject
  implements IAdtObject<INodeStructureParams, AxiosResponse>
{
  private client: AdtClient;

  constructor(client: AdtClient) {
    this.client = client;
  }

  private rejectUnsupported<T>(operation: string): Promise<T> {
    return Promise.reject(
      new Error(`Node structure does not support ${operation} operation`),
    );
  }

  validate(_config: Partial<INodeStructureParams>): Promise<AxiosResponse> {
    return this.rejectUnsupported('validate');
  }

  create(
    _config: INodeStructureParams,
    _options?: IAdtOperationOptions,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('create');
  }

  read(
    config: Partial<INodeStructureParams>,
    _version?: 'active' | 'inactive',
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse | undefined> {
    if (!config.parent_type || !config.parent_name) {
      return Promise.reject(new Error('parent_type and parent_name required'));
    }
    return this.client
      .getUtils()
      .fetchNodeStructure(
        config.parent_type,
        config.parent_name,
        config.node_id,
        config.with_short_descriptions ?? true,
      );
  }

  readMetadata(
    _config: Partial<INodeStructureParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('readMetadata');
  }

  update(
    _config: Partial<INodeStructureParams>,
    _options?: IAdtOperationOptions,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('update');
  }

  delete(_config: Partial<INodeStructureParams>): Promise<AxiosResponse> {
    return this.rejectUnsupported('delete');
  }

  activate(_config: Partial<INodeStructureParams>): Promise<AxiosResponse> {
    return this.rejectUnsupported('activate');
  }

  check(
    _config: Partial<INodeStructureParams>,
    _status?: string,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('check');
  }

  readTransport(
    _config: Partial<INodeStructureParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('readTransport');
  }

  lock(_config: Partial<INodeStructureParams>): Promise<string> {
    return this.rejectUnsupported('lock');
  }

  unlock(
    _config: Partial<INodeStructureParams>,
    _lockHandle: string,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('unlock');
  }
}

describe('Shared - fetchNodeStructure', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<INodeStructureParams, AxiosResponse>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      const nodeStructureObject = new NodeStructureObject(client);
      tester = new BaseTester(
        nodeStructureObject,
        'NodeStructure',
        'node_structure',
        'fetch_node_structure',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          const parentType = resolver?.getParam('parent_type', 'CLAS/OC');
          const parentName =
            resolver?.getParam('parent_name') ||
            resolver?.getObjectName('parent_name', 'class') ||
            resolver?.getObjectName('class_name', 'class');

          if (!parentName) {
            throw new Error('parent_name not configured');
          }

          const nodeId = resolver?.getParam('node_id', '0000');
          const withShortDescriptions = resolver?.getParam(
            'with_short_descriptions',
            true,
          );

          return {
            parent_type: parentType,
            parent_name: parentName,
            node_id: nodeId,
            with_short_descriptions: Boolean(withShortDescriptions),
          };
        },
        testDescription: 'Fetch node structure',
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  beforeEach(() => tester?.beforeEach()());
  afterEach(() => tester?.afterEach()());

  it(
    'should fetch node structure',
    async () => {
      if (!hasConfig) {
        logBuilderTestSkip(
          testsLogger,
          'NodeStructure - fetch',
          'No SAP configuration',
        );
        return;
      }

      if (!tester) {
        logBuilderTestSkip(
          testsLogger,
          'NodeStructure - fetch',
          'Tester not initialized',
        );
        return;
      }

      const testName = 'NodeStructure - fetch';
      const testCase = tester.getTestCase() || {
        name: 'fetch_node_structure',
        params: {},
      };
      logBuilderTestStart(testsLogger, testName, testCase);

      if (tester.shouldSkip()) {
        logBuilderTestSkip(
          testsLogger,
          testName,
          tester.getSkipReason() || 'Test case not available',
        );
        logBuilderTestEnd(testsLogger, testName);
        return;
      }

      const config = tester.getConfig();
      if (!config) {
        logBuilderTestSkip(testsLogger, testName, 'Config not available');
        logBuilderTestEnd(testsLogger, testName);
        return;
      }

      try {
        const result = await tester.readTest(config);
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();
        logBuilderTestSuccess(testsLogger, testName);
      } catch (error: any) {
        if (error?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logBuilderTestSkip(
              testsLogger,
              testName,
              'Endpoint not supported or Accept header not accepted (406)',
            );
            logBuilderTestEnd(testsLogger, testName);
            return;
          }
          logBuilderTestError(
            testsLogger,
            testName,
            new Error(
              '406 Not Acceptable: endpoint not supported or Accept header rejected',
            ),
          );
          throw error;
        }
        logBuilderTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
