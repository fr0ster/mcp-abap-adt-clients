/**
 * The header probe's pure parts (tools/header-probe): what an answer records,
 * the rows and summary, the report, and the ledger's cleanup on failure. No
 * system: answers are built by hand in the shape the connection returns them.
 */

import {
  eachInTurn,
  Interrupt,
  Interrupted,
  Ledger,
  withCleanup,
  withLock,
} from '../../../../tools/header-probe/ledger';
import { KNOWN_PAIRS, knownPair } from '../../../../tools/header-probe/pairs';
import {
  endpointOf,
  type IOperationRow,
  type IProbeAnswer,
  type IProbeReport,
  modeDifferences,
  PROBE_TYPE,
  pathCollisions,
  plannedKinds,
  probePair,
  readAnswer,
  readState,
  refusedKnownPairs,
  renderMarkdown,
} from '../../../../tools/header-probe/record';
import { extractSupportedContentType } from '../../../utils/supportedMediaTypes';

const KNOWN = { accept: 'application/a+xml', contentType: 'application/c+xml' };

const exception = (message: string, type = 'ExceptionNotAcceptable') =>
  '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  `<namespace id="com.sap.adt"/><type id="${type}"/>` +
  `<message lang="EN">${message}</message>` +
  `<localizedMessage lang="EN">${message}</localizedMessage></exc:exception>`;

function answer(overrides: Partial<IProbeAnswer>): IProbeAnswer {
  return {
    probe: 'known',
    sent: KNOWN,
    mode: 'batched',
    requests: [{ method: 'POST', path: '/sap/bc/adt/x' }],
    supportedAccept: [],
    supportedContentType: [],
    ...overrides,
  };
}

describe('the pair table', () => {
  it('holds no member without both headers', () => {
    for (const pair of KNOWN_PAIRS) {
      expect(pair.accept).not.toBe('');
      expect(pair.contentType).not.toBe('');
    }
  });

  it('takes a completed pair where 35.0.0 sent one header', () => {
    expect(knownPair('getFunctionGroup()', 'create')).toEqual({
      accept: 'application/vnd.sap.adt.functions.groups.v3+xml',
      contentType: 'application/vnd.sap.adt.functions.groups.v3+xml',
    });
    expect(knownPair('getClass()', 'create')).toEqual({
      accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
      contentType: 'application/vnd.sap.adt.oo.classes.v4+xml',
    });
    expect(knownPair('getClass()', 'nothing')).toBeUndefined();
  });

  it('takes the corrected pair where SAP refuses the one 35.0.0 sent', () => {
    expect(knownPair('getEnhancement()', 'check')).toEqual({
      accept: 'application/vnd.sap.adt.checkmessages+xml',
      contentType: 'application/vnd.sap.adt.checkobjects+xml',
    });
    expect(
      KNOWN_PAIRS.find(
        (p) => p.handler === 'getEnhancement()' && p.member === 'check',
      )?.from,
    ).toBe('corrected');
  });
});

describe('probePair', () => {
  it('sends the probe type in exactly one header per bad probe', () => {
    expect(probePair('known', KNOWN)).toEqual(KNOWN);
    expect(probePair('badAccept', KNOWN)).toEqual({
      accept: PROBE_TYPE,
      contentType: KNOWN.contentType,
    });
    expect(probePair('badContentType', KNOWN)).toEqual({
      accept: KNOWN.accept,
      contentType: PROBE_TYPE,
    });
  });
});

