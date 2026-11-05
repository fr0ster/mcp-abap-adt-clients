/**
 * Element info: one GET per endpoint, with the one Accept SAP answers —
 * measured on premise and on the ABAP cloud (2026-11-05): both endpoints
 * answer `406` to `application/xml`, `application/json` or any other.
 */

import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

const ACCEPT = 'application/vnd.sap.adt.elementinfo+xml';

const utils = (connection: RecordingConnection) =>
  new AdtUtils(connection, { logger: noopLogger, results: utilDocuments });

describe('getStructureElementInfo', () => {
  it('sends one GET of the DDIC element info with the structure as path', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getStructureElementInfo('ZST_X');
    expect(connection.sent).toHaveLength(1);
    const [request] = connection.sent;
    expect(request?.method).toBe('GET');
    expect(request?.url).toBe('/sap/bc/adt/ddic/elementinfo?path=zst_x');
    expect(request?.headers?.Accept).toBe(ACCEPT);
  });

  it('encodes a namespaced name', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getStructureElementInfo('/DMO/S_TRAVELX');
    expect(connection.sent[0]?.url).toBe(
      '/sap/bc/adt/ddic/elementinfo?path=%2Fdmo%2Fs_travelx',
    );
  });

  it('sends the caller’s Accept', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getStructureElementInfo('ZST_X', {
      accept: 'application/xml',
    });
    expect(connection.sent[0]?.headers?.Accept).toBe('application/xml');
  });
});

describe('getServiceDefinitionElementInfo', () => {
  it('sends one GET of the SRVD element info with the definition as path', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getServiceDefinitionElementInfo('ZUI_X');
    expect(connection.sent).toHaveLength(1);
    const [request] = connection.sent;
    expect(request?.method).toBe('GET');
    expect(request?.url).toBe('/sap/bc/adt/ddic/srvd/elementinfo?path=zui_x');
    expect(request?.headers?.Accept).toBe(ACCEPT);
  });

  it('encodes a namespaced name', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getServiceDefinitionElementInfo('/DMO/UI_AGENCY');
    expect(connection.sent[0]?.url).toBe(
      '/sap/bc/adt/ddic/srvd/elementinfo?path=%2Fdmo%2Fui_agency',
    );
  });

  it('sends the caller’s Accept', async () => {
    const connection = new RecordingConnection();
    await utils(connection).getServiceDefinitionElementInfo('ZUI_X', {
      accept: 'application/xml',
    });
    expect(connection.sent[0]?.headers?.Accept).toBe('application/xml');
  });
});
