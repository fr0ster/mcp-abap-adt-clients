/**
 * The error corpus (tools/header-probe): the authorization stop, the
 * discovery parsing, the clients recording, what `none` puts on the wire, the
 * report and summary, and the cleanup of a write that created something. No
 * SAP system: a fake one answers, envelopes included; the wire measurement
 * runs the real connection against a local HTTP server.
 */

import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  current,
  gate,
  type ICapture,
  onTheWire,
  runCalls,
  send,
  traced,
} from '../../../../tools/header-probe/capture';
import {
  authorizationProblem,
  classifyNeeds,
  discoveryProbes,
  emptyNamed,
  existenceOf,
  existencePerEndpoint,
  headerShape,
  type ICorpus,
  type ICorpusRow,
  isolationKeys,
  judge,
  namedPerEndpoint,
  needsLines,
  notSent,
  PROBE_NAME,
  parseDiscovery,
  refusedCorpusPairs,
  renderCorpusMarkdown,
  renderNamedSummary,
  stats,
  t100Of,
  wireNote,
  withContrast,
} from '../../../../tools/header-probe/corpus';
import {
  defaultOutputDir,
  outputDir,
  removalOutcome,
  runCorpus,
  runFull,
  systemFolder,
} from '../../../../tools/header-probe/corpusRun';
import { Interrupt, Interrupted } from '../../../../tools/header-probe/ledger';
import {
  clientsOn,
  DEBUGGERS,
  handlerSpecs,
  prototypeMembers,
  recordingConnection,
  recordMembers,
  standInParameters,
} from '../../../../tools/header-probe/members';
import {
  KNOWN_PAIRS,
  LEGACY_PAIRS,
} from '../../../../tools/header-probe/pairs';
import { PROBE_TYPE } from '../../../../tools/header-probe/record';
import {
  evidenceOfRows,
  measureUpdates,
  runWriteCycle,
  verdictOf,
} from '../../../../tools/header-probe/writeCycle';

const SAMPLE = path.resolve(
  __dirname,
  '../../../../docs/architecture/discovery.xml',
);

interface ISeen {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  /** Inside an envelope. */
  part: boolean;
}

type Answer = { status: number; body?: string; contentType?: string };

/** A system that answers each request, envelope parts one by one. */
function fakeSystem(answer: (request: ISeen) => Answer): {
  connection: IAbapConnection;
  seen: ISeen[];
} {
  const seen: ISeen[] = [];
  const wire = (a: Answer): IAdtWireResponse => ({
    status: a.status,
    statusText: '',
    headers: { 'content-type': a.contentType ?? 'application/xml' },
    data: a.body ?? '',
  });
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'http://fake.invalid',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: IAbapRequestOptions) => {
      const headers = Object.fromEntries(
        Object.entries(request.headers ?? {}).map(([k, v]) => [
          k.toLowerCase(),
          String(v),
        ]),
      );
      if (request.url === '/sap/bc/adt/communication/batch') {
        const boundary = headers['content-type'].split('boundary=')[1];
        const parts = String(request.data)
          .split(`--${boundary}`)
          .filter((chunk) => chunk.includes('HTTP/1.1'));
        let out = '';
        for (const part of parts) {
          const inner = part.slice(part.indexOf('\r\n\r\n') + 4);
          const [head, ...rest] = inner.split('\r\n\r\n');
          const [line, ...lines] = head.split('\r\n');
          const [method, url] = line.split(' ');
          const partHeaders: Record<string, string> = {};
          for (const h of lines) {
            const colon = h.indexOf(':');
            partHeaders[h.slice(0, colon).trim().toLowerCase()] = h
              .slice(colon + 1)
              .trim();
          }
          const one: ISeen = {
            method,
            url,
            headers: partHeaders,
            body: rest.join('\r\n\r\n').replace(/\r\n$/, ''),
            part: true,
          };
          seen.push(one);
          const a = answer(one);
          out += `--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 ${a.status} X\r\nContent-Type: ${a.contentType ?? 'application/xml'}\r\n\r\n${a.body ?? ''}\r\n`;
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'multipart/mixed; boundary=answer' },
          data: `${out}--answer--\r\n`,
        };
      }
      const one: ISeen = {
        method: request.method,
        url: request.url,
        headers,
        body: request.data == null ? '' : String(request.data),
        part: false,
      };
      seen.push(one);
      const a = answer(one);
      if (a.status >= 400)
        throw Object.assign(new Error(`status ${a.status}`), {
          response: wire(a),
        });
      return wire(a);
    },
  } as unknown as IAbapConnection;
  return { connection, seen };
}

const DISCOVERY = `<?xml version="1.0" encoding="utf-8"?>
<app:service xmlns:app="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom">
  <app:workspace>
    <atom:title>Probe</atom:title>
    <app:collection href="/sap/bc/adt/probe/things">
      <atom:title>Things</atom:title>
      <app:accept>application/vnd.probe.thing+xml</app:accept>
    </app:collection>
    <app:collection href="/sap/bc/adt/probe/reads">
      <atom:title>Reads</atom:title>
    </app:collection>
  </app:workspace>
</app:service>`;

const NOT_ACCEPTABLE = (types: string) =>
  '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
  '<namespace id="com.sap.adt"/><type id="ExceptionResourceNotAcceptable"/>' +
  `<message lang="EN">Accepted content types: ${types}</message></exc:exception>`;

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'error-corpus-'));
}

function output() {
  const lines: string[] = [];
  const loud: string[] = [];
  return {
    lines,
    loud,
    out: {
      progress: (line: string) => lines.push(line),
      loud: (line: string) => loud.push(line),
    },
  };
}

const AUTH_EXCEPTION = (type: string, message: string) =>
  `<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="${type}"/><message lang="EN">${message}</message></exc:exception>`;

describe('the authorization check', () => {
  it.each([
    [401, '', 'no SAP exception'],
    [
      403,
      AUTH_EXCEPTION(
        'ExceptionResourceNoAuthorization',
        'You are not authorized',
      ),
      'ExceptionResourceNoAuthorization',
    ],
  ])('a %i at the discovery read stops the run: the Oops, exit 2, nothing more sent, the report marked', async (status, body, kind) => {
    const system = fakeSystem(() => ({ status, body }));
    const dir = tempDir();
    const { lines, out } = output();
    let asked = false;
    const result = await runCorpus({
      connection: system.connection,
      source: 'clients',
      mode: 'corpus',
      interrupt: new Interrupt(),
      outDir: dir,
      clientOptions: async () => {
        asked = true;
        return {};
      },
      out,
    });
    expect(result.exitCode).toBe(2);
    expect(lines[lines.length - 1]).toBe(
      `Oops: authorization problem (${status}, ${kind}) at GET /sap/bc/adt/discovery — fix it and run again`,
    );
    expect(system.seen).toHaveLength(1);
    expect(system.seen[0].url).toBe('/sap/bc/adt/discovery');
    expect(asked).toBe(false);
    expect(result.corpus?.error).toMatch(/^stopped: authorization/);
    expect(fs.readdirSync(dir)).toHaveLength(2);
  });

  it('a 403 that is not an authorization refusal is a status, not a stop', async () => {
    const system = fakeSystem(() => ({ status: 403, body: 'Forbidden' }));
    const dir = tempDir();
    const { lines, out } = output();
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: dir,
      clientOptions: async () => ({}),
      out,
    });
    expect(result.exitCode).toBe(1);
    expect(lines[0]).toBe('The discovery read answered 403');
    // The report is always written, marked with what ended the run.
    expect(result.corpus.error).toBe(
      'failed: The discovery read answered 403 (discovery none)',
    );
    expect(fs.readdirSync(dir)).toHaveLength(2);
  });

  it('prints the status of any other refusal and stops', async () => {
    const system = fakeSystem(() => ({ status: 500 }));
    const { lines, out } = output();
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out,
    });
    expect(result.exitCode).toBe(1);
    expect(lines[0]).toBe('The discovery read answered 500');
    expect(system.seen).toHaveLength(1);
    expect(result.corpus.endedBy).toMatch(
      /^failed: The discovery read answered 500/,
    );
  });
});

describe('the discovery document', () => {
  const collections = parseDiscovery(fs.readFileSync(SAMPLE, 'utf8'));

  it('reads every collection of the saved sample, its accept types and template links', () => {
    expect(collections).toHaveLength(919);
    const repos = collections.find(
      (c) => c.href === '/sap/bc/adt/abapgit/repos',
    );
    expect(repos?.workspace).toBeTruthy();
    expect(repos?.accept).toEqual([
      'application/abapgit.adt.repo.v1+xml',
      'application/abapgit.adt.repo.v2+xml',
      'application/abapgit.adt.repo.v3+xml',
      'application/abapgit.adt.repo.v4+xml',
    ]);
    const typed = collections
      .flatMap((c) => c.templates)
      .find((t) => t.type?.includes('serverdriven.schema'));
    expect(typed?.template).toContain('{?relatedObjectUri}');
    // An empty <app:accept> is not a type.
    const bopf = collections.find(
      (c) => c.href === '/sap/bc/adt/bopf/businessobjects',
    );
    expect(bopf?.accept).toEqual([]);
  });

  it('plans a GET per collection and a POST where it lists app:accept; corpus: a row per type', () => {
    const methods = (accept: string[]) =>
      accept.length ? ['GET', 'POST'] : ['GET'];
    let none = 0;
    let corpus = 0;
    let bogus = 0;
    for (const c of collections)
      for (const method of methods(c.accept)) {
        const skipped = Boolean(notSent(c.href, method));
        none += 1;
        corpus +=
          skipped || method === 'GET' || !c.accept.length ? 1 : c.accept.length;
        bogus += skipped || method === 'GET' ? 1 : 2;
      }
    expect(discoveryProbes(collections, 'none')).toHaveLength(none);
    expect(discoveryProbes(collections, 'corpus')).toHaveLength(corpus);
    expect(discoveryProbes(collections, 'bogus')).toHaveLength(bogus);
  });

  it('corpus: a request without a body gets no Content-Type, and the row records the one not sent', () => {
    const corpus = discoveryProbes(parseDiscovery(DISCOVERY), 'corpus');
    const get = corpus.find(
      (p) =>
        p.method === 'GET' && p.collection.href === '/sap/bc/adt/probe/things',
    );
    const post = corpus.find((p) => p.method === 'POST');
    // app:accept is the body's type: a Content-Type, never an Accept.
    expect(get?.asked).toEqual({});
    expect(get?.contentTypeNotSent).toBe(
      'not sent: no body (application/vnd.probe.thing+xml)',
    );
    expect(post?.asked).toEqual({
      contentType: 'application/vnd.probe.thing+xml',
    });
    expect(post?.contentTypeNotSent).toBeUndefined();
  });

  it('bogus: one header per request, the other as in corpus; Content-Type only with a body', () => {
    const planned = discoveryProbes(parseDiscovery(DISCOVERY), 'bogus');
    const of = (href: string, method: string) =>
      planned
        .filter((p) => p.collection.href === href && p.method === method)
        .map((p) => ({ bogus: p.bogus, asked: p.asked }));
    const type = 'application/vnd.probe.thing+xml';
    expect(of('/sap/bc/adt/probe/things', 'GET')).toEqual([
      { bogus: 'accept', asked: { accept: PROBE_TYPE } },
    ]);
    expect(of('/sap/bc/adt/probe/things', 'POST')).toEqual([
      { bogus: 'accept', asked: { accept: PROBE_TYPE, contentType: type } },
      {
        bogus: 'content-type',
        asked: { contentType: PROBE_TYPE },
      },
    ]);
    expect(of('/sap/bc/adt/probe/reads', 'GET')).toEqual([
      { bogus: 'accept', asked: { accept: PROBE_TYPE } },
    ]);
  });

  it('does not send what answers a logon ticket, attaches a debugger or switches a trace on', () => {
    const planned = discoveryProbes(collections, 'none');
    const of = (href: string, method: string) =>
      planned.find((p) => p.collection.href === href && p.method === method);
    expect(of('/sap/bc/adt/security/reentranceticket', 'GET')?.skipped).toMatch(
      /secret/,
    );
    expect(of('/sap/bc/adt/debugger/listeners', 'GET')?.skipped).toMatch(
      /debugger/,
    );
    expect(of('/sap/bc/adt/abapgit/repos', 'POST')?.skipped).toBeUndefined();
  });
});

