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
  IAdtError,
  IAdtMetadataReadable,
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
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
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

/**
 * Not `IAdtDeletable`, and that is the honest shape rather than an omission.
 *
 * Removing this is a write of its parent: `delete()` below is
 * `update()` with empty content, which is what ADT offers — there is no
 * resource to DELETE and none to ask about. Measured beside it: the deletion
 * service resolves a *message class*, `adtcore:type="MSAG/N"`, and knows
 * nothing of the rows inside it; the same holds for a class and its includes.
 *
 * So the atom that carries `delete` and `checkDeletion` does not apply, and
 * `delete()` stays as the convenience it always was — a name for writing
 * emptiness — rather than a claim that this is a deletable object.
 */
export class AdtLocalTypes<R extends IClassResults = typeof classDocuments>
  extends AdtClassMemberBase<R>
  implements
    IAdtReadable<ILocalTypesConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<ILocalTypesConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<ILocalTypesConfig>, ReturnType<R['updated']>>,
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Nothing was asked of the server yet, so there is no answer to describe:
    // a missing required argument is the caller's mistake and it throws.

    return answering(
      () =>
        checkClassLocalTypes(
          connection,
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
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case any more: ADT answers a read for an include that was
    // never written with 200 and an empty body, so absence was never a status
    // to branch on, and whether an empty body *is* absence is the caller's
    // reading — supplied through `analyse`.
    return answering(
      () =>
        getClassImplementationsInclude(
          connection,
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
   * **This never takes a lock and never releases one.** It is one PUT, and
   * `options.lockHandle` is passed to it exactly as given — including not at
   * all, in which case ADT answers `400 Parameter lockHandle could not be
   * found` and that refusal is the result.
   *
   * The lock is the *class's*, not the include's: `getClass().lock()` is what
   * takes it, and the same handle serves every include. This comment used to
   * say the member locked, checked, wrote and unlocked; that chain came out
   * when a member became one request, and a reader chasing an unreleased lock
   * would have looked here and stopped.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // An empty string is source: writing it is how the include is emptied
    // (see delete()). Only its absence is an error.

    const name = config.className as string;
    const source = options?.sourceCode ?? config.localTypesCode ?? '';

    return answering(
      () =>
        updateClassLocalTypes(
          connection,
          name,
          source,
          // `as string` because the low-level writer types it required; the
          // value may be absent, and whether an unlocked write is allowed is
          // ADT's judgement, not this library's.
          options?.lockHandle as string,
          config.transportRequest,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      options?.analyse,
    );
  }

  /**
   * Empty the include.
   *
   * There is no DELETE for a class include: ADT removes local types by writing
   * the include empty, so this answers what that write answered.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    return await this.update({ ...config, localTypesCode: '' }, options);
  }

  /** Syntax-check the include. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<ILocalTypesConfig>,
    status: string = 'inactive',
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        checkClassLocalTypes(
          connection,
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
    const name = config.className as string;
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
