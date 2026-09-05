/**
 * Unit test for fetchNodeStructure shared function
 * Tests fetchNodeStructure function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/nodeStructure.test
 */

import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../clients/AdtClient';
import type { IRepositoryNodeContents } from '../../../core/shared/utilResults';
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

interface INodeStructureParams {
  parent_type: string;
  parent_name: string;
  node_id?: string;
  with_short_descriptions?: boolean;
}

const {
  getTimeout,
  isHttpStatusAllowed,
} = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

/**
 * The state type is `IRepositoryNodeContents`, not the envelope.
 *
 * `getUtils()` returns contracts as of this release, and `fetchNodeStructure`
 * answers the parsed level. A shim that still declared `IAdtWireResponse` would have
 * to invent a status to satisfy itself — so it declares what it actually gets.
 */
class NodeStructureObject implements TestableObject<INodeStructureParams> {
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
        message: `Node structure does not support ${operation}`,
      }),
    );
  }

  validate() {
    return this.unsupported<unknown>('validate');
  }

  create() {
    return this.unsupported<unknown>('create');
  }

  read(
    config: Partial<INodeStructureParams>,
  ): Promise<IAdtResponse<IRepositoryNodeContents>> {
    if (!config.parent_type || !config.parent_name) {
      return Promise.reject(new Error('parent_type and parent_name required'));
    }
    return this.client
      .getUtils()
      .fetchNodeStructure(config.parent_type, config.parent_name, {
        nodeId: config.node_id,
      });
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

describe('Shared - fetchNodeStructure', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;
  let tester: BaseTester<INodeStructureParams>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger);
      client = resolvedClient;
      isLegacy = legacy;
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
        buildConfig: (_testCase: any, resolver?: TestConfigResolver) => {
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
    'should fetch node structure',
    async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'NodeStructure - fetch',
          'No SAP configuration',
        );
        return;
      }

      if (!tester) {
        logTestSkip(
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
        const result = (await tester.readTest(config, {
          skipReadMetadata: true,
        })) as IRepositoryNodeContents;
        // The reading's own shape, not the envelope's: a level is the objects
        // it holds and the typed nodes below it.
        expect(result?.objects).toBeDefined();
        expect(result?.childNodes).toBeDefined();
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