describe('the clients source', () => {
  let recorded: Awaited<ReturnType<typeof recordMembers>>;
  beforeAll(async () => {
    recorded = await recordMembers();
  });
  const find = (handler: string, member: string) =>
    recorded.members.find((m) => m.handler === handler && m.member === member);

  it('takes each endpoint from the request the member builds, sending nothing', () => {
    expect(find('getClass()', 'create')?.requests).toEqual([
      { method: 'POST', path: '/sap/bc/adt/oo/classes' },
    ]);
    expect(find('getClass()', 'create')?.pair).toBeDefined();
    expect(find('getProgram()', 'lock')?.requests).toEqual([
      {
        method: 'POST',
        path: '/sap/bc/adt/programs/programs/{name}',
        action: 'LOCK',
      },
    ]);
    expect(find('getClass()', 'readMetadata')?.call).toBeDefined();
  });

  it('lists every member it cannot record, with the reason, and drops none', () => {
    expect(find('getRequest()', 'create')?.skipped).toMatch(
      /^skipped: the server assigns/,
    );
    expect(find('legacy getClassExecutor()', 'scheduleTrace')?.skipped).toMatch(
      /^skipped: the server assigns/,
    );
    expect(find('getClass()', 'getVersionSource')?.skipped).toMatch(
      /^skipped: needs a URI/,
    );
    for (const spec of DEBUGGERS)
      for (const member of prototypeMembers(spec.prototype))
        expect(find(spec.label, member)?.skipped).toMatch(/debugging session/);
    const clients = clientsOn(recordingConnection());
    for (const spec of handlerSpecs(clients)) {
      const handler = spec.of(clients);
      for (
        let level = Object.getPrototypeOf(handler);
        level && level !== Object.prototype;
        level = Object.getPrototypeOf(level)
      )
        for (const name of Object.getOwnPropertyNames(level)) {
          if (name === 'constructor') continue;
          if (
            typeof Object.getOwnPropertyDescriptor(level, name)?.value !==
            'function'
          )
            continue;
          const listed =
            Boolean(find(spec.label, name)) ||
            recorded.helpers.includes(`${spec.label}.${name}`);
          expect(`${spec.label}.${name}: ${listed}`).toBe(
            `${spec.label}.${name}: true`,
          );
        }
    }
    for (const member of recorded.members)
      expect(Boolean(member.call) !== Boolean(member.skipped)).toBe(true);
  });
});

describe('what goes on the wire', () => {
  it('none: an envelope part carries neither header', async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : { status: 400, body: '' },
    );
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const probes = system.seen.filter(
      (s) => s.part && !s.url.endsWith(PROBE_NAME.toLowerCase()),
    );
    expect(probes.map((p) => `${p.method} ${p.url}`)).toEqual([
      'GET /sap/bc/adt/probe/things',
      'POST /sap/bc/adt/probe/things',
      'GET /sap/bc/adt/probe/reads',
    ]);
    for (const probe of probes) {
      expect(probe.headers.accept).toBeUndefined();
      expect(probe.headers['content-type']).toBeUndefined();
    }
    const rows = result.corpus?.rows ?? [];
    for (const row of rows) {
      expect(row.onWire).toEqual([{ accept: null, contentType: null }]);
      expect(row.wireNote).toBe('none on the wire');
      expect(row.ran).toBe('batched');
    }
  });

  it('bogus: each part carries the probe type in its one header, the other as in corpus', async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : {
            status: 406,
            body: NOT_ACCEPTABLE('application/vnd.probe.thing+xml'),
          },
    );
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'bogus',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const probes = system.seen.filter(
      (s) => s.part && !s.url.endsWith(PROBE_NAME.toLowerCase()),
    );
    const type = 'application/vnd.probe.thing+xml';
    expect(
      probes.map((p) => [
        p.method,
        p.url,
        p.headers.accept,
        p.headers['content-type'],
      ]),
    ).toEqual([
      ['GET', '/sap/bc/adt/probe/things', PROBE_TYPE, undefined],
      ['POST', '/sap/bc/adt/probe/things', PROBE_TYPE, type],
      ['POST', '/sap/bc/adt/probe/things', undefined, PROBE_TYPE],
      ['GET', '/sap/bc/adt/probe/reads', PROBE_TYPE, undefined],
    ]);
    expect(result.corpus?.needs?.map((n) => [n.endpoint, n.needs])).toEqual([
      ['GET /sap/bc/adt/probe/reads', 'accept'],
      ['GET /sap/bc/adt/probe/things', 'accept'],
      ['POST /sap/bc/adt/probe/things', 'accept'],
    ]);
    const row = result.corpus?.rows[0] as ICorpusRow;
    expect(row.named.acceptedText).toBe(
      'Accepted content types: application/vnd.probe.thing+xml',
    );
  });

  describe('a request of its own, through the real connection', () => {
    let server: http.Server;
    let url = '';
    const received: http.IncomingHttpHeaders[] = [];
    beforeAll(async () => {
      server = http.createServer((request, response) => {
        request.resume();
        request.on('end', () => {
          if (request.url?.startsWith('/sap/bc/adt/x'))
            received.push(request.headers);
          response.writeHead(200, {
            'content-type': 'text/plain',
            'x-csrf-token': 'token',
            // The session the connection's logon expects to be opened.
            'set-cookie': 'SAP_SESSIONID_X=1; path=/',
          });
          response.end('ok');
        });
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const address = server.address() as { port: number };
      url = `http://127.0.0.1:${address.port}`;
    });
    afterAll(
      () => new Promise<void>((resolve) => server.close(() => resolve())),
    );

    it('none: no Accept; a body keeps the Content-Type the connection adds, and the row says so', async () => {
      const { createConnection } = require('@mcp-abap-adt/connection');
      const { BasicAuthProvider } = require('@mcp-abap-adt/auth-providers');
      const connection = onTheWire(
        createConnection({
          config: {
            url,
            authType: 'basic',
            username: 'u',
            password: 'p',
            client: '001',
          },
          credential: new BasicAuthProvider('u', 'p'),
          system: 'onprem',
          transport: 'http',
        }),
      ) as IAbapConnection & { disconnect?: () => Promise<void> };
      await connection.connect();
      const shaped = traced(gate(connection, {}), {
        shape: headerShape('none', false),
      });
      const send = async (request: IAbapRequestOptions): Promise<ICapture> => {
        const capture: ICapture = { requests: [] };
        await current.run(capture, () => shaped.makeAdtRequest(request));
        return capture;
      };
      received.length = 0;
      const get = await send({
        url: '/sap/bc/adt/x',
        method: 'GET',
        timeout: 0,
        headers: { Accept: '', 'Content-Type': '' },
      });
      const post = await send({
        url: '/sap/bc/adt/x',
        method: 'POST',
        timeout: 0,
        data: 'fake',
        headers: { Accept: '', 'Content-Type': '' },
      });
      expect(received[0].accept).toBeUndefined();
      expect(received[0]['content-type']).toBeUndefined();
      expect(get.onWire).toEqual([{ accept: null, contentType: null }]);
      expect(wireNote('none', get.onWire ?? [])).toBe('none on the wire');
      expect(received[1].accept).toBeUndefined();
      expect(received[1]['content-type']).toBe('text/plain; charset=utf-8');
      expect(post.onWire).toEqual([
        { accept: null, contentType: 'text/plain; charset=utf-8' },
      ]);
      expect(wireNote('none', post.onWire ?? [])).toBe(
        'defaults-not-removable',
      );
    });
  });
});

function row(overrides: Partial<ICorpusRow>): ICorpusRow {
  return {
    source: 'clients',
    group: 'getClass()',
    label: 'create',
    endpoint: { method: 'POST', path: '/sap/bc/adt/oo/classes' },
    requests: [{ method: 'POST', path: '/sap/bc/adt/oo/classes' }],
    onWire: [],
    named: emptyNamed(),
    ran: 'batched',
    ...overrides,
  };
}

describe('the report and the summary', () => {
  const refused = row({
    status: 406,
    asked: { accept: 'application/a+xml', contentType: 'application/c+xml' },
    named: {
      ...emptyNamed(),
      acceptedText:
        'Accepted content types: application/vnd.sap.adt.oo.classes.v4+xml',
      supportedAccept: ['application/vnd.sap.adt.oo.classes.v4+xml'],
    },
  });
  const unsupported = row({
    label: 'update',
    endpoint: {
      method: 'PUT',
      path: '/sap/bc/adt/oo/classes/{name}/source/main',
    },
    status: 415,
    asked: { accept: 'text/plain', contentType: 'application/x' },
    sapMessage: 'Supported: text/plain',
    named: {
      ...emptyNamed(),
      inMessage: ['text/plain'],
      supportedContentType: ['application/xml'],
    },
  });
  const corpus: ICorpus = {
    source: 'clients',
    headers: 'corpus',
    startedAt: '2026-10-18T00:00:00.000Z',
    rows: [
      refused,
      unsupported,
      row({ label: 'read', status: 404 }),
      row({ label: 'lock', status: 404 }),
      row({ label: 'getVersionSource', skipped: 'skipped: needs a URI' }),
      row({
        label: 'activate',
        status: 200,
        afterWrite: { exists: true, status: 200 },
      }),
    ],
    removals: [
      {
        label: 'clients: getClass() Z_HPEC_PROBE',
        removed: true,
        detail: 'deleted (200)',
      },
    ],
  };

  it('counts per status, lists every endpoint per status and every 406 and 415 with what was named', () => {
    const md = renderCorpusMarkdown(corpus);
    expect(md).toContain('| 404 | 2 |');
    expect(md).toContain('| skipped | 1 |');
    expect(md).toContain('#### 404');
    expect(md).toContain('- POST /sap/bc/adt/oo/classes — getClass().read');
    expect(md).toContain(
      '| 406 | POST /sap/bc/adt/oo/classes — getClass().create | Accept: application/a+xml; Content-Type: application/c+xml | Accepted content types: application/vnd.sap.adt.oo.classes.v4+xml | application/vnd.sap.adt.oo.classes.v4+xml |',
    );
    expect(md).toContain(
      '| 415 | PUT /sap/bc/adt/oo/classes/{name}/source/main — getClass().update',
    );
    expect(md).toContain('**exists: created, removed in the cleanup**');
    expect(md).toContain(
      '- removed: clients: getClass() Z_HPEC_PROBE — deleted (200)',
    );
  });

  it('lists every corpus pair the system refused', () => {
    expect(refusedCorpusPairs(corpus).map((r) => r.label)).toEqual([
      'create',
      'update',
    ]);
    expect(refusedCorpusPairs({ ...corpus, headers: 'bogus' })).toEqual([]);
    expect(renderCorpusMarkdown(corpus)).toContain(
      '- 406 POST /sap/bc/adt/oo/classes — getClass().create: sent Accept: application/a+xml; Content-Type: application/c+xml; named application/vnd.sap.adt.oo.classes.v4+xml',
    );
  });

  it('shows per endpoint the values named in any mode', () => {
    const bogus: ICorpus = {
      ...corpus,
      headers: 'bogus',
      rows: [
        row({
          status: 415,
          named: {
            ...emptyNamed(),
            supportedText:
              'Supported Media Types: application/vnd.sap.adt.oo.classes.v4+xml',
          },
        }),
      ],
    };
    const named = namedPerEndpoint([corpus, bogus]);
    const create = named.find(
      (entry) => entry.endpoint === 'clients: POST /sap/bc/adt/oo/classes',
    );
    expect(create?.accept).toEqual([
      'application/vnd.sap.adt.oo.classes.v4+xml',
    ]);
    expect(create?.contentType).toEqual([
      'application/vnd.sap.adt.oo.classes.v4+xml',
    ]);
    expect(create?.seenIn).toEqual(['corpus: 406', 'bogus: 415']);
    expect(renderNamedSummary([corpus, bogus])).toContain(
      '| clients: POST /sap/bc/adt/oo/classes | application/vnd.sap.adt.oo.classes.v4+xml | application/vnd.sap.adt.oo.classes.v4+xml |',
    );
  });
});

describe('a write that created something', () => {
  it('is recorded, removed in the finally, and listed loudly', async () => {
    let exists = false;
    const system = fakeSystem((request) => {
      const uri = `/sap/bc/adt/probe/things/${PROBE_NAME.toLowerCase()}`;
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (
        request.method === 'POST' &&
        request.url === '/sap/bc/adt/probe/things'
      ) {
        exists = true;
        return { status: 201 };
      }
      if (request.url === uri)
        return exists
          ? { status: 200, body: `<thing name="${PROBE_NAME}"/>` }
          : { status: 404 };
      if (request.url === '/sap/bc/adt/deletion/delete') {
        expect(request.body).toContain(`adtcore:uri="${uri}"`);
        exists = false;
        return { status: 200 };
      }
      return { status: 404 };
    });
    const { loud, out } = output();
    const dir = tempDir();
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'corpus',
      interrupt: new Interrupt(),
      outDir: dir,
      clientOptions: async () => ({}),
      out,
    });
    const post = result.corpus?.rows.find((r) => r.endpoint?.method === 'POST');
    expect(post?.afterWrite?.exists).toBe(true);
    expect(result.corpus?.removals).toEqual([
      expect.objectContaining({ removed: true }),
    ]);
    expect(exists).toBe(false);
    expect(loud.join('\n')).toContain(
      '1 write probe(s) created the probe name',
    );
    expect(fs.readFileSync(result.files[1], 'utf8')).toContain(
      '**exists: created, removed in the cleanup**',
    );
  });

  it('a removal that fails is listed loudly as not removed', async () => {
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (request.url.endsWith(PROBE_NAME.toLowerCase()))
        return { status: 200, body: PROBE_NAME };
      return { status: request.method === 'POST' ? 201 : 404 };
    });
    const { loud, out } = output();
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out,
    });
    expect(result.corpus?.removals).toEqual([
      expect.objectContaining({ removed: false }),
    ]);
    expect(loud.join('\n')).toContain('could not be removed');
  });
});

