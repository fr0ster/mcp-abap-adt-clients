/**
 * Every public member the legacy client and the legacy executor hand out is
 * decided exactly once (spec §11.1 "Refusals", §16).
 *
 * **The inventory is built from the handlers, not from the spec.** For every
 * getter of `AdtClientLegacy` and `AdtExecutorLegacy` the handler it returns
 * is walked through its whole prototype chain — the members it inherits from
 * `AdtClassMemberBase` or `AbapUnitRunner` included, and the own keys of an
 * `absentOnLegacy` object — and so are the two clients themselves, accessors
 * and symbol-keyed members included. Each member must be in exactly one of the
 * tables in `helpers/legacyMembers.ts`: refused (answered without a request)
 * or sending (the request it sends, asserted on a recording connection). A new
 * or inherited member therefore cannot go undecided.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import * as ts from 'typescript';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';
import { AdtExecutorLegacy } from '../../../clients/AdtExecutorLegacy';
import { headersOf } from '../../helpers/adtHeaders';
import {
  ARGUMENT_DEPENDENT,
  LEGACY_REFUSED,
  LEGACY_SENDS,
  NON_PUBLIC,
  type RefusedRow,
  type SendsRow,
} from '../../helpers/legacyMembers';

const ROOT = path.resolve(__dirname, '../../../..');

// ---------------------------------------------------------------------------
// A recording connection: answers by what was asked, records what left.

const LOCK_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>GUARD-LOCK</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

const OBJECT_BODY = `<?xml version="1.0" encoding="utf-8"?>
<adtcore:mainObject xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZGUARD" adtcore:description="guard" adtcore:masterLanguage="EN" adtcore:version="active">
  <adtcore:packageRef adtcore:name="$TMP"/>
</adtcore:mainObject>`;

const MESSAGE_CLASS_BODY = `<?xml version="1.0" encoding="utf-8"?>
<mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZGUARD_MSG" adtcore:description="guard" adtcore:masterLanguage="EN">
  <adtcore:packageRef adtcore:name="$TMP"/>
  <mc:messages mc:msgno="001" mc:msgtext="guard"/>
</mc:messageClass>`;

const VERSIONS_FEED = `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
  <atom:entry><atom:title>000001</atom:title><atom:content src="/sap/bc/adt/guard/versions/1"/></atom:entry>
</atom:feed>`;

function bodyFor(url: string): string {
  if (/_action=(LOCK|UNLOCK)/.test(url)) return LOCK_BODY;
  if (url.includes('/messageclass/')) return MESSAGE_CLASS_BODY;
  if (url.includes('/versions')) return VERSIONS_FEED;
  return OBJECT_BODY;
}

interface Recorded {
  method: string;
  path: string;
  query: Record<string, string>;
  data: unknown;
}

function recordingConnection() {
  const sent: Recorded[] = [];
  const sessionTypes: string[] = [];
  const connection = {
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: (type: string) => {
      sessionTypes.push(type);
    },
    makeAdtRequest: async (request: {
      url: string;
      method: string;
      params?: Record<string, unknown>;
      data?: unknown;
    }) => {
      const url = new URL(request.url, 'https://example');
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      for (const [key, value] of Object.entries(request.params ?? {})) {
        query[key] = String(value);
      }
      sent.push({
        method: request.method,
        path: url.pathname,
        query,
        data: request.data,
      });
      const wire = `${url.pathname}?${new URLSearchParams(query).toString()}`;
      return {
        status: 200,
        statusText: 'OK',
        headers: { location: '/sap/bc/adt/abapunit/runs/GUARD' },
        data: bodyFor(wire),
      };
    },
  } as unknown as IAbapConnection;
  return { connection, sent, sessionTypes };
}

// ---------------------------------------------------------------------------
// The inventory, read from the objects themselves.

/** A member's key: its name, or `[<description>]` for a symbol. */
function keyOf(name: string | symbol): string {
  return typeof name === 'symbol' ? `[${name.description}]` : name;
}

/**
 * Every member of `target`: functions, accessors and symbol-keyed members on
 * the object itself and its whole prototype chain, each with the object that
 * declares it (the first one up the chain that has it).
 */
