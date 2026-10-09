/**
 * The lock-release check, without a system.
 *
 * What it must get right is small and easy to get wrong: a refused LOCK from
 * the second session fails with SAP's own sentence, a granted one is released
 * again, and the second session is closed whatever happened — the trial grants
 * two, and a check that leaked its session would take the run's last one.
 *
 * The refusal is the recorded one (`corpus/adt/refusal-lock-held-by-other`),
 * answered through a real `AdtClass` on a fake connection, so the text asserted
 * is what `analyseException` reads out of SAP's document.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { AdtClass } from '../../../core/class/AdtClass';
import { AdtDomain } from '../../../core/domain/AdtDomain';
import {
  factoryOf,
  type IVerifierSession,
  lockReleaseCheckEnabled,
  verifyLockReleased,
} from '../../helpers/lockReleased';
import { sessionToJoin } from '../../helpers/sessionConfig';

const CORPUS = path.resolve(__dirname, '../../../../corpus/adt');
const HELD_BODY = fs.readFileSync(
  path.join(CORPUS, 'refusal-lock-held-by-other--01-lock.body.xml'),
  'utf8',
);

const exception = (text: string) =>
  '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceNotFound"/>' +
  `<message lang="EN">${text}</message></exc:exception>`;
const MISSING_BODY = exception('CLASS ZCL_LOCKREL_UNIT does not exist');
const FORBIDDEN_BODY = exception('No authorization for S_DEVELOP');

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA>' +
  '<LOCK_HANDLE>HANDLE123</LOCK_HANDLE></DATA></asx:values></asx:abap>';

type Answer = 'granted' | 'held' | 'throws' | 'missing' | 'forbidden';

/** A connection answering LOCK as told, recording every request it sees. */
function fakeConnection(
  lock: Answer,
  unlockStatus = 200,
  missingTimes = Number.POSITIVE_INFINITY,
) {
  let missingSeen = 0;
  const calls: Array<{ method?: string; url: string }> = [];
  const conn = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (req: { method?: string; url: string }) => {
      calls.push({ method: req.method, url: String(req.url) });
      if (String(req.url).includes('_action=LOCK')) {
        if (lock === 'throws') throw new TypeError('socket hang up');
        if (lock === 'missing' && missingSeen < missingTimes) {
          missingSeen += 1;
          throw {
            message: 'Request failed with status code 404',
            response: {
              status: 404,
              statusText: 'Not Found',
              headers: { 'content-type': 'application/xml' },
              data: MISSING_BODY,
            } as IAdtWireResponse,
          };
        }
        if (lock === 'forbidden') {
          throw {
            message: 'Request failed with status code 403',
            response: {
              status: 403,
              statusText: 'Forbidden',
              headers: { 'content-type': 'application/xml' },
              data: FORBIDDEN_BODY,
            } as IAdtWireResponse,
          };
        }
        if (lock === 'held') {
          throw {
            message: 'Request failed with status code 403',
            response: {
              status: 403,
              statusText: 'Forbidden',
              headers: { 'content-type': 'application/xml' },
              data: HELD_BODY,
            } as IAdtWireResponse,
          };
        }
        return { status: 200, headers: {}, data: LOCK_XML };
      }
      if (String(req.url).includes('_action=UNLOCK') && unlockStatus >= 400) {
        throw {
          message: `Request failed with status code ${unlockStatus}`,
          response: { status: unlockStatus, headers: {}, data: '' },
        };
      }
      return { status: 200, headers: {}, data: '' };
    }),
  };
  return { conn: conn as unknown as IAbapConnection, calls };
}

/** A session opener whose close is observable. */
function fakeSession() {
  const close = jest.fn(async () => {});
  const open = jest.fn(
    async (): Promise<IVerifierSession> => ({
      client: {} as AdtClient,
      close,
    }),
  );
  return { open, close };
}

const config = { className: 'ZCL_LOCKREL_UNIT' };

