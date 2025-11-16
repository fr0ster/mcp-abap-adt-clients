/**
 * Unit test for Structure update
 * Tests updateStructure function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/update.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { updateStructure } from '../../../core/structure/update';
import { getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { lockStructure } from '../../../core/structure/lock';
import { unlockStructure } from '../../../core/structure/unlock';
import { generateSessionId } from '../../../utils/sessionUtils';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Structure - Update', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
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
              fields: createTestCase.params.fields
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

  it('should update structure', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'update_structure');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureStructureExists(testCase);

    const sessionId = generateSessionId();
    const lockHandle = await lockStructure(connection, testCase.params.structure_name, sessionId);

    try {
      await updateStructure(connection, {
        structure_name: testCase.params.structure_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        fields: testCase.params.fields
      }, lockHandle, sessionId);

      // Verify update by reading
      const result = await getStructureMetadata(connection, testCase.params.structure_name);
      expect(result.status).toBe(200);
    } finally {
      // Unlock after test
      try {
        await unlockStructure(connection, testCase.params.structure_name, lockHandle, sessionId);
      } catch (error) {
        // Ignore unlock errors
      }
    }
  }, 60000);
});

