import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';

describe('AdtClient.getScalarFunction', () => {
  it('returns a handler whose objectType is ScalarFunction', () => {
    const mockConnection = {
      makeAdtRequest: jest.fn(),
      setSessionType: jest.fn(),
    } as unknown as IAbapConnection;
    const client = new AdtClient(mockConnection);
    const handler = client.getScalarFunction();
    expect((handler as unknown as { objectType: string }).objectType).toBe(
      'ScalarFunction',
    );
  });
});
