/**
 * Unit test: update() without activation must never read the ACTIVE version.
 *
 * When update() runs without activateOnUpdate, it writes the source under a
 * lock and stops — the object is left as the inactive version, and the active
 * version still holds the pre-update content (or nothing, for a never-activated
 * object). Every read the flow performs in this path — the readiness poll and
 * the final "read and return result" — must therefore target the version just
 * written, not the stale active one. Reading active there returns content that
 * cannot reflect the update, and the returned readResult misleads the caller.
 *
 * A fake IAbapConnection is used because the defect is invisible from the
 * outside: only the request URL reveals which version was read, and the miss is
 * swallowed (404 -> undefined, or 200 + empty body on cloud).
 *
 * Object names are inert placeholders — the fake never reaches a SAP system and
 * the assertion is on the `version` query parameter only.
 *
 * Package is excluded on purpose: verified live that a package returns identical
 * content for version=active and version=inactive (no distinct inactive
 * version), so reading active there is equivalent and not stale.
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
import { AdtProgram } from '../../../core/program/AdtProgram';
import { AdtStructure } from '../../../core/structure/AdtStructure';
import { AdtTable } from '../../../core/table/AdtTable';
import { AdtTransformation } from '../../../core/transformation/AdtTransformation';
import { createTestsLogger } from '../../helpers/testLogger';

const testsLogger: ILogger = createTestsLogger();

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>H1</LOCK_HANDLE></DATA></asx:values></asx:abap>';

const OBJ = 'ZNOACTIVATE';

interface ICall {
  method?: string;
  url: string;
  params?: Record<string, unknown>;
}

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
  description: 'no-activate probe',
  sourceCode: 'X',
  xmlContent: '<a/>',
};

// Source-bearing handlers with an inactive -> activate lifecycle. Package is
// excluded (no distinct inactive version — see file header).
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
  ['program', AdtProgram],
  ['structure', AdtStructure],
  ['table', AdtTable],
  ['transformation', AdtTransformation],
];

function versionOf(call: ICall): string | undefined {
  const match = /[?&]version=([^&]+)/.exec(String(call.url));
  if (match) return match[1];
  const fromParams = call.params?.version;
  return fromParams === undefined ? undefined : String(fromParams);
}

describe('update() without activation never reads the active version', () => {
  it.each(
    MODULES,
  )('%s reads only the written (inactive) version after the write', async (_label, Handler) => {
    const { conn, calls } = fakeConnection();
    const handler = new Handler(conn, testsLogger);

    // activateOnUpdate omitted → no activation happens in this path.
    await handler.update({ ...CONFIG }, { sourceCode: 'X' });

    const writeIndex = calls.findIndex((c) => c.method === 'PUT');
    expect(writeIndex).toBeGreaterThanOrEqual(0);

    const versionedReads = calls
      .slice(writeIndex + 1)
      .filter((c) => c.method === 'GET' && versionOf(c) !== undefined);

    expect(versionedReads.length).toBeGreaterThan(0);
    // 'workingArea' is the enhancement URI dialect for the inactive version.
    for (const call of versionedReads) {
      expect(versionOf(call)).not.toBe('active');
    }
  });
});