describe('verifyLockReleased', () => {
  it('fails with SAP’s sentence when the second session is refused the lock', async () => {
    const { conn, calls } = fakeConnection('held');
    const { open, close } = fakeSession();

    const check = verifyLockReleased(
      open,
      () => new AdtClass(conn),
      config,
      'class ZCL_LOCKREL_UNIT',
    );

    await expect(check).rejects.toThrow(
      /class ZCL_LOCKREL_UNIT: the previous UNLOCK did not release the lock/,
    );
    await expect(check).rejects.toThrow(/HTTP 403/);
    await expect(check).rejects.toThrow(
      /User SAPUSER01 is currently editing ZMCP_BLD_ANSCH01/,
    );
    await expect(check).rejects.toThrow(/\[EU\/510\]/);
    // Refused: there is no handle, so nothing was unlocked.
    expect(calls.some((c) => c.url.includes('_action=UNLOCK'))).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('releases a granted lock and closes the session', async () => {
    const { conn, calls } = fakeConnection('granted');
    const { open, close } = fakeSession();

    await verifyLockReleased(
      open,
      () => new AdtClass(conn),
      config,
      'class ZCL_LOCKREL_UNIT',
    );

    const unlock = calls.find((c) => c.url.includes('_action=UNLOCK'));
    expect(unlock?.url).toContain('lockHandle=HANDLE123');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('fails when the verifying session cannot release what it took', async () => {
    const { conn } = fakeConnection('granted', 500);
    const { open, close } = fakeSession();

    await expect(
      verifyLockReleased(open, () => new AdtClass(conn), config, 'class X'),
    ).rejects.toThrow(/took the lock but could not release it \(HTTP 500\)/);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the session when the lock itself throws', async () => {
    const { open, close } = fakeSession();
    const exploding = {
      lock: jest.fn(async () => {
        throw new Error('defect in the handler');
      }),
      unlock: jest.fn(),
    };

    await expect(
      verifyLockReleased(open, () => exploding as any, config, 'class X'),
    ).rejects.toThrow('defect in the handler');
    expect(exploding.unlock).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the session when the connection fails under the lock', async () => {
    const { conn } = fakeConnection('throws');
    const { open, close } = fakeSession();

    await expect(
      verifyLockReleased(open, () => new AdtClass(conn), config, 'class X'),
    ).rejects.toThrow(/socket hang up/);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports the finding, not a failing close', async () => {
    const { conn } = fakeConnection('held');
    const close = jest.fn(async () => {
      throw new Error('logoff failed');
    });
    const warn = jest.fn();

    await expect(
      verifyLockReleased(
        async () => ({ client: {} as AdtClient, close }),
        () => new AdtClass(conn),
        config,
        'class X',
        { warn } as any,
      ),
    ).rejects.toThrow(/did not release the lock/);
    expect(close).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });
});

describe('lockReleaseCheckEnabled', () => {
  const saved = process.env.VERIFY_LOCK_RELEASED;
  afterEach(() => {
    if (saved === undefined) delete process.env.VERIFY_LOCK_RELEASED;
    else process.env.VERIFY_LOCK_RELEASED = saved;
  });

  it('is on unless VERIFY_LOCK_RELEASED=false', () => {
    delete process.env.VERIFY_LOCK_RELEASED;
    expect(lockReleaseCheckEnabled()).toBe(true);
    process.env.VERIFY_LOCK_RELEASED = 'true';
    expect(lockReleaseCheckEnabled()).toBe(true);
    process.env.VERIFY_LOCK_RELEASED = 'false';
    expect(lockReleaseCheckEnabled()).toBe(false);
  });
});

describe('factoryOf', () => {
  it('names the client factory that builds the same class of handler', () => {
    const { conn } = fakeConnection('granted');
    class FakeClient {
      getUtils() {
        return {};
      }
      getClass() {
        return new AdtClass(conn);
      }
      getDomain() {
        return new AdtDomain(conn);
      }
      getNeedsArgument(_x: string) {
        return new AdtDomain(conn);
      }
    }
    const client = new FakeClient();
    expect(factoryOf(client, new AdtDomain(conn))).toBe('getDomain');
    expect(factoryOf(client, new AdtClass(conn))).toBe('getClass');
    expect(factoryOf(client, { constructor: Map })).toBeUndefined();
  });

  it('on the real client, a class include resolves to its own factory — whose lock is the class’s', () => {
    const { conn } = fakeConnection('granted');
    const client = new AdtClient(conn);
    expect(factoryOf(client, client.getLocalTestClass())).toBe(
      'getLocalTestClass',
    );
    expect(factoryOf(client, client.getClass())).toBe('getClass');
    expect(factoryOf(client, client.getMessageClass())).toBe('getMessageClass');
    expect(factoryOf(client, client.getInclude())).toBe('getInclude');
    expect(['getServiceBinding', 'getService']).toContain(
      factoryOf(client, client.getServiceBinding()),
    );
  });
});

describe('sessionToJoin', () => {
  const saved = process.env.PER_FILE_SESSION;
  afterEach(() => {
    if (saved === undefined) delete process.env.PER_FILE_SESSION;
    else process.env.PER_FILE_SESSION = saved;
  });
  const material = { cookies: 'SAP_SESSIONID_X=1', csrf: 't', id: 'c' };

  it('an own session adopts nothing — the run’s material is not even read', () => {
    delete process.env.PER_FILE_SESSION;
    const read = jest.fn(() => material);
    expect(sessionToJoin({ ownSession: true }, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('by default joins the session the run published', () => {
    delete process.env.PER_FILE_SESSION;
    const read = jest.fn(() => material);
    expect(sessionToJoin({}, read)).toBe(material);
    expect(sessionToJoin(undefined, read)).toBe(material);
  });

  it('PER_FILE_SESSION=1 still opens its own', () => {
    process.env.PER_FILE_SESSION = '1';
    const read = jest.fn(() => material);
    expect(sessionToJoin({}, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});

describe('verifyLockReleased — answers that are not a held lock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // Measured on the cloud trial: a class created seconds before answered a
  // second session's LOCK with 404 "does not exist", and the same test passed
  // alone. A new session can land on another application server. That is not
  // a held lock, and the check must not say it is.
  it('retries an object the second session cannot see, and takes the lock once it can', async () => {
    const { conn, calls } = fakeConnection('missing', 200, 2);
    const { open, close } = fakeSession();

    const check = verifyLockReleased(
      open,
      () => new AdtClass(conn),
      config,
      'x',
    );
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(check).resolves.toBeUndefined();

    const locks = calls.filter((c) => c.url.includes('_action=LOCK'));
    expect(locks).toHaveLength(3);
    expect(calls.some((c) => c.url.includes('_action=UNLOCK'))).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('warns instead of failing when the object stays invisible', async () => {
    const { conn } = fakeConnection('missing');
    const { open, close } = fakeSession();
    const warn = jest.fn();

    const check = verifyLockReleased(
      open,
      () => new AdtClass(conn),
      config,
      'class ZCL_LOCKREL_UNIT',
      { warn, debug: jest.fn(), info: jest.fn(), error: jest.fn() },
    );
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(check).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /inconclusive.*not visible.*HTTP 404.*does not exist/,
      ),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not call a refusal for another reason a held lock', async () => {
    const { conn } = fakeConnection('forbidden');
    const { open, close } = fakeSession();

    const check = verifyLockReleased(
      open,
      () => new AdtClass(conn),
      config,
      'x',
    );
    await expect(check).rejects.toThrow(/could not be made/);
    await expect(check).rejects.not.toThrow(/did not release the lock/);
    await expect(check).rejects.toThrow(/S_DEVELOP/);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
