/**
 * Feature Toggle (FTG2/FT) module type definitions.
 *
 * Surface pairs the standard IAdtObject CRUD + lifecycle with five domain
 * methods for state management (switchOn / switchOff / getRuntimeState /
 * checkState / readSource). Consumers use the specialized
 * IFeatureToggleObject interface so the domain methods stay statically
 * visible on the factory return type.
 */

import type { IAdtObject, IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type FeatureToggleState = 'on' | 'off' | 'undefined';

export interface IFeatureToggleHeader {
  description?: string;
  originalLanguage?: string;
  abapLanguageVersion?: string;
}

export interface IFeatureToggleReleasePlan {
  version: string;
  sp: string;
}

export interface IFeatureTogglePlanning {
  referenceProduct?: string;
  releaseToCustomer?: IFeatureToggleReleasePlan;
  generalAvailability?: IFeatureToggleReleasePlan;
  generalRollout?: IFeatureToggleReleasePlan;
}

export interface IFeatureToggleRollout {
  lifecycleStatus?: 'new' | 'inValidation' | 'released' | 'discontinued';
  validationStep?: 'internal' | 'releaseToCustomer' | string;
  rolloutStep?:
    | 'releaseToCustomer'
    | 'generalAvailability'
    | 'generalRollout'
    | string;
  strategy?: 'immediate' | 'gradual' | string;
  finalDate?: string;
  event?: 'noRestriction' | string;
  planning?: IFeatureTogglePlanning;
  configurable?: boolean;
  defaultEnabledFor?: 'none' | 'someCustomers' | 'allCustomers' | string;
  reversible?: boolean;
}

export interface IFeatureToggleAttribute {
  key: string;
  value: string;
}

export interface IFeatureToggleSource {
  header?: IFeatureToggleHeader;
  rollout?: IFeatureToggleRollout;
  toggledPackages?: string[];
  relatedToggles?: string[];
  attributes?: IFeatureToggleAttribute[];
}

export interface IFeatureToggleClientLevel {
  client: string;
  description?: string;
  state: FeatureToggleState;
}

export interface IFeatureToggleUserLevel {
  user: string;
  state: FeatureToggleState;
}

export interface IFeatureToggleRuntimeState {
  name: string;
  clientState: FeatureToggleState;
  userState: FeatureToggleState;
  clientChangedBy?: string;
  clientChangedOn?: string;
  clientStates: IFeatureToggleClientLevel[];
  userStates: IFeatureToggleUserLevel[];
}

export interface IFeatureToggleCheckStateResult {
  currentState: FeatureToggleState;
  transportPackage?: string;
  transportUri?: string;
  customizingTransportAllowed: boolean;
}

export interface IFeatureToggleConfig {
  featureToggleName: string;
  packageName?: string;
  description?: string;
  transportRequest?: string;
  masterSystem?: string;
  responsible?: string;
  source?: IFeatureToggleSource;
  onLock?: (lockHandle: string) => void;
}

export interface IFeatureToggleState extends IAdtObjectState {
  runtimeState?: IFeatureToggleRuntimeState;
  checkStateResult?: IFeatureToggleCheckStateResult;
  sourceResult?: IFeatureToggleSource;
}

export interface IFeatureToggleObject
  extends IAdtObject<IFeatureToggleConfig, IFeatureToggleState> {
  switchOn(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  getRuntimeState(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IFeatureToggleState>;

  checkState(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
  ): Promise<IFeatureToggleState>;

  readSource(
    config: Partial<IFeatureToggleConfig>,
    version?: 'active' | 'inactive',
  ): Promise<IFeatureToggleState>;
}

export interface ICreateFeatureToggleParams {
  feature_toggle_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  source?: IFeatureToggleSource;
}

export interface IDeleteFeatureToggleParams {
  feature_toggle_name: string;
  transport_request?: string;
}

export interface IToggleFeatureToggleParams {
  feature_toggle_name: string;
  state: 'on' | 'off';
  is_user_specific: boolean;
  transport_request?: string;
}
