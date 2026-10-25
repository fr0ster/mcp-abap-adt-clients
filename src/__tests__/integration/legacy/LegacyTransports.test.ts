/**
 * Transports on SAP_BASIS 7.40 SP04 over RFC (spec §7, §11.2).
 *
 * Measured: `GET /sap/bc/cts/transportrequests` answers `200` with the user's
 * list (a `tm:root` document). The legacy `list` and `readMetadata` send that
 * GET and nothing else; each is asserted on the recorder and on its answer.
 * How a populated list reads is not measured (spec §12), so the content is not
 * judged here.
 *
 * Nothing is created. Runs on a legacy configuration over RFC with case
 * `legacy_740/legacy_transports` enabled:
 * npm run test:detached -- integration/legacy/LegacyTransports
 */

import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { expectResult } from '../../helpers/contract';
import {
  closeLegacySession,
  type LegacySession,
  lineOf,
  openLegacySession,
  sentSince,
  withLegacyCase,
} from '../../helpers/legacyLive';
import { describeLegacyRfc } from '../../helpers/legacyRfc';

const LIST = 'GET /sap/bc/cts/transportrequests';

describeLegacyRfc('Legacy 7.40 SP04 over RFC — transports', () => {
  withLegacyCase('legacy_transports', () => {
    let session: LegacySession | undefined;
    const current = () => session as LegacySession;

    beforeAll(async () => {
      session = await openLegacySession();
    }, 120000);

    afterAll(async () => {
      await closeLegacySession(session);
    });

    const members: [
      string,
      (s: LegacySession) => Promise<IAdtResponse<unknown>>,
    ][] = [
      [
        'list',
        (s) => s.client.getRequest().list({ analyse: analyseException }),
      ],
      [
        'readMetadata',
        (s) =>
          s.client.getRequest().readMetadata({}, { analyse: analyseException }),
      ],
    ];

    for (const [member, call] of members) {
      it(`${member} sends the one GET and answers the user's list`, async () => {
        const { recorder } = current();
        const mark = recorder.requests.length;

        const value = expectResult(await call(current()), member);

        const sent = sentSince(recorder, mark);
        expect(sent.map(lineOf)).toEqual([LIST]);
        expect(sent[0]?.status).toBe(200);
        expect(String(value ?? '')).not.toBe('');
      }, 120000);
    }
  });
});
