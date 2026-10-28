/**
 * Every public member the legacy client and the legacy executor hand out, and
 * the one decision each is held to, as recorded in
 * `docs/LEGACY.md` (measured on SAP_BASIS 7.40 SP04).
 *
 * `legacyMemberInventory.test.ts` walks every getter of `AdtClientLegacy` and
 * `AdtExecutorLegacy`, collects the members of what each returns through its
 * whole prototype chain (the own keys of an `absentOnLegacy` object included),
 * and requires each one in exactly one of {@link LEGACY_REFUSED} and
 * {@link LEGACY_SENDS}, unless {@link NON_PUBLIC} lists it as a member the
 * TypeScript source declares `private` or `protected`.
 *
 * Rows are keyed by getter, then by member. The two clients' own members sit
 * under the client's class name (`AdtClientLegacy`, `AdtExecutorLegacy`); a
 * symbol-keyed member is written `[Symbol.asyncDispose]`. A member whose
 * decision depends on its arguments has one row per case,
 * `member[case]`, and its cases are listed in {@link ARGUMENT_DEPENDENT}.
 */

import type { AdtTypeCode, IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
// The address records by the root's own module: the tests read records the
// root package does not export (the include kinds, the URI builders).
import {
  CLASS,
  CLASS_INCLUDE,
  type ClassIncludeKind,
  DDL_SOURCE,
  FUNCTION_GROUP,
  FUNCTION_INCLUDE,
  FUNCTION_MODULE,
  INTERFACE,
  MESSAGE_CLASS,
  PROGRAM,
  PROGRAM_INCLUDE,
  sourceUri,
  transportUri,
  versionsUri,
} from '../../../../adt-clients/src/endpoints/objects';
import { TRANSPORT_REQUEST_LEGACY } from '../../core/transport/readLegacy';

/** One request a member sends. */
export interface ExpectedRequest {
  readonly method: string;
  /** Built from the `src/endpoints/objects.ts` records; compared lowercased. */
  readonly path: string;
  /** Query keys the request carries: `true` = present, a string = that value. */
  readonly query?: Readonly<Record<string, string | true>>;
}

/**
 * The `Accept`/`Content-Type` pair a member is called with: the test passes
 * `headersOf` from `helpers/adtHeaders`. Injected rather than imported, so this
 * module stays importable from `adtHeaders.ts` itself.
 */
export type HeadersOf = (
  target: object,
  member: string,
  config?: object,
) => IAdtHeaders;

/** How a row calls its member, on its handler. */
export type Call = (
  target: Record<string, unknown>,
  headersOf: HeadersOf,
) => unknown;

export interface RefusedRow {
  /** The spec section that decides it. */
  readonly section: string;
  readonly call: Call;
}

export interface SendsRow {
  readonly section: string;
  readonly call: Call;
  /** Every request the member sends, in order; `[]` = nothing of its own. */
  readonly sends: readonly ExpectedRequest[];
  /** Fragments the (first) request's body carries — the `body` assertion. */
  readonly body?: readonly string[];
}

// ---------------------------------------------------------------------------
// How a row calls its member.

/** The lock handle every call that needs one passes. */
export const LOCK = 'GUARD-LOCK';
/** The content URI `getVersionSource` is handed, and must fetch. */
export const VERSION_URI = '/sap/bc/adt/guard/versions/1';

type Target = Record<string, unknown>;

function memberOf(target: Target, member: string) {
  return (target[member] as (...args: unknown[]) => unknown).bind(target);
}

/** `{ headers }` for a member of the handler being called. */
type Headers = (member: string, config?: object) => { headers: IAdtHeaders };

/** Call `member` with `args`, built with the handler's header pairs. */
export function calling(
  member: string,
  args: (headers: Headers) => unknown[] = () => [],
): Call {
  return (target, headersOf) =>
    memberOf(
      target,
      member,
    )(
      ...args((name, config) => ({
        headers: headersOf(target, name, config),
      })),
    );
}

/** Read an accessor. */
export function reading(member: string): Call {
  return (target) => target[member];
}

/**
 * The arguments an object handler's member takes, given its config: the
 * convention of `capabilities/behaviour.test.ts`'s `invoke`.
 */
export function standardCall(
  member: string,
  config: Record<string, unknown>,
): Call {
  switch (member) {
    case 'unlock':
      return calling(member, () => [config, LOCK]);
    case 'getVersionSource':
      return calling(member, () => [VERSION_URI]);
    case 'check':
      return calling(member, (h) => [config, 'inactive', h(member)]);
    case 'update':
    case 'updateMetadata':
      return calling(member, (h) => [
        config,
        {
          ...h(member, config),
          source: String(config.source ?? '" guard'),
          lockHandle: LOCK,
        },
      ]);
    case 'delete':
      return calling(member, (h) => [
        config,
        { ...h(member), lockHandle: LOCK },
      ]);
    case 'read':
      return calling(member, () => [config]);
    case 'activateTestClasses':
      return calling(member, () => [{ ...config, testClassName: 'LTCL' }]);
    default:
      return calling(member, (h) => [config, h(member, config)]);
  }
}

/** The config each getter's members are called with. */
export const CONFIGS: Record<string, Record<string, unknown>> = {
  getClass: {
    className: 'ZCL_GUARD',
    source: 'CLASS zcl_guard DEFINITION PUBLIC. ENDCLASS.',
    packageName: '$TMP',
    description: 'guard',
  },
  getLocalTestClass: {
    className: 'ZCL_GUARD',
    source: 'CLASS ltcl DEFINITION FOR TESTING.',
  },
  getLocalTypes: { className: 'ZCL_GUARD', source: 'TYPES ty_x TYPE i.' },
  getLocalDefinitions: {
    className: 'ZCL_GUARD',
    source: 'CLASS lcl DEFINITION.',
  },
  getLocalMacros: { className: 'ZCL_GUARD', source: 'DEFINE mac.' },
  getProgram: {
    programName: 'ZGUARD',
    source: 'REPORT zguard.',
    packageName: '$TMP',
    description: 'guard',
  },
  getInclude: {
    includeName: 'ZGUARD_INC',
    source: '" guard',
    packageName: '$TMP',
    description: 'guard',
  },
  getInterface: {
    interfaceName: 'ZIF_GUARD',
    source: 'INTERFACE zif_guard PUBLIC. ENDINTERFACE.',
    packageName: '$TMP',
    description: 'guard',
  },
  getFunctionGroup: {
    functionGroupName: 'ZGUARD_FG',
    packageName: '$TMP',
    description: 'guard',
  },
  getFunctionModule: {
    functionGroupName: 'ZGUARD_FG',
    functionModuleName: 'ZGUARD_FM',
    source: 'FUNCTION zguard_fm. ENDFUNCTION.',
    packageName: '$TMP',
    description: 'guard',
  },
  getFunctionInclude: {
    functionGroupName: 'ZGUARD_FG',
    includeName: 'LZGUARD_FGF01',
    source: '* include source',
    packageName: '$TMP',
    description: 'guard',
  },
  getDdl: {
    ddlName: 'ZGUARD_DDL',
    source: 'define view zguard_ddl as select from t000 { mandt }',
    packageName: '$TMP',
    description: 'guard',
  },
  getPackage: {
    packageName: 'ZGUARD_PKG',
    superPackage: '$TMP',
    description: 'guard',
  },
  getMessageClass: {
    name: 'ZGUARD_MSG',
    packageName: '$TMP',
    description: 'guard',
  },
  getMessageClassMessage: {
    className: 'ZGUARD_MSG',
    msgno: '001',
    msgtext: 'guard',
  },
  getRequest: { transportNumber: 'GUARD_REQUEST', description: 'guard' },
  getTransformation: {
    transformationName: 'ZGUARD_XSLT',
    transformationType: 'XSLT',
    source: '<xsl:transform version="1.0"/>',
    packageName: '$TMP',
    description: 'guard',
  },
  getScalarFunction: {
    scalarFunctionName: 'ZGUARD_DSFD',
    source: 'define function zguard_dsfd returns { x : abap.int4; }',
    packageName: '$TMP',
    description: 'guard',
  },
  getScalarFunctionImplementation: {
    implementationName: 'ZGUARD_DSFI',
    scalarFunctionName: 'ZGUARD_DSFD',
    source: 'METHOD guard. ENDMETHOD.',
    packageName: '$TMP',
    description: 'guard',
  },
  getAppendStructure: {
    appendStructureName: 'ZGUARD_APP',
    baseObject: 'ZGUARD_TAB',
    source: 'extend structure zguard_tab with zguard_app {}',
    packageName: '$TMP',
    description: 'guard',
  },
};

// ---------------------------------------------------------------------------
// The requests.

const ACTIVATION = '/sap/bc/adt/activation';
const CHECKRUNS = '/sap/bc/adt/checkruns';
const TESTRUNS = '/sap/bc/adt/abapunit/testruns';
const TRACE_REQUESTS = '/sap/bc/adt/runtime/traces/abaptraces/requests';
const TRACE_PARAMETERS = '/sap/bc/adt/runtime/traces/abaptraces/parameters';

function request(
  method: string,
  path: string,
  query?: Record<string, string | true>,
): ExpectedRequest {
  return query ? { method, path, query } : { method, path };
}
const get = (path: string, query?: Record<string, string | true>) =>
  request('GET', path, query);
const post = (path: string, query?: Record<string, string | true>) =>
  request('POST', path, query);
const put = (path: string, query?: Record<string, string | true>) =>
  request('PUT', path, query);

const lockOf = (uri: string) =>
  post(uri, { _action: 'LOCK', accessMode: 'MODIFY' });
const unlockOf = (uri: string) =>
  post(uri, { _action: 'UNLOCK', lockHandle: LOCK });
const activation = () => post(ACTIVATION, { method: 'activate' });
const checkRun = () => post(CHECKRUNS, { reporters: 'abapCheckRun' });
const writeWith = (uri: string) => put(uri, { lockHandle: LOCK });
/** §4.2: the consumer's lock handle on one DELETE of the object. */
const deleteWith = (uri: string) =>
  request('DELETE', uri, { lockHandle: LOCK });

// ---------------------------------------------------------------------------
// Row builders.

type Rows<T> = Record<string, T>;

/** The rows of one getter, called with its config unless a call is given. */
function rowsFor(getter: string) {
  const config = CONFIGS[getter] ?? {};
  return {
    sends: (
      member: string,
      section: string,
      sends: readonly ExpectedRequest[],
      call: Call = standardCall(member, config),
      body?: readonly string[],
    ): [string, SendsRow] => [
      member,
      body ? { section, call, sends, body } : { section, call, sends },
    ],
    refused: (
      member: string,
      section: string,
      call: Call = standardCall(member, config),
    ): [string, RefusedRow] => [member, { section, call }],
  };
}

/** Every member of a handler absentOnLegacy builds, or one Task 6 makes so. */
function absent(getter: string, members: readonly string[]): Rows<RefusedRow> {
  const { refused } = rowsFor(getter);
  return Object.fromEntries(members.map((m) => refused(m, '§10.1')));
}

const SOURCE_OBJECT_MEMBERS = [
  'activate',
  'check',
  'checkDeletion',
  'create',
  'delete',
  'getVersionSource',
  'getVersions',
  'lock',
  'read',
  'readMetadata',
  'readTransport',
  'unlock',
  'update',
  'validate',
] as const;

/**
 * The four local-include handlers: their own members, and the six they
 * inherit from `AdtClassMemberBase`, which address the container class (§10.3).
 */
function localInclude(getter: string, kind: ClassIncludeKind): Rows<SendsRow> {
  const { sends } = rowsFor(getter);
  const cls = CLASS.uri('ZCL_GUARD');
  const include = CLASS_INCLUDE.uri('ZCL_GUARD', kind);
  return Object.fromEntries([
    sends('read', '§10.3 measured', [get(include, { version: 'active' })]),
    sends('update', '§10.3: measured for the test classes, kept for the rest', [
      writeWith(include),
    ]),
    sends('delete', '§4.3 kept: update with empty source', [
      writeWith(include),
    ]),
    sends('check', '§10.3: measured for the test classes, kept for the rest', [
      checkRun(),
    ]),
    sends('validate', '§10.3 kept', [checkRun()]),
    sends('getVersions', '§10.3 kept', [get(versionsUri(include))]),
    sends('lock', '§10.3 inherited: the container class', [lockOf(cls)]),
    sends('unlock', '§10.3 inherited: the container class', [unlockOf(cls)]),
    sends('activate', '§10.3 inherited: the container class', [activation()]),
    sends('readMetadata', '§10.3 inherited: the container class', [get(cls)]),
    sends('getVersionSource', '§10.3 inherited, kept', [get(VERSION_URI)]),
  ]);
}

/** Placeholders, not request numbers of any system. */
const REQUEST = 'GUARD_REQUEST';
const TASK = 'GUARD_TASK';
const entry = { pgmid: 'R3TR', type: 'PROG', name: 'ZGUARD' };

const objectReferences = [{ name: 'ZGUARD', type: 'PROG/P' }];
const whereUsed = { object_name: 'ZGUARD', object_type: 'program' };

/** `getUtils().readObjectMetadata` / `readObjectSource`, by object type (§10.2). */
/**
 * The codes 7.40's reads refuse, by the ADT type tables' codes since
 * interfaces-adt 21.0.0 — the friendly names and lower-case spellings they
 * replaced (`domain`, `stru/dt`, `ttyp/df`, …) are no codes, and are refused
 * at compile time.
 */
const METADATA_REFUSED: readonly AdtTypeCode[] = [
  'DOMA/DD',
  'DTEL/DE',
  'TABL/DS',
  'TABL/DT',
  'TTYP/DA',
  'DEVC/K',
];
const SOURCE_REFUSED: readonly AdtTypeCode[] = ['TABL/DS', 'TABL/DT'];
const SERVED = {
  'PROG/P': PROGRAM.uri('ZGUARD'),
  'CLAS/OC': CLASS.uri('ZGUARD'),
} as const;

function byType(
  member: 'readObjectMetadata' | 'readObjectSource',
  refusedTypes: readonly string[],
): {
  cases: Record<string, { objectType: string; expect: 'refused' | 'sends' }>;
  refused: Rows<RefusedRow>;
  sends: Rows<SendsRow>;
} {
  const call = (objectType: string) =>
    calling(member, () => [objectType, 'ZGUARD']);
  const cases: Record<
    string,
    { objectType: string; expect: 'refused' | 'sends' }
  > = {};
  const refused: Rows<RefusedRow> = {};
  const sends: Rows<SendsRow> = {};
  for (const objectType of refusedTypes) {
    cases[objectType] = { objectType, expect: 'refused' };
    refused[`${member}[${objectType}]`] = {
      section: '§10.2',
      call: call(objectType),
    };
  }
  for (const [objectType, uri] of Object.entries(SERVED)) {
    cases[objectType] = { objectType, expect: 'sends' };
    sends[`${member}[${objectType}]`] = {
      section: '§10.2 measured through the handlers',
      call: call(objectType),
      sends: [get(member === 'readObjectSource' ? sourceUri(uri) : uri)],
    };
  }
  return { cases, refused, sends };
}

const METADATA = byType('readObjectMetadata', METADATA_REFUSED);
const SOURCE = byType('readObjectSource', SOURCE_REFUSED);

/** A runner's request: the modern synchronous one, with `<options>` (§6.2). */
const testRun = [post(TESTRUNS)];
const OPTIONS = ['<options>'];

// ---------------------------------------------------------------------------
// The tables.

const cls = rowsFor('getClass');
const prog = rowsFor('getProgram');
const intf = rowsFor('getInterface');
const fugr = rowsFor('getFunctionGroup');
const func = rowsFor('getFunctionModule');
const finc = rowsFor('getFunctionInclude');
const incl = rowsFor('getInclude');
const ddl = rowsFor('getDdl');
const pkg = rowsFor('getPackage');
const msag = rowsFor('getMessageClass');
const msg = rowsFor('getMessageClassMessage');
const tr = rowsFor('getRequest');
const utils = rowsFor('getUtils');

const CLASS_URI = CLASS.uri('ZCL_GUARD');
const PROGRAM_URI = PROGRAM.uri('ZGUARD');
const INTERFACE_URI = INTERFACE.uri('ZIF_GUARD');
const GROUP_URI = FUNCTION_GROUP.uri('ZGUARD_FG');
const MODULE_URI = FUNCTION_MODULE.uri('ZGUARD_FG', 'ZGUARD_FM');
const FINC_URI = FUNCTION_INCLUDE.uri('ZGUARD_FG', 'LZGUARD_FGF01');
const INCLUDE_URI = PROGRAM_INCLUDE.uri('ZGUARD_INC');
const DDL_URI = DDL_SOURCE.uri('ZGUARD_DDL');
const MSAG_URI = MESSAGE_CLASS.uri('ZGUARD_MSG');

/** The handlers absentOnLegacy builds today (§10.1), by their public members. */
const ABSENT = {
  getAccessControl: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getAppendStructure: [...SOURCE_OBJECT_MEMBERS],
  getAuthorizationField: [
    'activate',
    'check',
    'checkDeletion',
    'create',
    'delete',
    'lock',
    'readMetadata',
    'unlock',
    'updateMetadata',
    'validate',
  ],
  getBehaviorDefinition: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getBehaviorImplementation: [...SOURCE_OBJECT_MEMBERS],
  getDataElement: [
    'activate',
    'check',
    'checkDeletion',
    'create',
    'delete',
    'lock',
    'readMetadata',
    'readTransport',
    'unlock',
    'updateMetadata',
    'validate',
  ],
  getDomain: [
    'activate',
    'check',
    'checkDeletion',
    'create',
    'delete',
    'lock',
    'readMetadata',
    'readTransport',
    'unlock',
    'updateMetadata',
    'validate',
  ],
  getEnhancement: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getFeatureToggle: [
    'activate',
    'check',
    'checkDeletion',
    'checkState',
    'create',
    'delete',
    'getRuntimeState',
    'lock',
    'read',
    'readMetadata',
    'readSource',
    'switchOff',
    'switchOn',
    'unlock',
    'update',
    'updateMetadata',
    'validate',
  ],
  getMetadataExtension: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getScalarFunction: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getScalarFunctionImplementation: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getServiceBinding: [
    'activate',
    'check',
    'checkDeletion',
    'create',
    'delete',
    'getServiceBindingTypes',
    'getServiceGroup',
    'lock',
    'read',
    'readMetadata',
    'readTransport',
    'unlock',
    'update',
    'updateMetadata',
    'validate',
  ],
  getServiceDefinition: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getStructure: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getTable: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getTransformation: [...SOURCE_OBJECT_MEMBERS, 'updateMetadata'],
  getTableType: [
    'activate',
    'check',
    'checkDeletion',
    'create',
    'delete',
    'getVersionSource',
    'getVersions',
    'lock',
    'readMetadata',
    'readTransport',
    'unlock',
    'updateMetadata',
    'validate',
  ],
} as const;

const CLIENT_GETTERS = [
  'getAccessControl',
  'getAppendStructure',
  'getAuthorizationField',
  'getBehaviorDefinition',
  'getBehaviorImplementation',
  'getClass',
  'getDataElement',
  'getDdl',
  'getDomain',
  'getEnhancement',
  'getFeatureToggle',
  'getFunctionGroup',
  'getFunctionInclude',
  'getFunctionModule',
  'getInclude',
  'getInterface',
  'getLocalDefinitions',
  'getLocalMacros',
  'getLocalTestClass',
  'getLocalTypes',
  'getMessageClass',
  'getMessageClassMessage',
  'getMetadataExtension',
  'getPackage',
  'getProgram',
  'getRequest',
  'getScalarFunction',
  'getScalarFunctionImplementation',
  'getServiceBinding',
  'getServiceDefinition',
  'getStructure',
  'getTable',
  'getTableType',
  'getTransformation',
  'getUtils',
] as const;

const EXECUTOR_GETTERS = [
  'getClassExecutor',
  'getClassTestRunner',
  'getFunctionGroupTestRunner',
  'getFunctionModuleTestRunner',
  'getProgramExecutor',
  'getProgramTestRunner',
] as const;

/** A getter hands out its handler and sends nothing (§10.3a). */
function getters(names: readonly string[]): Rows<SendsRow> {
  return Object.fromEntries(
    names.map((name) => [
      name,
      { section: '§10.3a', call: calling(name), sends: [] },
    ]),
  );
}

export const LEGACY_REFUSED: Record<string, Rows<RefusedRow>> = {
  getClass: Object.fromEntries([
    cls.refused('checkDeletion', '§5'),
    cls.refused('readTransport', '§2 measured in B4'),
    cls.refused('updateMetadata', 'not measured on 7.40'),
  ]),
  ...Object.fromEntries(
    (
      [
        'getLocalTestClass',
        'getLocalTypes',
        'getLocalDefinitions',
        'getLocalMacros',
      ] as const
    ).map((getter) => [
      getter,
      Object.fromEntries([
        rowsFor(getter).refused('readTransport', '§10.3 measured in B4'),
      ]),
    ]),
  ),
  getProgram: Object.fromEntries([
    prog.refused('checkDeletion', '§5'),
    prog.refused('readTransport', '§2 measured in B4'),
    prog.refused('updateMetadata', 'not measured on 7.40'),
  ]),
  getInterface: Object.fromEntries([
    intf.refused('checkDeletion', '§5'),
    intf.refused('readTransport', '§2 measured in B4'),
    intf.refused('updateMetadata', 'not measured on 7.40'),
  ]),
  getFunctionGroup: Object.fromEntries([
    fugr.refused('checkDeletion', '§5'),
    fugr.refused('readTransport', '§2 measured in B4'),
    fugr.refused('read', 'not measured on 7.40'),
    fugr.refused('update', 'not measured on 7.40'),
  ]),
  getFunctionModule: Object.fromEntries([
    func.refused('checkDeletion', '§5'),
    func.refused('readTransport', '§2 measured in B4'),
    func.refused('updateMetadata', 'not measured on 7.40'),
  ]),
  getDdl: Object.fromEntries([
    ddl.refused('checkDeletion', '§5'),
    ddl.refused('readTransport', '§2 measured in B4'),
    ddl.refused('getVersions', '§2 measured in B4'),
    ddl.refused('getVersionSource', '§2 measured in B4'),
    ddl.refused('updateMetadata', 'not measured on 7.40'),
    ddl.refused(
      'checkCdsTestDoubles',
      '§10.3 stays refused',
      calling('checkCdsTestDoubles', () => ['ZGUARD_DDL']),
    ),
  ]),
  getFunctionInclude: Object.fromEntries([
    finc.refused('checkDeletion', '§5'),
    finc.refused('delete', '§4.3'),
  ]),
  getInclude: Object.fromEntries([
    incl.refused('checkDeletion', '§5'),
    incl.refused('updateMetadata', 'not measured on 7.40'),
  ]),
  getMessageClass: Object.fromEntries([
    msag.refused('checkDeletion', '§5'),
    msag.refused('updateMetadata', '§2 measured in B4'),
  ]),
  getPackage: Object.fromEntries([
    pkg.refused('create', '§8 measured'),
    pkg.refused('readMetadata', '§8 measured'),
    pkg.refused('updateMetadata', '§8'),
    pkg.refused('delete', '§8'),
    pkg.refused('validate', '§8'),
    pkg.refused('lock', '§8'),
    pkg.refused('unlock', '§8'),
    pkg.refused('readTransport', '§8'),
    pkg.refused('check', '§8'),
    pkg.refused('checkDeletion', '§8, §5 measured'),
  ]),
  getRequest: Object.fromEntries([
    tr.refused('create', '§7.2 measured'),
    tr.refused('updateMetadata', '§7.2'),
    tr.refused('delete', '§7.2'),
    tr.refused('searchConfigurations', '§7.2', calling('searchConfigurations')),
    tr.refused('checkDeletion', '§7.2'),
    tr.refused(
      'readObjects',
      '§7.2',
      calling('readObjects', () => [REQUEST]),
    ),
    tr.refused(
      'readActionLog',
      '§7.2',
      calling('readActionLog', () => [REQUEST]),
    ),
    tr.refused(
      'addObject',
      '§7.2',
      calling('addObject', (h) => [REQUEST, entry, h('addObject')]),
    ),
    tr.refused(
      'removeObject',
      '§7.2',
      calling('removeObject', (h) => [
        REQUEST,
        { ...entry, position: '000001' },
        h('removeObject'),
      ]),
    ),
    tr.refused(
      'moveObjects',
      '§7.2',
      calling('moveObjects', (h) => [
        REQUEST,
        TASK,
        [{ ...entry, position: '000001' }],
        h('moveObjects'),
      ]),
    ),
    tr.refused(
      'sortAndCompress',
      '§7.2',
      calling('sortAndCompress', () => [TASK]),
    ),
    tr.refused(
      'createTask',
      '§7.2',
      calling('createTask', (h) => [
        REQUEST,
        { ...h('createTask'), targetUser: 'GUARD' },
      ]),
    ),
    tr.refused(
      'changeTaskType',
      '§7.2',
      calling('changeTaskType', (h) => [TASK, 'S', h('changeTaskType')]),
    ),
  ]),
  getUtils: {
    ...Object.fromEntries([
      utils.refused(
        'getWhereUsed',
        '§10.2 measured',
        calling('getWhereUsed', (h) => [whereUsed, h('getWhereUsed')]),
      ),
      utils.refused(
        'getWhereUsedScope',
        '§10.2 measured',
        calling('getWhereUsedScope', (h) => [
          whereUsed,
          h('getWhereUsedScope'),
        ]),
      ),
      utils.refused(
        'getVirtualFoldersContents',
        '§10.2 measured',
        calling('getVirtualFoldersContents', (h) => [
          {},
          h('getVirtualFoldersContents'),
        ]),
      ),
      utils.refused('getAllTypes', '§10.2 measured', calling('getAllTypes')),
      utils.refused(
        'getActivationRun',
        '§10.2',
        calling('getActivationRun', () => ['GUARD']),
      ),
      utils.refused(
        'getActivationResults',
        '§10.2',
        calling('getActivationResults', () => ['GUARD']),
      ),
      utils.refused(
        'checkDeletionGroup',
        '§10.2, §5 measured',
        calling('checkDeletionGroup', (h) => [
          objectReferences,
          h('checkDeletionGroup'),
        ]),
      ),
      utils.refused(
        'deleteObjectsGroup',
        '§10.2, §4.3 measured',
        calling('deleteObjectsGroup', (h) => [
          objectReferences,
          undefined,
          h('deleteObjectsGroup'),
        ]),
      ),
      utils.refused(
        'getTableColumns',
        '§10.2 unchanged',
        calling('getTableColumns', () => ['ZGUARD_TAB']),
      ),
      utils.refused(
        'getTableContents',
        '§10.2 unchanged',
        calling('getTableContents', (h) => [
          { table_name: 'ZGUARD_TAB' },
          h('getTableContents'),
        ]),
      ),
      utils.refused(
        'getSqlQuery',
        '§10.2 unchanged',
        calling('getSqlQuery', (h) => [
          { sql_query: 'SELECT * FROM t000' },
          h('getSqlQuery'),
        ]),
      ),
      utils.refused(
        'getObjectProperties',
        '§10.2 unchanged',
        calling('getObjectProperties', () => [PROGRAM_URI]),
      ),
    ]),
    ...METADATA.refused,
    ...SOURCE.refused,
  },
  getClassTestRunner: {
    getStatus: {
      section: '§6.2',
      call: calling('getStatus', () => ['GUARD']),
    },
    getResult: {
      section: '§6.2',
      call: calling('getResult', () => ['GUARD']),
    },
  },
  getProgramTestRunner: {
    getStatus: {
      section: '§6.2',
      call: calling('getStatus', () => ['GUARD']),
    },
    getResult: {
      section: '§6.2',
      call: calling('getResult', () => ['GUARD']),
    },
  },
  getFunctionGroupTestRunner: {
    getStatus: {
      section: '§6.2',
      call: calling('getStatus', () => ['GUARD']),
    },
    getResult: {
      section: '§6.2',
      call: calling('getResult', () => ['GUARD']),
    },
  },
  getFunctionModuleTestRunner: {
    run: {
      section: '§6.2',
      call: calling('run', () => ['ZGUARD_FM']),
    },
    getStatus: {
      section: '§6.2',
      call: calling('getStatus', () => ['GUARD']),
    },
    getResult: {
      section: '§6.2',
      call: calling('getResult', () => ['GUARD']),
    },
  },
  getClassExecutor: {
    run: {
      section: '§6.3',
      call: calling('run', () => [{ className: 'ZCL_GUARD' }]),
    },
    runWithProfiler: {
      section: '§6.3',
      call: calling('runWithProfiler', () => [
        { className: 'ZCL_GUARD' },
        { profilerId: 'GUARD' },
      ]),
    },
    listObjectTypes: { section: '§6.3', call: calling('listObjectTypes') },
    listProcessTypes: { section: '§6.3', call: calling('listProcessTypes') },
  },
  getProgramExecutor: {
    run: {
      section: '§6.3',
      call: calling('run', () => [{ programName: 'ZGUARD' }]),
    },
    runWithProfiler: {
      section: '§6.3',
      call: calling('runWithProfiler', () => [
        { programName: 'ZGUARD' },
        { profilerId: 'GUARD' },
      ]),
    },
    listObjectTypes: { section: '§6.3', call: calling('listObjectTypes') },
    listProcessTypes: { section: '§6.3', call: calling('listProcessTypes') },
  },
  ...Object.fromEntries(
    Object.entries(ABSENT).map(([getter, members]) => [
      getter,
      absent(getter, members),
    ]),
  ),
};

export const LEGACY_SENDS: Record<string, Rows<SendsRow>> = {
  AdtClientLegacy: {
    ...getters(CLIENT_GETTERS),
    unlockAll: { section: '§10.3a', call: calling('unlockAll'), sends: [] },
    pendingLocks: {
      section: '§10.3a',
      call: reading('pendingLocks'),
      sends: [],
    },
    '[Symbol.asyncDispose]': {
      section: '§10.3a',
      call: (target) =>
        (
          target[Symbol.asyncDispose as unknown as string] as () => unknown
        ).call(target),
      sends: [],
    },
  },
  AdtExecutorLegacy: getters(EXECUTOR_GETTERS),
  getClass: Object.fromEntries([
    cls.sends('create', '§10.3 measured', [post(CLASS.collection)]),
    cls.sends('lock', '§10.3 measured', [lockOf(CLASS_URI)]),
    cls.sends('unlock', '§10.3 measured', [unlockOf(CLASS_URI)]),
    cls.sends('update', '§10.3 measured, §10.3a', [
      writeWith(sourceUri(CLASS_URI)),
    ]),
    cls.sends('delete', '§4.2 measured', [deleteWith(CLASS_URI)]),
    cls.sends('activate', '§10.3 measured', [activation()]),
    cls.sends('check', '§10.3 measured', [checkRun()]),
    cls.sends('read', '§10.3 measured', [get(sourceUri(CLASS_URI))]),
    cls.sends('readMetadata', '§10.3 measured', [get(CLASS_URI)]),
    cls.sends('getVersions', '§10.3 measured', [
      get(versionsUri(CLASS_INCLUDE.uri('ZCL_GUARD', 'main'))),
    ]),
    cls.sends('validate', '§10.3 kept', [post(CLASS.validation)]),
    cls.sends('getVersionSource', '§10.3 kept', [get(VERSION_URI)]),
    cls.sends('activateTestClasses', '§10.3 kept', [activation()]),
    cls.sends('readEnhancementElements', '§10.3 kept', [
      get(CLASS.enhancementElements('ZCL_GUARD')),
    ]),
    cls.sends('readEnhancementOptions', '§10.3 kept', [
      get(CLASS.enhancementOptions('ZCL_GUARD')),
    ]),
  ]),
  getLocalTestClass: localInclude('getLocalTestClass', 'testclasses'),
  getLocalTypes: localInclude('getLocalTypes', 'implementations'),
  getLocalDefinitions: localInclude('getLocalDefinitions', 'definitions'),
  getLocalMacros: localInclude('getLocalMacros', 'macros'),
  getProgram: Object.fromEntries([
    prog.sends('create', '§10.3 measured', [post(PROGRAM.collection)]),
    prog.sends('lock', '§10.3 measured', [lockOf(PROGRAM_URI)]),
    prog.sends('update', '§10.3 measured', [writeWith(sourceUri(PROGRAM_URI))]),
    prog.sends('unlock', '§10.3 measured', [unlockOf(PROGRAM_URI)]),
    prog.sends('delete', '§4.2 measured', [deleteWith(PROGRAM_URI)]),
    prog.sends('activate', '§10.3 measured', [activation()]),
    prog.sends('read', '§10.3 measured', [get(sourceUri(PROGRAM_URI))]),
    prog.sends('readMetadata', '§10.3 measured', [get(PROGRAM_URI)]),
    prog.sends('getVersions', '§10.3 measured', [
      get(versionsUri(sourceUri(PROGRAM_URI))),
    ]),
    prog.sends('validate', '§10.3 kept', [post(PROGRAM.validation)]),
    prog.sends('check', '§10.3 kept', [checkRun()]),
    prog.sends('getVersionSource', '§10.3 kept', [get(VERSION_URI)]),
    prog.sends('readEnhancementElements', '§10.3 kept', [
      get(PROGRAM.enhancementElements('ZGUARD')),
    ]),
    prog.sends('readEnhancementOptions', '§10.3 kept', [
      get(PROGRAM.enhancementOptions('ZGUARD')),
    ]),
  ]),
  getInterface: Object.fromEntries([
    intf.sends('create', '§10.3 measured', [post(INTERFACE.collection)]),
    intf.sends('lock', '§10.3 measured', [lockOf(INTERFACE_URI)]),
    intf.sends('unlock', '§10.3 measured', [unlockOf(INTERFACE_URI)]),
    intf.sends('delete', '§4.2 measured', [deleteWith(INTERFACE_URI)]),
    intf.sends('read', '§10.3 measured', [get(sourceUri(INTERFACE_URI))]),
    intf.sends('readMetadata', '§10.3 measured', [get(INTERFACE_URI)]),
    intf.sends('getVersions', '§10.3 measured', [
      get(versionsUri(sourceUri(INTERFACE_URI))),
    ]),
    intf.sends('update', '§10.3 kept', [writeWith(sourceUri(INTERFACE_URI))]),
    intf.sends('activate', '§10.3 kept', [activation()]),
    intf.sends('check', '§10.3 kept', [checkRun()]),
    intf.sends('validate', '§10.3 kept', [post(INTERFACE.validation)]),
    intf.sends('getVersionSource', '§10.3 kept', [get(VERSION_URI)]),
  ]),
  getFunctionGroup: Object.fromEntries([
    fugr.sends('create', '§10.3 measured', [post(FUNCTION_GROUP.collection)]),
    fugr.sends('lock', '§10.3 measured', [lockOf(GROUP_URI)]),
    fugr.sends('unlock', '§10.3 measured', [unlockOf(GROUP_URI)]),
    fugr.sends('delete', '§4.2 measured', [deleteWith(GROUP_URI)]),
    fugr.sends('readMetadata', '§10.3 measured', [get(GROUP_URI)]),
    fugr.sends('activate', '§10.3 measured', [activation()]),
    fugr.sends('updateMetadata', '§10.3 kept', [writeWith(GROUP_URI)]),
    fugr.sends('check', '§10.3 kept', [checkRun()]),
    fugr.sends('validate', '§10.3 kept', [post(FUNCTION_GROUP.validation)]),
    fugr.sends('readEnhancementElements', '§10.3 kept', [
      get(FUNCTION_GROUP.enhancementElements('ZGUARD_FG')),
    ]),
    fugr.sends('readEnhancementOptions', '§10.3 kept', [
      get(FUNCTION_GROUP.enhancementOptions('ZGUARD_FG')),
    ]),
  ]),
  getFunctionModule: Object.fromEntries([
    func.sends('create', '§10.3 measured', [
      post(FUNCTION_MODULE.collection('ZGUARD_FG')),
    ]),
    func.sends('lock', '§10.3 measured', [lockOf(MODULE_URI)]),
    func.sends('update', '§10.3 measured', [writeWith(sourceUri(MODULE_URI))]),
    func.sends('unlock', '§10.3 measured', [unlockOf(MODULE_URI)]),
    func.sends('delete', '§4.2 measured', [deleteWith(MODULE_URI)]),
    func.sends('activate', '§10.3 measured', [activation()]),
    func.sends('read', '§10.3 measured', [get(sourceUri(MODULE_URI))]),
    func.sends('readMetadata', '§10.3 measured', [get(MODULE_URI)]),
    func.sends('check', '§10.3 kept', [checkRun()]),
    func.sends('validate', '§10.3 kept', [post(FUNCTION_MODULE.validation)]),
    func.sends('getVersions', '§10.3 kept', [
      get(versionsUri(sourceUri(MODULE_URI))),
    ]),
    func.sends('getVersionSource', '§10.3 kept', [get(VERSION_URI)]),
  ]),
  getDdl: Object.fromEntries([
    ddl.sends('create', '§10.3 measured', [post(DDL_SOURCE.collection)]),
    ddl.sends('lock', '§10.3 measured', [lockOf(DDL_URI)]),
    ddl.sends('update', '§10.3 measured', [writeWith(sourceUri(DDL_URI))]),
    ddl.sends('unlock', '§10.3 measured', [unlockOf(DDL_URI)]),
    ddl.sends('delete', '§4.2 measured', [deleteWith(DDL_URI)]),
    ddl.sends('read', '§10.3 measured', [get(sourceUri(DDL_URI))]),
    ddl.sends('readMetadata', '§10.3 measured', [get(DDL_URI)]),
    ddl.sends('activate', '§10.3 kept', [activation()]),
    ddl.sends('check', '§10.3 kept', [checkRun()]),
    ddl.sends('validate', '§10.3 kept', [post(DDL_SOURCE.validation)]),
  ]),
  getFunctionInclude: Object.fromEntries([
    finc.sends('create', '§10.3 measured, §10.4', [
      post(FUNCTION_INCLUDE.collection('ZGUARD_FG')),
    ]),
    finc.sends('lock', '§10.3 measured', [lockOf(FINC_URI)]),
    finc.sends('update', '§10.3 measured', [writeWith(sourceUri(FINC_URI))]),
    finc.sends('unlock', '§10.3 measured', [unlockOf(FINC_URI)]),
    finc.sends('activate', '§10.3 measured', [activation()]),
    finc.sends('read', '§10.3 measured', [get(sourceUri(FINC_URI))]),
    finc.sends('readMetadata', '§10.3 kept', [get(FINC_URI)]),
    finc.sends('updateMetadata', '§10.3 kept', [writeWith(FINC_URI)]),
    finc.sends('check', '§10.3 kept', [checkRun()]),
    finc.sends('validate', '§10.3 kept: a GET of its group', [get(GROUP_URI)]),
    finc.sends('getVersions', '§10.3 kept', [
      get(versionsUri(sourceUri(FINC_URI))),
    ]),
    finc.sends('getVersionSource', '§10.3 kept', [get(VERSION_URI)]),
  ]),
  getInclude: Object.fromEntries([
    incl.sends('read', '§10.3 measured', [get(sourceUri(INCLUDE_URI))]),
    incl.sends('create', '§10.3 kept', [post(PROGRAM_INCLUDE.collection)]),
    incl.sends('update', '§10.3 kept', [writeWith(sourceUri(INCLUDE_URI))]),
    incl.sends('delete', '§2 measured in B4', [deleteWith(INCLUDE_URI)]),
    incl.sends('lock', '§10.3 kept', [lockOf(INCLUDE_URI)]),
    incl.sends('unlock', '§10.3 kept', [unlockOf(INCLUDE_URI)]),
    incl.sends('activate', '§10.3 kept', [activation()]),
    incl.sends('validate', '§10.3 kept', [post(PROGRAM_INCLUDE.validation)]),
    incl.sends('readMetadata', '§10.3 kept', [get(INCLUDE_URI)]),
    incl.sends('readEnhancementElements', '§10.3 kept', [
      get(PROGRAM_INCLUDE.enhancementElements('ZGUARD_INC')),
    ]),
    incl.sends('readEnhancementOptions', '§10.3 kept', [
      get(PROGRAM_INCLUDE.enhancementOptions('ZGUARD_INC')),
    ]),
  ]),
  getMessageClass: Object.fromEntries([
    msag.sends('readMetadata', '§10.3 measured', [get(MSAG_URI)]),
    msag.sends('create', '§10.3 kept', [post(MESSAGE_CLASS.collection)]),
    msag.sends('delete', '§2 measured in B4', [deleteWith(MSAG_URI)]),
    msag.sends('lock', '§10.3 kept', [lockOf(MSAG_URI)]),
    msag.sends('unlock', '§10.3 kept', [unlockOf(MSAG_URI)]),
    msag.sends('validate', '§10.3 kept', [post(MESSAGE_CLASS.validation)]),
  ]),
  getMessageClassMessage: Object.fromEntries([
    msg.sends('read', '§10.3 measured', [get(MSAG_URI)]),
    msg.sends('readMetadata', '§10.3 kept', [get(MSAG_URI)]),
    ...(['create', 'update', 'delete'] as const).map((member) =>
      msg.sends(member, '§10.3 kept, §4.3', [
        get(MSAG_URI),
        post(`${MSAG_URI}/messages/001`, { _action: 'LOCK_MSG' }),
        post(MSAG_URI, { _action: 'LOCK', msgNo: '001' }),
        writeWith(MSAG_URI),
        unlockOf(MSAG_URI),
        post(`${MSAG_URI}/messages/001`, { _action: 'UNLOCK_ALL' }),
      ]),
    ),
  ]),
  getRequest: Object.fromEntries([
    tr.sends(
      'list',
      '§7.2 measured',
      [get(TRANSPORT_REQUEST_LEGACY.collection)],
      calling('list', () => [{}]),
    ),
    tr.sends('readMetadata', '§7.2 measured', [
      get(TRANSPORT_REQUEST_LEGACY.collection),
    ]),
  ]),
  getUtils: {
    ...Object.fromEntries([
      utils.sends(
        'search',
        '§10.2 measured',
        [
          get('/sap/bc/adt/repository/informationsystem/search', {
            operation: 'quickSearch',
            query: true,
          }),
        ],
        calling('search', () => [{ query: 'ZGUARD*' }]),
      ),
      utils.sends(
        'fetchNodeStructure',
        '§10.2 measured',
        [
          post('/sap/bc/adt/repository/nodestructure', {
            parent_type: 'DEVC/K',
            parent_name: '$TMP',
          }),
        ],
        calling('fetchNodeStructure', (h) => [
          'DEVC/K',
          '$TMP',
          h('fetchNodeStructure'),
        ]),
      ),
      utils.sends(
        'getObjectStructure',
        '§10.2 measured',
        [
          get('/sap/bc/adt/repository/objectstructure', {
            objecttype: 'CLAS/OC',
            objectname: true,
          }),
        ],
        calling('getObjectStructure', () => ['CLAS/OC', 'ZCL_GUARD']),
      ),
      utils.sends(
        'discovery',
        '§10.2 measured',
        [get('/sap/bc/adt/discovery')],
        calling('discovery'),
      ),
      utils.sends(
        'getInactiveObjects',
        '§10.2 measured',
        [get(`${ACTIVATION}/inactiveobjects`)],
        calling('getInactiveObjects'),
      ),
      utils.sends(
        'activateObjectsGroup',
        '§10.2 legacy override',
        [post(ACTIVATION, { method: 'activate', preauditRequested: 'false' })],
        calling('activateObjectsGroup', (h) => [
          objectReferences,
          false,
          h('activateObjectsGroup'),
        ]),
      ),
      utils.sends(
        'getInclude',
        '§10.2 kept',
        [get(sourceUri(INCLUDE_URI))],
        calling('getInclude', () => ['ZGUARD_INC']),
      ),
      utils.sends(
        'modifyWhereUsedScope',
        '§10.2 kept: edits XML, sends nothing',
        [],
        calling('modifyWhereUsedScope', () => [
          '<scope/>',
          { enableAll: true },
        ]),
      ),
      utils.sends(
        'supportsSourceCode',
        '§10.2 kept: pure',
        [],
        calling('supportsSourceCode', () => ['PROG/P']),
      ),
      utils.sends(
        'getObjectSourceUri',
        '§10.2 kept: pure',
        [],
        calling('getObjectSourceUri', () => ['PROG/P', 'ZGUARD']),
      ),
      utils.sends(
        'getTypeStructure',
        '§10.2 recorded on 7.40 SP04: 200, 464 types',
        [post('/sap/bc/adt/repository/typestructure')],
        calling('getTypeStructure', (h) => [h('getTypeStructure')]),
      ),
    ]),
    ...METADATA.sends,
    ...SOURCE.sends,
  },
  getClassTestRunner: {
    run: {
      section: '§6.2',
      call: calling('run', () => ['ZCL_GUARD']),
      sends: testRun,
      body: OPTIONS,
    },
    runSync: {
      section: '§6.2 measured',
      call: calling('runSync', () => ['ZCL_GUARD']),
      sends: testRun,
      body: OPTIONS,
    },
  },
  getProgramTestRunner: {
    run: {
      section: '§6.2',
      call: calling('run', () => ['ZGUARD']),
      sends: testRun,
      body: OPTIONS,
    },
    runSync: {
      section: '§6.2 measured',
      call: calling('runSync', () => ['ZGUARD']),
      sends: testRun,
      body: OPTIONS,
    },
  },
  getFunctionGroupTestRunner: {
    run: {
      section: '§6.2',
      call: calling('run', () => ['ZGUARD_FG']),
      sends: testRun,
      body: OPTIONS,
    },
    runSync: {
      section: '§6.2 measured',
      call: calling('runSync', () => ['ZGUARD_FG']),
      sends: testRun,
      body: OPTIONS,
    },
  },
  getFunctionModuleTestRunner: {
    runSync: {
      section: '§6.2 measured',
      call: calling('runSync', () => [
        { functionGroupName: 'ZGUARD_FG', functionModuleName: 'ZGUARD_FM' },
      ]),
      sends: testRun,
      body: OPTIONS,
    },
  },
  getClassExecutor: traceKept(),
  getProgramExecutor: traceKept(),
};

/** §6.3: the trace collections 7.40 advertises; kept. */
function traceKept(): Rows<SendsRow> {
  return {
    listRequests: {
      section: '§6.3 kept',
      call: calling('listRequests'),
      sends: [get(TRACE_REQUESTS)],
    },
    getRequestsByUri: {
      section: '§6.3 kept',
      call: calling('getRequestsByUri', () => [CLASS_URI]),
      sends: [get(TRACE_REQUESTS, { uri: true })],
    },
    scheduleTrace: {
      section: '§6.3 kept',
      call: calling('scheduleTrace', (h) => [h('scheduleTrace')]),
      sends: [post(TRACE_PARAMETERS)],
    },
  };
}

/** Runtime-visible members the TypeScript source declares private/protected. */
export const NON_PUBLIC: Record<string, { file: string; className: string }> = {
  'AdtClientLegacy.assertConnected': {
    file: '../adt-clients/src/clients/AdtClient.ts',
    className: 'AdtClient',
  },
  ...Object.fromEntries(
    [
      'getClass',
      'getLocalTestClass',
      'getLocalTypes',
      'getLocalDefinitions',
      'getLocalMacros',
    ].map((getter) => [
      `${getter}.includeVersions`,
      {
        file: '../adt-clients/src/core/class/AdtClassMemberBase.ts',
        className: 'AdtClassMemberBase',
      },
    ]),
  ),
  ...Object.fromEntries(
    ['lockKey', 'trackLock', 'untrackLock', 'names'].map((member) => [
      `getFunctionModule.${member}`,
      {
        file: '../adt-clients/src/core/functionModule/AdtFunctionModule.ts',
        className: 'AdtFunctionModule',
      },
    ]),
  ),
  ...Object.fromEntries(
    [
      'lockKey',
      'trackLock',
      'untrackLock',
      'names',
      'buildCreateParams',
      'buildDeleteParams',
      'sourceArtifactContentType',
    ].map((member) => [
      `getFunctionInclude.${member}`,
      {
        file: '../adt-clients/src/core/functionInclude/AdtFunctionInclude.ts',
        className: 'AdtFunctionInclude',
      },
    ]),
  ),
  ...Object.fromEntries(
    ['names', 'writeClass'].map((member) => [
      `getMessageClassMessage.${member}`,
      {
        file: '../adt-clients/src/core/messageClass/AdtMessageClassMessage.ts',
        className: 'AdtMessageClassMessage',
      },
    ]),
  ),
  'getRequest.number': {
    file: '../adt-clients/src/core/transport/AdtRequest.ts',
    className: 'AdtRequest',
  },
  'getUtils.refuse': {
    file: 'src/core/shared/AdtUtilsLegacy.ts',
    className: 'AdtUtilsLegacy',
  },
  ...Object.fromEntries(
    [
      'getClassTestRunner',
      'getProgramTestRunner',
      'getFunctionGroupTestRunner',
      'getFunctionModuleTestRunner',
    ].flatMap((getter) =>
      ['startByObject', 'startSync'].map((member) => [
        `${getter}.${member}`,
        {
          file: '../adt-clients/src/executors/abapUnitRunner.ts',
          className: 'AbapUnitRunner',
        },
      ]),
    ),
  ),
  ...Object.fromEntries(
    (
      [
        [
          'getPackage',
          '../adt-clients/src/core/package/AdtPackage.ts',
          'AdtPackage',
        ],
        ['getDdl', '../adt-clients/src/core/ddl/AdtDdl.ts', 'AdtDdl'],
        [
          'getMessageClass',
          '../adt-clients/src/core/messageClass/AdtMessageClass.ts',
          'AdtMessageClass',
        ],
        [
          'getTransformation',
          '../adt-clients/src/core/transformation/AdtTransformation.ts',
          'AdtTransformation',
        ],
        [
          'getScalarFunction',
          '../adt-clients/src/core/scalarFunction/AdtScalarFunction.ts',
          'AdtScalarFunction',
        ],
        [
          'getScalarFunctionImplementation',
          '../adt-clients/src/core/scalarFunctionImplementation/AdtScalarFunctionImplementation.ts',
          'AdtScalarFunctionImplementation',
        ],
        [
          'getAppendStructure',
          '../adt-clients/src/core/appendStructure/AdtAppendStructure.ts',
          'AdtAppendStructure',
        ],
        [
          'getAccessControl',
          '../adt-clients/src/core/accessControl/AdtAccessControl.ts',
          'AdtAccessControl',
        ],
        [
          'getAuthorizationField',
          '../adt-clients/src/core/authorizationField/AdtAuthorizationField.ts',
          'AdtAuthorizationField',
        ],
        [
          'getBehaviorDefinition',
          '../adt-clients/src/core/behaviorDefinition/AdtBehaviorDefinition.ts',
          'AdtBehaviorDefinition',
        ],
        [
          'getBehaviorImplementation',
          '../adt-clients/src/core/behaviorImplementation/AdtBehaviorImplementation.ts',
          'AdtBehaviorImplementation',
        ],
        [
          'getDataElement',
          '../adt-clients/src/core/dataElement/AdtDataElement.ts',
          'AdtDataElement',
        ],
        [
          'getDomain',
          '../adt-clients/src/core/domain/AdtDomain.ts',
          'AdtDomain',
        ],
        [
          'getEnhancement',
          '../adt-clients/src/core/enhancement/AdtEnhancement.ts',
          'AdtEnhancement',
        ],
        [
          'getFeatureToggle',
          '../adt-clients/src/core/featureToggle/AdtFeatureToggle.ts',
          'AdtFeatureToggle',
        ],
        [
          'getMetadataExtension',
          '../adt-clients/src/core/metadataExtension/AdtMetadataExtension.ts',
          'AdtMetadataExtension',
        ],
        [
          'getServiceBinding',
          '../adt-clients/src/core/service/AdtService.ts',
          'AdtServiceBinding',
        ],
        [
          'getServiceDefinition',
          '../adt-clients/src/core/serviceDefinition/AdtServiceDefinition.ts',
          'AdtServiceDefinition',
        ],
        [
          'getStructure',
          '../adt-clients/src/core/structure/AdtStructure.ts',
          'AdtStructure',
        ],
        ['getTable', '../adt-clients/src/core/table/AdtTable.ts', 'AdtTable'],
        [
          'getTableType',
          '../adt-clients/src/core/tabletype/AdtDdicTableType.ts',
          'AdtDdicTableType',
        ],
      ] as const
    ).map(([getter, file, className]) => [
      `${getter}.name`,
      { file, className },
    ]),
  ),
  'getEnhancement.enhancementType': {
    file: '../adt-clients/src/core/enhancement/AdtEnhancement.ts',
    className: 'AdtEnhancement',
  },
  ...Object.fromEntries(
    ['createParams', 'deleteParams', 'switchTo'].map((member) => [
      `getFeatureToggle.${member}`,
      {
        file: '../adt-clients/src/core/featureToggle/AdtFeatureToggle.ts',
        className: 'AdtFeatureToggle',
      },
    ]),
  ),
  ...Object.fromEntries(
    [
      'buildServiceBindingCreateXml',
      'buildTransportCheckXml',
      'buildDeletionXml',
      'publishByServiceType',
      'unpublishByServiceType',
      'bindingTypesRequest',
      'deletionCheckRequest',
      'transportCheckRequest',
      'createRequest',
      'readRequest',
      'updateRequest',
      'deleteRequest',
      'checkRequest',
      'activateRequest',
      'serviceGroupRequest',
    ].map((member) => [
      `getServiceBinding.${member}`,
      {
        file: '../adt-clients/src/core/service/AdtService.ts',
        className: 'AdtServiceBinding',
      },
    ]),
  ),
};

/** Members whose decision depends on their arguments, by case (§10.2). */
export const ARGUMENT_DEPENDENT: Record<
  string,
  Record<string, { objectType: string; expect: 'refused' | 'sends' }>
> = {
  'getUtils.readObjectMetadata': METADATA.cases,
  'getUtils.readObjectSource': SOURCE.cases,
};
