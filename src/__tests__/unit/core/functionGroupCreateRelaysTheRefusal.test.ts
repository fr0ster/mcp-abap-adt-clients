import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { create } from '../../../core/functionGroup/create';
import type { ICreateFunctionGroupParams } from '../../../core/functionGroup/types';

const refusing: Partial<IAbapConnection> = {
  makeAdtRequest: async () => {
    const error = new Error('Request failed with status code 400') as Error & {
      response?: unknown;
    };
    error.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      data: '<exc>Kerberos library not loaded</exc>',
    };
    throw error;
  },
};

it('relays a 400 instead of answering 201', async () => {
  await expect(
    create(
      refusing as IAbapConnection,
      {
        functionGroupName: 'ZOK_FG',
        description: 'x',
        packageName: 'ZLOCAL',
      } as ICreateFunctionGroupParams,
    ),
  ).rejects.toMatchObject({ response: { status: 400 } });
});
