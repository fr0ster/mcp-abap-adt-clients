/**
 * AdtFunctionIncludeLegacy - function include handler for legacy SAP systems
 * (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * Overrides:
 * - checkDeletion() and delete() — refused without a request: both go through
 *   `/sap/bc/adt/deletion/*`, which 7.40 does not serve (spec §4.3, §5). A
 *   direct `DELETE` of the function include is not measured, so it is not
 *   offered.
 */

import {
  AdtFunctionInclude,
  type AdtPerformedBy,
  type functionIncludeDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IFunctionIncludeConfig,
  IFunctionIncludeResults,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noDeletionApi,
  noDeletionCheckNorDelete,
} from '../shared/refusalLegacy';

export class AdtFunctionIncludeLegacy<
  R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
> extends AdtFunctionInclude<R, 'basis740'> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionInclude', 'deletionCheck'>,
    _config: AdtObjectIdentity<IFunctionIncludeConfig, 'functionGroupName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return noDeletionCheckNorDelete<ReturnType<R['deletionCheck']>, E>();
  }

  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/delete` (§4.3). */
  override async delete<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionInclude', 'delete'>,
    _config: AdtObjectIdentity<IFunctionIncludeConfig, 'functionGroupName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    return noDeletionApi<ReturnType<R['deletion']>, E>();
  }
}
