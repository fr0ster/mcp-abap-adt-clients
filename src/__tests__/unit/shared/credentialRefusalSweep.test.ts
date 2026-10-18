/**
 * A credential refusal SAP was never asked about, through every place in this
 * library that catches what a request threw.
 *
 * `answering` rethrows the connection's `AuthRefusedError` as the same object
 * (`credentialRefusals.test.ts`). These pin the rest: no chain, lock registry,
 * batch or wrapper converts, wraps, swallows or writes onto it, and cleanup
 * that must run still runs.
 *
 * The connection's own class is used, not a copy.
 */

import { AuthRefusedError } from '@mcp-abap-adt/connection';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtBatchConnection } from '../../../batch';
import { AdtClient } from '../../../clients/AdtClient';
import { AdtClass } from '../../../core/class/AdtClass';
import { AdtMessageClassMessage } from '../../../core/messageClass/AdtMessageClassMessage';
import { chain } from '../../../core/shared/chain';
import { LockRegistry } from '../../../core/shared/LockRegistry';
import { makeAdtRequestWithAcceptNegotiation } from '../../../utils/acceptNegotiation';
import {
  answering,
  failed,
  isUnansweredCredentialRefusal,
} from '../../../utils/adtResponse';
import { fetchDiscoveryEndpoints } from '../../../utils/discoveryEndpoints';
import { noopLogger } from '../../../utils/noopLogger';
import { withRequestTrace } from '../../../utils/requestTrace';
import { rawDocument } from '../../../utils/resultStrategy';
import {
  getSystemInformation,
  isModernAdtSystem,
} from '../../../utils/systemInfo';
import { headersOf } from '../../helpers/adtHeaders';

/** A refusal the provider raised before SAP was asked. */
function refused(): AuthRefusedError {
  return new AuthRefusedError(
    {} as never,
    'request',
    new Error('the provider gave up'),
  );
}

/** The own property names of a value, to show nothing was written onto it. */
function ownKeys(value: object): string[] {
  return Reflect.ownKeys(value).map(String).sort();
}

function logger(): ILogger & { warn: jest.Mock } {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as ILogger & { warn: jest.Mock };
}

const LOCK = (h: string) =>
  `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${h}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;
const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="T1"/></mc:messageClass>`;

