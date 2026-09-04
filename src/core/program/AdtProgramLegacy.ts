/**
 * AdtProgramLegacy - Program handler for legacy SAP systems (BASIS < 7.50)
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
import { AdtProgram } from './AdtProgram';
import { lockProgram } from './lock';
import type { IProgramConfig, IProgramResults } from './types';
import { unlockProgram } from './unlock';

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
  override async delete(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const name = config.programName;

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Locking program for deletion');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockProgram(this.connection, name);
      // On the way out the lock is released only if the delete did not happen:
      // a deleted object has nothing left to unlock.
      let deleted = false;
      onScopeEnd(async () => {
        if (deleted) return;
        await unlockProgram(this.connection, name, lockHandle);
      });

      this.logger?.info?.('Deleting program (direct DELETE)');
      const objectUrl = `/sap/bc/adt/programs/programs/${encodeSapObjectName(name).toLowerCase()}`;
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
      this.logger?.info?.('Program deleted');
      return value;
    });
  }
}
