/**
 * What the deletion service says, per type — measured, not assumed.
 *
 * `checkDeletion` became a member of `IAdtDeletable` in 18.0.0, and three of the
 * types that got one had never been asked: a standalone include (`PROG/I`), a
 * metadata extension (`DDLX`) and a transport request. Their own `delete` does
 * not go through `/sap/bc/adt/deletion/delete` at all — they DELETE their own
 * URL — so whether the deletion *service* resolves their URI was a guess.
 *
 * It is a guess this file exists to end. The measured fact behind the design is
 * that the service is asked about an **address**: a check for
 * `/sap/bc/adt/messageclass/z_msg_test_0001` came back naming
 * `adtcore:type="MSAG/N"` and the package it resolved to. If that holds for an
 * address whose object is deleted another way, the member is honest for those
 * three types; if the server refuses, the refusal is the answer and a caller
 * reads it — which is also honest, and worth knowing rather than assuming.
 *
 * **Every assertion here is about the shape of the answer, never about a
 * verdict.** Whether a given object can be deleted right now depends on the
 * system's state, which is the whole reason the member exists; a test that
 * required `isDeletable="true"` would be asserting the fixture, not the client.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/deletionCheck
 */

import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import type { AdtClient } from '../../../clients/AdtClient';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestSkip, logTestStep } from '../../helpers/testProgressLogger';

const testsLogger: ILogger = createTestsLogger();

/** A name no system has, so the answer is about the address and nothing else. */
const NEVER_EXISTS = 'ZZ_NO_SUCH_OBJECT_ZZ';

describe('Shared - the deletion check, per type', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
      hasConfig = true;
    } catch (error) {
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  /**
   * The three whose URI had never been put to the service.
   *
   * Each answers *something* — a document or a refusal — and this records which,
   * with the server's own sentence, so the next reader does not have to guess
   * either.
   */
  const unmeasured: {
    label: string;
    ask: () => Promise<{ ok: boolean; text: string }>;
  }[] = [
    {
      label: 'PROG/I include',
      ask: async () => {
        const answer = await client
          .getInclude()
          .checkDeletion({ includeName: NEVER_EXISTS });
        return answer.ok
          ? { ok: true, text: String(answer.getResult().value) }
          : { ok: false, text: answer.getError().message };
      },
    },
    {
      label: 'DDLX metadata extension',
      ask: async () => {
        const answer = await client
          .getMetadataExtension()
          .checkDeletion({ name: NEVER_EXISTS });
        return answer.ok
          ? { ok: true, text: String(answer.getResult().value) }
          : { ok: false, text: answer.getError().message };
      },
    },
    {
      label: 'transport request',
      ask: async () => {
        const answer = await client
          .getRequest()
          .checkDeletion({ transportNumber: NEVER_EXISTS });
        return answer.ok
          ? { ok: true, text: String(answer.getResult().value) }
          : { ok: false, text: answer.getError().message };
      },
    },
  ];

  for (const { label, ask } of unmeasured) {
    it(`answers for a ${label}, one way or the other`, async () => {
      if (!hasConfig) {
        logTestSkip(
          testsLogger,
          `deletion check — ${label}`,
          'No SAP configuration',
        );
        return;
      }
      logTestStep(`deletion check for a ${label}`, testsLogger);

      const { ok, text } = await ask();

      // Recorded rather than judged. What must not happen is the third thing:
      // an empty success, which is how a refusal used to reach a caller.
      testsLogger.info?.(
        `📄 ${label}: ${ok ? 'result' : 'failure'} — ${text.slice(0, 200)}`,
      );
      expect(text.length).toBeGreaterThan(0);
    }, 60000);
  }

  it('a class answers the deletion document, and it is the deletion one', async () => {
    if (!hasConfig) {
      logTestSkip(
        testsLogger,
        'deletion check — class',
        'No SAP configuration',
      );
      return;
    }
    logTestStep(`deletion check for a class that does not exist`, testsLogger);

    const answer = await client
      .getClass()
      .checkDeletion({ className: NEVER_EXISTS });

    // A class is one of the twenty-six the service is known to resolve, so this
    // is the control: whatever the three above do, this one has to answer, and
    // it has to answer `del:`-namespaced content rather than `chkl:messages`.
    // The two documents shared a strategy slot for one commit, and only a live
    // answer proves they no longer do.
    const text = answer.ok
      ? String(answer.getResult().value)
      : answer.getError().message;
    testsLogger.info?.(`📄 class: ${text.slice(0, 200)}`);

    if (answer.ok) {
      expect(text).toContain('del:');
      expect(text).not.toContain('chkl:messages');
    } else {
      expect(answer.getError().message.length).toBeGreaterThan(0);
      expect(['connection', 'refusal']).toContain(answer.getError().origin);
    }
  }, 60000);
});
