/**
 * ServiceDefinition module type definitions.
 *
 * `IServiceDefinitionState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateServiceDefinitionParams,
  IDeleteServiceDefinitionParams,
  IServiceDefinitionConfig,
  IUpdateServiceDefinitionParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the object's metadata document.
 */
export type ServiceDefinitionCreated = string;

/**
 * The object's source, from `/source/main`.
 *
 * Empty is a legitimate answer and is not, on its own, absence: ADT answers a
 * read for a missing object with 200 and no body rather than 404.
 */
export type ServiceDefinitionSource = string;

/**
 * The object's metadata document.
 */
export type ServiceDefinitionMetadata = string;

/**
 * What a check run answers: `chkl:messages`, whose `<msg type="E">` entries are
 * the verdict. The status is not — ADT answers a refusal inside a 200.
 */
export type ServiceDefinitionCheckResult = string;

/**
 * What activation answers: `chkl:messages` again.
 */
export type ServiceDefinitionActivationResult = string;

/**
 * What name validation answers.
 */
export type ServiceDefinitionValidationResult = string;

/**
 * What the deletion answers.
 */
export type ServiceDefinitionDeletionResult = string;

/**
 * What the source write answers.
 */
export type ServiceDefinitionUpdated = string;

/**
 * The transport document for the object.
 */
export type ServiceDefinitionTransport = string;

/** One strategy per member of a serviceDefinition implementation. See `IClassResults`. */
export interface IServiceDefinitionResults<
  TCreated = ServiceDefinitionCreated,
  TSource = ServiceDefinitionSource,
  TMetadata = ServiceDefinitionMetadata,
  TCheck = ServiceDefinitionCheckResult,
  TActivation = ServiceDefinitionActivationResult,
  TValidation = ServiceDefinitionValidationResult,
  TDeletion = ServiceDefinitionDeletionResult,
  TUpdated = ServiceDefinitionUpdated,
  TTransport = ServiceDefinitionTransport,
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
export const serviceDefinitionDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IServiceDefinitionResults;
