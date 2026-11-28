/**
 * Every lockable handler records a lock in the client's registry when SAP
 * granted it (a 2xx LOCK answer carrying a handle), whatever the caller's
 * `analyse` makes of it, and keeps it when SAP does not confirm the UNLOCK
 * as a release; it drops it when SAP does. The registry records SAP's
 * state, never the caller's verdict.
 *
 * A refused UNLOCK (a 403 the connection rejects with, or a 500 it resolves)
 * may leave the lock held; the registry is what `unlockAll` releases from, so
 * the entry stays until an UNLOCK answered with a 2xx. One request either way:
 * the handler sends no second UNLOCK of its own.
 *
 * Driven over the capability manifest's lockable entries, so a new lockable
 * handler is covered as soon as the manifest names it.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { createLibraryLogger } from '../../helpers/testLogger';
import { bodyFor, invoke, wireUrl } from '../capabilities/behaviourGuard';
import { HANDLERS, type HandlerEntry } from '../capabilities/manifest';

const LOCKABLE = Object.entries(HANDLERS as Record<string, HandlerEntry>)
  .filter(([, entry]) => entry.capabilities.includes('lockable'))
  .map(([name]) => name)
  .sort();

type UnlockAnswer = 'released' | 'rejected 403' | 'resolved 500';

/** A client whose UNLOCK answers as `unlock` says, and every other request 200. */
function clientAnswering(unlock: UnlockAnswer) {
  const unlocks: string[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => undefined,
    makeAdtRequest: async (req: {
      url: string;
      method: string;
      params?: Record<string, unknown>;
    }) => {
      const url = wireUrl(req);
      const body = bodyFor(url, '');
      if (url.includes('_action=UNLOCK')) {
        unlocks.push(url);
        if (unlock === 'rejected 403') {
          throw {
            message: 'Request failed with status code 403',
            response: {
              status: 403,
              statusText: 'Forbidden',
              headers: {},
              data: '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="ExceptionResourceNoAccess"/><message lang="EN">refused</message></exc:exception>',
            },
          };
        }
        if (unlock === 'resolved 500') {
          return {
            status: 500,
            statusText: 'Internal Server Error',
            headers: {},
            data: '',
          } as IAdtWireResponse;
        }
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: body,
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  const client = new AdtClient(connection, createLibraryLogger());
  return { client, unlocks };
}

describe('an UNLOCK SAP does not confirm keeps the lock in the registry', () => {
  it('finds the lockable handlers', () => {
    expect(LOCKABLE.length).toBeGreaterThan(20);
    // The include and the service binding record their locks too.
    expect(LOCKABLE).toEqual(
      expect.arrayContaining(['include', 'serviceBinding']),
    );
  });

  describe.each(LOCKABLE)('%s', (name) => {
    const entry = (HANDLERS as Record<string, HandlerEntry>)[name];
    if (!entry) throw new Error(`no manifest entry ${name}`);

    it.each<UnlockAnswer>(['rejected 403', 'resolved 500'])(
      'keeps the lock after an UNLOCK %s, with one UNLOCK sent',
      async (answer) => {
        const { client, unlocks } = clientAnswering(answer);
        const handler = entry.factory(client) as Record<string, unknown>;
        await invoke(handler, 'lock', entry.config);
        expect(client.pendingLocks).toHaveLength(1);
        await invoke(handler, 'unlock', entry.config);
        expect(unlocks).toHaveLength(1);
        expect(client.pendingLocks).toHaveLength(1);
      },
    );

    it.each<[string, () => never | { origin: 'refusal'; message: string }]>([
      [
        'reports a failure',
        () => ({ origin: 'refusal', message: 'judged a failure' }),
      ],
      [
        'throws',
        () => {
          throw new Error('the analyse threw');
        },
      ],
    ])(
      "records a lock SAP granted (200 with a handle) when the caller's analyse %s",
      async (_what, analyse) => {
        const { client } = clientAnswering('released');
        const handler = entry.factory(client) as Record<string, unknown>;
        const lock = handler.lock as (
          config: unknown,
          options: { analyse: unknown },
        ) => Promise<unknown>;
        await lock
          .call(handler, entry.config, { analyse })
          .catch(() => undefined);
        expect(client.pendingLocks).toHaveLength(1);
      },
    );

    it('drops the lock after an UNLOCK SAP answered 200', async () => {
      const { client } = clientAnswering('released');
      const handler = entry.factory(client) as Record<string, unknown>;
      await invoke(handler, 'lock', entry.config);
      expect(client.pendingLocks).toHaveLength(1);
      await invoke(handler, 'unlock', entry.config);
      expect(client.pendingLocks).toHaveLength(0);
    });
  });
});
