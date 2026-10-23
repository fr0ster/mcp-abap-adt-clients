/**
 * AdtFunctionModuleLegacy - FunctionModule handler for legacy SAP systems
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
import { FUNCTION_MODULE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck } from '../shared/refusalLegacy';
import { AdtFunctionModule } from './AdtFunctionModule';
import type {
  functionModuleDocuments,
  IFunctionModuleConfig,
  IFunctionModuleResults,
} from './types';

export class AdtFunctionModuleLegacy<
  R extends IFunctionModuleResults = typeof functionModuleDocuments,
> extends AdtFunctionModule<R> {
  /**
   * Delete function module — legacy override.
   *
   * One stateless request: `DELETE <object URI>?lockHandle=<options.lockHandle>`,
   * plus `&corrNr=<transportRequest>` when `transportRequest` is given. Pass the
   * handle from your own `lock()` and release it with `unlock()` afterwards;
   * this member does not lock. Measured on 7.40 SP04: lock, delete with the
   * handle, unlock deleted a function module. Without a handle 7.40 SP04 deleted
   * a function module too; pass the handle all the same.
   * A delete with `corrNr` in a transportable package was not measured.
   * `/sap/bc/adt/deletion/*` does not exist there.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const group = config.functionGroupName as string;
    const module = config.functionModuleName;

    const objectUrl = `${FUNCTION_MODULE.uri(group, module as string)}`;
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
    _config: Partial<IFunctionModuleConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }
}
