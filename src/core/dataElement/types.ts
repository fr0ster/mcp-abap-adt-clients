/**
 * DataElement module type definitions.
 *
 * `IDataElementState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreateDataElementParams,
  IDataElementConfig,
  IDeleteDataElementParams,
  IUpdateDataElementParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the data element's XML document.
 */
export type DataElementCreated = string;

/**
 * What `read` answers: the object's XML document.
 *
 * This type has no source — `read` and `readMetadata` fetch the same resource,
 * and the `version` argument is accepted and ignored.
 *
 * Measured: a read of an object that is not ready answers 200 with an **empty**
 * body, which silently corrupts a read-modify-write. A caller doing one supplies
 * an `analyse` that calls an empty body a failure.
 */
export type DataElementSource = string;

/**
 * The data element's XML document — the same resource `read` fetches.
 */
export type DataElementMetadata = string;

/**
 * What a check run answers.
 *
 * Measured: for DDIC objects a check is not fully supported on every system —
 * some answer an "importing from database" error, which is the system declining
 * to check rather than a verdict about the object.
 */
export type DataElementCheckResult = string;

/**
 * What activation answers: `chkl:messages`.
 */
export type DataElementActivationResult = string;

/**
 * What name validation answers. The endpoint refuses an empty description.
 */
export type DataElementValidationResult = string;

/**
 * What the deletion answers.
 */
export type DataElementDeletionResult = string;

/**
 * What the XML write answers.
 *
 * The write is a read-modify-write: `updateDataElement` GETs the current
 * document, patches the changed fields and PUTs it back.
 */
export type DataElementUpdated = string;

/**
 * The transport document for the data element.
 */
export type DataElementTransport = string;

/** One strategy per member of a dataElement implementation. See `IClassResults`. */
export interface IDataElementResults<
  TCreated = DataElementCreated,
  TSource = DataElementSource,
  TMetadata = DataElementMetadata,
  TCheck = DataElementCheckResult,
  TActivation = DataElementActivationResult,
  TValidation = DataElementValidationResult,
  TDeletion = DataElementDeletionResult,
  TUpdated = DataElementUpdated,
  TTransport = DataElementTransport,
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
export const dataElementDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IDataElementResults;
