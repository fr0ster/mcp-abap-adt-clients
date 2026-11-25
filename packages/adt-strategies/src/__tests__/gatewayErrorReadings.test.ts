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
 *
 * **Recorded** on premise, 2026-11-25, read-only, scrubbed (user, client,
 * system id, host, address, application server, the OPID and our own
 * repository object names replaced):
 * - `onprem-gatewayerror-detail.body.txt` — what `GET
 *   gw/errorlog/FrontendError/<opid>` answered (`text/html`): its header
 *   section is `<h4 id="HEADER">`, not the cloud's `HEADER_INFO`; its labels
 *   are written after two `&nbsp;` in a plain `<td>`; the service section
 *   says `Group ID` and `Destination` where the cloud says `Service Group`
 *   and `RFC Destination`; `CONTEXT` comes before `SOURCE`.
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
      opid: 'BA98DDFC64FB1FE1B9D15494303F12B9',
      detailUri:
        '/sap/bc/adt/gw/errorlog/Frontend%20Error/BA98DDFC64FB1FE1B9D15494303F12B9',
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
      opid: 'BA98DDFC64FB1FE1B9D0322F855592B9',
      // A cloud id (three segments): the Backend kind keeps its space.
      detailUri:
        '/sap/bc/adt/gw/errorlog/Backend%20Error/BA98DDFC64FB1FE1B9D0322F855592B9',
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

  // Written from SAP's code: `build_for_header` appends
  // `&nbsp;<a href="adt://…/vit/gw/client/project/<opid>,<subno>">(Replay in GW Client)</a>`
  // (onprem l. 396, cloud l. 395) or `&nbsp;<h4 …>(Not replayable in GW Client)</h4>`.
  it.each([
    [
      'a replay link',
      '&amp;nbsp;&lt;a href="adt://cloud/sap/bc/adt/vit/gw/client/project/BA98,1"&gt;(Replay in GW Client)&lt;/a&gt;',
    ],
    [
      'a not-replayable note',
      '&amp;nbsp;&lt;h4 style="display:inline; color:#bdbdbd"&gt;(Not replayable in GW Client)&lt;/h4&gt;',
    ],
  ])('strips %s from the transaction id', (_what, suffix) => {
    const raw = String(answer('cloud-gatewayerrors.xml').data);
    const id = ' 4E2D1E2EAF429FC7A0FC9684ADD399BF ';
    const withSuffix = raw.replace(id, `${id}${suffix}`);
    expect(withSuffix).not.toBe(raw);
    const [first] = feedGatewayErrors({
      ...answer('cloud-gatewayerrors.xml'),
      data: withSuffix,
    });
    expect(first?.transactionId).toBe('4E2D1E2EAF429FC7A0FC9684ADD399BF');
  });

  // Written from SAP's code: the on-premise id is `{kind, no spaces}/{opid}`
  // (`build_feed` l. 263-264), and the viewer reads the Backend log for the
  // kind `BackendError` (`/IWBEP/CL_ERROR_LOG_VIEWER->get` l. 57).
  it('builds an on-premise Backend entry’s address from its id’s own kind', () => {
    const raw = String(answer('cloud-gatewayerrors.xml').data);
    const onprem = raw.replace(
      'BackendError/BA98DDFC64FB1FE1B9D0322F855592B9/20261122143239.5848030',
      'BackendError/BA98DDFC64FB1FE1B9D0322F855592B9',
    );
    const backend = feedGatewayErrors({
      ...answer('cloud-gatewayerrors.xml'),
      data: onprem,
    })[1];
    expect(backend?.opid).toBe('BA98DDFC64FB1FE1B9D0322F855592B9');
    expect(backend?.detailUri).toBe(
      '/sap/bc/adt/gw/errorlog/BackendError/BA98DDFC64FB1FE1B9D0322F855592B9',
    );
  });

  it('reads the on-premise feed, which has no entry, as none', () => {
    expect(feedGatewayErrors(answer('onprem-gatewayerrors.xml'))).toEqual([]);
  });
});

