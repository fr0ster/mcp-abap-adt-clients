import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtRuntimeClient } from '../../../clients/AdtRuntimeClient';

describe('AdtRuntimeClient dumps API', () => {
  function createRuntimeClient() {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data: '' }),
    } as unknown as IAbapConnection;

    const logger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = new AdtRuntimeClient(connection, logger);
    return { client, connection };
  }

  it('buildRuntimeDumpsUserQuery returns undefined for empty user', () => {
    const { client } = createRuntimeClient();
    expect(client.buildRuntimeDumpsUserQuery()).toBeUndefined();
    expect(client.buildRuntimeDumpsUserQuery('   ')).toBeUndefined();
  });

  it('listRuntimeDumpsByUser without user lists all dumps', async () => {
    const { client, connection } = createRuntimeClient();

    await client.listRuntimeDumpsByUser(undefined, { top: 10 });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps?%24top=10',
        method: 'GET',
      }),
    );
  });

  it('getRuntimeDumpByUri delegates to dumps endpoint', async () => {
    const { client, connection } = createRuntimeClient();

    await client.getRuntimeDumpByUri('/sap/bc/adt/runtime/dumps/DUMP123');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/dumps/DUMP123',
        method: 'GET',
      }),
    );
  });
});
