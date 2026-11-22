import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { feedGatewayErrorDetail, feedGatewayErrors } from '../results/feeds';

/**
 * The gateway error log, read off what SAP answers (adt-strategies 0.28.0).
 *
 * **Recorded** on the cloud and on premise, 2026-11-22, read-only, scrubbed
 * (users, user ids, host, client, application server names and other users'
 * repository object names replaced) — `fixtures/feeds/`:
 * - `cloud-gatewayerrors.xml` — five of the 115 entries `GET gw/errorlog`
 *   answered (Frontend and Backend errors, one with no short text, one in
 *   Arabic), cut from the feed;
 * - `cloud-gatewayerror-detail.body.txt` — what the first entry's `HTTP link`
 *   answered: HTML, not XML (an empty content type);
 * - `onprem-gatewayerrors.xml` — the on-premise feed, with no entry.
 */
const FIXTURES = join(__dirname, 'fixtures', 'feeds');
const answer = (file: string): IAdtWireResponse => ({
  data: readFileSync(join(FIXTURES, file), 'utf-8'),
  status: 200,
  statusText: 'OK',
  headers: {},
});

const entries = feedGatewayErrors(answer('cloud-gatewayerrors.xml'));

describe('feedGatewayErrors reads the recorded cloud feed', () => {
  it('reads every entry', () => {
    expect(entries).toHaveLength(5);
    expect(entries.map((e) => e.kind)).toEqual([
      'Frontend Error',
      'Backend Error',
      'Frontend Error',
      'Frontend Error',
      'Backend Error',
    ]);
  });

  it("reads a Frontend entry's header cells", () => {
    expect(entries[0]).toEqual({
      id: 'FrontendError/BA98DDFC64FB1FE1B9D15494303F12B9/20261122153736.8356220',
      kind: 'Frontend Error',
      type: 'Frontend Error',
      shortText:
        "No authorization to access service group 'SUI_FLP_APS_UI_USERNEWS'",
      transactionId: '4E2D1E2EAF429FC7A0FC9684ADD399BF',
      package: 'S_PROFGEN_START_AUTH',
      applicationComponent: 'CA-FLP-EXT-CUX-NWS',
      dateTime: '2026-11-22T15:37:36Z',
      username: 'USER1',
      userId: 'USERGUID1',
      client: 'CLIENT1',
      requestKind: 'Server OData V4',
      detailUri:
        '/sap/bc/adt/gw/errorlog/Frontend%20Error/BA98DDFC64FB1FE1B9D15494303F12B9',
      errorId: 'BA98DDFC64FB1FE1B9D15494303F12B9',
    });
  });

  it("reads a Backend entry's header cells", () => {
    expect(entries[1]).toMatchObject({
      kind: 'Backend Error',
      type: 'Backend Error',
      shortText: 'Metadata cache on hub system for current model is outdated',
      transactionId: 'ED9EBB52F58A80D296852FCA102172A9',
      package: '/IWBEP/MGW_GSR_CORE',
      applicationComponent: 'n/a',
      requestKind: 'Server OData V2',
      username: 'USER2',
      userId: 'USERGUID2',
      errorId: 'BA98DDFC64FB1FE1B9D0322F855592B9',
    });
  });

  it('the transaction id is the cell, not the atom:id; the title carries no prefix into shortText', () => {
    for (const entry of entries) {
      expect(entry.transactionId).not.toBe(entry.id);
      expect(entry.shortText?.startsWith('Frontend Error')).not.toBe(true);
      expect(entry.username?.includes('(')).toBe(false);
    }
  });

  it('decodes the cells: a leading space trimmed, Arabic text as written', () => {
    expect(entries[2].shortText).toBe(
      "You can't change the value for US AGENCY",
    );
    expect(entries[3].shortText).toBe(
      'حدث خطأ غير محدد في المزود. راجع سياق الخطأ وتجمع الاستدعاءات',
    );
  });

  it('leaves out a short text the entry does not carry, never ""', () => {
    expect(entries[4]).not.toHaveProperty('shortText');
    expect(entries[4].transactionId).toBe('6DFFBDC8ADC50190E006B01C583E7446');
  });

  it('reads the on-premise feed, which has no entry, as none', () => {
    expect(feedGatewayErrors(answer('onprem-gatewayerrors.xml'))).toEqual([]);
  });
});

