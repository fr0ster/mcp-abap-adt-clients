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
  type FunctionIncludeValues,
  type functionIncludeDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IFunctionIncludeConfig,
} from '@mcp-abap-adt/interfaces-adt';
import {
  noDeletionApi,
  noDeletionCheckNorDelete,
} from '../shared/refusalLegacy';

export class AdtFunctionIncludeLegacy<
  T extends FunctionIncludeValues = ResultValuesOf<
    typeof functionIncludeDocuments
  >,
> extends AdtFunctionInclude<T, 'basis740'> {
  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/check` (§5). */
  override async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionInclude', 'deletionCheck'>,
    _config: AdtObjectIdentity<IFunctionIncludeConfig, 'functionGroupName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    return noDeletionCheckNorDelete<T['deletionCheck'], E>();
  }

  /** Refused without a request: 7.40 has no `/sap/bc/adt/deletion/delete` (§4.3). */
  override async delete<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionInclude', 'delete'>,
    _config: AdtObjectIdentity<IFunctionIncludeConfig, 'functionGroupName'>,
    _options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    return noDeletionApi<T['deletion'], E>();
  }
}
