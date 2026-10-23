/**
 * AdtClassLegacy - Class handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides:
 * - delete() — uses direct DELETE instead of /sap/bc/adt/deletion/ API;
 *   `update` is the inherited stateless PUT.
 */

import type {
  IAdtError,
  IAdtHeaders,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { CLASS } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtClass } from './AdtClass';
import type { classDocuments, IClassConfig, IClassResults } from './types';

export class AdtClassLegacy<
  R extends IClassResults = typeof classDocuments,
> extends AdtClass<R> {
  /**
   * Delete class — legacy override.
   *
   * A direct DELETE on the object under its own lock: the `/sap/bc/adt/deletion/`
   * resource the modern path uses does not exist on these systems.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = config.className as string;

    const objectUrl = `${CLASS.uri(name)}`;
    return answering(
      () =>
        deleteObjectDirect(
          withCallTimeout(this.connection, options?.timeout),
          options.headers,
          objectUrl,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }
}
