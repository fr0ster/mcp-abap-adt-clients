/**
 * Integration test for MessageClass lifecycle (MSAG/N).
 * Exercises: create class → read → add message → read message → update →
 * delete message → verify removal → delete class.
 *
 * Mirrors the Domain.test.ts pattern: BaseTester + TestConfigResolver +
 * standard sessionConfig helpers.  Lifecycle is custom because messageClass
 * has no activation step and carries a nested message sub-object.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - MessageClass library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=messageClass/messageClass
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  IMessageClassConfig,
  IMessageClassState,
} from '../../../../core/messageClass';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import type { TestConfigResolver } from '../../../helpers/TestConfigResolver';
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
  logTestStep,
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

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (MessageClass) uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('MessageClass (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let isCloudSystem = false;
  let tester: BaseTester<IMessageClassConfig, IMessageClassState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

      tester = new BaseTester(
        client.getMessageClass(),
        'MessageClass',
        'create_message_class',
        'adt_message_class',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: TestConfigResolver) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            name: params.msg_class_name,
            description: params.description || 'MessageClass integration test',
            packageName,
            transportRequest,
          };
        },
        ensureObjectReady: async (msgClassName: string) => {
          // Idempotent: if the message class already exists (e.g. a prior run),
          // delete it so the lifecycle can recreate it cleanly. A 404 means it is
          // absent and we proceed. (Delete uses the stateless deletion service,
          // so it leaves no lingering enqueue.)
          if (!connection) return { success: true };
          try {
            const state = await client
              .getMessageClass()
              .read({ name: msgClassName });
            if (state) {
              await client.getMessageClass().delete({ name: msgClassName });
              // The deletion service is asynchronous — poll until the object is
              // actually gone (read → 404) before recreating, so a same-name
              // re-run does not race the still-completing delete.
              for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 500));
                const still = await client
                  .getMessageClass()
                  .read({ name: msgClassName });
                if (!still) break;
              }
            }
          } catch (error: any) {
            if (error?.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify message class existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
        // cleanupObject: called by BaseTester when a pre-existing object is detected
        cleanupObject: async (config: IMessageClassConfig) => {
          await client
            .getMessageClass()
            .delete(config as Partial<IMessageClassConfig>);
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full MessageClass lifecycle',
      async () => {
        if (!tester) {
          return;
        }

        // Delegate standard skip/cleanup to tester.
        // flowTestAuto() returns early (without calling validate/create) when shouldSkip() is true,
        // and cleans up any pre-existing object that was detected by ensureObjectReady.
        if (tester.shouldSkip()) {
          await tester.flowTestAuto();
          return;
        }

        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCase();
        const params = testCase?.params || {};
        const msgNo: string = params.msg_no || '001';
        const msgTextInitial: string = params.msg_text_initial || 'ITEST 001';
        const msgTextUpdated: string =
          params.msg_text_updated || 'ITEST 001 upd';

        const msgClassName = config.name;
        const mcHandler = client.getMessageClass();
        const msgHandler = client.getMessageClassMessage();

        const testName = 'MessageClass - Full workflow';
        logTestStart(testsLogger, testName, testCase);

        try {
          // ── Step 1: Create message class ───────────────────────────────────
          logTestStep('create message class', testsLogger);
          const createState = await mcHandler.create(config);
          expect(createState.errors).toHaveLength(0);

          // ── Step 2: Read message class ─────────────────────────────────────
          logTestStep('read message class', testsLogger);
          const readState = await mcHandler.read({ name: msgClassName });
          expect(readState).toBeDefined();
          if (!readState)
            throw new Error('mcHandler.read() returned undefined');
          expect(readState.messageClass).toBeDefined();
          expect(readState.messageClass?.name).toBe(msgClassName);

          // ── Step 3: Create message ─────────────────────────────────────────
          logTestStep(`create message ${msgNo}`, testsLogger);
          const msgCreateState = await msgHandler.create({
            className: msgClassName,
            msgno: msgNo,
            msgtext: msgTextInitial,
          });
          expect(msgCreateState.errors).toHaveLength(0);

          // ── Step 4: Read message ───────────────────────────────────────────
          logTestStep(`read message ${msgNo}`, testsLogger);
          const msgReadState = await msgHandler.read({
            className: msgClassName,
            msgno: msgNo,
          });
          expect(msgReadState).toBeDefined();
          if (!msgReadState)
            throw new Error('msgHandler.read() returned undefined');
          expect(msgReadState.message).toBeDefined();
          expect(msgReadState.message?.msgtext).toBe(msgTextInitial);

          // ── Step 5: Update message ─────────────────────────────────────────
          logTestStep(`update message ${msgNo}`, testsLogger);
          const msgUpdateState = await msgHandler.update({
            className: msgClassName,
            msgno: msgNo,
            msgtext: msgTextUpdated,
          });
          expect(msgUpdateState.errors).toHaveLength(0);

          // ── Step 6: Read-back to verify update ────────────────────────────
          logTestStep(`read-back message ${msgNo} after update`, testsLogger);
          const msgReadAfterUpdate = await msgHandler.read({
            className: msgClassName,
            msgno: msgNo,
          });
          expect(msgReadAfterUpdate).toBeDefined();
          if (!msgReadAfterUpdate)
            throw new Error(
              'msgHandler.read() after update returned undefined',
            );
          expect(msgReadAfterUpdate.message?.msgtext).toBe(msgTextUpdated);

          // ── Step 7: Delete message ─────────────────────────────────────────
          logTestStep(`delete message ${msgNo}`, testsLogger);
          const msgDeleteState = await msgHandler.delete({
            className: msgClassName,
            msgno: msgNo,
          });
          expect(msgDeleteState.errors).toHaveLength(0);

          // ── Step 8: Verify message is gone from class ──────────────────────
          logTestStep('verify message removal', testsLogger);
          const readAfterMsgDelete = await mcHandler.read({
            name: msgClassName,
          });
          expect(readAfterMsgDelete).toBeDefined();
          if (!readAfterMsgDelete)
            throw new Error(
              'mcHandler.read() after message delete returned undefined',
            );
          const remainingMessages =
            readAfterMsgDelete.messageClass?.messages ?? [];
          const msg001 = remainingMessages.find((m) => m.msgno === msgNo);
          expect(msg001).toBeUndefined();

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
          // Cleanup: always delete the message class after the test.
          // BaseTester.afterAll only closes the connection; object deletion
          // must happen here so the next run starts with a clean state.
          try {
            await mcHandler.delete(config as Partial<IMessageClassConfig>);
            // The deletion service is asynchronous — wait until the class is
            // actually gone so a back-to-back re-run does not race an in-flight
            // delete (create-then-read would otherwise 404 on the same name).
            for (let i = 0; i < 20; i++) {
              await new Promise((r) => setTimeout(r, 500));
              const still = await mcHandler.read({ name: msgClassName });
              if (!still) break;
            }
          } catch {
            // Swallow — class may already be absent or delete may fail after a
            // partial test run; this is best-effort cleanup.
          }
        }
      },
      getTimeout('test'),
    );
  });
});
