/**
 * `buildObjectUri` addresses an object the way that object's own `activate`
 * does — for every family that has one.
 *
 * Group activation (`activateObjectsGroup`) builds every
 * `adtcore:objectReference` with `buildObjectUri`, and a family's own
 * `activate` builds its reference by hand. Where the two disagree, the group
 * sends an address SAP resolves to nothing and answers
 * `activationExecuted="false"` with no message — a success to anyone reading
 * the messages. Issue #173 measured it for `BDEF/BDO` on premise (BASIS 816): the group left a
 * behavior definition inactive while its own `activate` worked. The issue asked
 * for every case to be checked the same way, and this is that check: the
 * address is taken from the request the family's own function actually sends.
 *
 * Compared without case: the families disagree among themselves about case
 * (a table keeps it, a function include upper-cases), which is not the defect
 * here — a wrong path segment is.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { activateAccessControl } from '../../../core/accessControl/activation';
import { activateAuthorizationField } from '../../../core/authorizationField/activation';
import { activate as activateBehaviorDefinition } from '../../../core/behaviorDefinition/activation';
import { activateClass } from '../../../core/class/activation';
import { activateDataElement } from '../../../core/dataElement/activation';
import { activateDDLS } from '../../../core/ddl/activation';
import { activateDomain } from '../../../core/domain/activation';
import { activateEnhancement } from '../../../core/enhancement/activation';
import { activateFeatureToggle } from '../../../core/featureToggle/activation';
import { activateFunctionGroup } from '../../../core/functionGroup/activation';
import { activateFunctionInclude } from '../../../core/functionInclude/activation';
import { activateFunctionModule } from '../../../core/functionModule/activation';
import { activateInclude } from '../../../core/include/activation';
import { activateInterface } from '../../../core/interface/activation';
import { activateMetadataExtension } from '../../../core/metadataExtension/activate';
import { activateProgram } from '../../../core/program/activation';
import { activateScalarFunction } from '../../../core/scalarFunction/activation';
import { activateScalarFunctionImplementation } from '../../../core/scalarFunctionImplementation/activation';
import { activateServiceDefinition } from '../../../core/serviceDefinition/activation';
import { activateStructure } from '../../../core/structure/activation';
import { activateTable } from '../../../core/table/activation';
import { activateTableType } from '../../../core/tabletype/activation';
import { activateTransformation } from '../../../core/transformation/activation';
import type { AdtAddressableCode } from '../../../endpoints/codes';
import { buildObjectUri } from '../../../utils/activationUtils';
import { headersFor } from '../../helpers/adtHeaders';

/** The `adtcore:uri` the family's own activation puts on the wire. */
async function sentUri(
  activate: (connection: IAbapConnection) => Promise<unknown>,
): Promise<string> {
  let body = '';
  const connection = {
    makeAdtRequest: jest.fn(async (req: { data?: unknown }) => {
      body = String(req.data ?? '');
      return {
        data: '',
        status: 200,
        statusText: 'OK',
        headers: {},
      } as IAdtWireResponse;
    }),
  } as unknown as IAbapConnection;
  await activate(connection);
  const uri = /adtcore:uri="([^"]+)"/.exec(body)?.[1];
  if (!uri) throw new Error(`no adtcore:uri in the activation body: ${body}`);
  return uri;
}

type Row = [
  type: AdtAddressableCode,
  name: string,
  parent: string | undefined,
  activate: (connection: IAbapConnection) => Promise<unknown>,
];

