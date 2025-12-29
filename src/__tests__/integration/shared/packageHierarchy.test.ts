/**
 * Integration test for getPackageHierarchy shared function
 * Tests getPackageHierarchy using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/packageHierarchy.test
 */

import { createAbapConnection } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import type { PackageHierarchyNode } from '../../../index';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { BaseTester } from '../../helpers/BaseTester';
import { getConfig } from '../../helpers/sessionConfig';
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

interface IPackageHierarchyParams {
  package_name: string;
}

const {
  getTimeout,
  isHttpStatusAllowed,
} = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

class PackageHierarchyObject
  implements IAdtObject<IPackageHierarchyParams, PackageHierarchyNode>
{
  private client: AdtClient;

  constructor(client: AdtClient) {
    this.client = client;
  }

  private rejectUnsupported<T>(operation: string): Promise<T> {
    return Promise.reject(
      new Error(`Package hierarchy does not support ${operation} operation`),
    );
  }

  validate(_config: Partial<IPackageHierarchyParams>): Promise<any> {
    return this.rejectUnsupported('validate');
  }

  create(
    _config: IPackageHierarchyParams,
    _options?: IAdtOperationOptions,
  ): Promise<any> {
    return this.rejectUnsupported('create');
  }

  read(
    config: Partial<IPackageHierarchyParams>,
    _version?: 'active' | 'inactive',
    _options?: { withLongPolling?: boolean },
  ): Promise<PackageHierarchyNode | undefined> {
    if (!config.package_name) {
      return Promise.reject(new Error('package_name required'));
    }
    return this.client.getUtils().getPackageHierarchy(config.package_name);
  }

  readMetadata(
    _config: Partial<IPackageHierarchyParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<any> {
    return this.rejectUnsupported('readMetadata');
  }

  update(
    _config: Partial<IPackageHierarchyParams>,
    _options?: IAdtOperationOptions,
  ): Promise<any> {
    return this.rejectUnsupported('update');
  }

  delete(_config: Partial<IPackageHierarchyParams>): Promise<any> {
    return this.rejectUnsupported('delete');
  }

  activate(_config: Partial<IPackageHierarchyParams>): Promise<any> {
    return this.rejectUnsupported('activate');
  }

  check(
    _config: Partial<IPackageHierarchyParams>,
    _status?: string,
  ): Promise<any> {
    return this.rejectUnsupported('check');
  }

  readTransport(
    _config: Partial<IPackageHierarchyParams>,
    _options?: { withLongPolling?: boolean },
  ): Promise<any> {
    return this.rejectUnsupported('readTransport');
  }

  lock(_config: Partial<IPackageHierarchyParams>): Promise<string> {
    return this.rejectUnsupported('lock');
  }

  unlock(
    _config: Partial<IPackageHierarchyParams>,
    _lockHandle: string,
  ): Promise<any> {
    return this.rejectUnsupported('unlock');
  }
}

describe('Shared - getPackageHierarchy', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IPackageHierarchyParams, PackageHierarchyNode>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      const packageHierarchyObject = new PackageHierarchyObject(client);
      tester = new BaseTester(
        packageHierarchyObject,
        'PackageHierarchy',
        'package_hierarchy',
        'get_package_hierarchy',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          const packageName = resolver?.getPackageName();
          if (!packageName) {
            throw new Error('package_name not configured');
          }
          return {
            package_name: packageName,
          };
        },
        testDescription: 'Fetch package hierarchy',
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  beforeEach(() => tester?.beforeEach()());
  afterEach(() => tester?.afterEach()());

  it(
    'should fetch package hierarchy',
    async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          'PackageHierarchy - fetch',
          'No SAP configuration',
        );
        return;
      }

      if (!tester) {
        logTestSkip(
          testsLogger,
          'PackageHierarchy - fetch',
          'Tester not initialized',
        );
        return;
      }

      const testName = 'PackageHierarchy - fetch';
      const testCase = tester.getTestCase() || {
        name: 'get_package_hierarchy',
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
        expect(result?.name).toBeDefined();
        expect(result?.name).toBe(config.package_name.toUpperCase());
        expect(result?.adtType).toBeDefined();
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
