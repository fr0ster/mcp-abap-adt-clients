/**
 * AdtIncludeLegacy - standalone include handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides:
 * - checkDeletion() — refused without a request: 7.40 has no deletion API.
 * - delete() — `DELETE <URI>?lockHandle=…` under the lock handle the caller
 *   holds (measured on 7.40 SP04: `200`, a read afterwards answers `404`;
 *   record B4-cycles-20261026-2019).
 */

import {
  AdtInclude,
  answering,
  type IIncludeResults,
  type includeDocuments,
  PROGRAM_INCLUDE,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IIncludeConfig,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck } from '../shared/refusalLegacy';

export class AdtIncludeLegacy<
  R extends IIncludeResults = typeof includeDocuments,
> extends AdtInclude<R> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IIncludeConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
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
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
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
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }
}
