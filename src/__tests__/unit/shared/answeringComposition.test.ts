/**
 * The composition of the two consumer-owned strategies, over answers a real
 * system gave.
 *
 * `adt-clients` does not decide what an ADT answer means: the error strategy
 * decides whether it is a failure, the result strategy decides how it becomes a
 * value, and the failure question is answered first.
 *
 * Both directions are asserted. That a failure is reported when SAP refused, and
 * that none is reported when it did not — only the first is usually written, and
 * a library that failed everything would pass it.
 */

import type { IAdtError, IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { AdtParseError, AdtSAPError } from '../../../utils/adtErrors';
import { answering } from '../../../utils/adtResponse';
import { rawDocument } from '../../../utils/resultStrategy';

const wire = (data: string, status = 200): IAdtWireResponse => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
});

/** Verbatim from a cloud trial, 2026-09-03. 1709 bytes in full; the shape is what matters. */
const REFUSAL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceNoAccess"/>' +
  '<message lang="EN">You are not authorized to make changes ' +
  '(authorization object S_ABPLNGVS)</message></exc:exception>';

describe('answering', () => {
  it('answers the value a result strategy makes of a successful body', async () => {
    const answer = await answering(
      async () => wire('CLASS zcl_x.'),
      rawDocument,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toBe('CLASS zcl_x.');
  });

  it("carries SAP's own sentence, whole, when the request threw a refusal", async () => {
    const answer = await answering(async () => {
      throw new AdtSAPError(
        'SAP refused the request: You are not authorized to make changes ' +
          '(authorization object S_ABPLNGVS)',
        REFUSAL,
        'ExceptionResourceNoAccess',
        'com.sap.adt',
        wire(REFUSAL, 403),
      );
    }, rawDocument);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    const failure = answer.getError();
    expect(failure.origin).toBe('refusal');
    expect(failure.message).toContain('S_ABPLNGVS');
    // Not truncated: the whole document is reachable.
    expect(String(failure.response?.data)).toBe(REFUSAL);
  });

  it('consults analyse on a success, so an empty body can be called a failure', async () => {
    // ADT answers a read for a missing object with 200 and an empty body. A
    // read-modify-write must call that a failure: writing back what it read
    // would erase the object.
    const analyse = (
      verdict: IAdtError | typeof ADT_NO_FAILURE,
      answerIn?: IAdtWireResponse,
    ): IAdtError | typeof ADT_NO_FAILURE =>
      verdict !== ADT_NO_FAILURE
        ? verdict
        : String(answerIn?.data ?? '') === ''
          ? { origin: 'refusal' as const, message: 'the object is not there' }
          : ADT_NO_FAILURE;

    const answer = await answering(async () => wire(''), rawDocument, analyse);

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().message).toBe('the object is not there');
  });

  it('reports no failure when there was none — the other direction', async () => {
    // The same empty body, read by a listing, which calls it an empty list.
    const answer = await answering(
      async () => wire(''),
      rawDocument,
      () => ADT_NO_FAILURE,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toBe('');
  });

  it('lets analyse clear a refusal, and the value comes from the same answer', async () => {
    const answer = await answering(
      async () => {
        throw new AdtSAPError(
          'refused',
          '<probe/>',
          undefined,
          undefined,
          wire('<probe/>', 404),
        );
      },
      rawDocument,
      () => ADT_NO_FAILURE,
    );

    expect(answer.ok).toBe(true);
    if (!answer.ok) throw new Error('expected a result');
    expect(answer.getResult().value).toBe('<probe/>');
  });

  it('cannot be cleared into a success when nothing came back', async () => {
    // A socket that would not open carries no answer, so there is nothing for a
    // result strategy to read and no honest success to build. Enforced in code
    // rather than left to the caller.
    const answer = await answering(
      async () => {
        throw new Error('connect ECONNREFUSED');
      },
      rawDocument,
      () => ADT_NO_FAILURE,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().origin).toBe('connection');
  });

  it("does not catch the result strategy's own exception", async () => {
    // A reading's bug is the reading's. Labelling it `origin: 'connection'`
    // would advise a caller to reauthenticate over a defect in a parser.
    const boom = () => {
      throw new Error('the reading blew up');
    };

    await expect(answering(async () => wire('<x/>'), boom)).rejects.toThrow(
      'the reading blew up',
    );
  });

  it('does not dress an unreadable document as a verdict about SAP', async () => {
    // interfaces@31.0.0 removed 'parse' from AdtFailureOrigin: a document this
    // library cannot read is its own failure, not the server's.
    await expect(
      answering(async () => {
        throw new AdtParseError('adtcore:objectReferences', '<html/>');
      }, rawDocument),
    ).resolves.toMatchObject({ ok: false });

    const answer = await answering(async () => {
      throw new AdtParseError('adtcore:objectReferences', '<html/>');
    }, rawDocument);
    if (answer.ok) throw new Error('expected a failure');
    // It is reported as what it is at the transport boundary — never 'parse',
    // which no longer exists in the contract.
    expect(['connection', 'refusal']).toContain(answer.getError().origin);
  });

  it('gives a failure no cause to read', async () => {
    // interfaces@31.0.0 removed IAdtError.cause: what a library threw inside
    // itself is not part of what a consumer reads.
    const answer = await answering(async () => {
      throw new AdtSAPError(
        'refused',
        REFUSAL,
        undefined,
        undefined,
        wire(REFUSAL, 403),
      );
    }, rawDocument);

    if (answer.ok) throw new Error('expected a failure');
    expect('cause' in answer.getError()).toBe(false);
  });
});
