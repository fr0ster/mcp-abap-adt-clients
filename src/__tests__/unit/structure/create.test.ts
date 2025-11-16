/**
 * Unit test for Structure creation
 * Tests createStructure function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/create.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createStructure } from '../../../core/structure/create';
import { getStructureMetadata } from '../../../core/structure/read';
import { deleteStructure } from '../../../core/structure/delete';
import { getConfig } from '../../helpers/sessionConfig';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

if (fs.existsSync(envPath)) {
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Structure - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_create', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      await (connection as any).connect();
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
  });

  async function ensureStructureDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      return false;
    }
    try {
      await getStructureMetadata(connection, testCase.params.structure_name);
      logger.debug(`Structure ${testCase.params.structure_name} exists, attempting to delete...`);
      try {
        await deleteStructure(connection, { structure_name: testCase.params.structure_name });
        logger.debug(`Structure ${testCase.params.structure_name} deleted successfully`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch (deleteError: any) {
        logger.warn(`Failed to delete structure ${testCase.params.structure_name}: ${deleteError.message}`);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        logger.debug(`Structure ${testCase.params.structure_name} does not exist`);
        return true;
      }
      throw error;
    }
  }

  it('should create basic structure', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_structure');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    const canProceed = await ensureStructureDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure structure ${testCase.params.structure_name} does not exist`);
      return;
    }

    await createStructure(connection, {
      structure_name: testCase.params.structure_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name || getDefaultPackage(),
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      fields: testCase.params.fields
    });

    const result = await getStructureMetadata(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
  }, 60000);
});