describe('readAnswer', () => {
  it('reads a 406: SAP type, message, the named types and the raw text', () => {
    const body = exception(
      'The message content is not acceptable. Accepted content types: application/a+xml, application/b+xml',
    );
    const read = readAnswer({
      probe: 'badAccept',
      sent: probePair('badAccept', KNOWN),
      mode: 'batched',
      requests: [],
      wire: {
        status: 406,
        statusText: 'Not Acceptable',
        headers: { 'Content-Type': 'application/xml' },
        data: body,
      },
    });
    expect(read.status).toBe(406);
    expect(read.sapType).toBe('ExceptionNotAcceptable');
    expect(read.sapMessage).toBe(
      'The message content is not acceptable. Accepted content types: application/a+xml, application/b+xml',
    );
    expect(read.responseContentType).toBe('application/xml');
    expect(read.supportedAccept).toEqual([
      'application/a+xml',
      'application/b+xml',
    ]);
    expect(read.acceptedText).toBe(
      'Accepted content types: application/a+xml, application/b+xml',
    );
    expect(read.body).toBe(body);
  });

  it('reads a 415 with extractSupportedContentType, as it returns', () => {
    const wire = {
      status: 415,
      statusText: 'Unsupported Media Type',
      headers: { 'content-type': 'application/xml' },
      data: exception(
        'Unsupported Media Type. Supported Media Types: application/c+xml',
        'ExceptionUnsupportedMediaType',
      ),
    };
    const read = readAnswer({
      probe: 'badContentType',
      sent: probePair('badContentType', KNOWN),
      mode: 'sequential: --sequential',
      requests: [],
      wire,
    });
    expect(read.status).toBe(415);
    expect(read.sapType).toBe('ExceptionUnsupportedMediaType');
    // Whatever the parser answers, as it answers it: the probe reports it.
    expect(read.supportedContentType).toEqual(
      extractSupportedContentType({ response: wire }),
    );
    expect(read.supportedContentType).toContain('application/c+xml');
    expect(read.acceptedText).toBeUndefined();
  });

  it('keeps no body of a success', () => {
    const read = readAnswer({
      probe: 'known',
      sent: KNOWN,
      mode: 'batched',
      requests: [],
      wire: { status: 200, statusText: 'OK', headers: {}, data: '<ok/>' },
    });
    expect(read.status).toBe(200);
    expect(read.body).toBeUndefined();
    expect(read.sapType).toBeUndefined();
  });

  it('records a probe that got no answer as a failure', () => {
    const read = readAnswer({
      probe: 'known',
      sent: KNOWN,
      mode: 'batched',
      requests: [],
      failure: 'socket hang up',
    });
    expect(read.status).toBeUndefined();
    expect(read.failure).toBe('socket hang up');
  });
});

describe('readState', () => {
  it('tells an object that exists, with its version, from one that does not', () => {
    expect(
      readState({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '<x adtcore:version="inactive" adtcore:name="Z"/>',
      }),
    ).toEqual({ status: 200, exists: true, version: 'inactive' });
    expect(
      readState({ status: 404, statusText: '', headers: {}, data: '' }),
    ).toEqual({ status: 404, exists: false });
    expect(
      readState({ status: 500, statusText: '', headers: {}, data: '' }),
    ).toEqual({ status: 500, exists: 'unknown' });
    expect(readState(undefined)).toEqual({ exists: 'unknown' });
  });
});

describe('endpointOf', () => {
  it('replaces the names, drops the query and keeps its _action', () => {
    expect(
      endpointOf(
        'post',
        '/sap/bc/adt/oo/classes/zhp1234?_action=LOCK&accessMode=MODIFY',
        undefined,
        ['ZHP1234'],
      ),
    ).toEqual({
      method: 'POST',
      path: '/sap/bc/adt/oo/classes/{name}',
      action: 'LOCK',
    });
    expect(
      endpointOf(
        'PUT',
        '/sap/bc/adt/functions/groups/zhpg/fmodules/z_hp_f/source/main?lockHandle=x',
        undefined,
        ['ZHPG', 'Z_HP_F'],
      ),
    ).toEqual({
      method: 'PUT',
      path: '/sap/bc/adt/functions/groups/{name}/fmodules/{name}/source/main',
      // It runs under a lock: the handle is in the query.
      lockHandle: true,
    });
    expect(
      endpointOf('DELETE', '/sap/bc/adt/x/zhp', { lockHandle: 'h' }, ['ZHP']),
    ).toEqual({
      method: 'DELETE',
      path: '/sap/bc/adt/x/{name}',
      lockHandle: true,
    });
  });

  it('reads _action from the params as well', () => {
    expect(
      endpointOf(
        'POST',
        '/sap/bc/adt/programs/programs/zhp',
        { _action: 'UNLOCK' },
        ['ZHP'],
      ).action,
    ).toBe('UNLOCK');
  });
});

