import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import * as ts from 'typescript';
import { AdtAbapGitClient } from '../../../clients/AdtAbapGitClient';
import { AdtClient } from '../../../clients/AdtClient';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { ClassExecutor } from '../../../executors/class/ClassExecutor';
import { ProgramExecutor } from '../../../executors/program/ProgramExecutor';
import { AbapDebugger } from '../../../runtime/debugger/AbapDebugger';
import { AmdpDebugger } from '../../../runtime/debugger/AmdpDebugger';
import {
  headersOf,
  integrationHeadersOf,
  TEST_HEADERS,
} from '../../helpers/adtHeaders';

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
  legacy: [string, Handler, string][];
} {
  const of = (client: AdtClient) =>
    handlersOf(client).flatMap(({ factory, handler }) =>
      headerMembers(`${factory}()`, handler),
    );
  const standalone: [string, unknown][] = [
    ['AdtAbapGitClient', new AdtAbapGitClient(conn, logger)],
    ['AbapDebugger', new AbapDebugger(conn, logger)],
    ['AmdpDebugger', new AmdpDebugger(conn, logger)],
    ['ClassExecutor', new ClassExecutor(conn, logger)],
    ['ProgramExecutor', new ProgramExecutor(conn, logger)],
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
    legacy: of(new AdtClientLegacy(conn, logger)),
  };
}

describe('integrationHeadersOf', () => {
  it('throws for a member with no recorded pair, naming handler.member', () => {
    const cls = new AdtClient(connection(), logger).getClass();
    expect(() => integrationHeadersOf(cls, 'noSuchMember')).toThrow(
      'AdtClass.noSuchMember',
    );
    // A member the class has, but which takes no headers, has no pair either.
    expect(() => integrationHeadersOf(cls, 'read')).toThrow('AdtClass.read');
    // The unit-test resolver keeps its fallback for the same call.
    expect(headersOf(cls, 'noSuchMember')).toBe(TEST_HEADERS);
  });

  it('throws for a plain object that is not a legacy refusal', () => {
    const handler = { create: async () => undefined };
    expect(() => integrationHeadersOf(handler, 'create')).toThrow(
      'Object.create',
    );
  });

  it('throws for a handler shaped like a legacy refusal that is not one', () => {
    const sent: unknown[] = [];
    const send = async (_config: unknown, options: { headers: unknown }) => {
      sent.push(options.headers);
    };
    // An objectType the legacy client does not refuse.
    expect(() =>
      integrationHeadersOf({ objectType: 'Class', create: send }, 'create'),
    ).toThrow('Object.create');
    // A refused type's name and keys, but a member that sends.
    const real = new AdtClientLegacy(connection(), logger).getDomain();
    const forged: Record<string, unknown> = { ...real, create: send };
    expect(() => integrationHeadersOf(forged, 'create')).toThrow(
      'Object.create',
    );
    // A class that only borrows a legacy refusal's name.
    class AdtPackageLegacy {
      async create(_config: unknown, options: { headers: unknown }) {
        sent.push(options.headers);
      }
    }
    expect(() =>
      integrationHeadersOf(new AdtPackageLegacy(), 'create'),
    ).toThrow('AdtPackageLegacy.create');
    // The real ones still pass.
    expect(integrationHeadersOf(real, 'create')).toBe(TEST_HEADERS);
    expect(
      integrationHeadersOf(
        new AdtClientLegacy(connection(), logger).getPackage(),
        'create',
      ),
    ).toBe(TEST_HEADERS);
    expect(sent).toEqual([]);
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

  it('resolves every header member of every legacy handler, or proves it sends nothing', async () => {
    const conn = connection();
    const { legacy } = everyHeaderMember(conn);
    expect(legacy.length).toBeGreaterThan(150);
    const sentWithTestHeaders: string[] = [];
    let refusals = 0;
    for (const [label, handler, member] of legacy) {
      // Throws, and fails the test, for a member with no pair at all.
      const pair = integrationHeadersOf(handler, member);
      if (pair !== TEST_HEADERS) continue;
      refusals++;
      const before = conn.sent;
      const answer = (await handler[member]?.call(handler, {}, undefined, {
        headers: pair,
      })) as { ok?: boolean };
      if (answer?.ok !== false || conn.sent !== before)
        sentWithTestHeaders.push(label);
    }
    // The absent types and the legacy package, request and data-preview
    // refusals: each was called, and none sent a request.
    expect(refusals).toBeGreaterThan(50);
    expect(sentWithTestHeaders).toEqual([]);
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
      // Allowed: the strict resolver and types; a unit test's own import.
      'integration/ok.ts': `import { integrationHeadersOf } from ${from};\nimport type { X } from ${from};\nimport { type Y } from ${from};\n`,
      'unit/ok.ts': `import { headersOf, TEST_HEADERS } from ${from};\n`,
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
        ]
          .map((line) => line.split('/').join(sep))
          .sort(),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * Under `root` (`src/__tests__`), read with the TypeScript parser:
 * - no file but `helpers/adtHeaders.ts` itself re-exports anything from it,
 *   in any form (`export *`, `export * as`, named, type-only);
 * - a file in the directories whose tests reach SAP (integration, admin,
 *   helpers) imports from it only `integrationHeadersOf` and types, and does
 *   not load it with `require` or `import()`.
 * Each offence is `<file>: <what>`.
 */
function resolverOffenders(root: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : entry.name.endsWith('.ts')
          ? [join(dir, entry.name)]
          : [],
    );
  const definition = join(root, 'helpers', 'adtHeaders');
  const reachesSap = ['integration', 'admin', 'helpers'];
  const offences: string[] = [];
  for (const path of walk(root)) {
    const file = relative(root, path);
    if (file === join('helpers', 'adtHeaders.ts')) continue;
    const strict = reachesSap.includes(file.split(sep)[0] ?? '');
    const isDefinition = (specifier: ts.Node | undefined): boolean => {
      if (!specifier || !ts.isStringLiteral(specifier)) return false;
      const text = specifier.text;
      if (!text.startsWith('.')) return false;
      const target = resolve(dirname(path), text);
      return (
        target === definition ||
        target === `${definition}.ts` ||
        target === `${definition}.js`
      );
    };
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isExportDeclaration(node) && isDefinition(node.moduleSpecifier))
        offences.push(`${file}: re-exports helpers/adtHeaders`);
      if (
        strict &&
        ts.isImportDeclaration(node) &&
        isDefinition(node.moduleSpecifier)
      ) {
        const clause = node.importClause;
        if (clause && !clause.isTypeOnly) {
          if (clause.name) offences.push(`${file}: imports a default`);
          const bindings = clause.namedBindings;
          if (bindings && ts.isNamespaceImport(bindings))
            offences.push(`${file}: imports the whole module`);
          if (bindings && ts.isNamedImports(bindings))
            for (const element of bindings.elements) {
              const name = (element.propertyName ?? element.name).text;
              if (!element.isTypeOnly && name !== 'integrationHeadersOf')
                offences.push(`${file}: imports ${name}`);
            }
        }
        if (!clause) offences.push(`${file}: imports the module for effect`);
      }
      if (
        strict &&
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require')) &&
        isDefinition(node.arguments[0])
      )
        offences.push(`${file}: loads the module at runtime`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return offences;
}
