import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { updateTableType } from '../../../core/tabletype/update';

const CURRENT =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<ttyp:tableType xmlns:ttyp="http://www.sap.com/adt/dictionary/tabletypes" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZOK_TT" ' +
  'adtcore:description="x"/>';

/** The read answers; the write is refused. */
const refusingTheWrite = (): IAbapConnection => {
  let call = 0;
  return {
    makeAdtRequest: async () => {
      call += 1;
      if (call === 1) {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: CURRENT,
        } as IAdtWireResponse;
      }
      const error = new Error(
        'Request failed with status code 403',
      ) as Error & {
        response?: unknown;
      };
      error.response = {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        data: '<exc><localizedMessage>locked</localizedMessage></exc>',
      };
      throw error;
    },
  } as unknown as IAbapConnection;
};

it('lets the refusal through with its response attached', async () => {
  await expect(
    updateTableType(refusingTheWrite(), {
      tabletype_name: 'ZOK_TT',
    } as never),
  ).rejects.toMatchObject({ response: { status: 403 } });
});
