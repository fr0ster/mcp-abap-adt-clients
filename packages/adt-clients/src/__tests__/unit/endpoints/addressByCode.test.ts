/**
 * `buildObjectUri` takes each code's address from one typed table keyed by
 * the type codes of interfaces-adt (`OWN_ADDRESS`, `PARENTED_ADDRESS` in
 * `endpoints/codes.ts`), whose builders are the records of
 * `endpoints/objects.ts` — never from a branch on a code's text.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
} from '@mcp-abap-adt/interfaces-adt';
import {
  NO_OWN_ADDRESS,
  OWN_ADDRESS,
  PARENTED_ADDRESS,
} from '../../../endpoints/codes';
import { FUNCTION_MODULE, TYPE_GROUP } from '../../../endpoints/objects';
import { buildObjectUri } from '../../../utils/activationUtils';

/** Every code of every table. */
const CODES = [
  ...new Set(
    [ADT_TYPES_ONPREM, ADT_TYPES_CLOUD, ADT_TYPES_BASIS_740].flatMap((table) =>
      Object.values(table).flatMap((entry) => Object.keys(entry.codes)),
    ),
  ),
].sort();

describe('the address of every code comes from one typed table', () => {
  it('every code has exactly one way to its address', () => {
    for (const code of CODES) {
      const ways = [
        Object.hasOwn(OWN_ADDRESS, code),
        Object.hasOwn(PARENTED_ADDRESS, code),
        Object.hasOwn(NO_OWN_ADDRESS, code),
      ].filter(Boolean);
      expect([code, ways.length]).toEqual([code, 1]);
    }
  });

  it("a type group's address is its record's, the name as given", () => {
    expect(buildObjectUri('ZTg/1', 'TYPE/DG')).toBe(TYPE_GROUP.uri('ZTg/1'));
    expect(buildObjectUri('ZTg/1', 'TYPE/DG')).toBe(
      '/sap/bc/adt/ddic/typegroups/ZTg%2F1',
    );
  });

  it("a parented code's address is its record's, under the parent", () => {
    expect(buildObjectUri('Z_FM', 'FUGR/FF', 'ZFG')).toBe(
      FUNCTION_MODULE.uri('ZFG', 'Z_FM'),
    );
  });

  it('a code whose API the library does not serve yet has no address', () => {
    expect(() => buildObjectUri('ZLOG', 'APLO/TYP')).toThrow(
      /serves no applicationLog/,
    );
  });

  it('buildObjectUri branches on no code literal', () => {
    const source = readFileSync(
      join(__dirname, '../../../utils/activationUtils.ts'),
      'utf-8',
    );
    const body = source.slice(source.indexOf('export function buildObjectUri'));
    const end = body.indexOf('\n}\n');
    expect(body.slice(0, end)).not.toMatch(/type\s*===\s*'/);
    expect(body.slice(0, end)).not.toContain('seg(');
  });
});
