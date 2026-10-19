import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
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

  it('exempts only helpers/adtHeaders.ts, not another file of that name', () => {
    const root = mkdtempSync(join(tmpdir(), 'resolver-scan-'));
    try {
      for (const dir of ['integration', 'admin', 'helpers'])
        mkdirSync(join(root, dir));
      writeFileSync(
        join(root, 'helpers', 'adtHeaders.ts'),
        'export const TEST_HEADERS = {};\nexport function headersOf() {}\n',
      );
      writeFileSync(
        join(root, 'integration', 'adtHeaders.ts'),
        "export { headersOf as pair } from '../helpers/adtHeaders';\n",
      );
      expect(resolverOffenders(root)).toEqual([
        join('integration', 'adtHeaders.ts'),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * Files under `root` (`src/__tests__`) in the directories whose tests reach
 * SAP that name the unit-test resolver. Only the helper that defines it,
 * `helpers/adtHeaders.ts` by its exact path, is exempt.
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
  const definition = join('helpers', 'adtHeaders.ts');
  return ['integration', 'admin', 'helpers']
    .flatMap((dir) => walk(join(root, dir)))
    .map((file) => relative(root, file))
    .filter((file) => file !== definition)
    .filter((file) =>
      /\b(headersOf|headersFor|TEST_HEADERS)\b/.test(
        readFileSync(join(root, file), 'utf8'),
      ),
    );
}
