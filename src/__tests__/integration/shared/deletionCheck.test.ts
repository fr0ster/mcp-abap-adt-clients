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
 * two types. A transport request is the exception: the service has no URI
 * mapping for it, so its `checkDeletion` reads the request's own document
 * (`AdtRequest.checkDeletion`), and a number no system has answers 404
 * (measured on premise). Its check asks about the run's own request,
 * `environment.default_transport` — a read, which releases and deletes
 * nothing — and must answer that request's document. A refused check fails
 * the test with what SAP said: a test
 * never passes over a refused operation, so a type the service does not
 * resolve shows up red, for its case to be decided, rather than green.
 *
 * **Every assertion here is about the shape of the answer, never about a
 * verdict.** Whether a given object can be deleted right now depends on the
 * system's state, which is the whole reason the member exists; a test that
 * required `isDeletable="true"` would be asserting the fixture, not the client.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/deletionCheck
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtClient } from '../../../clients/AdtClient';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { gateOn } from '../../helpers/caseGate';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const { getDefaultTransport } = require('../../helpers/test-helper');

const testsLogger: ILogger = createTestsLogger();

/** A name no system has, so the answer is about the address and nothing else. */
const NEVER_EXISTS = 'ZZ_NO_SUCH_OBJECT_ZZ';

describe('Shared - the deletion check, per type', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  /**
   * The three whose check had never been asked.
   *
   * Each must answer its document — the deletion one, or for a request the
   * request's own; a refusal fails, naming the type and SAP's own sentence.
   */
  const unmeasured: {
    label: string;
    ask: () => Promise<{ ok: boolean; text: string }>;
    /** What the answer must hold: the deletion document, or the request's. */
    expected: () => string;
  }[] = [
    {
      label: 'PROG/I include',
      ask: async () => {
        const answer = await client.getInclude().checkDeletion(
          { includeName: NEVER_EXISTS },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(client.getInclude(), 'checkDeletion'),
          },
        );
        return answer.ok
          ? { ok: true, text: String(answer.getResult().value) }
          : { ok: false, text: answer.getError().message };
      },
      expected: () => 'del:',
    },
    {
      label: 'DDLX metadata extension',
      ask: async () => {
        const answer = await client.getMetadataExtension().checkDeletion(
          { name: NEVER_EXISTS },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(
              client.getMetadataExtension(),
              'checkDeletion',
            ),
          },
        );
        return answer.ok
          ? { ok: true, text: String(answer.getResult().value) }
          : { ok: false, text: answer.getError().message };
      },
      expected: () => 'del:',
    },
    {
      label: 'transport request',
      ask: async () => {
        // The run's own request: a number no system has answers 404.
        const transportNumber = getDefaultTransport();
        if (!transportNumber) {
          throw new Error(
            'environment.default_transport is empty: there is no request to ask about',
          );
        }
        const answer = await client.getRequest().checkDeletion(
          { transportNumber },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(client.getRequest(), 'checkDeletion'),
          },
        );
        return answer.ok
          ? { ok: true, text: String(answer.getResult().value) }
          : { ok: false, text: answer.getError().message };
      },
      expected: () => `tm:number="${getDefaultTransport()}"`,
    },
  ];

  for (const { label, ask, expected } of unmeasured) {
    gateOn(() => true)(
      `answers the deletion check for a ${label}`,
      async () => {
        logTestStep(`deletion check for a ${label}`, testsLogger);

        const { ok, text } = await ask();
        testsLogger.info?.(
          `📄 ${label}: ${ok ? 'result' : 'failure'} — ${text.slice(0, 200)}`,
        );
        if (!ok) {
          throw new Error(`deletion check for a ${label} refused: ${text}`);
        }
        expect(text).toContain(expected());
      },
      60000,
    );
  }

  gateOn(() => true)(
    'a class answers the deletion document, and it is the deletion one',
    async () => {
      logTestStep(
        `deletion check for a class that does not exist`,
        testsLogger,
      );

      const answer = await client.getClass().checkDeletion(
        { className: NEVER_EXISTS },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getClass(), 'checkDeletion'),
        },
      );

      // A class is one of the twenty-six the service is known to resolve, so this
      // is the control: whatever the three above do, this one has to answer, and
      // it has to answer `del:`-namespaced content rather than `chkl:messages`.
      // The two documents shared a strategy slot for one commit, and only a live
      // answer proves they no longer do.
      const text = answer.ok
        ? String(answer.getResult().value)
        : answer.getError().message;
      testsLogger.info?.(`📄 class: ${text.slice(0, 200)}`);

      if (!answer.ok) {
        throw new Error(`deletion check for a class refused: ${text}`);
      }
      expect(text).toContain('del:');
      expect(text).not.toContain('chkl:messages');
    },
    60000,
  );
});
