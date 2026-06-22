import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';

describe('AdtClient.getAppendStructure', () => {
  it('returns a handler whose objectType is AppendStructure', () => {
    const mockConnection = {
      makeAdtRequest: jest.fn(),
      setSessionType: jest.fn(),
    } as unknown as IAbapConnection;
    const client = new AdtClient(mockConnection);
    const handler = client.getAppendStructure();
    expect((handler as unknown as { objectType: string }).objectType).toBe(
      'AppendStructure',
    );
  });
});
