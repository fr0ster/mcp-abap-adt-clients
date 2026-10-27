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
import { DDIC_VIEW } from './objects';

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

/**
 * Every table's word on `code`, in table order; empty for a code no table
 * names — a group-only code, or text from outside the types.
 */
export function codeEntries(code: string): ICodeEntry[] {
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
export function codeHas(code: string, operation: AdtOperation): boolean {
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
const NO_OWN_ADDRESS_REASON = {
  'MSAG/NN':
    'a message of a message class has no address of its own; it is a row in its class, addressed by the class (MSAG/N)',
} as const satisfies Partial<Record<AdtTypeCode, string>>;

/** {@link NO_OWN_ADDRESS_REASON}, read by any code. */
export const NO_OWN_ADDRESS: Readonly<Partial<Record<string, string>>> =
  NO_OWN_ADDRESS_REASON;

/**
 * The codes a group operation addresses that no table of interfaces-adt
 * 21.0.0 types: `VIEW/DV`, a DDIC database view. Every release lists it
 * (`system-description-s4-2025--07-typestructure`,
 * `system-description-abap-cloud--07-typestructure`,
 * `system-description-basis-740--07-typestructure`), and before 38.0.0 group
 * activation, group deletion and where-used addressed it under
 * `/sap/bc/adt/ddic/views`; no API of the library serves it, so it is in no
 * table. Kept for those three, typed here, until interfaces-adt can type it.
 */
export const GROUP_ONLY_ADDRESS = {
  'VIEW/DV': (name: string) => DDIC_VIEW.uri(name),
} as const;

/** A code only the group operations address: see {@link GROUP_ONLY_ADDRESS}. */
export type AdtGroupOnlyCode = keyof typeof GROUP_ONLY_ADDRESS;

/**
 * Every code with an address: a code of the tables but `MSAG/NN`, which has
 * none of its own, and the group-only codes.
 */
export type AdtAddressableCode =
  | Exclude<AdtTypeCode, keyof typeof NO_OWN_ADDRESS_REASON>
  | AdtGroupOnlyCode;

/** Whether `code` is a group-only code — a value from outside the types included. */
export function isGroupOnlyCode(code: string): code is AdtGroupOnlyCode {
  return Object.hasOwn(GROUP_ONLY_ADDRESS, code);
}

/** The parent's API entry in the table that names the child. */
export function parentEntry(
  e: ICodeEntry,
  parent: AdtApiName,
): AdtApiEntry<string> | undefined {
  return e.table[parent];
}
