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
 * A refused create (409) is "already exists" only when a read after it finds
 * the object. SAP answers 409 to refusals too, and reading every 409 as a
 * concurrent create reported success over an object that was never made.
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

  it('is reported with what SAP said when a read after it does not find the object', async () => {
    const { connection: conn, calls } = connection(false);
    await expect(
      ensureSharedDependency(
        new AdtClient(conn, logger),
        'classes',
        NAME,
        logger,
      ),
    ).rejects.toThrow(
      /was not created.*409.*No suitable software component is modifiable/,
    );
    // The create was tried, and a read followed it.
    const post = calls.findIndex((c) => c.startsWith('POST '));
    expect(post).toBeGreaterThanOrEqual(0);
    expect(calls.slice(post + 1).some((c) => c.startsWith('GET '))).toBe(true);
  });

  it('counts as existing when a read after it finds the object', async () => {
    const { connection: conn } = connection(true);
    await expect(
      ensureSharedDependency(
        new AdtClient(conn, logger),
        'classes',
        NAME,
        logger,
      ),
    ).resolves.toMatchObject({ existed: true, created: false });
  });
});
