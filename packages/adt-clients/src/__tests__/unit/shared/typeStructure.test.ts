/**
 * `getUtils().getTypeStructure()` is one request: `POST
 * /sap/bc/adt/repository/typestructure`, no body, with the type list's own
 * Accept — the exchange recorded on S/4HANA 2025, ABAP cloud and SAP_BASIS
 * 7.40 SP04. It answers the document as it came, and sends the caller's
 * headers, like its siblings.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { noopLogger } from '../../../utils/noopLogger';
import { headersOf } from '../../helpers/adtHeaders';

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
    const utils = new AdtUtils(connection, noopLogger, utilDocuments);
    const answer = await utils.getTypeStructure({
      headers: headersOf(utils, 'getTypeStructure'),
    });

    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe('/sap/bc/adt/repository/typestructure');
    expect(request?.data).toBeUndefined();
    expect(request?.params).toBeUndefined();
    expect(request?.headers).toEqual({
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.RepositoryTypeList',
      'Content-Type': 'application/xml',
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected the document');
    expect(answer.getResult().value).toBe('<asx:abap/>');
  });

  it("sends the caller's headers as given", async () => {
    const { connection, sent } = recording();
    await new AdtUtils(connection, noopLogger, utilDocuments).getTypeStructure({
      headers: { accept: 'application/xml', contentType: 'text/plain' },
    });
    expect(sent[0]?.headers).toEqual({
      Accept: 'application/xml',
      'Content-Type': 'text/plain',
    });
  });

  it('touches no session type', async () => {
    const { connection } = recording();
    const utils = new AdtUtils(connection, noopLogger, utilDocuments);
    await utils.getTypeStructure({
      headers: headersOf(utils, 'getTypeStructure'),
    });
    expect(connection.setSessionType).not.toHaveBeenCalled();
  });
});