const rows: Row[] = [
  [
    'CLAS/OC',
    'ZCL_X',
    undefined,
    (c) =>
      activateClass(
        c,
        headersFor('AdtClassMemberBase.activate'),
        'ZCL_X',
        true,
      ),
  ],
  [
    'PROG/P',
    'ZPROG_X',
    undefined,
    (c) =>
      activateProgram(c, headersFor('AdtProgram.activate'), 'ZPROG_X', true),
  ],
  [
    'PROG/I',
    'ZINCL_X',
    undefined,
    (c) =>
      activateInclude(c, headersFor('AdtInclude.activate'), 'ZINCL_X', true),
  ],
  [
    'INTF/OI',
    'ZIF_X',
    undefined,
    (c) =>
      activateInterface(c, headersFor('AdtInterface.activate'), 'ZIF_X', true),
  ],
  [
    'DDLS/DF',
    'ZDDL_X',
    undefined,
    (c) => activateDDLS(c, headersFor('AdtDdl.activate'), 'ZDDL_X', true),
  ],
  [
    'DOMA/DD',
    'ZDOM_X',
    undefined,
    (c) => activateDomain(c, headersFor('AdtDomain.activate'), 'ZDOM_X', true),
  ],
  [
    'DTEL/DE',
    'ZDTEL_X',
    undefined,
    (c) =>
      activateDataElement(
        c,
        headersFor('AdtDataElement.activate'),
        'ZDTEL_X',
        true,
      ),
  ],
  [
    'TABL/DT',
    'ZTAB_X',
    undefined,
    (c) => activateTable(c, headersFor('AdtTable.activate'), 'ZTAB_X', true),
  ],
  [
    'TABL/DS',
    'ZSTRU_X',
    undefined,
    (c) =>
      activateStructure(
        c,
        headersFor('AdtStructure.activate'),
        'ZSTRU_X',
        true,
      ),
  ],
  [
    'TTYP/DA',
    'ZTTYP_X',
    undefined,
    (c) =>
      activateTableType(
        c,
        headersFor('AdtDdicTableType.activate'),
        'ZTTYP_X',
        true,
      ),
  ],
  [
    'SRVD/SRV',
    'ZSRVD_X',
    undefined,
    (c) =>
      activateServiceDefinition(
        c,
        headersFor('AdtServiceDefinition.activate'),
        'ZSRVD_X',
        true,
      ),
  ],
  [
    'DDLX/EX',
    'ZDDLX_X',
    undefined,
    (c) =>
      activateMetadataExtension(
        c,
        headersFor('AdtMetadataExtension.activate'),
        'ZDDLX_X',
        true,
      ),
  ],
  [
    'BDEF/BDO',
    'ZI_BDEF_X',
    undefined,
    (c) =>
      activateBehaviorDefinition(
        c,
        headersFor('AdtBehaviorDefinition.activate'),
        'ZI_BDEF_X',
        true,
      ),
  ],
  [
    'DCLS/DL',
    'ZDCL_X',
    undefined,
    (c) =>
      activateAccessControl(
        c,
        headersFor('AdtAccessControl.activate'),
        'ZDCL_X',
        true,
      ),
  ],
  [
    'DSFD/SCF',
    'ZDSFD_X',
    undefined,
    (c) =>
      activateScalarFunction(
        c,
        headersFor('AdtScalarFunction.activate'),
        'ZDSFD_X',
        true,
      ),
  ],
  [
    'DSFI/SFI',
    'ZDSFI_X',
    undefined,
    (c) =>
      activateScalarFunctionImplementation(
        c,
        headersFor('AdtScalarFunctionImplementation.activate'),
        'ZDSFI_X',
        true,
      ),
  ],
  [
    'FUGR/F',
    'ZFG_X',
    undefined,
    (c) =>
      activateFunctionGroup(
        c,
        headersFor('AdtFunctionGroup.activate'),
        'ZFG_X',
        true,
      ),
  ],
  [
    'FUGR/FF',
    'Z_FM_X',
    'ZFG_X',
    (c) =>
      activateFunctionModule(
        c,
        headersFor('AdtFunctionModule.activate'),
        'ZFG_X',
        'Z_FM_X',
        true,
      ),
  ],
  [
    'FUGR/I',
    'LZFG_XTOP',
    'ZFG_X',
    (c) =>
      activateFunctionInclude(
        c,
        headersFor('AdtFunctionInclude.activate'),
        'ZFG_X',
        'LZFG_XTOP',
        true,
      ),
  ],
  [
    'XSLT/VT',
    'ZXSLT_X',
    undefined,
    (c) =>
      activateTransformation(
        c,
        headersFor('AdtTransformation.activate'),
        'ZXSLT_X',
        true,
      ),
  ],
  [
    'AUTH',
    'ZAUTH_X',
    undefined,
    (c) =>
      activateAuthorizationField(
        c,
        headersFor('AdtAuthorizationField.activate'),
        'ZAUTH_X',
        true,
      ),
  ],
  [
    'FTG2/FT',
    'ZFTG_X',
    undefined,
    (c) =>
      activateFeatureToggle(
        c,
        headersFor('AdtFeatureToggle.activate'),
        'ZFTG_X',
        true,
      ),
  ],
  [
    'ENHO/XHB',
    'ZENH_X',
    undefined,
    (c) =>
      activateEnhancement(
        c,
        headersFor('AdtEnhancement.activate'),
        'enhoxhb',
        'ZENH_X',
        true,
      ),
  ],
  [
    'ENHO/XHH',
    'ZENH_X',
    undefined,
    (c) =>
      activateEnhancement(
        c,
        headersFor('AdtEnhancement.activate'),
        'enhoxhh',
        'ZENH_X',
        true,
      ),
  ],
  [
    'ENHS/XSB',
    'ZENH_X',
    undefined,
    (c) =>
      activateEnhancement(
        c,
        headersFor('AdtEnhancement.activate'),
        'enhsxsb',
        'ZENH_X',
        true,
      ),
  ],
];

describe('buildObjectUri matches each family’s own activation address', () => {
  it.each(rows)('%s', async (type, name, parent, activate) => {
    const own = await sentUri(activate);
    expect(buildObjectUri(name, type, parent).toLowerCase()).toBe(
      own.toLowerCase(),
    );
  });
});

/**
 * An enhancement's address carries its subtype — `/enhancements/enhoxhb/…` —
 * and a bare `ENHO` or `ENHS` does not say which. Guessing one would be the
 * `default` branch's mistake again, so the caller is told what is missing.
 * That is the caller's argument, not SAP's answer, so it is thrown.
 */
describe('a type that cannot be addressed without more', () => {
  it('a bare ENHO or ENHS is no code of the tables', () => {
    // @ts-expect-error -- ENHO names no subtype, and the tables list none bare
    expect(() => buildObjectUri('ZENH_X', 'ENHO')).toThrow(
      /No ADT address is known/,
    );
    // @ts-expect-error -- ENHS names no subtype, and the tables list none bare
    expect(() => buildObjectUri('ZENH_X', 'ENHS')).toThrow(
      /No ADT address is known/,
    );
  });

  it('a function include without its group does not compile, and is refused', () => {
    // @ts-expect-error -- FUGR/I is addressed under its group
    expect(() => buildObjectUri('LZFG_XTOP', 'FUGR/I')).toThrow(/parent/);
    // Typed only as a code of the tables, the parent is optional — and refused.
    const typedAsAnyCode = (code: AdtAddressableCode): AdtAddressableCode =>
      code;
    expect(() => buildObjectUri('LZFG_XTOP', typedAsAnyCode('FUGR/I'))).toThrow(
      /parent/,
    );
  });
});
