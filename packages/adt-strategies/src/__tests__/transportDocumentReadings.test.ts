import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  parseCreatedTransport,
  parseObjectEntries,
  parseTransportTree,
  transportCreated,
  transportObjectEntries,
  transportTree,
} from '../results/transport';
import { stepTagged } from './corpus';
import {
  BARE_ROOT,
  EMPTY_TASK,
  NOT_TRANSPORT,
  REQUEST,
  TASK,
  TASK_CREATED,
  TASK_UNDER_PARENT,
  TASK_WITH_OBJECTS,
  TRANSPORT_CREATED,
} from './serverDocuments';

/**
 * The readings the server team found reading something other than what the
 * document holds (adt-strategies 0.28.0), each pinned on the document it was
 * found with: a recording of adt-clients' corpus (`stepTagged`), or a
 * document of the server's tests (`serverDocuments.ts`, which names the file
 * each came from).
 */
const wire = (data: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data,
});

// ---------------------------------------------------------------------------
// transportObjectEntries
// ---------------------------------------------------------------------------

describe('transportObjectEntries reads entries per task, each once', () => {
  it("a request's entries are its tasks', each with its task number; tm:all_objects is not read beside them", () => {
    const entries = transportObjectEntries(wire(REQUEST));
    expect(entries).toEqual([
      {
        task: TASK,
        pgmid: 'R3TR',
        type: 'CLAS',
        name: 'ZCL_ONE',
        position: '000001',
        description: undefined,
        lockStatus: undefined,
        imageActivity: undefined,
        info: undefined,
      },
    ]);
  });

  it("a task document yields that task's entries, with lock status and info", () => {
    const entries = parseObjectEntries(TASK_WITH_OBJECTS);
    expect(
      entries.map((e) => [
        e.task,
        e.pgmid,
        e.type,
        e.name,
        e.position,
        e.lockStatus,
        e.info,
      ]),
    ).toEqual([
      [TASK, 'R3TR', 'CLAS', 'ZCL_ONE', '000001', 'X', 'Class'],
      [
        TASK,
        'LIMU',
        'METH',
        'ZCL_ONE                       RUN',
        '000002',
        // An empty attribute reads as absent, as it did before.
        undefined,
        'Method',
      ],
    ]);
  });

  // The `removeobject` echo as adt-clients' objectActions.test.ts holds it
  // ("the one document of this media type that was captured whole"): its
  // entry sits directly under tm:request, on no task.
  it("an echo's entry under tm:request is read, on no task", () => {
    const echo =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:useraction="removeobject" tm:number="DEVK905942">' +
      '<tm:request tm:parent="" tm:desc="" tm:target="" tm:target_desc="">' +
      '<tm:long_desc/>' +
      '<tm:abap_object tm:pgmid="R3TR" tm:type="FUGR" tm:name="ZMCP_BLD_FGR_H1" ' +
      'tm:obj_desc="Function Group" tm:position="000025" tm:lock_status="" tm:img_activity=""/>' +
      '</tm:request></tm:root>';
    const entries = parseObjectEntries(echo);
    expect(entries.map((e) => [e.task, e.name, e.position])).toEqual([
      [undefined, 'ZMCP_BLD_FGR_H1', '000025'],
    ]);
  });

  it('a task holding nothing yields nothing', () => {
    expect(parseObjectEntries(EMPTY_TASK)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// transportCreated
// ---------------------------------------------------------------------------

describe('transportCreated: the created item is the root’s own number', () => {
  it('a created task under a parent named beside it: the task, and the parent separately', () => {
    const created = transportCreated(wire(TASK_UNDER_PARENT));
    expect(created.transportNumber).toBe('SIDK907073');
    expect(created.parent).toBe('SIDK907071');
  });

  it('a created task with its number on the root alone', () => {
    const created = parseCreatedTransport(TASK_CREATED);
    expect(created.transportNumber).toBe('SIDK907073');
    expect(created.uri).toBe('/sap/bc/adt/cts/transportrequests/SIDK907073');
    expect(created.parent).toBeUndefined();
  });

  it('a created request, whose root names no number, is its tm:request', () => {
    const created = parseCreatedTransport(TRANSPORT_CREATED);
    expect(created).toMatchObject({
      transportNumber: 'SIDK900011',
      description: 'x',
      type: 'K',
      targetSystem: 'LOCAL',
      ctsProject: '',
      owner: 'SAPUSER01',
    });
  });

  it('refuses a document that names no number, in fixed words', () => {
    expect(() => parseCreatedTransport(BARE_ROOT)).toThrow(
      'parseCreatedTransport: the answer names no created transport request or task',
    );
  });
});

// ---------------------------------------------------------------------------
// transportTree
// ---------------------------------------------------------------------------

describe('transportTree refuses in fixed words', () => {
  it('puts nothing of the body into its error', () => {
    let thrown: unknown;
    try {
      transportTree(wire(NOT_TRANSPORT));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).not.toContain('BODY_MARKER');
    expect(String(thrown)).not.toContain('html');
    expect(String(thrown)).toContain(
      'parseTransportTree: the answer is no transport list',
    );
  });

  it.each([
    ['a bare root', BARE_ROOT],
    ['an empty root element', '<tm:root/>'],
  ])('refuses %s, which carries no list', (_what, data) => {
    expect(() => parseTransportTree(data)).toThrow(
      'parseTransportTree: the answer is no transport list',
    );
  });

  // The empty list SAP_BASIS 7.40 SP04 answered `GET /sap/bc/cts/transportrequests`
  // (a probe over RFC, 2026-10-23, 319 bytes; the user replaced): a root, too,
  // that names whose list it is.
  it('reads the 7.40 empty list as no requests', () => {
    const tree = parseTransportTree(
      '<?xml version="1.0" encoding="utf-8"?><tm:root adtcore:name="SAPUSER01" adtcore:type="" adtcore:changedAt="2026-10-23T15:31:49Z" adtcore:createdAt="2026-10-23T15:31:49Z" adtcore:changedBy="SAPUSER01" adtcore:createdBy="SAPUSER01" xmlns:tm="http://www.sap.com/cts/adt/tm" xmlns:adtcore="http://www.sap.com/adt/core"/>',
    );
    expect(tree.requests).toEqual([]);
    expect(tree.attributes['adtcore:name']).toBe('SAPUSER01');
  });

  it('reads the recorded empty list — its root carries the search it ran — as no requests', () => {
    const tree = transportTree(
      stepTagged('read-transport-list-structure', 'cts-transportrequests'),
    );
    expect(tree.requests).toEqual([]);
    expect(tree.attributes['adtcore:name']).toBe('SAPUSER01');
  });
});
