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
import { answering, type IAdtOptions } from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { chain } from '../shared/chain';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtDdl } from './AdtDdl';
import { lockDDLS } from './lock';
import type { IDdlConfig, IDdlResults } from './types';
import { unlockDDLS } from './unlock';

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
    unknown
  > = IDdlResults,
> extends AdtDdl<R> {
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDdlConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.ddlName) {
      throw new Error('DDL name is required');
    }
    const name = config.ddlName;

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Locking DDL source for deletion');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockDDLS(this.connection, name);
      // Released on the way out only if the delete did not happen: a deleted
      // object has nothing left to unlock.
      let deleted = false;
      onScopeEnd(async () => {
        if (deleted) return;
        await unlockDDLS(this.connection, name, lockHandle);
      });

      this.logger?.info?.('Deleting DDL source (direct DELETE)');
      const objectUrl = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(name).toLowerCase()}`;
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
      this.logger?.info?.('DDL source deleted');
      return value;
    });
  }
}