describe('every member of a header-taking contract', () => {
  it('has a row: probed, or skipped with its reason — the legacy client included', async () => {
    const { members } = await recordMembers();
    const has = (handler: string, member: string) =>
      members.find(
        (m) =>
          m.handler === handler &&
          m.member === member &&
          (m.call !== undefined || /^skipped: \S/.test(m.skipped ?? '')),
      );
    const label = (handler: string, member: string): [string, string] => {
      if (handler === 'getClass() / getLocal*()') return ['getClass()', member];
      if (handler === 'executors (scheduleTrace)')
        return ['getClassExecutor()', member];
      return [handler, member];
    };
    const missing = [...KNOWN_PAIRS, ...LEGACY_PAIRS]
      .map((pair) => label(pair.handler, pair.member))
      .filter(([handler, member]) => !has(handler, member))
      .map(([handler, member]) => `${handler}.${member}`);
    expect(missing).toEqual([]);
    for (const handler of [
      'getPackage()',
      'getAppendStructure()',
      'getAuthorizationField()',
      'getBehaviorDefinition()',
      'getBehaviorImplementation()',
      'getEnhancement()',
      'getFunctionInclude()',
      'getScalarFunction()',
      'getScalarFunctionImplementation()',
      'getServiceBinding()',
      'legacy getClass()',
    ])
      expect(members.some((m) => m.handler === handler)).toBe(true);
  });
});

describe('what each endpoint needs', () => {
  const bogusRow = (
    label: string,
    bogus: 'accept' | 'content-type',
    status: number | undefined,
    extra: Partial<ICorpusRow> = {},
  ) => row({ label, bogus, status, ...extra });

  it("classifies accept, content-type, both, neither and unknown, by the order of SAP's REST framework", () => {
    const dump =
      '<html><head><style>x{}</style></head><body>Application Server Error 500 Internal Server Error Dereferencing of the NULL reference Server time: 1</body></html>';
    const rows = [
      bogusRow('a', 'accept', 406, {
        named: {
          ...emptyNamed(),
          acceptedText: 'Accepted content types: application/a+xml',
        },
      }),
      bogusRow('a', 'content-type', 200),
      bogusRow('c', 'accept', 200),
      bogusRow('c', 'content-type', 415, {
        named: { ...emptyNamed(), supportedContentType: ['application/c+xml'] },
      }),
      bogusRow('b', 'accept', 406, {
        named: {
          ...emptyNamed(),
          acceptedText: 'Accepted content types: application/b+xml',
        },
      }),
      bogusRow('b', 'content-type', 415),
      bogusRow('n', 'accept', 200, {
        pair: { accept: 'application/n+xml', contentType: 'application/n+xml' },
      }),
      bogusRow('n', 'content-type', 201),
      // A content error is no proof the header was let through.
      bogusRow('i', 'accept', 400, { sapType: 'ExceptionInvalidData' }),
      bogusRow('i', 'content-type', 200),
      bogusRow('x', 'accept', 500, { body: dump }),
      bogusRow('m', 'accept', 405),
      bogusRow('u', 'accept', 404),
      bogusRow('g', 'accept', 200, {
        pair: { contentType: 'application/g+xml' },
      }),
      row({ label: 's', skipped: 'skipped: needs a URI' }),
      bogusRow('h', 'accept', 400, { sapType: 'ExceptionResourceBadRequest' }),
    ];
    // A none run's 400 acceptHeaderMissing shows the Accept check.
    const none = [
      row({
        label: 'h',
        status: 400,
        sapMessage:
          'Request could not be understood by the server due to malformed syntax: Accept header missing',
      }),
    ];
    const needs = Object.fromEntries(
      classifyNeeds(rows, none).map((entry) => [
        entry.endpoint.split('.')[1].split(' ')[0],
        entry,
      ]),
    );
    expect(needs.a.needs).toBe('accept');
    expect(needs.a.namedAccept).toEqual(['application/a+xml']);
    expect(needs.c.needs).toBe('content-type');
    expect(needs.c.namedContentType).toEqual(['application/c+xml']);
    expect(needs.b.needs).toBe('both');
    expect(needs.n.needs).toBe('neither');
    expect(needs.n.detail).toBe(
      'Accept: not checked (200); Content-Type: not checked (201)',
    );
    expect(needs.n.tableNotes).toEqual([
      'the pair table lists Accept application/n+xml; the resource does not check Accept (a bogus one got 200)',
      'the pair table lists Content-Type application/n+xml; the resource does not check Content-Type (a bogus one got 201)',
    ]);
    expect(needs.i.needs).toBe('unknown');
    expect(needs.i.detail).toContain('400 ExceptionInvalidData');
    expect(needs.x.needs).toBe('unknown');
    expect(needs.x.detail).toBe(
      'Accept: unknown (500 dump or router: Dereferencing of the NULL reference); Content-Type: no body',
    );
    expect(needs.m.detail).toContain('405 method not implemented');
    expect(needs.u.needs).toBe('unknown');
    expect(needs.u.detail).toContain('404 (no SAP exception)');
    expect(needs.g.needs).toBe('neither');
    expect(needs.g.tableNotes).toEqual([
      'the pair table lists Content-Type application/g+xml for a request without a body',
    ]);
    expect(needs.s.needs).toBe('unknown');
    expect(needs.s.detail).toContain('skipped: needs a URI');
    expect(needs.h.needs).toBe('accept');
    expect(needs.h.accept.reason).toBe(
      '400 acceptHeaderMissing without Accept',
    );
    const md = needsLines(classifyNeeds(rows)).join('\n');
    expect(md).toContain('| both | 1 |');
    expect(md).toContain('#### needs: accept');
  });
});

describe('a clients run', () => {
  it('sends writes with a fake body, no LOCK, and Content-Type only with a body', async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : { status: 404 },
    );
    const result = await runCorpus({
      connection: system.connection,
      source: 'clients',
      mode: 'corpus',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const parts = system.seen.filter((s) => s.part);
    expect(parts.some((p) => p.url.includes('_action=LOCK'))).toBe(false);
    const create = parts.find(
      (p) => p.method === 'POST' && p.url === '/sap/bc/adt/oo/classes',
    );
    expect(create?.body).toContain('probe:errorCorpus');
    expect(create?.headers['content-type']).toBeDefined();
    const read = parts.find(
      (p) =>
        p.method === 'GET' &&
        p.url ===
          `/sap/bc/adt/oo/classes/${PROBE_NAME.toLowerCase()}/source/main`,
    );
    expect(read).toBeDefined();
    expect(read?.headers['content-type']).toBeUndefined();
    const lock = result.corpus?.rows.find(
      (r) => r.group === 'getClass()' && r.label === 'lock',
    );
    expect(lock?.skipped).toMatch(/takes no locks/);
    // The legacy client's writes share the modern handler's ledger entry.
    expect(
      result.corpus?.removals.some((r) =>
        r.label.startsWith('clients: legacy '),
      ),
    ).toBe(false);
    expect(result.corpus?.removals.every((r) => r.removed)).toBe(true);
  });
});

describe('the header corpus', () => {
  it('puts the Content-Type discovery lists beside what the none and bogus runs named', () => {
    const [things] = parseDiscovery(DISCOVERY);
    const at = (
      headers: 'corpus' | 'none' | 'bogus',
      rows: ICorpusRow[],
    ): ICorpus => ({
      source: 'discovery',
      headers,
      startedAt: '2026-10-18T00:00:00.000Z',
      rows,
      removals: [],
    });
    const base = {
      source: 'discovery' as const,
      group: 'Probe',
      label: 'Things',
      endpoint: { method: 'POST', path: '/sap/bc/adt/probe/things' },
      collection: things,
    };
    const md = renderNamedSummary([
      at('corpus', [row({ ...base, status: 400 })]),
      at('none', [
        row({
          ...base,
          status: 406,
          named: {
            ...emptyNamed(),
            acceptedText:
              'Accepted content types: application/vnd.probe.result+xml',
          },
        }),
      ]),
      at('bogus', [
        row({
          ...base,
          bogus: 'accept',
          status: 406,
          named: { ...emptyNamed(), supportedAccept: ['application/x+xml'] },
        }),
        row({
          ...base,
          bogus: 'content-type',
          status: 415,
          named: {
            ...emptyNamed(),
            inMessage: ['application/vnd.probe.thing+xml'],
          },
        }),
      ]),
    ]);
    expect(md).toContain(
      '| POST /sap/bc/adt/probe/things | Content-Type application/vnd.probe.thing+xml | application/vnd.probe.result+xml |  | application/x+xml | application/vnd.probe.thing+xml | both (Accept: checked (406); Content-Type: checked (415)) |',
    );
  });
});

describe('time', () => {
  const run = (sequential: boolean) =>
    runCorpus({
      connection: fakeSystem((request) =>
        request.url === '/sap/bc/adt/discovery'
          ? { status: 200, body: DISCOVERY }
          : { status: 404 },
      ).connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
      sequential,
    });

  it('records each envelope: parts, bytes, ms, ms per part; each row its envelope', async () => {
    const { corpus } = await run(false);
    expect(corpus?.envelopes).toHaveLength(1);
    const [envelope] = corpus?.envelopes ?? [];
    // Three probes and the read after the POST.
    expect(envelope.parts).toBe(4);
    expect(envelope.bytes).toBeGreaterThan(0);
    expect(envelope.msPerPart).toBeCloseTo(envelope.ms / 4);
    for (const r of corpus?.rows ?? []) {
      expect(r.envelope).toBe(envelope.id);
      expect(r.ms).toBe(envelope.msPerPart);
    }
    expect(renderCorpusMarkdown(corpus as ICorpus)).toContain(
      '| parts per envelope | 1 | 4 | 4 | 4 |',
    );
  });

  it('--sequential: no envelope, the wall time of each request', async () => {
    const { corpus } = await run(true);
    expect(corpus?.envelopes).toEqual([]);
    expect(corpus?.sequential).toBe(true);
    for (const r of corpus?.rows ?? []) {
      expect(r.envelope).toBeUndefined();
      expect(typeof r.ms).toBe('number');
      expect(r.ran).toBe('sequential: --sequential');
    }
  });

  it('gives total, median and p95', () => {
    expect(stats([5, 1, 3, 2, 4])).toEqual({
      count: 5,
      total: 15,
      median: 3,
      p95: 5,
    });
    expect(stats([])).toEqual({ count: 0, total: 0, median: 0, p95: 0 });
  });
});

describe('a refused corpus pair', () => {
  it('is a 406 to the Accept sent, or a 415 to the Content-Type sent — nothing else', () => {
    const corpus = (rows: ICorpusRow[]): ICorpus => ({
      source: 'discovery',
      headers: 'corpus',
      startedAt: '',
      rows,
      removals: [],
    });
    const refused = refusedCorpusPairs(
      corpus([
        row({
          label: 'a',
          status: 406,
          asked: { contentType: 'application/x' },
        }),
        row({
          label: 'b',
          status: 415,
          asked: { contentType: 'application/x' },
        }),
        row({ label: 'c', status: 406, asked: { accept: 'application/y' } }),
        row({ label: 'd', status: 415, asked: { accept: 'application/y' } }),
      ]),
    );
    expect(refused.map((r) => r.label)).toEqual(['b', 'c']);
  });
});

describe('a call that throws on the answer', () => {
  it('keeps the answer it threw with', async () => {
    const wire = { status: 404, statusText: '', headers: {}, data: 'gone' };
    const [capture] = await runCalls({
      calls: [
        async () => {
          throw Object.assign(
            new Error('Request failed with status code 404'),
            {
              response: wire,
            },
          );
        },
      ],
      batched: false,
      connection: recordingConnection(),
      direct: undefined,
      onBatch: () => undefined,
    });
    expect(capture.wire).toBe(wire);
    expect(capture.failure).toBe('Request failed with status code 404');
  });
});

