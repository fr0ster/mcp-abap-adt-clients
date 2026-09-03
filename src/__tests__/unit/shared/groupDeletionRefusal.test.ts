/**
 * A deletion that did not delete is a failure; a check that says "no" is not.
 *
 * Both endpoints answer **200** with the same document shape, and the difference
 * is what was asked. `deleteObjectsGroup` asked for something and did not get it.
 * `checkDeletionGroup` asked a question and got its answer — `isDeletable="false"`
 * with a reason is what a caller runs the check *for*, and turning it into a
 * failure would make the useful answer the hard one to read.
 *
 * The document below is verbatim from a cloud trial, 2026-09-03, for a package
 * with two objects in it.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';

/** What ADT answers when the objects were not deleted. */
const NOT_DELETED =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<del:deletionResult xmlns:del="http://www.sap.com/adt/deletion">' +
  '<del:object del:isDeleted="false" adtcore:name="ZADT_BLD_PKG03" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<del:message del:type="E"><del:text>Package contains 2 objects</del:text></del:message>' +
  '</del:object></del:deletionResult>';

const DELETED =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<del:deletionResult xmlns:del="http://www.sap.com/adt/deletion">' +
  '<del:object del:isDeleted="true" adtcore:name="ZGONE" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core"/>' +
  '</del:deletionResult>';

/** The check endpoint's own shape, answering the question it was asked. */
const NOT_DELETABLE =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<del:checkResponse xmlns:del="http://www.sap.com/adt/deletion">' +
  '<del:object del:isDeletable="false" adtcore:name="ZADT_BLD_PKG03" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<del:message del:type="E"><del:text>Package contains 2 objects</del:text></del:message>' +
  '</del:object></del:checkResponse>';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const answering = (data: string): IAbapConnection =>
  ({
    setSessionType: jest.fn(),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async () => ({
      status: 200,
      statusText: 'OK',
      data,
      headers: {},
    })),
  }) as unknown as IAbapConnection;

const ONE_PACKAGE = [{ name: 'ZADT_BLD_PKG03', type: 'DEVC/K' }];

describe('deleteObjectsGroup', () => {
  it('answers a failure when the objects were not deleted', async () => {
    const utils = new AdtUtils(answering(NOT_DELETED), logger);

    const response = await utils.deleteObjectsGroup(ONE_PACKAGE);

    // 200, no `<exc:exception>` — so nothing below this raised, and before the
    // fix the caller was handed `ok: true` for objects that are still there.
    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected a failure');

    const failure = response.getError();
    expect(failure.origin).toBe('refusal');
    // The server's own sentence, and the name of what refused.
    expect(failure.message).toContain('Package contains 2 objects');
    expect(failure.message).toContain('ZADT_BLD_PKG03');
  });

  it('answers a result when they were', async () => {
    const utils = new AdtUtils(answering(DELETED), logger);

    const response = await utils.deleteObjectsGroup([
      { name: 'ZGONE', type: 'CLAS/OC' },
    ]);

    expect(response.ok).toBe(true);
  });
});

describe('checkDeletionGroup', () => {
  it('answers a result when the objects cannot be deleted', async () => {
    const utils = new AdtUtils(answering(NOT_DELETABLE), logger);

    const response = await utils.checkDeletionGroup(ONE_PACKAGE);

    // The distinction this file exists for. "No, because it contains 2 objects"
    // is what a caller runs the check to find out; making it a failure would put
    // the answer they wanted on the error path.
    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(`expected a result: ${response.getError().message}`);
    }
    expect(String(response.getResult().value?.data)).toContain(
      'isDeletable="false"',
    );
  });
});

describe('the package URI the group operations ask about', () => {
  it('is /packages/, not the type code', async () => {
    const sent: string[] = [];
    const connection = {
      setSessionType: jest.fn(),
      isConnected: () => true,
      makeAdtRequest: jest.fn(async (request: { data?: unknown }) => {
        sent.push(String(request.data ?? ''));
        return { status: 200, statusText: 'OK', data: DELETED, headers: {} };
      }),
    } as unknown as IAbapConnection;

    await new AdtUtils(connection, logger).checkDeletionGroup(ONE_PACKAGE);

    // `DEVC/K` fell through 40 mapped types to a fallback that lowercases the
    // type code, producing `/sap/bc/adt/devc/k/…`. ADT answers that address with
    // "No URI-Mapping defined for URI" — inside a 200, where nothing was reading
    // it.
    expect(sent[0]).toContain('/sap/bc/adt/packages/zadt_bld_pkg03');
    expect(sent[0]).not.toContain('/devc/k/');
  });
});