function membersOf(target: object): Map<string, object> {
  const members = new Map<string, object>();
  let proto: object | null = target;
  while (proto && proto !== Object.prototype) {
    for (const name of Reflect.ownKeys(proto)) {
      if (name === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      const isMember =
        typeof descriptor?.value === 'function' ||
        descriptor?.get !== undefined ||
        descriptor?.set !== undefined;
      const key = keyOf(name);
      if (isMember && !members.has(key)) members.set(key, proto);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return members;
}

/** The getters of a client: every `get*` function on its prototype chain. */
function gettersOf(client: object): string[] {
  return [...membersOf(client).keys()].filter(
    (name) =>
      name.startsWith('get') &&
      typeof (client as Record<string, unknown>)[name] === 'function',
  );
}

/** Everything the inventory covers: each client, and each getter's handler. */
function owners(connection: IAbapConnection): Map<string, object> {
  const client = new AdtClientLegacy(connection);
  const executor = new AdtExecutorLegacy(connection);
  const out = new Map<string, object>([
    ['AdtClientLegacy', client],
    ['AdtExecutorLegacy', executor],
  ]);
  for (const owner of [client, executor]) {
    for (const getter of gettersOf(owner)) {
      if (out.has(getter)) throw new Error(`Two getters named ${getter}`);
      const make = (owner as unknown as Record<string, () => object>)[getter];
      out.set(getter, make.call(owner));
    }
  }
  return out;
}

/** `member[case]` → `member`. */
function baseOf(key: string): string {
  const at = key.indexOf('[', 1);
  return at > 0 && key.endsWith(']') ? key.slice(0, at) : key;
}

function isCase(key: string): boolean {
  return baseOf(key) !== key;
}

function targetFor(connection: IAbapConnection, getter: string) {
  const target = owners(connection).get(getter);
  if (!target) throw new Error(`No getter ${getter}`);
  return target as Record<string, unknown>;
}

function rowsOf<T>(
  table: Record<string, Record<string, T>>,
): [string, string, T][] {
  return Object.entries(table).flatMap(([getter, rows]) =>
    Object.entries(rows).map(
      ([member, row]) => [getter, member, row] as [string, string, T],
    ),
  );
}

// ---------------------------------------------------------------------------

describe('legacy member inventory', () => {
  const inventory = owners(recordingConnection().connection);

  it('every public member is decided exactly once', () => {
    const problems: string[] = [];
    const getters = new Set([
      ...inventory.keys(),
      ...Object.keys(LEGACY_REFUSED),
      ...Object.keys(LEGACY_SENDS),
    ]);
    for (const getter of getters) {
      const target = inventory.get(getter);
      const collected = target ? [...membersOf(target).keys()] : [];
      const refused = Object.keys(LEGACY_REFUSED[getter] ?? {});
      const sends = Object.keys(LEGACY_SENDS[getter] ?? {});
      const decided = new Set([...refused, ...sends].map(baseOf));
      for (const member of collected) {
        const key = `${getter}.${member}`;
        if (key in NON_PUBLIC) {
          if (decided.has(member))
            problems.push(`${key} (non-public, decided)`);
          continue;
        }
        if (!decided.has(member)) problems.push(`${key} (undecided)`);
      }
      for (const member of decided) {
        if (!collected.includes(member))
          problems.push(`${getter}.${member} (decided, not handed out)`);
      }
      for (const key of refused) {
        if (sends.includes(key)) problems.push(`${getter}.${key} (both)`);
      }
      // A member in both tables is one whose decision depends on its
      // arguments, and then every row of it is a case.
      for (const member of decided) {
        const keys = [...refused, ...sends].filter((k) => baseOf(k) === member);
        const inBoth =
          refused.some((k) => baseOf(k) === member) &&
          sends.some((k) => baseOf(k) === member);
        if (inBoth && keys.some((k) => !isCase(k)))
          problems.push(`${getter}.${member} (both, not by its arguments)`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('an argument-dependent member covers both branches', () => {
    const problems: string[] = [];
    const declared = new Set(Object.keys(ARGUMENT_DEPENDENT));
    for (const [getter, member] of [
      ...rowsOf(LEGACY_REFUSED),
      ...rowsOf(LEGACY_SENDS),
    ]) {
      if (isCase(member) && !declared.has(`${getter}.${baseOf(member)}`))
        problems.push(`${getter}.${member} (a case of an undeclared member)`);
    }
    for (const [key, cases] of Object.entries(ARGUMENT_DEPENDENT)) {
      const dot = key.indexOf('.');
      const getter = key.slice(0, dot);
      const member = key.slice(dot + 1);
      const rowsIn = (table: Record<string, Record<string, unknown>>) =>
        Object.keys(table[getter] ?? {}).filter(
          (k) => isCase(k) && baseOf(k) === member,
        );
      const refused = rowsIn(LEGACY_REFUSED);
      const sends = rowsIn(LEGACY_SENDS);
      if (refused.length === 0) problems.push(`${key} (no refused case)`);
      if (sends.length === 0) problems.push(`${key} (no sending case)`);
      for (const [name, { expect: expected }] of Object.entries(cases)) {
        const row = `${member}[${name}]`;
        const table = expected === 'refused' ? refused : sends;
        if (!table.includes(row))
          problems.push(`${getter}.${row} (no ${expected} row)`);
      }
      for (const row of [...refused, ...sends]) {
        const name = row.slice(member.length + 1, -1);
        if (!(name in cases)) problems.push(`${getter}.${row} (not a case)`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every non-public name is declared non-public', () => {
    const problems: string[] = [];
    for (const [key, { file, className }] of Object.entries(NON_PUBLIC)) {
      const dot = key.indexOf('.');
      const getter = key.slice(0, dot);
      const member = key.slice(dot + 1);
      const target = inventory.get(getter);
      const declaredBy = target ? membersOf(target).get(member) : undefined;
      if (!declaredBy) {
        problems.push(`${key} (not handed out)`);
        continue;
      }
      // A class's member is checked where the runtime finds it; an
      // absentOnLegacy object copies the names of the modern class it stands
      // for, so the source is the only place to read its visibility.
      if (
        Object.getPrototypeOf(target) !== Object.prototype &&
        (declaredBy as { constructor?: { name?: string } }).constructor
          ?.name !== className
      ) {
        problems.push(`${key} (found on another class than ${className})`);
      }
      if (!declaredNonPublic(file, className, member))
        problems.push(`${key} (not private or protected in ${file})`);
    }
    expect(problems).toEqual([]);
  });

  describe('a refused member sends nothing', () => {
    for (const [getter, member, row] of rowsOf<RefusedRow>(LEGACY_REFUSED)) {
      const id = `${getter}.${member}`;
      it(`${id} (${row.section})`, async () => {
        const { connection, sent, sessionTypes } = recordingConnection();
        const target = targetFor(connection, getter);
        const answer = (await row.call(target, headersOf)) as {
          ok: boolean;
          getError: () => { origin: string; code: string };
        };
        expect(answer.ok).toBe(false);
        expect(answer.getError().origin).toBe('refusal');
        expect(answer.getError().code).toBe(
          AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        );
        expect(sent).toEqual([]);
        expect(sessionTypes).toEqual([]);
      });
    }
  });

  describe('a sending member sends its request', () => {
    for (const [getter, member, row] of rowsOf<SendsRow>(LEGACY_SENDS)) {
      const id = `${getter}.${member}`;
      const record = async () => {
        const { connection, sent } = recordingConnection();
        const target = targetFor(connection, getter);
        try {
          await row.call(target, headersOf);
        } catch {
          // What left the wire is the subject, not how the answer was read.
        }
        return sent;
      };
      it(`${id} (${row.section})`, async () => {
        const sent = await record();
        expect(sent.map((r) => `${r.method} ${r.path.toLowerCase()}`)).toEqual(
          row.sends.map((r) => `${r.method} ${r.path.toLowerCase()}`),
        );
        row.sends.forEach((expected, i) => {
          for (const [key, value] of Object.entries(expected.query ?? {})) {
            const actual = sent[i]?.query[key];
            if (value === true)
              expect({ [key]: actual }).toEqual({
                [key]: expect.any(String),
              });
            else expect({ [key]: actual }).toEqual({ [key]: value });
          }
        });
      });
      if (row.body) {
        const fragments = row.body;
        it(`${id} body (${row.section})`, async () => {
          const sent = await record();
          const body = String(sent[0]?.data ?? '');
          for (const fragment of fragments) expect(body).toContain(fragment);
        });
      }
    }
  });
});

/** Whether `className` in `file` declares `member` private or protected. */
function declaredNonPublic(
  file: string,
  className: string,
  member: string,
): boolean {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === className) {
      for (const element of node.members) {
        const name = element.name;
        if (!name || !ts.isIdentifier(name) || name.text !== member) continue;
        const modifiers = ts.canHaveModifiers(element)
          ? (ts.getModifiers(element) ?? [])
          : [];
        if (
          modifiers.some(
            (m) =>
              m.kind === ts.SyntaxKind.PrivateKeyword ||
              m.kind === ts.SyntaxKind.ProtectedKeyword,
          )
        )
          found = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
