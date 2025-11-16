/**
 * Unit test for Structure syntax checking
 * Tests checkStructure function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/check.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { checkStructure } from '../../../core/structure/check';
import { getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { generateSessionId } from '../../../utils/sessionUtils';
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

describe('Structure - Check', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_check', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
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

  async function ensureStructureExists(testCase: any) {
    const structureName = testCase.params.structure_name;

    try {
      await getStructureMetadata(connection, structureName);
      logger.debug(`Structure ${structureName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Structure ${structureName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_structure');
        if (createTestCase) {
          try {
            await createStructure(connection, {
              structure_name: structureName,
              description: createTestCase.params.description || `Test structure for ${structureName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              fields: createTestCase.params.fields || [
                {
                  name: 'FIELD1',
                  description: 'Test field 1',
                  data_type: 'CHAR',
                  length: 10
                }
              ]
            });
            logger.debug(`Structure ${structureName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create structure ${structureName}: create_structure test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should check structure syntax (active version)', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'check_structure');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureStructureExists(testCase);

    const sessionId = generateSessionId();
    const result = await checkStructure(
      connection,
      testCase.params.structure_name,
      'active',
      sessionId
    );
    expect(result.status).toBeGreaterThanOrEqual(200);
    expect(result.status).toBeLessThan(500);
  }, 30000);

  it('should check structure syntax (inactive version)', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('check_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'check_structure');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureStructureExists(testCase);

    const sessionId = generateSessionId();
    const result = await checkStructure(
      connection,
      testCase.params.structure_name,
      'inactive',
      sessionId
    );
    expect(result.status).toBeGreaterThanOrEqual(200);
    expect(result.status).toBeLessThan(500);
  }, 30000);
});

