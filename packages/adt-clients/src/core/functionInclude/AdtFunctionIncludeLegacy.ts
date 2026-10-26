/**
 * AdtFunctionIncludeLegacy - function include handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides:
 * - checkDeletion() and delete() — refused without a request: both go through
 *   `/sap/bc/adt/deletion/*`, which 7.40 does not serve (spec §4.3, §5). A
 *   direct `DELETE` of the function include is not measured, so it is not
 *   offered.
 */

import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noDeletionApi,
  noDeletionCheckNorDelete,
} from '../shared/refusalLegacy';
import { AdtFunctionInclude } from './AdtFunctionInclude';
import type {
  functionIncludeDocuments,
  IFunctionIncludeConfig,
  IFunctionIncludeResults,
} from './types';

export class AdtFunctionIncludeLegacy<
  R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
> extends AdtFunctionInclude<R> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IFunctionIncludeConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheckNorDelete<ReturnType<R['deletionCheck']>, E>();
  }

  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/delete` (§4.3). */
  override async delete<E extends IAdtError = IAdtError>(
    _config: Partial<IFunctionIncludeConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    return noDeletionApi<ReturnType<R['deletion']>, E>();
  }
}
