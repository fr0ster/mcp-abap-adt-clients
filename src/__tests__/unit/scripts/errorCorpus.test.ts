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
  type ICapture,
  onTheWire,
  runCalls,
  traced,
} from '../../../../tools/header-probe/capture';
import {
  classifyNeeds,
  discoveryProbes,
  emptyNamed,
  headerShape,
  type ICorpus,
  type ICorpusRow,
  namedPerEndpoint,
  needsLines,
  notSent,
  PROBE_NAME,
  parseDiscovery,
  refusedCorpusPairs,
  renderCorpusMarkdown,
  renderNamedSummary,
  stats,
  wireNote,
} from '../../../../tools/header-probe/corpus';
import { runCorpus } from '../../../../tools/header-probe/corpusRun';
import { Interrupt } from '../../../../tools/header-probe/ledger';
import {
  clientsOn,
  DEBUGGERS,
  handlerSpecs,
  prototypeMembers,
  recordingConnection,
  recordMembers,
} from '../../../../tools/header-probe/members';
import {
  KNOWN_PAIRS,
  LEGACY_PAIRS,
} from '../../../../tools/header-probe/pairs';
import { PROBE_TYPE } from '../../../../tools/header-probe/record';

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

describe('the authorization check', () => {
  it.each([
    401, 403,
  ])('stops at %i with the Oops, exit 2, and sends nothing more', async (status) => {
    const system = fakeSystem(() => ({ status }));
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
    expect(lines).toEqual([`Oops: no authorization (${status})`]);
    expect(system.seen).toHaveLength(1);
    expect(system.seen[0].url).toBe('/sap/bc/adt/discovery');
    expect(asked).toBe(false);
    expect(fs.readdirSync(dir)).toEqual([]);
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
    expect(lines).toEqual(['The discovery read answered 500']);
    expect(system.seen).toHaveLength(1);
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
      const shaped = traced(connection, { shape: headerShape('none', false) });
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
      bogusRow('b', 'accept', 406),
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
        row({ ...base, bogus: 'accept', status: 406 }),
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
      '| POST /sap/bc/adt/probe/things | Content-Type application/vnd.probe.thing+xml | application/vnd.probe.result+xml |  |  | application/vnd.probe.thing+xml | both (Accept: checked (406); Content-Type: checked (415)) |',
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
        expect(r.failure).toBe('poisoned, not resent: write');
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
    expect(lines).toEqual([`Oops: no authorization (${status})`]);
    expect(opened).toBe(1);
    expect(asked).toBe(false);
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
