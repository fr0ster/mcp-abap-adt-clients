/**
 * Feature Toggle (FTG2/FT) module type definitions.
 *
 * The CRUD atoms plus five domain members for state management — switchOn,
 * switchOff, getRuntimeState, checkState, readSource — which is what
 * `IFeatureToggleObject` in the contract names.
 *
 * The runtime-state shapes below left `@mcp-abap-adt/interfaces` in 31.0.0 with
 * the other result shapes: `IFeatureToggleObject<TState>` says a toggle answers
 * *a* state, and what that state looks like is this implementation's to name.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateFeatureToggleParams,
  IDeleteFeatureToggleParams,
  IFeatureToggleAttribute,
  IFeatureToggleConfig,
  IFeatureToggleHeader,
  IFeatureToggleObject,
  IFeatureTogglePlanning,
  IFeatureToggleReleasePlan,
  IFeatureToggleRollout,
  IFeatureToggleSource,
  IToggleFeatureToggleParams,
} from '@mcp-abap-adt/interfaces';

/** What a toggle can be, as SFW reports it. */
export type FeatureToggleState = 'on' | 'off' | 'undefined';

/** One client's setting of a toggle. */
export interface IFeatureToggleClientLevel {
  client: string;
  description?: string;
  state: FeatureToggleState;
}

/** One user's setting of a toggle. */
export interface IFeatureToggleUserLevel {
  user: string;
  state: FeatureToggleState;
}

/**
 * A toggle's runtime state: what it is set to, for whom, and by whom last.
 *
 * This is the shape the five domain members answer by default — read out of
 * the SFW state resource rather than handed over as a document, because the
 * whole point of `getRuntimeState` is the two settings and who set them.
 */
export interface IFeatureToggleRuntimeState {
  name: string;
  clientState: FeatureToggleState;
  userState: FeatureToggleState;
  clientChangedBy?: string;
  clientChangedOn?: string;
  clientStates: IFeatureToggleClientLevel[];
  userStates: IFeatureToggleUserLevel[];
}

/** What `checkState` answers: the current state and what a change would need. */
export interface IFeatureToggleCheckStateResult {
  currentState: FeatureToggleState;
  transportPackage?: string;
  transportUri?: string;
  customizingTransportAllowed: boolean;
}

/**
 * What ADT answers when a feature toggle is created: its metadata document.
 */
export type FeatureToggleCreated = string;

/** The toggle's document, as `read` fetches it. */
export type FeatureToggleSource = string;

/** The toggle's metadata document. */
export type FeatureToggleMetadata = string;

/** What a check run answers. */
export type FeatureToggleCheckResult = string;

/** What activation answers. */
export type FeatureToggleActivationResult = string;

/** What name validation answers. */
export type FeatureToggleValidationResult = string;

/** What the deletion answers. */
export type FeatureToggleDeletionResult = string;

/** What the metadata write answers. */
export type FeatureToggleUpdated = string;

/** What the source (JSON) write and read answer. */
export type FeatureToggleSourceDocument = string;

/** One strategy per member of a feature-toggle implementation. */
export interface IFeatureToggleResults<
  TCreated = FeatureToggleCreated,
  TSource = FeatureToggleSource,
  TMetadata = FeatureToggleMetadata,
  TCheck = FeatureToggleCheckResult,
  TActivation = FeatureToggleActivationResult,
  TValidation = FeatureToggleValidationResult,
  TDeletion = FeatureToggleDeletionResult,
  TUpdated = FeatureToggleUpdated,
  TSourceDocument = FeatureToggleSourceDocument,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
  readonly activation: IResultStrategy<TActivation>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
  readonly sourceDocument: IResultStrategy<TSourceDocument>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const featureToggleDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  sourceDocument: rawDocument,
} satisfies IFeatureToggleResults;
