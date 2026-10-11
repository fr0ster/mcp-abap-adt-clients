/**
 * A run carries the debuggee's ids in `SAP-PASSPORT` when it is given them, and
 * nothing when it is not.
 *
 * The expected passport is SAP's own: produced by the passport library the ADT
 * client ships, with the same ids and the same fixed root context id and
 * transaction id, the way the ADT client builds a passport for its runs.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { ClassExecutor } from '../../../executors/class/ClassExecutor';
import { ProgramExecutor } from '../../../executors/program/ProgramExecutor';
import { debuggeePassport } from '../../../runtime/debugger/passport';

const debuggee = {
  terminalId: '0123456789ABCDEF0123456789ABCDEF',
  ideId: 'FEDCBA9876543210FEDCBA9876543210',
};
const SAP_LIBRARY_PASSPORT = [
  '2A54482A03012000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000003046314532443343344235',
  '413639373838373936413542344333443245314630000000000A001122334455',
  '66778899AABBCCDDEEFF00000000000000000000000000000000000000000001',
  '00E22A54482A01003A0100010002000200010300170123456789ABCDEF012345',
  '6789ABCDEF00020002030017FEDCBA9876543210FEDCBA98765432102A54482A',
].join('');

function connection() {
  return {
    makeAdtRequest: jest.fn(async () => ({
      status: 200,
      data: 'run output',
      headers: {},
    })),
  } as unknown as IAbapConnection & { makeAdtRequest: jest.Mock };
}

describe('debuggeePassport', () => {
  it('is the passport SAP builds for the same ids and fields', () => {
    expect(
      debuggeePassport(debuggee, {
        rootContextId: '00112233445566778899AABBCCDDEEFF',
        transId: '0F1E2D3C4B5A69788796A5B4C3D2E1F0',
      }),
    ).toBe(SAP_LIBRARY_PASSPORT);
  });

  it('draws the per-request fields at random, the ids where SAP reads them', () => {
    const a = debuggeePassport(debuggee);
    const b = debuggeePassport(debuggee);
    expect(a).not.toBe(b);
    expect(a).toHaveLength(SAP_LIBRARY_PASSPORT.length);
    expect(a.slice(490, 522)).toBe(debuggee.terminalId);
    expect(a.slice(536, 568)).toBe(debuggee.ideId);
  });
});

describe.each([
  [
    'ClassExecutor',
    (c: IAbapConnection) => new ClassExecutor(c),
    { className: 'ZCL_X' },
  ],
  [
    'ProgramExecutor',
    (c: IAbapConnection) => new ProgramExecutor(c),
    { programName: 'ZPROG_X' },
  ],
] as const)('%s.run', (_name, make, target) => {
  const headersOf = (c: { makeAdtRequest: jest.Mock }) =>
    c.makeAdtRequest.mock.calls[0][0].headers as Record<string, string>;
  // biome-ignore lint/suspicious/noExplicitAny: one call shape for both executors
  const run = (c: IAbapConnection, options?: object) =>
    (make(c) as any).run(target, options);

  it('sends SAP-PASSPORT with the debuggee ids', async () => {
    const c = connection();
    await run(c, { debuggee });
    const passport = headersOf(c)['SAP-PASSPORT'];
    expect(passport.slice(490, 522)).toBe(debuggee.terminalId);
    expect(passport.slice(536, 568)).toBe(debuggee.ideId);
  });

  it('sends no passport without them', async () => {
    const c = connection();
    await run(c);
    expect(headersOf(c)).not.toHaveProperty('SAP-PASSPORT');
  });
});
