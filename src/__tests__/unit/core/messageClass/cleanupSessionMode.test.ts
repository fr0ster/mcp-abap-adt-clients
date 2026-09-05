/**
 * A failed PUT must not leave the message-class locks behind.
 *
 * The save runs `stateless` on purpose — the handle authorises it, and Eclipse
 * keeps the PUT off the enqueue session. That makes the failure path a trap: if
 * the PUT is refused, the connection is still `stateless` when cleanup starts,
 * and an unlock sent that way never reaches the session holding the handles. The
 * `catch` around each unlock swallows the refusal, so the lock stays on the
 * object and nothing says so.
 *
 * These cases assert the session mode **at the moment each unlock is sent**,
 * because that is the thing that was wrong. Asserting only that unlock was
 * called would have passed before the fix.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtMessageClassMessage } from '../../../../core/messageClass/AdtMessageClassMessage';
import { expectFailure } from '../../../helpers/contract';

const CLASS_XML = `<?xml version="1.0" encoding="utf-8"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/messageclass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZTEST_MSG" adtcore:description="d"><mc:messages><mc:message mc:msgno="001" mc:msgtext="existing"/></mc:messages></mc:messageClass>`;
const LOCK_XML = `<?xml version="1.0" encoding="utf-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH1</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

interface Sent {
  url: string;
  method: string;
  /** The session mode in force when this request was sent. */
  mode: string;
}

/** A connection whose PUT always fails, recording the mode of every request. */
function createConnection() {
  const sent: Sent[] = [];
  let mode = 'stateless';

  const connection = {
    setSessionType: jest.fn((next: string) => {
      mode = next;
    }),
    makeAdtRequest: jest.fn(async (request: any) => {
      const url = String(request.url);
      sent.push({ url, method: String(request.method), mode });

      if (request.method === 'PUT') {
        throw new Error('save refused');
      }
      if (url.includes('_action=LOCK')) {
        return { status: 200, data: LOCK_XML, headers: {} };
      }
      return { status: 200, data: CLASS_XML, headers: {} };
    }),
  } as unknown as IAbapConnection;

  return { connection, sent };
}

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

/** Unlocks, in the order they were sent, with the mode each went out under. */
const unlocksOf = (sent: Sent[]) =>
  sent.filter((r) => r.url.includes('UNLOCK'));

describe('message-class cleanup after a refused PUT', () => {
  it('sends every unlock on the lock session, not the one the PUT used', async () => {
    const { connection, sent } = createConnection();

    expect(
      expectFailure(
        await new AdtMessageClassMessage(connection, logger).update({
          className: 'ZTEST_MSG',
          msgno: '001',
          msgtext: 'changed',
        }),
        'update whose save the server refused',
      ).message,
    ).toMatch(/save refused/);

    const put = sent.find((r) => r.method === 'PUT');
    expect(put?.mode).toBe('stateless'); // the deliberate part

    const unlocks = unlocksOf(sent);
    expect(unlocks.length).toBeGreaterThan(0);
    for (const unlock of unlocks) {
      // Before the fix these went out `stateless` — the mode the failed PUT
      // left behind — and the server's refusal was swallowed.
      expect(unlock.mode).toBe('stateful');
    }
  });

  it('does the same on the delete chain', async () => {
    const { connection, sent } = createConnection();

    expect(
      expectFailure(
        await new AdtMessageClassMessage(connection, logger).delete({
          className: 'ZTEST_MSG',
          msgno: '001',
        }),
        'delete whose save the server refused',
      ).message,
    ).toMatch(/save refused/);

    const unlocks = unlocksOf(sent);
    expect(unlocks.length).toBeGreaterThan(0);
    for (const unlock of unlocks) {
      expect(unlock.mode).toBe('stateful');
    }
  });
});
