/**
 * C5 of #304: the 20 types a legacy system does not have are handed out as
 * handlers whose every operation refuses. Equivalence: each operation answers
 * the same refusal (origin, code and message, snapshotted from the record
 * built by `absentOnLegacy`) and sends no request, and handing one out sends
 * none. Intended change: each is an instance of the modern class and of its
 * `*AbsentLegacy` class, and every public member of the modern class is
 * overridden on it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import * as ts from 'typescript';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { ABSENT_GETTERS, PRIVATE_HELPERS } from '../../helpers/absentHandlers';

function recording() {
  const sent: string[] = [];
  const connection = {
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: { method: string; url: string }) => {
      sent.push(`${request.method} ${request.url}`);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
  } as unknown as IAbapConnection;
  return { connection, sent };
}

type Call = (...args: unknown[]) => Promise<unknown>;

/** The handler a getter answers, untyped: what is on it is the subject. */
function handlerOf(client: AdtClientLegacy, getter: string): object {
  const factory = Reflect.get(client, getter) as () => object;
  return factory.call(client);
}

/** Every function name on the handler's prototype chain, as `absentOnLegacy` listed them. */
function operationsOf(handler: object): string[] {
  const names = new Set<string>();
  for (const own of Object.keys(handler))
    if (typeof Reflect.get(handler, own) === 'function') names.add(own);
  let proto: unknown = Object.getPrototypeOf(handler);
  while (
    typeof proto === 'object' &&
    proto !== null &&
    proto !== Object.prototype
  ) {
    for (const name of Object.getOwnPropertyNames(proto))
      if (
        name !== 'constructor' &&
        typeof Reflect.get(proto, name) === 'function'
      )
        names.add(name);
    proto = Object.getPrototypeOf(proto);
  }
  return [...names].sort();
}

describe('an absent legacy handler refuses every operation, as before', () => {
  it.each(ABSENT_GETTERS)('%s: handing it out sends nothing', (getter) => {
    const { connection, sent } = recording();
    handlerOf(new AdtClientLegacy(connection), getter);
    expect(sent).toEqual([]);
  });

  it.each(ABSENT_GETTERS)(
    '%s: each operation answers the same refusal and sends nothing',
    async (getter) => {
      const { connection, sent } = recording();
      const handler = handlerOf(new AdtClientLegacy(connection), getter);
      const refusals: Record<string, unknown> = {};
      for (const name of operationsOf(handler).filter(
        (n) => !PRIVATE_HELPERS.has(n),
      )) {
        const fn = Reflect.get(handler, name) as Call;
        const answer = (await fn.call(handler)) as {
          ok: boolean;
          getError: () => { origin: string; code: string; message: string };
        };
        expect(answer.ok).toBe(false);
        const { origin, code, message } = answer.getError();
        refusals[name] = { origin, code, message };
      }
      expect(sent).toEqual([]);
      expect({
        objectType: Reflect.get(handler, 'objectType'),
        refusals,
      }).toMatchSnapshot();
    },
  );
});

const CLIENTS_SRC = path.join(__dirname, '../../../../../adt-clients/src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.name === '__tests__') return [];
    if (e.isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

/** Each modern class's public methods, read from its TypeScript declaration. */
const PUBLIC_METHODS: ReadonlyMap<string, readonly string[]> = (() => {
  const out = new Map<string, string[]>();
  for (const file of sourceFiles(CLIENTS_SRC)) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of sf.statements) {
      if (!ts.isClassDeclaration(statement) || !statement.name) continue;
      const names = new Set<string>();
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        if (ts.isPrivateIdentifier(member.name)) continue;
        const hidden = (member.modifiers ?? []).some(
          (m) => m.kind === ts.SyntaxKind.PrivateKeyword,
        );
        if (!hidden) names.add(member.name.getText(sf));
      }
      out.set(statement.name.text, [...names].sort());
    }
  }
  return out;
})();

describe('an absent legacy handler is a subclass of the modern one (C5)', () => {
  it.each(ABSENT_GETTERS)(
    '%s: an instance of the modern class and of its *AbsentLegacy class',
    (getter) => {
      const { connection } = recording();
      const handler = handlerOf(new AdtClientLegacy(connection), getter);
      const absent = Object.getPrototypeOf(handler) as {
        constructor: new (...args: never[]) => object;
      };
      const modern = Object.getPrototypeOf(absent) as {
        constructor: new (...args: never[]) => object;
      };
      expect(absent.constructor.name).toBe(
        `${modern.constructor.name}AbsentLegacy`,
      );
      expect(handler).toBeInstanceOf(absent.constructor);
      expect(handler).toBeInstanceOf(modern.constructor);
    },
  );

  it.each(ABSENT_GETTERS)(
    '%s: every public or protected method of the modern class is overridden',
    (getter) => {
      const { connection } = recording();
      const handler = handlerOf(new AdtClientLegacy(connection), getter);
      const absent: object = Object.getPrototypeOf(handler);
      const modernName = (
        Object.getPrototypeOf(absent) as { constructor: { name: string } }
      ).constructor.name;
      const methods = PUBLIC_METHODS.get(modernName) ?? [];
      expect(methods.length).toBeGreaterThan(0);
      expect(methods.filter((name) => !Object.hasOwn(absent, name))).toEqual(
        [],
      );
    },
  );
});
