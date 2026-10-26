/**
 * Integration test for read methods (Accept headers)
 * Ensures read endpoints return 2xx (406 should fail)
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/readAccept.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { configuredCase, gate, gateAll, gateOn } from '../../helpers/caseGate';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const {
  resolveStandardObject,
  withAcceptHandling,
  getAcceptHint,
} = require('../../helpers/test-helper');

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

/**
 * The answer, or a failure naming what SAP said.
 *
 * Not a status. ADT answers a refusal inside a 200, so `status === 200` passed
 * whether or not the read worked; and these read the state bag's `readResult`,
 * which no longer exists — every one of them threw "no response for …" on the
 * first run after the migration. The contract is the verdict now, and the
 * document is what a read is for.
 */
function assertAnswered(answer: unknown, label: string, name: string): void {
  const contract = answer as IAdtResponse<unknown> | undefined;
  if (!contract || typeof contract.ok !== 'boolean') {
    throw new Error(`Read ${label} failed: no answer for ${name}`);
  }
  if (!contract.ok) {
    throw new Error(
      `Read ${label} failed for ${name} [${contract.getError().origin}]: ` +
        contract.getError().message,
    );
  }
  const value = contract.getResult().value;
  if (typeof value !== 'string') {
    throw new Error(
      `Read ${label} for ${name} answered ${typeof value}, not a document`,
    );
  }
}

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

const assertReadResult = assertAnswered;
const assertMetadataResult = assertAnswered;

