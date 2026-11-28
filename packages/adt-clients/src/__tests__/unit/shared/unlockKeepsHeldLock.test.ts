/**
 * Every lockable handler keeps its lock in the client's registry when SAP
 * does not confirm the UNLOCK as a release, and drops it when SAP does.
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

/**
 * The lockable handlers whose lock is in no registry at all, so no UNLOCK
 * can drop one: an include's lock is handed to the caller (`onLock`), and a
 * service binding's is not recorded. Their missing registration is a gap of
 * its own, outside this check; `records no lock` below fails as soon as one
 * of them starts recording, and it then joins the check.
 */
const LOCK_NOT_RECORDED = new Set(['include', 'serviceBinding']);

const LOCKABLE = Object.entries(HANDLERS as Record<string, HandlerEntry>)
  .filter(([, entry]) => entry.capabilities.includes('lockable'))
  .filter(([name]) => !LOCK_NOT_RECORDED.has(name))
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

describe.each([...LOCK_NOT_RECORDED].sort())('%s', (name) => {
  it('records no lock in the registry', async () => {
    const entry = (HANDLERS as Record<string, HandlerEntry>)[name];
    if (!entry) throw new Error(`no manifest entry ${name}`);
    const { client } = clientAnswering('released');
    const handler = entry.factory(client) as Record<string, unknown>;
    await invoke(handler, 'lock', entry.config);
    expect(client.pendingLocks).toHaveLength(0);
  });
});

describe('an UNLOCK SAP does not confirm keeps the lock in the registry', () => {
  it('finds the lockable handlers', () => {
    expect(LOCKABLE.length).toBeGreaterThan(20);
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
