/**
 * The codes each `getUtils()` member takes, typed against the ADT type
 * tables and the variant of the client that built it.
 *
 * A member takes only the codes whose request it sends: a code outside its
 * set does not compile, and from a caller outside the type system it is
 * refused before any request. The generic reads serve exactly the codes
 * they served before 38.0.0 (and `FUGR/F`, whose metadata Accept was
 * measured with 38.0.0), each with its own Accept; no request this library
 * never sent becomes possible through them.
 */

import type {
  AdtParentedTypeCode,
  AdtTypeCode,
  AdtUtilityCode,
  AdtVariant,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  AdtCodeOf,
  AdtCodeWith,
  AdtModernVariant,
} from '../../clients/variant';
import {
  ACCEPT_CLASS,
  ACCEPT_DATA_ELEMENT,
  ACCEPT_DOMAIN,
  ACCEPT_FUNCTION_GROUP,
  ACCEPT_FUNCTION_MODULE,
  ACCEPT_INTERFACE,
  ACCEPT_PACKAGE,
  ACCEPT_PROGRAM,
  ACCEPT_STRUCTURE,
  ACCEPT_TABLE,
  ACCEPT_TABLE_TYPE,
  CT_VIEW,
} from '../../constants/contentTypes';

/**
 * The codes `readObjectMetadata` reads, each with the Accept it is asked
 * for: the codes it served before 38.0.0 under its friendly names and
 * lower-case spellings (`stru/dt` is `TABL/DS`, `ttyp/df` is `TTYP/DA`,
 * `fugr` is `FUGR/F`), with the Accept each was sent.
 */
export const METADATA_READ = {
  'CLAS/OC': ACCEPT_CLASS,
  'INTF/OI': ACCEPT_INTERFACE,
  'PROG/P': ACCEPT_PROGRAM,
  'FUGR/F': ACCEPT_FUNCTION_GROUP,
  'FUGR/FF': ACCEPT_FUNCTION_MODULE,
  'DDLS/DF': CT_VIEW,
  'TABL/DT': ACCEPT_TABLE,
  'TABL/DS': ACCEPT_STRUCTURE,
  'TTYP/DA': ACCEPT_TABLE_TYPE,
  'DOMA/DD': ACCEPT_DOMAIN,
  'DTEL/DE': ACCEPT_DATA_ELEMENT,
  'DEVC/K': ACCEPT_PACKAGE,
} as const satisfies Partial<Record<AdtTypeCode, string>>;

/**
 * Codes written out in a type, checked to be codes of the tables:
 * `AdtCodes<'FUGR/I' | 'MSAG/NN'>` does not compile for a code no table
 * holds. Internal.
 */
export type AdtCodes<C extends AdtUtilityCode> = C;

/** A code `readObjectMetadata` reads. */
export type AdtMetadataReadCode = keyof typeof METADATA_READ;

/**
 * The codes `readObjectSource` reads: those it read before 38.0.0 (`class`,
 * `program`, `interface`, `functionmodule`, `view`, `structure`, `table`)
 * that have a source in the tables — a table type has none.
 */
export const SOURCE_READ = {
  'CLAS/OC': true,
  'INTF/OI': true,
  'PROG/P': true,
  'FUGR/FF': true,
  'DDLS/DF': true,
  'TABL/DT': true,
  'TABL/DS': true,
} as const satisfies Partial<Record<AdtTypeCode, true>>;

/** A code `readObjectSource` reads. */
export type AdtSourceReadCode = keyof typeof SOURCE_READ;

/** Whether text from outside the types is a code `readObjectMetadata` reads. */
export function isMetadataReadCode(code: string): code is AdtMetadataReadCode {
  return Object.hasOwn(METADATA_READ, code);
}

/** Whether text from outside the types is a code `readObjectSource` reads. */
export function isSourceReadCode(code: string): code is AdtSourceReadCode {
  return Object.hasOwn(SOURCE_READ, code);
}

/**
 * The group-only codes (`VIEW/DV`) are addressed by these members at run
 * time, but are in none of the sets below: a member whose parameter admitted
 * a code no table holds would no longer implement its interfaces-adt atom,
 * whose references take an `AdtTypeCode`. They are typed when the contract
 * package types them.
 */

