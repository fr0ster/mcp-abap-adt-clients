/**
 * Integration test for Domain
 * Tests using AdtClient for unified CRUD operations with BaseTester
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Domain library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=domain/Domain
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import {
  type IDomainChanges,
  type IDomainConfig,
  patchDomainDocument,
} from '../../../../core/domain';
import { getDomain } from '../../../../core/domain/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester, type IUpdatedObject } from '../../../helpers/BaseTester';
import { gate, gateStandardObject } from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import { contentAt, documentAt } from '../../../helpers/documentAt';
import { patchedDocument } from '../../../helpers/patchedDocument';
import { readRootDescription } from '../../../helpers/rootDescription';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const TYPE = ['doma:content', 'doma:typeInformation'];
const OUTPUT = ['doma:content', 'doma:outputInformation'];
const VALUE = ['doma:content', 'doma:valueInformation'];

/** Each fixed value as [position, low, high, text], in order. */
function fixedValuesOf(document: string): string[][] {
  const block = contentAt(document, [...VALUE, 'doma:fixValues']);
  return block
    .split('<doma:fixValue>')
    .slice(1)
    .map((rest) => {
      const entry = `<doma:fixValue>${rest}`;
      return ['doma:position', 'doma:low', 'doma:high', 'doma:text'].map(
        (name) => contentAt(entry, [name]),
      );
    });
}

/** The value table reference's attributes as SAP stored them. */
function valueTableOf(document: string): Readonly<Record<string, string>> {
  return (
    documentAt(document, [...VALUE, 'doma:valueTableRef'])?.attributes ?? {}
  );
}

/** What SAP writes for a value table it resolved by name (measured). */
function referenceTo(table: string): Record<string, string> {
  return {
    'adtcore:uri': `/sap/bc/adt/ddic/tables/${table.toLowerCase()}`,
    'adtcore:type': 'TABL/DT',
    'adtcore:name': table,
  };
}

/** The first two shared tables: the value tables the test names. */
function sharedTables(): [string, string] {
  const tables: Array<{ name: string }> =
    getSharedDependenciesConfig()?.tables ?? [];
  const [first, second] = tables;
  if (!first || !second) {
    throw new Error('shared_dependencies.tables needs two tables');
  }
  return [first.name, second.name];
}

/** Patch what was read, write it, and read what SAP stored. */
async function writeAndRead(
  domain: IUpdatedObject,
  read: string,
  changes: IDomainChanges,
): Promise<string> {
  await domain.write(
    patchedDocument(patchDomainDocument(read, changes), 'domain patch'),
  );
  return domain.read();
}

const {
  ensureSharedDependency,
  getSharedDependenciesConfig,
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (Domain) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Domain (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<IDomainConfig>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      hasConfig = true;

      tester = new BaseTester(
        // getDomain() declares no IAdtVersionable (no
        // getVersions/getVersionSource); cast through the full interface.
        client.getDomain(),
        'Domain',
        'create_domain',
        'adt_domain',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          // Use resolver to get resolved parameters (from test case params or global defaults)
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            domainName: params.domain_name,
            packageName,
            transportRequest,
            description: params.description,
            datatype: params.datatype,
            length: params.length || 10,
            decimals: params.decimals,
          };
        },
        ensureObjectReady: async (domainName: string) => {
          if (!connection) return { success: true };
          try {
            await getDomain(connection, domainName);
            return {
              success: false,
              objectExists: true,
              reason: `⚠️ SAFETY: Domain ${domainName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify domain existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    gate('create_domain', 'adt_domain')(
      'should execute full workflow and store all results',
      async () => {
        // buildConfig above carries the type beside IDomainConfig's fields.
        const config = (await tester.requireConfig()) as IDomainConfig & {
          datatype?: string;
          length?: number;
          decimals?: number;
        };

        // Longer than the 60 characters SAP keeps: the patch passes it as
        // given, and the read-back shows what SAP stored.
        const description = `${config.description || ''} (updated)`.padEnd(
          70,
          '.',
        );
        // The value tables a domain can name: the shared ones.
        const [tableA, tableB] = sharedTables();
        for (const table of [tableA, tableB]) {
          await ensureSharedDependency(client, 'tables', table, testsLogger);
        }

        await tester.flowTestAuto({
          // The create is a shell — `<doma:datatype/>` empty — and the
          // update is what gives it a type; without one activation refuses
          // it: "Data type ' ' does not exist" (measured). Every field the
          // patch writes on a domain is set here once.
          updateTakesDocument: (current) => {
            testsLogger.info?.(
              `the read before the update ${readRootDescription(current) === undefined ? 'carries no' : 'carries a'} root description`,
            );
            return patchedDocument(
              patchDomainDocument(current, {
                description,
                dataType: config.datatype || 'CHAR',
                length: config.length || 10,
                decimals: config.decimals ?? 0,
                conversionExit: '',
                signExists: false,
                lowercase: true,
                fixedValues: [
                  { low: 'A', high: 'C', text: 'A to C' },
                  { low: 'Z', text: 'Zed' },
                ],
              }),
              'domain update',
            );
          },
          afterUpdate: async (domain) => {
            let stored = await domain.read();
            expect(readRootDescription(stored)).toBe(description.slice(0, 60));
            expect(contentAt(stored, [...TYPE, 'doma:datatype'])).toBe(
              config.datatype || 'CHAR',
            );
            expect(contentAt(stored, [...TYPE, 'doma:length'])).toBe(
              String(config.length || 10).padStart(6, '0'),
            );
            expect(contentAt(stored, [...OUTPUT, 'doma:lowercase'])).toBe(
              'true',
            );
            expect(fixedValuesOf(stored)).toEqual([
              ['0001', 'A', 'C', 'A to C'],
              ['0002', 'Z', '', 'Zed'],
            ]);

            // No fixed values, and a value table set on the empty reference
            // (the key field of the shared tables is CHAR 10).
            stored = await writeAndRead(domain, stored, {
              fixedValues: [],
              valueTable: tableA,
              length: 10,
            });
            expect(fixedValuesOf(stored)).toEqual([]);
            expect(valueTableOf(stored)).toEqual(referenceTo(tableA));

            // One value table to another, by name alone.
            stored = await writeAndRead(domain, stored, {
              valueTable: tableB,
            });
            expect(valueTableOf(stored)).toEqual(referenceTo(tableB));
          },
          updateConfig: {
            domainName: config.domainName,
            packageName: config.packageName,
            description: config.description || '',
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    gateStandardObject('domain')(
      'should read standard SAP domain',
      async () => {
        // Use TestConfigResolver for consistent parameter resolution
        const resolver = new TestConfigResolver({
          isCloud: isCloudSystem,
          logger: testsLogger,
        });
        const standardObject = resolver.getStandardObject('domain');

        if (!standardObject) {
          throw new Error(
            `Standard domain not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`,
          );
        }

        const standardDomainName = standardObject.name;
        logTestStart(testsLogger, 'Domain - read standard object', {
          name: 'read_standard',
          params: { domain_name: standardDomainName },
        });

        try {
          const resultState = await tester.readTest({
            domainName: standardDomainName,
          });
          expect(resultState).toBeDefined();
          const domainConfig = resultState;
          if (
            domainConfig &&
            typeof domainConfig === 'object' &&
            'domainName' in domainConfig
          ) {
            expect((domainConfig as any).domainName).toBe(standardDomainName);
            expect((domainConfig as any).description).toBeDefined();
          }

          logTestSuccess(testsLogger, 'Domain - read standard object');
        } catch (error) {
          logTestError(testsLogger, 'Domain - read standard object', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Domain - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});
