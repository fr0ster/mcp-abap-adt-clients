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
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionModule } from './AdtFunctionModule';
import type { IFunctionModuleConfig, IFunctionModuleResults } from './types';

export class AdtFunctionModuleLegacy<
  R extends IFunctionModuleResults<
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
  > = IFunctionModuleResults,
> extends AdtFunctionModule<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const group = config.functionGroupName;
    const module = config.functionModuleName;

    const encodedGroup = encodeSapObjectName(group).toLowerCase();
    const encodedModule = encodeSapObjectName(module).toLowerCase();
    const objectUrl = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;
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
