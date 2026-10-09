import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AmdpDebugger } from '../../../runtime/debugger/AmdpDebugger';

/**
 * Each member sends the request Eclipse ADT sends — read from its
 * Communication Log and repeated by scripts/probe-amdp-debugger.ts on premise
 * (S/4HANA, 2026-10-09).
 */
describe('AmdpDebugger', () => {
  const MAIN_ID = '0CC47A1E68C11FE1B0FDAAEFB73355CB';
  const DEBUGGEE = 'dbhost:30103:263414:259135:1';

  function setup(
    answer: unknown = {
      status: 200,
      data: '',
      headers: { location: `/sap/bc/adt/amdp/debugger/main/${MAIN_ID}` },
    },
  ) {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue(answer),
    } as unknown as IAbapConnection;
    const debugger_ = new AmdpDebugger(connection);
    const sent = () =>
      (connection.makeAdtRequest as jest.Mock).mock.calls[0][0] as {
        url: string;
        method: string;
        data?: string;
        headers?: Record<string, string>;
        timeout: number;
      };
    return { debugger_, sent };
  }

  it('start posts for the user, as Eclipse does, and answers the session whole', async () => {
    const { debugger_, sent } = setup();
    const answer = await debugger_.start('SAPUSER01');
    expect(sent()).toMatchObject({
      method: 'POST',
      url: '/sap/bc/adt/amdp/debugger/main?stopExisting=false&requestUser=SAPUSER01&cascadeMode=NONE',
    });
    expect(sent().headers?.Accept).toBe(
      'application/vnd.sap.adt.amdp.dbg.startmain.v1+xml',
    );
    // The session id is in Location, so the default reading keeps the headers.
    expect(
      answer.ok && String(answer.getResult().value.headers.location),
    ).toContain(MAIN_ID);
  });

  it('syncBreakpoints posts a FULL sync with each breakpoint by URI and client id', async () => {
    const { debugger_, sent } = setup();
    await debugger_.syncBreakpoints(MAIN_ID, [
      {
        clientId: '87f9506f-90a0-43e6-9cc9-d69f6a89e59a',
        uri: '/sap/bc/adt/oo/classes/zcl_probe/source/main#start=24',
      },
    ]);
    const request = sent();
    expect(request).toMatchObject({
      method: 'POST',
      url: `/sap/bc/adt/amdp/debugger/main/${MAIN_ID}/breakpoints`,
    });
    expect(request.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.amdp.dbg.bpsync.v1+xml',
    );
    expect(request.data).toContain('amdpdbg:syncMode="FULL"');
    expect(request.data).toContain(
      'amdpdbg:clientId="87f9506f-90a0-43e6-9cc9-d69f6a89e59a" adtcore:uri="/sap/bc/adt/oo/classes/zcl_probe/source/main#start=24"',
    );
  });

  it('a sync with no breakpoints clears them', async () => {
    const { debugger_, sent } = setup();
    await debugger_.syncBreakpoints(MAIN_ID, []);
    expect(sent().data).toContain('<amdpdbg:breakpoints/>');
  });

  it('getEvents reads the session, accepting every version, and outwaits the server hold', async () => {
    const { debugger_, sent } = setup({ status: 200, data: '', headers: {} });
    await debugger_.getEvents(MAIN_ID);
    expect(sent()).toMatchObject({
      method: 'GET',
      url: `/sap/bc/adt/amdp/debugger/main/${MAIN_ID}`,
      timeout: 260_000,
    });
    expect(sent().headers?.Accept).toBe(
      'application/vnd.sap.adt.amdp.dbg.main.v4+xml, application/vnd.sap.adt.amdp.dbg.main.v3+xml, application/vnd.sap.adt.amdp.dbg.main.v2+xml, application/vnd.sap.adt.amdp.dbg.main.v1+xml',
    );
  });

  it('step posts over or continue to the encoded debuggee', async () => {
    const { debugger_, sent } = setup();
    await debugger_.step(MAIN_ID, DEBUGGEE, 'over');
    expect(sent()).toMatchObject({
      method: 'POST',
      url: `/sap/bc/adt/amdp/debugger/main/${MAIN_ID}/debuggees/dbhost%3A30103%3A263414%3A259135%3A1?step=over`,
    });
  });

  it('getDataPreview posts text/plain — empty without a SELECT, the SELECT otherwise', async () => {
    const whole = setup({ status: 200, data: '', headers: {} });
    await whole.debugger_.getDataPreview({
      rowNumber: 100,
      sessionId: 'dbhost:30103:263414',
      debuggerId: MAIN_ID,
      debuggeeId: DEBUGGEE,
      variableName: 'LT_ROWS',
      provideRowId: true,
    });
    expect(whole.sent()).toMatchObject({
      method: 'POST',
      url: `/sap/bc/adt/datapreview/amdpdebugger?rowNumber=100&sessionId=dbhost%3A30103%3A263414&debuggerId=${MAIN_ID}&debuggeeId=dbhost%3A30103%3A263414%3A259135%3A1&variableName=LT_ROWS&provideRowId=true`,
      data: '',
    });
    expect(whole.sent().headers?.['Content-Type']).toBe('text/plain');

    const select = setup({ status: 200, data: '', headers: {} });
    await select.debugger_.getDataPreview({
      variableName: 'LT_ROWS',
      query: 'SELECT ":LT_ROWS"."N" AS "N" FROM ":LT_ROWS"',
    });
    expect(select.sent().data).toBe(
      'SELECT ":LT_ROWS"."N" AS "N" FROM ":LT_ROWS"',
    );
  });

  it('deleteDebuggee deletes the debuggee; stop deletes the session, hardStop false by default', async () => {
    const remove = setup();
    await remove.debugger_.deleteDebuggee(MAIN_ID, DEBUGGEE);
    expect(remove.sent()).toMatchObject({
      method: 'DELETE',
      url: `/sap/bc/adt/amdp/debugger/main/${MAIN_ID}/debuggees/dbhost%3A30103%3A263414%3A259135%3A1`,
    });

    const stop = setup();
    await stop.debugger_.stop(MAIN_ID);
    expect(stop.sent()).toMatchObject({
      method: 'DELETE',
      url: `/sap/bc/adt/amdp/debugger/main/${MAIN_ID}?hardStop=false`,
    });

    const hard = setup();
    await hard.debugger_.stop(MAIN_ID, { hardStop: true });
    expect(hard.sent().url).toContain('?hardStop=true');
  });
});
