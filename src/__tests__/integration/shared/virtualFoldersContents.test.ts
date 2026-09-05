/**
 * Integration test for getVirtualFoldersContents shared function
 * Tests getVirtualFoldersContents using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- --testPathPatterns=shared/virtualFoldersContents
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtResponse,
  IGetVirtualFoldersContentsParams,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
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

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const { getTimeout } = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

/**
 * The state type is a document, not the envelope.
 *
 * `getUtils()` returns contracts as of this release, and
 * `getVirtualFoldersContents` answers the body. A shim that still declared
 * `IAdtWireResponse` would have to invent a status to satisfy itself — so it
 * declares what it actually gets.
 */
class VirtualFoldersContentsObject
  implements TestableObject<IGetVirtualFoldersContentsParams>
{
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
        message: `Virtual folders contents does not support ${operation}`,
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
    config: Partial<IGetVirtualFoldersContentsParams>,
  ): Promise<IAdtResponse<string>> {
    return this.client
      .getUtils()
      .getVirtualFoldersContents(config as IGetVirtualFoldersContentsParams);
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

describe('Shared - getVirtualFoldersContents', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;
  let tester: BaseTester<IGetVirtualFoldersContentsParams>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      const virtualFoldersObject = new VirtualFoldersContentsObject(client);
      tester = new BaseTester(
        virtualFoldersObject,
        'VirtualFoldersContents',
        'virtual_folders_contents',
        'fetch_virtual_folders_contents',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (_testCase: any, resolver?: TestConfigResolver) => {
          const objectSearchPattern = resolver?.getParam(
            'object_search_pattern',
            '*',
          );
          const facetOrderParam = resolver?.getParam('facet_order', [
            'package',
            'group',
            'type',
          ]);
          const facetOrder = Array.isArray(facetOrderParam)
            ? facetOrderParam
            : ['package', 'group', 'type'];

          const packageNamesParam = resolver?.getParam('package_names');
          let packageNames: string[] = [];
          if (
            Array.isArray(packageNamesParam) &&
            packageNamesParam.length > 0
          ) {
            packageNames = packageNamesParam.filter((name) => !!name);
          } else {
            const packageName = resolver?.getPackageName();
            if (packageName) {
              packageNames = [packageName];
            }
          }

          if (packageNames.length === 0) {
            throw new Error('package_name not configured');
          }

          const withVersions = resolver?.getParam('with_versions');
          const ignoreShortDescriptions = resolver?.getParam(
            'ignore_short_descriptions',
          );

          return {
            objectSearchPattern,
            preselection: [{ facet: 'package', values: packageNames }],
            facetOrder,
            ...(withVersions !== undefined
              ? { withVersions: Boolean(withVersions) }
              : {}),
            ...(ignoreShortDescriptions !== undefined
              ? { ignoreShortDescriptions: Boolean(ignoreShortDescriptions) }
              : {}),
          };
        },
        testDescription: 'Fetch contents',
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
    'should fetch virtual folder contents for a package',
    async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'VirtualFoldersContents - fetch contents',
          'No SAP configuration',
        );
        return;
      }

      if (!tester) {
        logTestSkip(
          testsLogger,
          'VirtualFoldersContents - fetch contents',
          'Tester not initialized',
        );
        return;
      }

      const testName = 'VirtualFoldersContents - fetch contents';
      const testCase = tester.getTestCase() || {
        name: 'fetch_virtual_folders_contents',
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
        // The document itself. A status check never saw the refusals ADT
        // delivers inside a 200; what the document contains is the assertion.
        const result = (await tester.readTest(config, {
          skipReadMetadata: true,
        })) as string;
        expect(result).toContain('virtualFoldersResult');
        logTestSuccess(testsLogger, testName);
      } catch (error) {
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
