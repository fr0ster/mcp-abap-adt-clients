/**
 * Unit tests: post-update readiness read must poll the version just written.
 *
 * After update() writes source/metadata under a lock, the object exists only as
 * the INACTIVE version. Polling the ACTIVE version there is wrong twice over:
 * for a never-activated object it 404s, and for an existing one it returns the
 * stale pre-update content. Either way the readiness read is wrapped in
 * try/catch, so the mistake is swallowed as a warning and never fails a test —
 * which is exactly why this needs a wire-level assertion.
 *
 * A fake IAbapConnection is used because the bug is invisible from the outside:
 * only the request URL proves which version was polled.
 *
 * Object names here are inert placeholders: the fake connection never reaches a
 * SAP system, and the assertion is on the `version` query parameter, not on the
 * object. No package/transport/system parameters are involved.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtAccessControl } from '../../../core/accessControl/AdtAccessControl';
import { AdtAuthorizationField } from '../../../core/authorizationField/AdtAuthorizationField';
import { AdtBehaviorDefinition } from '../../../core/behaviorDefinition/AdtBehaviorDefinition';
import { AdtBehaviorImplementation } from '../../../core/behaviorImplementation/AdtBehaviorImplementation';
import { AdtClass } from '../../../core/class/AdtClass';
import { AdtDdl } from '../../../core/ddl/AdtDdl';
import { AdtEnhancement } from '../../../core/enhancement/AdtEnhancement';
import { AdtFeatureToggle } from '../../../core/featureToggle/AdtFeatureToggle';
import { AdtFunctionInclude } from '../../../core/functionInclude/AdtFunctionInclude';
import { AdtFunctionModule } from '../../../core/functionModule/AdtFunctionModule';
import { AdtInterface } from '../../../core/interface/AdtInterface';
import { AdtPackage } from '../../../core/package/AdtPackage';
import { AdtProgram } from '../../../core/program/AdtProgram';
import { AdtStructure } from '../../../core/structure/AdtStructure';
import { AdtTable } from '../../../core/table/AdtTable';
import { AdtTransformation } from '../../../core/transformation/AdtTransformation';
import { createTestsLogger } from '../../helpers/testLogger';

const testsLogger: ILogger = createTestsLogger();

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>';

const OBJ = 'ZREADINESS';

interface ICall {
  method?: string;
  url: string;
  params?: Record<string, unknown>;
}

/** Answers LOCK with a handle; everything else 200/empty. */
function fakeConnection(): { conn: IAbapConnection; calls: ICall[] } {
  const calls: ICall[] = [];
  const makeAdtRequest = jest.fn(async (req: any) => {
    calls.push(req);
    if (
      String(req.url).includes('_action=LOCK') ||
      req.params?._action === 'LOCK'
    ) {
      return { status: 200, data: LOCK_XML };
    }
    return { status: 200, data: '' };
  });
  return {
    conn: {
      makeAdtRequest,
      setSessionType: jest.fn(),
    } as unknown as IAbapConnection,
    calls,
  };
}

/** Superset config — each handler reads only the keys it knows about. */
const CONFIG: Record<string, unknown> = {
  accessControlName: OBJ,
  authorizationFieldName: OBJ,
  name: OBJ,
  className: OBJ,
  ddlName: OBJ,
  enhancementName: OBJ,
  enhancementType: 'enhoxhh',
  featureToggleName: OBJ,
  functionGroupName: OBJ,
  includeName: OBJ,
  functionModuleName: OBJ,
  interfaceName: OBJ,
  packageName: OBJ,
  programName: OBJ,
  structureName: OBJ,
  tableName: OBJ,
  transformationName: OBJ,
  behaviorDefinition: OBJ,
  superPackage: OBJ,
  softwareComponent: 'ZLOCAL',
  description: 'readiness probe',
  sourceCode: 'X',
  xmlContent: '<a/>',
};

/**
 * Handlers whose update() emits a readiness read carrying a `version`.
 * Excluded on purpose — their read() drops the version and polls a
 * version-less URL, so there is nothing to assert:
 * metadataExtension, domain, dataElement, functionGroup, tabletype.
 */
const MODULES: Array<[string, new (...args: any[]) => any]> = [
  ['accessControl', AdtAccessControl],
  ['authorizationField', AdtAuthorizationField],
  ['behaviorDefinition', AdtBehaviorDefinition],
  ['behaviorImplementation', AdtBehaviorImplementation],
  ['class', AdtClass],
  ['ddl', AdtDdl],
  ['enhancement', AdtEnhancement],
  ['featureToggle', AdtFeatureToggle],
  ['functionInclude', AdtFunctionInclude],
  ['functionModule', AdtFunctionModule],
  ['interface', AdtInterface],
  ['package', AdtPackage],
  ['program', AdtProgram],
  ['structure', AdtStructure],
  ['table', AdtTable],
  ['transformation', AdtTransformation],
];

/** Version requested by a call, from the query string or from params. */
function versionOf(call: ICall): string | undefined {
  const match = /[?&]version=([^&]+)/.exec(String(call.url));
  if (match) return match[1];
  const fromParams = call.params?.version;
  return fromParams === undefined ? undefined : String(fromParams);
}

describe('post-update readiness read', () => {
  it.each(
    MODULES,
  )('%s polls the inactive version it just wrote', async (_label, Handler) => {
    const { conn, calls } = fakeConnection();
    const handler = new Handler(conn, testsLogger);

    await handler.update({ ...CONFIG }, { sourceCode: 'X' });

    const writeIndex = calls.findIndex((c) => c.method === 'PUT');
    expect(writeIndex).toBeGreaterThanOrEqual(0);

    // The readiness read is the first version-carrying GET after the write.
    // (A later GET returns the update result — a separate concern.)
    const readinessRead = calls
      .slice(writeIndex + 1)
      .find((c) => c.method === 'GET' && versionOf(c) !== undefined);

    expect(readinessRead).toBeDefined();
    // 'workingArea' is the enhancement URI dialect for the inactive version.
    expect(['inactive', 'workingArea']).toContain(
      versionOf(readinessRead as ICall),
    );
  });
});
