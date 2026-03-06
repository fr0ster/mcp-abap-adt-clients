/**
 * AdtFunctionModuleLegacy - FunctionModule handler for legacy SAP systems (BASIS < 7.50)
 *
 * Overrides delete() to use direct DELETE instead of /sap/bc/adt/deletion/ API.
 */

import { encodeSapObjectName } from '../../utils/internalUtils';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtFunctionModule } from './AdtFunctionModule';
import { lockFunctionModule } from './lock';
import type { IFunctionModuleConfig, IFunctionModuleState } from './types';
import { unlockFunctionModule } from './unlock';

export class AdtFunctionModuleLegacy extends AdtFunctionModule {
  override async delete(
    config: Partial<IFunctionModuleConfig>,
  ): Promise<IFunctionModuleState> {
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    const state: IFunctionModuleState = { errors: [] };
    let lockHandle: string | undefined;

    try {
      this.logger?.info?.('Locking function module for deletion');
      this.connection.setSessionType('stateful');
      lockHandle = await lockFunctionModule(
        this.connection,
        config.functionModuleName,
        config.functionGroupName,
      );

      this.logger?.info?.('Deleting function module (direct DELETE)');
      const encodedGroup = encodeSapObjectName(config.functionGroupName).toLowerCase();
      const encodedModule = encodeSapObjectName(config.functionModuleName).toLowerCase();
      const objectUrl = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;
      state.deleteResult = await deleteObjectDirect(
        this.connection,
        objectUrl,
        lockHandle,
        config.transportRequest,
      );
      this.logger?.info?.('Function module deleted');

      return state;
    } catch (error: any) {
      this.logger?.error?.('Delete failed:', error);
      if (lockHandle) {
        try {
          await unlockFunctionModule(
            this.connection,
            config.functionModuleName,
            config.functionGroupName,
            lockHandle,
          );
        } catch (unlockError: any) {
          this.logger?.error?.('Unlock after delete failure also failed:', unlockError);
        }
      }
      throw error;
    } finally {
      this.connection.setSessionType('stateless');
    }
  }
}
