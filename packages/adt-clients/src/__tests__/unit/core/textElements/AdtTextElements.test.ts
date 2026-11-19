/**
 * `AdtTextElements` over the recorded answers of the text elements research
 * (`corpus/adt/answers/*text-*`, 2026-11-19): each member one request, as
 * sent — the address per kind, the part's media type, the version, the
 * whole-part body under the lock — and the lock registry following the wire
 * before any `analyse` runs.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { selectionTexts, textSymbols } from '@mcp-abap-adt/adt-strategies';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { LockRegistry } from '../../../../core/shared/LockRegistry';
import { AdtTextElements } from '../../../../core/textElements/AdtTextElements';
import { textElementsDocuments } from '../../../../core/textElements/types';
import { recogniseFailure } from '../../../../utils/adtResponse';

const ANSWERS = path.resolve(__dirname, '../../../../../corpus/adt/answers');

/** A recorded exchange: the sidecar's status and headers, and its body. */
function recorded(caseStep: string): IAdtWireResponse {
  const sidecar = JSON.parse(
    fs.readFileSync(path.join(ANSWERS, `${caseStep}.json`), 'utf8'),
  );
  return {
    status: sidecar.response.status,
    statusText: sidecar.response.statusText,
    headers: sidecar.response.headers,
    data: fs.readFileSync(
      path.join(ANSWERS, sidecar.response.bodyFile),
      'utf8',
    ),
  } as IAdtWireResponse;
}

const answer = (status: number, data = ''): IAdtWireResponse =>
  ({ status, statusText: '', headers: {}, data }) as IAdtWireResponse;

/** The LOCK answer the cloud write run recorded (the handle replaced). */
const LOCKED = answer(
  200,
  '<?xml version="1.0" encoding="utf-8"?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>HANDLE1</LOCK_HANDLE><CORRNR/><CORRUSER/><CORRTEXT/><IS_LOCAL>X</IS_LOCAL><IS_LINK_UP/><MODIFICATION_SUPPORT>NoModification</MODIFICATION_SUPPORT><SCOPE_MESSAGES/></DATA></asx:values></asx:abap>',
);

/** A connection that answers in turn, resolving every status, and records each request. */
function recording(...answers: IAdtWireResponse[]) {
  const requests: IAbapRequestOptions[] = [];
  const sessions: string[] = [];
  const connection = {
    setSessionType: (type: string) => sessions.push(type),
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      return answers.shift() ?? answer(200);
    },
  } as unknown as IAbapConnection;
  return { connection, requests, sessions };
}

const headers = {
  accept: 'application/vnd.sap.adt.textelements.symbols.v1',
  contentType: 'application/vnd.sap.adt.textelements.symbols.v1; charset=utf-8',
};