describe('feedGatewayErrorDetail refuses what names no error', () => {
  const REFUSAL = 'feedGatewayErrorDetail: the answer names no gateway error';
  // Written from SAP's code: for an unknown id the viewer renders the empty
  // error (`/IWBEP/CL_ERROR_LOG_VIEWER->get` l. 26, no 404 path) — the
  // recorded document with every header value emptied.
  it('refuses the empty skeleton an unknown id answers', () => {
    const raw = String(answer('cloud-gatewayerror-detail.body.txt').data);
    const start = raw.indexOf('<h4 id="HEADER_INFO"');
    const end = raw.indexOf('</table>', start);
    const header = raw.slice(start, end);
    let emptied = '';
    let from = 0;
    for (;;) {
      const at = header.indexOf('<td class="sourceline">', from);
      if (at < 0) break;
      const close = header.indexOf('</td>', at);
      emptied += `${header.slice(from, at)}<td class="sourceline"> `;
      from = close;
    }
    emptied += header.slice(from);
    const skeleton = raw.slice(0, start) + emptied + raw.slice(end);
    expect(() =>
      feedGatewayErrorDetail({
        ...answer('cloud-gatewayerror-detail.body.txt'),
        data: skeleton,
      }),
    ).toThrow(REFUSAL);
  });

  it('refuses an empty body', () => {
    expect(() =>
      feedGatewayErrorDetail({
        ...answer('cloud-gatewayerror-detail.body.txt'),
        data: '',
      }),
    ).toThrow(REFUSAL);
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

  // Written from the recording: the source extract cut so the highlighted
  // line comes first, as `build_for_source_code` writes it when the error is
  // on the include's first line.
  it('keeps a highlighted first line, numbered before the line after it', () => {
    const raw = String(answer('cloud-gatewayerror-detail.body.txt').data);
    const numbersStart =
      raw.indexOf('<td id="sourcetablecolumn" style="vertical-align:top;">') +
      '<td id="sourcetablecolumn" style="vertical-align:top;">'.length;
    const firstIndicator = raw.indexOf(
      '<span class="linenumber"><a',
      numbersStart,
    );
    const linesStart =
      raw.indexOf('<td id="sourcetablecolumn">', firstIndicator) +
      '<td id="sourcetablecolumn">'.length;
    const firstHighlight = raw.indexOf(
      '<div class="sourceline highlight">',
      linesStart,
    );
    const cut =
      raw.slice(0, numbersStart) +
      raw.slice(firstIndicator, linesStart) +
      raw.slice(firstHighlight);
    const { lines, errorLine } = feedGatewayErrorDetail({
      ...answer('cloud-gatewayerror-detail.body.txt'),
      data: cut,
    }).sourceCode;
    expect(errorLine).toBe(59);
    expect(lines[0]).toEqual({
      number: 59,
      content: '      raise exception type cx_no_authorization',
      isError: true,
    });
    expect(lines[1]?.number).toBe(60);
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

describe('feedGatewayErrorDetail reads the recorded on-premise error document (HTML)', () => {
  const detail = feedGatewayErrorDetail(
    answer('onprem-gatewayerror-detail.body.txt'),
  );

  it('reads the header under `HEADER`; an empty cell is absent', () => {
    expect(detail).toEqual(
      expect.objectContaining({
        shortText: "Service group 'ZSERVICE_GROUP1' not published",
        package: '/IWFND/V4_COS_PUBLISHING',
        applicationComponent: 'n/a',
        dateTime: '25.11.2026 01:57:32 (System)',
        username: 'USER1',
        userId: 'USERGUID1',
        client: 'CLIENT1',
      }),
    );
    // SAP wrote no Type, no Request Kind and, before the replay link, no
    // transaction id on this page.
    expect(detail).not.toHaveProperty('type');
    expect(detail).not.toHaveProperty('requestKind');
    expect(detail).not.toHaveProperty('transactionId');
  });

  it('reads the service information by the on-premise labels', () => {
    expect(detail.serviceInfo).toEqual({
      serviceName: 'ZSERVICE1',
      serviceVersion: '0001',
      groupId: 'ZSERVICE_GROUP1',
      serviceRepository: 'SRVD',
    });
  });

  it('reads the error context', () => {
    expect(detail.errorContext.errorInfo).toBe(
      "Service group 'ZSERVICE_GROUP1' not published",
    );
    expect(detail.errorContext.resolution).toEqual({
      SAP_NOTE: 'See SAP Note 1797736 for error analysis',
      LINK_TO_SAP_NOTE: 'https://service.sap.com/sap/support/notes/1797736',
    });
    expect(detail.errorContext.exceptions).toEqual([
      {
        type: '/IWCOR/CX_OD_HTTP_ERROR',
        text: 'Unknown http error occurred in the context of Data Services',
        raiseLocation: '/IWBEP/CL_OD_ROOT_HANDLER',
      },
      {
        type: '/IWBEP/CX_V4_ACCESS_CHECK',
        text: "Service group 'ZSERVICE_GROUP1' not published",
        raiseLocation: '/IWFND/CL_V4_PUBLISHING_DBA',
        attributes: {
          HTTP_STATUS_CODE: '404',
          SAP_NOTE_ID: '0000000000',
          SRG_ID: 'ZSERVICE_GROUP1',
        },
      },
    ]);
  });

  it('reads the source extract and its highlighted line', () => {
    const { lines, errorLine } = detail.sourceCode;
    expect(lines).toHaveLength(19);
    expect(errorLine).toBe(12);
    expect(lines.filter((l) => l.isError).map((l) => l.number)).toEqual([12]);
  });

  it('reads the call stack', () => {
    expect(detail.callStack).toHaveLength(12);
    expect(detail.callStack[0]).toEqual({
      number: 12,
      event: 'METHOD',
      program: '/IWFND/CL_V4_PUBLISHING_DBA',
      name: 'CHECK_IS_GROUP_PUBLISHED',
      line: 12,
    });
    expect(detail.callStack[11]).toEqual({
      number: 1,
      event: 'MODULE (PBO)',
      program: 'SAPMHTTP',
      name: '%_HTTP_START',
      line: 12,
    });
  });
});

describe('the on-premise forms the recorded document leaves empty', () => {
  const onprem = String(answer('onprem-gatewayerror-detail.body.txt').data);

  // Built from the recorded on-premise document: its `HEADER` section, with
  // the `Type` cell filled as the on-premise feed's summaries write it
  // (measured 2026-11-25: ` Frontend Error `), escaped into an entry's
  // `atom:summary type="html"` as the feed writes it. No `atom:updated`, and
  // a title of other words, so every header field asserted is the summary's.
  it("feedGatewayErrors reads an on-premise summary's header under `HEADER`", () => {
    const start = onprem.indexOf('<h4 id="HEADER"');
    const end = onprem.indexOf('</table>', start) + '</table>'.length;
    const header = onprem
      .slice(start, end)
      .replace(
        '<b>Type</b></td><td>  </td>',
        '<b>Type</b></td><td> Frontend Error </td>',
      );
    expect(header).toContain(' Frontend Error ');
    const escaped = header
      .split('&')
      .join('&amp;')
      .split('<')
      .join('&lt;')
      .split('>')
      .join('&gt;');
    const feed =
      '<?xml version="1.0" encoding="utf-8"?><atom:feed xml:lang="EN" xmlns:atom="http://www.w3.org/2005/Atom">' +
      '<atom:title>SAP Gateway Error Log</atom:title><atom:entry>' +
      '<atom:author><atom:name>USER1 (USERGUID1)</atom:name></atom:author>' +
      '<atom:id>FrontendError/0123456789ABCDEF0123456789ABCDEF</atom:id>' +
      `<atom:summary type="html">${escaped}</atom:summary>` +
      '<atom:title>Frontend Error: the title, not the summary</atom:title>' +
      '</atom:entry></atom:feed>';
    const [entry, ...rest] = feedGatewayErrors({
      ...answer('onprem-gatewayerrors.xml'),
      data: feed,
    });
    expect(rest).toEqual([]);
    expect(entry).toMatchObject({
      type: 'Frontend Error',
      shortText: "Service group 'ZSERVICE_GROUP1' not published",
      package: '/IWFND/V4_COS_PUBLISHING',
      applicationComponent: 'n/a',
      dateTime: '25.11.2026 01:57:32 (System)',
      client: 'CLIENT1',
      opid: '0123456789ABCDEF0123456789ABCDEF',
      detailUri:
        '/sap/bc/adt/gw/errorlog/FrontendError/0123456789ABCDEF0123456789ABCDEF',
    });
  });

  // The recorded document's `Destination` is empty; the same document with
  // one written, in the on-premise label.
  it('feedGatewayErrorDetail reads a non-empty on-premise `Destination`', () => {
    const empty = '<b>Destination</b></td><td>  </td>';
    expect(onprem).toContain(empty);
    const detail = feedGatewayErrorDetail({
      ...answer('onprem-gatewayerror-detail.body.txt'),
      data: onprem.replace(
        empty,
        '<b>Destination</b></td><td> DESTINATION1 </td>',
      ),
    });
    expect(detail.serviceInfo.destination).toBe('DESTINATION1');
  });
});
