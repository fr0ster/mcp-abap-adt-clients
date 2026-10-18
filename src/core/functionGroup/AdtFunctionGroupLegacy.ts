/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
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
}
