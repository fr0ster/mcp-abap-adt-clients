/**
 * Integration test for getVirtualFoldersContents shared function
 * Tests getVirtualFoldersContents using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- --testPathPattern=shared/virtualFoldersContents
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import type { GetVirtualFoldersContentsParams } from '../../../index';
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

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const { getTimeout } = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

class VirtualFoldersContentsObject
  implements IAdtObject<GetVirtualFoldersContentsParams, AxiosResponse>
{
  private client: AdtClient;

  constructor(client: AdtClient) {
    this.client = client;
  }

  private rejectUnsupported<T>(operation: string): Promise<T> {
    return Promise.reject(
      new Error(
        `Virtual folders contents does not support ${operation} operation`,
      ),
    );
  }

  validate(
    _config: Partial<GetVirtualFoldersContentsParams>,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('validate');
  }

  create(
    _config: GetVirtualFoldersContentsParams,
    _options?: IAdtOperationOptions,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('create');
  }

  read(
    config: Partial<GetVirtualFoldersContentsParams>,
    _version?: 'active' | 'inactive',
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse | undefined> {
    return this.client
      .getUtils()
      .getVirtualFoldersContents(config as GetVirtualFoldersContentsParams);
  }

  readMetadata(
    _config: Partial<GetVirtualFoldersContentsParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('readMetadata');
  }

  update(
    _config: Partial<GetVirtualFoldersContentsParams>,
    _options?: IAdtOperationOptions,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('update');
  }

  delete(
    _config: Partial<GetVirtualFoldersContentsParams>,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('delete');
  }

  activate(
    _config: Partial<GetVirtualFoldersContentsParams>,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('activate');
  }

  check(
    _config: Partial<GetVirtualFoldersContentsParams>,
    _status?: string,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('check');
  }

  readTransport(
    _config: Partial<GetVirtualFoldersContentsParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('readTransport');
  }

  lock(_config: Partial<GetVirtualFoldersContentsParams>): Promise<string> {
    return this.rejectUnsupported('lock');
  }

  unlock(
    _config: Partial<GetVirtualFoldersContentsParams>,
    _lockHandle: string,
  ): Promise<AxiosResponse> {
    return this.rejectUnsupported('unlock');
  }
}

describe('Shared - getVirtualFoldersContents', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<GetVirtualFoldersContentsParams, AxiosResponse>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
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
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
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
    } catch (_error) {
      hasConfig = false;
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
        const result = await tester.readTest(config, {
          skipReadMetadata: true,
        });
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();
        expect(result?.data).toContain('virtualFoldersResult');
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
