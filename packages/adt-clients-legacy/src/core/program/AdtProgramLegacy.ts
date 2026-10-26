/**
 * AdtProgramLegacy - Program handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 */

import {
  AdtProgram,
  answering,
  type IProgramResults,
  PROGRAM,
  type programDocuments,
  withCallTimeout,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IProgramConfig,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck, noTransportResource } from '../shared/refusalLegacy';

export class AdtProgramLegacy<
  R extends IProgramResults = typeof programDocuments,
> extends AdtProgram<R> {
  /**
   * Delete program — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a program. Without a handle SAP answered `400`
   * "Parameter lockHandle could not be found." for a program; the request still goes
   * and that answer reaches you.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.programName as string;

    const objectUrl = `${PROGRAM.uri(name)}`;
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

  /**
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5). `delete` with
   * the object's lock handle is the delete.
   */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IProgramConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }

  /**
   * Refused without a request: measured on 7.40 SP04, `GET <object URI>/transport`
   * answers `404` for every type (record B4-cycles-20261026-2019).
   */
  override async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    return noTransportResource<ReturnType<R['transport']>, E>(
      PROGRAM.uri(config.programName as string),
    );
  }
}
