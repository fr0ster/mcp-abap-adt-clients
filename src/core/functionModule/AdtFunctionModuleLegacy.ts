/**
 * AdtFunctionModuleLegacy - FunctionModule handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import type {
  IAdtOperationOptions,
  IAdtResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { chain } from '../shared/chain';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionModule } from './AdtFunctionModule';
import { lockFunctionModule } from './lock';
import type { IFunctionModuleConfig, IFunctionModuleResults } from './types';
import { unlockFunctionModule } from './unlock';

export class AdtFunctionModuleLegacy<
  R extends IFunctionModuleResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IFunctionModuleResults,
> extends AdtFunctionModule<R> {
  override async delete(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const group = config.functionGroupName;
    const module = config.functionModuleName;

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Locking function module for deletion');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      // `(group, module)`, in that order. This class passed them the other way
      // round, which built the lock URL as
      // `/functions/groups/{module}/fmodules/{group}` — a resource that does
      // not exist, so the legacy delete could never get past its own lock.
      const lockHandle = await lockFunctionModule(
        this.connection,
        group,
        module,
      );
      // Released on the way out only if the delete did not happen: a deleted
      // object has nothing left to unlock.
      let deleted = false;
      onScopeEnd(async () => {
        if (deleted) return;
        await unlockFunctionModule(this.connection, group, module, lockHandle);
      });

      this.logger?.info?.('Deleting function module (direct DELETE)');
      const encodedGroup = encodeSapObjectName(group).toLowerCase();
      const encodedModule = encodeSapObjectName(module).toLowerCase();
      const objectUrl = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;
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
      this.logger?.info?.('Function module deleted');
      return value;
    });
  }
}
