import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../../utils/activationUtils';

/**
 * Regression guard for the false-success masking bug (issue #78).
 *
 * ADT `/sap/bc/adt/activation` returns HTTP 200 even when activation fails
 * (object locked by another session, syntax errors). The body then carries
 * `<chkl:properties activationExecuted="false">` and/or `<msg type="E">`.
 * `activateObjectInSession` must throw on that explicit failure signal, while
 * preserving success for empty / unrecognized bodies.
 */
describe('activateObjectInSession — failed activation must not masquerade as success', () => {
  const OBJECT_URI = '/sap/bc/adt/ddic/domains/zd_mask_test';
  const OBJECT_NAME = 'ZD_MASK_TEST';

  function connectionReturning(data: string): IAbapConnection {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data }),
    } as unknown as IAbapConnection;
  }

  const LOCKED_FAILURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklistmessages">
  <msg objDescr="Domain ZD_MASK_TEST" type="E" line="0">
    <shortText>
      <txt>Domain ZD_MASK_TEST is locked by user OTHERUSER</txt>
    </shortText>
  </msg>
  <chkl:properties activationExecuted="false" checkExecuted="true"/>
</chkl:messages>`;

  const SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklistmessages">
  <chkl:properties activationExecuted="true" checkExecuted="true"/>
</chkl:messages>`;

  it('throws when activationExecuted="false" (locked object)', async () => {
    const connection = connectionReturning(LOCKED_FAILURE_XML);
    await expect(
      activateObjectInSession(connection, OBJECT_URI, OBJECT_NAME),
    ).rejects.toThrow(/ZD_MASK_TEST/);
  });

  it('surfaces the error-severity message text in the thrown error', async () => {
    const connection = connectionReturning(LOCKED_FAILURE_XML);
    await expect(
      activateObjectInSession(connection, OBJECT_URI, OBJECT_NAME),
    ).rejects.toThrow(/locked by user OTHERUSER/);
  });

  it('resolves when activationExecuted="true"', async () => {
    const connection = connectionReturning(SUCCESS_XML);
    const res = await activateObjectInSession(
      connection,
      OBJECT_URI,
      OBJECT_NAME,
    );
    expect(res.status).toBe(200);
  });

  it('resolves on an empty success body (no failure signal)', async () => {
    const connection = connectionReturning('');
    const res = await activateObjectInSession(
      connection,
      OBJECT_URI,
      OBJECT_NAME,
    );
    expect(res.status).toBe(200);
  });

  it('resolves on an unrecognized body (never infers failure)', async () => {
    const connection = connectionReturning('<something:else/>');
    const res = await activateObjectInSession(
      connection,
      OBJECT_URI,
      OBJECT_NAME,
    );
    expect(res.status).toBe(200);
  });
});
