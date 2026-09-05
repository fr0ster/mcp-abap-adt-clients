/**
 * The implementations include of a class — where its local types live.
 *
 * ADT addresses the include, not one type inside it, and it is written under
 * the **class's** lock: everything here is one class, seen through one of its
 * source resources. What that means for the atoms this handler declares is that
 * `delete` is a write of an empty include, and `activate` activates the class.
 * Both say so in their own comment rather than pretending the include is an
 * object of its own.
 */

import type {
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtDeletable,
  IAdtError,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtValidatable,
  ILocalTypesConfig,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering, type IAdtOptions } from '../../utils/adtResponse';
import { chain } from '../shared/chain';
import type { LockRegistry } from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { AdtClassMemberBase } from './AdtClassMemberBase';
import { checkClassLocalTypes } from './check';
import { updateClassLocalTypes } from './includes';
import { getClassImplementationsInclude } from './read';
import { classDocuments, type IClassResults } from './types';

// Types defined in @mcp-abap-adt/interfaces
export type { ILocalTypesConfig } from '@mcp-abap-adt/interfaces';

export class AdtLocalTypes<
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
  >
  extends AdtClassMemberBase<R>
  implements
    IAdtReadable<
      ILocalTypesConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<ILocalTypesConfig, ReturnType<R['updated']>>,
    IAdtDeletable<ILocalTypesConfig, ReturnType<R['updated']>>,
    IAdtValidatable<ILocalTypesConfig, ReturnType<R['validation']>>,
    IAdtCheckable<ILocalTypesConfig, ReturnType<R['check']>>,
    IAdtActivatable<ILocalTypesConfig, ReturnType<R['activation']>>
{
  public readonly objectType: string = 'LocalTypes';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // See AdtClass: the one cast is on the default, never on a member.
    protected readonly results: R = classDocuments as unknown as R,
  ) {
    super(connection, logger, systemContext, contentTypes, lockRegistry);
  }

  /** Syntax-check the source a caller is about to write. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // Nothing was asked of the server yet, so there is no answer to describe:
    // a missing required argument is the caller's mistake and it throws.
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required for validation');
    }

    return answering(
      () =>
        checkClassLocalTypes(
          this.connection,
          config.className as string,
          config.localTypesCode as string,
          'inactive',
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Read the include's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // No 404 special case any more: ADT answers a read for an include that was
    // never written with 200 and an empty body, so absence was never a status
    // to branch on, and whether an empty body *is* absence is the caller's
    // reading — supplied through `analyse`.
    return answering(
      () =>
        getClassImplementationsInclude(
          this.connection,
          config.className as string,
          version,
          this.logger,
          options,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /**
   * Write the include.
   *
   * With `options.lockHandle` the caller holds the class's lock and owns the
   * chain, so this is one request. Without it, this locks the class, checks,
   * writes and unlocks — and the unlock happens on every path out.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    // An empty string is source: writing it is how the include is emptied
    // (see delete()). Only its absence is an error.
    if (
      config.localTypesCode === undefined &&
      options?.sourceCode === undefined
    ) {
      throw new Error('Local types code is required');
    }

    const name = config.className;
    const source = options?.sourceCode ?? config.localTypesCode ?? '';

    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateClassLocalTypes(
            this.connection,
            name,
            source,
            options.lockHandle as string,
            config.transportRequest,
            this.contentTypes?.sourceArtifactContentType(),
          ),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      this.logger?.info?.('Step 1: Locking parent class');
      // Registered before the lock is taken, so the session is restored even if
      // the lock itself is refused; and last to unwind, because on older BASIS
      // a handle is only valid inside a stateful request (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });
      const lockHandle = await this.lockCap.lockHandle({ className: name });
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await this.lockCap.release({ className: name }, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // Empty source is a deletion — there is nothing to syntax-check, and ADT
      // refuses an empty body on the check resource.
      if (source !== '') {
        this.logger?.info?.('Step 2: Checking local types code');
        await step(
          answering(
            () =>
              checkClassLocalTypes(
                this.connection,
                name,
                source,
                'inactive',
                this.contentTypes?.sourceArtifactContentType(),
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      this.logger?.info?.('Step 3: Updating local types');
      const updated = await step(
        answering(
          () =>
            updateClassLocalTypes(
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
      this.logger?.info?.('Local types updated');

      this.logger?.info?.('Step 4: Unlocking parent class');
      await this.lockCap.release({ className: name }, lockHandle);
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 5: Activating parent class');
        await step(this.activate({ className: name }, options));
      }

      return updated;
    });
  }

  /**
   * Empty the include.
   *
   * There is no DELETE for a class include: ADT removes local types by writing
   * the include empty, so this answers what that write answered.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return await this.update({ ...config, localTypesCode: '' }, options);
  }

  /** Syntax-check the include. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    status: string = 'inactive',
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.localTypesCode) {
      throw new Error('Local types code is required');
    }

    return answering(
      () =>
        checkClassLocalTypes(
          this.connection,
          config.className as string,
          config.localTypesCode as string,
          status === 'active' ? 'active' : 'inactive',
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Version history of this include. */
  async getVersions(
    config: Partial<ILocalTypesConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    if (!config.className) throw new Error('className is required');
    const name = config.className;
    return answering(
      async () => ({
        data: await this.getIncludeVersions(name, 'implementations'),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as ObjectVersion[],
    );
  }
}