/** What a group operation, where-used or a structure read is given, per object. */
export interface IAdtGroupReference<C extends string> {
  /** Object name, `adtcore:name`. */
  name: string;
  /** Its code. */
  type: C;
  /** ADT URI of the object, `adtcore:uri`, where the caller knows it. */
  uri?: string;
  /** The parent's name: the function group of `FUGR/FF` or `FUGR/I`. */
  parentName?: string;
}

/** The codes `search` filters by on variant `V`. */
export type AdtSearchCode<V extends AdtVariant> = AdtCodeOf<V>;

/**
 * The codes the node and object structure reads are asked of: the variant's
 * codes, and `DEVC/K` on every variant — a package's contents are a node
 * structure of the package, served on SAP_BASIS 7.40 SP04 too (measured: the
 * legacy `UtilsReaders` cycle, `fetchNodeStructure('DEVC/K', '$TMP')`), though
 * 7.40's table has no package API.
 */
export type AdtStructureCode<V extends AdtVariant> =
  | AdtCodeOf<V>
  | AdtCodes<'DEVC/K'>;

/**
 * The codes where-used is asked of: every addressable code but a function
 * include, whose group where-used has no field for (a function module names
 * it as `GROUP|FM`).
 */
export type AdtWhereUsedCode<V extends AdtVariant> = Exclude<
  AdtCodeOf<V>,
  AdtCodes<'FUGR/I' | 'MSAG/NN'>
>;

/**
 * The codes the tables list no `activate` for that a modern group activation
 * still sends: `DEVC/K`. A package in a group activation was sent before
 * 38.0.0, so it stays — unmeasured, and listed for interfaces-adt 21.1.0 to
 * measure. Not on 7.40, whose utilities take only 7.40's codes.
 */
export const ACTIVATED_WITHOUT_TABLE = {
  'DEVC/K': true,
} as const satisfies Partial<Record<AdtTypeCode, true>>;

/** The codes of {@link ACTIVATED_WITHOUT_TABLE} on variant `V`. */
type ActivatedWithoutTable<V extends AdtVariant> = [V] extends [
  AdtModernVariant,
]
  ? keyof typeof ACTIVATED_WITHOUT_TABLE
  : never;

/**
 * The codes a group activation activates: the codes whose API lists
 * `activate` on every variant of `V` — so no message class — and, on a modern
 * variant, a package (`ACTIVATED_WITHOUT_TABLE`).
 */
export type AdtActivationCode<V extends AdtVariant> =
  | Exclude<AdtCodeWith<V, 'activate'>, AdtCodes<'MSAG/NN'>>
  | ActivatedWithoutTable<V>;

/** Whether text from outside the types is activated without the table's word. */
export function isActivatedWithoutTable(code: string): boolean {
  return Object.hasOwn(ACTIVATED_WITHOUT_TABLE, code);
}

/** The codes a group deletion check asks about. */
export type AdtDeletionCheckCode<V extends AdtVariant> = Exclude<
  AdtCodeWith<V, 'deletionCheck'>,
  AdtCodes<'MSAG/NN'>
>;

/** The codes a group deletion deletes. */
export type AdtDeletionCode<V extends AdtVariant> = Exclude<
  AdtCodeWith<V, 'delete'>,
  AdtCodes<'MSAG/NN'>
>;

/** The codes `readObjectMetadata` reads on variant `V`. */
export type AdtMetadataReadCodeOf<V extends AdtVariant> = Extract<
  AdtCodeOf<V>,
  AdtMetadataReadCode
>;

/** The codes `readObjectSource` reads on variant `V`. */
export type AdtSourceReadCodeOf<V extends AdtVariant> = Extract<
  AdtCodeOf<V>,
  AdtSourceReadCode
>;

/**
 * The arguments after a code and a name: the parent's name first — required
 * for a parented code (`FUGR/FF`), optional otherwise — then `Rest`.
 */
export type ParentedArguments<C extends string, Rest extends unknown[]> = [
  C,
] extends [AdtParentedTypeCode]
  ? [functionGroup: string, ...Rest]
  : [functionGroup?: string, ...Rest];