describe('the summary', () => {
  const rows: IOperationRow[] = [
    {
      objectType: 'class',
      member: 'create',
      known: KNOWN,
      probes: [
        answer({ status: 201 }),
        answer({
          probe: 'badAccept',
          status: 406,
          supportedAccept: ['application/a+xml'],
        }),
      ],
    },
    {
      objectType: 'program',
      member: 'check',
      known: KNOWN,
      probes: [
        answer({
          status: 415,
          supportedContentType: ['application/z+xml'],
          sapMessage: 'no',
          requests: [{ method: 'POST', path: '/sap/bc/adt/checkruns' }],
        }),
      ],
    },
    {
      objectType: 'class',
      member: 'check',
      known: KNOWN,
      probes: [
        answer({
          status: 200,
          requests: [{ method: 'POST', path: '/sap/bc/adt/checkruns' }],
        }),
      ],
    },
    {
      objectType: 'class',
      member: 'lock',
      known: KNOWN,
      probes: [
        answer({
          status: 200,
          requests: [{ method: 'POST', path: '/sap/bc/adt/x', action: 'LOCK' }],
        }),
      ],
    },
    {
      objectType: 'table',
      member: 'activate',
      skipped: 'skipped: no tables here',
      probes: [],
    },
  ];

  it('lists every known pair refused with 406 or 415, with what was named', () => {
    expect(refusedKnownPairs(rows)).toEqual([
      {
        objectType: 'program',
        member: 'check',
        status: 415,
        sent: KNOWN,
        named: ['application/z+xml'],
        sapMessage: 'no',
      },
    ]);
  });

  it('lists every endpoint two rows share, and flags answers that differ', () => {
    const collisions = pathCollisions(rows);
    expect(collisions.map((entry) => entry.endpoint)).toEqual([
      'POST /sap/bc/adt/checkruns',
    ]);
    const [checkruns] = collisions;
    expect(checkruns.uses.map((use) => use.user)).toEqual([
      'class.check',
      'program.check',
    ]);
    expect(checkruns.answersDiffer).toBe(true);
  });

  it('does not flag a shared endpoint answered alike', () => {
    const alike = pathCollisions([
      rows[2],
      { ...rows[2], objectType: 'program' },
    ]);
    expect(alike).toHaveLength(1);
    expect(alike[0].answersDiffer).toBe(false);
  });

  it('renders a table per object type and the summary', () => {
    const report: IProbeReport = {
      startedAt: '2026-01-01T00:00:00.000Z',
      mode: 'batched',
      filters: {},
      rows,
      removals: [
        { label: 'class ZHP1', removed: true, detail: 'deleted' },
        { label: 'class ZHP2', removed: false, detail: '423 locked' },
      ],
    };
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('## class');
    expect(markdown).toContain('## program');
    expect(markdown).toContain('| program | check | 415 |');
    expect(markdown).toContain('#### `POST /sap/bc/adt/checkruns`');
    expect(markdown).toContain('the answers differ');
    expect(markdown).toContain('table.activate: skipped: no tables here');
    expect(markdown).toContain('**NOT REMOVED**: class ZHP2');
    expect(markdown).toContain('1 temporary object(s) could not be removed');
  });

  it('compares a batched with a sequential run probe by probe', () => {
    const batched: IProbeReport = {
      startedAt: 'a',
      mode: 'batched',
      filters: {},
      rows: [rows[0]],
      removals: [],
    };
    const sequential: IProbeReport = {
      ...batched,
      mode: 'sequential',
      rows: [
        {
          ...rows[0],
          probes: [
            answer({ status: 201 }),
            answer({ probe: 'badAccept', status: 400 }),
          ],
        },
      ],
    };
    expect(modeDifferences(batched, sequential)).toEqual([
      {
        objectType: 'class',
        member: 'create',
        probe: 'badAccept',
        batched: '406 |  | application/a+xml | ',
        sequential: '400 |  |  | ',
      },
    ]);
  });
});

