/**
 * Unit test for Interface unlock operations
 * Tests unlockInterface function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/interface/unlock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { unlockInterface } from '../../../core/interface/unlock';
import { lockInterface } from '../../../core/interface/lock';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { createInterface } from '../../../core/interface/create';
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
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Interface - Unlock', () => {
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

  async function ensureInterfaceExists(testCase: any) {
    const interfaceName = testCase.params.interface_name;

    try {
      await getInterfaceMetadata(connection, interfaceName);
      logger.debug(`Interface ${interfaceName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${interfaceName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_interface');
        if (createTestCase) {
          try {
            await createInterface(connection, {
              interface_name: interfaceName,
              description: createTestCase.params.description || `Test interface for ${interfaceName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              source_code: createTestCase.params.source_code
            });
            logger.debug(`Interface ${interfaceName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create interface ${interfaceName}: create_interface test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should unlock interface', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('unlock_interface');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'unlock_interface');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureInterfaceExists(testCase);

    const sessionId = generateSessionId();

    // Lock interface first
    const lockResult = await lockInterface(
      connection,
      testCase.params.interface_name,
      sessionId
    );
    const lockHandle = lockResult.lockHandle;

    // Unlock interface
    const result = await unlockInterface(
      connection,
      testCase.params.interface_name,
      lockHandle,
      sessionId
    );
    expect(result.status).toBeGreaterThanOrEqual(200);
    expect(result.status).toBeLessThan(500);
  }, 30000);
});

