/**
 * Unit test for View unlocking
 * Tests unlockDDLS function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/view/unlock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockDDLS } from '../../../core/view/lock';
import { unlockDDLS } from '../../../core/view/unlock';
import { getViewMetadata } from '../../../core/view/read';
import { createView } from '../../../core/view/create';
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

describe('View - Unlock', () => {
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

  async function ensureViewExists(testCase: any) {
    const viewName = testCase.params.view_name;

    try {
      await getViewMetadata(connection, viewName);
      logger.debug(`View ${viewName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${viewName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_view');
        if (createTestCase) {
          try {
            await createView(connection, {
              view_name: viewName,
              description: createTestCase.params.description || `Test view for ${viewName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              ddl_source: createTestCase.params.ddl_source
            });
            logger.debug(`View ${viewName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create view ${viewName}: create_view test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should unlock view', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('unlock_view');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'unlock_view');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureViewExists(testCase);

    const sessionId = generateSessionId();

    // First lock the view to get a lock handle
    const lockHandle = await lockDDLS(
      connection,
      testCase.params.view_name,
      sessionId
    );

    expect(lockHandle).toBeDefined();

    // Now unlock it
    const response = await unlockDDLS(
      connection,
      testCase.params.view_name,
      lockHandle,
      sessionId
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  }, 30000);
});

