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
  IFeatureToggleAttribute,
  IFeatureToggleConfig,
  IFeatureToggleHeader,
  IFeatureToggleObject,
  IFeatureTogglePlanning,
  IFeatureToggleReleasePlan,
  IFeatureToggleRollout,
  IFeatureToggleSource,
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
export interface IFeatureToggleResults {
  readonly created: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly metadata: IResultStrategy<unknown>;
  readonly check: IResultStrategy<unknown>;
  readonly activation: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
  readonly deletion: IResultStrategy<unknown>;
  readonly updated: IResultStrategy<unknown>;
  readonly sourceDocument: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
  /** What the object's own document answers when written. */
  readonly metadataUpdated: IResultStrategy<unknown>;
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
  deletionCheck: rawDocument,
  metadataUpdated: rawDocument,
} satisfies IFeatureToggleResults;

/**
 * The shapes below describe the argument of the request builders in this
 * module, and they used to be declared in `@mcp-abap-adt/interfaces`. Nobody
 * outside this package ever accepted them — no parameter, field or return
 * anywhere else was typed by one — and being nobody's contract is how 85 of
 * their fields came to be ignored by the very code that took them, for
 * releases, unnoticed. They live here now, beside the function that reads
 * them, which is the only place that can keep them honest. See decision 30 in
 * the interfaces repository.
 */

export interface ICreateFeatureToggleParams {
  feature_toggle_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
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
