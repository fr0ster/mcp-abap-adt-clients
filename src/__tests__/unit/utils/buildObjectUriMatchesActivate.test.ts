/**
 * `buildObjectUri` addresses an object the way that object's own `activate`
 * does — for every family that has one.
 *
 * Group activation (`activateObjectsGroup`) builds every
 * `adtcore:objectReference` with `buildObjectUri`, and a family's own
 * `activate` builds its reference by hand. Where the two disagree, the group
 * sends an address SAP resolves to nothing and answers
 * `activationExecuted="false"` with no message — a success to anyone reading
 * the messages. Issue #173 measured it for `BDEF/BDO` on E19: the group left a
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
import { buildObjectUri } from '../../../utils/activationUtils';

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
  type: string,
  name: string,
  parent: string | undefined,
  activate: (connection: IAbapConnection) => Promise<unknown>,
];

const rows: Row[] = [
  ['CLAS/OC', 'ZCL_X', undefined, (c) => activateClass(c, 'ZCL_X')],
  ['PROG/P', 'ZPROG_X', undefined, (c) => activateProgram(c, 'ZPROG_X')],
  ['PROG/I', 'ZINCL_X', undefined, (c) => activateInclude(c, 'ZINCL_X')],
  ['INTF/OI', 'ZIF_X', undefined, (c) => activateInterface(c, 'ZIF_X')],
  ['DDLS/DF', 'ZDDL_X', undefined, (c) => activateDDLS(c, 'ZDDL_X')],
  ['DOMA/DD', 'ZDOM_X', undefined, (c) => activateDomain(c, 'ZDOM_X')],
  ['DTEL/DE', 'ZDTEL_X', undefined, (c) => activateDataElement(c, 'ZDTEL_X')],
  ['TABL/DT', 'ZTAB_X', undefined, (c) => activateTable(c, 'ZTAB_X')],
  ['TABL/DS', 'ZSTRU_X', undefined, (c) => activateStructure(c, 'ZSTRU_X')],
  ['TTYP/DF', 'ZTTYP_X', undefined, (c) => activateTableType(c, 'ZTTYP_X')],
  [
    'SRVD/SRV',
    'ZSRVD_X',
    undefined,
    (c) => activateServiceDefinition(c, 'ZSRVD_X'),
  ],
  [
    'DDLX/EX',
    'ZDDLX_X',
    undefined,
    (c) => activateMetadataExtension(c, 'ZDDLX_X'),
  ],
  [
    'BDEF/BDO',
    'ZI_BDEF_X',
    undefined,
    (c) => activateBehaviorDefinition(c, 'ZI_BDEF_X'),
  ],
  ['DCLS/DL', 'ZDCL_X', undefined, (c) => activateAccessControl(c, 'ZDCL_X')],
  [
    'DSFD/SCF',
    'ZDSFD_X',
    undefined,
    (c) => activateScalarFunction(c, 'ZDSFD_X'),
  ],
  [
    'DSFI/SFI',
    'ZDSFI_X',
    undefined,
    (c) => activateScalarFunctionImplementation(c, 'ZDSFI_X'),
  ],
  ['FUGR/F', 'ZFG_X', undefined, (c) => activateFunctionGroup(c, 'ZFG_X')],
  [
    'FUGR/FF',
    'Z_FM_X',
    'ZFG_X',
    (c) => activateFunctionModule(c, 'ZFG_X', 'Z_FM_X'),
  ],
  [
    'FUGR/I',
    'LZFG_XTOP',
    'ZFG_X',
    (c) => activateFunctionInclude(c, 'ZFG_X', 'LZFG_XTOP'),
  ],
  [
    'XSLT/VT',
    'ZXSLT_X',
    undefined,
    (c) => activateTransformation(c, 'ZXSLT_X'),
  ],
  [
    'AUTH',
    'ZAUTH_X',
    undefined,
    (c) => activateAuthorizationField(c, 'ZAUTH_X'),
  ],
  ['FTG2/FT', 'ZFTG_X', undefined, (c) => activateFeatureToggle(c, 'ZFTG_X')],
  [
    'ENHO/EXH',
    'ZENH_X',
    undefined,
    (c) => activateEnhancement(c, 'enhoxh', 'ZENH_X'),
  ],
  [
    'ENHO/EXHB',
    'ZENH_X',
    undefined,
    (c) => activateEnhancement(c, 'enhoxhb', 'ZENH_X'),
  ],
  [
    'ENHO/EXHH',
    'ZENH_X',
    undefined,
    (c) => activateEnhancement(c, 'enhoxhh', 'ZENH_X'),
  ],
  [
    'ENHS/EXS',
    'ZENH_X',
    undefined,
    (c) => activateEnhancement(c, 'enhsxs', 'ZENH_X'),
  ],
  [
    'ENHS/EXSB',
    'ZENH_X',
    undefined,
    (c) => activateEnhancement(c, 'enhsxsb', 'ZENH_X'),
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
 * An enhancement's address carries its subtype — `/enhancements/enhoxh/…` —
 * and a bare `ENHO` or `ENHS` does not say which. Guessing one would be the
 * `default` branch's mistake again, so the caller is told what is missing.
 * That is the caller's argument, not SAP's answer, so it is thrown.
 */
describe('a type that cannot be addressed without more', () => {
  it.each([
    'ENHO',
    'ENHS',
  ])('%s alone is refused, naming the subtype', (type) => {
    expect(() => buildObjectUri('ZENH_X', type)).toThrow(/subtype/);
  });

  it('a function include without its group is refused', () => {
    expect(() => buildObjectUri('LZFG_XTOP', 'FUGR/I')).toThrow(/group/);
  });
});
