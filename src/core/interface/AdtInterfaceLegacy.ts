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
} from '@mcp-abap-adt/interfaces-adt';
import { INTERFACE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { deleteObjectDirect } from '../shared/deleteLegacy';
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.interfaceName as string;

    const objectUrl = `${INTERFACE.uri(name)}`;
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
