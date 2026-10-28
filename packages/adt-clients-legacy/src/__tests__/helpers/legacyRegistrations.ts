/**
 * What the legacy classes bring to the shared harness, through its seams:
 * - the header pairs they send (`registerHeaderPairs`);
 * - the members and the absent types that answer a refusal and send no
 *   request (`registerRefusedMembers`, `registerRefusingHandler`);
 * - how a legacy session is built: the legacy client's factory and the
 *   on-premise HTTP wire of a legacy configuration.
 *
 * The harness (`adtHeaders.ts`, `sessionConfig.ts`) imports nothing of
 * legacy; a legacy test or helper imports this module, whose registrations
 * run once per test file on import. Its home until the legacy classes move to
 * their own package, which takes it with them.
 */

import type {
  IAdtClientOptions,
  IAdtHeaders,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  type IHandlerClass,
  registerHeaderPairs,
  registerRefusedMembers,
  registerRefusingHandler,
} from '../../../../adt-clients/src/__tests__/helpers/adtHeaders';
import type {
  ITestConnectionOptions,
  TestClientFactory,
} from '../../../../adt-clients/src/__tests__/helpers/sessionConfig';
import { AdtClientLegacy } from '../../clients/AdtClientLegacy';
import { AdtClassLegacy } from '../../core/class/AdtClassLegacy';
import { AdtLocalDefinitionsLegacy } from '../../core/class/AdtLocalDefinitionsLegacy';
import { AdtLocalMacrosLegacy } from '../../core/class/AdtLocalMacrosLegacy';
import { AdtLocalTestClassLegacy } from '../../core/class/AdtLocalTestClassLegacy';
import { AdtLocalTypesLegacy } from '../../core/class/AdtLocalTypesLegacy';
import { AdtDdlLegacy } from '../../core/ddl/AdtDdlLegacy';
import { AdtFunctionGroupLegacy } from '../../core/functionGroup/AdtFunctionGroupLegacy';
import { AdtFunctionIncludeLegacy } from '../../core/functionInclude/AdtFunctionIncludeLegacy';
import { AdtFunctionModuleLegacy } from '../../core/functionModule/AdtFunctionModuleLegacy';
import { AdtIncludeLegacy } from '../../core/include/AdtIncludeLegacy';
import { AdtInterfaceLegacy } from '../../core/interface/AdtInterfaceLegacy';
import { AdtMessageClassLegacy } from '../../core/messageClass/AdtMessageClassLegacy';
import { AdtPackageLegacy } from '../../core/package/AdtPackageLegacy';
import { AdtProgramLegacy } from '../../core/program/AdtProgramLegacy';
import { AdtUtilsLegacy } from '../../core/shared/AdtUtilsLegacy';
import { AdtRequestLegacy } from '../../core/transport/AdtRequestLegacy';
import { ClassExecutorLegacy } from '../../executors/class/ClassExecutorLegacy';
import { ClassTestRunnerLegacy } from '../../executors/class/ClassTestRunnerLegacy';
import { FunctionGroupTestRunnerLegacy } from '../../executors/functionGroup/FunctionGroupTestRunnerLegacy';
import { FunctionModuleTestRunnerLegacy } from '../../executors/functionModule/FunctionModuleTestRunnerLegacy';
import { ProgramExecutorLegacy } from '../../executors/program/ProgramExecutorLegacy';
import { ProgramTestRunnerLegacy } from '../../executors/program/ProgramTestRunnerLegacy';

/** `application/xml` both ways. */
const XML: IAdtHeaders = {
  accept: 'application/xml',
  contentType: 'application/xml',
};

/**
 * The pairs the legacy classes send where the modern class's would not do,
 * per class, member by member (formerly under their names in
 * `SENT_BEFORE_36`).
 */
export const LEGACY_HEADER_PAIRS: [
  IHandlerClass,
  Record<string, IAdtHeaders>,
][] = [
  // completed for 36.0.0: accept was not sent, contentType was not sent
  [AdtClassLegacy, { delete: XML }],
  // completed for 36.0.0: accept was not sent, contentType was not sent
  [AdtDdlLegacy, { delete: XML }],
  // completed for 36.0.0: accept was not sent, contentType was not sent
  [AdtFunctionGroupLegacy, { delete: XML, activate: XML }],
  // measured on 7.40 SP04 over RFC: v2 answers 400 "No content handler found"
  [
    AdtFunctionIncludeLegacy,
    {
      create: {
        accept: 'application/vnd.sap.adt.functions.fincludes+xml',
        contentType: 'application/vnd.sap.adt.functions.fincludes+xml',
      },
    },
  ],
  // completed for 36.0.0: accept was not sent, contentType was not sent
  [AdtFunctionModuleLegacy, { delete: XML }],
  // completed for 36.0.0: accept was not sent, contentType was not sent
  [AdtInterfaceLegacy, { delete: XML }],
  // completed for 36.0.0: accept was not sent, contentType was not sent
  [AdtProgramLegacy, { delete: XML }],
  // measured on 7.40 SP04 (B4-cycles-20261026-2019): the delete under the
  // lock; the create with the unversioned type both ways (n1-create-alt:
  // 200), where v2 answers 400 ExceptionContentHandlerNotFound (n1-create)
  [
    AdtIncludeLegacy,
    {
      delete: XML,
      create: {
        accept: 'application/vnd.sap.adt.programs.includes+xml',
        contentType: 'application/vnd.sap.adt.programs.includes+xml',
      },
    },
  ],
  [AdtMessageClassLegacy, { delete: XML }],
  [
    AdtUtilsLegacy,
    {
      activateObjectsGroup: XML,
      // The override refuses a code 7.40 lacks, and otherwise sends the base's
      // request with the base's pair (`AdtUtils.fetchNodeStructure`).
      fetchNodeStructure: {
        accept:
          'application/vnd.sap.as+xml;dataname=com.sap.adt.RepositoryObjectTreeContent, application/vnd.sap.adt.repository.nodestructure.v1+xml, application/xml',
        contentType: 'application/vnd.sap.as+xml; charset=UTF-8; dataname=null',
      },
    },
  ],
];

