/**
 * Where an object of a type code lives, read from the ADT type tables of
 * `@mcp-abap-adt/interfaces-adt`.
 *
 * The tables are the library's declaration of what it serves; an object's
 * address is its code's collection (the entry's, or the code's own where it
 * differs) followed by its name — and, for a code with a parent API, the
 * parent's address followed by the child's segment. What does not follow that
 * rule is an irregular address below, typed and named with its reason.
 *
 * Internal. Nothing here is exported from the package.
 */

import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  type AdtApiEntry,
  type AdtApiName,
  type AdtApiTable,
  type AdtOperation,
  type AdtParentedTypeCode,
  type AdtTypeCode,
  type IAdtCodeFacts,
} from '@mcp-abap-adt/interfaces-adt';

/**
 * Every table, read as the entry shape it satisfies. The variant does not
 * change where an object lives: a code's collection is the same in every
 * table that names it, which the one-meaning test holds.
 */
const TABLES: readonly AdtApiTable<string>[] = [
  ADT_TYPES_ONPREM,
  ADT_TYPES_CLOUD,
  ADT_TYPES_BASIS_740,
];

/** What one table says about a code: the API it is under and its facts. */
export interface ICodeEntry {
  readonly table: AdtApiTable<string>;
  readonly entry: AdtApiEntry<string>;
  readonly facts: IAdtCodeFacts<string>;
}

/** Every table's word on `code`, in table order; empty for a code no table names. */
export function codeEntries(code: AdtTypeCode): ICodeEntry[] {
  const found: ICodeEntry[] = [];
  for (const table of TABLES) {
    for (const entry of Object.values(table)) {
      if (!entry) continue;
      const facts: IAdtCodeFacts<string> | undefined = entry.codes[code];
      if (facts) found.push({ table, entry, facts });
    }
  }
  return found;
}

/** Whether any table lists `operation` for `code`. */
export function codeHas(code: AdtTypeCode, operation: AdtOperation): boolean {
  return codeEntries(code).some((e) => e.facts.operations.includes(operation));
}

/**
 * The segment a parented code's objects take under their parent's address:
 * `/functions/groups/<group>/fmodules/<module>`. The tables name the parent
 * API, not this segment, so it is stated here, once per parented code — the
 * type makes a new parented code in the tables fail to compile until its
 * segment is written down.
 */
export const PARENTED_SEGMENT = {
  'FUGR/FF': 'fmodules',
  'FUGR/I': 'includes',
} as const satisfies { readonly [C in AdtParentedTypeCode]: string };

/**
 * The codes with no address of their own, each with its reason. A message of
 * a message class is a row inside its class's document — the table's
 * collection is the class's, and the library writes the class — so
 * `/messageclass/<number>` would address a message class of that name.
 */
export const NO_OWN_ADDRESS: Readonly<Partial<Record<AdtTypeCode, string>>> = {
  'MSAG/NN':
    'a message of a message class has no address of its own; it is a row in its class, addressed by the class (MSAG/N)',
};

/** The parent's API entry in the table that names the child. */
export function parentEntry(
  e: ICodeEntry,
  parent: AdtApiName,
): AdtApiEntry<string> | undefined {
  return e.table[parent];
}
