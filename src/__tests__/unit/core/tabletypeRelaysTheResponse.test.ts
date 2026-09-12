import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { updateTableType } from '../../../core/tabletype/update';

const DOCUMENT =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<ttyp:tableType xmlns:ttyp="http://www.sap.com/adt/dictionary/tabletypes" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZOK_TT" ' +
  'adtcore:description="x"/>';

/** The write is refused, and the refusal must reach the caller intact. */
const refusingTheWrite = (): IAbapConnection =>
  ({
    makeAdtRequest: async () => {
      const error = new Error(
        'Request failed with status code 403',
      ) as Error & { response?: unknown };
      error.response = {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        data: '<exc><localizedMessage>locked</localizedMessage></exc>',
      };
      throw error;
    },
  }) as unknown as IAbapConnection;

it('lets the refusal through with its response attached', async () => {
  await expect(
    updateTableType(
      refusingTheWrite(),
      { tabletype_name: 'ZOK_TT' } as never,
      DOCUMENT,
    ),
  ).rejects.toMatchObject({ response: { status: 403 } });
});
