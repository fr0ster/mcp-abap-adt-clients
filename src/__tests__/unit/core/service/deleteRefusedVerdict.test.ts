/**
 * A refusal has to be heard as a refusal.
 *
 * Since 18.0.0 the deletion check is `checkDeletion`, its own member, and
 * `delete` is the DELETE alone. That moves the decision to the consumer — which
 * is the point — but it does not make the verdict optional reading: a
 * `checkDeletion` that fetched ADT's "no" and answered success would be worse
 * than the old buried check, because the consumer would act on it.
 *
 * The capability guard proves the request is made. Only a fixture where ADT
 * says no can prove the answer is read, and that is this file. It also pins the
 * other half of the change: `delete` no longer asks.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtServiceBinding } from '../../../../core/service/AdtService';
import { expectFailure } from '../../../helpers/contract';
import { createLibraryLogger } from '../../../helpers/testLogger';

/** ADT's answer when something still points at the object. */
const REFUSED = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkResponse xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object del:isDeletable="false" del:externalStrongReferences="2" del:externalWeakReferences="0"
    adtcore:name="ZGUARD_SRVB" adtcore:type="SRVB/SVB">
    <del:message del:priority="0" del:type="E"><del:text>Object is still used</del:text></del:message>
  </del:object>
</del:checkResponse>`;

/** And when it approves. */
const APPROVED = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkResponse xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object del:isDeletable="true" del:externalStrongReferences="0" del:externalWeakReferences="0"
    adtcore:name="ZGUARD_SRVB" adtcore:type="SRVB/SVB">
    <del:message del:priority="0" del:type="S"><del:text/></del:message>
  </del:object>
</del:checkResponse>`;

function recording(verdict: string) {
  const calls: { url: string; method: string }[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (req: { url: string; method: string }) => {
      calls.push({ url: req.url, method: req.method });
      const body = req.url.includes('/deletion/check') ? verdict : '';
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: body,
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { calls, connection };
}

const config = { bindingName: 'ZGUARD_SRVB' };

describe('service binding — the deletion verdict is read, not just fetched', () => {
  it('a refusal comes back as a failure', async () => {
    const { calls, connection } = recording(REFUSED);
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    const failure = expectFailure(
      await binding.checkDeletion(config),
      'check a binding ADT refuses to delete',
    );
    expect(failure.message).toMatch(/still used|ZGUARD_SRVB/i);

    expect(
      calls.some((c) => c.url.includes('/sap/bc/adt/deletion/check')),
    ).toBe(true);
  });

  it('an approval comes back as a result', async () => {
    const { connection } = recording(APPROVED);
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    expect((await binding.checkDeletion(config)).ok).toBe(true);
  });

  it('an empty answer is not an approval', async () => {
    // A body ADT never sent, and the parser defaults to refusing rather than
    // to proceeding — a deletion the server never approved is not one to
    // assume. See parseDeletionCheck in utils/deletionCheck.ts.
    const { connection } = recording('');
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    expectFailure(
      await binding.checkDeletion(config),
      'check on an empty verdict',
    );
  });

  it('delete does not ask — the check is the caller’s to run', async () => {
    // The other half of the 18.0.0 change, and the one a consumer has to know:
    // a delete issued without checkDeletion goes straight to ADT, which
    // answers its own refusal. This library no longer decides for the caller.
    const { calls, connection } = recording(REFUSED);
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    await binding.delete(config);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/sap/bc/adt/deletion/delete');
  });
});