/**
 * Legacy members that answer a refusal and send no request (the class
 * overrides the member with one that returns `failed(...)` at once). A member
 * qualifies only when it **is** that class's own function, compared by
 * identity, so a test handler or another class of the same name does not.
 * The list is the class-handler rows of `LEGACY_REFUSED`
 * (`helpers/legacyMembers.ts`), member for member — `integrationHeadersOf.test.ts`
 * holds the two together, and `legacyMemberInventory.test.ts` calls each row
 * on a recording connection and proves that no request leaves.
 */
export const REFUSED_WITHOUT_REQUEST: [IHandlerClass, string[]][] = [
  [
    AdtPackageLegacy,
    [
      'create',
      'updateMetadata',
      'delete',
      'checkDeletion',
      'lock',
      'unlock',
      'readTransport',
      'check',
      // Refused before this change, and still: the item resource answered
      // 404 to the read (spec §8).
      'readMetadata',
      'validate',
    ],
  ],
  [
    AdtRequestLegacy,
    [
      'create',
      'updateMetadata',
      'delete',
      'searchConfigurations',
      'checkDeletion',
      'readObjects',
      'readActionLog',
      'addObject',
      'removeObject',
      'moveObjects',
      'sortAndCompress',
      'createTask',
      'changeTaskType',
    ],
  ],
  [
    AdtUtilsLegacy,
    [
      'getSqlQuery',
      'getTableContents',
      'checkDeletionGroup',
      'deleteObjectsGroup',
      // Measured 404 on 7.40, or no run to ask about (spec §10.2).
      'getWhereUsed',
      'getWhereUsedScope',
      'getVirtualFoldersContents',
      'getAllTypes',
      'getActivationRun',
      'getActivationResults',
      // Refused on legacy before this change, and still (spec §10.2).
      'getTableColumns',
      'getObjectProperties',
    ],
  ],
  // No deletion API on 7.40 (spec §4.3, §5); updateMetadata not measured there.
  [AdtClassLegacy, ['checkDeletion', 'readTransport', 'updateMetadata']],
  // The includes' inherited readTransport asks for the class's (B4 c6).
  [AdtLocalTestClassLegacy, ['readTransport']],
  [AdtLocalTypesLegacy, ['readTransport']],
  [AdtLocalDefinitionsLegacy, ['readTransport']],
  [AdtLocalMacrosLegacy, ['readTransport']],
  [AdtProgramLegacy, ['checkDeletion', 'readTransport', 'updateMetadata']],
  [AdtInterfaceLegacy, ['checkDeletion', 'readTransport', 'updateMetadata']],
  [
    AdtFunctionGroupLegacy,
    ['checkDeletion', 'readTransport', 'read', 'update'],
  ],
  [
    AdtFunctionModuleLegacy,
    ['checkDeletion', 'readTransport', 'updateMetadata'],
  ],
  // `checkCdsTestDoubles` stays refused (spec §10.3).
  [
    AdtDdlLegacy,
    [
      'checkDeletion',
      'checkCdsTestDoubles',
      'readTransport',
      'getVersions',
      'getVersionSource',
      'updateMetadata',
    ],
  ],
  [AdtIncludeLegacy, ['checkDeletion', 'updateMetadata']],
  [AdtFunctionIncludeLegacy, ['checkDeletion', 'delete']],
  [AdtMessageClassLegacy, ['checkDeletion', 'updateMetadata']],
  // A legacy run is answered finished, with no run id to ask about; the
  // function module's `run` takes no function group, which its URI needs
  // (spec §6.2).
  [ClassTestRunnerLegacy, ['getStatus', 'getResult']],
  [ProgramTestRunnerLegacy, ['getStatus', 'getResult']],
  [FunctionGroupTestRunnerLegacy, ['getStatus', 'getResult']],
  [FunctionModuleTestRunnerLegacy, ['run', 'getStatus', 'getResult']],
  // The runs, the profiled runs and the trace type lists: not advertised on
  // 7.40, or no class run there at all (spec §6.3).
  [
    ClassExecutorLegacy,
    ['run', 'runWithProfiler', 'listObjectTypes', 'listProcessTypes'],
  ],
  [
    ProgramExecutorLegacy,
    ['run', 'runWithProfiler', 'listObjectTypes', 'listProcessTypes'],
  ],
];

