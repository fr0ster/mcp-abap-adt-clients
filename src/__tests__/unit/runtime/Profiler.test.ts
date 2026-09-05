import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { Profiler } from '../../../runtime/traces/ProfilerDomain';
import { compareRecordedAt } from '../../../runtime/traces/traceParsing';
import { expectResult } from '../../helpers/contract';

describe('Profiler', () => {
  // Real documents rather than empty bodies, so these cases test the
  // delegation — which URL, which options — and not what the mapping makes of
  // nothing. The parsers do not refuse an empty body; an earlier version of
  // this comment said they did, and stopped being true when that validation was
  // removed.
  const FEED = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Traces</atom:title></atom:feed>`;
  const HITLIST = `<?xml version="1.0"?><trc:hitlist xmlns:trc="x"/>`;
  const STATEMENTS = `<?xml version="1.0"?><trc:statements xmlns:trc="x"/>`;
  const DB_ACCESSES = `<?xml version="1.0"?><trc:dbAccesses xmlns:trc="x"/>`;

  function createConnectionMock() {
    return {
      makeAdtRequest: jest.fn(async (request: any) => {
        const url = String(request?.url ?? '');
        if (url.includes('/hitlist')) {
          return { status: 200, data: HITLIST, headers: {} };
        }
        if (url.includes('/statements')) {
          return { status: 200, data: STATEMENTS, headers: {} };
        }
        if (url.includes('/dbAccesses')) {
          return { status: 200, data: DB_ACCESSES, headers: {} };
        }
        return { status: 200, data: FEED, headers: {} };
      }),
    } as unknown as IAbapConnection;
  }

  function createLogger() {
    return {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;
  }

  it("readWith() hands the caller the body and keeps the caller's type", async () => {
    // The consumer's own reader is not sent back to an untyped response, and
    // this library forms no second opinion about the document.
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    const mine: { length: number } = await profiler.readWith(
      (data) => ({ length: String(data).length }),
      'T1',
      'hitlist',
    );

    expect(mine.length).toBeGreaterThan(0);
    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          '/sap/bc/adt/runtime/traces/abaptraces/T1/hitlist',
        ),
      }),
    );
  });

  it('readWith() sends the same request read() does', async () => {
    // One request path behind both, so they cannot drift on URL or options.
    const a = createConnectionMock();
    const b = createConnectionMock();
    await new Profiler(a, createLogger()).read('T1', 'statements', {
      withDetails: true,
    });
    await new Profiler(b, createLogger()).readWith(
      (data) => data,
      'T1',
      'statements',
      { withDetails: true },
    );

    const urlOf = (mock: any) => mock.makeAdtRequest.mock.calls[0][0].url;
    expect(urlOf(b)).toBe(urlOf(a));
  });

  it('list() gives a caller what latestTraceId() used to, and no less', async () => {
    // `latestTraceId()` is gone: it sat on this class where nobody holding
    // `IProfiler` could reach it. A consumer picks the newest from `list()`
    // with `compareRecordedAt` — the offsets are the point, since 09:00Z is
    // later than 10:00+02:00 and sorts lower as text.
    const feed = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
      <atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/AAAAAAAAAAAAAAAAAAAA</atom:id><atom:published>2026-08-28T10:00:00+02:00</atom:published></atom:entry>
      <atom:entry><atom:id>/sap/bc/adt/runtime/traces/abaptraces/BBBBBBBBBBBBBBBBBBBB</atom:id><atom:published>2026-08-28T09:00:00Z</atom:published></atom:entry>
    </atom:feed>`;
    const connection = {
      makeAdtRequest: jest
        .fn()
        .mockResolvedValue({ status: 200, data: feed, headers: {} }),
    } as unknown as IAbapConnection;

    const entries = expectResult(
      await new Profiler(connection, createLogger()).list(),
      'entries',
    );
    // Exactly the snippet the CHANGELOG and the reference publish, guard and
    // all — so the documented migration is what is under test here.
    const newest = entries.length
      ? entries.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b))
      : undefined;
    expect(newest?.id).toBe('BBBBBBBBBBBBBBBBBBBB');
  });

  it('the migration answers undefined on an empty feed, as latestTraceId() did', async () => {
    // The reason the snippet carries a guard. `latestTraceId()` returned
    // `undefined` when nothing had been profiled yet, and an empty feed is a
    // normal state, not an error — while `reduce` with no initial value throws
    // `TypeError` on `[]`. A migration that turns "nothing yet" into a crash is
    // not the same method by another name.
    const connection = {
      makeAdtRequest: jest.fn().mockResolvedValue({
        status: 200,
        data: '<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"/>',
        headers: {},
      }),
    } as unknown as IAbapConnection;

    const entries = expectResult(
      await new Profiler(connection, createLogger()).list(),
      'entries',
    );
    expect(entries).toEqual([]);

    const newest = entries.length
      ? entries.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b))
      : undefined;
    expect(newest).toBeUndefined();

    // And the unguarded form is why the guard is published: this is what a
    // reader who copies `reduce` alone would get.
    expect(() =>
      entries.reduce((a, b) => (compareRecordedAt(a, b) > 0 ? a : b)),
    ).toThrow(TypeError);
  });

  it('delete() sends DELETE to the trace itself', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.delete('T1');

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/T1',
        method: 'DELETE',
      }),
    );
  });

  it('delete() takes a full URI as well as an id', async () => {
    // `list()` hands back a `uri`, so a caller should be able to pass it
    // straight back without unpicking it first.
    const connection = createConnectionMock();
    await new Profiler(connection, createLogger()).delete(
      '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD',
    );

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces/ABCDEF0123456789ABCD',
        method: 'DELETE',
      }),
    );
  });

  it('list() delegates to /sap/bc/adt/runtime/traces/abaptraces', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.list();

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/sap/bc/adt/runtime/traces/abaptraces',
        method: 'GET',
      }),
    );
  });

  it('read() sends the view the caller asked for, not a fixed one', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    await profiler.read('T1', 'statements', { withDetails: true });

    expect(connection.makeAdtRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(
          '/sap/bc/adt/runtime/traces/abaptraces/T1/statements',
        ),
        method: 'GET',
      }),
    );
  });

  it('read() refuses a view this family does not have', async () => {
    const connection = createConnectionMock();
    const profiler = new Profiler(connection, createLogger());

    // The compiler rejects this; JavaScript callers reach it, so it throws
    // rather than silently requesting a URL that cannot answer.
    await expect(
      // @ts-expect-error 'callGraph' is not a view of this family
      profiler.read('T1', 'callGraph'),
    ).rejects.toThrow(/Unknown trace view/);
  });

  it('buildParametersXml() returns XML string with default parameters', () => {
    const profiler = new Profiler(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    const xml = profiler.buildParametersXml();

    expect(typeof xml).toBe('string');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('trc:parameters');
  });

  it('getDefaultParameters() returns a copy of default profiler parameters', () => {
    const profiler = new Profiler(
      {} as unknown as IAbapConnection,
      {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as any,
    );

    const defaults = profiler.getDefaultParameters();

    expect(defaults).toMatchObject({
      allProceduralUnits: true,
      sqlTrace: true,
      allDbEvents: true,
      amdpTrace: true,
    });
    // Must be a copy, not the same reference
    expect(defaults).not.toBe(profiler.getDefaultParameters());
  });
});
