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
} from '@mcp-abap-adt/interfaces-adt';
import { PROGRAM } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtProgram } from './AdtProgram';
import type {
  IProgramConfig,
  IProgramResults,
  programDocuments,
} from './types';

export class AdtProgramLegacy<
  R extends IProgramResults = typeof programDocuments,
> extends AdtProgram<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.programName as string;

    const objectUrl = `${PROGRAM.uri(name)}`;
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
