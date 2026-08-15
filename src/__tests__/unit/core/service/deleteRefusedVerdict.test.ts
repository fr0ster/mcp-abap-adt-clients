/**
 * A refused deletion has to stop the delete.
 *
 * 12.0.0 added `/deletion/check` to the service binding, which had been the one
 * handler of 28 deleting without asking. The capability guard proves both
 * requests are made — but only against a fixture where ADT says yes. Remove
 * `assertDeletable` and every test stays green, which brings back exactly the
 * defect the fix was for: the answer is fetched and then ignored. Caught in
 * review, 2026-08-15.
 *
 * So this asserts the half a request-shape check cannot: that a "no" is heard,
 * and that nothing is deleted after it.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtServiceBinding } from '../../../../core/service/AdtService';
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
      } as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { calls, connection };
}

const config = { bindingName: 'ZGUARD_SRVB' };

describe('service binding delete honours the verdict', () => {
  it('a refusal rejects, and nothing is deleted', async () => {
    const { calls, connection } = recording(REFUSED);
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    await expect(binding.delete(config)).rejects.toThrow(
      /still used|ZGUARD_SRVB/i,
    );

    expect(
      calls.some((c) => c.url.includes('/sap/bc/adt/deletion/check')),
    ).toBe(true);
    expect(
      calls.some((c) => c.url.includes('/sap/bc/adt/deletion/delete')),
    ).toBe(false);
  });

  it('an approval lets the delete through', async () => {
    const { calls, connection } = recording(APPROVED);
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    await binding.delete(config);

    expect(
      calls.some((c) => c.url.includes('/sap/bc/adt/deletion/delete')),
    ).toBe(true);
  });

  it('an empty answer is not an approval', async () => {
    // A body ADT never sent, and the parser defaults to refusing rather than
    // to proceeding — a deletion the server never approved is not one to
    // assume. See parseDeletionCheck in utils/deletionCheck.ts.
    const { calls, connection } = recording('');
    const binding = new AdtServiceBinding(connection, createLibraryLogger());

    await expect(binding.delete(config)).rejects.toThrow();

    expect(
      calls.some((c) => c.url.includes('/sap/bc/adt/deletion/delete')),
    ).toBe(false);
  });
});
