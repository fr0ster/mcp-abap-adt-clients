/**
 * AdtClassLegacy - Class handler for legacy SAP systems (BASIS < 7.50)
 *
 * On legacy systems, the x-sap-adt-sessiontype: stateful header causes locks
 * to be stored in ABAP session memory instead of the global enqueue server.
 * This means lock + update + unlock MUST happen within the same stateful
 * HTTP session — switching to stateless between lock and update invalidates
 * the lock handle (GitHub #11).
 *
 * Overrides:
 * - update() — keeps lock→check→update→unlock in one stateful session
 * - delete() — uses direct DELETE instead of /sap/bc/adt/deletion/ API
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
import { AdtClass } from './AdtClass';
import type { IClassConfig, IClassResults } from './types';

export class AdtClassLegacy<
  R extends IClassResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IClassResults,
> extends AdtClass<R> {
  /**
   * Update class — legacy override.
   *
   * Keeps lock→check→update→unlock in a single stateful session so the
   * lock handle remains valid (legacy stores locks in ABAP session memory).
   */
  override async update<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Low-level mode: caller owns the session

    return super.update(config, options);
  }

  /**
   * Delete class — legacy override.
   *
   * A direct DELETE on the object under its own lock: the `/sap/bc/adt/deletion/`
   * resource the modern path uses does not exist on these systems.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const name = config.className;

    const objectUrl = `/sap/bc/adt/oo/classes/${encodeSapObjectName(name).toLowerCase()}`;
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
