/**
 * A request's own headers are the caller's (interfaces-adt 19.0.0).
 *
 * Every implementation of every member that takes `options.headers` sends that
 * pair as the request's `Accept` and `Content-Type`, and nothing else: no
 * constant of its own, no merge, no default, no override. The values below are
 * deliberately ones no implementation could hold as a constant, so a member
 * that still chose its own would send something else and fail here.
 *
 * The table is closed: every class method in `src` named like one of the 32
 * members is found with the TypeScript parser, and each must be reached by a
 * row here (or be listed in `NOT_A_HEADERS_MEMBER` with the contract it
 * implements instead). A new implementation of one of these members that is
 * not in the table fails the completeness check.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as ts from 'typescript';
import { AdtBatchConnection } from '../../batch';
import { AdtAbapGitClient } from '../../clients/AdtAbapGitClient';
import { AdtClient } from '../../clients/AdtClient';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { AdtExecutor } from '../../clients/AdtExecutor';
import { AdtUtils } from '../../core/shared/AdtUtils';
import { AdtUtilsLegacy } from '../../core/shared/AdtUtilsLegacy';
import { TraceScheduling } from '../../executors/traceScheduling';
import { AbapDebugger } from '../../runtime/debugger/AbapDebugger';
import { AmdpDebugger } from '../../runtime/debugger/AmdpDebugger';
import { createLibraryLogger } from '../helpers/testLogger';
import { HANDLERS } from './capabilities/manifest';

/** The 32 members of interfaces-adt 19.0.0 that take `options.headers`. */
const HEADER_MEMBERS = [
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
 * Class methods with one of those names that implement another contract's
 * member, which takes no `headers`.
 */
const NOT_A_HEADERS_MEMBER: Record<string, string> = {
  'Profiler.delete': 'ITraceDeletion.delete — no headers in 19.0.0',
  'AmdpDebugger.syncBreakpoints':
    'IAmdpDebugger.syncBreakpoints — only getDataPreview takes headers there',
};

/**
 * Members whose implementation sends no request at all: the legacy refusals of
 * an endpoint a legacy system does not have. They answer before any request,
 * so there is no wire to carry the pair.
 */
const SENDS_NO_REQUEST = new Set([
  'AdtPackageLegacy.create',
  'AdtPackageLegacy.updateMetadata',
  'AdtPackageLegacy.delete',
  'AdtRequestLegacy.create',
  'AdtRequestLegacy.updateMetadata',
  'AdtRequestLegacy.delete',
  'AdtUtilsLegacy.getSqlQuery',
  'AdtUtilsLegacy.getTableContents',
  // No deletion API on 7.40 (spec §4.3, §5).
  'AdtPackageLegacy.checkDeletion',
  'AdtUtilsLegacy.checkDeletionGroup',
  'AdtUtilsLegacy.deleteObjectsGroup',
  'AdtClassLegacy.checkDeletion',
  'AdtProgramLegacy.checkDeletion',
  'AdtInterfaceLegacy.checkDeletion',
  'AdtFunctionGroupLegacy.checkDeletion',
  'AdtFunctionModuleLegacy.checkDeletion',
  'AdtDdlLegacy.checkDeletion',
  'AdtIncludeLegacy.checkDeletion',
  'AdtIncludeLegacy.delete',
  'AdtFunctionIncludeLegacy.checkDeletion',
  'AdtFunctionIncludeLegacy.delete',
  'AdtMessageClassLegacy.checkDeletion',
  'AdtMessageClassLegacy.delete',
  // Measured 404 on 7.40 (spec §10.2).
  'AdtUtilsLegacy.getWhereUsed',
  'AdtUtilsLegacy.getWhereUsedScope',
  'AdtUtilsLegacy.getVirtualFoldersContents',
]);

/**
 * A member that is a chain — reads, locks, the write, unlocks. The pair is
 * the main write's (the PUT); the chain's own requests keep their constants.
 */
const CHAIN_MAIN_WRITE: Record<string, string> = {
  'AdtMessageClassMessage.create': 'PUT',
  'AdtMessageClassMessage.update': 'PUT',
  'AdtMessageClassMessage.delete': 'PUT',
};

type Recorded = {
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

function recordingConnection(): {
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
function pairFor(row: string): IAdtHeaders {
  const tag = row.replace(/[^a-zA-Z0-9]+/g, '-');
  return {
    accept: `application/x-test-accept-${tag}`,
    contentType: `application/x-test-ct-${tag}`,
  };
}

/** Every value under a header name, whatever its case. */
function valuesOf(headers: Record<string, unknown>, name: string): unknown[] {
  return Object.entries(headers)
    .filter(([key]) => key.toLowerCase() === name)
    .map(([, value]) => value);
}

/** The class that owns `member` on this handler's prototype chain. */
function ownerOf(handler: object, member: string): string {
  let proto: object | null = Object.getPrototypeOf(handler);
  while (proto && proto !== Object.prototype) {
    if (Object.hasOwn(proto, member)) {
      return (proto as { constructor: { name: string } }).constructor.name;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return Object.hasOwn(handler, member) ? '(own property)' : '(none)';
}

interface Row {
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
const IDENTITY = {
  debuggingMode: 'user' as const,
  requestUser: 'GUARD',
  terminalId: 'GUARD-TERMINAL',
  ideId: 'GUARD-IDE',
};

type AnyFn = (...args: unknown[]) => Promise<unknown>;
const m = (handler: unknown, member: string): AnyFn =>
  ((handler as Record<string, AnyFn>)[member] as AnyFn).bind(handler);

/** The object handlers of both clients, every header member each one has. */
function objectRows(): Row[] {
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
  for (const legacy of [false, true]) {
    for (const [name, entry] of Object.entries(HANDLERS)) {
      const config = entry.config as Record<string, unknown>;
      const build = (connection: IAbapConnection) =>
        (entry.factory as (c: AdtClient) => object)(
          legacy
            ? new AdtClientLegacy(connection, createLibraryLogger())
            : new AdtClient(connection, createLibraryLogger()),
        );
      const probe = build(recordingConnection().connection) as Record<
        string,
        unknown
      >;
      for (const member of members) {
        if (typeof probe[member] !== 'function') continue;
        rows.push({
          name: `${legacy ? 'legacy ' : ''}${name}`,
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
  }
  return rows;
}

function requestRows(): Row[] {
  const rows: Row[] = [];
  for (const legacy of [false, true]) {
    const build = (connection: IAbapConnection) =>
      (legacy
        ? new AdtClientLegacy(connection, createLibraryLogger())
        : new AdtClient(connection, createLibraryLogger())
      ).getRequest();
    const name = `${legacy ? 'legacy ' : ''}request`;
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

function utilRows(): Row[] {
  const rows: Row[] = [];
  for (const legacy of [false, true]) {
    const build = (connection: IAbapConnection) =>
      legacy
        ? new AdtUtilsLegacy(connection, createLibraryLogger())
        : new AdtUtils(connection, createLibraryLogger());
    const name = `${legacy ? 'legacy ' : ''}utils`;
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

function otherRows(): Row[] {
  const git = (connection: IAbapConnection) =>
    new AdtAbapGitClient(connection, createLibraryLogger());
  const abap = (connection: IAbapConnection) => new AbapDebugger(connection);
  const amdp = (connection: IAbapConnection) => new AmdpDebugger(connection);
  const trace = { description: 'guard' };
  return [
    {
      name: 'abapGit',
      member: 'link',
      build: git,
      call: (h, headers) =>
        m(h, 'link')(
          { package: 'ZGUARD_PKG', url: 'https://example/guard.git' },
          { headers },
        ),
    },
    {
      name: 'abapGit',
      member: 'pull',
      build: git,
      call: (h, headers) =>
        m(h, 'pull')(
          {
            package: 'ZGUARD_PKG',
            pullLink: '/sap/bc/adt/abapgit/repos/GUARD/pull',
          },
          { headers },
        ),
    },
    {
      name: 'abapGit',
      member: 'checkExternalRepo',
      build: git,
      call: (h, headers) =>
        m(h, 'checkExternalRepo')(
          { url: 'https://example/guard.git' },
          { headers },
        ),
    },
    {
      name: 'trace scheduling',
      member: 'scheduleTrace',
      build: (connection) => new TraceScheduling(connection),
      call: (h, headers) => m(h, 'scheduleTrace')({ ...trace, headers }),
    },
    {
      name: 'class executor',
      member: 'scheduleTrace',
      build: (connection) =>
        new AdtExecutor(connection, createLibraryLogger()).getClassExecutor(),
      call: (h, headers) => m(h, 'scheduleTrace')({ ...trace, headers }),
    },
    {
      name: 'program executor',
      member: 'scheduleTrace',
      build: (connection) =>
        new AdtExecutor(connection, createLibraryLogger()).getProgramExecutor(),
      call: (h, headers) => m(h, 'scheduleTrace')({ ...trace, headers }),
    },
    {
      name: 'abap debugger',
      member: 'setBreakpoints',
      build: abap,
      call: (h, headers) => m(h, 'setBreakpoints')(IDENTITY, [], { headers }),
    },
    {
      name: 'abap debugger',
      member: 'getChildVariables',
      build: abap,
      call: (h, headers) => m(h, 'getChildVariables')(['@ROOT'], { headers }),
    },
    {
      name: 'abap debugger',
      member: 'getVariables',
      build: abap,
      call: (h, headers) => m(h, 'getVariables')(['LV_GUARD'], { headers }),
    },
    {
      name: 'abap debugger',
      member: 'syncBreakpoints',
      build: abap,
      call: (h, headers) =>
        m(h, 'syncBreakpoints')(
          IDENTITY,
          { scope: 'full', breakpoints: [] },
          { headers },
        ),
    },
    {
      name: 'abap debugger',
      member: 'setDebuggerSettings',
      build: abap,
      call: (h, headers) => m(h, 'setDebuggerSettings')({}, { headers }),
    },
    {
      name: 'amdp debugger',
      member: 'getDataPreview',
      build: amdp,
      call: (h, headers) =>
        m(
          h,
          'getDataPreview',
        )({
          headers,
          sessionId: 'GUARD-SESSION',
          debuggerId: 'GUARD-DEBUGGER',
          debuggeeId: 'GUARD-DEBUGGEE',
          variableName: 'LT_GUARD',
        }),
    },
  ];
}

const ROWS: Row[] = [
  ...objectRows(),
  ...requestRows(),
  ...utilRows(),
  ...otherRows(),
];

/** The owner of each row's member, found once. */
function ownerOfRow(row: Row): string {
  const owner = ownerOf(
    row.build(recordingConnection().connection),
    row.member,
  );
  return `${owner}.${row.member}`;
}

describe('a request carries exactly the headers its caller gave', () => {
  for (const row of ROWS) {
    it(`${row.name}.${row.member}`, async () => {
      const { connection, calls } = recordingConnection();
      const handler = row.build(connection);
      const owner = ownerOf(handler, row.member);
      const key = `${owner}.${row.member}`;
      const pair = pairFor(`${row.name}.${row.member}`);

      await row.call(handler as never, pair);

      if (owner === '(own property)' || SENDS_NO_REQUEST.has(key)) {
        // A legacy refusal: it answers before any request is built.
        expect(calls).toEqual([]);
        return;
      }

      const mainVerb = CHAIN_MAIN_WRITE[key];
      const main = mainVerb
        ? calls.filter((c) => c.method === mainVerb)
        : calls;
      expect(main).toHaveLength(1);
      const [request] = main as [Recorded];
      expect(valuesOf(request.headers, 'accept')).toEqual([pair.accept]);
      expect(valuesOf(request.headers, 'content-type')).toEqual([
        pair.contentType,
      ]);

      // The chain's own requests keep their own headers: the pair is the
      // write's, and nowhere else.
      for (const other of calls.filter((c) => c !== request)) {
        expect(valuesOf(other.headers, 'accept')).not.toContain(pair.accept);
        expect(valuesOf(other.headers, 'content-type')).not.toContain(
          pair.contentType,
        );
      }
    });
  }
});

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
 * Computed member names the type checker could not resolve, as
 * `file: class [expression]`. Any entry fails the scan: a name it cannot read
 * is a member it cannot check.
 */
const unresolvedNames: string[] = [];

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
): string | undefined {
  // Every computed name is resolved, whatever the member is, so none is left
  // unread.
  const name = memberName(member.name, checker, where);
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

let declared: string[] | undefined;

/** Every class method in `src` (tests excluded) named like a header member. */
function declaredImplementations(): string[] {
  declared ??= scanImplementations();
  return declared;
}

function scanImplementations(): string[] {
  const root = join(__dirname, '..', '..');
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
  unresolvedNames.length = 0;
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
          const name = implementedName(member, checker, where);
          if (name && names.has(name)) found.push(`${className}.${name}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...new Set(found)].sort();
}

describe('the table covers every implementation', () => {
  it('every class implementing a header member is reached by a row', () => {
    const reached = new Set(ROWS.map(ownerOfRow));
    const missing = declaredImplementations().filter(
      (impl) => !reached.has(impl) && !(impl in NOT_A_HEADERS_MEMBER),
    );
    expect(missing).toEqual([]);
  });

  it('every computed member name in a scanned class resolves', () => {
    declaredImplementations();
    expect({
      'computed member names the scan cannot resolve to a string or a symbol (make them a string literal type, or cover them)':
        unresolvedNames,
    }).toEqual({
      'computed member names the scan cannot resolve to a string or a symbol (make them a string literal type, or cover them)':
        [],
    });
  });

  it('every exclusion still names a declared method', () => {
    const declared = new Set(declaredImplementations());
    for (const name of [
      ...Object.keys(NOT_A_HEADERS_MEMBER),
      ...SENDS_NO_REQUEST,
    ]) {
      expect(declared).toContain(name);
    }
  });
});

describe('the batch path', () => {
  it('a member recorded on an AdtBatchConnection carries the pair in its part', async () => {
    const send = jest.fn(async (_request: unknown) => ({
      status: 202,
      statusText: 'Accepted',
      headers: {
        'content-type': 'multipart/mixed; boundary="answer"; charset=utf-8',
      },
      data: '--answer\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200  OK\r\nContent-Type: application/xml\r\n\r\n<body/>\r\n--answer--\r\n',
    }));
    const connection = {
      makeAdtRequest: send,
      setSessionType: jest.fn(),
      connect: jest.fn(),
      getBaseUrl: async () => 'https://example.test',
      getSessionId: () => 'session',
    } as unknown as IAbapConnection;
    const batch = new AdtBatchConnection(connection, {
      endpoint: 'communication',
    });
    const pair = pairFor('batch.getVariables');

    const pending = m(new AbapDebugger(batch), 'getVariables')(['LV_GUARD'], {
      headers: pair,
    });
    await batch.execute();
    await pending;

    expect(send).toHaveBeenCalledTimes(1);
    const body = (send.mock.calls[0]?.[0] as { data: string } | undefined)
      ?.data;
    expect(body).toContain(`Accept: ${pair.accept}`);
    expect(body).toContain(`Content-Type: ${pair.contentType}`);
  });
});
