/**
 * AdtTransformation - CRUD for `XSLT/VT` transformations.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  AdtReadVersion,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtHeaders,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAdtVersionable,
  ITransformationResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { TRANSFORMATION } from '../../endpoints/objects';
import { answeringActivation } from '../../utils/activationUtils';
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
import { writeObjectDocument } from '../shared/documentWrite';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateTransformation } from './activation';
import { checkTransformation } from './check';
import { create as createTransformation } from './create';
import { checkDeletion, deleteTransformation } from './delete';
import { lockTransformation } from './lock';
import {
  getTransformation,
  getTransformationSource,
  getTransformationTransport,
} from './read';
import type { ITransformationConfig, transformationDocuments } from './types';
import { unlockTransformation } from './unlock';
import { updateTransformation } from './update';
import { validateTransformationName } from './validation';
import {
  getTransformationVersionSource,
  getTransformationVersions,
} from './versions';

/** What each slot of the result set answers. */
export type TransformationValues = {
  readonly [K in keyof ITransformationResults]: unknown;
};

export class AdtTransformation<
  T extends TransformationValues = ResultValuesOf<
    typeof transformationDocuments
  >,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<ITransformationConfig, T['created']>,
    IAdtReadable<ITransformationConfig, T['source']>,
    IAdtMetadataReadable<ITransformationConfig, T['metadata']>,
    IAdtUpdatable<Partial<ITransformationConfig>, T['updated']>,
    IAdtMetadataUpdatable<Partial<ITransformationConfig>, T['metadataUpdated']>,
    IAdtDeletable<ITransformationConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<ITransformationConfig, T['validation']>,
    IAdtCheckable<ITransformationConfig, T['check']>,
    IAdtActivatable<ITransformationConfig, T['activation']>,
    IAdtLockable<ITransformationConfig>,
    IAdtTransportAware<ITransformationConfig, T['transport']>,
    IAdtVersionable<ITransformationConfig, T['versions'], T['versionSource']>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Transformation';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockTransformation(this.connection, name, lockHandle),
    );
  }

  /**
   * The name as the caller gave it.
   *
   * No guard: the config's type says the field is there, and a `Partial<>` at
   * the call site is what widens it. A caller who passes nothing builds a URL
   * from nothing and the server answers — which is a reading a strategy can
   * take, where a sentence composed here would not be.
   */
  private name(config: Partial<ITransformationConfig>): string {
    return config.transformationName as string;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        validateTransformationName(
          connection,
          name,
          config.packageName,
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<ITransformationConfig, 'source'> & {
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

    const name = this.name(config);
    return answering(
      () =>
        createTransformation(connection, options.headers, {
          transformation_name: name,
          transformation_type: config.transformationType,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
          masterLanguage: createLanguage(
            config.masterLanguage,
            this.systemContext.masterLanguage,
          ),
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => getTransformationSource(connection, name, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getTransformation(connection, name, options?.version, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getTransformationTransport(
          connection,
          name,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Write the object.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;

    return answering(
      () =>
        updateTransformation(
          connection,
          options.headers,
          options.ifMatch,
          {
            transformation_name: name,
            source_code: source as string,
            transport_request: config.transportRequest,
          },
          options?.lockHandle,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the transformation's metadata document — one PUT of `options.source`,
   * as the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'transformation', 'updateMetadata'>,
    config: Partial<ITransformationConfig>,
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
          TRANSFORMATION.uri(this.name(config)),
          options?.source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
      options?.analyse,
    );
  }

  /**
   * Asks ADT whether the object can be deleted.
   *
   * Its own member because it is its own endpoint. `delete` no longer runs
   * it: a consumer that wants the check runs this first and decides what a
   * refusal means.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          transformation_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete the object.
   *
   * The deletion check is read, not merely performed: ADT answers a refusal
   * with `del:isDeletable="false"` inside a 200, and a delete that ignored it
   * reported success while the object stayed. {@link deletionRefusal} is the
   * shipped reading of that answer; a caller who wants another passes their own
   * `analyse`.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteTransformation(connection, options.headers, {
          transformation_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answeringActivation(
      connection,
      (sent) =>
        activateTransformation(
          sent,
          options.headers,
          name,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkTransformation(
          connection,
          options.headers,
          name,
          version,
          config.source,
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /**
   * Lock the object — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockTransformation(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the object. */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const name = this.name(config);
    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockTransformation(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the object's source. */
  async getVersions<E extends IAdtError = IAdtError>(
    config: Partial<ITransformationConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E>> {
    return answering(
      () => getTransformationVersions(this.connection, config),
      this.results.versions,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versionSource'], E>> {
    return answering(
      () => getTransformationVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
