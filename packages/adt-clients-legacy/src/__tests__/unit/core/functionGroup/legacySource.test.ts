/**
 * On 7.40 the function group's source — the function pool's main program — is
 * read and written with the base class's requests, inherited: `read` one GET
 * of `…/source/main` with `Accept: text/plain` (the version as asked),
 * `update` one PUT of the caller's text under the caller's lock handle, with
 * the caller's headers.
 *
 * Measured on SAP_BASIS 7.40 SP04 over RFC, 2026-10-29: the GET answered
 * `200 text/plain` (the main program, `?version=inactive` / `active` too), the
 * PUT with `Content-Type: text/plain; charset=utf-8` and `Accept: text/plain`
 * under the lock handle answered `200`, and the source read back after the
 * group's one-reference activation equalled what was written.
 */

import { functionGroupDocuments } from '@mcp-abap-adt/adt-clients';
import { RecordingConnection } from '../../../../../../adt-clients/src/__tests__/helpers/recordingConnection';
import { createLibraryLogger } from '../../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtClientLegacy } from '../../../../clients/AdtClientLegacy';
import { AdtFunctionGroupLegacy } from '../../../../core/functionGroup/AdtFunctionGroupLegacy';

const SOURCE_URI = '/sap/bc/adt/functions/groups/zfg_src/source/main';

/** Line ends, a BOM, non-ASCII and trailing space: nothing may be touched. */
const SOURCE = '﻿* legacy group source\r\n  INCLUDE LZFG_SRCTOP.\n* Ä  ';

/** The pair measured on 7.40 SP04 for the PUT of the group's source. */
const MEASURED_PAIR = {
  accept: 'text/plain',
  contentType: 'text/plain; charset=utf-8',
};

function recording(): {
  group: AdtFunctionGroupLegacy;
  sent: RecordingConnection['sent'];
} {
  const connection = new RecordingConnection();
  return {
    group: new AdtFunctionGroupLegacy(connection, {
      logger: createLibraryLogger(),
      results: functionGroupDocuments,
    }),
    sent: connection.sent,
  };
}

describe('AdtFunctionGroupLegacy source (7.40)', () => {
  it('is the base class read and update, not an override', () => {
    expect(Object.hasOwn(AdtFunctionGroupLegacy.prototype, 'read')).toBe(false);
    expect(Object.hasOwn(AdtFunctionGroupLegacy.prototype, 'update')).toBe(
      false,
    );
  });

  it('the legacy client hands out the group that reads it', async () => {
    const connection = new RecordingConnection();
    await new AdtClientLegacy(connection, createLibraryLogger())
      .getFunctionGroup()
      .read({ functionGroupName: 'ZFG_SRC' });

    expect(connection.sent.map((r) => `${r.method} ${r.url}`)).toEqual([
      `GET ${SOURCE_URI}`,
    ]);
  });

  it('read GETs the main program as text/plain', async () => {
    const { group, sent } = recording();
    await group.read({ functionGroupName: 'ZFG_SRC' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('GET');
    expect(sent[0]?.url).toBe(SOURCE_URI);
    expect(sent[0]?.headers).toStrictEqual({ Accept: 'text/plain' });
  });

  it('read asks for the version it is given', async () => {
    const { group, sent } = recording();
    await group.read({ functionGroupName: 'ZFG_SRC' }, 'inactive');
    await group.read({ functionGroupName: 'ZFG_SRC' }, 'active');

    expect(sent.map((r) => r.url)).toEqual([
      `${SOURCE_URI}?version=inactive`,
      `${SOURCE_URI}?version=active`,
    ]);
  });

  it('update PUTs the text once under the handle, with the measured pair as passed', async () => {
    const { group, sent } = recording();
    await group.update(
      { functionGroupName: 'ZFG_SRC' },
      { headers: MEASURED_PAIR, lockHandle: 'LOCK/+=1', source: SOURCE },
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('PUT');
    expect(sent[0]?.url).toBe(`${SOURCE_URI}?lockHandle=LOCK%2F%2B%3D1`);
    expect(sent[0]?.data).toBe(SOURCE);
    expect(sent[0]?.headers).toStrictEqual({
      Accept: 'text/plain',
      'Content-Type': 'text/plain; charset=utf-8',
    });
  });

  it('update names the transport request as corrNr when the config gives one', async () => {
    const { group, sent } = recording();
    await group.update(
      { functionGroupName: 'ZFG_SRC', transportRequest: 'SYSK900001' },
      { headers: MEASURED_PAIR, lockHandle: 'H', source: SOURCE },
    );

    expect(sent.map((r) => r.url)).toEqual([
      `${SOURCE_URI}?lockHandle=H&corrNr=SYSK900001`,
    ]);
  });
});