/** A discovery document of `count` GET-only collections, `/sap/bc/adt/probe/c<n>`. */
function manyCollections(count: number, withAccept = false): string {
  let collections = '';
  for (let n = 1; n <= count; n++)
    collections += `<app:collection href="/sap/bc/adt/probe/c${n}"><atom:title>C${n}</atom:title>${withAccept ? '<app:accept>application/x+xml</app:accept>' : ''}</app:collection>`;
  return `<?xml version="1.0" encoding="utf-8"?><app:service xmlns:app="http://www.w3.org/2007/app" xmlns:atom="http://www.w3.org/2005/Atom"><app:workspace><atom:title>Probe</atom:title>${collections}</app:workspace></app:service>`;
}

const DUMP =
  '<html><body>Application Server Error 500 Internal Server Error Dereferencing of the NULL reference</body></html>';

/** A system where the part `bad` dumps, and its dump answers for every part of its envelope. */
function dumpingSystem(document: string, bad: string) {
  let envelope: string[] = [];
  const system = fakeSystem((request) => {
    if (request.url === '/sap/bc/adt/discovery')
      return { status: 200, body: document };
    if (request.part && envelope.includes(bad))
      return { status: 500, body: DUMP };
    return request.url === bad ? { status: 500, body: DUMP } : { status: 404 };
  });
  const make = system.connection.makeAdtRequest.bind(system.connection);
  (system.connection as { makeAdtRequest: unknown }).makeAdtRequest = (
    request: IAbapRequestOptions,
  ) => {
    // Which parts this envelope carries, before the fake answers them.
    envelope =
      request.url === '/sap/bc/adt/communication/batch'
        ? String(request.data)
            .split('\r\n')
            .filter((line) => / HTTP\/1\.1$/.test(line))
            .map((line) => line.split(' ')[1])
        : [];
    return make(request);
  };
  return system;
}

describe('a poisoned envelope', () => {
  const splitRun = (count: number, badIndex: number) => {
    const bad = `/sap/bc/adt/probe/c${badIndex}`;
    const system = dumpingSystem(manyCollections(count), bad);
    return {
      bad,
      system,
      run: runCorpus({
        connection: system.connection,
        source: 'discovery',
        mode: 'none',
        interrupt: new Interrupt(),
        outDir: tempDir(),
        clientOptions: async () => ({}),
        out: output().out,
        envelopeProbes: count,
      }),
    };
  };

  it.each([
    // probes, the bad one, envelopes the splitting sends, calls sent alone
    [100, 37, 10 + 10, 1],
    [29, 17, 10 + 3, 1],
  ])('of %i probes is split in tens until the one dumping call is found', async (count, badIndex, envelopes, alone) => {
    const { bad, system, run } = splitRun(count, badIndex);
    const { corpus } = await run;
    expect(corpus?.splits).toEqual([
      expect.objectContaining({
        parts: count,
        envelopes,
        requestsAlone: alone,
        causes: [`GET ${bad}`],
      }),
    ]);
    // One first envelope, then the splitting's.
    expect(corpus?.envelopes).toHaveLength(1 + envelopes);
    // Nothing but the dumping call is sent on its own.
    const direct = system.seen.filter(
      (s) => !s.part && s.url.startsWith('/sap/bc/adt/probe/'),
    );
    expect(direct.map((s) => s.url)).toEqual([bad]);
    for (const r of corpus?.rows ?? []) {
      if (r.endpoint?.path === bad) {
        expect(r.poisonCause).toBe(true);
        expect(r.status).toBe(500);
        continue;
      }
      expect(r.status).toBe(404);
      expect(r.settled?.path).toMatch(/^env 1 → group \d+( → group \d+)?$/);
      expect(r.ran).toMatch(/^batched: env 1 → group/);
    }
  });

  it('only when every part answered 500 with the same text: distinct 500s are answers', async () => {
    let n = 0;
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: manyCollections(5) }
        : { status: 500, body: `endpoint error ${n++}` },
    );
    const { corpus } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    expect(corpus?.splits).toEqual([]);
    expect(corpus?.envelopes).toHaveLength(1);
    expect(
      corpus?.rows.every((r) => r.status === 500 && r.ran === 'batched'),
    ).toBe(true);
  });

  it('an envelope with no answer is neither split nor resent', async () => {
    const system = fakeSystem(() => ({
      status: 200,
      body: manyCollections(5),
    }));
    const make = system.connection.makeAdtRequest.bind(system.connection);
    (system.connection as { makeAdtRequest: unknown }).makeAdtRequest = (
      request: IAbapRequestOptions,
    ) =>
      request.url === '/sap/bc/adt/communication/batch'
        ? Promise.reject(new Error('socket hang up'))
        : make(request);
    const { corpus } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    expect(
      system.seen.filter((s) => s.url !== '/sap/bc/adt/discovery'),
    ).toEqual([]);
    for (const r of corpus?.rows ?? [])
      expect(r.failure).toBe('envelope failed: socket hang up');
  });

  it('never resends a write', async () => {
    const bad = '/sap/bc/adt/probe/c2';
    const system = dumpingSystem(manyCollections(4, true), bad);
    const { corpus } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const posts = system.seen.filter(
      (s) => s.method === 'POST' && s.url.startsWith('/sap/bc/adt/probe/'),
    );
    // Each POST probe went out once, in the first envelope.
    expect(posts).toHaveLength(4);
    for (const r of corpus?.rows ?? [])
      if (r.endpoint?.method === 'POST')
        expect(r.failure).toBe('poisoned, not resent: write; after: absent');
  });
});

describe('the ledger holds every write before it is sent', () => {
  it('Ctrl-C during a write that creates: the read never goes, the finally still deletes', async () => {
    const interrupt = new Interrupt();
    let exists = false;
    const uri = `/sap/bc/adt/probe/things/${PROBE_NAME.toLowerCase()}`;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (
        request.method === 'POST' &&
        request.url === '/sap/bc/adt/probe/things'
      ) {
        exists = true;
        interrupt.stop();
        return { status: 201 };
      }
      if (request.url === uri)
        return exists ? { status: 200, body: PROBE_NAME } : { status: 404 };
      if (request.url === '/sap/bc/adt/deletion/delete') {
        exists = false;
        return { status: 200 };
      }
      return { status: 404 };
    });
    const { corpus } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt,
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
      sequential: true,
    });
    expect(corpus?.error).toBe('interrupted (SIGINT)');
    expect(exists).toBe(false);
    expect(corpus?.removals).toEqual([
      expect.objectContaining({ removed: true }),
    ]);
  });

  it('a read that fails after the write: the finally still deletes', async () => {
    let exists = false;
    const uri = `/sap/bc/adt/probe/things/${PROBE_NAME.toLowerCase()}`;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (
        request.method === 'POST' &&
        request.url === '/sap/bc/adt/probe/things'
      ) {
        exists = true;
        return { status: 201 };
      }
      if (request.url === uri)
        return exists ? { status: 500 } : { status: 404 };
      if (request.url === '/sap/bc/adt/deletion/delete') {
        exists = false;
        return { status: 200 };
      }
      return { status: 404 };
    });
    const { corpus } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const post = corpus?.rows.find((r) => r.endpoint?.method === 'POST');
    expect(post?.afterWrite?.exists).toBe('unknown');
    expect(exists).toBe(false);
    expect(corpus?.removals).toEqual([
      expect.objectContaining({ removed: true }),
    ]);
  });
});

describe('the logon is the authorization check', () => {
  it.each([
    // What the connection's connect() throws, measured against a local server.
    [
      401,
      Object.assign(new Error('the user or password was refused'), {
        cause: { status: 401 },
      }),
    ],
    [
      403,
      Object.assign(new Error('Request failed with status code 403'), {
        status: 403,
      }),
    ],
  ])('a %i at connect prints the Oops and sends nothing else', async (status, thrown) => {
    let opened = 0;
    const dir = tempDir();
    const { lines, out } = output();
    let asked = false;
    const result = await runCorpus({
      open: async () => {
        opened++;
        throw thrown;
      },
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: dir,
      clientOptions: async () => {
        asked = true;
        return {};
      },
      out,
    });
    expect(result.exitCode).toBe(2);
    expect(lines[lines.length - 1]).toBe(`Oops: no authorization (${status})`);
    expect(opened).toBe(1);
    expect(asked).toBe(false);
    // Nothing else was sent; the report is written, marked.
    expect(result.corpus.error).toBe(
      `stopped: authorization (${status}, logon) at logon`,
    );
    expect(fs.readdirSync(dir)).toHaveLength(2);
  });
});

describe('a poisoned write', () => {
  it('is read after, recorded `after: exists`, listed, and deleted by the cleanup', async () => {
    const bad = '/sap/bc/adt/probe/c2';
    const created = new Set<string>();
    let envelope: string[] = [];
    const document = manyCollections(3, true);
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: document };
      if (request.method === 'POST' && request.url === '/sap/bc/adt/probe/c1')
        created.add(`/sap/bc/adt/probe/c1/${PROBE_NAME.toLowerCase()}`);
      if (request.url === '/sap/bc/adt/deletion/delete') {
        created.clear();
        return { status: 200 };
      }
      if (request.part && envelope.includes(bad))
        return { status: 500, body: DUMP };
      if (created.has(request.url)) return { status: 200, body: PROBE_NAME };
      return request.url === bad
        ? { status: 500, body: DUMP }
        : { status: 404 };
    });
    const make = system.connection.makeAdtRequest.bind(system.connection);
    (system.connection as { makeAdtRequest: unknown }).makeAdtRequest = (
      request: IAbapRequestOptions,
    ) => {
      envelope =
        request.url === '/sap/bc/adt/communication/batch'
          ? String(request.data)
              .split('\r\n')
              .filter((line) => / HTTP\/1\.1$/.test(line))
              .map((line) => line.split(' ')[1])
          : [];
      return make(request);
    };
    const { corpus, files } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const post = corpus?.rows.find(
      (r) =>
        r.endpoint?.path === '/sap/bc/adt/probe/c1' &&
        r.endpoint.method === 'POST',
    );
    expect(post?.failure).toBe('poisoned, not resent: write; after: exists');
    expect(corpus?.splits?.[0].writesThatExist).toEqual([
      'POST /sap/bc/adt/probe/c1',
    ]);
    expect(created.size).toBe(0);
    expect(
      corpus?.removals.find((r) => r.label.includes('/probe/c1/')),
    ).toEqual(expect.objectContaining({ removed: true }));
    expect(fs.readFileSync(files[1], 'utf8')).toContain(
      'Poisoned writes whose object exists after them: POST /sap/bc/adt/probe/c1.',
    );
  });
});

describe('the full run', () => {
  it('phase 1 on the probe name, phase 2 on an existing object, one header corpus with the time of each phase', async () => {
    const real = 'CL_REAL_ONE';
    const classRead = `/sap/bc/adt/oo/classes/${real.toLowerCase()}`;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (
        request.url.startsWith(
          '/sap/bc/adt/repository/informationsystem/search',
        )
      )
        return {
          status: 200,
          body: `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:name="${real}" adtcore:type="CLAS/OC"/></adtcore:objectReferences>`,
        };
      // The real class checks Accept; the probe name is not found.
      if (request.url === classRead)
        return request.headers.accept === PROBE_TYPE
          ? {
              status: 406,
              body: NOT_ACCEPTABLE('application/vnd.sap.adt.oo.classes.v4+xml'),
            }
          : { status: 200, body: '<class/>' };
      return { status: 404 };
    });
    const dir = tempDir();
    const cycles: string[][] = [];
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: dir,
      clientOptions: async () => ({}),
      out: output().out,
      writeCycle: async ({ unknown }) => {
        cycles.push([...unknown]);
        return { evidence: [], removals: [] };
      },
      updateMeasure: async () => ({
        updates: [
          { type: 'class', member: 'update', status: 406, applied: true },
        ],
        removals: [],
      }),
    });
    expect(result.exitCode).toBe(0);
    const file = result.file as NonNullable<typeof result.file>;
    expect(file.phases.map((phase) => phase.name.split(':')[0])).toEqual([
      'phase 1',
      'phase 2',
      'phase 2',
      'phase 2',
    ]);
    expect(file.updates).toEqual([
      { type: 'class', member: 'update', status: 406, applied: true },
    ]);
    expect(file.totalMs).toBeGreaterThan(0);
    const entry = file.entries.find(
      (e) => e.endpoint === 'GET /sap/bc/adt/oo/classes/{name}',
    );
    expect(entry?.needs).toBe('accept');
    expect(entry?.settledBy).toBe('phase 2');
    expect(entry?.exists).toBe('yes');
    expect(entry?.namedAccept).toEqual([
      'application/vnd.sap.adt.oo.classes.v4+xml',
    ]);
    expect(file.counts.phase2.accept).toBeGreaterThan(
      file.counts.phase1.accept,
    );
    expect(file.objects).toContainEqual({
      handler: 'getClass()',
      type: 'CLAS',
      name: real,
    });
    // The writes still unknown went to the cycle, and only those.
    expect(cycles).toHaveLength(1);
    expect(cycles[0].every((key) => /— (POST|PUT|DELETE) /.test(key))).toBe(
      true,
    );
    // Phase 2 reads are GETs only: nothing written on the real object.
    expect(
      system.seen.some(
        (s) => s.url.includes(real.toLowerCase()) && s.method !== 'GET',
      ),
    ).toBe(false);
    const names = fs.readdirSync(dir);
    expect(names.some((n) => /^header-corpus-.*\.json$/.test(n))).toBe(true);
    expect(
      names.some((n) => /^corpus-clients-bogus-phase2-.*\.json$/.test(n)),
    ).toBe(true);
    expect(
      fs.readFileSync(result.files[result.files.length - 1], 'utf8'),
    ).toContain('| accept |');
    expect(
      fs.readFileSync(result.files[result.files.length - 1], 'utf8'),
    ).toContain('| class | update | 406 | yes |');
  });

  it('a 401 at the logon is the Oops, and nothing runs', async () => {
    const { lines, out } = output();
    const result = await runFull({
      open: async () => {
        throw Object.assign(new Error('refused'), { cause: { status: 401 } });
      },
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out,
    });
    expect(result.exitCode).toBe(2);
    expect(lines[lines.length - 1]).toBe('Oops: no authorization (401)');
    expect(result.file?.endedBy).toBe(
      'stopped: authorization (401, logon) at logon',
    );
  });
});

