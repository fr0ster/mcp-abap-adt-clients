import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtAbapGitClient } from '../../../clients/AdtAbapGitClient';
import { AdtClient } from '../../../clients/AdtClient';
import { abapGitDocuments } from '../../../clients/abapGit/types';
import { ClassExecutor } from '../../../executors/class/ClassExecutor';
import { ProgramExecutor } from '../../../executors/program/ProgramExecutor';
import {
  classExecutorDocuments,
  programExecutorDocuments,
} from '../../../index.executors';
import {
  AbapDebugger,
  abapDebuggerDocuments,
} from '../../../runtime/debugger/AbapDebugger';
import {
  AmdpDebugger,
  amdpDebuggerDocuments,
} from '../../../runtime/debugger/AmdpDebugger';
import {
  headersOf,
  integrationHeadersOf,
  TEST_HEADERS,
} from '../../helpers/adtHeaders';
import { resolverOffenders } from './resolverScan';

/**
 * `integrationHeadersOf` is what every test that reaches SAP uses: a member
 * with no recorded pair throws instead of sending `TEST_HEADERS` to a real
 * system. `headersOf` keeps the fallback for unit tests, whose connection is a
 * mock.
 */

/**
 * The members that take `options.headers` since 36.0.0 (MIGRATION-36.md):
 * the object handlers' and the utilities', looked up on every handler a
 * client factory hands out, and the standalone classes' own.
 */
const HANDLER_MEMBERS = [
  'create',
  'update',
  'updateMetadata',
  'delete',
  'checkDeletion',
  'check',
  'activate',
  'checkState',
  'removeObject',
  'addObject',
  'createTask',
  'changeTaskType',
  'moveObjects',
  'getWhereUsed',
  'getWhereUsedScope',
  'getVirtualFoldersContents',
  'fetchNodeStructure',
  'activateObjectsGroup',
  'checkDeletionGroup',
  'deleteObjectsGroup',
  'getSqlQuery',
  'getTableContents',
];
const STANDALONE_MEMBERS: Record<string, string[]> = {
  AdtAbapGitClient: ['link', 'pull', 'checkExternalRepo'],
  AbapDebugger: [
    'setBreakpoints',
    'getChildVariables',
    'getVariables',
    'syncBreakpoints',
    'setDebuggerSettings',
  ],
  AmdpDebugger: ['getDataPreview'],
  ClassExecutor: ['scheduleTrace'],
  ProgramExecutor: ['scheduleTrace'],
};

/** A mock connection; `sent` counts the requests that reached it. */
function connection(): IAbapConnection & { sent: number } {
  const conn = {
    sent: 0,
    makeAdtRequest: async () => {
      conn.sent++;
      return { status: 200, data: '' };
    },
    setSessionType: jest.fn(),
    getSessionId: jest.fn().mockReturnValue('session'),
  };
  return conn as unknown as IAbapConnection & { sent: number };
}

const logger = { debug() {}, info() {}, warn() {}, error() {} };

type Handler = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** Every handler a client's `get…()` factories hand out, by factory name. */
function handlersOf(
  client: AdtClient,
): { factory: string; handler: Handler }[] {
  const names = new Set<string>();
  let proto: object | null = Object.getPrototypeOf(client);
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto))
      if (/^get[A-Z]/.test(name)) names.add(name);
    proto = Object.getPrototypeOf(proto);
  }
  const found: { factory: string; handler: Handler }[] = [];
  for (const factory of [...names].sort()) {
    const handler = (client as unknown as Record<string, () => unknown>)[
      factory
    ]?.call(client);
    if (handler && typeof handler === 'object')
      found.push({ factory, handler: handler as Handler });
  }
  return found;
}

/** `[label, handler, member]` for every header member a handler has. */
function headerMembers(
  label: string,
  handler: Handler,
  members: readonly string[] = HANDLER_MEMBERS,
): [string, Handler, string][] {
  return members
    .filter((member) => typeof handler[member] === 'function')
    .map((member) => [`${label}.${member}`, handler, member]);
}

function everyHeaderMember(conn: IAbapConnection): {
  modern: [string, Handler, string][];
} {
  const of = (client: AdtClient) =>
    handlersOf(client).flatMap(({ factory, handler }) =>
      headerMembers(`${factory}()`, handler),
    );
  const standalone: [string, unknown][] = [
    [
      'AdtAbapGitClient',
      new AdtAbapGitClient(conn, { logger, results: abapGitDocuments }),
    ],
    [
      'AbapDebugger',
      new AbapDebugger(conn, { logger, results: abapDebuggerDocuments }),
    ],
    [
      'AmdpDebugger',
      new AmdpDebugger(conn, { logger, results: amdpDebuggerDocuments }),
    ],
    [
      'ClassExecutor',
      new ClassExecutor(conn, { logger, results: classExecutorDocuments }),
    ],
    [
      'ProgramExecutor',
      new ProgramExecutor(conn, { logger, results: programExecutorDocuments }),
    ],
  ];
  return {
    modern: [
      ...of(new AdtClient(conn, logger)),
      ...standalone.flatMap(([label, handler]) =>
        headerMembers(
          label,
          handler as Handler,
          STANDALONE_MEMBERS[label] ?? [],
        ),
      ),
    ],
  };
}

