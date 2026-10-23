/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides delete() to send `DELETE <URI>?lockHandle=…` under the lock handle the
 * caller holds (7.40 SP04 has no /sap/bc/adt/deletion/ API).
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 */

import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { FUNCTION_GROUP } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck } from '../shared/refusalLegacy';
import { AdtFunctionGroup } from './AdtFunctionGroup';
import type {
  functionGroupDocuments,
  IFunctionGroupConfig,
  IFunctionGroupResults,
} from './types';

export class AdtFunctionGroupLegacy<
  R extends IFunctionGroupResults = typeof functionGroupDocuments,
> extends AdtFunctionGroup<R> {
  /**
   * Delete function group — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * with `&corrNr=<transportRequest>` when one is given. Pass the handle from
   * your own `lock()` and release it with `unlock()` afterwards; this member
   * does not lock. Measured on 7.40 SP04: lock, delete with the handle,
   * unlock deleted a function group. Without a handle SAP answered `400` "Parameter lockHandle could not be found." for a function group; the request still goes and that answer reaches you. The `corrNr` is sent as before; a delete
   * with it in a transportable package was not measured. `/sap/bc/adt/deletion/*`
   * does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.functionGroupName as string;

    const objectUrl = FUNCTION_GROUP.uri(name);
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
    _config: Partial<IFunctionGroupConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }
}
