/**
 * Standalone `PROG/I` includes.
 *
 * **Not the same thing as a function-group include.** ABAP has two, and they
 * are different resources, not two spellings of one:
 *
 * | | this module | `src/core/functionInclude/` |
 * |---|---|---|
 * | type | `PROG/I` | `FUGR/I` |
 * | collection | `/sap/bc/adt/programs/includes` | `/sap/bc/adt/functions/groups/{group}/includes` |
 * | belongs to | nothing — it stands alone | its function group |
 * | validation | `/sap/bc/adt/includes/validation` | none; the parent group is probed instead |
 *
 * Discovery lists `/sap/bc/adt/programs/includes` on every system checked. The
 * function-group one is not a discovery collection at all — it is a
 * sub-resource of a group, which is the structural difference in one fact.
 *
 * Where each is creatable also differs: a `PROG/I` include gets an `app:accept`
 * only on modern on-prem, so only there is its collection a POST target.
 */

export { AdtInclude } from './AdtInclude';
export { activateInclude } from './activation';
export { CT_INCLUDE, create } from './create';
export { deleteInclude } from './delete';
export { includeUrl, lockInclude } from './lock';
export { getIncludeMetadata, getIncludeSource } from './read';
export { unlockInclude } from './unlock';
export { uploadIncludeSource } from './update';
