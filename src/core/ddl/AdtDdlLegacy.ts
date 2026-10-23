/**
 * AdtDdlLegacy - DDL source handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API),
 * and refuses checkCdsTestDoubles(): the CDS test-doubles framework endpoint is
 * not present below 7.50 (issue #207).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { DDL_SOURCE } from '../../endpoints/objects';
import { answering, failed } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck } from '../shared/refusalLegacy';
import { AdtDdl } from './AdtDdl';
import type { ddlDocuments, IDdlConfig, IDdlResults } from './types';

export class AdtDdlLegacy<
  R extends IDdlResults = typeof ddlDocuments,
> extends AdtDdl<R> {
  /**
   * Delete DDL source — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * with `&corrNr=<transportRequest>` when one is given. Pass the handle from
   * your own `lock()` and release it with `unlock()` afterwards; this member
   * does not lock. Measured on 7.40 SP04: lock, delete with the handle,
   * unlock deleted a DDL source. Without a handle 7.40 SP04 deleted a DDL source too, but pass the handle all the same. The `corrNr` is sent as before; a delete
   * with it in a transportable package was not measured. `/sap/bc/adt/deletion/*`
   * does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDdlConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.ddlName as string;

    const objectUrl = `${DDL_SOURCE.uri(name)}`;
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

  /** Refused without a request: the endpoint does not exist below 7.50. */
  override async checkCdsTestDoubles<E extends IAdtError = IAdtError>(
    _cdsViewName: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['testDoubles']>, E>> {
    return failed<ReturnType<R['testDoubles']>, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'The CDS test-doubles check needs BASIS 7.50 or later; this system has no such endpoint.',
    } as E);
  }

  /**
   * Refused without a request: 7.40 has no deletion API —
   * `POST /sap/bc/adt/deletion/check` answers `404` (spec §5). `delete` with
   * the object's lock handle is the delete.
   */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IDdlConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }
}
