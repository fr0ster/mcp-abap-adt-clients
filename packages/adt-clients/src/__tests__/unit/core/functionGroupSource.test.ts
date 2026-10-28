/**
 * The function group's source — the function pool's main program: `read` is
 * one GET of `…/source/main` (the version as asked), `update` one PUT of the
 * caller's text, as it is, under the caller's lock handle and with the caller's
 * headers.
 *
 * Measured on S/4HANA 2025 and ABAP cloud, 2026-10-29: both 200 `text/plain`.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { headersFor } from '../../helpers/adtHeaders';
import { createLibraryLogger } from '../../helpers/testLogger';

interface ISent {
  url: string;
  method: string;
  data: unknown;
  headers: Record<string, string>;
}

function recordingClient(): { client: AdtClientOnPrem; sent: ISent[] } {
  const sent: ISent[] = [];
  const connection = {
    makeAdtRequest: async (request: ISent) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
  } as unknown as IAbapConnection;
  return {
    client: new AdtClientOnPrem(connection, createLibraryLogger()),
    sent,
  };
}

/** Line ends, a BOM, non-ASCII and trailing space: nothing may be touched. */
const SOURCE = '﻿FUNCTION-POOL zfg_src.\r\n* Überprüfung & Ä\n  ';
const GROUP = '/sap/bc/adt/functions/groups/zfg_src/source/main';

describe('AdtFunctionGroup.read', () => {
  it('GETs the main program as text/plain', async () => {
    const { client, sent } = recordingClient();
    await client.getFunctionGroup().read({ functionGroupName: 'ZFG_SRC' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('GET');
    expect(sent[0]?.url).toBe(GROUP);
    expect(sent[0]?.headers).toStrictEqual({ Accept: 'text/plain' });
  });

  it('asks for the version it is given', async () => {
    const { client, sent } = recordingClient();
    await client
      .getFunctionGroup()
      .read({ functionGroupName: 'ZFG_SRC' }, 'inactive');

    expect(sent.map((r) => r.url)).toEqual([`${GROUP}?version=inactive`]);
  });
});

describe('AdtFunctionGroup.update', () => {
  const headers = headersFor('AdtFunctionGroup.update');
  const write = (
    client: AdtClientOnPrem,
    transportRequest: string | undefined,
  ) =>
    client.getFunctionGroup().update(
      { functionGroupName: 'ZFG_SRC', transportRequest },
      {
        headers,
        lockHandle: 'LOCK/+=1',
        source: SOURCE,
      },
    );

  it('PUTs once to the main program, with the handle and the request', async () => {
    const { client, sent } = recordingClient();
    await write(client, 'DEVK900001');

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toBe(
      `${GROUP}?lockHandle=LOCK%2F%2B%3D1&corrNr=DEVK900001`,
    );
  });

  it('sends no corrNr when the config names no request', async () => {
    const { client, sent } = recordingClient();
    await write(client, undefined);

    expect(sent.map((r) => r.url)).toEqual([
      `${GROUP}?lockHandle=LOCK%2F%2B%3D1`,
    ]);
  });

  it('sends the body byte for byte and the headers as passed', async () => {
    const { client, sent } = recordingClient();
    await write(client, undefined);

    expect(sent[0]?.data).toBe(SOURCE);
    expect(sent[0]?.headers).toStrictEqual({
      Accept: 'text/plain',
      'Content-Type': 'text/plain; charset=utf-8',
    });
  });
});
