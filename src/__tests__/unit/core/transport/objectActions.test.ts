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

/**
 * The object list, as the organizer representation carries it.
 *
 * Modelled on the `removeobject` echo above, which is the one document of
 * this media type that was captured whole: the same `tm:abap_object`
 * attributes, on more than one entry and under a task. What the reading
 * depends on is that the elements are there and carry `tm:position` — both
 * measured — and not where in the tree they sit, which is why it walks.
 */
const OBJECT_LIST =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="E19K905942">' +
  '<tm:request tm:desc="a request" tm:target="">' +
  '<tm:task tm:number="E19K905943" tm:owner="OKYSLYTSIA">' +
  '<tm:abap_object tm:pgmid="R3TR" tm:type="FUGR" tm:name="ZMCP_BLD_FGR_H1" ' +
  'tm:obj_desc="Function Group" tm:position="000025" tm:lock_status="" tm:img_activity=""/>' +
  '<tm:abap_object tm:pgmid="R3TR" tm:type="CLAS" tm:name="ZCL_X" ' +
  'tm:position="000026" tm:lock_status="L" tm:img_activity=""/>' +
  '</tm:task></tm:request></tm:root>';

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
      position: '000001',
    });

    expect(calls[0].headers?.['Content-Type']).toBe('text/plain');
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.transportorganizer.v1+xml',
    );
  });

  /**
   * **`tm:position` is what makes the call do anything, so it always goes
   * out.** Measured on E19, 2026-09-21, against task `E19K901046`: 22 objects
   * asked for by `type` and `name` alone each answered `200` with the usual
   * echo document, and re-reading the task found all 22 still on it. The same
   * documents carrying `tm:position` — and nothing else added — removed every
   * one, 22 down to 0, each confirmed by a re-read.
   *
   * `obj_desc` stays optional, because it is decoration either way.
   */
  it('always writes the position, since without it the server no-ops', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    await new AdtRequest(connection).removeObject('E19K905942', {
      name: 'ZCL_X',
      type: 'CLAS',
      position: '000007',
    });

    const body = String(calls[0].data);
    expect(body).toContain('tm:position="000007"');
    expect(body).not.toContain('tm:obj_desc');
    // pgmid is the one default, because a workbench object is R3TR.
    expect(body).toContain('tm:pgmid="R3TR"');
  });

  it('escapes what would otherwise break the document', async () => {
    const { connection, calls } = connectionOver(() => answering(REMOVED));

    await new AdtRequest(connection).removeObject('E19K905942', {
      name: 'ZCL_X',
      type: 'CLAS',
      position: '000001',
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

    const answer = await new AdtRequest(connection).createTask('E19K905941', {
      targetUser: 'OKYSLYTSIA',
    });

    if (!answer.ok) throw new Error('expected the task');
    const created = answer.getResult().value as {
      transportNumber: string;
      uri?: string;
    };
    expect(created.transportNumber).toBe('E19K907073');
    expect(created.uri).toBe('/sap/bc/adt/cts/transportrequests/E19K907073');
  });

  /**
   * **The attribute always goes out, because the server will not fill it in.**
   * This test asserted the opposite — that omitting `tm:targetuser` left the
   * choice to the server — and an on-premise run (E19, 2026-09-21) measured
   * what that actually costs:
   *
   * ```
   * 400  SCTS_ADT_MSG 009
   * User  does not exist in the system (or locked)
   * ```
   *
   * Two spaces after `User`: the name resolved to empty. The same call
   * carrying the attribute answered 200 and a task number. Eclipse sends it on
   * every `newtask`, which is why no capture of Eclipse could show the gap.
   */
  it('always names the target user, since the server will not choose one', async () => {
    const { connection, calls } = connectionOver(() =>
      answering(NEW_TASK, 200),
    );

    await new AdtRequest(connection).createTask('E19K905941', {
      targetUser: 'OKYSLYTSIA',
    });

    expect(String(calls[0].data)).toContain('tm:targetuser="OKYSLYTSIA"');
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
describe('readObjects', () => {
  it('asks for the representation that carries the list', async () => {
    const { connection, calls } = connectionOver(() => answering(OBJECT_LIST));

    await new AdtRequest(connection).readObjects('E19K905942');

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe('/sap/bc/adt/cts/transportrequests/E19K905942');
    // **The whole reason this is not `readMetadata`.** That reader sends no
    // `Accept`, and what the server picks for a request naming none carries
    // no `tm:abap_object` at all — measured on an on-premise system,
    // 2026-09-21.
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.transportorganizer.v1+xml',
    );
  });

  it('answers the entries with the positions removeObject needs', async () => {
    const { connection } = connectionOver(() => answering(OBJECT_LIST));

    const answer = await new AdtRequest(connection).readObjects('E19K905942');

    if (!answer.ok) throw new Error('expected the list');
    const entries = answer.getResult().value;
    expect(entries).toEqual([
      {
        name: 'ZMCP_BLD_FGR_H1',
        type: 'FUGR',
        pgmid: 'R3TR',
        description: 'Function Group',
        position: '000025',
        lockStatus: undefined,
        imageActivity: undefined,
      },
      {
        name: 'ZCL_X',
        type: 'CLAS',
        pgmid: 'R3TR',
        description: undefined,
        position: '000026',
        lockStatus: 'L',
        imageActivity: undefined,
      },
    ]);
  });

  /**
   * A position is `000025`, and a parser that reads attribute values as
   * numbers hands back `25` — which the server is then sent back, naming
   * nothing. Pinned, because the default for the parser used here is on.
   */
  it('keeps the position a string, leading zeros and all', async () => {
    const { connection } = connectionOver(() => answering(OBJECT_LIST));

    const answer = await new AdtRequest(connection).readObjects('E19K905942');

    if (!answer.ok) throw new Error('expected the list');
    expect(answer.getResult().value[0].position).toBe('000025');
  });

  /**
   * **An entry the server described without a position is not removable, and
   * the reading must not pretend otherwise.**
   *
   * This filled a missing `tm:position` with `''`, under a type that declared
   * it required. That is the one answer this member must never give: `''`
   * satisfies `removeObject`'s `position: string`, so the call compiles,
   * reaches the server, and removes nothing while answering `200` — the
   * defect these members exist to end, re-created by the reading added to
   * prevent it. The entry is still reported, because the request does hold
   * the object; only the position it does not have is left undefined.
   */
  it('leaves a missing position undefined rather than blanking it', async () => {
    const { connection } = connectionOver(() =>
      answering(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="E19K905942">' +
          '<tm:request><tm:task tm:number="E19K905943">' +
          '<tm:abap_object tm:pgmid="R3TR" tm:type="CLAS" tm:name="ZCL_NO_POS"/>' +
          '</tm:task></tm:request></tm:root>',
      ),
    );

    const answer = await new AdtRequest(connection).readObjects('E19K905942');

    if (!answer.ok) throw new Error('expected the list');
    const [entry] = answer.getResult().value;
    expect(entry.name).toBe('ZCL_NO_POS');
    expect(entry.position).toBeUndefined();
    // The shape that used to come back, and must not again.
    expect(entry.position).not.toBe('');
  });

  /** An empty request is a request with nothing in it, not a failure. */
  it('answers an empty list when the request holds nothing', async () => {
    const { connection } = connectionOver(() =>
      answering(
        '<?xml version="1.0" encoding="UTF-8"?>' +
          '<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="E19K905942">' +
          '<tm:request tm:desc="empty"><tm:long_desc/></tm:request></tm:root>',
      ),
    );

    const answer = await new AdtRequest(connection).readObjects('E19K905942');

    if (!answer.ok) throw new Error('expected the list');
    expect(answer.getResult().value).toEqual([]);
  });

  /**
   * The reading walks for `tm:abap_object` rather than addressing a path,
   * because where the elements sit differs: a request holds its objects on
   * its tasks, a task holds them directly, and a user action echoes one under
   * `tm:request`. Only the elements were measured, so only they are relied on.
   */
  it('finds the entries wherever the document keeps them', async () => {
    const { connection } = connectionOver(() => answering(REMOVED));

    const answer = await new AdtRequest(connection).readObjects('E19K905942');

    if (!answer.ok) throw new Error('expected the list');
    const entries = answer.getResult().value;
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('ZMCP_BLD_FGR_H1');
    expect(entries[0].position).toBe('000025');
  });
});

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

    expect(
      (
        await request.removeObject('E19K905942', {
          ...object,
          position: '000001',
        })
      ).ok,
    ).toBe(true);
    expect((await request.addObject('E19K905942', object)).ok).toBe(true);
    expect(
      (await request.createTask('E19K905941', { targetUser: 'OKYSLYTSIA' })).ok,
    ).toBe(true);
    expect((await request.readActionLog('E19K905942')).ok).toBe(true);
    expect(calls).toHaveLength(4);
  });
});
