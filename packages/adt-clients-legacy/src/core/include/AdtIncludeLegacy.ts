/**
 * AdtIncludeLegacy - standalone include handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * Overrides:
 * - checkDeletion() — refused without a request: 7.40 has no deletion API.
 * - updateMetadata() — refused without a request: not measured on 7.40.
 * - readMainPrograms() — refused without a request: not measured on 7.40.
 * - delete() — `DELETE <URI>?lockHandle=…` under the lock handle the caller
 *   holds (measured on 7.40 SP04: `200`, a read afterwards answers `404`;
 *   record B4-cycles-20261026-2019).
 */

import {
  AdtInclude,
  type AdtPerformedBy,
  answering,
  type IncludeValues,
  type includeDocuments,
  PROGRAM_INCLUDE,
  type ResultValuesOf,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  AdtRequiredUpdateOptions,
  IAdtError,
  IAdtHeaders,
  IAdtLockedWrite,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtUpdateOptions,
  IAnalyse,
  IIncludeConfig,
  IIncludeResults,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import {
  legacyNotMeasuredRefusal,
  noDeletionCheck,
} from '../shared/refusalLegacy';

export class AdtIncludeLegacy<
  T extends IncludeValues = ResultValuesOf<typeof includeDocuments>,
> extends AdtInclude<T, 'basis740'> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'include', 'deletionCheck'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  override checkDeletion(
    this: this & AdtPerformedBy<'include', 'deletionCheck'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'include', 'deletionCheck'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    return noDeletionCheck<T['deletionCheck'], E>();
  }

  /**
   * Refused without a request until measured: 7.40 SP04's type table lists no
   * `updateMetadata` for the include, and no run there has sent the PUT of its
   * metadata document.
   */
  override updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'include', 'updateMetadata'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  override updateMetadata(
    this: this & AdtPerformedBy<'include', 'updateMetadata'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  override async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'include', 'updateMetadata'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    return legacyNotMeasuredRefusal<T['metadataUpdated'], E>(
      'updateMetadata',
      'PUT /sap/bc/adt/programs/includes/{name}',
    );
  }

  /**
   * Refused without a request until measured: 7.40 SP04's type table lists no
   * `mainPrograms` for the include, and no run there has sent the GET of its
   * main programs.
   */
  override readMainPrograms<E extends IAdtError>(
    this: this & AdtPerformedBy<'include', 'mainPrograms'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['mainPrograms'], E | IAdtError>>;
  override readMainPrograms(
    this: this & AdtPerformedBy<'include', 'mainPrograms'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['mainPrograms'], IAdtError>>;
  override async readMainPrograms<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'include', 'mainPrograms'>,
    _config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    _options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['mainPrograms'], E | IAdtError>> {
    return legacyNotMeasuredRefusal<T['mainPrograms'], E>(
      'readMainPrograms',
      'GET /sap/bc/adt/programs/includes/{name}/mainprograms',
    );
  }

  /**
   * Delete include — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when given. The lock is yours: pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: `200`, and a read of the
   * include afterwards answers `404`.
   */
  override delete<E extends IAdtError>(
    config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  override delete(
    config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  override async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IIncludeConfig, 'includeName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    const objectUrl = PROGRAM_INCLUDE.uri(config.includeName as string);
    return answering(
      () =>
        deleteObjectDirect(
          withCallTimeout(this.connection, options?.timeout),
          options.headers,
          objectUrl,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.deletion,
      options?.analyse,
    );
  }
}
