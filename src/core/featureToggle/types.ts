/**
 * Feature Toggle (FTG2/FT) module type definitions.
 *
 * Surface pairs the standard IAdtObject CRUD + lifecycle with five domain
 * methods for state management (switchOn / switchOff / getRuntimeState /
 * checkState / readSource). Consumers use the specialized
 * IFeatureToggleObject interface so the domain methods stay statically
 * visible on the factory return type.
 */

// Types defined in @mcp-abap-adt/interfaces
export type {
  FeatureToggleState,
  ICreateFeatureToggleParams,
  IDeleteFeatureToggleParams,
  IFeatureToggleAttribute,
  IFeatureToggleCheckStateResult,
  IFeatureToggleClientLevel,
  IFeatureToggleConfig,
  IFeatureToggleHeader,
  IFeatureToggleObject,
  IFeatureTogglePlanning,
  IFeatureToggleReleasePlan,
  IFeatureToggleRollout,
  IFeatureToggleRuntimeState,
  IFeatureToggleSource,
  IFeatureToggleState,
  IFeatureToggleUserLevel,
  IToggleFeatureToggleParams,
} from '@mcp-abap-adt/interfaces';