describe('the ledger', () => {
  it('removes every entry, newest first, when the run fails', async () => {
    const removed: string[] = [];
    const reported: string[] = [];
    const ledger = new Ledger((removal) => reported.push(removal.label));
    ledger.add({
      label: 'function group',
      remove: async () => {
        removed.push('function group');
        return { removed: true, detail: 'deleted' };
      },
    });
    ledger.add({
      label: 'function module',
      remove: async () => {
        removed.push('function module');
        return { removed: true, detail: 'deleted' };
      },
    });

    const run = withCleanup(ledger, async () => {
      throw new Error('the system went away');
    });
    await expect(run).rejects.toThrow('the system went away');
    expect(removed).toEqual(['function module', 'function group']);
    expect(reported).toEqual(['function module', 'function group']);
  });

  it('reports a removal that throws as not removed and goes on', async () => {
    const ledger = new Ledger();
    ledger.add({
      label: 'first',
      remove: async () => ({ removed: true, detail: 'deleted' }),
    });
    ledger.add({
      label: 'second',
      remove: async () => {
        throw new Error('423 locked');
      },
    });
    const removals = await ledger.cleanup();
    expect(removals).toEqual([
      {
        label: 'second',
        removed: false,
        detail: 'the removal threw: 423 locked',
      },
      { label: 'first', removed: true, detail: 'deleted' },
    ]);
  });

  it('cleans up once, however often it is asked', async () => {
    let calls = 0;
    const ledger = new Ledger();
    ledger.add({
      label: 'one',
      remove: async () => {
        calls += 1;
        return { removed: true, detail: 'deleted' };
      },
    });
    await Promise.all([ledger.cleanup(), ledger.cleanup()]);
    await ledger.cleanup();
    expect(calls).toBe(1);
  });
});

describe('the ledger, late entries', () => {
  it('removes an entry added while the cleanup runs', async () => {
    const removed: string[] = [];
    const ledger = new Ledger();
    const entry = (label: string, then?: () => void) => ({
      label,
      remove: async () => {
        removed.push(label);
        then?.();
        return { removed: true, detail: 'deleted' };
      },
    });
    ledger.add(entry('first', () => ledger.add(entry('late'))));
    const removals = await ledger.cleanup();
    expect(removed).toEqual(['first', 'late']);
    expect(removals.map((removal) => removal.label)).toEqual(['first', 'late']);
  });

  it('removes on the next call what was added after a cleanup finished', async () => {
    const removed: string[] = [];
    const ledger = new Ledger();
    const entry = (label: string) => ({
      label,
      remove: async () => {
        removed.push(label);
        return { removed: true, detail: 'deleted' };
      },
    });
    ledger.add(entry('first'));
    await ledger.cleanup();
    ledger.add(entry('after'));
    await ledger.cleanup();
    expect(removed).toEqual(['first', 'after']);
  });
});

describe('an interrupt', () => {
  /**
   * The run as the driver issues it: every request asks the interrupt first,
   * a create's object is in the ledger before the create is sent, and it
   * exists only once the create has answered.
   */
  function system() {
    const exists = new Set<string>();
    const sent: string[] = [];
    const interrupt = new Interrupt();
    const ledger = new Ledger();
    let answer: (() => void) | undefined;
    let answering = false;
    const inFlight = () =>
      new Promise<void>((resolve) => {
        const poll = () => (answer ? resolve() : setImmediate(poll));
        poll();
      });
    const create = async (name: string): Promise<void> => {
      interrupt.check();
      ledger.add({
        label: name,
        remove: async () => {
          if (!exists.delete(name))
            return { removed: true, detail: 'not there' };
          return { removed: true, detail: 'deleted' };
        },
      });
      sent.push(name);
      await new Promise<void>((resolve) => {
        answer = () => {
          answer = undefined;
          exists.add(name);
          resolve();
        };
        // Once SAP has answered the first, it answers at once: a request that
        // should not have been sent shows up in `sent` instead of hanging.
        if (answering) answer();
      });
    };
    return {
      exists,
      sent,
      interrupt,
      ledger,
      create,
      inFlight,
      answer: () => {
        answering = true;
        answer?.();
      },
    };
  }

  it('lets the create in flight answer, sends nothing new, and deletes what it made', async () => {
    const run = system();
    const probe = withCleanup(run.ledger, async () => {
      await run.create('ZHP1');
      await run.create('ZHP2');
    });
    const stopped = expect(probe).rejects.toBeInstanceOf(Interrupted);
    await run.inFlight();
    run.interrupt.stop(); // Ctrl-C while ZHP1's create is on the wire
    run.answer(); // …and only then does SAP answer: ZHP1 now exists
    await stopped;
    expect(run.sent).toEqual(['ZHP1']);
    expect(run.exists.size).toBe(0);
  });
});

