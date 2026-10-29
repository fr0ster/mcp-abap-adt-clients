/**
 * The utils members 7.40 does not serve answer a refusal, not a connection
 * failure, and ask nothing. The recording connection is the root package's
 * `whereUsedAddress.test.ts`'s.
 */

import { utilDocuments } from '@mcp-abap-adt/adt-clients';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { headersOf } from '../../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import { AdtUtilsLegacy } from '../../../core/shared/AdtUtilsLegacy';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const recording = () => {
  const urls: string[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: { url: string }) => {
      urls.push(request.url);
      return { status: 200, statusText: 'OK', data: '<r/>', headers: {} };
    }),
  } as unknown as IAbapConnection;
  return { connection, urls };
};

describe('AdtUtilsLegacy refusals', () => {
  it('answer an unsupported operation, not a connection failure, and ask nothing', async () => {
    const { connection, urls } = recording();
    const utils = new AdtUtilsLegacy(connection, logger, {
      results: utilDocuments,
    });

    for (const answer of [
      await utils.getSqlQuery(
        { sql_query: 'SELECT * FROM T000' },
        { headers: headersOf(utils, 'getSqlQuery') },
      ),
      await utils.getTableColumns('T000'),
      await utils.getTableContents({ table_name: 'T000' } as never, {
        headers: headersOf(utils, 'getTableContents'),
      }),
    ]) {
      expect(answer.ok).toBe(false);
      if (answer.ok) continue;
      expect(answer.getError().origin).toBe('refusal');
      expect(answer.getError().code).toBe(
        AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      );
    }
    expect(urls).toEqual([]);
  });
});
