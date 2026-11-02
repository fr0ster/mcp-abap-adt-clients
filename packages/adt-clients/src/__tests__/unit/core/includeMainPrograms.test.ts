/**
 * An include's main programs: `readMainPrograms` sends the one request its
 * endpoint takes and answers SAP's document as it came. The body below has the
 * shape measured on premise (2026-11-02) — `adtcore:objectReferences`, one
 * reference per program — with the names replaced.
 */
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { CriticalSectionConnection } from '../../helpers/recordingConnection';

const ONE_PROGRAM =
  '<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/programs/programs/zmain_prog" adtcore:type="PROG/P" adtcore:name="ZMAIN_PROG"/></adtcore:objectReferences>';
const NONE =
  '<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"/>';

describe('include readMainPrograms', () => {
  for (const [name, encoded] of [
    ['ZMAIN_PROG_FRM', 'zmain_prog_frm'],
    ['/ABC/ZMAIN_INC', '%2Fabc%2Fzmain_inc'],
  ]) {
    it(`asks ${name}'s mainprograms with its Accept`, async () => {
      const connection = new CriticalSectionConnection(() => ONE_PROGRAM);
      await new AdtClientOnPrem(connection)
        .getInclude()
        .readMainPrograms({ includeName: name });
      expect(connection.sent).toHaveLength(1);
      const [request] = connection.sent;
      expect(request?.method).toBe('GET');
      expect(request?.url).toBe(
        `/sap/bc/adt/programs/includes/${encoded}/mainprograms`,
      );
      expect(request?.headers).toEqual({
        Accept: 'application/vnd.sap.adt.programs.includes.mainprograms+xml',
      });
    });
  }

  for (const [label, body] of [
    ['one program', ONE_PROGRAM],
    ['no program', NONE],
  ]) {
    it(`answers SAP's document as it came: ${label}`, async () => {
      const answer = await new AdtClientOnPrem(
        new CriticalSectionConnection(() => body),
      )
        .getInclude()
        .readMainPrograms({ includeName: 'ZMAIN_PROG_FRM' });
      expect(answer.ok).toBe(true);
      if (answer.ok) expect(answer.getResult().value).toBe(body);
    });
  }
});
