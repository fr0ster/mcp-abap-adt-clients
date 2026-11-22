import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { feedGatewayErrors, feedSystemMessages } from '../results/feeds';

/**
 * The extension fields of the system-messages and gateway-error feeds
 * (0.28.0): read under the local name the parser leaves once it strips the
 * prefix. They were looked up as `sm:…` / `gw:…`, which the stripping had
 * removed, and read empty.
 *
 * **Written, not recorded.** No recording of either feed exists — not in the
 * adt-clients corpus, nor in the server repository (`fr0ster/mcp-abap-adt`,
 * tests and fixtures). These are Atom entries in the form the feed tests use
 * (`feedReadings.test.ts`), with the extension elements the readings name;
 * the extension namespaces' URIs are placeholders. A live capture is owed.
 */
const answer = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

const SYSTEM_MESSAGES = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:sm="urn:written:systemmessages">
  <atom:entry>
    <atom:id>MSG1</atom:id>
    <atom:title>Planned downtime</atom:title>
    <atom:content>The system is down on Sunday</atom:content>
    <atom:updated>2026-11-20T08:00:00Z</atom:updated>
    <atom:author><atom:name>SAPUSER01</atom:name></atom:author>
    <sm:severity>W</sm:severity>
    <sm:validFrom>2026-11-22T06:00:00Z</sm:validFrom>
    <sm:validTo>2026-11-22T18:00:00Z</sm:validTo>
  </atom:entry>
</atom:feed>`;

const GATEWAY_ERRORS = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:gw="urn:written:gatewayerrors">
  <atom:entry>
    <atom:id>0050568A1B2C</atom:id>
    <atom:title>Resource not found for segment</atom:title>
    <atom:updated>2026-11-21T10:15:00Z</atom:updated>
    <atom:author><atom:name>SAPUSER01</atom:name></atom:author>
    <atom:category term="Backend"/>
    <gw:package>ZPKG</gw:package>
    <gw:applicationComponent>BC-ESI-ODATA</gw:applicationComponent>
    <gw:client>100</gw:client>
    <gw:requestKind>OData V2</gw:requestKind>
  </atom:entry>
</atom:feed>`;

describe('the feeds’ extension fields', () => {
  it('feedSystemMessages reads severity, validFrom and validTo', () => {
    expect(feedSystemMessages(answer(SYSTEM_MESSAGES))).toEqual([
      {
        id: 'MSG1',
        title: 'Planned downtime',
        text: 'The system is down on Sunday',
        severity: 'W',
        validFrom: '2026-11-22T06:00:00Z',
        validTo: '2026-11-22T18:00:00Z',
        createdBy: 'SAPUSER01',
      },
    ]);
  });

  it('feedGatewayErrors reads package, applicationComponent, client and requestKind', () => {
    expect(feedGatewayErrors(answer(GATEWAY_ERRORS))).toEqual([
      {
        type: 'Backend',
        shortText: 'Resource not found for segment',
        transactionId: '0050568A1B2C',
        package: 'ZPKG',
        applicationComponent: 'BC-ESI-ODATA',
        dateTime: '2026-11-21T10:15:00Z',
        username: 'SAPUSER01',
        client: '100',
        requestKind: 'OData V2',
      },
    ]);
  });
});
