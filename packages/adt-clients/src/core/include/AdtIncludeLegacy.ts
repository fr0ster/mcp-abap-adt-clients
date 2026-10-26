/**
 * AdtIncludeLegacy - standalone include handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides:
 * - checkDeletion() and delete() — refused without a request: both go through
 *   `/sap/bc/adt/deletion/*`, which 7.40 does not serve (spec §4.3, §5). A
 *   direct `DELETE` of the include is not measured, so it is not offered.
 */

import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IIncludeConfig,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noDeletionApi,
  noDeletionCheckNorDelete,
} from '../shared/refusalLegacy';
import { AdtInclude } from './AdtInclude';
import type { IIncludeResults, includeDocuments } from './types';

export class AdtIncludeLegacy<
  R extends IIncludeResults = typeof includeDocuments,
> extends AdtInclude<R> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    _config: Partial<IIncludeConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheckNorDelete<ReturnType<R['deletionCheck']>, E>();
  }

  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/delete` (§4.3). */
  override async delete<E extends IAdtError = IAdtError>(
    _config: Partial<IIncludeConfig>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    return noDeletionApi<ReturnType<R['deletion']>, E>();
  }
}