/** A message-class connection whose request matching `refuseAt` is refused. */
function messageClassConnection(
  refuseAt: (o: { method: string; url: string }) => boolean,
  thrown: unknown,
) {
  const calls: string[] = [];
  const connection = {
    setSessionType: () => {},
    makeAdtRequest: async (o: { method: string; url: string }) => {
      calls.push(`${o.method} ${o.url}`);
      if (refuseAt(o)) throw thrown;
      if (String(o.url).includes('_action=LOCK'))
        return { data: LOCK('H'), status: 200, headers: {} };
      if (o.method === 'GET')
        return { data: CLASS_XML, status: 200, headers: {} };
      return { data: '', status: 200, headers: {} };
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
}

describe('a message-class write (chain)', () => {
  it('rejects with the same object when the PUT is refused, and still unlocks', async () => {
    const thrown = refused();
    const keys = ownKeys(thrown);
    const { connection, calls } = messageClassConnection(
      (o) => o.method === 'PUT',
      thrown,
    );

    await expect(
      new AdtMessageClassMessage(connection, noopLogger).update(
        {
          className: 'ZT',
          msgno: '001',
          msgtext: 'NEW',
        },
        {
          headers: headersOf(
            new AdtMessageClassMessage(connection, noopLogger),
            'update',
          ),
        },
      ),
    ).rejects.toBe(thrown);

    expect(calls.some((c) => c.includes('_action=UNLOCK_ALL'))).toBe(true);
    expect(
      calls.some((c) => c.includes('_action=UNLOCK') && !c.includes('_ALL')),
    ).toBe(true);
    expect(ownKeys(thrown)).toEqual(keys);
  });

  it('rejects with the same object when the class lock is refused, and still releases the message lock', async () => {
    const thrown = refused();
    const { connection, calls } = messageClassConnection(
      (o) => o.url.includes('_action=LOCK') && !o.url.includes('LOCK_MSG'),
      thrown,
    );

    await expect(
      new AdtMessageClassMessage(connection, noopLogger).update(
        {
          className: 'ZT',
          msgno: '001',
          msgtext: 'NEW',
        },
        {
          headers: headersOf(
            new AdtMessageClassMessage(connection, noopLogger),
            'update',
          ),
        },
      ),
    ).rejects.toBe(thrown);

    expect(calls.some((c) => c.includes('_action=UNLOCK_ALL'))).toBe(true);
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false);
  });
});

describe('a class create', () => {
  it('rejects with the same object when the POST is refused', async () => {
    const thrown = refused();
    const connection = {
      setSessionType: () => {},
      makeAdtRequest: async () => {
        throw thrown;
      },
    } as unknown as IAbapConnection;

    await expect(
      new AdtClass(connection, noopLogger).create(
        {
          className: 'ZCL_T',
          packageName: 'ZP',
          description: 'd',
        },
        { headers: headersOf(new AdtClass(connection, noopLogger), 'create') },
      ),
    ).rejects.toBe(thrown);
  });
});

describe('chain', () => {
  it('runs cleanup and rollback, then rejects with the same object, the rollback logged', async () => {
    const log = logger();
    const thrown = refused();
    const keys = ownKeys(thrown);
    const order: string[] = [];

    await expect(
      chain(log, async ({ step, onScopeEnd, onFailure }) => {
        onFailure(async () => {
          order.push('rollback');
          throw new Error('delete refused');
        });
        onScopeEnd(async () => {
          order.push('unlock');
        });
        await step(
          answering(async () => {
            throw thrown;
          }, rawDocument),
        );
      }),
    ).rejects.toBe(thrown);

    expect(order).toEqual(['unlock', 'rollback']);
    expect(ownKeys(thrown)).toEqual(keys);
    expect(log.warn).toHaveBeenCalledWith(
      'rollback did not complete before the credential refusal',
      { error: 'delete refused' },
    );
  });

  it('rejects with the refusal a cleanup met on a chain that succeeded', async () => {
    const thrown = refused();
    const cleaned: string[] = [];

    await expect(
      chain(logger(), async ({ onScopeEnd }) => {
        onScopeEnd(async () => {
          cleaned.push('stateless');
        });
        onScopeEnd(async () => {
          throw thrown;
        });
        return 'saved';
      }),
    ).rejects.toBe(thrown);

    // The refusal ends nothing early: every cleanup still ran.
    expect(cleaned).toEqual(['stateless']);
  });

  it('rejects with the refusal a cleanup met on a chain that failed, the failure logged', async () => {
    const log = logger();
    const thrown = refused();

    await expect(
      chain(log, async ({ step, onScopeEnd }) => {
        onScopeEnd(async () => {
          throw thrown;
        });
        await step(
          Promise.resolve(
            failed<string>({ origin: 'refusal', message: 'SAP said no' }),
          ),
        );
      }),
    ).rejects.toBe(thrown);

    expect(log.warn).toHaveBeenCalledWith(
      'chain failed before a cleanup met a credential refusal',
      { error: 'SAP said no' },
    );
  });

  it('still answers a cleanup failure that is not a refusal as before', async () => {
    const answer: IAdtResponse<string> = await chain(
      logger(),
      async ({ onScopeEnd }) => {
        onScopeEnd(async () => {
          throw new Error('unlock failed');
        });
        return 'saved';
      },
    );

    expect(answer.ok).toBe(true);
  });
});

describe('the lock registry', () => {
  it('stops at the refusal, keeps what was not released, and restores the session', async () => {
    const thrown = refused();
    const sessions: string[] = [];
    const registry = new LockRegistry({
      setSessionType: (t) => sessions.push(t),
    });
    const third = jest.fn(async () => undefined);
    registry.track('A', async () => undefined);
    registry.track('B', async () => {
      throw thrown;
    });
    registry.track('C', third);

    await expect(registry.unlockAll()).rejects.toBe(thrown);

    expect(third).not.toHaveBeenCalled();
    expect(registry.pending).toEqual(['B', 'C']);
    expect(sessions).toEqual(['stateful', 'stateless']);
  });

  it('still returns an ordinary unlock failure as a failure', async () => {
    const registry = new LockRegistry();
    const error = new Error('unlock failed');
    registry.track('A', async () => {
      throw error;
    });

    await expect(registry.unlockAll()).resolves.toEqual([{ key: 'A', error }]);
  });
});

describe('the request trace', () => {
  it('writes nothing onto a refusal, and rethrows it as it came', async () => {
    const thrown = refused();
    const keys = ownKeys(thrown);
    const connection = withRequestTrace({
      makeAdtRequest: async () => {
        throw thrown;
      },
    } as unknown as IAbapConnection);

    await expect(
      connection.makeAdtRequest({ method: 'GET', url: '/x', timeout: 0 }),
    ).rejects.toBe(thrown);
    expect(ownKeys(thrown)).toEqual(keys);
  });

  it('still traces an ordinary failure', async () => {
    const error = new Error('Request failed with status code 500');
    const connection = withRequestTrace({
      makeAdtRequest: async () => {
        throw error;
      },
    } as unknown as IAbapConnection);

    await expect(
      connection.makeAdtRequest({ method: 'GET', url: '/x', timeout: 0 }),
    ).rejects.toBe(error);
    expect((error as { request?: unknown }).request).toEqual({
      method: 'GET',
      url: '/x',
    });
  });
});

describe('catches that already let it through', () => {
  const refusing = (thrown: unknown) =>
    ({
      setSessionType: () => {},
      getBaseUrl: async () => '',
      makeAdtRequest: async () => {
        throw thrown;
      },
    }) as unknown as IAbapConnection;

  it.each([
    ['discovery', (c: IAbapConnection) => fetchDiscoveryEndpoints(c)],
    ['system information', (c: IAbapConnection) => getSystemInformation(c)],
    ['modern ADT probe', (c: IAbapConnection) => isModernAdtSystem(c)],
    [
      'accept negotiation',
      (c: IAbapConnection) =>
        makeAdtRequestWithAcceptNegotiation(c, {
          method: 'GET',
          url: '/x',
          timeout: 0,
        }),
    ],
  ])('%s rejects with the same object', async (_, run) => {
    const thrown = refused();
    await expect(run(refusing(thrown))).rejects.toBe(thrown);
  });
});

describe('a batch whose envelope is refused before SAP', () => {
  function batchFixture(thrown: unknown) {
    const send = jest.fn(
      async (_request: unknown): Promise<IAdtWireResponse> => {
        throw thrown;
      },
    );
    const connection = {
      makeAdtRequest: send,
      setSessionType: jest.fn(),
      connect: jest.fn(),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => 'session',
    } as unknown as IAbapConnection;
    return {
      batch: new AdtBatchConnection(connection, { endpoint: 'communication' }),
      send,
    };
  }
  const req = { method: 'POST', url: '/test', timeout: 0 };

  it('rejects every part, sent, unsent or recorded while settling, with the same object', async () => {
    const thrown = refused();
    const { batch, send } = batchFixture(thrown);
    batch.setSessionType('stateful');
    const locked = batch
      .makeAdtRequest({ ...req, url: '/test?_action=LOCK' })
      .catch((e) => e);
    const unsent = batch.makeAdtRequest(req).catch((e) => e);
    let late: Promise<unknown> | undefined;
    send.mockImplementationOnce(async () => {
      late = batch.makeAdtRequest(req).catch((e) => e);
      throw thrown;
    });

    await expect(batch.execute()).rejects.toBe(thrown);

    expect(await locked).toBe(thrown);
    expect(await unsent).toBe(thrown);
    expect(await late).toBe(thrown);
    expect(send).toHaveBeenCalledTimes(1);
    expect(isUnansweredCredentialRefusal(thrown)).toBe(true);
  });

  it('a member through answering rejects, not ok:false', async () => {
    const thrown = refused();
    const { batch, send } = batchFixture(thrown);
    const domain = new AdtClient(batch).getDomain();
    // Expectations attached before the trigger, so no rejection is unhandled.
    const first = expect(
      domain.readMetadata({ domainName: 'Z_FIRST' }),
    ).rejects.toBe(thrown);
    let second: Promise<void> | undefined;
    send.mockImplementationOnce(async () => {
      second = expect(
        domain.readMetadata({ domainName: 'Z_SECOND' }),
      ).rejects.toBe(thrown);
      throw thrown;
    });

    await expect(batch.execute()).rejects.toBe(thrown);
    await first;
    expect(second).toBeDefined();
    await second;
  });

  it('keeps the "not sent" wrapper for any other envelope failure', async () => {
    const failure = new Error('offline');
    const { batch } = batchFixture(failure);
    batch.setSessionType('stateful');
    const locked = batch
      .makeAdtRequest({ ...req, url: '/test?_action=LOCK' })
      .catch((e) => e);
    const unsent = batch.makeAdtRequest(req).catch((e) => e);

    await expect(batch.execute()).rejects.toBe(failure);
    expect(await locked).toBe(failure);
    expect((await unsent).message).toContain('not sent');
  });
});
