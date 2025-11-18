/**
 * Integration test for Interface update
 * Tests updateInterfaceSource function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/interface/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateInterfaceSource } from '../../../core/interface/update';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { createInterface } from '../../../core/interface/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Interface - Update';
const logger = createTestLogger('INTF-UPDATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let interfaceName: string | null = null;

  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    await (connection as any).connect();
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(async () => {
    testCase = null;
    interfaceName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'interface_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_interface');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    interfaceName = tc.params.interface_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureInterfaceExists(testCase: any): Promise<void> {
    const intfName = testCase.params.interface_name;

    try {
      await getInterfaceMetadata(connection, intfName);
      logger.debug(`Interface ${intfName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${intfName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_interface', 'test_interface');
        if (!createTestCase) {
          throw new Error(`Cannot create interface ${intfName}: create_interface test case not found`);
        }

        const sourceCode = createTestCase.params.source_code || `INTERFACE ${intfName}
  PUBLIC.

  METHODS: get_value
    RETURNING VALUE(rv_result) TYPE string.

ENDINTERFACE.`;

        await createInterface(connection, {
          interface_name: intfName,
          description: `Test interface for ${intfName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: sourceCode
        });
        logger.debug(`Interface ${intfName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update interface source code', async () => {
    if (!testCase || !interfaceName) {
      logger.skip('Update Test', testCase ? 'Interface name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for interface: ${interfaceName}`);

    try {
      await ensureInterfaceExists(testCase);

      const updatedSourceCode = testCase.params.source_code || `INTERFACE ${interfaceName}
  PUBLIC.

  METHODS: get_value
    RETURNING VALUE(rv_result) TYPE string,
    set_value
      IMPORTING VALUE(iv_value) TYPE string.

ENDINTERFACE.`;

      const result = await updateInterfaceSource(connection, {
        interface_name: interfaceName,
        source_code: updatedSourceCode,
        activate: false
      });
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Interface ${interfaceName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update interface: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
