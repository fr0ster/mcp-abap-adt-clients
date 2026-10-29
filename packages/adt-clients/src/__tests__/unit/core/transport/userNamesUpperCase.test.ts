/**
 * CTS compares a user name as it is given, and SAP user names are upper case:
 * a lower case owner was refused, measured on premise, with SCTS_ADT_MSG 009
 * "User … does not exist in the system (or locked)". The request create and
 * the task create send the name upper-cased.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtRequest } from '../../../../core/transport/AdtRequest';
import { transportDocuments } from '../../../../core/transport/types';
import { headersFor } from '../../../helpers/adtHeaders';

function recordingConnection() {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: '<tm:root/>',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
}

const body = (call: IAbapRequestOptions | undefined) =>
  String(call?.data ?? '');

describe('transport user names', () => {
  it('create sends the owner upper-cased', async () => {
    const { connection, calls } = recordingConnection();
    await new AdtRequest(
      connection,
      undefined,
      undefined,
      transportDocuments,
    ).create(
      { description: 'x', owner: 'devuser01' },
      { headers: headersFor('AdtRequest.create') },
    );
    expect(body(calls[0])).toContain('tm:owner="DEVUSER01"');
    expect(body(calls[0])).not.toContain('devuser01');
  });

  it("create sends the system context's responsible upper-cased", async () => {
    const { connection, calls } = recordingConnection();
    await new AdtRequest(
      connection,
      undefined,
      {
        responsible: 'Mixed_User',
      },
      transportDocuments,
    ).create(
      { description: 'x' },
      { headers: headersFor('AdtRequest.create') },
    );
    expect(body(calls[0])).toContain('tm:owner="MIXED_USER"');
  });

  it('createTask sends targetUser upper-cased', async () => {
    const { connection, calls } = recordingConnection();
    await new AdtRequest(
      connection,
      undefined,
      undefined,
      transportDocuments,
    ).createTask('DEVK900001', {
      headers: headersFor('AdtRequest.createTask'),
      targetUser: 'devuser02',
    });
    expect(body(calls[0])).toContain('tm:targetuser="DEVUSER02"');
    expect(body(calls[0])).not.toContain('devuser02');
  });

  it('create is one request carrying the request and its task', async () => {
    // Why a refused task part can leave the request behind: SAP does both in
    // this one POST, and the library makes no second call it could report.
    const { connection, calls } = recordingConnection();
    await new AdtRequest(
      connection,
      undefined,
      undefined,
      transportDocuments,
    ).create(
      { description: 'x', owner: 'DEVUSER01' },
      { headers: headersFor('AdtRequest.create') },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(body(calls[0])).toContain('<tm:request ');
    expect(body(calls[0])).toContain('<tm:task tm:owner="DEVUSER01"/>');
  });
});
