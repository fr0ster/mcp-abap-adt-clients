import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../../utils/activationUtils';

/**
 * Regression guard for the false-success masking bug (issue #78).
 *
 * ADT `/sap/bc/adt/activation` returns HTTP 200 even when activation fails on a
 * syntax error, carrying `<msg type="E">` in the body.
 * `activateObjectInSession` must throw on that, while preserving success for
 * empty / unrecognized bodies.
 *
 * The signal is the `E` message alone. `activationExecuted="false"` says only
 * that ADT did no work, which is also what an already-active class reports — so
 * it cannot distinguish a failure and must not be treated as one. The locked
 * object this file once claimed to cover is answered with HTTP 403 and never
 * reaches the body parser; the fixture below is kept for its `E` message, not
 * for the lock scenario in its wording.
 */
describe('activateObjectInSession — failed activation must not masquerade as success', () => {
  const OBJECT_URI = '/sap/bc/adt/ddic/domains/zd_mask_test';
  const OBJECT_NAME = 'ZD_MASK_TEST';

  function connectionReturning(data: string): IAbapConnection {
    return {
      makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data }),
    } as unknown as IAbapConnection;
  }

  const ERROR_MESSAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
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

  /**
   * What ADT really answers for a class that is already active: the flag says
   * `false` because nothing needed doing, and the message list is empty.
   *
   * Probed on a trial system, and the reason this guard exists — the previous
   * rule treated the flag alone as failure, so `AdtClient` refused a class that
   * was active, with its test include in place, and reported
   * "Activation of ZAC_CDSUT_CLS failed: activationExecuted=false". The
   * CdsUnitTest integration test could not pass.
   */
  const ALREADY_ACTIVE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="true"/>
</chkl:messages>`;

  it('resolves when nothing needed activating (flag false, no messages)', async () => {
    const connection = connectionReturning(ALREADY_ACTIVE_XML);
    const res = await activateObjectInSession(
      connection,
      OBJECT_URI,
      OBJECT_NAME,
    );
    expect(res.status).toBe(200);
  });

  it('throws on an error message even when the flag is false', async () => {
    const connection = connectionReturning(ERROR_MESSAGE_XML);
    await expect(
      activateObjectInSession(connection, OBJECT_URI, OBJECT_NAME),
    ).rejects.toThrow(/ZD_MASK_TEST/);
  });

  it('surfaces the error-severity message text in the thrown error', async () => {
    const connection = connectionReturning(ERROR_MESSAGE_XML);
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
