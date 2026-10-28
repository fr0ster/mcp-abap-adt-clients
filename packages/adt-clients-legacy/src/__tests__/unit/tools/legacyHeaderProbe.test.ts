/**
 * The header probe's legacy half (`tools/header-probe/legacyClients.ts`,
 * `legacyPairs.ts`), run on the root package's probe as a registered client
 * set: these are the root `errorCorpus.test.ts`'s legacy assertions, moved
 * with it. The fake system is that file's.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { gate } from '../../../../../adt-clients/tools/header-probe/capture';
import { runCorpus } from '../../../../../adt-clients/tools/header-probe/corpusRun';
import {
  Interrupt,
  Ledger,
} from '../../../../../adt-clients/tools/header-probe/ledger';
import { recordMembers } from '../../../../../adt-clients/tools/header-probe/members';
import { coverageOf } from '../../../../../adt-clients/tools/header-probe/objectRun';
import { OBJECT_SPECS } from '../../../../../adt-clients/tools/header-probe/objects';
import { Probe } from '../../../../../adt-clients/tools/header-probe/probe';
import { readState } from '../../../../../adt-clients/tools/header-probe/record';
import { registerLegacyClients } from '../../../../tools/header-probe/legacyClients';
import { LEGACY_PAIRS } from '../../../../tools/header-probe/legacyPairs';

registerLegacyClients();

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

describe('the clients source, the legacy clients included', () => {
  let recorded: Awaited<ReturnType<typeof recordMembers>>;
  beforeAll(async () => {
    recorded = await recordMembers();
  });
  const find = (handler: string, member: string) =>
    recorded.members.find((m) => m.handler === handler && m.member === member);

  it("lists a legacy member it cannot record with the base member's reason", () => {
    expect(find('legacy getClassExecutor()', 'scheduleTrace')?.skipped).toMatch(
      /^skipped: the server assigns/,
    );
  });

  it('has a row for every legacy pair: probed, or skipped with its reason', () => {
    const has = (handler: string, member: string) =>
      recorded.members.find(
        (m) =>
          m.handler === handler &&
          m.member === member &&
          (m.call !== undefined || /^skipped: \S/.test(m.skipped ?? '')),
      );
    const missing = LEGACY_PAIRS.filter(
      (pair) => !has(pair.handler, pair.member),
    ).map((pair) => `${pair.handler}.${pair.member}`);
    expect(missing).toEqual([]);
    expect(
      recorded.members.some((m) => m.handler === 'legacy getClass()'),
    ).toBe(true);
  });

  it("takes a legacy member's pair from the legacy table", () => {
    expect(find('legacy getClass()', 'delete')?.pair).toEqual({
      accept: 'application/xml',
      contentType: 'application/xml',
    });
  });
});

describe('where a legacy member runs', () => {
  const at = (handler: string, member: string, path = '/sap/bc/adt/x/{name}') =>
    coverageOf({ handler, member, requests: [{ method: 'GET', path }] });

  it("an object handler member on the base handler's temporary object", () => {
    expect(
      at('legacy getClass()', 'delete', '/sap/bc/adt/deletion/delete'),
    ).toEqual({ kind: 'object', type: 'class' });
  });

  it('what cannot be made and removed cleanly is not coverable', () => {
    const coverage = at('legacy getRequest()', 'list');
    expect(coverage.kind).toBe('not coverable');
  });
});

describe('a clients run with the legacy clients', () => {
  it("shares the base handler's ledger entry for a legacy write, and removes everything", async () => {
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
    expect(result.corpus?.rows.some((r) => r.group.startsWith('legacy '))).toBe(
      true,
    );
    expect(
      result.corpus?.removals.some((r) =>
        r.label.startsWith('clients: legacy '),
      ),
    ).toBe(false);
    expect(result.corpus?.removals.every((r) => r.removed)).toBe(true);
  });
});

describe('the temporary objects on a legacy system', () => {
  const LOCKED =
    '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>';
  const ddl = OBJECT_SPECS.find((spec) => spec.type === 'ddl');
  if (!ddl) throw new Error('no ddl spec');

  /** A 7.40 system holding one DDL source: only a delete under its lock removes it; the deletion endpoint answers 404, an unknown path 200 empty. */
  const system = () => {
    let there = true;
    let locked = false;
    const fake = fakeSystem((request) => {
      const { method, url } = request;
      if (url.includes('/ddic/ddl/sources/')) {
        if (url.includes('_action=LOCK')) {
          locked = true;
          return { status: 200, body: LOCKED };
        }
        if (url.includes('_action=UNLOCK')) {
          locked = false;
          return { status: 200 };
        }
        if (method === 'DELETE') {
          if (locked && url.includes('lockHandle=H1')) there = false;
          return { status: 200 };
        }
        return { status: 200, body: there ? '<ddl:ddlSource/>' : '' };
      }
      if (url === '/sap/bc/adt/deletion/delete') return { status: 404 };
      return { status: 200 };
    });
    return { ...fake, there: () => there };
  };

  const removeIt = async () => {
    const fake = system();
    const ledger = new Ledger(() => {});
    const probe = new Probe(
      gate(fake.connection, {}),
      {},
      { sequential: true },
      ledger,
      { packageName: 'ZPKG', transportRequest: '' },
      'ABCD',
      new Interrupt(),
    );
    probe.remember(ddl, 'ZHPABCDDQ', {
      packageName: 'ZPKG',
      transportRequest: '',
    });
    return { ...fake, removals: await ledger.cleanup() };
  };

  it('are removed through the legacy client: lock, delete with the handle, unlock', async () => {
    const { removals, seen, there } = await removeIt();
    expect(removals.map((r) => r.removed)).toEqual([true]);
    expect(there()).toBe(false);
    const sent = seen.map((s) => `${s.method} ${s.url}`);
    const lock = sent.findIndex((s) => s.includes('_action=LOCK'));
    const del = sent.findIndex(
      (s) => s.startsWith('DELETE ') && s.includes('lockHandle=H1'),
    );
    const unlock = sent.findIndex((s) => s.includes('_action=UNLOCK'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(del).toBeGreaterThan(lock);
    expect(unlock).toBeGreaterThan(del);
    expect(sent).not.toContain('POST /sap/bc/adt/deletion/delete');
  });

  it('a 200 with an empty body is absent here, present on a modern system', () => {
    const wire = (data: string) => ({
      status: 200,
      statusText: '',
      headers: {},
      data,
    });
    expect(readState(wire('')).exists).toBe(false);
    expect(readState(wire('<ddl:ddlSource/>')).exists).toBe(true);
    // A modern run: no registered set takes the objects over.
    let modern: typeof import('../../../../../adt-clients/tools/header-probe/record') =
      undefined as never;
    jest.isolateModules(() => {
      modern = require('../../../../../adt-clients/tools/header-probe/record');
    });
    expect(modern.readState(wire('')).exists).toBe(true);
  });
});

