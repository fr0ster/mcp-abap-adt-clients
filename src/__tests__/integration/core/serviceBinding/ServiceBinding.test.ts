/**
 * Integration test for ServiceBinding
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ServiceBinding library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=serviceBinding/ServiceBinding
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { XMLParser } from 'fast-xml-parser';
import { AdtClient } from '../../../../clients/AdtClient';
import type {
  IServiceBindingConfig,
  IServiceBindingState,
} from '../../../../core/service';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { getConfig } from '../../../helpers/sessionConfig';
import type { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('ServiceBinding (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IServiceBindingConfig, IServiceBindingState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      tester = new BaseTester(
        client.getServiceBinding(),
        'ServiceBinding',
        'create_service_binding',
        'adt_service_binding',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          const params = testCase?.params || {};
          const parentPackage =
            resolver?.getPackageName?.() ||
            resolvePackageName(
              params.parent_package_name || params.package_name,
            );
          if (!parentPackage)
            throw new Error('parent_package_name/package_name not configured');
          const packageName =
            params.test_subpackage_name || `${parentPackage}_SRVB`;

          const bindingVersion = params.binding_version || 'V4';
          const bindingType = params.binding_type || 'ODATA';
          const serviceType =
            params.service_type ||
            (bindingVersion === 'V2' ? 'odatav2' : 'odatav4');

          return {
            bindingName: params.binding_name,
            packageName,
            transportRequest:
              resolver?.getTransportRequest?.() ||
              resolveTransportRequest(params.transport_request),
            description: params.description,
            serviceDefinitionName: params.service_definition_name,
            serviceName: params.service_name || params.service_definition_name,
            serviceVersion: params.service_version || '0001',
            bindingType,
            bindingVersion,
            bindingCategory: params.binding_category || '1',
            serviceType,
            desiredPublicationState:
              params.desired_publication_state || 'unchanged',
          } as IServiceBindingConfig;
        },
        ensureObjectReady: async (bindingName: string) => {
          if (!connection) {
            return { success: true };
          }

          try {
            const existingActive = await client
              .getServiceBinding()
              .read({ bindingName }, 'active');
            const existingInactive = await client
              .getServiceBinding()
              .read({ bindingName }, 'inactive');
            const hasExisting =
              !!existingActive?.readResult || !!existingInactive?.readResult;
            if (!hasExisting) {
              return { success: true };
            }

            const testCase = tester.getTestCaseDefinition();
            const params = testCase?.params || {};
            const serviceType =
              params.service_type ||
              (params.binding_version === 'V2' ? 'odatav2' : 'odatav4');
            const serviceName =
              params.service_name || params.service_definition_name;
            const serviceVersion = params.service_version || '0001';

            if (existingActive?.readResult) {
              try {
                await client.getServiceBinding().update({
                  bindingName,
                  desiredPublicationState: 'unpublished',
                  serviceType,
                  serviceName,
                  serviceVersion,
                });
              } catch {
                // best-effort: deletion may still work if state is already unpublished
              }
            }

            await client.getServiceBinding().delete({
              bindingName,
              transportRequest: resolveTransportRequest(
                params.transport_request,
              ),
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (error: any) {
            if (error?.response?.status === 404) {
              return { success: true };
            }
            return {
              success: false,
              reason: `Cannot ensure clean service binding state for ${bindingName}: ${error?.message || String(error)}`,
            };
          }

          return { success: true };
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  async function ensureTestSubpackage(params: any): Promise<string> {
    const parentPackage = resolvePackageName(
      params.parent_package_name || params.package_name,
    );
    if (!parentPackage) {
      throw new Error(
        'parent_package_name or package_name must be configured for ServiceBinding test',
      );
    }

    const testSubpackage =
      params.test_subpackage_name || `${parentPackage}_SRVB`;

    let parentSoftwareComponent =
      params.software_component || params.parent_software_component;
    let parentPackageType = params.package_type || 'development';
    let parentTransportLayer = params.transport_layer;
    let parentApplicationComponent = params.application_component;
    let parentResponsible = params.responsible;

    try {
      const parentState = await client
        .getPackage()
        .readMetadata({ packageName: parentPackage });
      const raw = parentState?.metadataResult?.data;
      if (typeof raw === 'string') {
        const parsed = xmlParser.parse(raw) as Record<string, any>;
        const pkg = parsed?.['pak:package'] ?? parsed?.package ?? {};
        const attributes = pkg?.['pak:attributes'] ?? pkg?.attributes ?? {};
        const transport = pkg?.['pak:transport'] ?? pkg?.transport ?? {};
        const softwareComponent =
          transport?.['pak:softwareComponent'] ??
          transport?.softwareComponent ??
          {};
        const transportLayer =
          transport?.['pak:transportLayer'] ?? transport?.transportLayer ?? {};
        const applicationComponent =
          pkg?.['pak:applicationComponent'] ?? pkg?.applicationComponent ?? {};

        parentSoftwareComponent =
          parentSoftwareComponent ??
          softwareComponent?.['@_pak:name'] ??
          softwareComponent?.['@_name'];
        parentPackageType =
          parentPackageType ??
          attributes?.['@_pak:packageType'] ??
          attributes?.['@_packageType'] ??
          'development';
        parentTransportLayer =
          parentTransportLayer ??
          transportLayer?.['@_pak:name'] ??
          transportLayer?.['@_name'];
        parentApplicationComponent =
          parentApplicationComponent ??
          applicationComponent?.['@_pak:name'] ??
          applicationComponent?.['@_name'];
        parentResponsible =
          parentResponsible ??
          pkg?.['@_adtcore:responsible'] ??
          pkg?.['@_responsible'];
      }
    } catch {
      // best-effort: if parent metadata is unavailable, fall back to YAML values
    }

    if (!parentSoftwareComponent) {
      throw new Error(
        'software_component is required (cannot resolve from parent package metadata)',
      );
    }

    const existing = await client
      .getPackage()
      .read({ packageName: testSubpackage });
    if (existing) {
      return testSubpackage;
    }

    const wait = async (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const waitForPackage = async (): Promise<boolean> => {
      for (let i = 0; i < 4; i += 1) {
        const state = await client
          .getPackage()
          .read(
            { packageName: testSubpackage },
            'active',
            i > 0 ? { withLongPolling: true } : undefined,
          );
        if (state) {
          return true;
        }
        await wait(1000);
      }
      return false;
    };

    try {
      await client.getPackage().create({
        packageName: testSubpackage,
        superPackage: parentPackage,
        description: `ServiceBinding test package ${testSubpackage}`,
        softwareComponent: parentSoftwareComponent,
        packageType: parentPackageType,
        transportLayer: parentTransportLayer,
        applicationComponent: parentApplicationComponent,
        responsible: parentResponsible,
        transportRequest: resolveTransportRequest(params.transport_request),
      });
    } catch (error: any) {
      // Package create may return 404/409 when package was created but not readable yet.
      const status = error?.response?.status;
      if (status === 404 || status === 409) {
        const created = await waitForPackage();
        if (created) {
          return testSubpackage;
        }
      }
      throw error;
    }

    const created = await waitForPackage();
    if (!created) {
      throw new Error(
        `Test subpackage ${testSubpackage} was not readable after creation`,
      );
    }
    return testSubpackage;
  }

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        const params = testCase?.params || {};
        const testSubpackage = await ensureTestSubpackage(params);
        const updatePublicationState = 'published';
        const updateDetails = `serviceType=${config.serviceType}, serviceName=${config.serviceName}, serviceVersion=${config.serviceVersion}`;
        logTestStep(
          `update publication state: ${updatePublicationState} :: ${updateDetails}`,
          testsLogger,
        );

        await tester.flowTestAuto({
          activateOnCreate: true,
          updateConfig: {
            bindingName: config.bindingName,
            packageName: testSubpackage,
            serviceType: config.serviceType,
            serviceName: config.serviceName,
            serviceVersion: config.serviceVersion,
            desiredPublicationState: updatePublicationState,
          },
        });
      },
      getTimeout('long'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP service binding',
      async () => {
        if (!hasConfig || !tester) {
          logTestSkip(
            testsLogger,
            'ServiceBinding - read standard object',
            'No SAP configuration or tester not initialized',
          );
          return;
        }

        const standardObject = tester.getStandardObject('serviceBinding');
        if (!standardObject) {
          logTestStart(testsLogger, 'ServiceBinding - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'ServiceBinding - read standard object',
            `Standard service binding not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
          return;
        }

        const bindingName = standardObject.name;
        logTestStart(testsLogger, 'ServiceBinding - read standard object', {
          name: 'read_standard',
          params: { binding_name: bindingName },
        });

        try {
          const resultState = await tester.readTest({
            bindingName,
          });
          if (!resultState) {
            logTestSkip(
              testsLogger,
              'ServiceBinding - read standard object',
              `Service binding ${bindingName} was not found in current system`,
            );
            return;
          }
          expect(resultState?.readResult).toBeDefined();

          logTestSuccess(testsLogger, 'ServiceBinding - read standard object');
        } catch (error) {
          logTestError(
            testsLogger,
            'ServiceBinding - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'ServiceBinding - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});
