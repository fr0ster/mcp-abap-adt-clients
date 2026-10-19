import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { parse } from 'yaml';
import { AdtClient } from '../../../clients/AdtClient';
import { CleanupSteps, withCleanup } from '../../helpers/cleanupSteps';
import { markerLines } from '../../helpers/debuggerTargets';

const {
  ensureSharedDependency,
  resetSharedDependencyCache,
} = require('../../helpers/test-helper');

/**
 * The debugger tests run under the debugger objects that are shared
 * dependencies: ensured from `shared_dependencies`, never created per run and
 * never deleted. These checks run without SAP.
 */

type Entry = {
  name: string;
  source?: string;
  available_in?: string[];
  skip_activation?: boolean;
};

const template = parse(
  readFileSync(
    join(__dirname, '..', '..', 'helpers', 'test-config.yaml.template'),
    'utf8',
  ),
) as {
  shared_dependencies: { classes: Entry[]; views: Entry[] };
  runtime_debugger: {
    test_cases: { name: string; params?: Record<string, string> }[];
  };
};

function shared(type: 'classes' | 'views', name: string): Entry | undefined {
  return template.shared_dependencies[type].find((e) => e.name === name);
}

function params(caseName: string): Record<string, string> {
  return (
    template.runtime_debugger.test_cases.find((c) => c.name === caseName)
      ?.params ?? {}
  );
}

describe('debugger tests use shared targets', () => {
  it.each([
    [
      'adt_abap_debugger',
      'class_name',
      '"BP:',
      ['loop', 'after', 'raise', 'catch', 'add'],
    ],
    ['adt_memory_debugger', 'class_name', '"BP:', ['before', 'after']],
    ['adt_abap_debugger_modes', 'class_name', '"BP:', ['LOOP', 'END']],
    ['adt_abap_debugger_modes', 'class_name_b', '"BP:', ['RAISE', 'END']],
    ['adt_amdp_debugger', 'class_name', '-- BP:', ['loop', 'tf']],
  ] as const)('%s.%s names a shared class whose source carries its markers', (caseName, key, marker, names) => {
    const name = params(caseName)[key];
    expect(name).toMatch(/^ZAC_SHR_DBG_/);
    const entry = shared('classes', name as string);
    expect(entry?.source).toBeTruthy();
    const lines = markerLines(entry?.source ?? '', marker);
    expect(names.filter((n) => !lines[n])).toEqual([]);
    expect(entry?.source).toContain(
      `CLASS ${(name as string).toLowerCase()} DEFINITION`,
    );
  });

  it('the AMDP class and its table function name each other and activate as a group', () => {
    const { class_name: cls, ddl_name: ddl } = params('adt_amdp_debugger');
    const amdp = shared('classes', cls as string);
    const tf = shared('views', ddl as string);
    expect(amdp?.skip_activation).toBe(true);
    expect(tf?.skip_activation).toBe(true);
    expect(amdp?.source).toContain(
      `FOR TABLE FUNCTION ${(ddl as string).toLowerCase()}`,
    );
    expect(tf?.source).toContain(
      `implemented by method ${(cls as string).toLowerCase()}=>tf`,
    );
  });

  it('no debugger case keeps per-run object params', () => {
    for (const testCase of template.runtime_debugger.test_cases) {
      for (const key of ['package_name', 'transport_request', 'keep_probe'])
        expect([testCase.name, key in (testCase.params ?? {})]).toEqual([
          testCase.name,
          false,
        ]);
    }
  });
});

// --- ensureSharedDependency and skip_activation -------------------------------

const LOCK_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>SHARED-LOCK</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function recording(): { connection: IAbapConnection; urls: string[] } {
  const urls: string[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: {
      method: string;
      url: string;
      params?: Record<string, unknown>;
    }) => {
      urls.push(`${request.method} ${request.url}`);
      const locking =
        /_action=(UN)?LOCK/.test(request.url) ||
        typeof request.params?._action === 'string';
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: locking ? LOCK_BODY : '<x/>',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, urls };
}

const logger = { debug() {}, info() {}, warn() {}, error() {} };

describe('ensureSharedDependency honours skip_activation', () => {
  beforeEach(() => resetSharedDependencyCache());

  it('writes an existing skip_activation view and does not activate it', async () => {
    const { connection, urls } = recording();
    await ensureSharedDependency(
      new AdtClient(connection, logger),
      'views',
      params('adt_amdp_debugger').ddl_name,
      logger,
    );
    expect(urls.some((u) => u.startsWith('PUT '))).toBe(true);
    expect(urls.filter((u) => u.includes('/activation'))).toEqual([]);
  });

  it('writes and activates an existing class without skip_activation', async () => {
    const { connection, urls } = recording();
    await ensureSharedDependency(
      new AdtClient(connection, logger),
      'classes',
      params('adt_abap_debugger').class_name,
      logger,
    );
    expect(urls.some((u) => u.startsWith('PUT '))).toBe(true);
    expect(urls.some((u) => u.includes('/activation'))).toBe(true);
  });
});

// --- cleanup -----------------------------------------------------------------

describe('CleanupSteps', () => {
  it('runs every step after a failure and reports each failure by name', async () => {
    const steps = new CleanupSteps();
    const ran: string[] = [];
    await steps.run('first', () => {
      ran.push('first');
      throw new Error('boom');
    });
    await steps.run(
      'second',
      async () => {
        ran.push('second');
        return { ok: false, getError: () => ({ message: 'refused' }) };
      },
      { checkAnswer: true },
    );
    await steps.run('third', () => {
      ran.push('third');
    });
    expect(ran).toEqual(['first', 'second', 'third']);
    expect(() => steps.finish()).toThrow(
      'cleanup failed in 2 steps — first: boom; second: refused',
    );
  });

  it('reports a failed log-off', async () => {
    const steps = new CleanupSteps();
    const connection = {
      setSessionType: () => {},
      isConnected: () => true,
      disconnect: async () => {
        throw new Error('logoff refused');
      },
    } as unknown as IAbapConnection;
    await steps.logOff('the listener session', connection);
    expect(() => steps.finish()).toThrow(
      'log off the listener session: logoff refused',
    );
  });

  it('withCleanup rethrows the test failure as it is when the cleanup succeeded', async () => {
    const failure = new Error('the test failed');
    let cleaned = false;
    await expect(
      withCleanup(
        async () => {
          throw failure;
        },
        async () => {
          cleaned = true;
        },
      ),
    ).rejects.toBe(failure);
    expect(cleaned).toBe(true);
  });

  it('withCleanup reports both when the test and its cleanup failed', async () => {
    await expect(
      withCleanup(
        async () => {
          throw new Error('the test failed');
        },
        async (steps) => {
          await steps.run('log off', () => {
            throw new Error('logoff refused');
          });
        },
      ),
    ).rejects.toThrow(/the test failed.*logoff refused/);
  });
});