describe('the write cycle evidence', () => {
  it('judges the bad probes of the temporary objects, for the wanted members only', () => {
    const answer = (
      probe: 'known' | 'badAccept' | 'badContentType',
      status: number,
    ) => ({
      probe,
      sent: { accept: 'a', contentType: 'c' },
      mode: 'batched',
      requests: [{ method: 'POST', path: '/sap/bc/adt/oo/classes' }],
      status,
      supportedAccept:
        status === 406 ? ['application/vnd.sap.adt.oo.classes.v4+xml'] : [],
      supportedContentType: [],
    });
    const evidence = evidenceOfRows(
      [
        {
          objectType: 'class',
          member: 'create',
          probes: [
            answer('known', 201),
            answer('badContentType', 415),
            answer('badAccept', 406),
          ],
        },
        {
          objectType: 'class',
          member: 'check',
          probes: [answer('known', 200)],
        },
      ],
      new Set(['getClass().create']),
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].endpoint).toBe('POST /sap/bc/adt/oo/classes');
    expect(evidence[0].accept.verdict).toBe('checked');
    expect(evidence[0].contentType.verdict).toBe('checked');
    expect(evidence[0].namedAccept).toEqual([
      'application/vnd.sap.adt.oo.classes.v4+xml',
    ]);
  });
});

describe('a removal proves what it claims', () => {
  it('removed only on positive evidence; unreadable or a failed delete may remain', () => {
    expect(removalOutcome('absent', 403, 404, 'x').removed).toBe(true);
    expect(removalOutcome('not found', 200, 200, 'x').removed).toBe(true);
    expect(removalOutcome('not found', 403, 200, 'x').removed).toBe('unknown');
    expect(removalOutcome('unreadable', 200, 403, 'x').removed).toBe('unknown');
    expect(removalOutcome('unreadable', 403, 403, 'x').detail).toMatch(
      /^unknown 403: .*may remain$/,
    );
    expect(removalOutcome('exists', 200, 200, 'x').removed).toBe(false);
  });

  it('a discovery write whose reads and delete answer 403 is listed loudly as may remain', async () => {
    const uri = `/sap/bc/adt/probe/things/${PROBE_NAME.toLowerCase()}`;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (
        request.method === 'POST' &&
        request.url === '/sap/bc/adt/probe/things'
      )
        return { status: 201 };
      if (request.url === uri || request.url === '/sap/bc/adt/deletion/delete')
        return { status: 403 };
      return { status: 404 };
    });
    const { loud, out } = output();
    const { corpus, files } = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out,
    });
    expect(corpus?.removals).toEqual([
      expect.objectContaining({ removed: 'unknown' }),
    ]);
    expect(loud.join('\n')).toContain('could not be removed or may remain');
    expect(loud.join('\n')).toContain(`MAY REMAIN discovery: ${uri}`);
    expect(fs.readFileSync(files[1], 'utf8')).toContain('**MAY REMAIN**');
  });
});

describe('phase 2 writes', () => {
  it('probe only the members still unknown: the class update, its create as a prerequisite, the cleanup', async () => {
    const created = new Set<string>();
    const bogusSent: string[] = [];
    let locks = 0;
    let unlocks = 0;
    const system = fakeSystem((request) => {
      const { method, url } = request;
      if (Object.values(request.headers).includes(PROBE_TYPE))
        bogusSent.push(`${method} ${url.split('?')[0]}`);
      const name = url.split('/')[6]?.split('?')[0];
      if (method === 'POST' && url === '/sap/bc/adt/oo/classes') {
        const match = /adtcore:name="([^"]+)"/.exec(request.body);
        if (match) created.add(match[1].toLowerCase());
        return { status: 201 };
      }
      if (url.includes('_action=LOCK')) {
        locks++;
        return {
          status: 200,
          body: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
        };
      }
      if (url.includes('_action=UNLOCK')) {
        unlocks++;
        return { status: 200 };
      }
      if (url === '/sap/bc/adt/deletion/delete') {
        for (const n of [...created])
          if (request.body.toLowerCase().includes(n)) created.delete(n);
        return { status: 200, body: '<del:deletionResult/>' };
      }
      if (url.startsWith('/sap/bc/adt/oo/classes/') && name)
        return created.has(name.toLowerCase())
          ? {
              status: 200,
              body: url.includes('/source/main')
                ? 'CLASS x DEFINITION. ENDCLASS.'
                : `<class:abapClass adtcore:name="${name}" adtcore:version="inactive"/>`,
            }
          : { status: 404 };
      return { status: 200 };
    });
    const result = await runWriteCycle({
      connection: gate(system.connection, {}),
      clientOptions: {},
      interrupt: new Interrupt(),
      unknown: new Set([
        'getClass().update — PUT /sap/bc/adt/oo/classes/{name}/source/main',
      ]),
      packageName: 'ZPKG',
      transportRequest: '',
    });
    // The bogus headers went to the update alone.
    expect(bogusSent.length).toBeGreaterThan(0);
    expect(
      new Set(
        bogusSent.map((s) => s.replace(/classes\/[^/]+/, 'classes/{name}')),
      ),
    ).toEqual(new Set(['PUT /sap/bc/adt/oo/classes/{name}/source/main']));
    expect(locks).toBe(unlocks);
    expect(created.size).toBe(0);
    expect(result.removals.every((r) => r.removed === true)).toBe(true);
    expect(result.evidence.map((e) => e.who.split(' ')[0])).toEqual([
      'getClass().update',
    ]);
  });
});

describe('an authorization problem', () => {
  const exc = (type: string, message: string) =>
    `<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="${type}"/><message lang="EN">${message}</message></exc:exception>`;
  const wire = (
    status: number,
    data: string,
    headers: Record<string, string> = {},
  ) => ({
    status,
    data,
    headers,
  });

  it('is a 401, a CSRF refusal, or a 403 naming authorization — not a missing object or package', () => {
    expect(authorizationProblem(wire(401, ''))).toEqual({
      status: 401,
      kind: 'no SAP exception',
    });
    expect(
      authorizationProblem(wire(403, 'CSRF token validation failed')),
    ).toEqual({
      status: 403,
      kind: 'CSRF',
    });
    expect(
      authorizationProblem(wire(403, '', { 'x-csrf-token': 'Required' }))?.kind,
    ).toBe('CSRF');
    expect(
      authorizationProblem(
        wire(
          403,
          exc(
            'ExceptionResourceNoAuthorization',
            'You are not authorized to display this object',
          ),
        ),
      ),
    ).toEqual({ status: 403, kind: 'ExceptionResourceNoAuthorization' });
    // Measured 403s that are not the user's authorization:
    expect(
      authorizationProblem(
        wire(
          403,
          exc(
            'ExceptionNoToggleAuthorization',
            'Package failure occurs for toggle Z_HPEC_PROBE',
          ),
        ),
      ),
    ).toBeUndefined();
    expect(
      authorizationProblem(
        wire(
          403,
          exc(
            'ExceptionResourceNoAccess',
            'Tunnel is disabled in ATC settings.',
          ),
        ),
      ),
    ).toBeUndefined();
    expect(
      authorizationProblem(
        wire(
          403,
          exc(
            'ExceptionResourceCreationFailure',
            'Package Z_HPEC_NO_PACKAGE does not exist',
          ),
        ),
      ),
    ).toBeUndefined();
    expect(authorizationProblem(wire(404, ''))).toBeUndefined();
  });

  it('in the middle of phase 1 stops the run: no new probe, the cleanup runs, the Oops, exit 2, the files marked', async () => {
    const denied = '/sap/bc/adt/probe/c3';
    const document = manyCollections(6, true);
    let exists = false;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: document };
      if (request.url === denied)
        return {
          status: 403,
          body: exc(
            'ExceptionResourceNoAuthorization',
            'You are not authorized',
          ),
        };
      if (request.method === 'POST' && request.url === '/sap/bc/adt/probe/c1') {
        exists = true;
        return { status: 201 };
      }
      if (request.url === `/sap/bc/adt/probe/c1/${PROBE_NAME.toLowerCase()}`)
        return exists ? { status: 200, body: PROBE_NAME } : { status: 404 };
      if (request.url === '/sap/bc/adt/deletion/delete') {
        exists = false;
        return { status: 200 };
      }
      return { status: 404 };
    });
    const { lines, out } = output();
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out,
      // One probe (and its read) per envelope: the stop falls between envelopes.
      envelopeProbes: 1,
    });
    expect(result.exitCode).toBe(2);
    expect(lines[lines.length - 1]).toBe(
      `Oops: authorization problem (403, ExceptionResourceNoAuthorization) at GET ${denied} — fix it and run again`,
    );
    expect(result.corpus?.error).toBe(
      `stopped: authorization (403, ExceptionResourceNoAuthorization) at GET ${denied}`,
    );
    // Nothing after the refused probe.
    expect(
      system.seen.some((s) => s.url.startsWith('/sap/bc/adt/probe/c4')),
    ).toBe(false);
    // The cleanup ran: what the POST before it created is gone.
    expect(exists).toBe(false);
    expect(result.corpus?.removals).toContainEqual(
      expect.objectContaining({ removed: true }),
    );
    expect(fs.readFileSync(result.files[1], 'utf8')).toContain(
      'stopped: authorization',
    );
  });
});

describe('an authorization type decides first', () => {
  it('"not authorized to modify this package" with an authorization type is a stop', () => {
    expect(
      authorizationProblem({
        status: 403,
        data: AUTH_EXCEPTION(
          'ExceptionResourceNoAuthorization',
          'You are not authorized to modify this package',
        ),
        headers: {},
      }),
    ).toEqual({ status: 403, kind: 'ExceptionResourceNoAuthorization' });
    // A type that only mentions authorization is decided by its text.
    expect(
      authorizationProblem({
        status: 403,
        data: AUTH_EXCEPTION(
          'ExceptionNoToggleAuthorization',
          'Package failure occurs for toggle Z_HPEC_PROBE',
        ),
        headers: {},
      }),
    ).toBeUndefined();
  });
});

