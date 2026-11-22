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

  it.each([
    ['another number', () => readTransportItem(TASK_WITH_OBJECTS, PARENT)],
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
