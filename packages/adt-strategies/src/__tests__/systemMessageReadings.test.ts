import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { feedSystemMessages } from '../results/feeds';

/**
 * The system-messages feed (0.28.0).
 *
 * **Built from SAP's code; not measured — 0 entries on both systems.** The
 * feed answered no entry on premise or on the cloud (recorded 2026-11-22,
 * `fixtures/feeds/*-systemmessages.xml`, read below). `ENTRY` is written as
 * `CL_STSK_ADT_RES_SYSTEM_MESSAGE` writes one, the same on both systems
 * (implementations include): `lcl_atom_service->map_feed_entry` (l. 415-451)
 * — `id` `uuid:<id>`, `updated` / `published`, `author/name`, `title` the
 * first line, an HTML `summary`; `convert_textlines_to_html` (l. 454-474) —
 * `<P>line</BR>…</P>`, each space `&nbsp;` (`make_html_conform`, l. 537-544);
 * `get_header_as_html` (l. 486-511) — the three-row table. The Atom handler
 * escapes the summary once more.
 */
const answer = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

const SUMMARY =
  '<P>Planned&nbsp;downtime&nbsp;on&nbsp;Sunday</BR>Save&nbsp;your&nbsp;work&nbsp;&lt;now&gt;</BR></P> ' +
  '<table><tr><td>Created on (System Timestamp)</td><td>22.11.2026 08:00:00 </td></tr>' +
  '<tr><td>Message ID</td><td>0000000042</td></tr>' +
  '<tr><td>Created by</td><td>SAPUSER01</td></tr></table> ';

const escapedOnce = (html: string): string =>
  html.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');

const ENTRY = `<?xml version="1.0" encoding="utf-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:author><atom:name>SAP AG</atom:name></atom:author><atom:title>System Messages of System SYS</atom:title><atom:entry><atom:author><atom:name>SAPUSER01</atom:name></atom:author><atom:id>uuid:0000000042</atom:id><atom:published>2026-11-22T07:00:00Z</atom:published><atom:summary type="html">${escapedOnce(SUMMARY)}</atom:summary><atom:title>Planned downtime on Sunday</atom:title><atom:updated>2026-11-22T07:00:00Z</atom:updated></atom:entry></atom:feed>`;

describe('feedSystemMessages', () => {
  it('reads an entry as SAP writes one', () => {
    expect(feedSystemMessages(answer(ENTRY))).toEqual([
      {
        id: 'uuid:0000000042',
        messageId: '0000000042',
        title: 'Planned downtime on Sunday',
        text: 'Planned downtime on Sunday\nSave your work <now>',
        createdOn: '22.11.2026 08:00:00',
        updated: '2026-11-22T07:00:00Z',
        createdBy: 'SAPUSER01',
        author: 'SAPUSER01',
      },
    ]);
  });

  it('answers no severity or validity, which SAP never writes', () => {
    const [entry] = feedSystemMessages(answer(ENTRY));
    for (const gone of ['severity', 'validFrom', 'validTo']) {
      expect(entry !== undefined && gone in entry).toBe(false);
    }
  });

  it.each(['cloud-systemmessages.xml', 'onprem-systemmessages.xml'])(
    'reads the recorded %s, which holds no entry, as none',
    (file) => {
      expect(
        feedSystemMessages(
          answer(
            readFileSync(join(__dirname, 'fixtures', 'feeds', file), 'utf-8'),
          ),
        ),
      ).toEqual([]);
    },
  );
});
