/**
 * Integration test for getPackageHierarchy shared function
 * Tests getPackageHierarchy using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/packageHierarchy.test
 */

import type {
  IAbapConnection,
  IAdtOperationOptions,
  IAdtResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import type { IWalkedNode } from '../../../../scripts/lib/packageWalk';
import { walkPackage } from '../../../../scripts/lib/packageWalk';
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
  implements TestableObject<IPackageHierarchyParams>
{
  private client: AdtClient;
  private connection: IAbapConnection;

  constructor(client: AdtClient, connection: IAbapConnection) {
    this.client = client;
    this.connection = connection;
  }

  /** Every member this resource does not have — answered, not thrown. */
  private unsupported<T>(operation: string): Promise<IAdtResponse<T>> {
    return Promise.resolve(
      failed<T>({
        origin: 'refusal',
        code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        message: `Package hierarchy does not support ${operation}`,
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
    config: Partial<IPackageHierarchyParams>,
  ): Promise<IAdtResponse<IWalkedNode>> {
    if (!config.package_name) {
      return Promise.reject(new Error('package_name required'));
    }
    // The walk a consumer writes, over the single-request member that stayed.
    // See scripts/lib/packageWalk.ts for why it is not a member.
    return walkPackage(this.connection, config.package_name).then(
      (tree) =>
        ({
          ok: true,
          getResult: () => ({
            value: tree as unknown as IWalkedNode,
          }),
        }) as unknown as IAdtResponse<IWalkedNode>,
    );
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

  checkDeletion() {
    return this.unsupported<unknown>('checkDeletion');
  }

  activate() {
    return this.unsupported<unknown>('activate');
  }
}

describe('Shared - getPackageHierarchy', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;
  let tester: BaseTester<IPackageHierarchyParams>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      const packageHierarchyObject = new PackageHierarchyObject(
        client,
        connection,
      );
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
        buildConfig: (_testCase: any, resolver?: TestConfigResolver) => {
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
        const result = (await tester.readTest(config, {
          skipReadMetadata: true,
        })) as IWalkedNode;
        expect(result?.name).toBeDefined();
        expect(result?.name).toBe(config.package_name.toUpperCase());
        expect(result?.type).toBeDefined();
        // The walk stopped raising on an empty level in 19.0.0 — an existing
        // but empty package answers zero bytes, so the raise was wrong about
        // the one cause it named. That makes an empty tree indistinguishable
        // from a broken walk unless the test says otherwise, and it did not:
        // it asserted the root's own name and type and nothing below them.
        expect(result.isPackage).toBe(true);
        expect(result.children.length).toBeGreaterThan(0);
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
