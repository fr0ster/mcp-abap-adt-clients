import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

const {
  ensureSharedDependency,
  resetSharedDependencyCache,
} = require('../../helpers/test-helper');

/**
 * A refused create (409) is a failed setup, reported with what SAP said —
 * also when the object turns up afterwards. SAP answers 409 to refusals too,
 * and an object a later read finds was made by someone else, in a state
 * nobody configured: it is not this dependency made ready.
 */

const NAME = 'ZAC_SHR_RUN01'; // a shared_dependencies.classes entry of the template
const REFUSAL = `<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceCreationFailure"/><message lang="EN">No suitable software component is modifiable</message></exc:exception>`;

function failure(status: number, data = '') {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, statusText: '', headers: {}, data },
  });
}

/** The class is absent at first; `existsAfterCreate` says whether it is after. */
function connection(existsAfterCreate: boolean): {
  connection: IAbapConnection;
  calls: string[];
} {
  const calls: string[] = [];
  let createAttempted = false;
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: { method: string; url: string }) => {
      calls.push(`${request.method} ${request.url}`);
      if (
        request.method === 'POST' &&
        /\/oo\/classes(\?|$)/.test(request.url)
      ) {
        createAttempted = true;
        throw failure(409, REFUSAL);
      }
      if (request.method === 'GET') {
        if (createAttempted && existsAfterCreate)
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: '<class:abapClass/>',
          } as IAdtWireResponse;
        throw failure(404);
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection: conn, calls };
}

const logger = { debug() {}, info() {}, warn() {}, error() {} };

describe('a refused shared create', () => {
  beforeEach(() => resetSharedDependencyCache());

  it('is reported with what SAP said, and no read is made to forgive it', async () => {
    const { connection: conn, calls } = connection(false);
    await expect(
      ensureSharedDependency(
        new AdtClient(conn, logger),
        'classes',
        NAME,
        logger,
      ),
    ).rejects.toThrow(/409.*No suitable software component is modifiable/);
    const post = calls.findIndex((c) => c.startsWith('POST '));
    expect(post).toBeGreaterThanOrEqual(0);
    expect(calls.slice(post + 1).some((c) => c.startsWith('GET '))).toBe(false);
  });

  it('fails even when the object is there afterwards', async () => {
    const { connection: conn } = connection(true);
    await expect(
      ensureSharedDependency(
        new AdtClient(conn, logger),
        'classes',
        NAME,
        logger,
      ),
    ).rejects.toThrow(/409.*No suitable software component is modifiable/);
  });

  it('is not cached as verified: the next call asks again', async () => {
    const { connection: conn, calls } = connection(true);
    const client = new AdtClient(conn, logger);
    await expect(
      ensureSharedDependency(client, 'classes', NAME, logger),
    ).rejects.toThrow();
    const before = calls.length;
    await ensureSharedDependency(client, 'classes', NAME, logger).catch(
      () => undefined,
    );
    expect(calls.length).toBeGreaterThan(before);
  });
});
