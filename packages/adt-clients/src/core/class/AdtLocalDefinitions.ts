import type {
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  IAdtLockedWrite,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * The definitions include of a class — where its local class and interface
 * declarations live.
 *
 * ADT addresses the include, not one declaration inside it, and it is written
 * under the **class's** lock: everything here is one class, seen through one of
 * its source resources. What that means for the atoms this handler declares is
 * that `delete` is a write of an empty include, and `activate` activates the
 * class. Both say so in their own comment rather than pretending the include is
 * an object of its own.
 */

import type {
  AdtObjectIdentity,
  AdtVariant,
  IAdtActivatable,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtError,
  IAdtHeaders,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  ILocalDefinitionsConfig,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtModernVariant } from '../../clients/variant';
import { CHECK_RUN_HEADERS } from '../../constants/contentTypes';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import type {
  ResultStrategiesOf,
  ResultValuesOf,
} from '../../utils/resultStrategy';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import type { IReadOptions } from '../shared/types';
import { AdtClassMemberBase, type ClassValues } from './AdtClassMemberBase';
import { checkClassDefinitions } from './check';
import { updateClassDefinitions } from './includes';
import { getClassDefinitionsInclude } from './read';
import type { classDocuments } from './types';

// Types defined in @mcp-abap-adt/interfaces
export type { ILocalDefinitionsConfig } from '@mcp-abap-adt/interfaces-adt';

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
export class AdtLocalDefinitions<
    T extends ClassValues = ResultValuesOf<typeof classDocuments>,
    V extends AdtVariant = AdtModernVariant,
  >
  extends AdtClassMemberBase<T, V, 'localDefinitions'>
  implements
    IAdtReadable<ILocalDefinitionsConfig, T['source'], 'className'>,
    IAdtMetadataReadable<ILocalDefinitionsConfig, T['metadata'], 'className'>,
    IAdtUpdatable<Partial<ILocalDefinitionsConfig>, T['updated'], 'className'>,
    IAdtValidatable<ILocalDefinitionsConfig, T['validation'], 'className'>,
    IAdtCheckable<ILocalDefinitionsConfig, T['check'], 'className'>,
    IAdtActivatable<ILocalDefinitionsConfig, T['activation'], 'className'>
{
  public readonly objectType: string = 'LocalDefinitions';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'contentTypes' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, contentTypes, lockRegistry } = options;
    super(connection, logger, systemContext, contentTypes, lockRegistry);
    this.results = options.results;
  }

  /** Syntax-check the source a caller is about to write. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className' | 'source'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className' | 'source'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className' | 'source'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Nothing was asked of the server yet, so there is no answer to describe:
    // a missing required argument is the caller's mistake and it throws.

    return answering(
      () =>
        checkClassDefinitions(
          connection,
          CHECK_RUN_HEADERS,
          config.className,
          config.source,
          'inactive',
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Read the include's source. */
  read<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case any more: ADT answers a read for an include that was
    // never written with 200 and an empty body, so absence was never a status
    // to branch on, and whether an empty body *is* absence is the caller's
    // reading — supplied through `analyse`.
    return answering(
      () =>
        getClassDefinitionsInclude(
          connection,
          config.className,
          version,
          this.logger,
          options,
        ),
      this.results.source,
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
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  update<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    // The source may come with the options or the config (see delete()).
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> & IAdtLockedWrite,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // An empty string is source: writing it is how the include is emptied
    // (see delete()). Only its absence is an error.
    const source = options?.source ?? config.source ?? '';
    return this.#write(config, source, options.lockHandle, options);
  }

  /** The one write of the include: under the handle given, or none. */
  #write<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    source: string,
    lockHandle: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        ifMatch?: string | undefined;
      },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        updateClassDefinitions(
          connection,
          options.headers,
          options.ifMatch,
          config.className,
          source,
          lockHandle,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Empty the include.
   *
   * There is no DELETE for a class include: ADT removes local definitions source by writing
   * the include empty, so this answers what that write answered.
   */
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // The include written empty, with whatever handle and source the options
    // carry, as before (the contract's delete names neither).
    return await this.#write(
      config,
      options.source ?? '',
      options.lockHandle,
      options,
    );
  }

  /** Syntax-check the include. */
  check<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className' | 'source'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className' | 'source'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className' | 'source'>,
    status: string = 'inactive',
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        checkClassDefinitions(
          connection,
          options.headers,
          config.className,
          config.source,
          status === 'active' ? 'active' : 'inactive',
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /** Version history of this include. */
  getVersions<E extends IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<ILocalDefinitionsConfig, 'className'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    return this.includeVersions(config.className, 'definitions', options);
  }
}
