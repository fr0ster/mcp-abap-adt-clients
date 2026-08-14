/**
 * Check 3 — every capability a handler claims does what that capability means.
 *
 * Types are not enough here, and the two failures this catches are the two the
 * plan exists for:
 *
 * - a method that **carries** an atom and refuses when called. That is a stub,
 *   and the shape check cannot see it: a class with a throwing `getVersions`
 *   satisfies `IAdtVersionable` perfectly.
 * - a method that issues **no request at all** and returns an empty state,
 *   which reads to a caller as success. `unitTest.validate` and
 *   `transport.validate` both did exactly that.
 *
 * So each claimed capability is called against a recording connection, and the
 * assertion is that a request went out. Every method of every atom, not one per
 * atom — `readMetadata`, `unlock` and `getVersionSource` are where stubs hid.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { createLibraryLogger } from '../../helpers/testLogger';
import { ATOM_METHODS, type Atom, HANDLERS } from './manifest';

type Recorded = { url: string; method: string };

/**
 * Answers every request with a body the low-level parsers accept.
 *
 * A realistic body matters: an empty one is what let read-modify-write corrupt
 * updates silently, and it would let this guard pass vacuously too.
 */
const GENERIC_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <asx:values><DATA><LOCK_HANDLE>GUARD-LOCK</LOCK_HANDLE></DATA></asx:values>
  <chkl:messages/>
  <atom:feed><atom:entry><atom:title>1</atom:title></atom:entry></atom:feed>
</asx:abap>`;

function recordingClient(body: string = GENERIC_BODY) {
  const calls: Recorded[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (req: Recorded) => {
      calls.push({ url: req.url, method: req.method });
      return {
        status: 200,
        statusText: 'OK',
        headers: { location: '/sap/bc/adt/abapunit/runs/GUARD' },
        data: body,
      } as IAdtResponse;
    },
  } as unknown as IAbapConnection;

  // The factories assert the connection is connected, but only when it says it
  // can answer that — a connection without isConnected() is taken at its word,
  // which is what this stub is.
  const client = new AdtClient(connection, createLibraryLogger());
  return { client, calls };
}

/** Call one method of one atom with arguments that fit its signature. */
async function invoke(
  handler: Record<string, unknown>,
  method: string,
  config: Record<string, unknown>,
): Promise<void> {
  const fn = handler[method] as (...args: unknown[]) => Promise<unknown>;
  switch (method) {
    case 'unlock':
      await fn.call(handler, config, 'GUARD-LOCK');
      return;
    case 'getVersionSource':
      await fn.call(handler, '/sap/bc/adt/guard/versions/1');
      return;
    case 'check':
      await fn.call(handler, config, 'inactive');
      return;
    default:
      await fn.call(handler, config);
  }
}

/**
 * Activation is judged by the messages, and a failure has to reach the caller.
 *
 * This is the one assertion that would have caught `functionGroup.activate`:
 * it POSTed correctly and then ignored the answer, so a failed activation came
 * back as `errors: []`. Asserting only that a POST went out would have passed.
 */
const FAILED_ACTIVATION = `<?xml version="1.0" encoding="utf-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <msg objDescr="ZGUARD" type="E" line="1" href="/sap/bc/adt/guard">
    <shortText><txt>Object could not be activated</txt></shortText>
  </msg>
</chkl:messages>`;

describe('capability guard — activation reports failure', () => {
  for (const [name, entry] of Object.entries(HANDLERS)) {
    if (!entry.capabilities.includes('activatable')) continue;

    it(`${name}: an error-severity message reaches the caller`, async () => {
      const { client } = recordingClient(FAILED_ACTIVATION);
      const handler = entry.factory(client) as Record<string, unknown>;
      const activate = handler.activate as (
        c: unknown,
      ) => Promise<{ errors?: unknown[] }>;

      let reached = false;
      try {
        const state = await activate.call(handler, entry.config);
        reached = (state?.errors?.length ?? 0) > 0;
      } catch {
        reached = true;
      }

      expect(reached).toBe(true);
    });
  }
});

describe('capability guard — behaviour', () => {
  for (const [name, entry] of Object.entries(HANDLERS)) {
    describe(name, () => {
      for (const atom of entry.capabilities) {
        for (const method of ATOM_METHODS[atom as Atom]) {
          it(`${atom}: ${method} issues a request`, async () => {
            const { client, calls } = recordingClient();
            const handler = entry.factory(client) as Record<string, unknown>;

            expect(typeof handler[method]).toBe('function');

            let refusal: unknown;
            try {
              await invoke(handler, method, entry.config);
            } catch (error) {
              refusal = error;
            }

            // Either it issued a request, or it refused. A method that does
            // neither returned success without doing anything, which is the
            // shape of every stub this plan removed.
            if (calls.length === 0) {
              throw new Error(
                refusal
                  ? `${name}.${method} refused without issuing a request: ${String(refusal)}`
                  : `${name}.${method} returned without issuing any request — an empty success`,
              );
            }
          });
        }
      }
    });
  }
});