describe('a stop in any phase of the full run', () => {
  const full = (
    answer: (request: ISeen) => Answer,
    writeCycle?: Parameters<typeof runFull>[0]['writeCycle'],
    interrupt = new Interrupt(),
  ) => {
    const system = fakeSystem(answer);
    const dir = tempDir();
    const { lines, out } = output();
    return runFull({
      open: async () => system.connection,
      interrupt,
      outDir: dir,
      clientOptions: async () => ({}),
      out,
      ...(writeCycle ? { writeCycle } : {}),
    }).then((result) => ({ result, lines, dir, system }));
  };
  const denied = { status: 401 };
  const search = (request: ISeen) =>
    request.url.startsWith('/sap/bc/adt/repository/informationsystem/search')
      ? {
          status: 200,
          body: '<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:name="CL_REAL_ONE"/></adtcore:objectReferences>',
        }
      : undefined;

  it('at the first discovery read: the report, marked, exit 2', async () => {
    const { result, lines, dir } = await full(() => denied);
    expect(result.exitCode).toBe(2);
    expect(result.file?.error).toMatch(/^stopped: authorization \(401/);
    expect(result.file?.phases).toEqual([]);
    expect(lines[lines.length - 1]).toMatch(
      /^Oops: authorization problem \(401, .*\) at GET \/sap\/bc\/adt\/discovery/,
    );
    expect(
      fs.readdirSync(dir).some((n) => n.startsWith('header-corpus-')),
    ).toBe(true);
  });

  it("at a later run's discovery read: no later run, exit 2", async () => {
    let reads = 0;
    const { result, system } = await full((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return ++reads >= 3 ? denied : { status: 200, body: DISCOVERY };
      return { status: 404 };
    });
    expect(result.exitCode).toBe(2);
    expect(result.file?.error).toMatch(/^stopped: authorization \(401/);
    // The third read (the second run's) stopped it: no fourth.
    expect(
      system.seen.filter((s) => s.url === '/sap/bc/adt/discovery'),
    ).toHaveLength(3);
  });

  it('in phase 2 reads: the report, exit 2', async () => {
    const { result } = await full((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      const hit = search(request);
      if (hit) return hit;
      if (request.url.includes('cl_real_one')) return denied;
      return { status: 404 };
    });
    expect(result.exitCode).toBe(2);
    expect(result.file?.error).toMatch(/^stopped: authorization \(401/);
    expect(result.file?.phases.map((p) => p.name.split(':')[0])).toEqual([
      'phase 1',
      'phase 2',
    ]);
  });

  it('in phase 2 writes: the report, exit 2', async () => {
    const { result } = await full(
      (request) =>
        request.url === '/sap/bc/adt/discovery'
          ? { status: 200, body: DISCOVERY }
          : request.url === '/sap/bc/adt/write-denied'
            ? denied
            : { status: 404 },
      async ({ connection }) => {
        await traced(connection)
          .makeAdtRequest({
            url: '/sap/bc/adt/write-denied',
            method: 'POST',
            timeout: 0,
            data: 'x',
          })
          .catch(() => undefined);
        throw new Interrupted();
      },
    );
    expect(result.exitCode).toBe(2);
    expect(result.file?.error).toMatch(
      /^stopped: authorization \(401, .*\) at POST \/sap\/bc\/adt\/write-denied/,
    );
  });

  it('Ctrl-C in phase 2: the report, exit 130', async () => {
    const interrupt = new Interrupt();
    const { result } = await full(
      (request) =>
        request.url === '/sap/bc/adt/discovery'
          ? { status: 200, body: DISCOVERY }
          : { status: 404 },
      async () => {
        interrupt.stop();
        throw new Interrupted();
      },
      interrupt,
    );
    expect(result.exitCode).toBe(130);
    expect(result.file?.error).toBe('interrupted (SIGINT)');
  });
});

/** The source of every tools/header-probe file but the gate's own module, comments removed. */
function toolSources(): { file: string; text: string }[] {
  const dir = path.resolve(__dirname, '../../../../tools/header-probe');
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && name !== 'capture.ts')
    .map((name) => {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      // Block and line comments out: a comment may name what code may not do.
      let text = '';
      for (let i = 0; i < raw.length; i++) {
        if (raw.startsWith('/*', i)) {
          const end = raw.indexOf('*/', i + 2);
          i = end === -1 ? raw.length : end + 1;
          continue;
        }
        if (raw.startsWith('//', i) && raw[i - 1] !== ':') {
          const end = raw.indexOf('\n', i);
          i = end === -1 ? raw.length : end - 1;
          continue;
        }
        text += raw[i];
      }
      return { file: name, text };
    });
}

/** Every request in tools/header-probe goes through the gate (capture.ts): what a scan can see. */
function gateViolations(
  sources: readonly { file: string; text: string }[],
): string[] {
  const found: string[] = [];
  for (const { file, text } of sources) {
    const lines = text.split('\n');
    const say = (index: number, why: string) =>
      found.push(`${file}:${index + 1}: ${why}`);
    const tracedNames = new Set(
      [...text.matchAll(/const (\w+) = traced\(/g)].map((m) => m[1]),
    );
    for (const [index, line] of lines.entries()) {
      if (
        /\.makeAdtRequest\s*[(<]/.test(line) ||
        /makeAdtRequest\.(call|apply|bind)/.test(line)
      )
        say(
          index,
          'makeAdtRequest outside the gate (use send() on a gated or traced connection)',
        );
      if (/new\s+AdtBatchConnection\s*\(/.test(line))
        say(index, 'an envelope built outside the gate (runCalls builds it)');
      if (/\bgetSystemInformation\s*\(/.test(line))
        say(index, 'getSystemInformation outside the gate');
      for (const match of line.matchAll(/\bclientsOn\(\s*([\w.]*)/g)) {
        if (/export function clientsOn\(/.test(line)) continue;
        const argument = match[1];
        const next = argument ? argument : (lines[index + 1] ?? '').trim();
        if (!(next.startsWith('traced') || tracedNames.has(argument)))
          say(index, 'clientsOn on a connection that is not traced');
      }
      if (
        /new\s+Adt(Client|ClientLegacy|RuntimeClient|Executor|ExecutorLegacy|AbapGitClient)\s*\(/.test(
          line,
        )
      ) {
        const inClientsOn =
          file === 'members.ts' && /^\s+\w+: new Adt/.test(line);
        const inProbeClient =
          file === 'probe.ts' && /return new AdtClient\(connection,/.test(line);
        if (!inClientsOn && !inProbeClient)
          say(index, 'a client built outside clientsOn / Probe.client');
      }
      if (
        /\bresolveSystemContext\(/.test(line) &&
        !/\bimport\b|resolveSystemContext,$/.test(line)
      ) {
        const context = lines
          .slice(Math.max(0, index - 2), index + 1)
          .join(' ');
        if (
          !(
            /resolveSystemContext\(gated\b/.test(line) ||
            /clientOptions/.test(context)
          )
        )
          say(index, 'the system context read off the gate');
      }
      if (
        /\bcreateTestConnection\(/.test(line) &&
        !/\bimport\b|createTestConnection,$/.test(line)
      ) {
        const context = lines
          .slice(Math.max(0, index - 3), index + 1)
          .join(' ');
        if (!/\bopen\b|gateConnect\(/.test(context))
          say(index, 'a connection opened outside gateConnect');
      }
    }
  }
  return found;
}

describe('the gate', () => {
  it('is the one way any request leaves tools/header-probe', () => {
    expect(gateViolations(toolSources())).toEqual([]);
  });

  it('the scan sees a direct call', () => {
    const sources = [
      ...toolSources(),
      {
        file: 'added.ts',
        text: 'export const x = (c: any) => c.makeAdtRequest({ url: "/x" });\n',
      },
    ];
    expect(gateViolations(sources)).toEqual([
      'added.ts:1: makeAdtRequest outside the gate (use send() on a gated or traced connection)',
    ]);
  });

  it('traced, clientsOn and runCalls refuse a connection that is not gated', () => {
    const raw = fakeSystem(() => ({ status: 200 })).connection;
    expect(() => traced(raw)).toThrow(/does not send through the gate/);
    expect(() => clientsOn(raw)).toThrow(/does not send through the gate/);
    expect(() => traced(gate(raw, {}))).not.toThrow();
  });

  it('asks the interrupt before every request; its cleanup sibling does not', async () => {
    const system = fakeSystem(() => ({ status: 200 }));
    const interrupt = new Interrupt();
    const gated = gate(system.connection, { interrupt });
    interrupt.stop();
    expect(() =>
      gated.makeAdtRequest({ url: '/x', method: 'GET', timeout: 0 }),
    ).toThrow(Interrupted);
    await gated
      .cleanup()
      .makeAdtRequest({ url: '/x', method: 'GET', timeout: 0 });
    expect(system.seen.map((s) => s.url)).toEqual(['/x']);
  });
});

describe('the run decides its exit once, from its state', () => {
  it('the system context goes through the gate: a 401 there is the authorization stop', async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : request.url === '/sap/bc/adt/core/http/systeminformation'
          ? { status: 401 }
          : { status: 404 },
    );
    const { lines, out } = output();
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async (connection) => {
        // What resolveSystemContext does on cloud.
        await send(connection, {
          url: '/sap/bc/adt/core/http/systeminformation',
          method: 'GET',
          timeout: 0,
        }).catch(() => undefined);
        return {};
      },
      out,
    });
    expect(result.exitCode).toBe(2);
    expect(lines[lines.length - 1]).toMatch(
      /^Oops: authorization problem \(401, .*\) at GET \/sap\/bc\/adt\/core\/http\/systeminformation/,
    );
    expect(
      system.seen.some((s) => s.url.startsWith('/sap/bc/adt/probe/')),
    ).toBe(false);
  });

  it('Ctrl-C during the discovery read: the system context is not sent, exit 130, the report marked', async () => {
    const interrupt = new Interrupt();
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery') {
        interrupt.stop();
        return { status: 200, body: DISCOVERY };
      }
      return { status: 404 };
    });
    const result = await runCorpus({
      connection: system.connection,
      source: 'discovery',
      mode: 'none',
      interrupt,
      outDir: tempDir(),
      clientOptions: async (connection) => {
        await send(connection, {
          url: '/sap/bc/adt/core/http/systeminformation',
          method: 'GET',
          timeout: 0,
        });
        return {};
      },
      out: output().out,
    });
    expect(result.exitCode).toBe(130);
    expect(result.corpus.endedBy).toBe('interrupted (SIGINT)');
    expect(system.seen.map((s) => s.url)).toEqual(['/sap/bc/adt/discovery']);
  });

  it('a later discovery read that fails: exit 1, in the full report, no later run', async () => {
    let reads = 0;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return ++reads === 3
          ? { status: 500 }
          : { status: 200, body: DISCOVERY };
      return { status: 404 };
    });
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    expect(result.exitCode).toBe(1);
    expect(result.file?.endedBy).toBe(
      'failed: The discovery read answered 500 (discovery none)',
    );
    expect(
      system.seen.filter((s) => s.url === '/sap/bc/adt/discovery'),
    ).toHaveLength(3);
  });

  it.each([
    'single',
    'full',
  ] as const)('the first discovery read failing after Ctrl-C (%s run): exit 130, the report written', async (kind) => {
    const interrupt = new Interrupt();
    const system = fakeSystem(() => {
      interrupt.stop();
      return { status: 500 };
    });
    const dir = tempDir();
    const common = {
      interrupt,
      outDir: dir,
      clientOptions: async () => ({}),
      out: output().out,
    };
    const result =
      kind === 'single'
        ? await runCorpus({
            ...common,
            connection: system.connection,
            source: 'discovery',
            mode: 'none',
          })
        : await runFull({ ...common, open: async () => system.connection });
    expect(result.exitCode).toBe(130);
    expect(fs.readdirSync(dir).length).toBeGreaterThan(0);
  });
});

describe('the command', () => {
  it('npm run header:discovery is the error corpus; the old probe has no command', () => {
    const scripts = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../../package.json'),
        'utf8',
      ),
    ).scripts as Record<string, string>;
    expect(scripts['header:discovery']).toBe(
      'npx ts-node tools/header-probe/errorCorpus.ts',
    );
    expect(scripts['header:discovery:next']).toBeUndefined();
    expect(
      Object.values(scripts).some((command) =>
        command.includes('header-probe/probe.ts'),
      ),
    ).toBe(false);
    const probe = fs.readFileSync(
      path.resolve(__dirname, '../../../../tools/header-probe/probe.ts'),
      'utf8',
    );
    expect(probe.includes('require.main')).toBe(false);
  });
});

describe('--isolate', () => {
  it('sends alone from the start the calls an earlier run found poisoning; the rest batched, no split', async () => {
    const bad = '/sap/bc/adt/probe/c17';
    const once = async (isolate?: ReadonlySet<string>) => {
      const system = dumpingSystem(manyCollections(29), bad);
      const { corpus } = await runCorpus({
        connection: system.connection,
        source: 'discovery',
        mode: 'none',
        interrupt: new Interrupt(),
        outDir: tempDir(),
        clientOptions: async () => ({}),
        out: output().out,
        envelopeProbes: 29,
        ...(isolate ? { isolate } : {}),
      });
      return { corpus, system };
    };
    const first = await once();
    expect(first.corpus.splits?.[0].causes).toEqual([`GET ${bad}`]);
    const keys = isolationKeys([first.corpus]);
    const second = await once(keys);
    expect(second.corpus.splits).toEqual([]);
    expect(second.corpus.envelopes).toHaveLength(1);
    const row = second.corpus.rows.find((r) => r.endpoint?.path === bad);
    expect(row?.ran).toBe(
      'sequential: isolated: an earlier run found it poisoning its envelope (--isolate)',
    );
    expect(row?.status).toBe(500);
    for (const r of second.corpus.rows)
      if (r.endpoint?.path !== bad) {
        expect(r.ran).toBe('batched');
        expect(r.status).toBe(404);
      }
  });
});

describe('endpoint existence', () => {
  const r = (status: number | undefined, extra: Partial<ICorpusRow> = {}) =>
    row({ status, ...extra });
  it('no from a router 404, the ICF service missing, or a 405; yes from the resource; else unknown', () => {
    expect(
      existenceOf(r(404, { body: 'No suitable resource found' })).exists,
    ).toBe('no');
    expect(
      existenceOf(
        r(404, { body: '<html><title>Service cannot be reached</title>' }),
      ).exists,
    ).toBe('no');
    expect(
      existenceOf(r(405, { sapType: 'ExceptionMethodNotSupported' })).exists,
    ).toBe('no');
    // The resource said the object is missing: the endpoint is there.
    expect(
      existenceOf(r(404, { sapType: 'ExceptionResourceNotFound' })).exists,
    ).toBe('yes');
    for (const status of [200, 400, 406, 415, 409])
      expect(existenceOf(r(status)).exists).toBe('yes');
    expect(existenceOf(r(500, { body: 'dump' })).exists).toBe('unknown');
    expect(existenceOf(r(401)).exists).toBe('unknown');
    expect(existenceOf(r(undefined, { failure: 'x' })).exists).toBe('unknown');
  });

  it('per endpoint: any answer from the resource wins; every row is kept', () => {
    const rows = [
      r(405, { endpoint: { method: 'GET', path: '/a' } }),
      r(406, { endpoint: { method: 'GET', path: '/a' } }),
      // A later "no" does not undo an earlier "yes".
      r(405, { endpoint: { method: 'GET', path: '/a' } }),
      r(405, { endpoint: { method: 'POST', path: '/a' } }),
      r(500, { endpoint: { method: 'GET', path: '/b' } }),
    ];
    const by = existencePerEndpoint(rows);
    expect(by.get('GET /a')?.exists).toBe('yes');
    expect(by.get('POST /a')).toEqual({
      exists: 'no',
      reason: '405 method not implemented',
    });
    expect(by.get('GET /b')?.exists).toBe('unknown');
    expect(rows).toHaveLength(5);
  });
});

describe('the output folder', () => {
  it('defaults, as the auth chain keeps its sessions, to ~/.config on Linux and macOS and Documents on Windows, per system', () => {
    const target = { url: 'http://127.0.0.1:8000', client: '100' };
    expect(
      defaultOutputDir({ platform: 'linux', home: '/home/u', ...target }),
    ).toBe(
      '/home/u/.config/mcp-abap-adt-clients/header-probe/127.0.0.1-8000-100',
    );
    expect(
      defaultOutputDir({ platform: 'darwin', home: '/Users/u', ...target }),
    ).toBe(
      '/Users/u/.config/mcp-abap-adt-clients/header-probe/127.0.0.1-8000-100',
    );
    expect(
      defaultOutputDir({ platform: 'win32', home: 'C:\\Users\\u', ...target }),
    ).toBe(
      'C:\\Users\\u\\Documents\\mcp-abap-adt-clients\\header-probe\\127.0.0.1-8000-100',
    );
  });

  it('names the system folder from host and client, lowercased, the rest replaced', () => {
    expect(systemFolder('https://My.Host.example:44300/sap', '001')).toBe(
      'my.host.example-44300-001',
    );
    expect(systemFolder(undefined, undefined)).toBe('unknown-system');
  });

  it('--out overrides the whole path; absolute and created', () => {
    const chosen = path.join(tempDir(), 'nested', 'out');
    expect(outputDir(chosen)).toBe(chosen);
    expect(fs.existsSync(chosen)).toBe(true);
    const relative = path.relative(process.cwd(), path.join(tempDir(), 'rel'));
    expect(path.isAbsolute(outputDir(relative))).toBe(true);
  });
});

describe('the update measurement', () => {
  const classSystem = (applies: boolean) => {
    const sources = new Map<string, string>();
    let locks = 0;
    let unlocks = 0;
    const system = fakeSystem((request) => {
      const { method, url } = request;
      const name = url.split('/')[6]?.split('?')[0]?.toLowerCase();
      if (method === 'POST' && url === '/sap/bc/adt/oo/classes') {
        const match = /adtcore:name="([^"]+)"/.exec(request.body);
        if (match)
          sources.set(match[1].toLowerCase(), 'CLASS x DEFINITION. ENDCLASS.');
        return { status: 201 };
      }
      if (url.includes('_action=LOCK')) {
        locks++;
        return {
          status: 200,
          body: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
        };
      }
      if (url.includes('_action=UNLOCK')) {
        unlocks++;
        return { status: 200 };
      }
      if (url === '/sap/bc/adt/deletion/delete') {
        for (const n of [...sources.keys()])
          if (request.body.toLowerCase().includes(n)) sources.delete(n);
        return { status: 200 };
      }
      if (name && url.startsWith('/sap/bc/adt/oo/classes/')) {
        if (!sources.has(name)) return { status: 404 };
        if (method === 'PUT') {
          if (applies) sources.set(name, request.body);
          return { status: 406, body: NOT_ACCEPTABLE('text/plain') };
        }
        return url.includes('/source/main')
          ? { status: 200, body: sources.get(name) ?? '' }
          : { status: 200, body: `<class:abapClass adtcore:name="${name}"/>` };
      }
      return { status: 404 };
    });
    return { system, sources, counts: () => ({ locks, unlocks }) };
  };

  it.each([
    [true, true],
    [false, false],
  ])('an update the system applies despite its 406 (%s) is recorded applied: %s; unlocked, cleaned, no content kept', async (applies, applied) => {
    const { system, sources, counts } = classSystem(applies);
    const result = await measureUpdates({
      connection: gate(system.connection, {}),
      clientOptions: {},
      interrupt: new Interrupt(),
      packageName: 'ZPKG',
      transportRequest: '',
      only: ['class'],
    });
    expect(result.updates).toEqual([
      expect.objectContaining({
        type: 'class',
        member: 'update',
        status: 406,
        applied,
      }),
    ]);
    expect(counts().locks).toBe(1);
    expect(counts().unlocks).toBe(1);
    expect(sources.size).toBe(0);
    expect(result.removals.every((r) => r.removed === true)).toBe(true);
    // Hashes only: neither content reaches the record.
    expect(JSON.stringify(result)).not.toContain('error corpus update');
    expect(JSON.stringify(result)).not.toContain('ENDCLASS');
    // The update went with the bogus Accept.
    const put = system.seen.find((s) => s.method === 'PUT');
    expect(put?.headers.accept).toBe(PROBE_TYPE);
  });
});

describe('a failed unlock', () => {
  const run = (unlockAnswers: number[]) => {
    // The class system of the update measurement, its UNLOCK answering as told.
    const sources = new Map<string, string>();
    let unlocks = 0;
    const system = fakeSystem((request) => {
      const { method, url } = request;
      const name = url.split('/')[6]?.split('?')[0]?.toLowerCase();
      if (method === 'POST' && url === '/sap/bc/adt/oo/classes') {
        const match = /adtcore:name="([^"]+)"/.exec(request.body);
        if (match)
          sources.set(match[1].toLowerCase(), 'CLASS x DEFINITION. ENDCLASS.');
        return { status: 201 };
      }
      if (url.includes('_action=LOCK'))
        return {
          status: 200,
          body: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
        };
      if (url.includes('_action=UNLOCK')) {
        unlocks++;
        return { status: unlockAnswers.shift() ?? 200 };
      }
      if (url === '/sap/bc/adt/deletion/delete') {
        for (const n of [...sources.keys()])
          if (request.body.toLowerCase().includes(n)) sources.delete(n);
        return { status: 200 };
      }
      if (name && url.startsWith('/sap/bc/adt/oo/classes/')) {
        if (!sources.has(name)) return { status: 404 };
        if (method === 'PUT')
          return { status: 406, body: NOT_ACCEPTABLE('text/plain') };
        return url.includes('/source/main')
          ? { status: 200, body: sources.get(name) ?? '' }
          : { status: 200, body: `<class:abapClass adtcore:name="${name}"/>` };
      }
      return { status: 404 };
    });
    return measureUpdates({
      connection: gate(system.connection, {}),
      clientOptions: {},
      interrupt: new Interrupt(),
      packageName: 'ZPKG',
      transportRequest: '',
      only: ['class'],
    }).then((result) => ({ result, unlocks: () => unlocks, sources, system }));
  };

  it('fails the run, keeps its handle, and the cleanup unlocks again before it deletes', async () => {
    const { result, unlocks, sources, system } = await run([500]);
    expect(result.error).toMatch(
      /^unlock failed: class .*: the unlock answered 500/,
    );
    expect(unlocks()).toBe(2);
    const locked = result.removals.find((r) =>
      r.label.startsWith('(locked) class'),
    );
    expect(locked).toEqual(expect.objectContaining({ removed: true }));
    // The unlock came before the deletion.
    const order = system.seen
      .filter(
        (s) =>
          s.url.includes('_action=UNLOCK') ||
          s.url === '/sap/bc/adt/deletion/delete',
      )
      .map((s) => (s.url.includes('UNLOCK') ? 'unlock' : 'delete'));
    expect(order).toEqual(['unlock', 'unlock', 'delete']);
    expect(sources.size).toBe(0);
  });

  it('still refused in the cleanup: MAY REMAIN (locked)', async () => {
    const { result } = await run([500, 500]);
    const locked = result.removals.find((r) =>
      r.label.startsWith('(locked) class'),
    );
    expect(locked?.removed).toBe('unknown');
    expect(locked?.detail).toMatch(
      /^MAY REMAIN \(locked\): the unlock answered 500 again/,
    );
  });

  it('ends the full run failed: exit 1', async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : { status: 404 },
    );
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
      updateMeasure: async () => ({
        updates: [],
        removals: [
          {
            label: '(locked) class Z',
            removed: 'unknown',
            detail: 'MAY REMAIN (locked): x',
          },
        ],
        error: 'unlock failed: class Z: the unlock answered 500',
      }),
    });
    expect(result.exitCode).toBe(1);
    expect(result.file?.endedBy).toBe(
      'failed: unlock failed: class Z: the unlock answered 500',
    );
  });
});

