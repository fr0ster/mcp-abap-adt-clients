import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
} from '@mcp-abap-adt/interfaces-adt';
import { answeredObject } from '../results/answeredObject';

/**
 * C6 of #304: the code lookup no longer narrows with a predicate over a typed
 * string; a typed map answers instead. Every text reads as it read through the
 * old `Set` and predicate, copied here as the oracle.
 */
const OLD_CODES: ReadonlySet<string> = new Set(
  [ADT_TYPES_ONPREM, ADT_TYPES_CLOUD, ADT_TYPES_BASIS_740].flatMap((table) =>
    Object.values<{ readonly codes: object }>(table).flatMap((entry) =>
      Object.keys(entry.codes),
    ),
  ),
);
const oldAnsweredObject = (text: string) =>
  OLD_CODES.has(text) ? { type: text } : { unknownType: text };

describe('answeredObject reads every text as before', () => {
  const texts = [
    ...OLD_CODES,
    '',
    'CLAS/OM',
    'PROG/PS',
    'clas/oc',
    'CLAS/OC ',
    'toString',
    'constructor',
    '__proto__',
    'hasOwnProperty',
  ];
  it.each(texts)('%j', (text) => {
    expect(answeredObject(text)).toEqual(oldAnsweredObject(text));
  });
  it('knows every code the tables name', () => {
    expect(OLD_CODES.size).toBeGreaterThan(20);
  });
});
