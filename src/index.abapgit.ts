/**
 * ADT Clients — abapGit barrel
 * Covers: AdtAbapGitClient and the result set it is constructed with. Contract
 * types (IAdtAbapGitClient and friends) come from @mcp-abap-adt/interfaces-adt.
 */

export { AdtAbapGitClient } from './clients/AdtAbapGitClient';
export {
  abapGitDocuments,
  type IAbapGitResults,
} from './clients/abapGit/types';
