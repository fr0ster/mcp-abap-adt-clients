/**
 * The three user actions on a request's object list, and its action log.
 *
 * Every document below is a capture, from Eclipse ADT 3.60.0 against an
 * on-premise system on 2026-09-21 — the session that found the gap. What is
 * asserted is what a server was actually sent and actually answered, not a
 * shape this repository finds tidy.
 *
 * The gap: deleting an object leaves its CTS object-directory entry on the
 * request that carried it, and until that entry is detached the same name
 * cannot be created again (`CTS_WBO_API 019`), even passing the same request
 * as `corrNr`. The ways out were releasing the whole request — shipping
 * everything else in it — or SE09 by hand.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../../clients/AdtClient';
import { AdtRequest } from '../../../../core/transport/AdtRequest';

const REMOVED =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:useraction="removeobject" tm:number="E19K905942">' +
  '<tm:request tm:parent="" tm:desc="" tm:target="" tm:target_desc="">' +
  '<tm:long_desc/>' +
  '<tm:abap_object tm:pgmid="R3TR" tm:type="FUGR" tm:name="ZMCP_BLD_FGR_H1" ' +
  'tm:obj_desc="Function Group" tm:position="000025" tm:lock_status="" tm:img_activity=""/>' +
  '</tm:request></tm:root>';

/** `addobject` refused: the object is held by a task with no link to this one. */
const LOCKED_ELSEWHERE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt.tm"/><type id="ADT_TM_COMMON_EXCEPTION"/>' +
  '<message lang="EN">Z_CL_000001 is locked in request/task E19K906817</message>' +
  '<properties><entry key="T100KEY-ID">SCTS_ADT_MSG</entry>' +
  '<entry key="T100KEY-NO">009</entry></properties></exc:exception>';

const NEW_TASK =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:targetuser="OKYSLYTSIA" ' +
  'tm:useraction="tasks" tm:number="E19K907073" ' +
  'tm:uri="/sap/bc/adt/cts/transportrequests/E19K907073"/>';

const ACTION_LOG =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<log:log xmlns:log="http://www.sap.com/adt/logs">' +
  '<log:entry log:text="OKYSLYTSIA deleted following object R3TR FUGR ZMCP_BLD_FGR_H1"/>' +
  '</log:log>';

const connectionOver = (
  answer: (options: IAbapRequestOptions) => IAdtWireResponse,
) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return answer(options);
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

const answering = (body: string, status = 200) =>
  ({
    data: body,
    status,
    statusText: status === 201 ? 'Created' : 'OK',
    headers:
      status === 201
        ? { location: '/sap/bc/adt/cts/transportrequests/E19K907073' }
        : {},
  }) as unknown as IAdtWireResponse;

describe('removeObject', () => {
  it('sends the useraction document the server was sent', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    const answer = await new AdtRequest(connection).removeObject('E19K905942', {
      name: 'ZMCP_BLD_FGR_H1',
      type: 'FUGR',
      description: 'Function Group',
      position: '000025',
    });

    expect(answer.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    // The task, not the request above it: objects live on tasks.
    expect(calls[0].url).toBe('/sap/bc/adt/cts/transportrequests/E19K905942');

    const body = String(calls[0].data);
    expect(body).toContain('tm:useraction="removeobject"');
    expect(body).toContain('tm:number="E19K905942"');
    expect(body).toContain('tm:pgmid="R3TR"');
    expect(body).toContain('tm:type="FUGR"');
    expect(body).toContain('tm:name="ZMCP_BLD_FGR_H1"');
    expect(body).toContain('tm:obj_desc="Function Group"');
    expect(body).toContain('tm:position="000025"');
  });

  /**
   * `text/plain` for an XML body looks like a mistake and is what Eclipse
   * sends. Pinned so nobody "corrects" it from reading the body alone.
   */
  it('sends the headers the capture carried, odd as they look', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    await new AdtRequest(connection).removeObject('E19K905942', {
      name: 'ZCL_X',
      type: 'CLAS',
    });

    expect(calls[0].headers?.['Content-Type']).toBe('text/plain');
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.transportorganizer.v1+xml',
    );
  });

  it('writes no obj_desc or position when it was given none', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    await new AdtRequest(connection).removeObject('E19K905942', {
      name: 'ZCL_X',
      type: 'CLAS',
    });

    const body = String(calls[0].data);
    expect(body).not.toContain('tm:obj_desc');
    expect(body).not.toContain('tm:position');
    // pgmid is the one default, because a workbench object is R3TR.
    expect(body).toContain('tm:pgmid="R3TR"');
  });

  it('escapes what would otherwise break the document', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    await new AdtRequest(connection).removeObject('E19K905942', {
      name: 'ZCL_X',
      type: 'CLAS',
      description: 'Fix "quoted" & <angled>',
    });

    const body = String(calls[0].data);
    expect(body).toContain(
      'tm:obj_desc="Fix &quot;quoted&quot; &amp; &lt;angled&gt;"',
    );
  });
});

