/**
 * `getObjectProperties` is one GET to the information system's
 * object-properties endpoint, with the object's uri encoded into the query and
 * the measured result type as `Accept`.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

interface ISentRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
}

const recording = () => {
  const requests: ISentRequest[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: ISentRequest) => {
      requests.push(request);
      return {
        status: 200,
        statusText: 'OK',
        data: '<opr:objectProperties/>',
        headers: {},
      };
    }),
  } as unknown as IAbapConnection;
  return { connection, requests };
};

const SE38 = '/sap/bc/adt/vit/wb/object_type/trant/object_name/SE38';

describe('AdtUtils.getObjectProperties', () => {
  it('sends one GET with the uri encoded and the measured Accept', async () => {
    const { connection, requests } = recording();
    const utils = new AdtUtils(connection, logger, { results: utilDocuments });

    const answer = await utils.getObjectProperties(SE38);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.method).toBe('GET');
    expect(request.url).toBe(
      `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodeURIComponent(SE38)}`,
    );
    expect(request.url).toContain(
      '?uri=%2Fsap%2Fbc%2Fadt%2Fvit%2Fwb%2Fobject_type%2Ftrant%2Fobject_name%2FSE38',
    );
    expect(request.headers?.Accept).toBe(
      'application/vnd.sap.adt.repository.objproperties.result.v1+xml',
    );
    expect(answer.ok).toBe(true);
    if (answer.ok) {
      expect(answer.getResult().value).toBe('<opr:objectProperties/>');
    }
  });

  it('encodes characters a uri query would otherwise split on', async () => {
    const { connection, requests } = recording();
    const utils = new AdtUtils(connection, logger, { results: utilDocuments });

    await utils.getObjectProperties('/sap/bc/adt/x?a=1&b=/c d');

    expect(requests[0].url).toBe(
      '/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=%2Fsap%2Fbc%2Fadt%2Fx%3Fa%3D1%26b%3D%2Fc%20d',
    );
  });
});
