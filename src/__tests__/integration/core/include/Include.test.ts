/**
 * Integration test for standalone `PROG/I` includes (AdtInclude).
 *
 * **On-prem only, and not by policy — by capability.** Discovery gives the
 * includes collection an `app:accept` on modern on-prem and on nothing else; a
 * collection without one is not a POST target, and cloud answers `403
 * S_DEVELOP` for the type. So this file skips wherever an include cannot be
 * created, and says which of the two reasons applied.
 *
 * The chain it exercises is the one captured from Eclipse: create, lock,
 * `PUT source/main`, unlock, activate. Nothing here had ever run against a
 * system before this file existed.
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - Library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=include/Include
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IIncludeConfig,
  IIncludeState,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { getIncludeSource } from '../../../../core/include';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Include (PROG/I, using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let tester: BaseTester<IIncludeConfig, IIncludeState>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      hasConfig = true;

      tester = new BaseTester<IIncludeConfig, IIncludeState>(
        client.getInclude(),
        'Include',
        'create_include',
        'adt_include',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            includeName: params.include_name,
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (includeName: string) => {
          if (!connection) return { success: true };
          try {
            const existing = await getIncludeSource(connection, includeName);
            // `source/main` answers 200 with an empty body when the object is
            // not there — it never 404s — so absence is told by content.
            if (!String(existing?.data ?? '').trim()) {
              return { success: true };
            }
            try {
              const transportRequest = tester.getTransportRequest();
              const { client: cleanupClient } = await createTestAdtClient(
                connection,
                libraryLogger,
                systemContext,
              );
              await cleanupClient
                .getInclude()
                .delete({ includeName, transportRequest });
              await new Promise((resolve) => setTimeout(resolve, 3000));
            } catch (cleanupError: any) {
              return {
                success: false,
                objectExists: true,
                reason: `Failed to delete existing include ${includeName}: ${cleanupError.message}`,
              };
            }
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify include existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails naming the
      // reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should create, read, update, activate and delete an include',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }

        if (isCloudSystem) {
          // Not a policy skip: discovery gives the includes collection no
          // `app:accept` on cloud, so it is not a creation target, and the type
          // answers 403 S_DEVELOP there.
          logTestSkip(
            testsLogger,
            'Include - full workflow',
            'PROG/I includes cannot be created on cloud: the collection declares no app:accept and the type answers 403 S_DEVELOP',
          );
          return;
        }

        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        const sourceCode =
          testCase?.params?.source_code || config.sourceCode || '';
        const updateSourceCode =
          testCase?.params?.update_source_code || sourceCode;

        await tester.flowTestAuto({
          sourceCode,
          updateConfig: {
            includeName: config.includeName,
            packageName: config.packageName,
            description: config.description || '',
            sourceCode: updateSourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('The document is an include, not a program', () => {
    it(
      'reads back include:abapInclude with adtcore:type="PROG/I"',
      async () => {
        const testName = 'Include - metadata shape';
        if (!hasConfig || !tester) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }
        if (isCloudSystem) {
          logTestSkip(
            testsLogger,
            testName,
            'PROG/I includes are not creatable on cloud',
          );
          return;
        }

        const config = tester.getConfig();
        if (!config?.includeName) {
          logTestSkip(testsLogger, testName, 'include_name not configured');
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'metadata_shape',
          params: { include_name: config.includeName },
        });

        // Its own object, created here and removed here.
        //
        // Reading the workflow test's include instead made this depend on
        // something that test deletes in its cleanup: run together, the read
        // answered an empty body and the expectations below failed on `""`
        // rather than on anything about the document. A distinct name also
        // keeps the two from colliding whichever order they run in.
        const include = client.getInclude();
        const metadataName = `${config.includeName}M`.slice(0, 30);

        try {
          await include.create({
            includeName: metadataName,
            packageName: config.packageName,
            description: 'Include metadata shape probe',
            sourceCode: '* metadata shape probe',
          });

          const state = await include.readMetadata({
            includeName: metadataName,
          });
          const body = String((state?.readResult as any)?.data ?? '');

          // The whole reason this is a separate module: an include answers with
          // its own root and type, and carries none of the program attributes.
          expect(body).toContain('include:abapInclude');
          expect(body).toContain('adtcore:type="PROG/I"');
          expect(body).not.toContain('program:abapProgram');
          expect(body).not.toContain('program:programType');

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          // Best effort: a leftover include is litter, but a delete that throws
          // here would replace the real failure with its own.
          try {
            await client.getInclude().delete({ includeName: metadataName });
          } catch {
            // nothing to remove, or the create never got that far
          }
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });
});
