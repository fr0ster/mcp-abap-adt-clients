/**
 * Standalone `PROG/I` includes — see this module's `index.ts` for how they
 * differ from a function-group include.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer. The error bag this class
 * used to return is gone: a failure now abandons the chain and comes back as
 * the answer, with the request that produced it.
 */

import type {
  AdtReadVersion,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtHeaders,
  IAdtIncludeEnhancementHost,
  IAdtLockable,
  IAdtMainProgramsReadable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IIncludeConfig,
  IIncludeResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { TYPE_CODE } from '../../constants/typeCodes';
import { PROGRAM_INCLUDE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { createLanguage } from '../../utils/xml';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { checkDeletionByUri } from '../shared/deletionCheckByUri';
import { writeObjectDocument } from '../shared/documentWrite';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { activateInclude } from './activation';
import { create } from './create';
import { deleteInclude } from './delete';
import {
  getIncludeEnhancementElements,
  getIncludeEnhancementOptions,
} from './enhancements';
import { includeUrl, lockInclude } from './lock';
import { getIncludeMainPrograms } from './mainPrograms';
import { getIncludeMetadata, getIncludeSource } from './read';
import type { includeDocuments } from './types';
import { unlockInclude } from './unlock';
import { uploadIncludeSource } from './update';

function requireName(config: Partial<IIncludeConfig>): string {
  return config.includeName as string;
}

/** What each slot of an include's result set answers. */
export type IncludeValues = { readonly [K in keyof IIncludeResults]: unknown };

export class AdtInclude<
  T extends IncludeValues = ResultValuesOf<typeof includeDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtIncludeEnhancementHost<
      IIncludeConfig,
      T['enhancementElements'],
      T['enhancementOptions']
    >,
    IAdtMainProgramsReadable<IIncludeConfig, T['mainPrograms']>,
    IAdtCreatable<IIncludeConfig, T['created']>,
    IAdtReadable<IIncludeConfig, T['source']>,
    IAdtMetadataReadable<IIncludeConfig, T['metadata']>,
    IAdtUpdatable<Partial<IIncludeConfig>, T['updated']>,
    IAdtMetadataUpdatable<Partial<IIncludeConfig>, T['metadataUpdated']>,
    IAdtDeletable<IIncludeConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<IIncludeConfig, T['validation']>,
    IAdtActivatable<IIncludeConfig, T['activation']>,
    IAdtLockable<IIncludeConfig>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  // Part of the options every handler in this library takes. It is unread
  // here now that the members are single requests with nothing to narrate.
  private readonly logger: ILogger | undefined;
  // Read by `create` until 36.0.0; its headers are the caller's now.
  private readonly contentTypes: IAdtContentTypes | undefined;
  protected readonly results: ResultStrategiesOf<T>;
  private readonly systemContext: IAdtSystemContext;

  constructor(
    protected readonly connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'contentTypes' | 'systemContext'
    >,
  ) {
    this.logger = options.logger;
    this.contentTypes = options.contentTypes;
    this.results = options.results;
    this.systemContext = options.systemContext ?? {};
  }

  /** Read the host's enhancement elements. */
  async readEnhancementElements<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E> & { context?: string },
  ): Promise<IAdtResponse<T['enhancementElements'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        getIncludeEnhancementElements(
          connection,
          config.includeName as string,
          options?.context,
        ),
      this.results.enhancementElements,
      options?.analyse,
    );
  }

  /** Read the host's enhancement options. */
  async readEnhancementOptions<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E> & { context?: string },
  ): Promise<IAdtResponse<T['enhancementOptions'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        getIncludeEnhancementOptions(
          connection,
          config.includeName as string,
          options?.context,
        ),
      this.results.enhancementOptions,
      options?.analyse,
    );
  }

  /**
   * The include's main programs — a program (`PROG/P`), or a function group
   * (`FUGR/F`) for its includes — none when no program includes it directly.
   */
  async readMainPrograms<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'include', 'mainPrograms'>,
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['mainPrograms'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () => getIncludeMainPrograms(connection, requireName(config)),
      this.results.mainPrograms,
      options?.analyse,
    );
  }

  /**
   * Validate before creating.
   *
   * Measured: `/includes/validation` takes `objname`, `objtype`, `packagename`
   * — the same three `/programs/validation` takes, with `description`
   * optional. Eclipse does not call it in the captured create, so this is
   * available rather than obligatory.
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig> & { packageName: string },
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E>> {
    // The package is required: the include validation is the program's
    // handler, which refuses an empty package (SEDI_ADT 003).
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);

    const params = new URLSearchParams({
      objname: includeName.toUpperCase(),
      objtype: TYPE_CODE.include,
      packagename: config.packageName.toUpperCase(),
    });
    if (config.description) {
      params.set('description', config.description);
    }

    return answering(
      () =>
        connection.makeAdtRequest({
          url: `${PROGRAM_INCLUDE.validation}?${params.toString()}`,
          method: 'POST',
          timeout: 0,
          headers: { Accept: 'application/vnd.sap.as+xml' },
        }),
      this.results.validation,
      options?.analyse,
    );
  }

  /**
   * Create the include, and write its source if any was given.
   *
   * The answer is the create's own. Whether source was written afterwards is
   * this implementation's business — a caller asked for an include, not for a
   * transcript — and a failure in that write is still returned, because it is
   * why the include is not what was asked for.
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IIncludeConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // The type requires a package; this refuses an empty one, which the type
    // cannot rule out. SAP creates nothing without a package: most creates are
    // refused (CTS_WBO_API 018, "Object cannot be created without a package"),
    // and a message class is answered 201 Created with nothing created (read on
    // premise, 2026-11-02). Refused here, before any request, in words that say
    // why.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: SAP creates nothing without one',
      );
    }

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () =>
        create(connection, options.headers, {
          includeName,
          description: config.description,
          packageName: config.packageName,
          transportRequest: config.transportRequest,
          masterLanguage: createLanguage(
            config.masterLanguage,
            this.systemContext.masterLanguage,
          ),
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the include's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    version?: AdtReadVersion,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () => getIncludeSource(connection, includeName, version),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the include's metadata. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: {
      withLongPolling?: boolean;
      version?: AdtReadVersion;
    } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () => getIncludeMetadata(connection, includeName, options?.version),
      this.results.metadata,
      options?.analyse,
    );
  }

  /**
   * Write new source.
   *
   * `options.source` wins over the config's. `options.lockHandle` means the
   * caller already holds the lock and manages it — this then writes only, and
   * neither locks nor unlocks. Activation is `options.activateOnUpdate`.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Absence, not emptiness: clearing an include to empty is a real edit, and
    // a truthiness check made it impossible to express.
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;
    const includeName = requireName(config);

    return answering(
      () =>
        uploadIncludeSource(
          connection,
          options.headers,
          options.ifMatch,
          includeName,
          source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the include's metadata document — one PUT of `options.source`,
   * as the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'include', 'updateMetadata'>,
    config: Partial<IIncludeConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        writeObjectDocument(
          connection,
          options.headers,
          options.ifMatch,
          PROGRAM_INCLUDE.uri(requireName(config)),
          options?.source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
      options?.analyse,
    );
  }

  /**
   * Ask whether the object can be deleted now.
   *
   * The deletion service is asked by URI, and a standalone include has one of
   * its own — unlike a class include, which is emptied by writing its parent.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'include', 'deletionCheck'>,
    config: Partial<IIncludeConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);

    return answering(
      () =>
        checkDeletionByUri(
          connection,
          options.headers,
          includeUrl(includeName),
        ),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete the include.
   *
   * No lock, and `options.lockHandle` is deliberately not read: the deletion
   * service takes an object URI, not a handle. Holding a lock over a delete
   * does not help it through — it is what stops it.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);

    return answering(
      () =>
        deleteInclude(
          connection,
          options.headers,
          includeName,
          config.transportRequest,
        ),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the include. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () =>
        activateInclude(
          connection,
          options.headers,
          includeName,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /**
   * Lock the include — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const includeName = requireName(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockInclude(this.connection, includeName),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      config.onLock?.(answer.getResult().value);
    }
    return answer;
  }

  /**
   * Release the lock: one `UNLOCK`, sent stateful, and stateless again after.
   *
   * The lock lives in the stateful context the `LOCK` opened, and only a
   * request that reaches that context releases it. The connector sends the
   * context cookie with stateful requests only, so an `UNLOCK` sent stateless
   * runs in a fresh context, answers 200 and releases nothing — measured on
   * an on-premise system 2026-09-27: the activation after it answered 403 `EU/510` "currently
   * editing", and the delete was refused the same way. Both the `LOCK` and the
   * `UNLOCK` are stateful for their own request only; everything between them,
   * the source `PUT` included, goes stateless, as Eclipse sends it.
   */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const includeName = requireName(config);
    return answering(
      () =>
        inStatefulSession(this.connection, () =>
          unlockInclude(this.connection, includeName, lockHandle),
        ),
      nothing,
      options?.analyse,
    );
  }
}
