/**
 * The table and the checks of `requestHeaders.test.ts`: the recording
 * connection, the rows that call each header member with a pair no
 * implementation could hold, and the scan that finds every implementation.
 * Shared so a package that builds on these handlers holds its subclasses to
 * the same claim, by importing this module by relative path (test-only source
 * in this repository).
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as ts from 'typescript';
import type { AdtClient } from '../../clients/AdtClient';
import type { AdtUtils } from '../../core/shared/AdtUtils';
import { HANDLERS } from './capabilities/manifest';

/** The 32 members of interfaces-adt 19.0.0 that take `options.headers`. */
export const HEADER_MEMBERS = [
  'link',
  'pull',
  'checkExternalRepo',
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
  'scheduleTrace',
  'setBreakpoints',
  'getChildVariables',
  'getVariables',
  'syncBreakpoints',
  'setDebuggerSettings',
  'getDataPreview',
] as const;

/**
 * A member that is a chain — reads, locks, the write, unlocks. The pair is
 * the main write's (the PUT); the chain's own requests keep their constants.
 */
export const CHAIN_MAIN_WRITE: Record<string, string> = {
  'AdtMessageClassMessage.create': 'PUT',
  'AdtMessageClassMessage.update': 'PUT',
  'AdtMessageClassMessage.delete': 'PUT',
};

export type Recorded = {
  method: string;
  url: string;
  headers: Record<string, unknown>;
};

const LOCK_BODY = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>GUARD-LOCK</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

const OBJECT_BODY = `<?xml version="1.0" encoding="utf-8"?>
<adtcore:mainObject xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZGUARD" adtcore:description="guard">
  <adtcore:packageRef adtcore:name="$TMP"/>
</adtcore:mainObject>`;

