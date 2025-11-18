/**
 * Integration test for Structure creation
 * Tests createStructure function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/structure/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createStructure } from '../../../core/structure/create';
import { getStructureMetadata } from '../../../core/structure/read';
import { deleteObject } from '../../../core/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Structure - Create';
const logger = createTestLogger('STRUCT-CREATE');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let structureName: string | null = null;

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
    structureName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'structure_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_structure');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_structure');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    structureName = tc.params.structure_name;

    // Delete if exists (idempotency)
    if (structureName) {
      await deleteIfExists(structureName);
    }
  });

  afterEach(async () => {
    // Cleanup created structure
    if (structureName) {
      await deleteIgnoringErrors(structureName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getStructureMetadata(connection, name);
      logger.debug(`Structure ${name} exists, deleting...`);
      await deleteObject(connection, {
        object_name: name,
        object_type: 'TABL/DS'
      });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Structure ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Structure ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteObject(connection, {
        object_name: name,
        object_type: 'TABL/DS'
      });
      logger.debug(`Cleanup: deleted structure ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete structure ${name} (${error.message})`);
    }
  }

  it('should create basic structure', async () => {
    if (!testCase || !structureName) {
      logger.skip('Create Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for structure: ${structureName}`);

    try {
      const result = await createStructure(connection, {
        structure_name: testCase.params.structure_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        fields: testCase.params.fields || []
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Structure ${structureName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify structure exists
      const getResult = await getStructureMetadata(connection, structureName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ Structure ${structureName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create structure: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