describe('feedGatewayErrorDetail reads the recorded error document (HTML)', () => {
  const detail = feedGatewayErrorDetail(
    answer('cloud-gatewayerror-detail.body.txt'),
  );

  it('reads the header', () => {
    expect(detail).toMatchObject({
      type: 'Frontend Error',
      transactionId: '4E2D1E2EAF429FC7A0FC9684ADD399BF',
      package: 'S_PROFGEN_START_AUTH',
      dateTime: '11/22/2026 15:37:36 (System)',
      username: 'USER1',
      userId: 'USERGUID1',
      client: 'CLIENT1',
      requestKind: 'Server OData V4',
    });
  });

  it('reads the service information; an empty namespace is absent', () => {
    expect(detail.serviceInfo).toEqual({
      serviceName: 'SUI_FLP_APS_UI_USERNEWS',
      serviceVersion: '0001',
      groupId: 'SUI_FLP_APS_UI_USERNEWS',
      serviceRepository: 'SRVD_A2X',
      destination: 'NONE',
    });
  });

  it('reads the error context: info, resolution and each exception', () => {
    expect(detail.errorContext.errorInfo).toBe(
      "No authorization to access service group 'SUI_FLP_APS_UI_USERNEWS'",
    );
    expect(detail.errorContext.resolution).toEqual({
      SAP_NOTE: 'See SAP Note 1797736 for error analysis',
      LINK_TO_SAP_NOTE: 'https://service.sap.com/sap/support/notes/1797736',
    });
    expect(detail.errorContext.exceptions).toEqual([
      {
        type: '/IWCOR/CX_OD_HTTP_ERROR',
        text: 'Unknown http error occurred in the context of Data Services',
        raiseLocation: '/IWBEP/CL_OD_UTILS',
      },
      {
        type: '/IWBEP/CX_V4_ACCESS_CHECK',
        text: "No authorization to access service group 'SUI_FLP_APS_UI_USERNEWS'",
        raiseLocation: '/IWBEP/CL_V4_SERVICE_ACCESS',
        attributes: {
          HTTP_STATUS_CODE: '403',
          SAP_NOTE_ID: '0000000000',
          SRG_ID: 'SUI_FLP_APS_UI_USERNEWS',
        },
      },
      {
        type: 'CX_NO_AUTHORIZATION',
        text: 'You do not have start authorization for R3TR G4BA SUI_FLP_APS_UI_USERNEWS, return code 4',
        raiseLocation: 'CL_START_AUTH_CHECK',
        attributes: {
          OBJ_NAME: 'SUI_FLP_APS_UI_USERNEWS',
          OBJ_TYPE: 'G4BA',
          PGMID: 'R3TR',
          RESULT: '4',
        },
      },
    ]);
    expect(detail.errorContext.tree[0]?.children.map((c) => c.label)).toEqual([
      'ERROR_INFO',
      'ERROR_RESOLUTION',
      'Exceptions',
      'SERVICE_INFO',
      'SYSTEM_INFO',
    ]);
  });

  it('reads the source extract, its highlighted line numbered after the one before', () => {
    const { lines, errorLine } = detail.sourceCode;
    expect(lines).toHaveLength(22);
    expect(lines[0]).toEqual({
      number: 48,
      content: '      lv_subrc = sy-subrc.',
      isError: false,
    });
    expect(errorLine).toBe(59);
    expect(lines.filter((l) => l.isError)).toEqual([
      {
        number: 59,
        content: '      raise exception type cx_no_authorization',
        isError: true,
      },
    ]);
    expect(lines[12]?.number).toBe(60);
  });

  it('reads the call stack, numbers as numbers', () => {
    expect(detail.callStack).toHaveLength(21);
    expect(detail.callStack[0]).toEqual({
      number: 21,
      event: 'METHOD',
      program: '/IWBEP/CL_V4_SERVICE_ACCESS',
      name: '/IWBEP/IF_V4_SERVICE_ACCESS~START_TRUST_MODE',
      line: 26,
    });
    expect(detail.callStack[20]).toEqual({
      number: 1,
      event: 'MODULE (PBO)',
      program: 'SAPMHTTP',
      name: '%_HTTP_START',
      line: 12,
    });
  });
});
