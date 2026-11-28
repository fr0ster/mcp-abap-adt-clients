/**
 * Where an object of a type code lives, read from the ADT type tables of
 * `@mcp-abap-adt/interfaces-adt`.
 *
 * The tables are the library's declaration of what it serves; an object's
 * address is built by its code's record in `objects.ts`, named once per code
 * in {@link OWN_ADDRESS} and {@link PARENTED_ADDRESS}. What has no address of
 * its own is an irregular address below, typed and named with its reason.
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
  type AdtUtilityCode,
  type IAdtCodeFacts,
} from '@mcp-abap-adt/interfaces-adt';
import {
  ACCESS_CONTROL,
  AUTHORIZATION_FIELD,
  BEHAVIOR_DEFINITION,
  CLASS,
  DATA_ELEMENT,
  DDIC_VIEW,
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
  TABLE_SETTINGS,
  TABLE_TYPE,
  TEXT_ELEMENTS,
  TRANSFORMATION,
  TYPE_GROUP,
} from './objects';

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
 * A code whose API the library serves no handler for yet: interfaces-adt
 * 34.0.0's tables carry its row for a task that lands later, and no record of
 * `objects.ts` addresses it. Its address is refused until that task writes
 * the record.
 */
function notServedYet(api: AdtApiName): (name: string) => string {
  return (name) => {
    throw new Error(
      `No ADT address is known for ${name}: the library serves no ${api} yet`,
    );
  };
}

/**
 * Every code with an address of its own, and the record that builds it: the
 * one place `buildObjectUri` takes an address from. Keyed by the type codes
 * of the tables, so a code the tables add fails to compile here until its
 * record is named.
 */
export const OWN_ADDRESS = {
  'CLAS/OC': (name: string) => CLASS.uri(name),
  'INTF/OI': (name: string) => INTERFACE.uri(name),
  'PROG/P': (name: string) => PROGRAM.uri(name),
  'PROG/I': (name: string) => PROGRAM_INCLUDE.uri(name),
  'FUGR/F': (name: string) => FUNCTION_GROUP.uri(name),
  'DEVC/K': (name: string) => PACKAGE.uri(name),
  'DDLS/DF': (name: string) => DDL_SOURCE.uri(name),
  'TABL/DT': (name: string) => TABLE.uri(name),
  'TABL/DTT': (name: string) => TABLE_SETTINGS.uri(name),
  // The code's address is a program's text elements; a function group's are
  // the same code under `functiongroups`, named by the where-used container
  // or the activation reference's uri.
  'PROG/PX': (name: string) => TEXT_ELEMENTS.uri('program', name),
  'CLAS/OCX': (name: string) => TEXT_ELEMENTS.uri('class', name),
  'TABL/DS': (name: string) => STRUCTURE.uri(name),
  'TTYP/DA': (name: string) => TABLE_TYPE.uri(name),
  // The name kept as given, never case-folded: the type group's record.
  'TYPE/DG': (name: string) => TYPE_GROUP.uri(name),
  'DOMA/DD': (name: string) => DOMAIN.uri(name),
  'DTEL/DE': (name: string) => DATA_ELEMENT.uri(name),
  'DCLS/DL': (name: string) => ACCESS_CONTROL.uri(name),
  'BDEF/BDO': (name: string) => BEHAVIOR_DEFINITION.uri(name),
  'DDLX/EX': (name: string) => METADATA_EXTENSION.uri(name),
  'SRVD/SRV': (name: string) => SERVICE_DEFINITION.uri(name),
  'SRVB/SVB': (name: string) => SERVICE_BINDING.uri(name),
  'DSFD/SCF': (name: string) => SCALAR_FUNCTION.uri(name),
  'DSFI/SFI': (name: string) => SCALAR_FUNCTION_IMPLEMENTATION.uri(name),
  'XSLT/VT': (name: string) => TRANSFORMATION.uri(name),
  'MSAG/N': (name: string) => MESSAGE_CLASS.uri(name),
  'FTG2/FT': (name: string) => FEATURE_TOGGLE.uri(name),
  AUTH: (name: string) => AUTHORIZATION_FIELD.uri(name),
  'ENHO/XHH': (name: string) => ENHANCEMENT.uri('enhoxhh', name),
  'ENHO/XHB': (name: string) => ENHANCEMENT.uri('enhoxhb', name),
  'ENHS/XSB': (name: string) => ENHANCEMENT.uri('enhsxsb', name),
  'APLO/TYP': notServedYet('applicationLog'),
  SAJC: notServedYet('applicationJobCatalog'),
  SAJT: notServedYet('applicationJobTemplate'),
} as const satisfies {
  readonly [C in Exclude<
    AdtTypeCode,
    AdtParentedTypeCode | keyof typeof NO_OWN_ADDRESS_REASON
  >]: (name: string) => string;
};

/** Every code addressed under its parent, and the record that builds it. */
export const PARENTED_ADDRESS = {
  'FUGR/FF': (parent: string, name: string) =>
    FUNCTION_MODULE.uri(parent, name),
  'FUGR/I': (parent: string, name: string) =>
    FUNCTION_INCLUDE.uri(parent, name),
} as const satisfies {
  readonly [C in AdtParentedTypeCode]: (parent: string, name: string) => string;
};

/** {@link OWN_ADDRESS}, by a code's text: absent for any other code. */
export const OWN_ADDRESS_OF: ReadonlyMap<string, (name: string) => string> =
  new Map(Object.entries(OWN_ADDRESS));

/** {@link PARENTED_ADDRESS}, by a code's text: absent for any other code. */
export const PARENTED_ADDRESS_OF: ReadonlyMap<
  string,
  (parent: string, name: string) => string
> = new Map(Object.entries(PARENTED_ADDRESS));

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
} as const satisfies Partial<Record<AdtUtilityCode, (name: string) => string>>;

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
export function isGroupOnlyCode(code: string): boolean {
  return Object.hasOwn(GROUP_ONLY_ADDRESS, code);
}

/**
 * The address builder of a group-only code, by its text: a typed lookup, so
 * a caller learns the builder without a predicate narrowing the code.
 */
export const GROUP_ONLY_ADDRESS_OF: ReadonlyMap<
  string,
  (name: string) => string
> = new Map(Object.entries(GROUP_ONLY_ADDRESS));