describe('every phase counts', () => {
  it('a resource answer of the write cycle or the update measurement settles exists, and the update its Accept', async () => {
    let n = 0;
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : { status: 500, body: `dump ${n++}` },
    );
    const update = {
      method: 'PUT',
      path: '/sap/bc/adt/oo/classes/{name}/source/main',
    };
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
      writeCycle: async () => ({
        evidence: [],
        rows: [
          row({
            endpoint: { method: 'POST', path: '/sap/bc/adt/oo/classes' },
            status: 415,
          }),
        ],
        removals: [],
      }),
      updateMeasure: async () => ({
        updates: [
          { type: 'class', member: 'update', status: 406, applied: false },
        ],
        rows: [
          row({
            endpoint: update,
            status: 406,
            sapType: 'ExceptionResourceNotAcceptable',
            body: '<exc:exception><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">044</entry></properties></exc:exception>',
          }),
        ],
        removals: [],
      }),
    });
    const of = (endpoint: string) =>
      result.file?.entries.find((e) => e.endpoint === endpoint);
    // Phase 1 saw only 500s on these.
    expect(of('PUT /sap/bc/adt/oo/classes/{name}/source/main')?.exists).toBe(
      'yes',
    );
    expect(
      of('PUT /sap/bc/adt/oo/classes/{name}/source/main')?.accept.verdict,
    ).toBe('checked');
    expect(of('POST /sap/bc/adt/oo/classes')?.exists).toBe('yes');
  });
});

describe('knownWorking', () => {
  it("reads an endpoint whose 406 named nothing on an existing object, with the client's own headers, and records what worked", async () => {
    const real = 'CL_REAL_ONE';
    const probeRead = `/sap/bc/adt/oo/classes/${PROBE_NAME.toLowerCase()}`;
    const realRead = `/sap/bc/adt/oo/classes/${real.toLowerCase()}`;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: DISCOVERY };
      if (
        request.url.startsWith(
          '/sap/bc/adt/repository/informationsystem/search',
        )
      )
        return {
          status: 200,
          body: `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:name="${real}"/></adtcore:objectReferences>`,
        };
      // On the probe name a bogus Accept gets a 406 that names nothing.
      if (request.url === probeRead)
        return request.headers.accept === PROBE_TYPE
          ? {
              status: 406,
              body: AUTH_EXCEPTION(
                'ExceptionResourceNotAcceptable',
                'The message content is not acceptable',
              ),
            }
          : { status: 404 };
      if (request.url === realRead)
        return request.headers.accept === PROBE_TYPE
          ? { status: 406 }
          : { status: 200, body: '<class/>' };
      return { status: 404 };
    });
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const entry = result.file?.entries.find(
      (e) => e.endpoint === 'GET /sap/bc/adt/oo/classes/{name}',
    );
    expect(entry?.needs).toBe('accept');
    expect(entry?.namedAccept).toEqual([]);
    expect(entry?.workingAccept.length).toBeGreaterThan(0);
    expect(
      entry?.knownWorking.some((text) => text.endsWith('→ 200 (works)')),
    ).toBe(true);
    // The corpus-mode read on the real object went with the client's own Accept.
    const corpusRead = system.seen.find(
      (s) =>
        s.url === realRead &&
        s.headers.accept &&
        s.headers.accept !== PROBE_TYPE,
    );
    expect(corpusRead).toBeDefined();
  });
});

