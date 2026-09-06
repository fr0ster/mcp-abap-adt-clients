/**
 * AdtDdlLegacy - DDL source handler for legacy SAP systems (BASIS < 7.50)
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
import { AdtDdl } from './AdtDdl';
import type { IDdlConfig, IDdlResults } from './types';

export class AdtDdlLegacy<
  R extends IDdlResults<
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
  > = IDdlResults,
> extends AdtDdl<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDdlConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.ddlName) {
      throw new Error('DDL name is required');
    }
    const name = config.ddlName;

    const objectUrl = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(name).toLowerCase()}`;
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
