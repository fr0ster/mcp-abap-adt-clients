/**
 * Integration test for read methods (Accept headers)
 * Ensures read endpoints return 2xx (406 should fail)
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/readAccept.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { logBuilderTestStep } from '../../helpers/builderTestLogger';
import { getConfig } from '../../helpers/sessionConfig';
import {
  createBuilderLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const {
  getEnabledTestCase,
  resolveStandardObject,
  withAcceptHandling,
  getAcceptHint,
} = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const builderLogger: ILogger = createBuilderLogger();
const testsLogger: ILogger = createTestsLogger();

const isStatusOk = (status?: number): boolean =>
  status === 200 || status === 204;

async function runReadWithAcceptLogging<T>(
  label: string,
  promise: Promise<T>,
): Promise<T> {
  try {
    return await withAcceptHandling(promise);
  } catch (error: any) {
    if (error?.response?.status === 406) {
      const acceptHint = getAcceptHint(error);
      if (acceptHint) {
        testsLogger.error?.(`❌ ${label}: ${acceptHint}`);
      }
    }
    throw error;
  }
}

function assertReadResult(state: any, label: string, name: string): void {
  if (!state || !state.readResult) {
    throw new Error(`Read ${label} failed: no response for ${name}`);
  }
  const status = state.readResult.status;
  if (!isStatusOk(status)) {
    throw new Error(`Read ${label} failed: HTTP ${status} for ${name}`);
  }
}

describe('Shared - read Accept headers', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let standardClassName: string | null = null;
  let standardInterfaceName: string | null = null;
  let testCase: any | null = null;
  let hasTestCase = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);

      testCase = getEnabledTestCase('read_accept', 'read_accept');
      hasTestCase = !!testCase;

      standardClassName =
        resolveStandardObject('class', isCloudSystem, testCase)?.name || null;
      standardInterfaceName =
        resolveStandardObject('interface', isCloudSystem, testCase)?.name ||
        null;
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it('should read class source', async () => {
    if (!hasConfig || !hasTestCase || !standardClassName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or standard class not found',
      );
      return;
    }

    logBuilderTestStep('read class source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read class source',
      client.getClass().read({ className: standardClassName }, 'active'),
    );
    assertReadResult(state, 'class source', standardClassName);
  });

  it('should read local definitions include', async () => {
    if (!hasConfig || !hasTestCase || !standardClassName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or standard class not found',
      );
      return;
    }

    logBuilderTestStep('read local definitions', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read local definitions',
      client
        .getLocalDefinitions()
        .read({ className: standardClassName }, 'active'),
    );
    assertReadResult(state, 'local definitions', standardClassName);
  });

  it('should read local types include', async () => {
    if (!hasConfig || !hasTestCase || !standardClassName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or standard class not found',
      );
      return;
    }

    logBuilderTestStep('read local types', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read local types',
      client.getLocalTypes().read({ className: standardClassName }, 'active'),
    );
    assertReadResult(state, 'local types', standardClassName);
  });

  it('should read local test classes include', async () => {
    if (!hasConfig || !hasTestCase || !standardClassName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or standard class not found',
      );
      return;
    }

    logBuilderTestStep('read local test classes', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read local test classes',
      client
        .getLocalTestClass()
        .read({ className: standardClassName }, 'active'),
    );
    assertReadResult(state, 'local test classes', standardClassName);
  });

  it('should read local macros include (on-prem only)', async () => {
    if (!hasConfig || !hasTestCase || !standardClassName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or standard class not found',
      );
      return;
    }
    if (isCloudSystem) {
      testsLogger.warn?.(
        '⚠️ Skipping test: Local macros not supported on cloud',
      );
      return;
    }

    logBuilderTestStep('read local macros', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read local macros',
      client.getLocalMacros().read({ className: standardClassName }, 'active'),
    );
    if (!state) {
      testsLogger.warn?.('⚠️ Skipping test: Local macros include not available');
      return;
    }
    assertReadResult(state, 'local macros', standardClassName);
  });

  it('should read interface source', async () => {
    if (!hasConfig || !hasTestCase || !standardInterfaceName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or standard interface not found',
      );
      return;
    }

    logBuilderTestStep('read interface source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read interface source',
      client
        .getInterface()
        .read({ interfaceName: standardInterfaceName }, 'active'),
    );
    assertReadResult(state, 'interface source', standardInterfaceName);
  });

  it('should read program source', async () => {
    const programName =
      resolveStandardObject('program', isCloudSystem, testCase)?.name ||
      testCase?.params?.program_name ||
      null;
    if (!hasConfig || !hasTestCase || !programName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or program not configured',
      );
      return;
    }

    logBuilderTestStep('read program source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read program source',
      client.getProgram().read({ programName }, 'active'),
    );
    assertReadResult(state, 'program source', programName);
  });

  it('should read domain', async () => {
    const domainName =
      resolveStandardObject('domain', isCloudSystem, testCase)?.name ||
      testCase?.params?.domain_name ||
      null;
    if (!hasConfig || !hasTestCase || !domainName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or domain not configured',
      );
      return;
    }

    logBuilderTestStep('read domain', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read domain',
      client.getDomain().read({ domainName }),
    );
    assertReadResult(state, 'domain', domainName);
  });

  it('should read data element', async () => {
    const dataElementName =
      resolveStandardObject('dataElement', isCloudSystem, testCase)?.name ||
      testCase?.params?.data_element_name ||
      null;
    if (!hasConfig || !hasTestCase || !dataElementName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or data element not configured',
      );
      return;
    }

    logBuilderTestStep('read data element', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read data element',
      client.getDataElement().read({ dataElementName }),
    );
    assertReadResult(state, 'data element', dataElementName);
  });

  it('should read structure source', async () => {
    const structureName =
      resolveStandardObject('structure', isCloudSystem, testCase)?.name ||
      testCase?.params?.structure_name ||
      null;
    if (!hasConfig || !hasTestCase || !structureName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or structure not configured',
      );
      return;
    }

    logBuilderTestStep('read structure source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read structure source',
      client.getStructure().read({ structureName }, 'active'),
    );
    assertReadResult(state, 'structure source', structureName);
  });

  it('should read table source', async () => {
    const tableName =
      resolveStandardObject('table', isCloudSystem, testCase)?.name ||
      testCase?.params?.table_name ||
      null;
    if (!hasConfig || !hasTestCase || !tableName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or table not configured',
      );
      return;
    }

    logBuilderTestStep('read table source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read table source',
      client.getTable().read({ tableName }, 'active'),
    );
    assertReadResult(state, 'table source', tableName);
  });

  it('should read table type metadata', async () => {
    const tableTypeName =
      resolveStandardObject('tabletype', isCloudSystem, testCase)?.name ||
      testCase?.params?.tabletype_name ||
      null;
    if (!hasConfig || !hasTestCase || !tableTypeName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or table type not configured',
      );
      return;
    }

    logBuilderTestStep('read table type', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read table type',
      client.getTableType().read({ tableTypeName }),
    );
    assertReadResult(state, 'table type', tableTypeName);
  });

  it('should read view source', async () => {
    const viewName =
      resolveStandardObject('view', isCloudSystem, testCase)?.name ||
      testCase?.params?.view_name ||
      null;
    if (!hasConfig || !hasTestCase || !viewName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or view not configured',
      );
      return;
    }

    logBuilderTestStep('read view source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read view source',
      client.getView().read({ viewName }, 'active'),
    );
    assertReadResult(state, 'view source', viewName);
  });

  it('should read function group', async () => {
    const functionGroupName =
      resolveStandardObject('functionGroup', isCloudSystem, testCase)?.name ||
      testCase?.params?.function_group_name ||
      null;
    if (!hasConfig || !hasTestCase || !functionGroupName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or function group not configured',
      );
      return;
    }

    logBuilderTestStep('read function group', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read function group',
      client.getFunctionGroup().read({ functionGroupName }),
    );
    assertReadResult(state, 'function group', functionGroupName);
  });

  it('should read function module source', async () => {
    const functionModule =
      resolveStandardObject('functionModule', isCloudSystem, testCase) || null;
    const functionModuleName =
      testCase?.params?.function_module_name || functionModule?.name || null;
    const functionGroupName =
      testCase?.params?.function_group_name || functionModule?.group || null;
    if (
      !hasConfig ||
      !hasTestCase ||
      !functionModuleName ||
      !functionGroupName
    ) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or function module not configured',
      );
      return;
    }

    logBuilderTestStep('read function module', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read function module',
      client
        .getFunctionModule()
        .read({ functionModuleName, functionGroupName }, 'active'),
    );
    assertReadResult(state, 'function module', functionModuleName);
  });

  it('should read package', async () => {
    const packageName =
      resolveStandardObject('package', isCloudSystem, testCase)?.name ||
      testCase?.params?.package_name ||
      null;
    if (!hasConfig || !hasTestCase || !packageName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or package not configured',
      );
      return;
    }

    logBuilderTestStep('read package', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read package',
      client.getPackage().read({ packageName }),
    );
    assertReadResult(state, 'package', packageName);
  });

  it('should read service definition source', async () => {
    const serviceDefinitionName =
      resolveStandardObject('serviceDefinition', isCloudSystem, testCase)
        ?.name ||
      testCase?.params?.service_definition_name ||
      null;
    if (!hasConfig || !hasTestCase || !serviceDefinitionName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or service definition not configured',
      );
      return;
    }

    logBuilderTestStep('read service definition', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read service definition',
      client.getServiceDefinition().read({ serviceDefinitionName }, 'active'),
    );
    assertReadResult(state, 'service definition', serviceDefinitionName);
  });

  it('should read behavior definition source', async () => {
    const behaviorDefinitionName =
      testCase?.params?.behavior_definition_name ||
      testCase?.params?.behavior_definition ||
      null;
    if (!hasConfig || !hasTestCase || !behaviorDefinitionName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or behavior definition not configured',
      );
      return;
    }

    logBuilderTestStep('read behavior definition', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read behavior definition',
      client
        .getBehaviorDefinition()
        .read({ name: behaviorDefinitionName }, 'active'),
    );
    assertReadResult(state, 'behavior definition', behaviorDefinitionName);
  });

  it('should read behavior implementation source', async () => {
    const behaviorImplementationClassName =
      testCase?.params?.behavior_implementation_class_name || null;
    if (!hasConfig || !hasTestCase || !behaviorImplementationClassName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or behavior implementation not configured',
      );
      return;
    }

    logBuilderTestStep('read behavior implementation', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read behavior implementation',
      client
        .getBehaviorImplementation()
        .read({ className: behaviorImplementationClassName }, 'active'),
    );
    assertReadResult(
      state,
      'behavior implementation',
      behaviorImplementationClassName,
    );
  });

  it('should read metadata extension source', async () => {
    const metadataExtensionName =
      testCase?.params?.metadata_extension_name || null;
    if (!hasConfig || !hasTestCase || !metadataExtensionName) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or metadata extension not configured',
      );
      return;
    }

    logBuilderTestStep('read metadata extension', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read metadata extension',
      client
        .getMetadataExtension()
        .read({ name: metadataExtensionName }, 'active'),
    );
    assertReadResult(state, 'metadata extension', metadataExtensionName);
  });

  it('should read enhancement', async () => {
    const enhancementName = testCase?.params?.enhancement_name || null;
    const enhancementType = testCase?.params?.enhancement_type || null;
    if (!hasConfig || !hasTestCase || !enhancementName || !enhancementType) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No SAP configuration, read_accept not configured, or enhancement not configured',
      );
      return;
    }

    logBuilderTestStep('read enhancement', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read enhancement',
      client.getEnhancement().read(
        {
          enhancementName,
          enhancementType,
        },
        'active',
      ),
    );
    assertReadResult(state, 'enhancement', enhancementName);
  });
});