async function runReadMetadataWithAcceptLogging<T>(
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

/** What a test needs of the system and of the `read_accept` case. */
type Need = (system: { isCloud: boolean }, testCase: any) => boolean;

/** A standard object of this type for the system, by name. */
const standard =
  (objectType: string): Need =>
  ({ isCloud }, testCase) =>
    !!resolveStandardObject(objectType, isCloud, testCase)?.name;

/** A parameter of the case, under the first of these keys that is set. */
const param =
  (...keys: string[]): Need =>
  (_system, testCase) =>
    keys.some((key) => !!testCase?.params?.[key]);

const noCloud: Need = ({ isCloud }) => !isCloud;

/** The module and its group, from the case or from the standard object. */
const functionModuleConfigured: Need = ({ isCloud }, testCase) => {
  const functionModule = resolveStandardObject(
    'functionModule',
    isCloud,
    testCase,
  );
  return (
    !!(testCase?.params?.function_module_name || functionModule?.name) &&
    !!(testCase?.params?.function_group_name || functionModule?.group)
  );
};

/** Applies where `read_accept` is on and every need is met. */
function acceptCase(...needs: Need[]): jest.It {
  return gateAll(
    gate('read_accept', 'read_accept'),
    gateOn((system) => {
      const testCase = configuredCase('read_accept', 'read_accept');
      return needs.every((need) => need(system, testCase));
    }),
  );
}

describe('Shared - read Accept headers', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isCloudSystem = false;
  let standardClassName: string | null = null;
  let standardInterfaceName: string | null = null;
  let testCase: any | null = null;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;

      testCase = configuredCase('read_accept', 'read_accept');

      standardClassName =
        resolveStandardObject('class', isCloudSystem, testCase)?.name || null;
      standardInterfaceName =
        resolveStandardObject('interface', isCloudSystem, testCase)?.name ||
        null;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  /**
   * Say which precondition is actually absent.
   *
   * Every guard below used to print one sentence naming all three causes joined
   * by "or", so a skip told you only that one of them applied. That is how a
   * config drift stays hidden: the message implicates the requirements that are
   * present alongside the one that is not.
   *
   * Requirements are passed as named entries rather than positionally, because
   * the first version of this helper took values and reported only the label —
   * which reproduced the same ambiguity for the two guards that check more than
   * one thing: an absent `function_group_name` was reported as "function module
   * not configured".
   *
   * Where a value has one config key, the key is the name. Where it may come
   * from either `standard_objects` or `params`, the name is the object in
   * prose — naming one of the two sources would be a different half-truth.
   *
   * The caller keeps its own `if` — moving the condition in here reads better
   * and costs more than it is worth, because TypeScript stops narrowing the
   * `string | null` names once the test lives behind a function call.
   */
  const missingConfiguration = (
    requirements: Record<string, string | null | undefined>,
  ): string => {
    const missing = Object.keys(requirements).filter(
      (name) => !requirements[name],
    );
    return missing.length > 0
      ? `missing configuration: ${missing.join(', ')}`
      : 'unknown reason';
  };

  acceptCase(standard('class'))('should read class source', async () => {
    if (!standardClassName) {
      throw new Error(
        missingConfiguration({ 'standard class': standardClassName }),
      );
    }

    logTestStep('read class source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read class source',
      client.getClass().read({ className: standardClassName }, 'active', {
        analyse: analyseException,
      }),
    );
    assertReadResult(state, 'class source', standardClassName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read class metadata',
      client
        .getClass()
        .readMetadata(
          { className: standardClassName },
          { analyse: analyseException },
        ),
    );
    assertMetadataResult(metadataState, 'class metadata', standardClassName);
  });

  acceptCase(standard('class'))(
    'should read local definitions include',
    async () => {
      if (!standardClassName) {
        throw new Error(
          missingConfiguration({ 'standard class': standardClassName }),
        );
      }

      logTestStep('read local definitions', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read local definitions',
        client
          .getLocalDefinitions()
          .read({ className: standardClassName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'local definitions', standardClassName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read local definitions metadata',
        client
          .getLocalDefinitions()
          .readMetadata(
            { className: standardClassName },
            { analyse: analyseException },
          ),
      );
      assertMetadataResult(
        metadataState,
        'local definitions metadata',
        standardClassName,
      );
    },
  );

  acceptCase(standard('class'))('should read local types include', async () => {
    if (!standardClassName) {
      throw new Error(
        missingConfiguration({ 'standard class': standardClassName }),
      );
    }

    logTestStep('read local types', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read local types',
      client.getLocalTypes().read({ className: standardClassName }, 'active', {
        analyse: analyseException,
      }),
    );
    assertReadResult(state, 'local types', standardClassName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read local types metadata',
      client
        .getLocalTypes()
        .readMetadata(
          { className: standardClassName },
          { analyse: analyseException },
        ),
    );
    assertMetadataResult(
      metadataState,
      'local types metadata',
      standardClassName,
    );
  });

  acceptCase(noCloud, standard('class'))(
    'should read local test classes include',
    async () => {
      if (!standardClassName) {
        throw new Error(
          missingConfiguration({ 'standard class': standardClassName }),
        );
      }

      logTestStep('read local test classes', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read local test classes',
        client
          .getLocalTestClass()
          .read({ className: standardClassName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'local test classes', standardClassName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read local test classes metadata',
        client
          .getLocalTestClass()
          .readMetadata(
            { className: standardClassName },
            { analyse: analyseException },
          ),
      );
      assertMetadataResult(
        metadataState,
        'local test classes metadata',
        standardClassName,
      );
    },
  );

  acceptCase(noCloud, standard('class'))(
    'should read local macros include (on-prem only)',
    async () => {
      if (!standardClassName) {
        throw new Error(
          missingConfiguration({ 'standard class': standardClassName }),
        );
      }

      logTestStep('read local macros', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read local macros',
        client
          .getLocalMacros()
          .read({ className: standardClassName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'local macros', standardClassName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read local macros metadata',
        client
          .getLocalMacros()
          .readMetadata(
            { className: standardClassName },
            { analyse: analyseException },
          ),
      );
      assertMetadataResult(
        metadataState,
        'local macros metadata',
        standardClassName,
      );
    },
  );

  acceptCase(standard('interface'))(
    'should read interface source',
    async () => {
      if (!standardInterfaceName) {
        throw new Error(
          missingConfiguration({ 'standard interface': standardInterfaceName }),
        );
      }

      logTestStep('read interface source', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read interface source',
        client
          .getInterface()
          .read({ interfaceName: standardInterfaceName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'interface source', standardInterfaceName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read interface metadata',
        client.getInterface().readMetadata(
          {
            interfaceName: standardInterfaceName,
          },
          { analyse: analyseException },
        ),
      );
      assertMetadataResult(
        metadataState,
        'interface metadata',
        standardInterfaceName,
      );
    },
  );

  acceptCase(standard('program'))('should read program source', async () => {
    const programName =
      resolveStandardObject('program', isCloudSystem, testCase)?.name ||
      testCase?.params?.program_name ||
      null;
    if (!programName) {
      throw new Error(missingConfiguration({ program: programName }));
    }

    logTestStep('read program source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read program source',
      client
        .getProgram()
        .read({ programName }, 'active', { analyse: analyseException }),
    );
    assertReadResult(state, 'program source', programName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read program metadata',
      client
        .getProgram()
        .readMetadata({ programName }, { analyse: analyseException }),
    );
    assertMetadataResult(metadataState, 'program metadata', programName);
  });

  acceptCase(standard('domain'))('should read domain', async () => {
    const domainName =
      resolveStandardObject('domain', isCloudSystem, testCase)?.name ||
      testCase?.params?.domain_name ||
      null;
    if (!domainName) {
      throw new Error(missingConfiguration({ domain: domainName }));
    }

    logTestStep('read domain', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read domain',
      client
        .getDomain()
        .readMetadata({ domainName }, { analyse: analyseException }),
    );
    assertReadResult(state, 'domain', domainName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read domain metadata',
      client
        .getDomain()
        .readMetadata({ domainName }, { analyse: analyseException }),
    );
    assertMetadataResult(metadataState, 'domain metadata', domainName);
  });

  acceptCase(standard('dataElement'))('should read data element', async () => {
    const dataElementName =
      resolveStandardObject('dataElement', isCloudSystem, testCase)?.name ||
      testCase?.params?.data_element_name ||
      null;
    if (!dataElementName) {
      throw new Error(
        missingConfiguration({ 'data element': dataElementName }),
      );
    }

    logTestStep('read data element', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read data element',
      client
        .getDataElement()
        .readMetadata({ dataElementName }, { analyse: analyseException }),
    );
    assertReadResult(state, 'data element', dataElementName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read data element metadata',
      client
        .getDataElement()
        .readMetadata({ dataElementName }, { analyse: analyseException }),
    );
    assertMetadataResult(
      metadataState,
      'data element metadata',
      dataElementName,
    );
  });

  acceptCase(standard('structure'))(
    'should read structure source',
    async () => {
      const structureName =
        resolveStandardObject('structure', isCloudSystem, testCase)?.name ||
        testCase?.params?.structure_name ||
        null;
      if (!structureName) {
        throw new Error(missingConfiguration({ structure: structureName }));
      }

      logTestStep('read structure source', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read structure source',
        client
          .getStructure()
          .read({ structureName }, 'active', { analyse: analyseException }),
      );
      assertReadResult(state, 'structure source', structureName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read structure metadata',
        client
          .getStructure()
          .readMetadata({ structureName }, { analyse: analyseException }),
      );
      assertMetadataResult(metadataState, 'structure metadata', structureName);
    },
  );

  acceptCase(standard('table'))('should read table source', async () => {
    const tableName =
      resolveStandardObject('table', isCloudSystem, testCase)?.name ||
      testCase?.params?.table_name ||
      null;
    if (!tableName) {
      throw new Error(missingConfiguration({ table: tableName }));
    }

    logTestStep('read table source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read table source',
      client
        .getTable()
        .read({ tableName }, 'active', { analyse: analyseException }),
    );
    assertReadResult(state, 'table source', tableName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read table metadata',
      client
        .getTable()
        .readMetadata({ tableName }, { analyse: analyseException }),
    );
    assertMetadataResult(metadataState, 'table metadata', tableName);
  });

  acceptCase(standard('tabletype'))(
    'should read table type metadata',
    async () => {
      const tableTypeName =
        resolveStandardObject('tabletype', isCloudSystem, testCase)?.name ||
        testCase?.params?.tabletype_name ||
        null;
      if (!tableTypeName) {
        throw new Error(missingConfiguration({ 'table type': tableTypeName }));
      }

      logTestStep('read table type', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read table type',
        client
          .getTableType()
          .readMetadata({ tableTypeName }, { analyse: analyseException }),
      );
      assertReadResult(state, 'table type', tableTypeName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read table type metadata',
        client
          .getTableType()
          .readMetadata({ tableTypeName }, { analyse: analyseException }),
      );
      assertMetadataResult(metadataState, 'table type metadata', tableTypeName);
    },
  );

  acceptCase(standard('view'))('should read view source', async () => {
    const ddlName =
      resolveStandardObject('view', isCloudSystem, testCase)?.name ||
      testCase?.params?.ddl_name ||
      null;
    if (!ddlName) {
      throw new Error(missingConfiguration({ view: ddlName }));
    }

    logTestStep('read view source', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read view source',
      client
        .getDdl()
        .read({ ddlName }, 'active', { analyse: analyseException }),
    );
    assertReadResult(state, 'view source', ddlName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read view metadata',
      client.getDdl().readMetadata({ ddlName }, { analyse: analyseException }),
    );
    assertMetadataResult(metadataState, 'view metadata', ddlName);
  });

  acceptCase(standard('functionGroup'))(
    'should read function group',
    async () => {
      const functionGroupName =
        resolveStandardObject('functionGroup', isCloudSystem, testCase)?.name ||
        testCase?.params?.function_group_name ||
        null;
      if (!functionGroupName) {
        throw new Error(
          missingConfiguration({ 'function group': functionGroupName }),
        );
      }

      logTestStep('read function group', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read function group',
        client
          .getFunctionGroup()
          .readMetadata({ functionGroupName }, { analyse: analyseException }),
      );
      assertReadResult(state, 'function group', functionGroupName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read function group metadata',
        client
          .getFunctionGroup()
          .readMetadata({ functionGroupName }, { analyse: analyseException }),
      );
      assertMetadataResult(
        metadataState,
        'function group metadata',
        functionGroupName,
      );
    },
  );

  acceptCase(functionModuleConfigured)(
    'should read function module source',
    async () => {
      const functionModule =
        resolveStandardObject('functionModule', isCloudSystem, testCase) ||
        null;
      const functionModuleName =
        testCase?.params?.function_module_name || functionModule?.name || null;
      const functionGroupName =
        testCase?.params?.function_group_name || functionModule?.group || null;
      if (!functionModuleName || !functionGroupName) {
        throw new Error(
          missingConfiguration({
            function_module_name: functionModuleName,
            function_group_name: functionGroupName,
          }),
        );
      }

      logTestStep('read function module', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read function module',
        client
          .getFunctionModule()
          .read({ functionModuleName, functionGroupName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'function module', functionModuleName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read function module metadata',
        client.getFunctionModule().readMetadata(
          {
            functionModuleName,
            functionGroupName,
          },
          { analyse: analyseException },
        ),
      );
      assertMetadataResult(
        metadataState,
        'function module metadata',
        functionModuleName,
      );
    },
  );

  acceptCase(standard('package'))('should read package', async () => {
    const packageName =
      resolveStandardObject('package', isCloudSystem, testCase)?.name ||
      testCase?.params?.package_name ||
      null;
    if (!packageName) {
      throw new Error(missingConfiguration({ package: packageName }));
    }

    logTestStep('read package', testsLogger);
    const state = await runReadWithAcceptLogging(
      'read package',
      client
        .getPackage()
        .readMetadata({ packageName }, { analyse: analyseException }),
    );
    assertReadResult(state, 'package', packageName);

    const metadataState = await runReadMetadataWithAcceptLogging(
      'read package metadata',
      client
        .getPackage()
        .readMetadata({ packageName }, { analyse: analyseException }),
    );
    assertMetadataResult(metadataState, 'package metadata', packageName);
  });

  acceptCase(standard('serviceDefinition'))(
    'should read service definition source',
    async () => {
      const serviceDefinitionName =
        resolveStandardObject('serviceDefinition', isCloudSystem, testCase)
          ?.name ||
        testCase?.params?.service_definition_name ||
        null;
      if (!serviceDefinitionName) {
        throw new Error(
          missingConfiguration({ 'service definition': serviceDefinitionName }),
        );
      }

      logTestStep('read service definition', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read service definition',
        client
          .getServiceDefinition()
          .read({ serviceDefinitionName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'service definition', serviceDefinitionName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read service definition metadata',
        client
          .getServiceDefinition()
          .readMetadata(
            { serviceDefinitionName },
            { analyse: analyseException },
          ),
      );
      assertMetadataResult(
        metadataState,
        'service definition metadata',
        serviceDefinitionName,
      );
    },
  );

  acceptCase(param('behavior_definition_name', 'behavior_definition'))(
    'should read behavior definition source',
    async () => {
      const behaviorDefinitionName =
        testCase?.params?.behavior_definition_name ||
        testCase?.params?.behavior_definition ||
        null;
      if (!behaviorDefinitionName) {
        throw new Error(
          missingConfiguration({
            'behavior definition': behaviorDefinitionName,
          }),
        );
      }

      logTestStep('read behavior definition', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read behavior definition',
        client
          .getBehaviorDefinition()
          .read({ name: behaviorDefinitionName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'behavior definition', behaviorDefinitionName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read behavior definition metadata',
        client
          .getBehaviorDefinition()
          .readMetadata(
            { name: behaviorDefinitionName },
            { analyse: analyseException },
          ),
      );
      assertMetadataResult(
        metadataState,
        'behavior definition metadata',
        behaviorDefinitionName,
      );
    },
  );

  acceptCase(param('behavior_implementation_class_name'))(
    'should read behavior implementation source',
    async () => {
      const behaviorImplementationClassName =
        testCase?.params?.behavior_implementation_class_name || null;
      if (!behaviorImplementationClassName) {
        throw new Error(
          missingConfiguration({
            'behavior implementation': behaviorImplementationClassName,
          }),
        );
      }

      logTestStep('read behavior implementation', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read behavior implementation',
        client
          .getBehaviorImplementation()
          .read({ className: behaviorImplementationClassName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(
        state,
        'behavior implementation',
        behaviorImplementationClassName,
      );

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read behavior implementation metadata',
        client.getBehaviorImplementation().readMetadata(
          {
            className: behaviorImplementationClassName,
          },
          { analyse: analyseException },
        ),
      );
      assertMetadataResult(
        metadataState,
        'behavior implementation metadata',
        behaviorImplementationClassName,
      );
    },
  );

  acceptCase(param('metadata_extension_name'))(
    'should read metadata extension source',
    async () => {
      const metadataExtensionName =
        testCase?.params?.metadata_extension_name || null;
      if (!metadataExtensionName) {
        throw new Error(
          missingConfiguration({ 'metadata extension': metadataExtensionName }),
        );
      }

      logTestStep('read metadata extension', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read metadata extension',
        client
          .getMetadataExtension()
          .read({ name: metadataExtensionName }, 'active', {
            analyse: analyseException,
          }),
      );
      assertReadResult(state, 'metadata extension', metadataExtensionName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read metadata extension metadata',
        client.getMetadataExtension().readMetadata(
          {
            name: metadataExtensionName,
          },
          { analyse: analyseException },
        ),
      );
      assertMetadataResult(
        metadataState,
        'metadata extension metadata',
        metadataExtensionName,
      );
    },
  );

  acceptCase(param('enhancement_name'), param('enhancement_type'))(
    'should read enhancement',
    async () => {
      const enhancementName = testCase?.params?.enhancement_name || null;
      const enhancementType = testCase?.params?.enhancement_type || null;
      if (!enhancementName || !enhancementType) {
        throw new Error(
          missingConfiguration({
            enhancement_name: enhancementName,
            enhancement_type: enhancementType,
          }),
        );
      }

      logTestStep('read enhancement', testsLogger);
      const state = await runReadWithAcceptLogging(
        'read enhancement',
        client.getEnhancement().read(
          {
            enhancementName,
            enhancementType,
          },
          'active',
          { analyse: analyseException },
        ),
      );
      assertReadResult(state, 'enhancement', enhancementName);

      const metadataState = await runReadMetadataWithAcceptLogging(
        'read enhancement metadata',
        client.getEnhancement().readMetadata(
          {
            enhancementName,
            enhancementType,
          },
          { analyse: analyseException },
        ),
      );
      assertMetadataResult(
        metadataState,
        'enhancement metadata',
        enhancementName,
      );
    },
  );
});
