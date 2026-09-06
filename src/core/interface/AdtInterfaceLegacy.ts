/**
 * AdtInterfaceLegacy - Interface handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import type {
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtInterface } from './AdtInterface';
import type { IInterfaceConfig, IInterfaceResults } from './types';

export class AdtInterfaceLegacy<
  R extends IInterfaceResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IInterfaceResults,
> extends AdtInterface<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;

    const objectUrl = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(name).toLowerCase()}`;
    return answering(
      () =>
        deleteObjectDirect(
          this.connection,
          objectUrl,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }
}
