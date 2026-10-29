/**
 * `getObjectProperties` on 7.40: the legacy class refuses it without a
 * request — legacy discovery does not list the endpoint. The recording
 * connection is the root package's `objectProperties.test.ts`'s.
 */

import { utilDocuments } from '@mcp-abap-adt/adt-clients';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';

interface ISentRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
}

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

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

describe('AdtUtilsLegacy.getObjectProperties', () => {
  it('answers an unsupported operation and asks nothing', async () => {
    const { connection, requests } = recording();
    const utils = new AdtUtilsLegacy(connection, {
      logger,
      results: utilDocuments,
    });

    const answer = await utils.getObjectProperties(SE38);

    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.getError().origin).toBe('refusal');
      expect(answer.getError().code).toBe(
        AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      );
      expect(answer.getError().message).toContain(
        '/sap/bc/adt/repository/informationsystem/objectproperties/values',
      );
    }
    expect(requests).toEqual([]);
  });
});
