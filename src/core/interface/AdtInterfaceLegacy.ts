/**
 * AdtInterfaceLegacy - Interface handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 * checkDeletion() is refused without a request: 7.40 has no deletion API.
 */

import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { INTERFACE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { noDeletionCheck } from '../shared/refusalLegacy';
import { AdtInterface } from './AdtInterface';
import type {
  IInterfaceConfig,
  IInterfaceResults,
  interfaceDocuments,
} from './types';

export class AdtInterfaceLegacy<
  R extends IInterfaceResults = typeof interfaceDocuments,
> extends AdtInterface<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.interfaceName as string;

    const objectUrl = `${INTERFACE.uri(name)}`;
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
    _config: Partial<IInterfaceConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheck<ReturnType<R['deletionCheck']>, E>();
  }
}