export function recordingConnection(): {
  connection: IAbapConnection;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (req: {
      method: string;
      url: string;
      headers?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }) => {
      calls.push({
        method: req.method,
        url: req.url,
        headers: { ...(req.headers ?? {}) },
      });
      const locking =
        /_action=(UN)?LOCK/.test(req.url) ||
        typeof req.params?._action === 'string';
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: locking ? LOCK_BODY : OBJECT_BODY,
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
}

/** The pair a row sends: values no implementation could carry as its own. */
export function pairFor(row: string): IAdtHeaders {
  const tag = row.replace(/[^a-zA-Z0-9]+/g, '-');
  return {
    accept: `application/x-test-accept-${tag}`,
    contentType: `application/x-test-ct-${tag}`,
  };
}

/** Every value under a header name, whatever its case. */
export function valuesOf(
  headers: Record<string, unknown>,
  name: string,
): unknown[] {
  return Object.entries(headers)
    .filter(([key]) => key.toLowerCase() === name)
    .map(([, value]) => value);
}

/** The class that owns `member` on this handler's prototype chain. */
export function ownerOf(handler: object, member: string): string {
  let proto: object | null = Object.getPrototypeOf(handler);
  while (proto && proto !== Object.prototype) {
    if (Object.hasOwn(proto, member)) {
      return (proto as { constructor: { name: string } }).constructor.name;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return Object.hasOwn(handler, member) ? '(own property)' : '(none)';
}

export interface Row {
  /** How the row is named in a failure. */
  name: string;
  member: string;
  build: (connection: IAbapConnection) => object;
  call: (handler: never, headers: IAdtHeaders) => Promise<unknown>;
}

const ENTRY = {
  pgmid: 'R3TR',
  type: 'CLAS',
  name: 'ZCL_GUARD',
  position: '000001',
};
const OBJECTS = [{ name: 'ZCL_GUARD', type: 'CLAS/OC' }];
export const IDENTITY = {
  debuggingMode: 'user' as const,
  requestUser: 'GUARD',
  terminalId: 'GUARD-TERMINAL',
  ideId: 'GUARD-IDE',
};

type AnyFn = (...args: unknown[]) => Promise<unknown>;
export const m = (handler: unknown, member: string): AnyFn =>
  ((handler as Record<string, AnyFn>)[member] as AnyFn).bind(handler);

/**
 * The object handlers `client` hands out, every header member each one has,
 * named `<prefix><handler>`.
 */
export function objectRows(
  client: (connection: IAbapConnection) => AdtClient,
  prefix = '',
): Row[] {
  const rows: Row[] = [];
  const members = [
    'create',
    'update',
    'updateMetadata',
    'delete',
    'checkDeletion',
    'check',
    'activate',
    'checkState',
  ];
  for (const [name, entry] of Object.entries(HANDLERS)) {
    const config = entry.config as Record<string, unknown>;
    const build = (connection: IAbapConnection) =>
      (entry.factory as (c: AdtClient) => object)(client(connection));
    const probe = build(recordingConnection().connection) as Record<
      string,
      unknown
    >;
    for (const member of members) {
      if (typeof probe[member] !== 'function') continue;
      rows.push({
        name: `${prefix}${name}`,
        member,
        build,
        call: (handler, headers) => {
          const fn = m(handler, member);
          switch (member) {
            case 'check':
              return fn(config, 'inactive', { headers });
            case 'checkState':
              return fn(config, undefined, { headers });
            case 'update':
            case 'updateMetadata':
              return fn(config, {
                headers,
                source: String(config.source ?? '" guard'),
                lockHandle: 'GUARD-LOCK',
              });
            default:
              return fn(config, { headers });
          }
        },
      });
    }
  }
  return rows;
}

/** The transport request handler `client` hands out, named `<prefix>request`. */
export function requestRows(
  client: (connection: IAbapConnection) => AdtClient,
  prefix = '',
): Row[] {
  const rows: Row[] = [];
  {
    const build = (connection: IAbapConnection) =>
      client(connection).getRequest();
    const name = `${prefix}request`;
    rows.push(
      {
        name,
        member: 'removeObject',
        build,
        call: (h, headers) =>
          m(h, 'removeObject')('DEVK900000', ENTRY, { headers }),
      },
      {
        name,
        member: 'addObject',
        build,
        call: (h, headers) =>
          m(h, 'addObject')('DEVK900000', ENTRY, { headers }),
      },
      {
        name,
        member: 'createTask',
        build,
        call: (h, headers) =>
          m(h, 'createTask')('DEVK900000', { headers, targetUser: 'GUARD' }),
      },
      {
        name,
        member: 'changeTaskType',
        build,
        call: (h, headers) =>
          m(h, 'changeTaskType')('DEVK900001', 'S', { headers }),
      },
      {
        name,
        member: 'moveObjects',
        build,
        call: (h, headers) =>
          m(h, 'moveObjects')('DEVK900001', 'DEVK900002', [ENTRY], {
            headers,
          }),
      },
    );
  }
  return rows;
}

/** The utils `utils` builds, named `<prefix>utils`. */
export function utilRows(
  utils: (connection: IAbapConnection) => AdtUtils,
  prefix = '',
): Row[] {
  const rows: Row[] = [];
  {
    const build = (connection: IAbapConnection) => utils(connection);
    const name = `${prefix}utils`;
    const calls: Record<string, (h: never, x: IAdtHeaders) => unknown> = {
      getWhereUsed: (h, headers) =>
        m(h, 'getWhereUsed')(
          { object_name: 'ZCL_GUARD', object_type: 'class' },
          { headers },
        ),
      getWhereUsedScope: (h, headers) =>
        m(h, 'getWhereUsedScope')(
          { object_name: 'ZCL_GUARD', object_type: 'class' },
          { headers },
        ),
      getVirtualFoldersContents: (h, headers) =>
        m(h, 'getVirtualFoldersContents')(
          { objectSearchPattern: 'Z*' },
          { headers },
        ),
      fetchNodeStructure: (h, headers) =>
        m(h, 'fetchNodeStructure')('DEVC/K', 'ZGUARD_PKG', { headers }),
      activateObjectsGroup: (h, headers) =>
        m(h, 'activateObjectsGroup')(OBJECTS, undefined, { headers }),
      checkDeletionGroup: (h, headers) =>
        m(h, 'checkDeletionGroup')(OBJECTS, { headers }),
      deleteObjectsGroup: (h, headers) =>
        m(h, 'deleteObjectsGroup')(OBJECTS, undefined, { headers }),
      getSqlQuery: (h, headers) =>
        m(h, 'getSqlQuery')({ sql_query: 'SELECT * FROM T000' }, { headers }),
      getTableContents: (h, headers) =>
        m(h, 'getTableContents')({ table_name: 'T000' }, { headers }),
    };
    for (const [member, call] of Object.entries(calls)) {
      rows.push({
        name,
        member,
        build,
        call: call as Row['call'],
      });
    }
  }
  return rows;
}

/** The owner of each row's member, found once. */
export function ownerOfRow(row: Row): string {
  const owner = ownerOf(
    row.build(recordingConnection().connection),
    row.member,
  );
  return `${owner}.${row.member}`;
}

/**
 * The row's member sends exactly the pair it was given, on its one request —
 * the main write's for a chain — and nowhere else; a member in
 * `sendsNoRequest` (`<class>.<member>`), or one that is an own property of a
 * plain-object handler, answers before any request and sends none.
 */
export async function expectCarriesItsPair(
  row: Row,
  sendsNoRequest: ReadonlySet<string>,
): Promise<void> {
  const { connection, calls } = recordingConnection();
  const handler = row.build(connection);
  const owner = ownerOf(handler, row.member);
  const key = `${owner}.${row.member}`;
  const pair = pairFor(`${row.name}.${row.member}`);

  await row.call(handler as never, pair);

  if (owner === '(own property)' || sendsNoRequest.has(key)) {
    // A refusal: it answers before any request is built.
    expect(calls).toEqual([]);
    return;
  }

  const mainVerb = CHAIN_MAIN_WRITE[key];
  const main = mainVerb ? calls.filter((c) => c.method === mainVerb) : calls;
  expect(main).toHaveLength(1);
  const [request] = main as [Recorded];
  expect(valuesOf(request.headers, 'accept')).toEqual([pair.accept]);
  expect(valuesOf(request.headers, 'content-type')).toEqual([pair.contentType]);

  // The chain's own requests keep their own headers: the pair is the
  // write's, and nowhere else.
  for (const other of calls.filter((c) => c !== request)) {
    expect(valuesOf(other.headers, 'accept')).not.toContain(pair.accept);
    expect(valuesOf(other.headers, 'content-type')).not.toContain(
      pair.contentType,
    );
  }
}

/** A class's name: its own, or the variable a class expression is bound to. */
function classNameOf(node: ts.Node): string | undefined {
  if (ts.isClassDeclaration(node)) return node.name?.text ?? '(anonymous)';
  if (ts.isClassExpression(node)) {
    if (node.name) return node.name.text;
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
      return parent.name.text;
    return '(anonymous)';
  }
  return undefined;
}

/**
 * A member's name: an identifier, a string, or a computed name the type
 * checker resolves to a string literal type (`[key]` with
 * `const key = 'create' as const` included). A computed name of a symbol type
 * names no contract method. Anything else is recorded in `unresolvedNames`.
 */
function memberName(
  name: ts.PropertyName | undefined,
  checker: ts.TypeChecker,
  where: string,
  unresolvedNames: string[],
): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) {
    const type = checker.getTypeAtLocation(name.expression);
    if (type.isStringLiteral()) return type.value;
    if (type.flags & (ts.TypeFlags.UniqueESSymbol | ts.TypeFlags.ESSymbol))
      return undefined;
    unresolvedNames.push(`${where} [${name.expression.getText()}]`);
  }
  return undefined;
}

/**
 * The contract method a class member can implement, if any: a method with a
 * body, a getter (it answers the function), or a field holding a value that is
 * not a plain literal — an arrow function, a function expression, or any
 * expression such as `create = this.makeCreate()`, which implements `create`
 * as well. A method alone was all this used to accept, so a function field
 * passed uncovered.
 */
function implementedName(
  member: ts.ClassElement,
  checker: ts.TypeChecker,
  where: string,
  unresolvedNames: string[],
): string | undefined {
  // Every computed name is resolved, whatever the member is, so none is left
  // unread.
  const name = memberName(member.name, checker, where, unresolvedNames);
  if (ts.isMethodDeclaration(member) && member.body) return name;
  if (ts.isGetAccessorDeclaration(member) && member.body) return name;
  if (ts.isPropertyDeclaration(member) && member.initializer) {
    const value = member.initializer;
    const literal =
      ts.isStringLiteral(value) ||
      ts.isNumericLiteral(value) ||
      ts.isNoSubstitutionTemplateLiteral(value) ||
      value.kind === ts.SyntaxKind.TrueKeyword ||
      value.kind === ts.SyntaxKind.FalseKeyword ||
      value.kind === ts.SyntaxKind.NullKeyword;
    return literal ? undefined : name;
  }
  return undefined;
}

/**
 * Every class method under `root` (tests excluded) named like a header
 * member, as `<class>.<member>`, and the computed member names the type
 * checker could not resolve, as `file: class [expression]` — any of those
 * fails the scan: a name it cannot read is a member it cannot check.
 */
export function scanImplementations(root: string): {
  found: string[];
  unresolvedNames: string[];
} {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (name === '__tests__') continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.ts') && !name.endsWith('.d.ts'))
        files.push(path);
    }
  };
  walk(root);

  const names = new Set<string>(HEADER_MEMBERS);
  const found: string[] = [];
  // A program, not bare source files: a computed name is resolved by the type
  // checker, which needs the declarations it refers to.
  const program = ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true,
    esModuleInterop: true,
  });
  const checker = program.getTypeChecker();
  const unresolvedNames: string[] = [];
  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = (node: ts.Node) => {
      const className = classNameOf(node);
      if (
        className &&
        (ts.isClassDeclaration(node) || ts.isClassExpression(node))
      ) {
        const where = `${relative(root, file)}: ${className}`;
        for (const member of node.members) {
          const name = implementedName(member, checker, where, unresolvedNames);
          if (name && names.has(name)) found.push(`${className}.${name}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { found: [...new Set(found)].sort(), unresolvedNames };
}
