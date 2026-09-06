/**
 * AdtProgramLegacy - Program handler for legacy SAP systems (BASIS < 7.50)
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
import { AdtProgram } from './AdtProgram';
import type { IProgramConfig, IProgramResults } from './types';

export class AdtProgramLegacy<
  R extends IProgramResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IProgramResults,
> extends AdtProgram<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const name = config.programName;

    const objectUrl = `/sap/bc/adt/programs/programs/${encodeSapObjectName(name).toLowerCase()}`;
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
