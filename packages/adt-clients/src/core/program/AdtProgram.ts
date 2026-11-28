import type {
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  IAdtLockedWrite,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * AdtProgram - CRUD for `PROG/P` programs.
 *
 * Every member answers `IAdtResponse<T>`, where T is whatever the result set
 * given at construction makes of that endpoint's answer. What runs before the
 * member's own request — a lock, a check — is this implementation's business
 * and is not in the answer: only its failures are, because a step that failed
 * is why the member has no result.
 *
 * Session management:
 * - stateful only around a lock, restored on every path out of the chain
 * - activate needs no stateful session; it uses the same cookies
 *
 * Operation chains:
 * - Create: create (with source, if given)
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import type {
  AdtObjectIdentity,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtEnhancementHost,
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
  IProgramResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { PROGRAM } from '../../endpoints/objects';
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
import { activateProgram } from './activation';
import { checkProgram } from './check';
import { create as createProgram } from './create';
import { checkDeletion, deleteProgram } from './delete';
import {
  getProgramEnhancementElements,
  getProgramEnhancementOptions,
} from './enhancements';
import { lockProgram } from './lock';
import {
  getProgramMetadata,
  getProgramSource,
  getProgramTransport,
} from './read';
import type { IProgramConfig, programDocuments } from './types';
import { unlockProgram } from './unlock';
import { uploadProgramSource } from './update';
import { validateProgramName } from './validation';
import { getProgramVersionSource, getProgramVersions } from './versions';

/** What each slot of the result set answers. */
export type ProgramValues = {
  readonly [K in keyof IProgramResults]: unknown;
};

export class AdtProgram<
  T extends ProgramValues = ResultValuesOf<typeof programDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtEnhancementHost<
      IProgramConfig,
      T['enhancementElements'],
      T['enhancementOptions'],
      'programName'
    >,
    IAdtCreatable<IProgramConfig, T['created']>,
    IAdtReadable<IProgramConfig, T['source'], 'programName'>,
    IAdtMetadataReadable<IProgramConfig, T['metadata'], 'programName'>,
    IAdtUpdatable<
      Partial<IProgramConfig>,
      T['updated'],
      'programName',
      'source'
    >,
    IAdtMetadataUpdatable<
      Partial<IProgramConfig>,
      T['metadataUpdated'],
      'programName',
      'source'
    >,
    IAdtDeletable<
      IProgramConfig,
      T['deletion'],
      'programName',
      T['deletionCheck']
    >,
    IAdtValidatable<
      IProgramConfig,
      T['validation'],
      'programName' | 'packageName'
    >,
    IAdtCheckable<IProgramConfig, T['check'], 'programName'>,
    IAdtActivatable<IProgramConfig, T['activation'], 'programName'>,
    IAdtLockable<IProgramConfig, 'programName'>,
    IAdtTransportAware<IProgramConfig, T['transport'], 'programName'>,
    IAdtVersionable<
      IProgramConfig,
      T['versions'],
      T['versionSource'],
      'programName'
    >
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Program';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'contentTypes' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, contentTypes, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (programName, lockHandle) =>
        unlockProgram(this.connection, programName, lockHandle),
    );
  }

  /** Read the host's enhancement elements. */
  readEnhancementElements<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['enhancementElements'], E | IAdtError>>;
  readEnhancementElements(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['enhancementElements'], IAdtError>>;
  async readEnhancementElements<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementElements'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () => getProgramEnhancementElements(connection, config.programName),
      this.results.enhancementElements,
      options?.analyse,
    );
  }

  /** Read the host's enhancement options. */
  readEnhancementOptions<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['enhancementOptions'], E | IAdtError>>;
  readEnhancementOptions(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['enhancementOptions'], IAdtError>>;
  async readEnhancementOptions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementOptions'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () => getProgramEnhancementOptions(connection, config.programName),
      this.results.enhancementOptions,
      options?.analyse,
    );
  }

  /** Validate a program name before creating it. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'> & {
      packageName: string;
    },
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<IProgramConfig, 'programName'> & {
      packageName: string;
    },
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'> & {
      packageName: string;
    },
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Nothing was asked of the server, so there is no answer to describe: a
    // missing required argument is the caller's mistake and it throws.
    // The package is required: SAP's program validation refuses an empty one
    // (read on premise, 2026-11-02: CL_SEDI_ADT_RES_OBJ_VALIDATION, SEDI_ADT
    // 003) and an absent one with 400.

    return answering(
      () =>
        validateProgramName(
          connection,
          config.programName,
          config.packageName,
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the program. */
  create<E extends IAdtError>(
    config: Omit<IProgramConfig, 'source'> & {
      source?: never;
      /** Not taken: SAP ignores a program type on create (measured). */
      programType?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IProgramConfig, 'source'> & {
      source?: never;
      /** Not taken: SAP ignores a program type on create (measured). */
      programType?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IProgramConfig, 'source'> & {
      source?: never;
      /** Not taken: SAP ignores a program type on create (measured). */
      programType?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
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

    const name = config.programName;
    return answering(
      () =>
        createProgram(connection, options.headers, {
          programName: name,
          packageName: config.packageName,
          transportRequest: config.transportRequest,
          description: config.description,
          application: config.application,
          // No `sourceCode` here. `create` is the POST that makes the
          // program, and it sends metadata only — the source is a PUT to
          // `…/source/main` under a lock, which this member neither holds nor
          // can obtain. Passing the field read as if it did something, and it
          // never did: a program created with a body came back empty, and the
          // only symptom was the object failing to do its job later. Writing
          // the source is `update`'s, after `lock`. See
          // fr0ster/mcp-abap-adt-interfaces#76 for taking the field off the
          // create contract so the compiler says this instead of a comment.
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

  /** Read the program's source. */
  read<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case any more. ADT answers a read for a missing program
    // with 200 and an empty body, so absence was never a status to branch on —
    // and whether an empty body *is* absence is the caller's reading, supplied
    // through `analyse`.
    return answering(
      () => getProgramSource(connection, config.programName, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the program's metadata: package, responsible, description. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => getProgramMetadata(connection, config.programName, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /**
   * Write the program's source.
   *
   * One request: the write, under the lock the caller holds
   * (`options.lockHandle`, required). The lock, the check and the unlock are
   * the caller's own calls of `lock`, `check` and `unlock`.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  update<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName;
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;
    const sessionId = connection.getSessionId() || '';

    return answering(
      () =>
        uploadProgramSource(
          connection,
          options.headers,
          options.ifMatch,
          name,
          source,
          options?.lockHandle,
          sessionId,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the program's metadata document — one PUT of `options.source`, as
   * the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'updateMetadata'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'program', 'updateMetadata'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'updateMetadata'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        writeObjectDocument(
          connection,
          options.headers,
          options.ifMatch,
          PROGRAM.uri(config.programName),
          options?.source,
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
  checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'deletionCheck'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    this: this & AdtPerformedBy<'program', 'deletionCheck'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'deletionCheck'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName;
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          programName: name,
          transportRequest: config.transportRequest,
        }),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete the program.
   *
   * The deletion check is read, not merely performed: ADT answers a refusal
   * with `del:isDeletable="false"` inside a 200, and a delete that ignored it
   * reported success while the object stayed. {@link deletionRefusal} is the
   * shipped reading of that answer; a caller who wants another passes their own
   * `analyse`.
   */
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName;
    return answering(
      () =>
        deleteProgram(connection, options.headers, {
          programName: name,
          transportRequest: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the program. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        activateProgram(
          connection,
          options.headers,
          config.programName,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the program. */
  check<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkProgram(
          connection,
          options.headers,
          config.programName,
          version,
          config.source,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /** The transport request the program belongs to. */
  readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'transport'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    this: this & AdtPerformedBy<'program', 'transport'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'transport'>,
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getProgramTransport(
          connection,
          config.programName,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Lock the program — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  lock<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = config.programName;
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockProgram(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the program. */
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = config.programName;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockProgram(this.connection, name, lockHandle),
        );
        this.lockTracker.untrack(name);
        return result;
      },
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the program's source. */
  getVersions<E extends IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IProgramConfig, 'programName'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    return answering(
      () => getProgramVersions(this.connection, config),
      this.results.versions,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  getVersionSource<E extends IAdtError>(
    contentUri: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>>;
  getVersionSource(
    contentUri: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versionSource'], IAdtError>>;
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>> {
    return answering(
      () => getProgramVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
