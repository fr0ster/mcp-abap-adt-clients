/**
 * A refusal a caller can locate.
 *
 * `IAdtError.request` answers "which of them" — `delete()` sends two requests
 * and `create()` six, and a refusal without it leaves the caller to guess which
 * step spoke. It filled itself on two of the three paths a refusal arrives on:
 * a request that throws carries its own config, and a document `sapErrorIn`
 * recognises is built with the request beside it.
 *
 * The third path had nothing. A `200 OK` whose verdict is in a document nobody
 * classifies as an exception — an activation checklist, a deletion check, a
 * publication severity — is read by a shipped `analyse`, and by then the URL is
 * gone: measured against a live system, a successful answer arrives as
 * `status`, `statusText`, `headers` and `data`, with `config` and `request`
 * dropped by the connection.
 *
 * So `withRefusalDetection` attaches it on the way back, and these say it
 * arrives, that it survives the strategies, and that a strategy given nothing
 * reports nothing rather than an empty shell.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../../utils/activationUtils';
import { withRefusalDetection } from '../../../utils/refusalAware';
import { requestOf } from '../../../utils/requestTrace';

/** What ADT answers for a class that is not there. Measured on trial. */
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

describe('the request a refusal arrived on', () => {
  it('is attached to an answer the connection stripped it from', async () => {
    const connection = withRefusalDetection(answering(REFUSED_ACTIVATION));

    const answer = await connection.makeAdtRequest({
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
      method: 'POST',
    } as Parameters<IAbapConnection['makeAdtRequest']>[0]);

    expect(requestOf(answer)).toEqual({
      method: 'POST',
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
    });
  });

  it('reaches the caller on a strategy that reads a 200 as a refusal', async () => {
    const connection = withRefusalDetection(answering(REFUSED_ACTIVATION));
    const answer = await connection.makeAdtRequest({
      url: '/sap/bc/adt/activation?method=activate',
      method: 'POST',
    } as Parameters<IAbapConnection['makeAdtRequest']>[0]);

    const verdict = activationRefusal(ADT_NO_FAILURE, answer);

    expect(verdict).not.toBe(ADT_NO_FAILURE);
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a refusal');
    expect(verdict.origin).toBe('refusal');
    expect(verdict.request).toEqual({
      method: 'POST',
      url: '/sap/bc/adt/activation?method=activate',
    });
    // The verdict itself is unchanged by any of this.
    expect(verdict.message).toMatch(/does not have a TMDIR entry/);
  });

  it('does not leave an empty shell when there is nothing to report', () => {
    // A handler built on a connection no client wrapped. Reporting `{}` there
    // would say "the request is known and has no method and no URL", which is
    // a different and false claim.
    const bare = {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: REFUSED_ACTIVATION,
    } as IAdtWireResponse;

    expect(requestOf(bare)).toBeUndefined();

    const verdict = activationRefusal(ADT_NO_FAILURE, bare);
    if (verdict === ADT_NO_FAILURE) throw new Error('expected a refusal');
    expect(verdict.request).toBeUndefined();
    expect(verdict.message).toMatch(/does not have a TMDIR entry/);
  });

  it('wraps once, however many times it is asked', async () => {
    const connection = answering(REFUSED_ACTIVATION);
    const once = withRefusalDetection(connection).makeAdtRequest;
    withRefusalDetection(connection);
    withRefusalDetection(connection);

    expect(connection.makeAdtRequest).toBe(once);
  });
});
