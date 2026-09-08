/**
 * Unit test for getWhereUsed shared function
 * Tests getWhereUsed function using AdtClient/AdtUtils
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/whereUsed.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { orThrow } from '../../../utils/adtResponse';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { expectResult } from '../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
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
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
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

    // `AdtUtils` and not `client.getUtils()`: the two-step flow under test fetches
    // a scope document and hands it back, and `getWhereUsed(scopeXml)` is a class
    // member that `IAdtInformationSystem` does not carry. The contract's
    // `getWhereUsedList` builds its own scope from flags instead, so it cannot
    // stand in here — see the CHANGELOG entry for the gap and what closes it.
    const utils = new AdtUtils(connection, testsLogger);
    const scopeXml = expectResult(
      await withAcceptHandling(
        utils.getWhereUsedScope({
          object_name: objectName,
          object_type: objectType,
        }),
      ),
      'where-used scope',
    ) as string;

    expect(scopeXml.length).toBeGreaterThan(0);

    // Step 2: Use scope WITHOUT modifications (exactly as SAP returned it)
    testsLogger.info?.(
      '🔍 Step 2: Executing where-used search with UNMODIFIED scope...',
    );
    const document = expectResult(
      await withAcceptHandling(
        utils.getWhereUsed({
          object_name: objectName,
          object_type: objectType,
          scopeXml: scopeXml,
        }),
      ),
      'where-used search',
    ) as string;

    const match = document.match(/numberOfResults="(\d+)"/);
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

    // `AdtUtils` and not `client.getUtils()`: the two-step flow under test fetches
    // a scope document and hands it back, and `getWhereUsed(scopeXml)` is a class
    // member that `IAdtInformationSystem` does not carry. The contract's
    // `getWhereUsedList` builds its own scope from flags instead, so it cannot
    // stand in here — see the CHANGELOG entry for the gap and what closes it.
    const utils = new AdtUtils(connection, testsLogger);
    const scopeXml = expectResult(
      await withAcceptHandling(
        utils.getWhereUsedScope({
          object_name: objectName,
          object_type: objectType,
        }),
      ),
      'where-used scope',
    ) as string;

    // Parse initial state
    const allTypes = (scopeXml.match(/<usagereferences:type/g) || []).length;
    const initialSelected = (scopeXml.match(/isSelected="true"/g) || []).length;

    testsLogger.info?.(
      `📊 Initial scope: ${initialSelected}/${allTypes} types selected`,
    );

    // Step 2: Enable ALL types (like Eclipse "Select All" checkbox)
    testsLogger.info?.('🔧 Modifying scope - enabling ALL types...');
    const modifiedScope = utils.modifyWhereUsedScope(scopeXml, {
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
    const document = expectResult(
      await withAcceptHandling(
        utils.getWhereUsed({
          object_name: objectName,
          object_type: objectType,
          scopeXml: modifiedScope,
        }),
      ),
      'where-used search',
    ) as string;

    const match = document.match(/numberOfResults="(\d+)"/);
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

      const document = expectResult(
        await withAcceptHandling(
          new AdtUtils(connection, testsLogger).getWhereUsed({
            object_name: objectName,
            object_type: objectType,
          }),
        ),
        'where-used for a table',
      ) as string;

      testsLogger.info?.('✅ Where-used query completed (default types)');
      testsLogger.info?.(`📊 Response size: ${document.length} bytes`);

      // Parse and log number of results
      const match = document.match(/numberOfResults="(\d+)"/);
      if (match) {
        testsLogger.info?.(`🎯 Found ${match[1]} usage references`);

        // Parse objectTypes to see which types were searched
        const typeMatches = document.matchAll(
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
        const descMatch = document.match(/resultDescription="([^"]+)"/);
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
      new AdtUtils(connection, testsLogger).getWhereUsed({
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
      new AdtUtils(connection, testsLogger).getWhereUsed({
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

    // `AdtUtils` and not `client.getUtils()`: the two-step flow under test fetches
    // a scope document and hands it back, and `getWhereUsed(scopeXml)` is a class
    // member that `IAdtInformationSystem` does not carry. The contract's
    // `getWhereUsedList` builds its own scope from flags instead, so it cannot
    // stand in here — see the CHANGELOG entry for the gap and what closes it.
    const utils = new AdtUtils(connection, testsLogger);
    const result = await orThrow(
      utils.getWhereUsedList({
        object_name: objectName,
        object_type: objectType,
        enableAllTypes: enableAllTypes,
      }),
    );

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

  it('hands back the document itself, for a caller that wants all of it', async () => {
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

    logTestStep('get the where-used document', testsLogger);

    // `getWhereUsedList` carried an `includeRawXml` flag that put the whole
    // document inside the parsed result — the same endpoint answering two
    // shapes depending on a boolean. The document is its own member:
    // `getWhereUsed` runs the search and answers the body, and a caller who
    // wants everything asks that one.
    //
    // `AdtUtils` and not `client.getUtils()`: the two-step flow fetches a scope
    // document and hands it back, and `getWhereUsed(scopeXml)` is a class
    // member that `IAdtInformationSystem` does not carry.
    const utils = new AdtUtils(connection, testsLogger);
    const document = expectResult(
      await utils.getWhereUsed({
        object_name: objectName,
        object_type: objectType,
      }),
      'where-used document',
    );

    expect(document).toContain('usageReferenceResult');

    testsLogger.info?.(`📊 Document size: ${document.length} bytes`);
    testsLogger.info?.('✅ Test complete: the whole document came back');
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

    // `AdtUtils` and not `client.getUtils()`: the two-step flow under test fetches
    // a scope document and hands it back, and `getWhereUsed(scopeXml)` is a class
    // member that `IAdtInformationSystem` does not carry. The contract's
    // `getWhereUsedList` builds its own scope from flags instead, so it cannot
    // stand in here — see the CHANGELOG entry for the gap and what closes it.
    const utils = new AdtUtils(connection, testsLogger);

    // Step 1: search ALL types — the "select all" baseline.
    logTestStep('where-used: ALL types (baseline)', testsLogger);
    const all = await orThrow(
      utils.getWhereUsedList({
        object_name: objectName,
        object_type: objectType,
        enableAllTypes: true,
      }),
    );
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
    const kept = await orThrow(
      utils.getWhereUsedList({
        object_name: objectName,
        object_type: objectType,
        enableOnlyTypes: [keepType],
      }),
    );
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

    // Step 2b (EXCLUDE): narrow to a type that SAP CAN search for this object
    // (it is offered in the scope) but which the object does not reference.
    // Deriving the candidate from the live scope — not a hardcoded list —
    // guarantees enableOnlyTypes actually selects a searchable type, so a zero
    // result proves the filter excluded the referenced type rather than simply
    // selecting nothing.
    const scopeResponse = await orThrow(
      utils.getWhereUsedScope({
        object_name: objectName,
        object_type: objectType,
      }),
    );
    const scopeTypes = [
      ...new Set(
        [...String(scopeResponse).matchAll(/name="([^"]+)"/g)].map((m) => m[1]),
      ),
    ];
    const absentType = scopeTypes.find((t) => !allTypes.includes(t));
    testsLogger.info?.(
      `🔎 Scope offers ${scopeTypes.length} types; picking absent-but-searchable: ${absentType}`,
    );
    if (absentType) {
      logTestStep(`where-used: ONLY [${absentType}] (absent)`, testsLogger);
      const excluded = await orThrow(
        utils.getWhereUsedList({
          object_name: objectName,
          object_type: objectType,
          enableOnlyTypes: [absentType],
        }),
      );
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
