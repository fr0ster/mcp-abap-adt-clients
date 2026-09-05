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
import { activationRefusal } from '../../utils/activationUtils';
import {
  answering,
  type IAdtOptions,
  type IAnalyse,
} from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { chain } from '../shared/chain';
import { deleteObjectDirect } from '../shared/deleteLegacy';
import { AdtClass } from './AdtClass';
import { activateClass } from './activation';
import { checkClass } from './check';
import { lockClass } from './lock';
import type { IClassConfig, IClassResults } from './types';
import { unlockClass } from './unlock';
import { updateClass } from './update';

export class AdtClassLegacy<
  R extends IClassResults<
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
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // Low-level mode: caller owns the session
    if (options?.lockHandle) {
      return super.update(config, options);
    }

    const name = config.className;
    const source = options?.sourceCode || config.sourceCode;

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done, so the connection is told this is critical.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      // The whole chain is one stateful session — that is this class's entire
      // reason to exist — so stateless is restored once, at the very end.
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      this.logger?.info?.('Legacy update step 1: Locking class');
      const lockHandle = await lockClass(this.connection, name);
      const releaseLock = onScopeEnd(async () => {
        await unlockClass(this.connection, name, lockHandle);
      });
      this.logger?.info?.('Class locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.('Legacy update step 2: Checking inactive version');
        await step(
          answering(
            () =>
              checkClass(
                this.connection,
                name,
                'inactive',
                source,
                this.contentTypes?.sourceArtifactContentType(),
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Check passed');
      }

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Legacy update step 3: Updating class');
        updated = await step(
          answering(
            () =>
              updateClass(
                this.connection,
                name,
                source,
                lockHandle,
                config.transportRequest,
                this.contentTypes?.sourceArtifactContentType(),
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Class updated');
      }

      this.logger?.info?.('Legacy update step 4: Unlocking class');
      await unlockClass(this.connection, name, lockHandle);
      // Discharged, so the scope does not release a handle already given back.
      releaseLock();
      this.logger?.info?.('Class unlocked');

      // Everything below is stateless-safe on legacy too, but the session is
      // left stateful until the scope unwinds rather than toggled mid-chain.
      this.logger?.info?.('Legacy update step 5: Final check');
      await step(
        answering(
          () => checkClass(this.connection, name, 'inactive'),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Final check passed');

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Legacy update step 6: Activating class');
        await step(
          answering(
            () => activateClass(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            (options?.analyse ?? activationRefusal) as IAnalyse<E>,
          ),
        );

        // The active version may not be served the instant activation answers.
        // A failure here is not the update's failure, so it is logged and the
        // chain continues.
        const ready = await this.read({ className: name }, 'active', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            ready.getError().message,
          );
        }
      }

      return updated;
    });
  }

  /**
   * Delete class — legacy override.
   *
   * A direct DELETE on the object under its own lock: the `/sap/bc/adt/deletion/`
   * resource the modern path uses does not exist on these systems.
   */
  override async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const name = config.className;

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Locking class for deletion');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockClass(this.connection, name);
      // On the way out the lock is released only if the delete did not happen:
      // a deleted object has nothing left to unlock.
      let deleted = false;
      onScopeEnd(async () => {
        if (deleted) return;
        await unlockClass(this.connection, name, lockHandle);
      });
      this.logger?.info?.(`Lock obtained: ${lockHandle}`);

      this.logger?.info?.('Deleting class (direct DELETE)');
      const objectUrl = `/sap/bc/adt/oo/classes/${encodeSapObjectName(name).toLowerCase()}`;
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
      this.logger?.info?.('Class deleted');
      return value;
    });
  }
}