describe('prerequisites', () => {
  it('creates the message whatever the filters, so a filtered update has one to work on', () => {
    const filters = { only: ['messageClass'], operation: 'update' };
    expect(plannedKinds(filters, 'messageClass', 'create')).toEqual(['known']);
    expect(plannedKinds(filters, 'messageClassMessage', 'create')).toEqual([
      'known',
    ]);
    expect(plannedKinds(filters, 'messageClassMessage', 'update')).toEqual([
      'known',
      'badAccept',
      'badContentType',
    ]);
    expect(plannedKinds(filters, 'messageClassMessage', 'delete')).toEqual([]);
    expect(plannedKinds(filters, 'class', 'create')).toEqual([]);
  });

  it('keeps the delete order when the delete is asked for', () => {
    expect(
      plannedKinds({ operation: 'delete' }, 'domain', 'delete', [
        'badAccept',
        'badContentType',
        'known',
      ]),
    ).toEqual(['badAccept', 'badContentType', 'known']);
  });
});

describe('an interrupt, request by request', () => {
  /** A request that answers only when told to. */
  function wire() {
    let answer: (() => void) | undefined;
    let answering = false;
    return {
      send: () =>
        new Promise<void>((resolve) => {
          answer = resolve;
          if (answering) resolve();
        }),
      inFlight: () =>
        new Promise<void>((resolve) => {
          const poll = () => (answer ? resolve() : setImmediate(poll));
          poll();
        }),
      answer: () => {
        answering = true;
        answer?.();
      },
    };
  }

  it('under --sequential, sends nothing after the create in flight but the cleanup', async () => {
    const interrupt = new Interrupt();
    const ledger = new Ledger();
    const net = wire();
    const sent: string[] = [];
    ledger.add({
      label: 'ZHP1',
      remove: async () => {
        sent.push('delete ZHP1');
        return { removed: true, detail: 'deleted' };
      },
    });
    // One step's calls as the sequential path sends them: a create, its
    // state read, the two bad-header creates and theirs.
    const step = [
      'create K',
      'read K',
      'create A',
      'read A',
      'create C',
      'read C',
    ];
    const run = withCleanup(ledger, () =>
      eachInTurn(step, interrupt, async (request) => {
        sent.push(request);
        await net.send();
      }),
    );
    const stopped = expect(run).rejects.toBeInstanceOf(Interrupted);
    await net.inFlight();
    interrupt.stop();
    net.answer();
    await stopped;
    expect(sent).toEqual(['create K', 'delete ZHP1']);
  });

  it('runs every item when there is no interrupt to ask (cleanup work)', async () => {
    const done: number[] = [];
    await eachInTurn([1, 2, 3], undefined, async (item) => {
      done.push(item);
    });
    expect(done).toEqual([1, 2, 3]);
  });

  it("a Ctrl-C during a prerequisite's lock still unlocks, then deletes", async () => {
    const interrupt = new Interrupt();
    const ledger = new Ledger();
    const net = wire();
    const sent: string[] = [];
    let locked = false;
    ledger.add({
      label: 'ZHPDDL',
      remove: async () => {
        sent.push(locked ? 'delete while locked' : 'delete');
        return { removed: !locked, detail: locked ? 'locked' : 'deleted' };
      },
    });
    // The dependency setup as the driver runs it: lock, then write and
    // unlock under withLock; the unlock is cleanup and not stopped.
    const setup = withCleanup(ledger, async () => {
      interrupt.check();
      sent.push('lock');
      await net.send();
      locked = true;
      await withLock(
        'handle',
        async () => {
          sent.push('unlock');
          locked = false;
        },
        async () => {
          interrupt.check();
          sent.push('update');
        },
      );
    });
    const stopped = expect(setup).rejects.toBeInstanceOf(Interrupted);
    await net.inFlight();
    interrupt.stop(); // while the LOCK is on the wire
    net.answer();
    await stopped;
    expect(sent).toEqual(['lock', 'unlock', 'delete']);
  });

  it('releases the lock when the write under it fails', async () => {
    const released: string[] = [];
    await expect(
      withLock(
        'h',
        async (handle) => released.push(handle),
        async () => {
          throw new Error('423');
        },
      ),
    ).rejects.toThrow('423');
    expect(released).toEqual(['h']);
  });
});
