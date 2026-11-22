/**
 * R12's file arrives byte-exact through the real `@mcp-abap-adt/connection`
 * HTTP wire. Axios parses a JSON-looking body unless told otherwise, even one
 * SAP serves as `text/plain` (the only form R12 answers in), and its node
 * adapter strips a BOM: `getFile` sends `rawText: true` (connection 25.2.0),
 * so the body is the text SAP sent.
 *
 * The network is an in-memory adapter that answers as Axios's node adapter
 * does — bytes for `arraybuffer`, else UTF-8 text with the BOM stripped —
 * and Axios's own response transforms then run as on a socket.
 */

import { Readable } from 'node:stream';
import { BasicAuthProvider } from '@mcp-abap-adt/auth-providers';
import {
  AdtOnPremConnector,
  type HttpClientFactory,
  nodeHttpClient,
  OnPremHttpTransport,
} from '@mcp-abap-adt/connection';
import axios, {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { gitClient } from './abapGitHelpers';

jest.mock('../../../helpers/sharedSession', () => ({
  ...jest.requireActual('../../../helpers/sharedSession'),
  readSessionMaterial: () => null,
  publishSessionMaterial: jest.fn(),
}));

const BASE = 'https://sap.example.invalid';

/** Answers the file's bytes on `/files`, an empty 200 with a CSRF token elsewhere. */
function inMemory(file: Buffer): HttpClientFactory {
  const adapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    const isFile = String(config.url).includes('/files');
    const bytes = isFile ? file : Buffer.alloc(0);
    let data: unknown;
    if (config.responseType === 'arraybuffer') data = bytes;
    else if (config.responseType === 'stream') data = Readable.from(bytes);
    else {
      const text = bytes.toString('utf8');
      // As Axios's node adapter does for any text response.
      data = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    }
    return {
      data,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders({
        'content-type': isFile ? 'text/plain; charset=utf-8' : 'text/plain',
        'x-csrf-token': 'TOKEN',
        'set-cookie': ['SAP_SESSIONID_T_100=S1; path=/'],
      }),
      config,
      request: {},
    };
  };
  return {
    create: (agents) => axios.create({ ...agents, adapter }),
    logoffRequest: nodeHttpClient.logoffRequest,
  };
}

async function fileThroughTheWire(file: Buffer): Promise<unknown> {
  const connection = new AdtOnPremConnector(
    { url: BASE, client: '100', authType: 'basic' },
    new BasicAuthProvider('STUB', 'STUB'),
    new OnPremHttpTransport(() => ({}), null, {
      client: '100',
      baseUrl: BASE,
      httpClient: inMemory(file),
    }),
    null,
  );
  await connection.connect();
  try {
    const answer = await gitClient(connection).getFile({
      key: '000001',
      filename: 'f',
      version: 'remote',
    });
    if (!answer.ok) throw new Error(answer.getError().message);
    return answer.getResult().value.facts.content;
  } finally {
    await connection.disconnect().catch(() => undefined);
  }
}

describe('getFile over the real HTTP wire', () => {
  it.each([
    ['a JSON object', '{"key": "value", "n": 1}'],
    ['a JSON string with quotes', '"a quoted \\"string\\""'],
    ['a trailing newline', 'CLASS zcl_demo DEFINITION.\nENDCLASS.\n'],
    ['a BOM', '﻿CLASS zcl_bom.\n'],
  ])('keeps %s byte-exact', async (_name, text) => {
    expect(await fileThroughTheWire(Buffer.from(text, 'utf8'))).toBe(text);
  });
});
