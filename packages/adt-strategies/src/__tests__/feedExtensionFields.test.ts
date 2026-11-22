import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { feedSystemMessages } from '../results/feeds';

/**
 * The system-messages feed's extension fields (0.28.0): read under the local
 * name the parser leaves once it strips the prefix. They were looked up as
 * `sm:…`, which the stripping had removed, and read empty.
 *
 * **The entry shape is not measured.** The feed answered no entry on either
 * system (recorded 2026-11-22, `fixtures/feeds/*-systemmessages.xml`, read
 * below), and SAP's handler code was not read in this change: the entry is
 * written — an Atom entry in the form the feed tests use, with the elements
 * the reading names, the extension namespace's URI a placeholder. Whether SAP
 * writes these elements is unverified; a capture of a system holding a
 * message, or the handler's code, is owed. When both a category and
 * `sm:severity` are present the category's `term` is read; whether SAP sends
 * both is unverified too.
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

describe('the system-messages feed', () => {
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
});
