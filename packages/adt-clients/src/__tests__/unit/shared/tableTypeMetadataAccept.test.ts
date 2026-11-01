/**
 * `getUtils().readObjectMetadata('TTYP/DA', …)` asks for the media type the
 * table type's own read asks for. Measured on premise (2026-11-01, read
 * only): `GET /sap/bc/adt/ddic/tabletypes/STRING_TABLE` answers `406` with
 * `tabletypes.v2+xml, tabletypes.v1+xml, blues.v1+xml` — what this read sent
 * before — and `200` with `tabletype.v1+xml`, the Accept of
 * `getTableType().readMetadata()`.
 */
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { RecordingConnection } from '../../helpers/recordingConnection';

const MEASURED_ACCEPT = 'application/vnd.sap.adt.tabletype.v1+xml';

it('a table type metadata read sends the measured Accept', async () => {
  const connection = new RecordingConnection();

  await new AdtUtils(connection, {
    logger: noopLogger,
    results: utilDocuments,
  }).readObjectMetadata('TTYP/DA', 'STRING_TABLE');

  expect(connection.sent).toHaveLength(1);
  expect(connection.sent[0]?.url).toBe(
    '/sap/bc/adt/ddic/tabletypes/string_table',
  );
  expect(connection.sent[0]?.headers).toEqual({ Accept: MEASURED_ACCEPT });
});

it("the table type's own read sends the same Accept", async () => {
  const connection = new RecordingConnection();

  await new AdtClientOnPrem(connection, noopLogger)
    .getTableType()
    .readMetadata({ tableTypeName: 'STRING_TABLE' });

  expect(connection.sent[0]?.headers).toEqual({ Accept: MEASURED_ACCEPT });
});