describe('integrationHeadersOf', () => {
  it('throws for a member with no recorded pair, naming handler.member', () => {
    const cls = new AdtClient(connection(), logger).getClass();
    expect(() => integrationHeadersOf(cls, 'noSuchMember')).toThrow(
      'AdtClass.noSuchMember',
    );
    // It says where a pair goes: the table here, or another package's seam.
    expect(() => integrationHeadersOf(cls, 'noSuchMember')).toThrow(
      /SENT_BEFORE_36 .*registerHeaderPairs/,
    );
    // A member the class has, but which takes no headers, has no pair either.
    expect(() => integrationHeadersOf(cls, 'read')).toThrow('AdtClass.read');
    // The unit-test resolver keeps its fallback for the same call.
    expect(headersOf(cls, 'noSuchMember')).toBe(TEST_HEADERS);
  });

  it('throws for a plain object no registered check recognises', () => {
    const handler = { create: async () => undefined };
    expect(() => integrationHeadersOf(handler, 'create')).toThrow(
      'Object.create',
    );
  });

  it('resolves a real pair for every header member of every modern handler', () => {
    const { modern } = everyHeaderMember(connection());
    expect(modern.length).toBeGreaterThan(150);
    const missing = modern
      .filter(([, handler, member]) => {
        try {
          return integrationHeadersOf(handler, member) === TEST_HEADERS;
        } catch {
          return true;
        }
      })
      .map(([label]) => label);
    expect(missing).toEqual([]);
  });

  it('is the only resolver in tests that reach SAP', () => {
    expect(resolverOffenders(join(__dirname, '..', '..'))).toEqual([]);
  });

  it('reports every re-export of helpers/adtHeaders and every other import', () => {
    const root = mkdtempSync(join(tmpdir(), 'resolver-scan-'));
    const from = "'../helpers/adtHeaders'";
    const files: Record<string, string> = {
      // The definition itself is exempt.
      'helpers/adtHeaders.ts':
        'export const TEST_HEADERS = {};\nexport function headersOf() {}\nexport function integrationHeadersOf() {}\n',
      // Re-exports, in any form, from any directory.
      'integration/star.ts': `export * from ${from};\n`,
      'integration/starAs.ts': `export * as headers from ${from};\n`,
      'integration/adtHeaders.ts': `export { headersOf as pair } from ${from};\n`,
      'admin/typeOnly.ts': `export type { IAdtHeaders } from ${from};\n`,
      'unit/star.ts': `export * from ${from};\n`,
      // Imports in the directories that reach SAP.
      'integration/named.ts': `import { headersOf } from ${from};\n`,
      'integration/namespace.ts': `import * as h from ${from};\n`,
      'integration/fallback.ts': `import { integrationHeadersOf, TEST_HEADERS } from ${from};\n`,
      'helpers/required.ts': `const h = require(${from});\n`,
      'helpers/dynamic.ts': `const h = import(${from});\n`,
      'integration/importEquals.ts': `import h = require(${from});\n`,
      'unit/exportImportEquals.ts': `export import h = require(${from});\n`,
      // JavaScript files Jest also runs, under the same rules.
      'integration/required.test.js': `const { headersOf } = require(${from});\n`,
      'admin/esm.mjs': `import { TEST_HEADERS } from ${from};\n`,
      'unit/reexport.cjs': `module.exports = require(${from});\n`,
      'unit/assign.js': `Object.assign(exports, require(${from}));\n`,
      'unit/property.js': `exports.pair = require(${from}).headersOf;\n`,
      'unit/ok.js': `const { headersOf } = require(${from});\n`,
      'helpers/strict.js': `const { integrationHeadersOf } = require(${from});\n`,
      'helpers/mixed.js': `const { integrationHeadersOf, headersOf } = require(${from});\n`,
      'helpers/rest.js': `const { integrationHeadersOf, ...rest } = require(${from});\n`,
      // Allowed: the strict resolver and types; a unit test's own import.
      'integration/ok.ts': `import { integrationHeadersOf } from ${from};\nimport type { X } from ${from};\nimport { type Y } from ${from};\n`,
      'unit/ok.ts': `import { headersOf, TEST_HEADERS } from ${from};\n`,
      // Allowed: the registration seams, which resolve no pair.
      'helpers/registers.ts': `import { registerHeaderPairs, registerRefusedMembers, registerRefusingHandler } from ${from};\n`,
    };
    try {
      for (const [file, text] of Object.entries(files)) {
        mkdirSync(join(root, file, '..'), { recursive: true });
        writeFileSync(join(root, file), text);
      }
      expect(resolverOffenders(root).sort()).toEqual(
        [
          'admin/typeOnly.ts: re-exports helpers/adtHeaders',
          'integration/adtHeaders.ts: re-exports helpers/adtHeaders',
          'integration/star.ts: re-exports helpers/adtHeaders',
          'integration/starAs.ts: re-exports helpers/adtHeaders',
          'unit/star.ts: re-exports helpers/adtHeaders',
          'integration/named.ts: imports headersOf',
          'integration/namespace.ts: imports the whole module',
          'integration/fallback.ts: imports TEST_HEADERS',
          'helpers/required.ts: loads the module at runtime',
          'helpers/dynamic.ts: loads the module at runtime',
          'integration/importEquals.ts: imports the whole module',
          'helpers/mixed.js: loads the module at runtime',
          'helpers/rest.js: loads the module at runtime',
          'unit/exportImportEquals.ts: re-exports helpers/adtHeaders',
          'integration/required.test.js: loads the module at runtime',
          'admin/esm.mjs: imports TEST_HEADERS',
          'unit/reexport.cjs: re-exports helpers/adtHeaders',
          'unit/assign.js: re-exports helpers/adtHeaders',
          'unit/property.js: re-exports helpers/adtHeaders',
        ]
          .map((line) => line.split('/').join(sep))
          .sort(),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
