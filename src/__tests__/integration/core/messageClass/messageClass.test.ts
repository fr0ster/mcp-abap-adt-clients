/**
 * Integration test for MessageClass lifecycle (MSAG/N).
 * Exercises: create class → read → add message → read message → update →
 * delete message → verify removal → delete class.
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
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const { getTimeout } = require('../../../helpers/test-helper');

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

/** Local ($TMP) package — no transport request required. */
const PACKAGE_NAME = 'ZOK_TEST';
/** Unique Z-name for the test message class — must not exist before the run. */
const MSG_CLASS_NAME = 'ZADT_MSG_ITEST';
const MSG_NO = '001';
const MSG_TEXT_INITIAL = 'ITEST 001';
const MSG_TEXT_UPDATED = 'ITEST 001 upd';

describe('MessageClass lifecycle (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

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
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      hasConfig = true;
    } catch (_error) {
      testsLogger.warn?.(
        '⚠️ Skipping MessageClass tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset?.();
    }
  });

  it(
    'should execute the full MessageClass lifecycle',
    async () => {
      if (!hasConfig) {
        testsLogger.warn?.(`⚠️ Skipping: no SAP configuration`);
        return;
      }

      const mcHandler = client.getMessageClass();
      const msgHandler = client.getMessageClassMessage();

      testsLogger.info?.(`Creating message class ${MSG_CLASS_NAME}...`);

      // Defensive pre-cleanup: delete if a leftover exists from a prior failed run.
      // Errors are intentionally swallowed — if the class does not exist the
      // delete call will throw and we must proceed anyway.
      try {
        await mcHandler.delete({ name: MSG_CLASS_NAME });
        testsLogger.warn?.(
          `Pre-cleanup: deleted stale ${MSG_CLASS_NAME} before test`,
        );
      } catch {
        // Object did not exist — this is the normal path.
      }

      try {
        // ── Step 1: Create message class ────────────────────────────────────
        const createState = await mcHandler.create({
          name: MSG_CLASS_NAME,
          description: 'ADT integration test message class',
          packageName: PACKAGE_NAME,
        });
        expect(createState.errors).toHaveLength(0);
        testsLogger.info?.(`Created ${MSG_CLASS_NAME} successfully.`);

        // ── Step 2: Read message class ───────────────────────────────────────
        const readState = await mcHandler.read({ name: MSG_CLASS_NAME });
        expect(readState).toBeDefined();
        if (!readState) throw new Error('read() returned undefined');
        expect(readState.messageClass).toBeDefined();
        expect(readState.messageClass?.name).toBe(MSG_CLASS_NAME);
        testsLogger.info?.(
          `Read ${MSG_CLASS_NAME}: description="${readState.messageClass?.description}"`,
        );

        // ── Step 3: Create message 001 ───────────────────────────────────────
        const msgCreateState = await msgHandler.create({
          className: MSG_CLASS_NAME,
          msgno: MSG_NO,
          msgtext: MSG_TEXT_INITIAL,
        });
        expect(msgCreateState.errors).toHaveLength(0);
        testsLogger.info?.(`Added message ${MSG_NO} to ${MSG_CLASS_NAME}.`);

        // ── Step 4: Read message 001 ─────────────────────────────────────────
        const msgReadState = await msgHandler.read({
          className: MSG_CLASS_NAME,
          msgno: MSG_NO,
        });
        expect(msgReadState).toBeDefined();
        if (!msgReadState)
          throw new Error('msgHandler.read() returned undefined');
        expect(msgReadState.message).toBeDefined();
        expect(msgReadState.message?.msgtext).toBe(MSG_TEXT_INITIAL);
        testsLogger.info?.(
          `Read message ${MSG_NO}: "${msgReadState.message?.msgtext}"`,
        );

        // ── Step 5: Update message 001 ───────────────────────────────────────
        const msgUpdateState = await msgHandler.update({
          className: MSG_CLASS_NAME,
          msgno: MSG_NO,
          msgtext: MSG_TEXT_UPDATED,
        });
        expect(msgUpdateState.errors).toHaveLength(0);

        // Read back to verify the update took effect.
        const msgReadAfterUpdate = await msgHandler.read({
          className: MSG_CLASS_NAME,
          msgno: MSG_NO,
        });
        expect(msgReadAfterUpdate).toBeDefined();
        if (!msgReadAfterUpdate)
          throw new Error('msgHandler.read() after update returned undefined');
        expect(msgReadAfterUpdate.message?.msgtext).toBe(MSG_TEXT_UPDATED);
        testsLogger.info?.(
          `Updated message ${MSG_NO}: "${msgReadAfterUpdate.message?.msgtext}"`,
        );

        // ── Step 6: Delete message 001 ───────────────────────────────────────
        const msgDeleteState = await msgHandler.delete({
          className: MSG_CLASS_NAME,
          msgno: MSG_NO,
        });
        expect(msgDeleteState.errors).toHaveLength(0);

        // Read the class again and verify that message 001 is gone.
        const readAfterMsgDelete = await mcHandler.read({
          name: MSG_CLASS_NAME,
        });
        expect(readAfterMsgDelete).toBeDefined();
        if (!readAfterMsgDelete)
          throw new Error(
            'mcHandler.read() after message delete returned undefined',
          );
        const remainingMessages =
          readAfterMsgDelete.messageClass?.messages ?? [];
        const msg001 = remainingMessages.find((m) => m.msgno === MSG_NO);
        expect(msg001).toBeUndefined();
        testsLogger.info?.(
          `Deleted message ${MSG_NO}; remaining messages: ${remainingMessages.length}`,
        );
      } finally {
        // ── Cleanup: always delete the message class ─────────────────────────
        try {
          await mcHandler.delete({ name: MSG_CLASS_NAME });
          testsLogger.info?.(`Cleanup: deleted ${MSG_CLASS_NAME}.`);
        } catch (cleanupError: any) {
          testsLogger.warn?.(
            `Cleanup warning: could not delete ${MSG_CLASS_NAME}: ${cleanupError?.message}`,
          );
        }
      }
    },
    getTimeout('test'),
  );
});
