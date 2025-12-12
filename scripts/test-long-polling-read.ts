/**
 * Test script to verify if withLongPolling=true works for read operations
 * 
 * This script tests if we can use ?withLongPolling=true parameter in read requests
 * to wait for object to become available after creation/activation operations.
 * 
 * Usage:
 *   npm run test:long-polling-read
 *   or
 *   npx ts-node scripts/test-long-polling-read.ts
 * 
 * Environment variables:
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../src/clients/AdtClient';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../src/__tests__/helpers/testLogger';

// Import test helpers
const testHelper = require('../src/__tests__/helpers/test-helper');
const resolvePackageName = testHelper.resolvePackageName;
const ensurePackageConfig = testHelper.ensurePackageConfig;
const getTestCaseDefinition = testHelper.getTestCaseDefinition;
const getEnabledTestCase = testHelper.getEnabledTestCase;

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const builderLogger = createBuilderLogger();
const testsLogger = createTestsLogger();

async function testLongPollingRead() {
  try {
    console.log('🔍 Testing withLongPolling=true for read operations...\n');

    const config = getConfig();
    
    // Get package name from YAML test config (same as in tests)
    const testCase = getEnabledTestCase('create_domain', 'adt_domain');
    if (!testCase) {
      console.error('❌ Test case not found or disabled in test-config.yaml');
      console.error('Please enable create_domain test case in test-config.yaml');
      process.exit(1);
    }
    
    const packageCheck = ensurePackageConfig(testCase.params || {}, 'Long polling read test');
    if (!packageCheck.success) {
      console.error(`❌ ${packageCheck.reason || 'Package name is not configured'}`);
      console.error('Please set package_name in test-config.yaml or environment.default_package');
      process.exit(1);
    }
    
    const packageName = resolvePackageName(testCase.params?.package_name);
    if (!packageName) {
      console.error('❌ Package name is not configured');
      console.error('Please set package_name in test-config.yaml or environment.default_package');
      process.exit(1);
    }
    
    console.log(`  Using package from YAML: ${packageName}`);

    const connection = createAbapConnection(config, connectionLogger);
    await (connection as any).connect();
    const client = new AdtClient(connection, builderLogger);

    // Test 1: Create a domain and immediately try to read it with long polling
    console.log('Test 1: Create domain and read with long polling');
    // Domain name max 30 chars, use timestamp suffix (13 digits) -> Z_TEST_LP_ + timestamp = 30 chars
    const timestamp = Date.now().toString().slice(-13); // Last 13 digits
    const testDomainName = `Z_TEST_LP_${timestamp}`;
    
    try {
      // Create domain
      console.log(`  Creating domain: ${testDomainName}`);
      console.log(`  Using package: ${packageName}`);
      const createStartTime = Date.now();
      await client.getDomain().create({
        domainName: testDomainName,
        packageName: packageName,
        datatype: 'CHAR',
        length: 10,
        description: 'Test domain for long polling'
      }, { activateOnCreate: false });
      const createTime = Date.now() - createStartTime;
      console.log(`  ✓ Domain created in ${createTime}ms`);

      // Try to read immediately with long polling
      console.log(`  Reading domain with ?withLongPolling=true...`);
      const readStartTime = Date.now();
      
      // Test direct HTTP request with long polling
      // Use encodeSapObjectName for proper encoding (same as getDomain function)
      const { encodeSapObjectName } = require('../src/utils/internalUtils');
      const encodedName = encodeSapObjectName(testDomainName);
      const url = `/sap/bc/adt/ddic/domains/${encodedName}?withLongPolling=true`;
      
      const readResponse = await connection.makeAdtRequest({
        url,
        method: 'GET',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'Accept': 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml'
        }
      });
      
      const readTime = Date.now() - readStartTime;
      console.log(`  ✓ Domain read completed in ${readTime}ms`);
      console.log(`  Response status: ${readResponse.status}`);
      console.log(`  Response headers:`, JSON.stringify(readResponse.headers, null, 2));
      
      if (readTime > 1000) {
        console.log(`  ⚠️  Read took ${readTime}ms - long polling may have blocked until object was ready`);
      } else {
        console.log(`  ℹ️  Read completed quickly - object was already available`);
      }

      // Cleanup
      console.log(`  Cleaning up...`);
      await client.getDomain().delete({ domainName: testDomainName });
      console.log(`  ✓ Domain deleted\n`);

    } catch (error: any) {
      console.error(`  ✗ Test failed:`, error.message);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  Data:`, error.response.data);
      }
      
      // Try cleanup
      try {
        await client.getDomain().delete({ domainName: testDomainName });
      } catch (cleanupError) {
        console.error(`  Failed to cleanup:`, cleanupError);
      }
    }

    // Test 2: Compare read with and without long polling
    console.log('Test 2: Compare read with and without long polling');
    // Domain name max 30 chars
    const timestamp2 = Date.now().toString().slice(-12); // Last 12 digits for second test
    const testDomainName2 = `Z_TEST_LP2_${timestamp2}`;
    
    try {
      // Create domain
      console.log(`  Creating domain: ${testDomainName2}`);
      console.log(`  Using package: ${packageName}`);
      const createStartTime2 = Date.now();
      await client.getDomain().create({
        domainName: testDomainName2,
        packageName: packageName,
        datatype: 'CHAR',
        length: 10,
        description: 'Test domain for long polling comparison'
      }, { activateOnCreate: false });
      const createTime2 = Date.now() - createStartTime2;
      console.log(`  ✓ Domain created in ${createTime2}ms`);
      
      // Small delay to ensure domain is ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Read without long polling
      console.log(`  Reading WITHOUT long polling...`);
      const readWithoutStart = Date.now();
      const { encodeSapObjectName } = require('../src/utils/internalUtils');
      const encodedName = encodeSapObjectName(testDomainName2);
      const urlWithout = `/sap/bc/adt/ddic/domains/${encodedName}`;
      await connection.makeAdtRequest({
        url: urlWithout,
        method: 'GET',
        timeout: 5000,
        headers: { 
          'Accept': 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml'
        }
      });
      const readWithoutTime = Date.now() - readWithoutStart;
      console.log(`  ✓ Read without long polling: ${readWithoutTime}ms`);

      // Read with long polling
      console.log(`  Reading WITH long polling...`);
      const readWithStart = Date.now();
      const urlWith = `/sap/bc/adt/ddic/domains/${encodedName}?withLongPolling=true`;
      await connection.makeAdtRequest({
        url: urlWith,
        method: 'GET',
        timeout: 30000,
        headers: { 
          'Accept': 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml'
        }
      });
      const readWithTime = Date.now() - readWithStart;
      console.log(`  ✓ Read with long polling: ${readWithTime}ms`);

      console.log(`  Difference: ${readWithTime - readWithoutTime}ms`);
      
      if (readWithTime > readWithoutTime + 500) {
        console.log(`  ⚠️  Long polling took significantly longer - it may be blocking until object is ready`);
      } else {
        console.log(`  ℹ️  No significant difference - long polling may not be blocking for this endpoint`);
      }

      // Cleanup
      await client.getDomain().delete({ domainName: testDomainName2 });
      console.log(`  ✓ Domain deleted\n`);

    } catch (error: any) {
      console.error(`  ✗ Test failed:`, error.message);
      if (error.response) {
        console.error(`  Status: ${error.response.status}`);
        console.error(`  StatusText: ${error.response.statusText}`);
        if (typeof error.response.data === 'string') {
          console.error(`  Data (first 500 chars):`, error.response.data.substring(0, 500));
        } else {
          console.error(`  Data:`, JSON.stringify(error.response.data).substring(0, 500));
        }
      }
      try {
        await client.getDomain().delete({ domainName: testDomainName2 });
      } catch (cleanupError) {
        console.error(`  Failed to cleanup:`, cleanupError);
      }
    }

    connection.reset();
    console.log('✅ All tests completed');

  } catch (error: any) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the test
testLongPollingRead().catch(console.error);

