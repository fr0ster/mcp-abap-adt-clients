import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  type ITransportObjectEntry,
  parseObjectEntries,
  parseObjectEntryList,
  readTransportItem,
  transportItem,
  transportObjectEntries,
  transportObjectEntryList,
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

describe('transportObjectEntryList: an entry without a name or a type is kept', () => {
  it('the reconstructed task, an entry without its name: in incompleteEntries', () => {
    const list = parseObjectEntryList(TASK_NAMELESS_ENTRY);
    expect(list.entries.map((e) => e.name)).toEqual(['ZCL_ONE']);
    expect(list.incompleteEntries).toEqual([METHOD_WITHOUT_NAME]);
    // Same counting rule as a task item: every entry SAP lists.
    expect(list.entries.length + (list.incompleteEntries?.length ?? 0)).toBe(2);
  });

  it('the recorded cloud task, an entry added without its name: in incompleteEntries', () => {
    const list = transportObjectEntryList(wire(CLOUD_TASK_NAMELESS_ENTRY));
    expect(list).toEqual({
      entries: [],
      incompleteEntries: [
        { task: TASK, pgmid: 'R3TR', type: 'CLAS', position: '000001' },
      ],
    });
  });

  it('a request, its task’s entry without its name: in incompleteEntries with the task; the aggregate is not read', () => {
    const list = transportObjectEntryList(wire(REQUEST_NAMELESS_ENTRY));
    expect(list).toEqual({
      entries: [],
      incompleteEntries: [
        { task: TASK, pgmid: 'R3TR', type: 'CLAS', position: '000001' },
      ],
    });
  });

  it('survives serialisation: the incomplete entry is in the JSON', () => {
    const list = transportObjectEntryList(wire(TASK_NAMELESS_ENTRY));
    expect(JSON.parse(JSON.stringify(list)).incompleteEntries).toEqual([
      METHOD_WITHOUT_NAME,
    ]);
  });

  it('an entry with no attribute at all is kept, with its task', () => {
    const empty = TASK_WITH_OBJECTS.replace(
      '</tm:task>',
      '<tm:abap_object/></tm:task>',
    );
    expect(parseObjectEntryList(empty).incompleteEntries).toEqual([
      { task: TASK },
    ]);
    const item = readTransportItem(empty, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.incompleteEntries).toEqual([{ task: TASK }]);
  });

  it('the documents as recorded and reconstructed: no incompleteEntries key, the same entries as transportObjectEntries', () => {
    for (const document of [TASK_WITH_OBJECTS, EMPTY_TASK, REQUEST]) {
      const list = parseObjectEntryList(document);
      expect('incompleteEntries' in list).toBe(false);
      expect(list.entries).toEqual(parseObjectEntries(document));
    }
  });
});

/** TASK_WITH_OBJECTS, the second entry's attribute `from` replaced by `to`. */
const secondEntryWith = (from: string, to: string): string => {
  if (!TASK_WITH_OBJECTS.includes(from)) throw new Error(`not in: ${from}`);
  return TASK_WITH_OBJECTS.replace(from, to);
};

/** A name or a type written as two encoded spaces: blank once decoded and trimmed. */
const ENCODED_BLANK = '&#32;&#x20;';
const TASK_BLANK_NAME = secondEntryWith(
  SECOND_NAME,
  ` tm:name="${ENCODED_BLANK}"`,
);
const TASK_BLANK_TYPE = secondEntryWith(
  ' tm:type="METH"',
  ` tm:type="${ENCODED_BLANK}"`,
);

