/**
 * BehaviorDefinition module type definitions.
 *
 * `IBehaviorDefinitionState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';

/**
 * The check reporters ADT accepts for a behavior definition.
 *
 * It left `@mcp-abap-adt/interfaces` in 31.0.0 with the other result shapes:
 * a caller does not need it to call `check`, which takes a `string`, and an
 * implementation that offered different reporters would name its own.
 */
export type CheckReporter =
  | 'abapCheckRun'
  | 'bdefCheckRun'
  | 'bdefImplementationCheck';

import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  BehaviorDefinitionImplementationType,
  IBehaviorDefinitionConfig,
  IBehaviorDefinitionCreateParams,
  IBehaviorDefinitionValidationParams,
  IUpdateBehaviorDefinitionParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the definition's metadata document.
 */
export type BehaviorDefinitionCreated = string;

/**
 * The definition's source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence.
 */
export type BehaviorDefinitionSource = string;

/**
 * The definition's metadata document.
 */
export type BehaviorDefinitionMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type BehaviorDefinitionCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type BehaviorDefinitionActivationResult = string;

/**
 * What validation answers.
 *
 * The endpoint takes the root entity and implementation type as well as the
 * name, so a validation needs the whole shape a create would use.
 */
export type BehaviorDefinitionValidationResult = string;

/**
 * What the deletion answers.
 */
export type BehaviorDefinitionDeletionResult = string;

/**
 * What the source write answers.
 */
export type BehaviorDefinitionUpdated = string;

/**
 * The transport document for the definition.
 */
export type BehaviorDefinitionTransport = string;

/** One strategy per member of a behaviorDefinition implementation. See `IClassResults`. */
export interface IBehaviorDefinitionResults<
  TCreated = BehaviorDefinitionCreated,
  TSource = BehaviorDefinitionSource,
  TMetadata = BehaviorDefinitionMetadata,
  TCheck = BehaviorDefinitionCheckResult,
  TActivation = BehaviorDefinitionActivationResult,
  TValidation = BehaviorDefinitionValidationResult,
  TDeletion = BehaviorDefinitionDeletionResult,
  TUpdated = BehaviorDefinitionUpdated,
  TTransport = BehaviorDefinitionTransport,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
  readonly activation: IResultStrategy<TActivation>;
  readonly validation: IResultStrategy<TValidation>;
  readonly deletion: IResultStrategy<TDeletion>;
  readonly updated: IResultStrategy<TUpdated>;
  readonly transport: IResultStrategy<TTransport>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const behaviorDefinitionDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IBehaviorDefinitionResults;