describe('stand-in arguments', () => {
  it('spots a parameter a stand-in produced', () => {
    expect(
      standInParameters([
        { url: '/x?query=undefined&objectType=program&maxResults=1' },
        {
          url: '/y?objectType=PROG/P&lockHandle=H',
          params: { profilerId: undefined },
        },
      ]),
    ).toEqual([
      'query=undefined',
      'objectType=program',
      'profilerId=undefined',
    ]);
  });

  it('the search goes as a real call does; what still carries a stand-in is marked', async () => {
    const { members } = await recordMembers();
    const of = (handler: string, member: string) =>
      members.find((m) => m.handler === handler && m.member === member);
    expect(of('getUtils()', 'search')?.standIn).toBeUndefined();
    expect(of('getProgram()', 'update')?.standIn).toBeUndefined();
    const marked = members
      .filter((m) => m.standIn && !m.skipped)
      .map((m) => `${m.handler}.${m.member}: ${m.standIn?.join(', ')}`);
    // Left marked: a profiler id the system assigns; a service version the
    // service binding's internal publish helpers take positionally.
    expect(marked).toEqual([
      'getServiceBinding().publishByServiceType: serviceversion=undefined',
      'getServiceBinding().unpublishByServiceType: serviceversion=undefined',
      'getClassExecutor().runWithProfiler: profilerId=undefined',
      'getProgramExecutor().runWithProfiler: profilerId=undefined',
      'legacy getClassExecutor().runWithProfiler: profilerId=undefined',
      'legacy getProgramExecutor().runWithProfiler: profilerId=undefined',
    ]);
  });
});

describe('a 406 with T100 SADT_RESOURCE 037', () => {
  const exc037 =
    '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNotAcceptable"/><message lang="EN">The message content is not acceptable</message><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">037</entry></properties></exc:exception>';
  const exc044 =
    '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace id="com.sap.adt"/><type id="ExceptionResourceNotAcceptable"/><message lang="EN">The message content is not acceptable. Accepted content types: application/xml</message><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">044</entry></properties></exc:exception>';
  const bogus406 = (label: string, body: string) =>
    row({
      label,
      bogus: 'accept',
      status: 406,
      body,
      named: {
        ...emptyNamed(),
        ...(body === exc044
          ? { acceptedText: 'Accepted content types: application/xml' }
          : {}),
      },
    });
  it('is unknown — unless another Accept on the same endpoint got a 2xx or a 404; 044 is checked', () => {
    const needs = Object.fromEntries(
      classifyNeeds(
        [
          bogus406('g', exc037),
          bogus406('c', exc037),
          bogus406('f', exc044),
          bogus406('n', exc037),
        ],
        [
          // The client's own Accept (corpus) got a 404 here: the contrast.
          row({
            label: 'c',
            status: 404,
            sapType: 'ExceptionResourceNotFound',
          }),
          // And here every Accept got 037: no contrast.
          row({ label: 'n', status: 406, body: exc037 }),
        ],
      ).map((entry) => [entry.endpoint.split('.')[1].split(' ')[0], entry]),
    );
    expect(needs.g.needs).toBe('unknown');
    expect(needs.g.accept.reason).toBe(
      '406 generic (T100 037): not necessarily the Accept',
    );
    expect(needs.c.needs).toBe('accept');
    expect(needs.c.detail).toContain(
      'checked (037, inferred from the contrast)',
    );
    expect(needs.f.needs).toBe('accept');
    expect(needs.n.needs).toBe('unknown');
    expect(t100Of(exc037)).toEqual({ id: 'SADT_RESOURCE', no: '037' });
  });
});

describe('the write cycle verdicts', () => {
  it('judge a bad probe that carries no named lists (a 406/037 included)', () => {
    const body =
      '<exc:exception><properties><entry key="T100KEY-ID">SADT_RESOURCE</entry><entry key="T100KEY-NO">037</entry></properties></exc:exception>';
    const answer = {
      probe: 'badAccept' as const,
      sent: { accept: 'a', contentType: 'c' },
      mode: 'batched',
      requests: [],
      status: 406,
      body,
      supportedAccept: [],
      supportedContentType: [],
    };
    expect(verdictOf(answer, 406).verdict).toBe('unknown');
    expect(
      verdictOf(
        { ...answer, body: 'Accepted content types: application/xml' },
        406,
      ).verdict,
    ).toBe('checked');
  });
});

const t100Body = (id: string, no: string) =>
  `<exc:exception><properties><entry key="T100KEY-ID">${id}</entry><entry key="T100KEY-NO">${no}</entry></properties></exc:exception>`;

describe('a 406 is checked only when it names the Accept', () => {
  it('T100 044 or a list: checked; 037, another T100 or none: unknown with its T100', () => {
    const at = (extra: Partial<ICorpusRow>) =>
      judge(row({ bogus: 'accept', status: 406, ...extra }), 406);
    expect(at({ body: t100Body('SADT_RESOURCE', '044') }).verdict).toBe(
      'checked',
    );
    expect(
      at({ named: { ...emptyNamed(), supportedAccept: ['application/a+xml'] } })
        .verdict,
    ).toBe('checked');
    expect(
      at({
        named: {
          ...emptyNamed(),
          acceptedText: 'Accepted content types: application/a+xml',
        },
      }).verdict,
    ).toBe('checked');
    expect(at({})).toEqual({
      verdict: 'unknown',
      status: 406,
      reason: '406 without a list (no T100): not necessarily the Accept',
      unnamed406: true,
    });
    expect(at({ body: t100Body('SADT_RESOURCE', '037') }).reason).toBe(
      '406 generic (T100 037): not necessarily the Accept',
    );
    expect(at({ body: t100Body('SWB_TOOL', '012') })).toEqual({
      verdict: 'unknown',
      status: 406,
      reason:
        '406 without a list (T100 SWB_TOOL 012): not necessarily the Accept',
      unnamed406: true,
    });
  });

  it('an unnamed 406 is checked by contrast in classifyNeeds, with its T100 in the reason', () => {
    const needs = classifyNeeds(
      [row({ label: 'q', bogus: 'accept', status: 406 })],
      [row({ label: 'q', status: 200 })],
    );
    expect(needs[0].accept).toEqual({
      verdict: 'checked',
      status: 406,
      reason: '406 without a list (no T100), inferred from the contrast',
    });
  });
});

describe('the contrast on the write cycle and the update measurement', () => {
  const answer = (
    probe: 'known' | 'badAccept' | 'badContentType',
    status: number,
  ) => ({
    probe,
    sent: { accept: 'a', contentType: 'c' },
    mode: 'batched',
    requests: [
      { method: 'PUT', path: '/sap/bc/adt/oo/classes/{name}/source/main' },
    ],
    status,
    ...(status === 406 ? { body: t100Body('SADT_RESOURCE', '037') } : {}),
    supportedAccept: [],
    supportedContentType: [],
  });
  const cycle = (known: number) =>
    evidenceOfRows(
      [
        {
          objectType: 'class',
          member: 'update',
          probes: [answer('known', known), answer('badAccept', 406)],
        },
      ],
      new Set(['getClass().update']),
    )[0];

  it('the cycle: a 406/037 to the bogus Accept beside a 2xx or a 404 to the known one is checked', () => {
    expect(cycle(200).accept).toEqual({
      verdict: 'checked',
      status: 406,
      reason: '037, inferred from the contrast',
    });
    expect(cycle(404).accept.verdict).toBe('checked');
    expect(cycle(500).accept.verdict).toBe('unknown');
  });

  it('phase 2 evidence: an unnamed 406 is checked when another row of the endpoint got a 2xx or a 404 without the bogus Accept', () => {
    const endpoint = 'PUT /sap/bc/adt/oo/classes/{name}/source/main';
    const path = '/sap/bc/adt/oo/classes/{name}/source/main';
    const item = {
      endpoint,
      source: 'clients' as const,
      phase: 2 as const,
      who: 'getClass().update (update measurement, temporary object)',
      accept: judge(
        row({
          bogus: 'accept',
          status: 406,
          body: t100Body('SADT_RESOURCE', '037'),
        }),
        406,
      ),
      contentType: { verdict: 'unknown' as const, reason: 'x' },
      namedAccept: [],
      namedContentType: [],
      text: 'x',
    };
    const known = row({ endpoint: { method: 'PUT', path }, status: 200 });
    expect(withContrast([item], [known])[0].accept.verdict).toBe('checked');
    // The bogus Accept's own 2xx elsewhere is no contrast.
    expect(
      withContrast([item], [{ ...known, bogus: 'accept' }])[0].accept.verdict,
    ).toBe('unknown');
    // A refused answer is no contrast.
    expect(
      withContrast([item], [{ ...known, status: 500 }])[0].accept.verdict,
    ).toBe('unknown');
  });

  it("a full run: the update measurement's 406/037 is checked by the write cycle's known answer", async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : { status: 500, body: 'dump' },
    );
    const update = {
      method: 'PUT',
      path: '/sap/bc/adt/oo/classes/{name}/source/main',
    };
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
      writeCycle: async () => ({
        evidence: [],
        rows: [row({ endpoint: update, status: 200 })],
        removals: [],
      }),
      updateMeasure: async () => ({
        updates: [
          { type: 'class', member: 'update', status: 406, applied: false },
        ],
        rows: [
          row({
            endpoint: update,
            bogus: 'accept',
            status: 406,
            body: t100Body('SADT_RESOURCE', '037'),
          }),
        ],
        removals: [],
      }),
    });
    const entry = result.file?.entries.find(
      (e) => e.endpoint === 'PUT /sap/bc/adt/oo/classes/{name}/source/main',
    );
    expect(entry?.accept.verdict).toBe('checked');
  });
});

describe('a list counts only with a type after the marker', () => {
  it('a bare marker without T100 044 is unknown; T100 044 is checked with an empty list too', () => {
    const at = (extra: Partial<ICorpusRow>) =>
      judge(row({ bogus: 'accept', status: 406, ...extra }), 406).verdict;
    const bare =
      '<exc:exception><message lang="EN">Accepted content types:</message></exc:exception>';
    expect(at({ body: bare })).toBe('unknown');
    expect(
      at({
        named: { ...emptyNamed(), acceptedText: 'Accepted content types: ' },
      }),
    ).toBe('unknown');
    expect(
      at({
        body: `${t100Body('SADT_RESOURCE', '044')}${bare}`,
        named: { ...emptyNamed(), acceptedText: 'Accepted content types:' },
      }),
    ).toBe('checked');
    expect(
      at({
        body: '<exc:exception><message lang="EN">Accepted content types: application/a+xml</message></exc:exception>',
      }),
    ).toBe('checked');
  });
});

describe('the final contrast takes every source and phase', () => {
  it("discovery's unnamed 406 is checked by the client's known 200 on the endpoint, its bogus probe a 500", async () => {
    const discovery = DISCOVERY.replace(
      '/sap/bc/adt/probe/things',
      '/sap/bc/adt/oo/classes',
    );
    const generic =
      '<exc:exception><type id="ExceptionResourceNotAcceptable"/><message lang="EN">The message content is not acceptable</message></exc:exception>';
    // Discovery runs first; the clients start with their known Accept.
    let clients = false;
    const system = fakeSystem((request) => {
      if (request.url === '/sap/bc/adt/discovery')
        return { status: 200, body: discovery };
      if (request.method !== 'POST' || request.url !== '/sap/bc/adt/oo/classes')
        return { status: 500, body: 'dump' };
      const accept = request.headers.accept;
      if (accept === 'application/vnd.sap.adt.oo.classes.v4+xml') {
        clients = true;
        return { status: 200, body: '' };
      }
      if (accept === PROBE_TYPE && !clients)
        return { status: 406, body: generic };
      return { status: 500, body: 'dump' };
    });
    const result = await runFull({
      open: async () => system.connection,
      interrupt: new Interrupt(),
      outDir: tempDir(),
      clientOptions: async () => ({}),
      out: output().out,
    });
    const entry = result.file?.entries.find(
      (e) => e.endpoint === 'POST /sap/bc/adt/oo/classes',
    );
    expect(entry?.accept).toMatchObject({
      verdict: 'checked',
      reason: '406 without a list (no T100), inferred from the contrast',
    });
  });
});
