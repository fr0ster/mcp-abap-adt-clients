/**
 * A refusal a caller can locate.
 *
 * `IAdtError.request` answers "which of them" — a delete sends two requests and
 * a create six, and a refusal without it leaves the caller to guess which step
 * spoke. It fills itself where a request throws, because the error carries its
 * own config.
 *
 * The path with nothing is a `200 OK`. The connection normalises a successful
 * answer down to four fields:
 *
 * ```
 * keys:     status, statusText, headers, data      // a 200, measured
 * config?   NONE
 * request?  NONE
 * ```
 *
 * so a strategy reading that document has no URL left to report. `withRequestTrace`
 * puts it back, and reads nothing while doing it.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { answering as compose } from '../../../utils/adtResponse';
import { requestOf, withRequestTrace } from '../../../utils/requestTrace';
import { rawDocument } from '../../../utils/resultStrategy';

/** An activation checklist carrying an error-severity message. */
const REFUSED_ACTIVATION = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="true"/>
  <msg objDescr="CLAS ZZ_NO_SUCH_OBJECT_ZZ" type="E" line="1" code="OO(045)">
    <shortText><txt>Class ZZ_NO_SUCH_OBJECT_ZZ does not have a TMDIR entry</txt></shortText>
  </msg>
</chkl:messages>`;

/**
 * A connection that answers exactly what the real one does — four fields, no
 * `config` and no `request`. Anything richer would prove the wrapper works on a
 * stub nobody ships.
 */
const answering = (data: string): IAbapConnection =>
  ({
    makeAdtRequest: async () =>
      ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data,
      }) as IAdtWireResponse,
  }) as unknown as IAbapConnection;

describe('the request an answer arrived on', () => {
  it('is attached to an answer the connection stripped it from', async () => {
    const connection = withRequestTrace(answering(REFUSED_ACTIVATION));

    const answer = await connection.makeAdtRequest({
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
      method: 'POST',
    } as Parameters<IAbapConnection['makeAdtRequest']>[0]);

    expect(requestOf(answer)).toEqual({
      method: 'POST',
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
    });
  });

  it('leaves the document untouched', async () => {
    const connection = withRequestTrace(answering(REFUSED_ACTIVATION));

    const answer = await connection.makeAdtRequest({
      url: '/sap/bc/adt/activation',
      method: 'POST',
    } as Parameters<IAbapConnection['makeAdtRequest']>[0]);

    // The wrapper reads nothing. An error-severity message in the body is not
    // its business, and the answer is still a 200 carrying that body.
    expect(answer.status).toBe(200);
    expect(String(answer.data)).toMatch(/does not have a TMDIR entry/);
  });

  it('does not leave an empty shell when there is nothing to report', () => {
    // A member built on a connection no client wrapped. Reporting `{}` there
    // would say "the request is known and has no method and no URL", which is
    // a different and false claim.
    const bare = {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: REFUSED_ACTIVATION,
    } as IAdtWireResponse;

    expect(requestOf(bare)).toBeUndefined();
  });

  it('is attached to a status the transport refused', async () => {
    // The path a refusal most often takes, and the one that had nothing: the
    // transport throws, and what it puts in `request` is its own native object
    // rather than the two fields the contract asks for.
    const refusing = {
      makeAdtRequest: async () => {
        const error = new Error(
          'Request failed with status code 403',
        ) as Error & {
          response?: unknown;
          request?: unknown;
        };
        error.response = {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          data: '<exc><localizedMessage>locked</localizedMessage></exc>',
        };
        error.request = { aNativeRequestObject: true };
        throw error;
      },
    } as unknown as IAbapConnection;

    const connection = withRequestTrace(refusing);

    await expect(
      connection.makeAdtRequest({
        url: '/sap/bc/adt/oo/classes/zcl_x',
        method: 'DELETE',
      } as Parameters<IAbapConnection['makeAdtRequest']>[0]),
    ).rejects.toMatchObject({
      request: { method: 'DELETE', url: '/sap/bc/adt/oo/classes/zcl_x' },
    });
  });

  it('reaches the caller on the failure the contract builds from it', async () => {
    const refusing = {
      makeAdtRequest: async () => {
        const error = new Error(
          'Request failed with status code 403',
        ) as Error & {
          response?: unknown;
        };
        error.response = {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          data: '<exc><localizedMessage>locked</localizedMessage></exc>',
        };
        throw error;
      },
    } as unknown as IAbapConnection;

    const connection = withRequestTrace(refusing);

    const answer = await compose(
      () =>
        connection.makeAdtRequest({
          url: '/sap/bc/adt/oo/classes/zcl_x',
          method: 'DELETE',
        } as Parameters<IAbapConnection['makeAdtRequest']>[0]),
      rawDocument,
    );

    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    const failure = answer.getError();
    expect(failure.request).toEqual({
      method: 'DELETE',
      url: '/sap/bc/adt/oo/classes/zcl_x',
    });
    expect(failure.response?.status).toBe(403);
  });

  it('wraps once, however many times it is asked', async () => {
    const connection = answering(REFUSED_ACTIVATION);
    const once = withRequestTrace(connection).makeAdtRequest;
    withRequestTrace(connection);
    withRequestTrace(connection);

    expect(connection.makeAdtRequest).toBe(once);
  });
});
