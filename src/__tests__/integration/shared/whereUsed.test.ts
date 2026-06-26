/**
 * Unit test for getWhereUsed shared function
 * Tests getWhereUsed function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/whereUsed.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { createTestAdtClient, getConfig } from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger = createTestsLogger();

describe('Shared - getWhereUsed', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, testsLogger);
      await (connection as any).connect();
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (_error) {
      testsLogger.warn?.(
        '⚠️ Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it('should use default scope without modifications (Eclipse default behavior)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_default_scope',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    const params = resolver.getParams();
    const objectName =
      params.object_name || resolver.getObjectName('object_name', 'table');
    const objectType = params.object_type || 'table';
    if (!objectName) {
      logTestSkip(testsLogger, 'Shared - getWhereUsed', 'No object configured');
      return;
    }

    logTestStep('where-used with default scope', testsLogger);
    testsLogger.info?.(`📋 Object: ${objectName} (${objectType})`);
    testsLogger.info?.('🔍 Step 1: Fetching scope configuration...');

    const utils = client.getUtils();
    const scopeResponse = await withAcceptHandling(
      utils.getWhereUsedScope({
        object_name: objectName,
        object_type: objectType,
      }),
    );

    expect(scopeResponse.status).toBe(200);
    expect(scopeResponse.data).toBeDefined();

    // Step 2: Use scope WITHOUT modifications (exactly as SAP returned it)
    testsLogger.info?.(
      '🔍 Step 2: Executing where-used search with UNMODIFIED scope...',
    );
    const result = await withAcceptHandling(
      utils.getWhereUsed({
        object_name: objectName,
        object_type: objectType,
        scopeXml: scopeResponse.data, // Pass scope as-is, no modifications
      }),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    const match = result.data?.match(/numberOfResults="(\d+)"/);
    if (match) {
      testsLogger.info?.(
        `🎯 Found ${match[1]} usage references with default scope`,
      );
    }

    testsLogger.info?.('✅ Test complete: scope used without modifications');
  }, 30000);

  it('should search with all types enabled (Eclipse "select all" behavior)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_all_types',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    const params = resolver.getParams();
    const objectName =
      params.object_name || resolver.getObjectName('object_name', 'table');
    const objectType = params.object_type || 'table';
    if (!objectName) {
      logTestSkip(testsLogger, 'Shared - getWhereUsed', 'No object configured');
      return;
    }

    logTestStep('where-used with ALL types enabled', testsLogger);
    testsLogger.info?.(`📋 Object: ${objectName} (${objectType})`);
    testsLogger.info?.('🔍 Step 1: Fetching scope configuration...');

    const utils = client.getUtils();
    const scopeResponse = await withAcceptHandling(
      utils.getWhereUsedScope({
        object_name: objectName,
        object_type: objectType,
      }),
    );

    expect(scopeResponse.status).toBe(200);

    // Parse initial state
    const allTypes = (scopeResponse.data.match(/<usagereferences:type/g) || [])
      .length;
    const initialSelected = (
      scopeResponse.data.match(/isSelected="true"/g) || []
    ).length;

    testsLogger.info?.(
      `📊 Initial scope: ${initialSelected}/${allTypes} types selected`,
    );

    // Step 2: Enable ALL types (like Eclipse "Select All" checkbox)
    testsLogger.info?.('🔧 Modifying scope - enabling ALL types...');
    const modifiedScope = utils.modifyWhereUsedScope(scopeResponse.data, {
      enableAll: true,
    });

    // Verify all types are now selected
    const finalSelected = (modifiedScope.match(/isSelected="true"/g) || [])
      .length;
    testsLogger.info?.(
      `📊 Modified scope: ${finalSelected}/${allTypes} types selected`,
    );
    expect(finalSelected).toBe(allTypes);

    // Step 3: Execute search with all types
    testsLogger.info?.(
      '🔍 Step 3: Executing where-used search with ALL types...',
    );
    const result = await withAcceptHandling(
      utils.getWhereUsed({
        object_name: objectName,
        object_type: objectType,
        scopeXml: modifiedScope,
      }),
    );

    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();

    const match = result.data?.match(/numberOfResults="(\d+)"/);
    if (match) {
      testsLogger.info?.(
        `🎯 Found ${match[1]} usage references with ALL types enabled`,
      );
    }

    testsLogger.info?.('✅ Test complete: all types enabled successfully');
  }, 30000);

  it('should get where-used for table', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_table',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    const params = resolver.getParams();
    const objectName =
      params.object_name || resolver.getObjectName('object_name', 'table');
    const objectType = params.object_type || 'table';
    if (!objectName) {
      logTestSkip(testsLogger, 'Shared - getWhereUsed', 'No object configured');
      return;
    }

    try {
      logTestStep('get where-used for table', testsLogger);
      testsLogger.info?.(`📋 Object: ${objectName} (${objectType})`);
      testsLogger.info?.('🔍 Step 1: Fetching scope configuration...');

      const result = await withAcceptHandling(
        client.getUtils().getWhereUsed({
          object_name: objectName,
          object_type: objectType,
        }),
      );

      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();

      testsLogger.info?.('✅ Where-used query completed (default types)');
      testsLogger.info?.(`📊 Response size: ${result.data?.length || 0} bytes`);

      // Parse and log number of results
      const match = result.data?.match(/numberOfResults="(\d+)"/);
      if (match) {
        testsLogger.info?.(`🎯 Found ${match[1]} usage references`);

        // Parse objectTypes to see which types were searched
        const typeMatches = result.data?.matchAll(
          /<usagereferences:type name="([^"]+)" isSelected="true"/g,
        );
        const searchedTypes: string[] = [];
        if (typeMatches) {
          for (const tm of typeMatches) {
            searchedTypes.push(tm[1]);
          }
          testsLogger.info?.(
            `🔍 Searched in types: ${searchedTypes.join(', ')}`,
          );
        }

        // Log result description if available
        const descMatch = result.data?.match(/resultDescription="([^"]+)"/);
        if (descMatch) {
          testsLogger.info?.(`📝 Result: ${descMatch[1]}`);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 415) {
        throw new Error(
          `415 Unsupported Media Type: The server cannot process the request Content-Type. This may indicate an issue with the Content-Type header format. Error: ${error.message}`,
        );
      }
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error(
          `Request timeout: Where-used query for table "${objectName}" exceeded timeout. This may indicate that the query is too complex or the system is slow. Consider increasing the timeout or using a simpler test object. Error: ${error.message}`,
        );
      }
      throw error;
    }
  }, 60000); // Increased timeout to 60s for table where-used queries which can be slow

  it('should throw error if object name is missing', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_error_no_name',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    logTestStep('validate error if object name is missing', testsLogger);
    await expect(
      client.getUtils().getWhereUsed({
        object_name: '',
        object_type: 'class',
      }),
    ).rejects.toThrow('Object name is required');
  });

  it('should throw error if object type is missing', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_error_no_type',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    logTestStep('validate error if object type is missing', testsLogger);
    await expect(
      client.getUtils().getWhereUsed({
        object_name: 'TEST',
        object_type: '',
      }),
    ).rejects.toThrow('Object type is required');
  });

  it('should get where-used list with parsed results', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_list_parsed',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    const params = resolver.getParams();
    const objectName =
      params.object_name || resolver.getObjectName('object_name', 'table');
    const objectType = params.object_type || 'table';
    const enableAllTypes = params.enable_all_types !== false;
    if (!objectName) {
      logTestSkip(testsLogger, 'Shared - getWhereUsed', 'No object configured');
      return;
    }

    logTestStep('get where-used list with parsed results', testsLogger);
    testsLogger.info?.(`📋 Object: ${objectName} (${objectType})`);
    testsLogger.info?.('🔍 Fetching parsed where-used list...');

    const utils = client.getUtils();
    const result = await utils.getWhereUsedList({
      object_name: objectName,
      object_type: objectType,
      enableAllTypes: enableAllTypes,
    });

    expect(result).toBeDefined();
    expect(result.objectName).toBe(objectName);
    expect(result.objectType).toBe(objectType);
    expect(typeof result.totalReferences).toBe('number');
    expect(Array.isArray(result.references)).toBe(true);

    testsLogger.info?.(`🎯 Found ${result.totalReferences} references`);
    testsLogger.info?.(
      `📊 Parsed ${result.references.length} reference objects`,
    );

    // Verify reference structure
    if (result.references.length > 0) {
      const firstRef = result.references[0];
      expect(firstRef.uri).toBeDefined();
      expect(firstRef.name).toBeDefined();
      expect(firstRef.type).toBeDefined();
      expect(typeof firstRef.isResult).toBe('boolean');

      testsLogger.info?.(
        `📝 First reference: ${firstRef.name} (${firstRef.type}) in ${firstRef.packageName}`,
      );
    }

    // Verify no packages in references (they should be filtered out)
    const hasPackages = result.references.some((ref) => ref.type === 'DEVC/K');
    expect(hasPackages).toBe(false);

    testsLogger.info?.('✅ Test complete: parsed results received');
  }, 30000);

  it('should get where-used list with raw XML included', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_list_raw_xml',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    const params = resolver.getParams();
    const objectName =
      params.object_name || resolver.getObjectName('object_name', 'table');
    const objectType = params.object_type || 'table';
    if (!objectName) {
      logTestSkip(testsLogger, 'Shared - getWhereUsed', 'No object configured');
      return;
    }

    logTestStep('get where-used list with raw XML', testsLogger);

    const utils = client.getUtils();
    const result = await utils.getWhereUsedList({
      object_name: objectName,
      object_type: objectType,
      includeRawXml: true,
    });

    expect(result).toBeDefined();
    expect(result.rawXml).toBeDefined();
    expect(result.rawXml).toContain('usageReferenceResult');

    testsLogger.info?.(`📊 Raw XML size: ${result.rawXml?.length} bytes`);
    testsLogger.info?.('✅ Test complete: raw XML included');
  }, 30000);

  it('narrows results to selected object types (enableOnlyTypes vs enableAllTypes)', async () => {
    if (!hasConfig) {
      testsLogger.warn?.(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const resolver = new TestConfigResolver({
      isCloud: isCloudSystem,
      isLegacy,
      logger: testsLogger,
      handlerName: 'where_used',
      testCaseName: 'where_used_list_filtered',
    });
    if (!resolver.isAvailableForEnvironment()) {
      logTestSkip(
        testsLogger,
        'Shared - getWhereUsed',
        'Test not available for current environment',
      );
      return;
    }

    const params = resolver.getParams();
    const objectName =
      params.object_name || resolver.getObjectName('object_name', 'table');
    const objectType = params.object_type || 'table';
    const onlyTypes: string[] = params.enable_only_types || ['DDLS/DF'];
    if (!objectName) {
      logTestSkip(testsLogger, 'Shared - getWhereUsed', 'No object configured');
      return;
    }

    const utils = client.getUtils();

    // Step 1: search ALL types — the "select all" baseline.
    logTestStep('where-used: ALL types (baseline)', testsLogger);
    const all = await utils.getWhereUsedList({
      object_name: objectName,
      object_type: objectType,
      enableAllTypes: true,
    });
    const allTypes = [...new Set(all.references.map((r) => r.type))].sort();
    testsLogger.info?.(
      `📊 ALL: ${all.references.length} refs across types [${allTypes.join(', ')}]`,
    );

    // The baseline must actually reference the type we keep, otherwise the
    // "keep" comparison below proves nothing about server-side filtering.
    const keepType =
      onlyTypes.find((t) => allTypes.includes(t)) ||
      allTypes[0] ||
      onlyTypes[0];

    // Step 2a (KEEP): narrow to a type that IS referenced — count is unchanged
    // for that type, and no other type leaks in.
    logTestStep(`where-used: ONLY [${keepType}] (present)`, testsLogger);
    const kept = await utils.getWhereUsedList({
      object_name: objectName,
      object_type: objectType,
      enableOnlyTypes: [keepType],
    });
    const keptTypes = [...new Set(kept.references.map((r) => r.type))].sort();
    testsLogger.info?.(
      `📊 KEEP [${keepType}]: ${kept.references.length} refs across types [${keptTypes.join(', ')}]`,
    );

    // Every returned reference must be the type we asked for — proves SAP did
    // not search (and did not return) any of the other ~40 object types.
    for (const ref of kept.references) {
      expect(ref.type).toBe(keepType);
    }
    expect(kept.references.length).toBeLessThanOrEqual(all.references.length);
    if (allTypes.includes(keepType)) {
      expect(kept.references.length).toBeGreaterThan(0);
    }

    // Step 2b (EXCLUDE): narrow to a type that is NOT referenced — the result
    // must collapse, demonstrating the filter is applied server-side.
    const KNOWN_TYPES = ['CLAS/OC', 'INTF/OI', 'PROG/1P', 'FUGR/FF', 'DOMA/DD'];
    const absentType = KNOWN_TYPES.find((t) => !allTypes.includes(t));
    if (absentType) {
      logTestStep(`where-used: ONLY [${absentType}] (absent)`, testsLogger);
      const excluded = await utils.getWhereUsedList({
        object_name: objectName,
        object_type: objectType,
        enableOnlyTypes: [absentType],
      });
      testsLogger.info?.(
        `📊 EXCLUDE [${absentType}]: ${excluded.references.length} refs (baseline had ${all.references.length})`,
      );
      // Filtering to a type the object does not reference yields no results,
      // even though enableAllTypes returned matches.
      expect(excluded.references.length).toBe(0);
    } else {
      testsLogger.warn?.(
        '⚠️ Could not pick an absent type — skipping the exclude assertion',
      );
    }

    testsLogger.info?.('✅ Test complete: type filtering verified against SAP');
  }, 45000);
});
