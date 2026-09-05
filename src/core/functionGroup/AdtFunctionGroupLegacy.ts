/**
 * AdtFunctionGroupLegacy - FunctionGroup handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import type {
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering, type IAdtOptions } from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { chain } from '../shared/chain';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionGroup } from './AdtFunctionGroup';
import { lockFunctionGroup } from './lock';
import type { IFunctionGroupConfig, IFunctionGroupResults } from './types';
import { unlockFunctionGroup } from './unlock';

export class AdtFunctionGroupLegacy<
  R extends IFunctionGroupResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IFunctionGroupResults,
> extends AdtFunctionGroup<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Locking function group for deletion');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockFunctionGroup(this.connection, name);
      // Released on the way out only if the delete did not happen: a deleted
      // object has nothing left to unlock.
      let deleted = false;
      onScopeEnd(async () => {
        if (deleted) return;
        await unlockFunctionGroup(this.connection, name, lockHandle);
      });

      this.logger?.info?.('Deleting function group (direct DELETE)');
      const objectUrl = `/sap/bc/adt/functions/groups/${name.toLowerCase()}`;
      const value = await step(
        answering(
          () =>
            deleteObjectDirect(
              this.connection,
              objectUrl,
              lockHandle,
              config.transportRequest,
            ),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      deleted = true;
      this.logger?.info?.('Function group deleted');
      return value;
    });
  }
}