describe('the read', () => {
  it.each([
    [
      'program',
      'zprog',
      'selections',
      '/sap/bc/adt/textelements/programs/zprog/source/selections',
    ],
    [
      'class',
      'ZCL_X',
      'symbols',
      '/sap/bc/adt/textelements/classes/zcl_x/source/symbols',
    ],
    [
      'functionGroup',
      'ZFG',
      'headings',
      '/sap/bc/adt/textelements/functiongroups/zfg/source/headings',
    ],
  ] as const)(
    'GETs a %s part at its own address, with the part media type as Accept',
    async (objectKind, objectName, part, url) => {
      const { connection, requests } = recording(answer(200));
      const texts = new AdtTextElements(connection, {
        results: textElementsDocuments,
      });
      const config =
        objectKind === 'class'
          ? { objectKind, objectName, part: 'symbols' as const }
          : { objectKind, objectName, part };
      await texts.read(config);
      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe('GET');
      expect(requests[0]?.url).toBe(url);
      expect(requests[0]?.headers).toEqual({
        Accept: `application/vnd.sap.adt.textelements.${part}.v1`,
      });
    },
  );

  it.each(['active', 'inactive', 'workingArea'] as const)(
    'sends ?version=%s as given, and no version when absent',
    async (version) => {
      const { connection, requests } = recording(answer(200), answer(200));
      const texts = new AdtTextElements(connection, {
        results: textElementsDocuments,
      });
      const config = {
        objectKind: 'program',
        objectName: 'ZPROG',
        part: 'symbols',
      } as const;
      await texts.read(config, version);
      await texts.read(config);
      expect(requests[0]?.url).toBe(
        `/sap/bc/adt/textelements/programs/zprog/source/symbols?version=${version}`,
      );
      expect(requests[1]?.url).toBe(
        '/sap/bc/adt/textelements/programs/zprog/source/symbols',
      );
    },
  );

  it('answers the part as the result set reads it', async () => {
    const { connection } = recording(
      recorded('read-text-selections-ddic-s4-2025--01-selections'),
    );
    const texts = new AdtTextElements(connection, {
      results: { ...textElementsDocuments, source: selectionTexts },
    });
    const read = await texts.read({
      objectKind: 'program',
      objectName: 'ZMCP_TXS253F',
      part: 'selections',
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.getResult().value.selections[0]).toEqual({
      name: 'P_ARBGB ',
      text: 'Application Area',
      ddicReference: true,
    });
  });
});

describe('the write', () => {
  it('PUTs the whole part, under the lock, with corrNr, and answers the saved part', async () => {
    const { connection, requests } = recording(
      recorded('write-text-symbols-abap-cloud--01-update'),
    );
    const texts = new AdtTextElements(connection, {
      results: { ...textElementsDocuments, updated: textSymbols },
    });
    const put = await texts.update(
      {
        objectKind: 'class',
        objectName: 'ZCL_MCP_TX3D74',
        part: 'symbols',
        symbols: [
          { key: '001', text: 'Symbol one EN', maxLength: 20 },
          { key: '002', text: 'Symbol two EN', maxLength: 20 },
        ],
        transportRequest: 'DEVK900001',
      },
      { headers, lockHandle: 'HANDLE1' },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('PUT');
    expect(requests[0]?.url).toBe(
      '/sap/bc/adt/textelements/classes/zcl_mcp_tx3d74/source/symbols?lockHandle=HANDLE1&corrNr=DEVK900001',
    );
    expect(requests[0]?.data).toBe(
      '@MaxLength:20\r\n001=Symbol one EN\r\n\r\n@MaxLength:20\r\n002=Symbol two EN',
    );
    expect(requests[0]?.headers).toEqual({
      Accept: headers.accept,
      'Content-Type': headers.contentType,
    });
    expect(put.ok).toBe(true);
    if (!put.ok) return;
    expect(put.getResult().value.symbols).toHaveLength(2);
  });

  it('a function group writes under its plain name', async () => {
    const { connection, requests } = recording(
      recorded('write-text-symbols-function-group-s4-2025--01-update'),
    );
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
    });
    await texts.update(
      {
        objectKind: 'functionGroup',
        objectName: 'ZMCP_TXF253F',
        part: 'symbols',
        symbols: [
          { key: '001', text: 'FUGR symbol one', maxLength: 20 },
          { key: '002', text: 'FUGR symbol 2', maxLength: 15 },
        ],
      },
      { headers, lockHandle: 'H' },
    );
    expect(requests[0]?.url).toBe(
      '/sap/bc/adt/textelements/functiongroups/zmcp_txf253f/source/symbols?lockHandle=H',
    );
  });

  it('refuses an empty lock handle before any request', async () => {
    const { connection, requests } = recording();
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
    });
    await expect(
      texts.update(
        {
          objectKind: 'program',
          objectName: 'ZPROG',
          part: 'selections',
          selections: [],
        },
        { headers, lockHandle: '' },
      ),
    ).rejects.toThrow('lockHandle is required');
    expect(requests).toEqual([]);
  });

  it('a refusal SAP answered (406 SEDX_ADT/102) is a failure, the answer kept', async () => {
    const { connection } = recording(
      recorded('refusal-text-selection-key-too-long-s4-2025--01-update'),
    );
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
    });
    const put = await texts.update(
      {
        objectKind: 'program',
        objectName: 'ZMCP_TXK4480',
        part: 'selections',
        selections: [
          { name: 'P_ABCDEFGH', text: 'Nine characters', ddicReference: false },
        ],
      },
      { headers, lockHandle: 'H' },
    );
    expect(put.ok).toBe(false);
  });
});

