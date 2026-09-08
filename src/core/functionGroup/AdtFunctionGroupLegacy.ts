/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems
 * (BASIS < 7.50).
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
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionGroup } from './AdtFunctionGroup';
import type {
  functionGroupDocuments,
  IFunctionGroupConfig,
  IFunctionGroupResults,
} from './types';

export class AdtFunctionGroupLegacy<
  R extends IFunctionGroupResults = typeof functionGroupDocuments,
> extends AdtFunctionGroup<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;

    const objectUrl = `/sap/bc/adt/functions/groups/${name.toLowerCase()}`;
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
