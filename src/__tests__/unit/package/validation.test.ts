/**
 * Unit test for Package validation
 * Tests validatePackageBasic and validatePackageFull functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/package/validation.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { validatePackageBasic, validatePackageFull } from '../../../core/package/validation';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Package - Validation', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_validation', __filename);
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

  it('should validate package basic', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('validate_package');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'validate_package');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await validatePackageBasic(connection, {
      package_name: testCase.params.package_name,
      description: testCase.params.description || `Test package for ${testCase.params.package_name}`,
      package_type: testCase.params.package_type || 'development',
      super_package: testCase.params.super_package
    });
    // validatePackageBasic doesn't return a value, so we just verify it doesn't throw
    expect(true).toBe(true);
  }, 30000);

  it('should validate package full', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('validate_package');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'validate_package');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Full validation requires software component and transport layer
    // These are typically system-specific, so we may need to skip if not available
    const swcomp = testCase.params.software_component || 'HOME';
    const transportLayer = testCase.params.transport_layer || '';

    if (!transportLayer) {
      logger.warn('⚠️ Skipping full validation: transport_layer not provided');
      return;
    }

    await validatePackageFull(connection, {
      package_name: testCase.params.package_name,
      description: testCase.params.description || `Test package for ${testCase.params.package_name}`,
      package_type: testCase.params.package_type || 'development',
      super_package: testCase.params.super_package
    }, swcomp, transportLayer);
    // validatePackageFull doesn't return a value, so we just verify it doesn't throw
    expect(true).toBe(true);
  }, 30000);
});

