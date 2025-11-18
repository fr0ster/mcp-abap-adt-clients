/**
 * Integration test for Interface creation
 * Tests createInterface function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/interface/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createInterface } from '../../../core/interface/create';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Interface - Create';
const logger = createTestLogger('INTF-CREATE');

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

    const env = await setupTestEnvironment(connection, 'interface_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_interface');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_interface');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    interfaceName = tc.params.interface_name;

    // Delete if exists (idempotency)
    if (interfaceName) {
      await deleteIfExists(interfaceName);
    }
  });

  afterEach(async () => {
    // Cleanup created interface
    if (interfaceName) {
      await deleteIgnoringErrors(interfaceName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getInterfaceMetadata(connection, name);
      logger.debug(`Interface ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'INTF/OI'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Interface ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'INTF/OI'
      });
      logger.debug(`Cleanup: deleted interface ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete interface ${name} (${error.message})`);
    }
  }

  it('should create basic interface', async () => {
    if (!testCase || !interfaceName) {
      logger.skip('Create Test', testCase ? 'Interface name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for interface: ${interfaceName}`);

    try {
      const result = await createInterface(connection, {
        interface_name: testCase.params.interface_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport()
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Interface ${interfaceName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify interface exists
      const getResult = await getInterfaceMetadata(connection, interfaceName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ Interface ${interfaceName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create interface: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
