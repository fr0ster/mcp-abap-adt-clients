/**
 * `getUtils().getTypeStructure()` is one request: `POST
 * /sap/bc/adt/repository/typestructure`, no body, with the type list's own
 * Accept — the exchange recorded on S/4HANA 2025, ABAP cloud and SAP_BASIS
 * 7.40 SP04. It answers the document as it came, and a caller's Accept wins.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { noopLogger } from '../../../utils/noopLogger';

interface Sent {
  url: string;
  method: string;
  data?: unknown;
  headers?: Record<string, string>;
  params?: unknown;
}

function recording(body = '<asx:abap/>') {
  const sent: Sent[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: Sent) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', data: body, headers: {} };
    }),
  } as unknown as IAbapConnection;
  return { connection, sent };
}

describe('getUtils().getTypeStructure()', () => {
  it('POSTs typestructure with no body and the type list Accept', async () => {
    const { connection, sent } = recording();
    const answer = await new AdtUtils(
      connection,
      noopLogger,
    ).getTypeStructure();

    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe('/sap/bc/adt/repository/typestructure');
    expect(request?.data).toBeUndefined();
    expect(request?.params).toBeUndefined();
    expect(request?.headers).toEqual({
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.RepositoryTypeList',
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected the document');
    expect(answer.getResult().value).toBe('<asx:abap/>');
  });

  it("sends the caller's Accept as given", async () => {
    const { connection, sent } = recording();
    await new AdtUtils(connection, noopLogger).getTypeStructure({
      accept: 'application/xml',
    });
    expect(sent[0]?.headers).toEqual({ Accept: 'application/xml' });
  });

  it('touches no session type', async () => {
    const { connection } = recording();
    await new AdtUtils(connection, noopLogger).getTypeStructure();
    expect(connection.setSessionType).not.toHaveBeenCalled();
  });
});