describe('the lock, and the registry following the wire', () => {
  it('LOCKs and UNLOCKs the object at its kind address, each stateful', async () => {
    const { connection, requests, sessions } = recording(LOCKED, answer(200));
    const registry = new LockRegistry();
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
      lockRegistry: registry,
    });
    const object = { objectKind: 'functionGroup', objectName: 'ZFG' } as const;
    const locked = await texts.lock(object);
    expect(locked.ok && locked.getResult().value).toBe('HANDLE1');
    expect(registry.pending).toEqual(['TextElements/functionGroup/ZFG']);
    await texts.unlock(object, 'HANDLE1');
    expect(registry.pending).toEqual([]);
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'POST /sap/bc/adt/textelements/functiongroups/zfg?_action=LOCK&accessMode=MODIFY',
      'POST /sap/bc/adt/textelements/functiongroups/zfg?_action=UNLOCK&lockHandle=HANDLE1',
    ]);
    expect(sessions).toEqual([
      'stateful',
      'stateless',
      'stateful',
      'stateless',
    ]);
  });

  it('tracks a 2xx handle that an analyser calls a failure, so unlockAll() releases it at its address', async () => {
    const { connection, requests } = recording(LOCKED, answer(200));
    const registry = new LockRegistry(connection);
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
      lockRegistry: registry,
    });
    const locked = await texts.lock(
      { objectKind: 'program', objectName: 'ZPROG' },
      {
        analyse: () => ({ origin: 'refusal', code: 'X', message: 'no' }),
      },
    );
    expect(locked.ok).toBe(false);
    expect(registry.pending).toEqual(['TextElements/program/ZPROG']);
    expect(await registry.unlockAll()).toEqual([]);
    expect(requests[1]?.url).toBe(
      '/sap/bc/adt/textelements/programs/zprog?_action=UNLOCK&lockHandle=HANDLE1',
    );
  });

  it('does not track a LOCK answered outside 2xx', async () => {
    const { connection } = recording(answer(403, LOCKED.data as string));
    const registry = new LockRegistry();
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
      lockRegistry: registry,
    });
    await texts.lock({ objectKind: 'class', objectName: 'ZCL_X' });
    expect(registry.pending).toEqual([]);
  });

  it('keeps the lock when the UNLOCK resolved a failed status, even when an analyser calls it ok', async () => {
    const { connection } = recording(LOCKED, answer(500), answer(200));
    const registry = new LockRegistry();
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
      lockRegistry: registry,
    });
    const object = { objectKind: 'class', objectName: 'ZCL_X' } as const;
    await texts.lock(object);
    await texts.unlock(object, 'HANDLE1', { analyse: () => ADT_NO_FAILURE });
    expect(registry.pending).toEqual(['TextElements/class/ZCL_X']);
    expect(await registry.unlockAll()).toEqual([]);
    expect(registry.pending).toEqual([]);
  });

  it("a LOCK SAP refused and the connection resolved keeps SAP's classification, not LOCK_FAILED", async () => {
    const { connection } = recording(
      recorded('refusal-lock-held-by-other--01-lock'),
    );
    const registry = new LockRegistry();
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
      lockRegistry: registry,
    });
    const locked = await texts.lock({
      objectKind: 'class',
      objectName: 'ZCL_X',
    });
    expect(locked.ok).toBe(false);
    const failure = !locked.ok ? locked.getError() : undefined;
    expect(failure?.code).not.toBe('ADT_LOCK_FAILED');
    expect(failure?.response?.status).toBe(403);
    // The verdict every member gives a refusal a connection resolved: the
    // one it would have had thrown, with SAP's answer as its response.
    expect(failure).toEqual(
      recogniseFailure({
        message: 'Request failed with status code 403',
        response: failure?.response,
      }),
    );
    expect(registry.pending).toEqual([]);
  });

  it('a LOCK answered with no handle is LOCK_FAILED, and nothing is tracked', async () => {
    const { connection } = recording(answer(200, ''));
    const registry = new LockRegistry();
    const texts = new AdtTextElements(connection, {
      results: textElementsDocuments,
      lockRegistry: registry,
    });
    const locked = await texts.lock({ objectKind: 'program', objectName: 'Z' });
    expect(locked.ok).toBe(false);
    expect(registry.pending).toEqual([]);
  });
});
