/**
 * The library picks no bound of its own (fr0ster/mcp-abap-adt#391): a bound
 * the caller gives goes out as given, `0` included; none given, none is sent,
 * and SAP's own applies. Measured on the BTP ABAP environment (2026-11-27):
 *
 * - `/datapreview/freestyle` without `rowNumber` answered 100 records of
 *   selections of 163, 249, 1716 and 8466; `rowNumber=0` was refused `400`
 *   ("If UP TO or OFFSET is used, "0" cannot be specified …");
 * - quickSearch without `maxResults` answered 200 hits of 8886, and
 *   `maxResults=0` answered 200 as well;
 * - the object types list without `maxItemCount` answered 100 of 375, and
 *   `maxItemCount=0` 100 as well; 999 and 100000 answered all 375.
 *
 * What is asserted is the URL the connection received — the request boundary.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { headersOf } from '../../helpers/adtHeaders';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

function recording() {
  const sent: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: IAbapRequestOptions) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', data: '', headers: {} };
    }),
  } as unknown as IAbapConnection;
  const utils = new AdtUtils(connection, { logger, results: utilDocuments });
  return { utils, sent };
}

function onlyUrl(sent: IAbapRequestOptions[]): string {
  expect(sent).toHaveLength(1);
  const request = sent[0];
  if (request === undefined) throw new Error('no request was sent');
  return String(request.url);
}

describe('getSqlQuery sends the row bound as given, and none when none is given', () => {
  it('without row_number the URL carries no rowNumber', async () => {
    const { utils, sent } = recording();
    await utils.getSqlQuery(
      { sql_query: 'SELECT * FROM T' },
      { headers: headersOf(utils, 'getSqlQuery') },
    );
    expect(onlyUrl(sent)).toBe('/sap/bc/adt/datapreview/freestyle');
  });

  it.each([0, 5, 2147483646])(
    'row_number %p goes out as given',
    async (given) => {
      const { utils, sent } = recording();
      await utils.getSqlQuery(
        { sql_query: 'SELECT * FROM T', row_number: given },
        { headers: headersOf(utils, 'getSqlQuery') },
      );
      expect(onlyUrl(sent)).toBe(
        `/sap/bc/adt/datapreview/freestyle?rowNumber=${given}`,
      );
    },
  );
});

describe('search sends maxResults as given, and none when none is given', () => {
  it('without maxResults the URL carries none', async () => {
    const { utils, sent } = recording();
    await utils.search({ query: 'Z*' });
    const url = onlyUrl(sent);
    expect(url).toBe(
      '/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=Z*',
    );
  });

  it.each([0, 7])('maxResults %p goes out as given', async (given) => {
    const { utils, sent } = recording();
    await utils.search({ query: 'Z*', maxResults: given });
    expect(onlyUrl(sent)).toBe(
      `/sap/bc/adt/repository/informationsystem/search?operation=quickSearch&query=Z*&maxResults=${given}`,
    );
  });
});

describe('getAllTypes sends maxItemCount as given, and none when none is given', () => {
  it('without maxItemCount the URL carries none', async () => {
    const { utils, sent } = recording();
    await utils.getAllTypes();
    expect(onlyUrl(sent)).toBe(
      '/sap/bc/adt/repository/informationsystem/objecttypes?name=*&data=usedByProvider',
    );
  });

  it.each([0, 7])('maxItemCount %p goes out as given', async (given) => {
    const { utils, sent } = recording();
    await utils.getAllTypes(given);
    expect(onlyUrl(sent)).toBe(
      `/sap/bc/adt/repository/informationsystem/objecttypes?maxItemCount=${given}&name=*&data=usedByProvider`,
    );
  });
});