describe('a blank name or type is missing in both complete readings', () => {
  it('an encoded blank name: in incompleteEntries, the name absent', () => {
    const item = readTransportItem(TASK_BLANK_NAME, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    const list = parseObjectEntryList(TASK_BLANK_NAME);
    for (const [objects, incomplete] of [
      [item.objects, item.incompleteEntries],
      [list.entries, list.incompleteEntries],
    ] as const) {
      expect(objects.map((o) => o.name)).toEqual(['ZCL_ONE']);
      expect(incomplete).toEqual([METHOD_WITHOUT_NAME]);
      expect(incomplete?.map((e) => 'name' in e)).toEqual([false]);
    }
  });

  it('an encoded blank type: in incompleteEntries, the type absent', () => {
    const item = readTransportItem(TASK_BLANK_TYPE, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    const list = parseObjectEntryList(TASK_BLANK_TYPE);
    for (const incomplete of [item.incompleteEntries, list.incompleteEntries]) {
      expect(incomplete).toEqual([
        {
          task: TASK,
          pgmid: 'LIMU',
          name: 'ZCL_ONE                       RUN',
          position: '000002',
          info: 'Method',
        },
      ]);
      expect(incomplete?.map((e) => 'type' in e)).toEqual([false]);
    }
  });

  it('the legacy array is unchanged: it answers the blank-named entry as before', () => {
    // Pinned as it was: the array is not where 0.28.2 changes anything.
    expect(parseObjectEntries(TASK_BLANK_NAME).map((e) => e.name)).toEqual([
      'ZCL_ONE',
      '  ',
    ]);
    expect(parseObjectEntries(TASK_BLANK_TYPE).map((e) => e.type)).toEqual([
      'CLAS',
      '  ',
    ]);
  });
});

describe('transportObjectEntryList keeps what the entry carries, as decoded', () => {
  it('a typeless entry is in incompleteEntries', () => {
    expect(parseObjectEntryList(TASK_TYPELESS_ENTRY).incompleteEntries).toEqual(
      [
        {
          task: TASK,
          pgmid: 'LIMU',
          name: 'ZCL_ONE                       RUN',
          position: '000002',
          info: 'Method',
        },
      ],
    );
  });

  it('a reference in a name or a type is decoded, complete or not', () => {
    const encoded = secondEntryWith(
      SECOND_NAME,
      ' tm:name="Z&amp;ONE"',
    ).replace(' tm:type="CLAS"', ' tm:type="C&amp;S"');
    const list = parseObjectEntryList(encoded);
    expect(list.entries).toEqual([
      expect.objectContaining({ name: 'ZCL_ONE', type: 'C&S' }),
      expect.objectContaining({ name: 'Z&ONE', type: 'METH' }),
    ]);
    const typeless = without(encoded, ' tm:type="METH"');
    expect(parseObjectEntryList(typeless).incompleteEntries).toEqual([
      expect.objectContaining({ name: 'Z&ONE' }),
    ]);
    const nameless = without(TASK_WITH_OBJECTS, SECOND_NAME).replace(
      ' tm:type="METH"',
      ' tm:type="M&amp;TH"',
    );
    expect(parseObjectEntryList(nameless).incompleteEntries).toEqual([
      expect.objectContaining({ type: 'M&TH' }),
    ]);
    const item = readTransportItem(nameless, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    expect(item.incompleteEntries).toEqual([
      expect.objectContaining({ type: 'M&TH' }),
    ]);
  });

  it('an absent field is no key at all, in either reading', () => {
    const item = readTransportItem(CLOUD_TASK_NAMELESS_ENTRY, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    const list = parseObjectEntryList(CLOUD_TASK_NAMELESS_ENTRY);
    for (const incomplete of [item.incompleteEntries, list.incompleteEntries]) {
      const [entry] = incomplete ?? [];
      if (entry === undefined) throw new Error('expected an entry');
      expect(Object.keys(entry).sort()).toEqual([
        'pgmid',
        'position',
        'task',
        'type',
      ]);
      expect('name' in entry).toBe(false);
    }
  });
});

describe('both complete readings answer the same trimmed values', () => {
  /**
   * The entries' attributes padded in front with an encoded space, the
   * task's number on both sides.
   */
  const padded = (document: string): string => {
    let out = document;
    for (const attribute of [
      'pgmid',
      'type',
      'name',
      'position',
      'lock_status',
      'obj_info',
    ]) {
      out = out.split(` tm:${attribute}="`).join(` tm:${attribute}="&#32;`);
    }
    return out
      .split(`tm:number="${TASK}"`)
      .join(`tm:number="&#32;${TASK}&#x20;"`);
  };

  it('entity-encoded padding: transportObjectEntryList answers what transportItem answers', () => {
    const document = padded(TASK_WITH_OBJECTS);
    const item = readTransportItem(document, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    const list = parseObjectEntryList(document);
    expect(list.entries).toEqual(item.objects);
    expect(list.entries.map((e) => [e.task, e.pgmid, e.type, e.name])).toEqual([
      [TASK, 'R3TR', 'CLAS', 'ZCL_ONE'],
      [TASK, 'LIMU', 'METH', 'ZCL_ONE                       RUN'],
    ]);
  });

  it('a name padded on both sides, an incomplete entry padded too', () => {
    const document = secondEntryWith(
      SECOND_NAME,
      ' tm:name="&#32;ZCL_ONE&#x20;"',
    ).replace(' tm:type="METH"', '');
    const item = readTransportItem(document, TASK);
    if (item.kind !== 'task') throw new Error('expected a task');
    const list = parseObjectEntryList(document);
    expect(list.incompleteEntries).toEqual(item.incompleteEntries);
    expect(list.incompleteEntries?.map((e) => e.name)).toEqual(['ZCL_ONE']);
  });

  it('the legacy array keeps its 0.28.1 output: the padding as decoded', () => {
    const document = secondEntryWith(
      SECOND_NAME,
      ' tm:name="&#32;ZCL_ONE&#x20;"',
    );
    expect(parseObjectEntries(document).map((e) => e.name)).toEqual([
      'ZCL_ONE',
      ' ZCL_ONE ',
    ]);
  });
});

describe('transportObjectEntries is the array it was', () => {
  it('answers the complete entries only, and carries nothing on the array', () => {
    const entries = transportObjectEntries(wire(TASK_NAMELESS_ENTRY));
    expect(entries.map((e) => e.name)).toEqual(['ZCL_ONE']);
    expect(Object.keys(entries)).toEqual(['0']);
  });

  it('still fits where an array of entries was declared', () => {
    const asBefore: IResultStrategy<ITransportObjectEntry[]> =
      transportObjectEntries;
    expect(asBefore(wire(TASK_WITH_OBJECTS))).toHaveLength(2);
  });
});