/**
 * The types `AdtClientLegacy` hands out through `absentOnLegacy`: a plain
 * object whose every member answers a refusal without a request. Each name is
 * the handler's `objectType` and its factory's suffix (`getDomain`, …).
 */
const ABSENT_ON_LEGACY = [
  'Domain',
  'DataElement',
  'Structure',
  'Table',
  'TableType',
  'AccessControl',
  'ServiceDefinition',
  'ServiceBinding',
  'BehaviorDefinition',
  'BehaviorImplementation',
  'MetadataExtension',
  'Enhancement',
  'AuthorizationField',
  'FeatureToggle',
  'Transformation',
  'ScalarFunction',
  'ScalarFunctionImplementation',
  'AppendStructure',
];

/** A connection that refuses every request: the reference handlers send none. */
const NO_CONNECTION = {
  makeAdtRequest: () => {
    throw new Error('a legacy refusal handler sent a request');
  },
} as unknown as IAbapConnection;

/**
 * Whether `handler` is a handler `absentOnLegacy` made: its `objectType` is
 * one of {@link ABSENT_ON_LEGACY}, and it matches the handler the legacy
 * client's own factory hands out for that type — the same keys, and the
 * member the same refusal (`absentOnLegacy` builds each member from one
 * source, so a member with any other body is not a refusal).
 */
function isAbsentOnLegacy(handler: object, member: string): boolean {
  if (Object.getPrototypeOf(handler) !== Object.prototype) return false;
  const objectType = (handler as { objectType?: unknown }).objectType;
  if (typeof objectType !== 'string' || !ABSENT_ON_LEGACY.includes(objectType))
    return false;
  const client = new AdtClientLegacy(NO_CONNECTION) as unknown as Record<
    string,
    (() => Record<string, unknown>) | undefined
  >;
  const reference = client[`get${objectType}`]?.call(client);
  if (!reference || Object.getPrototypeOf(reference) !== Object.prototype)
    return false;
  const own = (handler as Record<string, unknown>)[member];
  const expected = reference[member];
  return (
    Object.hasOwn(handler, member) &&
    typeof own === 'function' &&
    typeof expected === 'function' &&
    // Catches an accidental handler, not deliberate evasion: a function with a forged toString() copying the refusal's body still passes.
    own.toString() === expected.toString() &&
    Object.keys(handler).sort().join() === Object.keys(reference).sort().join()
  );
}

for (const [handlerClass, pairs] of LEGACY_HEADER_PAIRS)
  registerHeaderPairs(handlerClass, pairs);
for (const [handlerClass, members] of REFUSED_WITHOUT_REQUEST)
  registerRefusedMembers(handlerClass, members);
registerRefusingHandler(isAbsentOnLegacy);

/**
 * Whether test-config.yaml marks the system as legacy (SAP_BASIS 7.40):
 * `environment.is_legacy`.
 */
export function isLegacyEnvironment(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    loadTestConfig,
  } = require('../../../../adt-clients/src/__tests__/helpers/test-helper');
  const testConfig = loadTestConfig();
  return testConfig?.environment?.is_legacy === true;
}

/**
 * The legacy client's factory: `AdtClientLegacy` on the connection, as the
 * harness built it for a legacy configuration before the seam. A factory
 * `createTestAdtClient` takes, and the one the live sessions
 * (`legacyLive.ts`) build their client with.
 */
export function legacyClientOn(
  connection: IAbapConnection,
  logger: ILogger,
  options?: IAdtClientOptions,
): AdtClientLegacy {
  return new AdtClientLegacy(connection, logger, options);
}

/**
 * `legacyClientOn` as the modern harness's factory. The harness types its
 * client as the modern `AdtClient`; a 7.40 client is not one — its gates
 * refuse what 7.40 does not serve — so the harness drives it as a caller
 * outside the type system would, and the run proves the runtime refusals.
 */
// @ts-expect-error -- a 7.40 client in the modern harness, outside the type system on purpose
export const legacyClientFactory: TestClientFactory = async (
  connection,
  logger,
  options,
) => {
  const client = legacyClientOn(connection, logger, options);
  return { client };
};

/**
 * The connection options of a legacy session, for `createTestConnection`: a
 * legacy configuration takes the `legacy-http` wire on premise over HTTP
 * (SAP_BASIS 7.40, where the session-type header sends locks to ABAP session
 * memory instead of the enqueue server), anything else plain `http`. RFC
 * and cloud ignore it.
 */
export function legacyConnectionOptions(
  isLegacy: () => boolean = isLegacyEnvironment,
): ITestConnectionOptions {
  return { onPremHttpTransport: isLegacy() ? 'legacy-http' : 'http' };
}