describe('addObject', () => {
  it('sends the same shape with the other useraction', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    await new AdtRequest(connection).addObject('E19K907073', {
      name: 'Z_CL_000001',
      type: 'CLAS',
    });

    const body = String(calls[0].data);
    expect(body).toContain('tm:useraction="addobject"');
    expect(body).toContain('tm:name="Z_CL_000001"');
  });

  /**
   * A third lock flavour — not the enqueue lock, not request-versus-task —
   * and the server's verdict to read rather than a state this client guesses
   * at beforehand.
   */
  it("hands back the server's refusal when the object is held elsewhere", async () => {
    const { connection } = connectionOver(() => {
      const error = new Error(
        'Request failed with status code 403',
      ) as Error & {
        response: IAdtWireResponse;
      };
      error.response = answering(LOCKED_ELSEWHERE, 403);
      throw error;
    });

    const answer = await new AdtRequest(connection).addObject('E19K907073', {
      name: 'Z_CL_000001',
      type: 'CLAS',
    });

    expect(answer.ok).toBe(false);
  });
});

describe('createTask', () => {
  it('posts to the tasks collection and names the target user', async () => {
    const { connection, calls } = connectionOver(() =>
      answering(NEW_TASK, 201),
    );

    const answer = await new AdtRequest(connection).createTask('E19K905941', {
      targetUser: 'OKYSLYTSIA',
    });

    expect(answer.ok).toBe(true);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests/E19K905941/tasks',
    );
    const body = String(calls[0].data);
    expect(body).toContain('tm:useraction="newtask"');
    expect(body).toContain('tm:targetuser="OKYSLYTSIA"');
  });

  /**
   * **The number, not just the 200.** This asserted `answer.ok` alone, and a
   * task whose number is `''` passes that: `parseCreatedTransport` read
   * `tm:number` off `tm:request`, and a `newtask` answer has no `tm:request`
   * — it carries the attributes on the root. So every task ever created came
   * back with an empty number, reported as a success. Found in review.
   */
  it('answers the new number, which is the point of calling it', async () => {
    const { connection } = connectionOver(() => answering(NEW_TASK, 201));

    const answer = await new AdtRequest(connection).createTask('E19K905941');

    if (!answer.ok) throw new Error('expected the task');
    const created = answer.getResult().value as {
      transportNumber: string;
      uri?: string;
    };
    expect(created.transportNumber).toBe('E19K907073');
    expect(created.uri).toBe('/sap/bc/adt/cts/transportrequests/E19K907073');
  });

  it('leaves the target user out when not given, so the server decides', async () => {
    const { connection, calls } = connectionOver(() =>
      answering(NEW_TASK, 201),
    );

    await new AdtRequest(connection).createTask('E19K905941');

    expect(String(calls[0].data)).not.toContain('tm:targetuser');
  });
});

describe('readActionLog', () => {
  it('reads the log with the media type that answers it', async () => {
    const { connection, calls } = connectionOver(() => answering(ACTION_LOG));

    const answer = await new AdtRequest(connection).readActionLog('E19K905942');

    if (!answer.ok) throw new Error('expected the log');
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests/E19K905942/actionlogs',
    );
    expect(calls[0].headers?.Accept).toBe('application/vnd.sap.adt.logs+xml');
    expect(String(answer.getResult().value)).toContain(
      'deleted following object R3TR FUGR ZMCP_BLD_FGR_H1',
    );
  });
});

/**
 * The same two checks the search-configurations test makes: the call works,
 * and this file compiles. Drop `IAdtTransportObjectActions` from
 * `IRequestContract` and `ts-jest` fails the suite before an assertion runs —
 * which is what a consumer's editor would have shown them.
 */
describe('the contract a consumer actually holds', () => {
  it('reaches all four through client.getRequest()', async () => {
    const { connection, calls } = connectionOver((options) =>
      answering(
        options.method === 'GET'
          ? ACTION_LOG
          : options.method === 'POST'
            ? NEW_TASK
            : REMOVED,
        options.method === 'POST' ? 201 : 200,
      ),
    );

    const request = new AdtClient(connection).getRequest();
    const object = { name: 'ZCL_X', type: 'CLAS' };

    expect((await request.removeObject('E19K905942', object)).ok).toBe(true);
    expect((await request.addObject('E19K905942', object)).ok).toBe(true);
    expect((await request.createTask('E19K905941')).ok).toBe(true);
    expect((await request.readActionLog('E19K905942')).ok).toBe(true);
    expect(calls).toHaveLength(4);
  });
});
