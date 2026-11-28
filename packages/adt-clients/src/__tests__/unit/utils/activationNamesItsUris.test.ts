/**
 * The uris an activation names, pinned for the caller who reads the inactive
 * list itself (C7, 49.0.0).
 *
 * Until 48.0.0 a member read the list after a checklist that does not state
 * its outcome, and handed `analyse` the uris its own POST body named. Since
 * the split the caller reads the list and builds `context.activation.named`
 * itself, from the exported `buildObjectUri`. If the uris it builds differ
 * from the ones the POST sent, an object still listed inactive is not matched
 * and reads as activated. So each path's POST body is compared with what
 * `buildObjectUri` answers for the same code, name and parent. Where a member
 * names more than its object, or another object, the extra uri is spelled out
 * here and in the member's JSDoc, so the caller follows a written rule:
 *
 * - a function group names the group and its main program, `source/main` of
 *   the group's uri (`FUGR/I SAPL<group>`);
 * - the class includes (local definitions, macros, test classes, types) and a
 *   behavior implementation name their class;
 * - `activateTestClasses` names the class's uri with `#testclass=<name>`.
 */
import type { AdtAddressableCode } from '../../../endpoints/codes';
import { buildObjectUri } from '../../../utils/activationUtils';
import { headersOf } from '../../helpers/adtHeaders';
import { recordingClient } from '../capabilities/behaviourGuard';
import {
  ACTIVATING_APIS,
  type ActivatingApi,
  activatingHandler,
} from '../core/activatingApis';

/** The `adtcore:uri` of every reference a request body names, in order. */
function urisIn(body: unknown): string[] {
  if (typeof body !== 'string') return [];
  return body
    .split('adtcore:uri="')
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf('"')));
}

/** `buildObjectUri` over a code with no parent. */
const own = (name: string, code: AdtAddressableCode): string =>
  buildObjectUri(name, code);

/**
 * What a caller builds for each member, from the names the manifest's config
 * carries. Every entry is `buildObjectUri`, but for the main program a
 * function group names beside itself.
 */
const EXPECTED: Record<ActivatingApi, () => string[]> = {
  accessControl: () => [own('ZGUARD_DCL', 'DCLS/DL')],
  appendStructure: () => [own('ZGUARD_APP', 'TABL/DS')],
  authorizationField: () => [own('ZGUARD_AUTH', 'AUTH')],
  behaviorDefinition: () => [own('ZGUARD_BDEF', 'BDEF/BDO')],
  behaviorImplementation: () => [own('ZBP_GUARD', 'CLAS/OC')],
  class: () => [own('ZCL_GUARD', 'CLAS/OC')],
  dataElement: () => [own('ZGUARD_DTEL', 'DTEL/DE')],
  ddl: () => [own('ZGUARD_DDL', 'DDLS/DF')],
  domain: () => [own('ZGUARD_DOM', 'DOMA/DD')],
  enhancement: () => [own('ZGUARD_ENH', 'ENHO/XHH')],
  featureToggle: () => [own('ZGUARD_FT', 'FTG2/FT')],
  functionGroup: () => {
    const group = own('ZGUARD_FG', 'FUGR/F');
    return [group, `${group}/source/main`];
  },
  functionInclude: () => [
    buildObjectUri('LZGUARD_FGF01', 'FUGR/I', 'ZGUARD_FG'),
  ],
  functionModule: () => [buildObjectUri('ZGUARD_FM', 'FUGR/FF', 'ZGUARD_FG')],
  include: () => [own('ZGUARD_INC', 'PROG/I')],
  interface: () => [own('ZIF_GUARD', 'INTF/OI')],
  localDefinitions: () => [own('ZCL_GUARD', 'CLAS/OC')],
  localMacros: () => [own('ZCL_GUARD', 'CLAS/OC')],
  localTestClass: () => [own('ZCL_GUARD', 'CLAS/OC')],
  localTypes: () => [own('ZCL_GUARD', 'CLAS/OC')],
  metadataExtension: () => [own('ZGUARD_DDLX', 'DDLX/EX')],
  program: () => [own('ZGUARD', 'PROG/P')],
  scalarFunction: () => [own('ZGUARD_DSFD', 'DSFD/SCF')],
  scalarFunctionImplementation: () => [own('ZGUARD_DSFI', 'DSFI/SFI')],
  serviceBinding: () => [own('ZGUARD_SRVB', 'SRVB/SVB')],
  serviceDefinition: () => [own('ZGUARD_SRVD', 'SRVD/SRV')],
  structure: () => [own('ZGUARD_STRU', 'TABL/DS')],
  table: () => [own('ZGUARD_TAB', 'TABL/DT')],
  tableType: () => [own('ZGUARD_TTYP', 'TTYP/DA')],
  transformation: () => [own('ZGUARD_XSLT', 'XSLT/VT')],
  typeGroup: () => [own('ZGRD', 'TYPE/DG')],
};

describe('the uris an activation names are the ones a caller builds', () => {
  it.each(ACTIVATING_APIS)('%s', async (api) => {
    const { handler, config, calls } = activatingHandler(api);
    await handler.activate(config, {
      headers: headersOf(handler, 'activate', config),
    });
    expect(urisIn(calls[0]?.data)).toEqual(EXPECTED[api]());
  });

  it('activateObjects: one reference per object, each its buildObjectUri', async () => {
    const { client, calls } = recordingClient();
    const utils = client.getUtils();
    await utils.activateObjects(
      [
        { name: 'ZCL_GUARD', type: 'CLAS/OC' },
        { name: 'ZGUARD_FM', type: 'FUGR/FF', parentName: 'ZGUARD_FG' },
        { name: 'ZIF_GUARD', type: 'INTF/OI' },
      ],
      true,
      { headers: headersOf(utils, 'activateObjects') },
    );
    expect(urisIn(calls[0]?.data)).toEqual([
      own('ZCL_GUARD', 'CLAS/OC'),
      buildObjectUri('ZGUARD_FM', 'FUGR/FF', 'ZGUARD_FG'),
      own('ZIF_GUARD', 'INTF/OI'),
    ]);
  });

  it('activateObjects: a group-only code (VIEW/DV) is its buildObjectUri', async () => {
    const { client, calls } = recordingClient();
    const utils = client.getUtils();
    await utils.activateObjects(
      [{ name: 'ZGUARD_VIEW', type: 'VIEW/DV' }],
      true,
      {
        headers: headersOf(utils, 'activateObjects'),
      },
    );
    expect(urisIn(calls[0]?.data)).toEqual([own('ZGUARD_VIEW', 'VIEW/DV')]);
  });

  it("activateTestClasses: the class's uri with #testclass=", async () => {
    const { client, calls } = recordingClient();
    await client.getClass().activateTestClasses({
      className: 'ZCL_GUARD',
      testClassName: 'LTCL_GUARD',
    });
    expect(urisIn(calls[0]?.data)).toEqual([
      `${own('ZCL_GUARD', 'CLAS/OC')}#testclass=${encodeURIComponent('LTCL_GUARD')}`,
    ]);
  });
});
