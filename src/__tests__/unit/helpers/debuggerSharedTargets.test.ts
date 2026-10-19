import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as ts from 'typescript';
import { parse } from 'yaml';
import { AdtClient } from '../../../clients/AdtClient';
import {
  CleanupSteps,
  releaseThenLogOff,
  withCleanup,
} from '../../helpers/cleanupSteps';
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

/**
 * A recording connection. `currentSource`, when given, is what the object's
 * source answers — the system already holding that text.
 */
function recording(currentSource?: string): {
  connection: IAbapConnection;
  urls: string[];
} {
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
      const action =
        typeof request.params?._action === 'string'
          ? `?_action=${request.params._action}`
          : '';
      urls.push(`${request.method} ${request.url}${action}`);
      const locking = /_action=(UN)?LOCK/.test(request.url + action);
      const source =
        currentSource !== undefined &&
        request.method === 'GET' &&
        request.url.includes('/source/main');
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: locking ? LOCK_BODY : source ? currentSource : '<x/>',
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

// --- an unchanged target is left alone ------------------------------------------

describe('ensureSharedDependency leaves a target at its source alone', () => {
  beforeEach(() => resetSharedDependencyCache());

  const name = () => params('adt_abap_debugger').class_name as string;
  const configured = () => shared('classes', name())?.source as string;
  const writes = (urls: string[]) =>
    urls.filter((u) => /_action=LOCK|^PUT |\/activation/.test(u));

  it('sends no lock, no PUT and no activation when the active source matches', async () => {
    // The system's copy differs only in line endings and trailing blanks.
    const held = `${configured().split('\n').join('  \r\n')}\n\n`;
    const { connection, urls } = recording(held);
    const result = await ensureSharedDependency(
      new AdtClient(connection, logger),
      'classes',
      name(),
      logger,
    );
    expect(writes(urls)).toEqual([]);
    expect(result.changed).toBe(false);
  });

  it('writes and activates when the active source differs', async () => {
    const { connection, urls } = recording(
      configured().replace('DO 3 TIMES', 'DO 4 TIMES'),
    );
    const result = await ensureSharedDependency(
      new AdtClient(connection, logger),
      'classes',
      name(),
      logger,
    );
    expect(urls.some((u) => u.includes('_action=LOCK'))).toBe(true);
    expect(urls.some((u) => u.startsWith('PUT '))).toBe(true);
    expect(urls.some((u) => u.includes('/activation'))).toBe(true);
    expect(result.changed).toBe(true);
  });
});

// --- debugger cleanup reads the answers -------------------------------------------

describe('debugger cleanup steps read their answers', () => {
  const ANSWERING = new Set([
    'deleteBreakpoint',
    'terminateDebuggee',
    'stopListener',
    'deleteDebuggee',
    'stop',
    'step',
  ]);
  const dir = join(__dirname, '..', '..', 'integration', 'runtime', 'debugger');

  it('every steps.run whose action answers { ok } passes checkAnswer: true', () => {
    const unchecked: string[] = [];
    let seen = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const source = ts.createSourceFile(
        file,
        readFileSync(join(dir, file), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'run' &&
          node.expression.expression.getText() === 'steps'
        ) {
          const action = node.arguments[1];
          const body =
            action && ts.isArrowFunction(action) ? action.body : undefined;
          if (
            body &&
            ts.isCallExpression(body) &&
            ts.isPropertyAccessExpression(body.expression) &&
            ANSWERING.has(body.expression.name.text)
          ) {
            seen++;
            const options = node.arguments[2];
            const checked =
              options !== undefined &&
              ts.isObjectLiteralExpression(options) &&
              options.properties.some(
                (p) =>
                  ts.isPropertyAssignment(p) &&
                  p.name.getText() === 'checkAnswer' &&
                  p.initializer.kind === ts.SyntaxKind.TrueKeyword,
              );
            if (!checked) {
              const { line } = source.getLineAndCharacterOfPosition(
                node.getStart(),
              );
              unchecked.push(`${file}:${line + 1}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(seen).toBeGreaterThan(10);
    expect(unchecked).toEqual([]);
  });
});

// --- a cleanup that throws ------------------------------------------------------

describe('a cleanup that throws still logs off every session', () => {
  function session(log: string[], label: string) {
    return {
      setSessionType: () => {},
      isConnected: () => true,
      disconnect: async () => {
        log.push(label);
      },
    } as unknown as IAbapConnection;
  }

  it('releaseThenLogOff logs off all sessions after a rejecting release, and withCleanup reports both errors', async () => {
    const loggedOff: string[] = [];
    const sessions = [session(loggedOff, 'a'), session(loggedOff, 'b')];
    const failure = withCleanup(
      async () => {
        throw new Error('the test failed');
      },
      (steps) =>
        releaseThenLogOff(
          steps,
          async () => {
            throw new Error('release rejected');
          },
          sessions,
        ),
    );
    await expect(failure).rejects.toThrow(
      /the test: the test failed; release: release rejected/,
    );
    expect(loggedOff).toEqual(['a', 'b']);
  });

  it('withCleanup catches a cleanup callback that rejects', async () => {
    await expect(
      withCleanup(
        async () => {
          throw new Error('the test failed');
        },
        async () => {
          throw new Error('callback rejected');
        },
      ),
    ).rejects.toThrow(/the test failed.*the cleanup: callback rejected/);
    await expect(
      withCleanup(
        async () => 1,
        async () => {
          throw new Error('callback rejected');
        },
      ),
    ).rejects.toThrow('the cleanup: callback rejected');
  });
});
