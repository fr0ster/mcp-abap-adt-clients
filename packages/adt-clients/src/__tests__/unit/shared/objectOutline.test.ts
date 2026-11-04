/**
 * An object's outline: one GET of `<object uri>/objectstructure` per kind,
 * with the Accept every kind answers (measured on premise and on the ABAP
 * cloud, 2026-11-04 — a program, an include and a function group answer 406
 * to any other).
 */

import { AdtUtils } from '../../../core/shared/AdtUtils';
import type { AdtOutlineCode } from '../../../core/shared/objectStructure';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

const ACCEPT = 'application/vnd.sap.adt.objectstructure.v2+xml';

describe('getObjectOutline', () => {
  it.each([
    ['CLAS/OC', 'ZCL_X', '/sap/bc/adt/oo/classes/zcl_x/objectstructure'],
    ['INTF/OI', 'ZIF_X', '/sap/bc/adt/oo/interfaces/zif_x/objectstructure'],
    ['PROG/P', 'ZPROG', '/sap/bc/adt/programs/programs/zprog/objectstructure'],
    ['PROG/I', 'ZINC', '/sap/bc/adt/programs/includes/zinc/objectstructure'],
    ['FUGR/F', 'ZFG', '/sap/bc/adt/functions/groups/zfg/objectstructure'],
  ] satisfies [AdtOutlineCode, string, string][])(
    '%s: one GET of its objectstructure',
    async (kind, name, url) => {
      const connection = new RecordingConnection();
      await new AdtUtils(connection, {
        logger: noopLogger,
        results: utilDocuments,
      }).getObjectOutline(kind, name);
      expect(connection.sent).toHaveLength(1);
      const [request] = connection.sent;
      expect(request?.method).toBe('GET');
      expect(request?.url).toBe(url);
      expect(request?.headers?.Accept).toBe(ACCEPT);
    },
  );

  it('sends the version asked, and the caller’s Accept', async () => {
    const connection = new RecordingConnection();
    await new AdtUtils(connection, {
      logger: noopLogger,
      results: utilDocuments,
    }).getObjectOutline('CLAS/OC', 'ZCL_X', {
      version: 'inactive',
      accept: 'application/xml',
    });
    const [request] = connection.sent;
    expect(request?.url).toBe(
      '/sap/bc/adt/oo/classes/zcl_x/objectstructure?version=inactive',
    );
    expect(request?.headers?.Accept).toBe('application/xml');
  });
});
