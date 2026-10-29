/**
 * The literal scan's own verdicts (`typeCodeScan.ts`), on small in-memory
 * programs typed through this package's `tsconfig.json`: a typed code
 * literal passes, an untyped one fails, a comment naming a code of the
 * tables passes, one naming a code no table holds fails.
 */

import { join } from 'node:path';
import { typeCodeFindings } from './typeCodeScan';

const ROOT = join(__dirname, '../../..');
const TSCONFIG = join(ROOT, 'tsconfig.json');
const FIXTURE = join(ROOT, 'src/__typeCodeScanFixture__/fixture.ts');

/** A template substitution in a fixture's source, spelled without `${` in a plain string. */
const SUBSTITUTION = `${'$'}{name}`;

function keys(text: string): string[] {
  return typeCodeFindings(ROOT, TSCONFIG, [], new Map([[FIXTURE, text]])).map(
    (finding) => finding.key,
  );
}

function scan(text: string): string[] {
  return typeCodeFindings(ROOT, TSCONFIG, [], new Map([[FIXTURE, text]])).map(
    (finding) => finding.line,
  );
}

describe('the literal scan of type codes', () => {
  it('passes a code literal whose contextual type is AdtTypeCode', () => {
    expect(
      scan(
        [
          "import type { AdtTypeCode } from '@mcp-abap-adt/interfaces-adt';",
          "export const code: AdtTypeCode = 'CLAS/OC';",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('fails a code literal with no code type, naming file and line', () => {
    expect(scan("export const code: string = 'CLAS/OC';")).toEqual([
      "src/__typeCodeScanFixture__/fixture.ts:1 'CLAS/OC' — contextual type string is not made of codes of the tables",
    ]);
  });

  it('passes a comment naming a code of the tables', () => {
    expect(
      scan(
        ['/** Reads a `CLAS/OC` class. */', 'export const x = 1;'].join('\n'),
      ),
    ).toEqual([]);
  });

  it('fails a comment naming a code no table holds', () => {
    expect(
      scan(['export const x = 1;', '// Reads a `CLAS/OM` method.'].join('\n')),
    ).toEqual([
      "src/__typeCodeScanFixture__/fixture.ts:2 'CLAS/OM' — named in a comment, not a code of the tables",
    ]);
  });

  it('passes a code of the tables inside a longer string or a template span', () => {
    expect(
      scan(
        [
          'export const reference = (name: string) =>',
          `  \`<adtcore:objectReference adtcore:name="${SUBSTITUTION}" adtcore:type="FUGR/I"/>\`;`,
          "export const message = 'pass a code, e.g. CLAS/OC or PROG/P';",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('fails a code no table holds inside a template span, naming its line', () => {
    expect(
      scan(
        [
          'export const reference = (name: string) =>',
          `  \`<adtcore:objectReference adtcore:name="${SUBSTITUTION}"`,
          '    adtcore:type="FUGR/ZZ"/>`;',
        ].join('\n'),
      ),
    ).toEqual([
      "src/__typeCodeScanFixture__/fixture.ts:3 'FUGR/ZZ' — inside a string, not a code of the tables",
    ]);
  });

  it('keys a literal typed by a type alias by the alias, and the same literal typed string by itself', () => {
    expect(
      keys(
        [
          "type AbapUnitRunObjectType = 'CLAS' | 'PROG' | 'FUGR' | 'FUNC';",
          'declare function start(type: AbapUnitRunObjectType): void;',
          "start('CLAS');",
        ].join('\n'),
      ),
      // The alias's own members and the call: one key for all of them.
    ).toEqual(Array(4).fill('type:AbapUnitRunObjectType'));
    expect(
      keys(
        ['declare function start(type: string): void;', "start('CLAS');"].join(
          '\n',
        ),
      ),
    ).toEqual(['src/__typeCodeScanFixture__/fixture.ts:CLAS']);
  });

  it('passes keys, comparisons and type arguments typed by the codes', () => {
    expect(
      scan(
        [
          'import type {',
          '  AdtTypeCode,',
          '  IObjectReference,',
          "} from '@mcp-abap-adt/interfaces-adt';",
          'export const keyed = {',
          "  'CLAS/OC': 1,",
          '} satisfies Partial<Record<AdtTypeCode, number>>;',
          'export function isClass(code: AdtTypeCode): boolean {',
          "  return code === 'CLAS/OC';",
          '}',
          "export type Reference = IObjectReference<'FUGR/FF'>;",
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('fails a key, a comparison and a literal type not typed by the codes', () => {
    expect(
      scan(
        [
          "export const keyed = { 'CLAS/OC': 1 };",
          "export const isClass = (code: string) => code === 'CLAS/OC';",
          "export type Code = 'CLAS/OC';",
        ].join('\n'),
      ),
    ).toEqual([
      "src/__typeCodeScanFixture__/fixture.ts:1 'CLAS/OC' — a property name whose object is not keyed by the code types",
      "src/__typeCodeScanFixture__/fixture.ts:2 'CLAS/OC' — compared with string, which is not made of codes of the tables",
      "src/__typeCodeScanFixture__/fixture.ts:3 'CLAS/OC' — a literal type outside a type argument constrained to the code types",
    ]);
  });
});
