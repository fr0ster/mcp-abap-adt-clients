/**
 * Unit test for Package transport check
 * Tests checkTransportRequirements function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/transportCheck.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { checkTransportRequirements } from '../../../core/package/transportCheck';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

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

describe('Package - Transport Check', () => {
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

  it('should check transport requirements', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('transport_check_package');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'transport_check_package');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    const transportLayer = testCase.params.transport_layer || '';
    if (!transportLayer) {
      logger.warn('⚠️ Skipping test: transport_layer not provided');
      return;
    }

    const transportNumbers = await checkTransportRequirements(connection, {
      package_name: testCase.params.package_name,
      description: testCase.params.description || `Test package for ${testCase.params.package_name}`,
      package_type: testCase.params.package_type || 'development',
      super_package: testCase.params.super_package
    }, transportLayer);

    expect(Array.isArray(transportNumbers)).toBe(true);
  }, 30000);
});

