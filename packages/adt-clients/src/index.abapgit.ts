/**
 * ADT Clients — abapGit barrel
 * Covers: AdtAbapGitClient and the result set it is constructed with. Contract
 * types (IAdtAbapGitClient and friends) come from @mcp-abap-adt/interfaces-adt;
 * the facts readings and reducer (`abapGitFacts`) from
 * @mcp-abap-adt/adt-strategies.
 */

export { AdtAbapGitClient } from './clients/AdtAbapGitClient';
export {
  type AbapGitDefaultFacts,
  type AbapGitFactsSlot,
  type AbapGitFactsSlotValue,
  type AbapGitStrategiesOf,
  type AbapGitValues,
  type AbapGitValuesOf,
  abapGitDocuments,
  type FactsValue,
  type IAbapGitFactsOf,
  type IAbapGitFactsResults,
  type IAbapGitResults,
} from './clients/abapGit/types';
