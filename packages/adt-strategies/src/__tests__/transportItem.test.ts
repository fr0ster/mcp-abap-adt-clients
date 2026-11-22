import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { readTransportItem, transportItem } from '../results/transport';
import {
  BARE_ROOT,
  EMPTY_TASK,
  NOT_TRANSPORT,
  PARENT,
  REQUEST,
  TASK,
  TASK_WITH_OBJECTS,
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
// transportItem — the request or task document
// ---------------------------------------------------------------------------

describe('transportItem reads a request or a task document', () => {
  it('a task document: its header, its parent’s header and its objects', () => {
    const item = readTransportItem(TASK_WITH_OBJECTS, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.header).toEqual({
      number: TASK,
      parent: PARENT,
      description: 'Integration tests',
      type: 'Development/Correction',
      status: 'D',
      statusText: 'Modifiable',
      owner: 'SAPUSER01',
      target: '',
      client: 'CLIENT1',
      ctsProject: '',
      lastChanged: '20261122090956',
    });
    expect(item.parent).toEqual({
      number: PARENT,
      parent: '',
      description: 'Integration tests',
      type: 'K',
      status: 'D',
      statusText: 'Modifiable',
      owner: 'SAPUSER01',
      target: '/SIDTOQAS/',
      client: 'CLIENT1',
      ctsProject: '',
      lastChanged: '20261122090950',
    });
    expect(item.objects.map((o) => [o.task, o.name, o.position])).toEqual([
      [TASK, 'ZCL_ONE', '000001'],
      [TASK, 'ZCL_ONE                       RUN', '000002'],
    ]);
  });

  it('the recorded cloud task holding nothing', () => {
    const item = transportItem(TASK)(wire(EMPTY_TASK));
    expect(item.kind).toBe('task');
    if (item.kind !== 'task') return;
    expect(item.header.number).toBe(TASK);
    expect(item.parent?.number).toBe(PARENT);
    expect(item.objects).toEqual([]);
  });

  it('a request document: its header and its tasks with their object counts', () => {
    const item = readTransportItem(REQUEST, PARENT);
    if (item.kind !== 'request') throw new Error('expected a request');
    expect(item.header).toMatchObject({
      number: PARENT,
      description: 'A request',
      type: 'K',
      target: '/SIDTOQAS/',
      client: 'CLIENT1',
    });
    expect(item.header.lastChanged).toBeUndefined();
    expect(
      item.tasks.map((t) => [t.header.number, t.header.owner, t.objectCount]),
    ).toEqual([[TASK, 'SAPUSER01', 1]]);
  });

  it('without tm:object_type, a tm:task naming the number makes it a task', () => {
    const unmarked = TASK_WITH_OBJECTS.replace('tm:object_type="T" ', '');
    expect(readTransportItem(unmarked, TASK).kind).toBe('task');
    const request = REQUEST.replace('tm:object_type="R" ', '');
    expect(readTransportItem(request, PARENT).kind).toBe('request');
  });

  // Since 0.28.1. SAP marks a task's document (`prepare_tm_root_for_task`,
  // on premise and on the cloud), so these documents are built from the
  // recordings by removing the marker: the case is defensive.
  it.each([
    ['the recorded on-premise task', TASK_WITH_OBJECTS],
    ['the recorded cloud task', EMPTY_TASK],
  ])(
    'without tm:object_type, %s asked by its parent’s number is not the parent',
    (_what, document) => {
      const unmarked = document.replace('tm:object_type="T" ', '');
      expect(() => readTransportItem(unmarked, PARENT)).toThrow(
        'readTransportItem: the answer is not the transport request or task asked for',
      );
      expect(readTransportItem(unmarked, TASK).kind).toBe('task');
    },
  );

  it.each([
    ['another number', () => readTransportItem(TASK_WITH_OBJECTS, PARENT)],
    [
      'a task and its request both naming the number, marked',
      () =>
        readTransportItem(
          TASK_WITH_OBJECTS.replace(
            `tm:number="${PARENT}"`,
            `tm:number="${TASK}"`,
          ),
          TASK,
        ),
    ],
    [
      'a task and its request both naming the number, unmarked',
      () =>
        readTransportItem(
          TASK_WITH_OBJECTS.replace('tm:object_type="T" ', '').replace(
            `tm:number="${PARENT}"`,
            `tm:number="${TASK}"`,
          ),
          TASK,
        ),
    ],
    [
      'a task document marked as a request',
      () =>
        readTransportItem(
          TASK_WITH_OBJECTS.replace('tm:object_type="T"', 'tm:object_type="R"'),
          TASK,
        ),
    ],
    [
      'a request document marked as a task',
      () =>
        readTransportItem(
          REQUEST.replace('tm:object_type="R"', 'tm:object_type="T"'),
          PARENT,
        ),
    ],
    ['a request asked as a task', () => readTransportItem(REQUEST, TASK)],
    [
      'a task element without a number',
      () =>
        readTransportItem(
          TASK_WITH_OBJECTS.replace(`tm:number="${TASK}" `, ''),
          TASK,
        ),
    ],
    ['a bare root', () => readTransportItem(BARE_ROOT, PARENT)],
    ['no transport document', () => readTransportItem(NOT_TRANSPORT, PARENT)],
    ['an empty body', () => readTransportItem('', PARENT)],
  ])('refuses %s, in fixed words', (_what, read) => {
    expect(read).toThrow(
      'readTransportItem: the answer is not the transport request or task asked for',
    );
  });
});

// ---------------------------------------------------------------------------
// By namespace, not prefix; numbers and markers trimmed after decoding
// (0.28.1, Codex's review). Variants of the recorded documents, each built
// in the test.
// ---------------------------------------------------------------------------

const TM = 'http://www.sap.com/cts/adt/tm';
const REFUSAL =
  'readTransportItem: the answer is not the transport request or task asked for';

/** The document with `element` added as the root's last child. */
const withRootChild = (document: string, element: string): string =>
  document.replace('</tm:root>', `${element}</tm:root>`);

/** The document with `xmlns="…tm"` on its root: bare names are in the tm namespace. */
const withDefaultTm = (document: string): string =>
  document.replace('<tm:root ', `<tm:root xmlns="${TM}" `);

describe('transportItem counts elements by namespace, whatever the prefix', () => {
  it.each([
    [
      'a bare task in the default tm namespace',
      () =>
        readTransportItem(
          withRootChild(
            withDefaultTm(TASK_WITH_OBJECTS),
            `<task tm:number="${TASK}"/>`,
          ),
          TASK,
        ),
    ],
    [
      'a task under a second prefix bound to tm',
      () =>
        readTransportItem(
          withRootChild(
            TASK_WITH_OBJECTS,
            `<t2:task xmlns:t2="${TM}" t2:number="${TASK}"/>`,
          ),
          TASK,
        ),
    ],
    [
      'a request under a second prefix bound to tm',
      () =>
        readTransportItem(
          withRootChild(
            REQUEST,
            `<t2:request xmlns:t2="${TM}" t2:number="${PARENT}"/>`,
          ),
          PARENT,
        ),
    ],
    [
      'a second request in the default tm namespace',
      () =>
        readTransportItem(
          withRootChild(
            withDefaultTm(REQUEST),
            `<request number="${PARENT}"/>`,
          ),
          PARENT,
        ),
    ],
  ])('refuses a duplicate across prefixes: %s', (_what, read) => {
    expect(read).toThrow(REFUSAL);
  });

  it('reads a task written under another prefix bound to tm', () => {
    const renamed = TASK_WITH_OBJECTS.replace(
      '<tm:root ',
      `<tm:root xmlns:t2="${TM}" `,
    )
      .replace('<tm:task tm:number=', '<t2:task t2:number=')
      .replace('</tm:task>', '</t2:task>');
    const item = readTransportItem(renamed, TASK);
    expect(item.kind).toBe('task');
    expect(item.header.number).toBe(TASK);
  });

  it('does not count an element of another namespace', () => {
    const item = readTransportItem(
      withRootChild(
        TASK_WITH_OBJECTS,
        `<x:task xmlns:x="urn:other" x:number="${TASK}"/>`,
      ),
      TASK,
    );
    expect(item.kind).toBe('task');
  });
});

describe('transportItem trims a number or marker after decoding it', () => {
  it('reads the number asked for trimmed', () => {
    expect(
      readTransportItem(TASK_WITH_OBJECTS, ` ${TASK} `).header.number,
    ).toBe(TASK);
  });

  it.each([
    ['literal', ` ${TASK} `, ' T '],
    ['entity-encoded', `&#32;${TASK}&#32;`, '&#32;T&#32;'],
  ])('reads %s padding as the value', (_what, number, marker) => {
    const padded = TASK_WITH_OBJECTS.replace(
      `<tm:task tm:number="${TASK}"`,
      `<tm:task tm:number="${number}"`,
    ).replace('tm:object_type="T"', `tm:object_type="${marker}"`);
    const item = readTransportItem(padded, TASK);
    expect(item.kind).toBe('task');
    expect(item.header.number).toBe(TASK);
  });

  it.each([
    ['literal', '   '],
    ['entity-encoded', '&#32;'],
  ])(
    'refuses a %s whitespace-only number, asked for as written',
    (_what, blank) => {
      const document = TASK_WITH_OBJECTS.replace(
        `<tm:task tm:number="${TASK}"`,
        `<tm:task tm:number="${blank}"`,
      );
      expect(() => readTransportItem(document, ' ')).toThrow(REFUSAL);
      expect(() => readTransportItem(document, '   ')).toThrow(REFUSAL);
    },
  );
});

describe('transportItem reads every field of the item by namespace, whatever the prefix', () => {
  /** The document with `xmlns:t2` bound to tm and every element from `open` through `close` written with `t2:`. */
  const underT2 = (document: string, open: string, close: string): string => {
    const start = document.indexOf(open);
    const end = document.indexOf(close, start) + close.length;
    const block = document.slice(start, end).split('tm:').join('t2:');
    return document
      .slice(0, start)
      .concat(block, document.slice(end))
      .replace(
        '<tm:root ',
        document.includes('xmlns:t2=')
          ? '<tm:root '
          : `<tm:root xmlns:t2="${TM}" `,
      );
  };

  it('a task, its parent and its entries under t2 read as under tm', () => {
    const asTm = readTransportItem(TASK_WITH_OBJECTS, TASK);
    const t2Task = underT2(TASK_WITH_OBJECTS, '<tm:task ', '</tm:task>');
    const both = underT2(t2Task, '<tm:request ', '</tm:request>');
    expect(readTransportItem(t2Task, TASK)).toEqual(asTm);
    expect(readTransportItem(both, TASK)).toEqual(asTm);
  });

  it('a request and its tasks under t2 read as under tm', () => {
    const asTm = readTransportItem(REQUEST, PARENT);
    const t2 = underT2(REQUEST, '<tm:request ', '</tm:request>');
    expect(readTransportItem(t2, PARENT)).toEqual(asTm);
  });
});
