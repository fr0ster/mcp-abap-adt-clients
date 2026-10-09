/**
 * AdtFunctionModuleLegacy - FunctionModule handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import type {
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { FUNCTION_MODULE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionModule } from './AdtFunctionModule';
import type {
  functionModuleDocuments,
  IFunctionModuleConfig,
  IFunctionModuleResults,
} from './types';

export class AdtFunctionModuleLegacy<
  R extends IFunctionModuleResults = typeof functionModuleDocuments,
> extends AdtFunctionModule<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const group = config.functionGroupName as string;
    const module = config.functionModuleName;

    const objectUrl = `${FUNCTION_MODULE.uri(group, module as string)}`;
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