describe('a clients run on a system answering 200 empty for an unknown path', () => {
  it('reads that as absent: no object is reported as not removed', async () => {
    const system = fakeSystem((request) =>
      request.url === '/sap/bc/adt/discovery'
        ? { status: 200, body: DISCOVERY }
        : { status: 200 },
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
    expect(result.corpus?.removals.length).toBeGreaterThan(0);
    expect(result.corpus?.removals.filter((r) => r.removed !== true)).toEqual(
      [],
    );
  });
});

describe('the legacy entry reads the overlay the live tests read', () => {
  const overlay = () => {
    const file = path.join(tempDir(), 'test-config.overlay.legacy.yaml');
    fs.writeFileSync(
      file,
      [
        '"environment.system": "onprem"',
        '"environment.default_package": "ZPKG"',
        '"environment.default_transport": "SYSK900001"',
        '"environment.default_master_system": "SYS"',
        '"environment.verify_lock_released": true',
        '"environment.read_message_class_after_create": true',
        '"environment.validate_transformation_names": true',
        '"shared_dependencies.package": "ZSHARED"',
        '"shared_dependencies.super_package": "ZPKG"',
        '"shared_dependencies.software_component": "HOME"',
        '"shared_dependencies.transport_layer": "ZLAY"',
        '"shared_dependencies.record_changes": true',
        '"create_package.test_cases[adt_package].params.package_name": "ZPARENT"',
        '"create_package.test_cases[adt_package].params.software_component": "HOME"',
        '"create_package.test_cases[adt_package].params.transport_layer": "ZLAY"',
        '"create_transport.test_cases[builder_transport].params.target_system": "SYS"',
        '"environment.is_legacy": true',
        '"legacy_env.runner": "manual"',
        '"legacy_740.test_cases[legacy_deletes].enabled": true',
        '',
      ].join('\n'),
    );
    return file;
  };
  const rootHelper =
    '../../../../../adt-clients/src/__tests__/helpers/test-helper';
  const withOverlay = (use: () => void) => {
    const before = process.env.MCP_TEST_OVERLAY;
    process.env.MCP_TEST_OVERLAY = overlay();
    try {
      use();
    } finally {
      if (before === undefined) delete process.env.MCP_TEST_OVERLAY;
      else process.env.MCP_TEST_OVERLAY = before;
    }
  };

  it('the root alone refuses the legacy keys; the legacy entry registers them first', () => {
    withOverlay(() => {
      jest.isolateModules(() => {
        const helper = require(rootHelper);
        expect(() => helper.loadTestConfig()).toThrow(/unknown key/);
      });
      jest.isolateModules(() => {
        const helper = require(rootHelper);
        require('../../helpers/legacyTestConfig');
        expect(helper.loadTestConfig().environment.is_legacy).toBe(true);
      });
    });
  });

  it('the entry imports that registration', () => {
    const entry = fs.readFileSync(
      path.resolve(__dirname, '../../../../tools/header-probe/errorCorpus.ts'),
      'utf8',
    );
    expect(entry).toContain(
      "import '../../src/__tests__/helpers/legacyTestConfig';",
    );
  });
});
