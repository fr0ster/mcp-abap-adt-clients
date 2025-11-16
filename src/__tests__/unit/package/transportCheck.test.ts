/**
 * Unit test for Package transport check
 * Tests checkTransportRequirements function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/transportCheck.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { checkTransportRequirements } from '../../../core/package/transportCheck';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');


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
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_transportCheck', __filename);
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

