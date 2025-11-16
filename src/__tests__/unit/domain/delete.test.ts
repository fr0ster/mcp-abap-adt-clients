/**
 * Unit test for Domain deletion
 * Tests deleteDomain function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/domain/delete.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { deleteDomain } from '../../../core/domain/delete';
import { getDomain } from '../../../core/domain/read';
import { createDomain } from '../../../core/domain/create';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

describe('Domain - Delete', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure object exists before test (idempotency)
  async function ensureDomainExists(testCase: any) {
    const domainName = testCase.params.domain_name || testCase.params.object_name;
    if (!domainName) {
      throw new Error('domain_name or object_name is required in test case');
    }
    try {
      await getDomain(connection, domainName);
      logger.debug(`Domain ${domainName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Domain ${domainName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_domain', 'test_domain');
        if (createTestCase) {
          await createDomain(connection, {
            domain_name: domainName,
            description: testCase.params.description || `Test domain for ${domainName}`,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
            transport_request: createTestCase.params.transport_request || getDefaultTransport(),
            datatype: createTestCase.params.datatype || 'CHAR',
            length: createTestCase.params.length || 10,
            decimals: createTestCase.params.decimals,
            lowercase: createTestCase.params.lowercase,
            sign_exists: createTestCase.params.sign_exists,
          });
          logger.debug(`Domain ${domainName} created successfully`);
        } else {
          throw new Error(`Cannot create domain ${domainName}: create_domain test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should delete domain', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('delete_domain');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure domain exists before test (idempotency)
    await ensureDomainExists(testCase);

    const domainName = testCase.params.domain_name || testCase.params.object_name;

    await deleteDomain(connection, {
      domain_name: domainName,
      transport_request: testCase.params.transport_request || getDefaultTransport(),
    });
    logger.debug(`✅ Deleted domain: ${domainName}`);
  }, 10000);
});

