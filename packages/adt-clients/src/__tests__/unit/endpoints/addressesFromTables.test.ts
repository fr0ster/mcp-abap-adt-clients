/**
 * `buildObjectUri` builds from the ADT type tables, and every address it
 * builds is the one the object's own record in `src/endpoints/objects.ts`
 * builds — the address each handler sends. A code of every table is asked,
 * so a collection a table states wrongly, or a code the expectations below do
 * not cover, fails here.
 */
import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  type AdtTypeCode,
} from '@mcp-abap-adt/interfaces-adt';
import { PARENTED_SEGMENT } from '../../../endpoints/codes';
import {
  ACCESS_CONTROL,
  AUTHORIZATION_FIELD,
  BEHAVIOR_DEFINITION,
  CLASS,
  DATA_ELEMENT,
  DDL_SOURCE,
  DOMAIN,
  ENHANCEMENT,
  FEATURE_TOGGLE,
  FUNCTION_GROUP,
  FUNCTION_INCLUDE,
  FUNCTION_MODULE,
  INTERFACE,
  MESSAGE_CLASS,
  METADATA_EXTENSION,
  PACKAGE,
  PROGRAM,
  PROGRAM_INCLUDE,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  STRUCTURE,
  TABLE,
  TABLE_TYPE,
  TRANSFORMATION,
} from '../../../endpoints/objects';
import { buildObjectUri } from '../../../utils/activationUtils';

const NAME = '/NSP/ZOBJ_X';
const GROUP = 'ZFG_X';

/** The record's address for each code with an address of its own. */
const EXPECTED: Readonly<Record<Exclude<AdtTypeCode, 'MSAG/NN'>, string>> = {
  'CLAS/OC': CLASS.uri(NAME),
  'INTF/OI': INTERFACE.uri(NAME),
  'PROG/P': PROGRAM.uri(NAME),
  'PROG/I': PROGRAM_INCLUDE.uri(NAME),
  'FUGR/F': FUNCTION_GROUP.uri(NAME),
  'FUGR/FF': FUNCTION_MODULE.uri(GROUP, NAME),
  'FUGR/I': FUNCTION_INCLUDE.uri(GROUP, NAME),
  'DEVC/K': PACKAGE.uri(NAME),
  'DDLS/DF': DDL_SOURCE.uri(NAME),
  'TABL/DT': TABLE.uri(NAME),
  'TABL/DS': STRUCTURE.uri(NAME),
  'TTYP/DA': TABLE_TYPE.uri(NAME),
  'DOMA/DD': DOMAIN.uri(NAME),
  'DTEL/DE': DATA_ELEMENT.uri(NAME),
  'DCLS/DL': ACCESS_CONTROL.uri(NAME),
  'BDEF/BDO': BEHAVIOR_DEFINITION.uri(NAME),
  'DDLX/EX': METADATA_EXTENSION.uri(NAME),
  'SRVD/SRV': SERVICE_DEFINITION.uri(NAME),
  'SRVB/SVB': SERVICE_BINDING.uri(NAME),
  'DSFD/SCF': SCALAR_FUNCTION.uri(NAME),
  'DSFI/SFI': SCALAR_FUNCTION_IMPLEMENTATION.uri(NAME),
  'XSLT/VT': TRANSFORMATION.uri(NAME),
  'MSAG/N': MESSAGE_CLASS.uri(NAME),
  'FTG2/FT': FEATURE_TOGGLE.uri(NAME),
  AUTH: AUTHORIZATION_FIELD.uri(NAME),
  'ENHO/XHH': ENHANCEMENT.uri('enhoxhh', NAME),
  'ENHO/XHB': ENHANCEMENT.uri('enhoxhb', NAME),
  'ENHS/XSB': ENHANCEMENT.uri('enhsxsb', NAME),
};

/** Whether a table's key is a code the expectations cover. */
function covered(code: string): code is keyof typeof EXPECTED | 'MSAG/NN' {
  return code === 'MSAG/NN' || Object.hasOwn(EXPECTED, code);
}

/** Every code of every table, with the table it came from. */
function everyCode(): [string, string][] {
  const rows: [string, string][] = [];
  const tables = {
    onprem: ADT_TYPES_ONPREM,
    cloud: ADT_TYPES_CLOUD,
    basis740: ADT_TYPES_BASIS_740,
  };
  for (const [variant, table] of Object.entries(tables)) {
    for (const entry of Object.values(table)) {
      for (const code of Object.keys(entry.codes)) rows.push([variant, code]);
    }
  }
  return rows;
}

describe('every code of every table is addressed as its record addresses it', () => {
  it.each(everyCode())('%s %s', (_variant, code) => {
    // A code the expectations do not cover is a new code of the tables: its
    // address is written into EXPECTED before this passes.
    if (!covered(code)) throw new Error(`no expected address for ${code}`);
    if (code === 'MSAG/NN') {
      // @ts-expect-error -- MSAG/NN has no address of its own
      expect(() => buildObjectUri(NAME, code)).toThrow(/row in its class/);
      return;
    }
    expect(buildObjectUri(NAME, code, GROUP)).toBe(EXPECTED[code]);
  });
});

describe('a parented code is addressed under its parent', () => {
  it('the segments are the records’ own', () => {
    expect(FUNCTION_MODULE.uri(GROUP, NAME)).toBe(
      `${FUNCTION_GROUP.uri(GROUP)}/${PARENTED_SEGMENT['FUGR/FF']}/%2Fnsp%2Fzobj_x`,
    );
    expect(FUNCTION_INCLUDE.uri(GROUP, NAME)).toBe(
      `${FUNCTION_GROUP.uri(GROUP)}/${PARENTED_SEGMENT['FUGR/I']}/%2Fnsp%2Fzobj_x`,
    );
  });
});
