/**
 * Package module type definitions.
 *
 * `IPackageState` is gone with the other state bags: a member now answers what
 * its own endpoint produced, and a failure carries the request that produced it.
 * What each member answers is declared here, beside the implementation that
 * produces it, because a result is the implementation's to name — the contract
 * says only that it is answered.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  ICreatePackageParams,
  IDeletePackageParams,
  IPackageConfig,
  IUpdatePackageParams,
} from '@mcp-abap-adt/interfaces';

/**
 * What the create answers: the package's metadata document.
 */
export type PackageCreated = string;

/**
 * What `read` answers: the package's metadata document.
 *
 * A package is a container and has no source; `read` and `readMetadata` fetch the
 * same resource.
 *
 * Measured: a read of a package that is not ready answers 200 with an **empty**
 * body, which silently corrupts a read-modify-write.
 */
export type PackageSource = string;

/**
 * The package's metadata document — the same resource `read` fetches.
 */
export type PackageMetadata = string;

/**
 * What a check run answers: `chkl:messages`.
 *
 * Not a syntax check — a package is a container — but the server's own verdict
 * on the object, which Eclipse runs right after a create.
 */
export type PackageCheckResult = string;

/**
 * What the validation endpoint answers.
 */
export type PackageValidationResult = string;

/**
 * What the deletion answers.
 *
 * Measured on E19 2026-08-31: a package this session has just updated cannot be
 * deleted by this session. `deletion/check` answers `isDeletable="true"` while
 * `deletion/delete` answers **200** carrying `isDeleted="false"` and PAK/058,
 * "package is already locked" — so the document, not the status, is the verdict.
 */
export type PackageDeletionResult = string;

/**
 * What the metadata write answers.
 */
export type PackageUpdated = string;

/**
 * The transport document for the package.
 */
export type PackageTransport = string;

/** One strategy per member of a package implementation. See `IClassResults`. */
export interface IPackageResults<
  TCreated = PackageCreated,
  TSource = PackageSource,
  TMetadata = PackageMetadata,
  TCheck = PackageCheckResult,
  TValidation = PackageValidationResult,
  TDeletion = PackageDeletionResult,
  TUpdated = PackageUpdated,
  TTransport = PackageTransport,
> {
  readonly created: IResultStrategy<TCreated>;
  readonly source: IResultStrategy<TSource>;
  readonly metadata: IResultStrategy<TMetadata>;
  readonly check: IResultStrategy<TCheck>;
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
export const packageDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  transport: rawDocument,
} satisfies IPackageResults;
