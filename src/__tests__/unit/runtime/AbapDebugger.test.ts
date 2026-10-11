import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseDebuggeeEnd } from '@mcp-abap-adt/adt-strategies';
import type {
  IAdtError,
  IDebuggerBreakpoint,
  IDebuggerIdentity,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  AbapDebugger,
  abapDebuggerDocuments,
  type IAbapDebuggerOptions,
} from '../../../runtime/debugger/AbapDebugger';
import {
  buildDebuggerBatchPayload,
  executeBatchRequest,
  readListenerConflict,
} from '../../../runtime/debugger/abap';

/**
 * Each member sends the request the measured sequence sends
 * (scripts/probe-debugger-cycle.ts, on premise 2026-10-09, HTTP and RFC).
 */
describe('AbapDebugger', () => {
  const identity: IDebuggerIdentity = {
    debuggingMode: 'user',
    requestUser: 'SAPUSER01',
    terminalId: 'EC80D3662BADB8CD21C70406E0E96D4C',
    ideId: '7194D729E68FDAF6E185C7E5124CC900',
  };
  const identityQuery =
    'debuggingMode=user&requestUser=SAPUSER01&terminalId=EC80D3662BADB8CD21C70406E0E96D4C&ideId=7194D729E68FDAF6E185C7E5124CC900';

  function setup(
    answer: unknown = { status: 200, data: '', headers: {} },
    options: IAbapDebuggerOptions = {},
  ) {
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue(answer),
    } as unknown as IAbapConnection;
    const debugger_ = new AbapDebugger(
      connection,
      {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as never,
      abapDebuggerDocuments,
      options,
    );
    const sent = () =>
      (connection.makeAdtRequest as jest.Mock).mock.calls[0][0] as {
        url: string;
        method: string;
        data?: string;
        headers?: Record<string, string>;
        timeout: number;
      };
    return { debugger_, sent, connection };
  }

  it('a line breakpoint carries its condition', async () => {
    const { debugger_, sent } = setup();
    await debugger_.setBreakpoints(identity, [
      { kind: 'line', uri: '/x/source/main#start=3', condition: 'lv_i > 2' },
      { kind: 'exception', exceptionClass: 'CX_X' },
    ]);
    expect(sent().data).toContain(
      '<breakpoint kind="line" adtcore:uri="/x/source/main#start=3" condition="lv_i &gt; 2"/>',
    );
    expect(sent().data).toContain(
      '<breakpoint kind="exception" exceptionClass="CX_X"/>',
    );
  });

  it('a skip count is refused before the wire: the server ignores it on an external breakpoint', async () => {
    const { debugger_, connection } = setup();
    const line = await debugger_.setBreakpoints(identity, [
      { kind: 'line', uri: '/x/source/main#start=3', skipCount: 2 },
    ]);
    expect(line.ok).toBe(false);
    if (!line.ok) expect(line.getError().message).toMatch(/skipCount/);
    const synced = await debugger_.syncBreakpoints(identity, {
      scope: 'full',
      breakpoints: [
        { kind: 'exception', exceptionClass: 'CX_X', skipCount: 1 },
      ],
    });
    expect(synced.ok).toBe(false);
    if (!synced.ok) expect(synced.getError().message).toMatch(/skipCount/);
    expect(connection.makeAdtRequest).not.toHaveBeenCalled();
  });

  it('a condition smuggled onto another kind by a cast is refused before the wire', async () => {
    const { debugger_, connection } = setup();
    const smuggled = {
      kind: 'exception',
      exceptionClass: 'CX_X',
      condition: 'a = 1',
    } as unknown as IDebuggerBreakpoint;
    const answer = await debugger_.setBreakpoints(identity, [smuggled]);
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.getError().message).toMatch(/condition/);
    }
    expect(connection.makeAdtRequest).not.toHaveBeenCalled();
  });

  it('a condition smuggled through syncBreakpoints is refused before the wire', async () => {
    const { debugger_, connection } = setup();
    const smuggled = {
      kind: 'exception',
      exceptionClass: 'CX_X',
      condition: 'a = 1',
    } as unknown as IDebuggerBreakpoint;
    const answer = await debugger_.syncBreakpoints(identity, {
      scope: 'full',
      breakpoints: [smuggled],
    });
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.getError().message).toMatch(/condition/);
    }
    expect(connection.makeAdtRequest).not.toHaveBeenCalled();
  });

  it('syncBreakpoints full replaces the set; an empty set clears it', async () => {
    const { debugger_, sent } = setup();
    await debugger_.syncBreakpoints(identity, {
      scope: 'full',
      breakpoints: [],
    });
    expect(sent().url).toBe('/sap/bc/adt/debugger/breakpoints');
    expect(sent().method).toBe('POST');
    expect(sent().data).toContain('<syncScope mode="full"/>');
    expect(sent().data).not.toContain('<breakpoint ');
  });

  it('syncBreakpoints partial names each object', async () => {
    const { debugger_, sent } = setup();
    await debugger_.syncBreakpoints(identity, {
      scope: 'partial',
      objects: ['/sap/bc/adt/oo/classes/zcl_a', '/sap/bc/adt/oo/classes/zcl_b'],
      breakpoints: [
        {
          kind: 'line',
          uri: '/sap/bc/adt/oo/classes/zcl_a/source/main#start=3',
        },
      ],
    });
    expect(sent().data).toContain(
      '<syncScope mode="partial"><adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_a"/><adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_b"/></syncScope>',
    );
  });

  it('setBreakpoints posts the user-mode set, adding without syncScope', async () => {
    const { debugger_, sent } = setup();
    await debugger_.setBreakpoints(identity, [
      {
        kind: 'line',
        uri: '/sap/bc/adt/oo/classes/zcl_probe/source/main#start=16',
      },
      { kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' },
      { kind: 'statement', statement: 'RAISE' },
      { kind: 'message', msgId: '00', msgNo: '001', msgTy: 'E' },
    ]);

    const request = sent();
    expect(request.url).toBe('/sap/bc/adt/debugger/breakpoints');
    expect(request.method).toBe('POST');
    expect(request.data).toContain(
      'debuggingMode="user" scope="external" requestUser="SAPUSER01" terminalId="EC80D3662BADB8CD21C70406E0E96D4C" ideId="7194D729E68FDAF6E185C7E5124CC900"',
    );
    expect(request.data).toContain(
      '<breakpoint kind="line" adtcore:uri="/sap/bc/adt/oo/classes/zcl_probe/source/main#start=16"/>',
    );
    expect(request.data).toContain(
      '<breakpoint kind="exception" exceptionClass="CX_SY_ZERODIVIDE"/>',
    );
    expect(request.data).toContain(
      '<breakpoint kind="statement" statement="RAISE"/>',
    );
    expect(request.data).toContain(
      '<breakpoint kind="message" msgId="00" msgNo="001" msgTy="E"/>',
    );
    expect(request.data).not.toContain('syncScope');
    expect(request.data).not.toContain('validationOnly');
  });

  it('setBreakpoints with validationOnly marks every breakpoint', async () => {
    const { debugger_, sent } = setup();
    await debugger_.setBreakpoints(
      identity,
      [{ kind: 'exception', exceptionClass: 'CX_SY_ZERODIVIDE' }],
      { validationOnly: true },
    );
    expect(sent().data).toContain(
      'exceptionClass="CX_SY_ZERODIVIDE" validationOnly="true"/>',
    );
  });

  it('deleteBreakpoint encodes the id and carries the external scope', async () => {
    const { debugger_, sent } = setup();
    await debugger_.deleteBreakpoint(identity, 'KIND=5.EXCEPTION_CLASS=CX_X');
    expect(sent()).toMatchObject({
      method: 'DELETE',
      url: `/sap/bc/adt/debugger/breakpoints/KIND%3D5.EXCEPTION_CLASS%3DCX_X?scope=external&${identityQuery}`,
    });
  });

  it('listen posts the long poll and waits a minute longer than the server holds', async () => {
    const { debugger_, sent } = setup(undefined, { onConflict: 'takeOver' });
    await debugger_.listen(identity, { holdSeconds: 30 });
    expect(sent()).toMatchObject({
      method: 'POST',
      url: `/sap/bc/adt/debugger/listeners?${identityQuery}&timeout=30`,
      timeout: 90_000,
    });
  });

  it('by default listen refuses to displace another listener, as Eclipse does', async () => {
    const { debugger_, sent } = setup();
    await debugger_.listen(identity, { holdSeconds: 30 });
    expect(sent().url).toBe(
      `/sap/bc/adt/debugger/listeners?${identityQuery}&timeout=30&checkConflict=true&isNotifiedOnConflict=true`,
    );
  });

  it('constructed with takeOver, listen sends no conflict parameters', async () => {
    const { debugger_, sent } = setup(undefined, { onConflict: 'takeOver' });
    await debugger_.listen(identity);
    expect(sent().url).not.toContain('checkConflict');
    expect(sent().url).not.toContain('isNotifiedOnConflict');
  });

  it('stopListener deletes the listener', async () => {
    const { debugger_, sent } = setup();
    await debugger_.stopListener(identity);
    expect(sent()).toMatchObject({
      method: 'DELETE',
      url: `/sap/bc/adt/debugger/listeners?${identityQuery}`,
    });
  });

  it('attach goes through the dispatcher with the debuggee id', async () => {
    const { debugger_, sent } = setup();
    await debugger_.attach(identity, '0CC47A1E68C11FE1B0F9C08CD46015CB');
    expect(sent()).toMatchObject({
      method: 'POST',
      url: '/sap/bc/adt/debugger?method=attach&debuggeeId=0CC47A1E68C11FE1B0F9C08CD46015CB&debuggingMode=user&requestUser=SAPUSER01&dynproDebugging=true',
    });
  });

  const terminal: IDebuggerIdentity = {
    debuggingMode: 'terminal',
    terminalId: 'EC80D3662BADB8CD21C70406E0E96D4C',
    ideId: '7194D729E68FDAF6E185C7E5124CC900',
  };

  it('a terminal identity keys the listener on its ids and sends no requestUser', async () => {
    const { debugger_, sent } = setup();
    await debugger_.listen(terminal);
    expect(sent().url).toContain(
      'debuggingMode=terminal&terminalId=EC80D3662BADB8CD21C70406E0E96D4C&ideId=7194D729E68FDAF6E185C7E5124CC900',
    );
    expect(sent().url).not.toContain('requestUser');
  });

  it('a terminal identity arms breakpoints without requestUser', async () => {
    const { debugger_, sent } = setup();
    await debugger_.setBreakpoints(terminal, [
      {
        kind: 'line',
        uri: '/sap/bc/adt/oo/classes/zcl_probe/source/main#start=16',
      },
    ]);
    expect(sent().data).toContain(
      'debuggingMode="terminal" scope="external" terminalId="EC80D3662BADB8CD21C70406E0E96D4C" ideId="7194D729E68FDAF6E185C7E5124CC900"',
    );
    expect(sent().data).not.toContain('requestUser');
  });

  it('deleting a terminal-mode breakpoint sends requestUser empty, as the server requires it', async () => {
    const { debugger_, sent } = setup();
    await debugger_.deleteBreakpoint(terminal, 'KIND=0.SOURCETYPE=ABAP');
    expect(sent().url).toBe(
      '/sap/bc/adt/debugger/breakpoints/KIND%3D0.SOURCETYPE%3DABAP?scope=external&debuggingMode=terminal&requestUser=&terminalId=EC80D3662BADB8CD21C70406E0E96D4C&ideId=7194D729E68FDAF6E185C7E5124CC900',
    );
  });

  it('attach sends the mode, and requestUser only in user mode', async () => {
    const user = setup();
    await user.debugger_.attach(identity, 'DBG1');
    expect(user.sent().url).toBe(
      '/sap/bc/adt/debugger?method=attach&debuggeeId=DBG1&debuggingMode=user&requestUser=SAPUSER01&dynproDebugging=true',
    );
    const term = setup();
    await term.debugger_.attach(terminal, 'DBG1');
    expect(term.sent().url).toBe(
      '/sap/bc/adt/debugger?method=attach&debuggeeId=DBG1&debuggingMode=terminal&dynproDebugging=true',
    );
  });

  it('attach routed to a server sends the saplb header, and none otherwise', async () => {
    const routed = setup();
    await routed.debugger_.attach(
      identity,
      '0CC47A1E68C11FE1B0F9C08CD46015CB',
      {
        server: 'appserver-a1b2c',
      },
    );
    expect(routed.sent().headers?.saplb).toBe('appserver-a1b2c');

    const plain = setup();
    await plain.debugger_.attach(identity, '0CC47A1E68C11FE1B0F9C08CD46015CB');
    expect(plain.sent().headers?.saplb).toBeUndefined();
  });

  it('getStack reads the stack with semantic URIs', async () => {
    const { debugger_, sent } = setup();
    await debugger_.getStack();
    expect(sent()).toMatchObject({
      method: 'GET',
      url: '/sap/bc/adt/debugger/stack?emode=_&semanticURIs=true',
    });
  });

  it('getChildVariables sends the hierarchy rows in the ChildVariables type', async () => {
    const { debugger_, sent } = setup();
    await debugger_.getChildVariables(['@ROOT']);
    const request = sent();
    expect(request.url).toBe('/sap/bc/adt/debugger?method=getChildVariables');
    expect(request.headers?.['Content-Type']).toContain(
      'dataname=com.sap.adt.debugger.ChildVariables',
    );
    expect(request.data).toContain(
      '<STPDA_ADT_VARIABLE_HIERARCHY><PARENT_ID>@ROOT</PARENT_ID></STPDA_ADT_VARIABLE_HIERARCHY>',
    );
  });

  it('getVariables sends one row per id in the Variables type', async () => {
    const { debugger_, sent } = setup();
    await debugger_.getVariables(['LT_ITEMS[3]-MATNR']);
    const request = sent();
    expect(request.url).toBe('/sap/bc/adt/debugger?method=getVariables');
    expect(request.headers?.['Content-Type']).toContain(
      'dataname=com.sap.adt.debugger.Variables',
    );
    expect(request.data).toContain(
      '<STPDA_ADT_VARIABLE><ID>LT_ITEMS[3]-MATNR</ID></STPDA_ADT_VARIABLE>',
    );
  });

  it('step posts the step method alone', async () => {
    const { debugger_, sent } = setup();
    await debugger_.step('stepOver');
    expect(sent()).toMatchObject({
      method: 'POST',
      url: '/sap/bc/adt/debugger?method=stepOver',
    });
  });

  it('stepToLine posts the method with the line it names', async () => {
    for (const method of ['stepRunToLine', 'stepJumpToLine'] as const) {
      const { debugger_, sent } = setup();
      await debugger_.stepToLine(
        method,
        '/sap/bc/adt/oo/classes/zcl_probe/source/main#start=18',
      );
      expect(sent()).toMatchObject({
        method: 'POST',
        url: `/sap/bc/adt/debugger?method=${method}&uri=%2Fsap%2Fbc%2Fadt%2Foo%2Fclasses%2Fzcl_probe%2Fsource%2Fmain%23start%3D18`,
      });
    }
  });

  it('setStackPosition, setVariableValue and terminateDebuggee use the dispatcher', async () => {
    const position = setup();
    await position.debugger_.setStackPosition(2);
    expect(position.sent().url).toBe(
      '/sap/bc/adt/debugger?method=setStackPosition&position=2',
    );

    const value = setup();
    await value.debugger_.setVariableValue('LV_TOTAL', '7');
    expect(value.sent()).toMatchObject({
      url: '/sap/bc/adt/debugger?method=setVariableValue&variableName=LV_TOTAL',
      data: '7',
    });

    const terminate = setup();
    await terminate.debugger_.terminateDebuggee();
    expect(terminate.sent().url).toBe(
      '/sap/bc/adt/debugger?method=terminateDebuggee',
    );
  });

  it('detachDebugger posts the method, with the debuggee id only when given, encoded once', async () => {
    const bare = setup();
    await bare.debugger_.detachDebugger();
    expect(bare.sent().url).toBe('/sap/bc/adt/debugger?method=detachDebugger');
    const byId = setup();
    await byId.debugger_.detachDebugger({ debuggeeId: 'A&B=C/D' });
    expect(byId.sent().url).toBe(
      '/sap/bc/adt/debugger?method=detachDebugger&debuggeeId=A%26B%3DC%2FD',
    );
  });

  it('terminateDebugger posts the method alone', async () => {
    const { debugger_, sent } = setup();
    await debugger_.terminateDebugger();
    expect(sent()).toMatchObject({
      url: '/sap/bc/adt/debugger?method=terminateDebugger',
      method: 'POST',
    });
  });

  it('watchpoints: create, list and delete', async () => {
    const create = setup();
    await create.debugger_.createWatchpoint('LV_TOTAL', {
      condition: 'LV_TOTAL > 3',
    });
    expect(create.sent()).toMatchObject({
      method: 'POST',
      url: '/sap/bc/adt/debugger/watchpoints?variableName=LV_TOTAL&condition=LV_TOTAL+%3E+3',
    });

    const list = setup();
    await list.debugger_.listWatchpoints();
    expect(list.sent()).toMatchObject({
      method: 'GET',
      url: '/sap/bc/adt/debugger/watchpoints',
    });

    const remove = setup();
    await remove.debugger_.deleteWatchpoint('3');
    expect(remove.sent()).toMatchObject({
      method: 'DELETE',
      url: '/sap/bc/adt/debugger/watchpoints/3',
    });
  });

  it('getMemorySizes asks for the memory sizes in their own type', async () => {
    const { debugger_, sent } = setup();
    await debugger_.getMemorySizes();
    expect(sent()).toMatchObject({
      url: '/sap/bc/adt/debugger/memorysizes?includeAbap=true',
      method: 'GET',
      headers: {
        Accept: 'application/vnd.sap.adt.debugger.memory.sizes.v1+xml',
      },
    });
  });

  it('createMemorySnapshot posts the memorySnapshot action', async () => {
    const { debugger_, sent } = setup({
      status: 200,
      headers: {},
      data: '<snapshot/>',
    });
    const answer = await debugger_.createMemorySnapshot();
    expect(sent()).toMatchObject({
      url: '/sap/bc/adt/debugger/actions?action=memorySnapshot',
      method: 'POST',
    });
    expect(answer.ok && answer.getResult().value).toBe('<snapshot/>');
  });

  it('settings left out are sent empty, so the server keeps them; the conditional ones are left out', async () => {
    const { debugger_, sent } = setup();
    await debugger_.setDebuggerSettings({});
    expect(sent().url).toBe('/sap/bc/adt/debugger?method=setDebuggerSettings');
    expect(sent().headers).toMatchObject({
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
    });
    expect(sent().data).toContain(
      '<dbg:settings xmlns:dbg="http://www.sap.com/adt/debugger" systemDebugging="" createExceptionObject="" backgroundRFC="" sharedObjectDebugging=""/>',
    );
  });

  it('true and false are sent as given, the conditional ones only when set', async () => {
    const { debugger_, sent } = setup();
    await debugger_.setDebuggerSettings({
      systemDebugging: true,
      createExceptionObject: false,
      updateDebugging: true,
      showDataAging: false,
    });
    expect(sent().data).toContain(
      'systemDebugging="true" createExceptionObject="false" backgroundRFC="" sharedObjectDebugging="" updateDebugging="true" showDataAging="false"',
    );
  });

  it('the settings answer goes through its own strategy', async () => {
    const { debugger_ } = setup({
      status: 200,
      data: '<dbg:settings systemDebugging="true"/>',
      headers: {},
    });
    const answer = await debugger_.setDebuggerSettings({
      systemDebugging: true,
    });
    expect(answer.ok && answer.getResult().value).toBe(
      '<dbg:settings systemDebugging="true"/>',
    );
  });

  it('answers the document by default and nothing for a delete', async () => {
    const stack = setup({ status: 200, data: '<dbg:stack/>', headers: {} });
    const answer = await stack.debugger_.getStack();
    expect(answer.ok && answer.getResult().value).toBe('<dbg:stack/>');

    const deleted = setup();
    const done = await deleted.debugger_.stopListener(identity);
    expect(done.ok).toBe(true);
  });

  it('a debuggee that ended comes back as a failure carrying the answer', async () => {
    const ended = {
      status: 500,
      headers: {},
      data: '<exc:exception><type id="AdiFailed"/><properties><entry key="com.sap.adt.communicationFramework.subType">debuggeeEnded</entry></properties></exc:exception>',
    };
    const connection = {
      makeAdtRequest: jest.fn().mockRejectedValue(
        Object.assign(new Error('Request failed with status code 500'), {
          response: ended,
        }),
      ),
    } as unknown as IAbapConnection;
    const debugger_ = new AbapDebugger(connection, {} as never);

    const answer = await debugger_.step('stepContinue');
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(String(answer.getError().response?.data)).toContain(
        'debuggeeEnded',
      );
    }
  });

  it('the same end, read by analyseDebuggeeEnd, is the step having worked', async () => {
    const connection = {
      makeAdtRequest: jest.fn().mockRejectedValue(
        Object.assign(new Error('Request failed with status code 500'), {
          response: {
            status: 500,
            headers: {},
            data: '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="AdiFailed"/><properties><entry key="com.sap.adt.communicationFramework.subType">debuggeeEnded</entry></properties></exc:exception>',
          },
        }),
      ),
    } as unknown as IAbapConnection;
    const debugger_ = new AbapDebugger(connection, {} as never);

    const answer = await debugger_.step('stepContinue', {
      analyse: analyseDebuggeeEnd,
    });
    expect(answer.ok).toBe(true);
    if (answer.ok) {
      expect(String(answer.getResult().value)).toContain('debuggeeEnded');
    }
  });

  it('a batch is multipart: the parts kept as given, the boundary in the content type', async () => {
    const payload = buildDebuggerBatchPayload(
      [
        'GET /sap/bc/adt/discovery HTTP/1.1\r\nAccept:application/atomsvc+xml\r\n\r\n',
        '',
      ],
      'b1',
    );
    expect(payload.body).toBe(
      '--b1\r\nContent-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\nGET /sap/bc/adt/discovery HTTP/1.1\r\nAccept:application/atomsvc+xml\r\n\r\n' +
        '--b1\r\nContent-Type: application/http\r\ncontent-transfer-encoding: binary\r\n\r\n' +
        '\r\n--b1--\r\n',
    );
    const connection = {
      makeAdtRequest: jest
        .fn()
        .mockResolvedValue({ status: 200, data: '', headers: {} }),
    } as unknown as IAbapConnection;
    await executeBatchRequest(connection, payload);
    expect(
      (connection.makeAdtRequest as jest.Mock).mock.calls[0][0],
    ).toMatchObject({
      url: '/sap/bc/adt/debugger/batch',
      method: 'POST',
      data: payload.body,
      headers: {
        'Content-Type': 'multipart/mixed; boundary=b1',
        Accept: 'multipart/mixed',
      },
    });
  });

  describe('checkListener and readListenerConflict', () => {
    const conflictBody = fs.readFileSync(
      path.join(__dirname, '../../fixtures/debugger/listener-conflict-409.xml'),
      'utf8',
    );
    const errorWith = (status: number | undefined, data: unknown) =>
      ({
        origin: 'server',
        message: 'x',
        ...(status === undefined
          ? {}
          : { response: { status, data, headers: {} } }),
      }) as unknown as IAdtError;

    it('checkListener asks without starting a listener', async () => {
      const { debugger_, sent } = setup();
      await debugger_.checkListener(identity);
      expect(sent().method).toBe('GET');
      expect(sent().url).toBe(
        `/sap/bc/adt/debugger/listeners?${identityQuery}&checkConflict=true`,
      );
    });

    it('readListenerConflict reads who holds the listener from a 409', () => {
      expect(readListenerConflict(errorWith(409, conflictBody))).toEqual({
        conflictText:
          'Another session (user SAPUSER02) exists with global debugging scope for user SAPUSER02',
        ideUser: 'SAPUSER02',
      });
    });

    it.each([
      ['no response', errorWith(undefined, undefined)],
      ['an empty body', errorWith(409, '')],
      ['a malformed body', errorWith(409, '<exc:exception><properties>')],
      ['a 403', errorWith(403, conflictBody)],
      [
        'a 409 without conflictText',
        errorWith(
          409,
          conflictBody.replace(/<entry key="conflictText">[^<]*<\/entry>/, ''),
        ),
      ],
    ])('readListenerConflict answers undefined for %s', (_label, error) => {
      expect(readListenerConflict(error)).toBeUndefined();
    });
  });
});
