import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { headersFor } from '../../helpers/adtHeaders';

const { writeAndActivate, writeSource } = require('../../helpers/test-helper');

/**
 * `test-helper.js` is JavaScript, so the compiler never saw that its writes
 * passed no `headers`: a live run threw in `requestHeaders` before the first
 * request. Here its writes run against real handlers on a recording
 * connection, and every request a header member makes carries the recorded
 * pair.
 */

type Recorded = {
  method: string;
  url: string;
  headers: Record<string, unknown>;
};

const LOCK_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>HELPER-LOCK</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function recordingConnection(): {
  connection: IAbapConnection;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: {
      method: string;
      url: string;
      headers?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }) => {
      calls.push({
        method: request.method,
        url: request.url,
        headers: { ...(request.headers ?? {}) },
      });
      const locking =
        /_action=(UN)?LOCK/.test(request.url) ||
        typeof request.params?._action === 'string';
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: locking ? LOCK_BODY : '',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
}

const logger = { debug() {}, info() {}, warn() {}, error() {} };

function pairOf(call: Recorded | undefined) {
  return {
    accept: call?.headers.Accept,
    contentType: call?.headers['Content-Type'],
  };
}

describe('test-helper.js writes send the recorded pair', () => {
  it('writeSource sends the update pair with the PUT of the source', async () => {
    const { connection, calls } = recordingConnection();
    const program = new AdtClient(connection, logger).getProgram();
    await writeSource(
      program,
      { programName: 'ZHELPER' },
      { source: 'REPORT zhelper.' },
      logger,
    );
    const put = calls.find((call) => call.method === 'PUT');
    expect(put).toBeDefined();
    expect(pairOf(put)).toEqual(headersFor('AdtProgram.update'));
    expect(put?.headers.Accept).not.toBe('application/x-test-accept');
  });

  it('writeSource sends the updateMetadata pair for a document-only type', async () => {
    const { connection, calls } = recordingConnection();
    const domain = new AdtClient(connection, logger).getDomain();
    await writeSource(
      domain,
      { domainName: 'ZHELPER', datatype: 'CHAR', length: 10 },
      {},
      logger,
    );
    const put = calls.find((call) => call.method === 'PUT');
    expect(put).toBeDefined();
    expect(pairOf(put)).toEqual(headersFor('AdtDomain.updateMetadata'));
  });

  it('writeAndActivate sends the activate pair with the activation', async () => {
    const { connection, calls } = recordingConnection();
    const program = new AdtClient(connection, logger).getProgram();
    await writeAndActivate(
      program,
      { programName: 'ZHELPER' },
      { source: 'REPORT zhelper.' },
      logger,
    );
    const activation = calls.find(
      (call) => call.method === 'POST' && call.url.includes('/activation'),
    );
    expect(activation).toBeDefined();
    expect(pairOf(activation)).toEqual(headersFor('AdtProgram.activate'));
  });
});
