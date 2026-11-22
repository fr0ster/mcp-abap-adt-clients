import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  type ITransportObjectEntry,
  parseObjectEntries,
  readTransportItem,
  transportItem,
  transportObjectEntries,
} from '../results/transport';
import {
  EMPTY_TASK,
  PARENT,
  REQUEST,
  TASK,
  TASK_WITH_OBJECTS,
} from './serverDocuments';

/**
 * An entry SAP lists without a name or a type is kept (0.28.2): it was
 * dropped, so a task's object list and its count lost it with nothing said
 * (found by the server team's review, mcp-abap-adt #378).
 *
 * The documents: `TASK_WITH_OBJECTS`, the server's reconstruction of the
 * on-premise task document (not a recording), and `EMPTY_TASK`, the task
 * document recorded on the cloud; `REQUEST` is the server's written request
 * document. Every variant here is built in the test from one of them, and
 * each says what it changes.
 */
const wire = (data: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data,
});

/** `document` with `remove` taken out; refuses a variant that changes nothing. */
const without = (document: string, remove: string): string => {
  const variant = document.split(remove).join('');
  if (variant === document) throw new Error(`not in the document: ${remove}`);
  return variant;
};

const SECOND_NAME = ' tm:name="ZCL_ONE                       RUN"';

/** TASK_WITH_OBJECTS, its second entry (the method) without its name. */
const TASK_NAMELESS_ENTRY = without(TASK_WITH_OBJECTS, SECOND_NAME);

/** TASK_WITH_OBJECTS, its second entry without its type. */
const TASK_TYPELESS_ENTRY = without(TASK_WITH_OBJECTS, ' tm:type="METH"');

/** EMPTY_TASK, the cloud task, with one entry added that carries no name. */
const CLOUD_TASK_NAMELESS_ENTRY = (() => {
  const end = '</tm:task>';
  if (!EMPTY_TASK.includes(end)) throw new Error('no tm:task in EMPTY_TASK');
  return EMPTY_TASK.replace(
    end,
    '<tm:abap_object tm:pgmid="R3TR" tm:type="CLAS" tm:position="000001"/>' +
      end,
  );
})();

/** REQUEST, its task's entry (not the aggregate's) without its name. */
const REQUEST_NAMELESS_ENTRY = (() => {
  const entry =
    '<tm:abap_object tm:pgmid="R3TR" tm:type="CLAS" tm:name="ZCL_ONE" tm:position="000001"/>';
  const first = REQUEST.indexOf(entry);
  if (first < 0) throw new Error('no entry in REQUEST');
  return (
    REQUEST.slice(0, first) +
    entry.replace(' tm:name="ZCL_ONE"', '') +
    REQUEST.slice(first + entry.length)
  );
})();

const METHOD_WITHOUT_NAME = {
  task: TASK,
  pgmid: 'LIMU',
  type: 'METH',
  position: '000002',
  info: 'Method',
};

describe('transportItem: a task entry without a name or a type is kept', () => {
  it('the reconstructed task, an entry without its name: in incompleteEntries, counted', () => {
    const item = readTransportItem(TASK_NAMELESS_ENTRY, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.objects.map((o) => [o.name, o.position])).toEqual([
      ['ZCL_ONE', '000001'],
    ]);
    expect(item.incompleteEntries).toEqual([METHOD_WITHOUT_NAME]);
    // Every entry SAP lists is counted: the complete and the incomplete.
    expect(item.objects.length + (item.incompleteEntries?.length ?? 0)).toBe(2);
  });

  it('the reconstructed task, an entry without its type: in incompleteEntries', () => {
    const item = readTransportItem(TASK_TYPELESS_ENTRY, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.objects.map((o) => o.name)).toEqual(['ZCL_ONE']);
    expect(item.incompleteEntries).toEqual([
      {
        task: TASK,
        pgmid: 'LIMU',
        name: 'ZCL_ONE                       RUN',
        position: '000002',
        info: 'Method',
      },
    ]);
  });

  it('the recorded cloud task, an entry added without its name: in incompleteEntries', () => {
    const item = transportItem(TASK)(wire(CLOUD_TASK_NAMELESS_ENTRY));
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.objects).toEqual([]);
    expect(item.incompleteEntries).toEqual([
      { task: TASK, pgmid: 'R3TR', type: 'CLAS', position: '000001' },
    ]);
  });

  it('a request counts the entry without its name in its task’s objectCount', () => {
    const item = readTransportItem(REQUEST_NAMELESS_ENTRY, PARENT);
    if (item.kind !== 'request') throw new Error('expected a request');
    expect(item.tasks.map((t) => [t.header.number, t.objectCount])).toEqual([
      [TASK, 1],
    ]);
  });

  it('the documents as recorded and reconstructed: no incompleteEntries key', () => {
    for (const [document, number] of [
      [TASK_WITH_OBJECTS, TASK],
      [EMPTY_TASK, TASK],
      [REQUEST, PARENT],
    ] as const) {
      const item = readTransportItem(document, number);
      expect('incompleteEntries' in item).toBe(false);
    }
  });
});

describe('transportObjectEntries: an entry without a name or a type is kept', () => {
  it('the reconstructed task, an entry without its name: in incompleteEntries', () => {
    const entries = parseObjectEntries(TASK_NAMELESS_ENTRY);
    expect(entries.map((e) => e.name)).toEqual(['ZCL_ONE']);
    expect(entries.incompleteEntries).toEqual([METHOD_WITHOUT_NAME]);
  });

  it('the recorded cloud task, an entry added without its name: in incompleteEntries', () => {
    const entries = transportObjectEntries(wire(CLOUD_TASK_NAMELESS_ENTRY));
    expect([...entries]).toEqual([]);
    expect(entries.incompleteEntries).toEqual([
      { task: TASK, pgmid: 'R3TR', type: 'CLAS', position: '000001' },
    ]);
  });

  it('a request, its task’s entry without its name: in incompleteEntries with the task; the aggregate is not read', () => {
    const entries = transportObjectEntries(wire(REQUEST_NAMELESS_ENTRY));
    expect([...entries]).toEqual([]);
    expect(entries.incompleteEntries).toEqual([
      { task: TASK, pgmid: 'R3TR', type: 'CLAS', position: '000001' },
    ]);
  });

  it('an entry with no attribute at all is kept, with its task', () => {
    const empty = TASK_WITH_OBJECTS.replace(
      '</tm:task>',
      '<tm:abap_object/></tm:task>',
    );
    expect(parseObjectEntries(empty).incompleteEntries).toEqual([
      { task: TASK },
    ]);
    const item = readTransportItem(empty, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.incompleteEntries).toEqual([{ task: TASK }]);
  });

  it('the documents as recorded and reconstructed: no incompleteEntries key', () => {
    for (const document of [TASK_WITH_OBJECTS, EMPTY_TASK, REQUEST]) {
      expect('incompleteEntries' in parseObjectEntries(document)).toBe(false);
    }
  });
});

describe('the change is additive', () => {
  it('transportObjectEntries still fits where an array of entries was declared', () => {
    // Compiles only while the answer is still an ITransportObjectEntry[].
    const asBefore: IResultStrategy<ITransportObjectEntry[]> =
      transportObjectEntries;
    expect(asBefore(wire(TASK_WITH_OBJECTS))).toHaveLength(2);
  });
});
