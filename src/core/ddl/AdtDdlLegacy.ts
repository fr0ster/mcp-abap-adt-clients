/**
 * AdtDdlLegacy - DDL source handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API,
 * and refuses checkCdsTestDoubles(): the CDS test-doubles framework endpoint is
 * not present below 7.50 (issue #207).
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { DDL_SOURCE } from '../../endpoints/objects';
import { answering, failed } from '../../utils/adtResponse';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtDdl } from './AdtDdl';
import type { ddlDocuments, IDdlConfig, IDdlResults } from './types';

export class AdtDdlLegacy<
  R extends IDdlResults = typeof ddlDocuments,
> extends AdtDdl<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDdlConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.ddlName as string;

    const objectUrl = `${DDL_SOURCE.uri(name)}`;
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

  /** Refused without a request: the endpoint does not exist below 7.50. */
  override async checkCdsTestDoubles<E extends IAdtError = IAdtError>(
    _cdsViewName: string,
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['testDoubles']>, E>> {
    return failed<ReturnType<R['testDoubles']>, E>({
      origin: 'refusal',
      code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
      message:
        'The CDS test-doubles check needs BASIS 7.50 or later; this system has no such endpoint.',
    } as E);
  }
}
