/**
 * Activation is judged by the messages, never by a flag — and never by silence.
 *
 * This handler POSTs correctly and then ignores what comes back, so a failed
 * activation reached the caller as `errors: []`. Nine other handlers call
 * assertActivationSucceeded; this one has its own activation and was missed
 * when 10.0.2 fixed them.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtFunctionGroup } from '../../../../core/functionGroup/AdtFunctionGroup';

const FAILED = `<?xml version="1.0" encoding="utf-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <msg objDescr="ZFG_TEST" type="E" line="12"
       href="/sap/bc/adt/functions/groups/zfg_test">
    <shortText><txt>Function group ZFG_TEST could not be activated</txt></shortText>
  </msg>
</chkl:messages>`;

const connectionReturning = (body: string) => {
  const calls: { url: string; method: string }[] = [];
  return {
    calls,
    connection: {
      connect: async () => {},
      getBaseUrl: async () => 'https://example',
      getSessionId: () => null,
      setSessionType: () => {},
      makeAdtRequest: async (o: { url: string; method: string }) => {
        calls.push({ url: o.url, method: o.method });
        return {
          data: body,
          status: 200,
          statusText: 'OK',
          headers: {},
        } as unknown as IAdtWireResponse;
      },
    } as unknown as IAbapConnection,
  };
};

describe('function group activation reports what the server said', () => {
  it('rejects when the response carries an error-severity message', async () => {
    const { connection } = connectionReturning(FAILED);

    await expect(
      new AdtFunctionGroup(connection).activate({
        functionGroupName: 'ZFG_TEST',
      }),
    ).rejects.toThrow(/could not be activated/);
  });

  it('still POSTs to the activation resource', async () => {
    const { connection, calls } = connectionReturning('<chkl:messages/>');

    await new AdtFunctionGroup(connection).activate({
      functionGroupName: 'ZFG_TEST',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/sap/bc/adt/activation');
  });

  it('does not treat an empty message list as failure', async () => {
    const { connection } = connectionReturning('<chkl:messages/>');

    const state = await new AdtFunctionGroup(connection).activate({
      functionGroupName: 'ZFG_TEST',
    });

    expect(state.errors).toEqual([]);
  });
});
