/**
 * AdtInterfaceLegacy - Interface handler for legacy SAP systems (BASIS < 7.50)
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
import { encodeSapObjectName } from '../../utils/internalUtils';
import { chain } from '../shared/chain';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtInterface } from './AdtInterface';
import { lockInterface } from './lock';
import type { IInterfaceConfig, IInterfaceResults } from './types';
import { unlockInterface } from './unlock';

export class AdtInterfaceLegacy<
  R extends IInterfaceResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IInterfaceResults,
> extends AdtInterface<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Locking interface for deletion');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const { lockHandle } = await lockInterface(this.connection, name);
      // Released on the way out only if the delete did not happen: a deleted
      // object has nothing left to unlock.
      let deleted = false;
      onScopeEnd(async () => {
        if (deleted) return;
        await unlockInterface(this.connection, name, lockHandle);
      });

      this.logger?.info?.('Deleting interface (direct DELETE)');
      const objectUrl = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(name).toLowerCase()}`;
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
      this.logger?.info?.('Interface deleted');
      return value;
    });
  }
}
