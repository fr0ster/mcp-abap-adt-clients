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
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  IMessageClassConfig,
  IParsedMessage,
} from '../../../../core/messageClass';
import { parseMessageClass } from '../../../../core/messageClass';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
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
  let tester: BaseTester<IMessageClassConfig>;
  // Transport resolved by buildConfig; reused by ensureObjectReady's cleanup
  // delete so a pre-existing object in a transportable package is deleted
  // with the same corrNr as the rest of the lifecycle.
  let resolvedTransport: string | undefined;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
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
        // Narrowed to what a message class has — no activate, no check, no
        // transport, no versions. `BaseTester` guards on `activate` before
        // calling it, so the narrow handler goes in as it is.
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
          resolvedTransport = transportRequest;
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
            // `state.ok`, not `state`: the answer is an object either way, so
            // the bare check was always true and this deleted a class that was
            // not there on every run.
            if (state.ok) {
              await client.getMessageClass().delete({
                name: msgClassName,
                transportRequest: resolvedTransport,
              });
              // The deletion service is asynchronous — poll until the object is
              // actually gone (read → 404) before recreating, so a same-name
              // re-run does not race the still-completing delete.
              for (let i = 0; i < 20; i++) {
                await new Promise((r) => setTimeout(r, 500));
                const still = await client
                  .getMessageClass()
                  .read({ name: msgClassName });
                if (!still.ok) break;
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
          const createState = expectResult(
            await mcHandler.create(config),
            'createState',
          );

          // ── Step 2: Read message class ─────────────────────────────────────
          logTestStep('read message class', testsLogger);
          // No ADT operation that changes system state guarantees when the
          // change becomes visible, and for MSAG the server answers 404 right
          // after a create rather than holding the request — `withLongPolling`
          // is passed but does not cover this resource. So poll until the
          // object appears, bounded, instead of asking once and calling the
          // absence a failure.
          let readState = String(
            expectResult(
              await mcHandler.read({ name: msgClassName }),
              'readState',
            ) ?? '',
          );
          for (let attempt = 0; !readState && attempt < 15; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const again = await mcHandler.read({ name: msgClassName });
            readState = again.ok ? String(again.getResult().value ?? '') : '';
          }
          // The class document, read into its parts. `parseMessageClass` is
          // this module's own reading — a consumer that wants it composes it
          // into a result strategy; a test composes it here.
          const parsedClass = parseMessageClass(String(readState ?? ''));
          expect(parsedClass.name).toBe(msgClassName);

          // ── Step 3: Create message ─────────────────────────────────────────
          logTestStep(`create message ${msgNo}`, testsLogger);
          // Reading the class already succeeds here, yet the messages endpoint
          // can still answer "Resource MSAG ... does not exist": the two do not
          // agree on when the class is there. Retry rather than treat the first
          // answer as final.
          const createMessage = () =>
            msgHandler.create({
              className: msgClassName,
              msgno: msgNo,
              msgtext: msgTextInitial,
              transportRequest: config.transportRequest,
            });
          let created = await createMessage().catch((e: unknown) => e as Error);
          for (
            let attempt = 0;
            created instanceof Error && attempt < 15;
            attempt++
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            created = await createMessage().catch((e: unknown) => e as Error);
          }
          if (created instanceof Error) throw created;
          const msgCreateState = created;

          // ── Step 4: Read message ───────────────────────────────────────────
          logTestStep(`read message ${msgNo}`, testsLogger);
          const msgReadState = expectResult(
            await msgHandler.read({
              className: msgClassName,
              msgno: msgNo,
            }),
            'msgReadState',
          );
          // A message is read through its class's document — there is no
          // resource for one message — so the assertion picks it out.
          const readMessage = parseMessageClass(
            String(msgReadState ?? ''),
          ).messages.find((m: IParsedMessage) => m.msgno === msgNo);
          expect(readMessage?.msgtext).toBe(msgTextInitial);

          // ── Step 5: Update message ─────────────────────────────────────────
          logTestStep(`update message ${msgNo}`, testsLogger);
          const msgUpdateState = expectResult(
            await msgHandler.update({
              className: msgClassName,
              msgno: msgNo,
              msgtext: msgTextUpdated,
              transportRequest: config.transportRequest,
            }),
            'msgUpdateState',
          );

          // ── Step 6: Read-back to verify update ────────────────────────────
          logTestStep(`read-back message ${msgNo} after update`, testsLogger);
          const msgReadAfterUpdate = expectResult(
            await msgHandler.read({
              className: msgClassName,
              msgno: msgNo,
            }),
            'msgReadAfterUpdate',
          );
          const updatedMessage = parseMessageClass(
            String(msgReadAfterUpdate ?? ''),
          ).messages.find((m: IParsedMessage) => m.msgno === msgNo);
          expect(updatedMessage?.msgtext).toBe(msgTextUpdated);

          // ── Step 7: Delete message ─────────────────────────────────────────
          logTestStep(`delete message ${msgNo}`, testsLogger);
          const msgDeleteState = expectResult(
            await msgHandler.delete({
              className: msgClassName,
              msgno: msgNo,
              transportRequest: config.transportRequest,
            }),
            'msgDeleteState',
          );

          // ── Step 8: Verify message is gone from class ──────────────────────
          logTestStep('verify message removal', testsLogger);
          const readAfterMsgDelete = expectResult(
            await mcHandler.read({
              name: msgClassName,
            }),
            'readAfterMsgDelete',
          );
          const remaining = parseMessageClass(
            String(readAfterMsgDelete ?? ''),
          ).messages;
          expect(
            remaining.find((m: IParsedMessage) => m.msgno === msgNo),
          ).toBeUndefined();

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
            // `read` answers a contract, and a contract is always truthy. This
            // read `if (!still) break`, so the loop never broke: twenty round
            // trips and ten seconds of sleeping every run, all of them
            // answering 404, measured in a wire log. The answer says whether
            // the class is gone; the object it arrives in does not.
            for (let i = 0; i < 20; i++) {
              await new Promise((r) => setTimeout(r, 500));
              const still = await mcHandler.read({ name: msgClassName });
              if (!still.ok) break;
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
