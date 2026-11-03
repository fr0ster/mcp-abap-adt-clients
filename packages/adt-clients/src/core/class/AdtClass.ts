import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
import { withCallTimeout } from '../../utils/callTimeout';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import {
  getClassEnhancementElements,
  getClassEnhancementOptions,
} from './enhancements';

/**
 * AdtClass - High-level CRUD operations for Class objects
 *
 * Implements IAdtObject interface with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * Uses low-level functions directly (not Builder classes).
 *
 * Session management:
 * - stateful: only when doing lock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 *
 * Operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import type {
  AdtVariant,
  IAdtActivatable,
  IAdtAnalyseOptions,
  IAdtCheckable,
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
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAdtVersionable,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { CLASS } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import type {
  ResultStrategiesOf,
  ResultValuesOf,
} from '../../utils/resultStrategy';
import { writeObjectDocument } from '../shared/documentWrite';
import type { IReadOptions } from '../shared/types';
import { AdtClassMemberBase, type ClassValues } from './AdtClassMemberBase';
import { checkClass } from './check';
import { create as createClass } from './create';
import { checkDeletion, deleteClass } from './delete';
import { getClassSource } from './read';
import { activateClassTestClasses } from './testclasses';
import type { classDocuments, IClassConfig } from './types';
import { updateClass } from './update';
import { validateClassName } from './validation';

export class AdtClass<
    T extends ClassValues = ResultValuesOf<typeof classDocuments>,
    V extends AdtVariant = AdtModernVariant,
  >
  extends AdtClassMemberBase<T, V, 'class'>
  implements
    IAdtEnhancementHost<
      IClassConfig,
      T['enhancementElements'],
      T['enhancementOptions']
    >,
    IAdtCreatable<IClassConfig, T['created']>,
    IAdtReadable<IClassConfig, T['source']>,
    IAdtMetadataReadable<IClassConfig, T['metadata']>,
    IAdtUpdatable<Partial<IClassConfig>, T['updated']>,
    IAdtMetadataUpdatable<Partial<IClassConfig>, T['metadataUpdated']>,
    IAdtDeletable<IClassConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<IClassConfig, T['validation']>,
    IAdtCheckable<IClassConfig, T['check']>,
    IAdtActivatable<IClassConfig, T['activation']>,
    IAdtLockable<IClassConfig>,
    IAdtVersionable<IClassConfig, T['versions'], T['versionSource']>
{
  public readonly objectType: string = 'Class';

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

  /** Read the host's enhancement elements. */
  async readEnhancementElements<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementElements'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () => getClassEnhancementElements(connection, config.className as string),
      this.results.enhancementElements,
      options?.analyse,
    );
  }

  /** Read the host's enhancement options. */
  async readEnhancementOptions<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementOptions'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () => getClassEnhancementOptions(connection, config.className as string),
      this.results.enhancementOptions,
      options?.analyse,
    );
  }

  /**
   * Validate class configuration before creation
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Nothing was asked of the server, so there is no answer to describe: a
    // missing required argument is the caller's mistake and it throws.

    return answering(
      () =>
        validateClassName(
          connection,
          config.className as string,
          config.packageName ?? '',
          config.description,
          config.superclass,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /**
   * Create class with full operation chain
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IClassConfig, 'source'> & {
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

    // One member, one endpoint: this is the POST and nothing else. What used to
    // follow it — a validate, a check, an activation — are members of their own,
    // and the caller calls them in the order they want. Nothing is rolled back
    // here either, because nothing after the POST can fail inside this call.
    //
    // The session mode is not touched. It used to be set stateful and put back,
    // and a single request needs neither: whether the session is stateful is the
    // caller's to decide, on the connection they hold, before the step that
    // needs it. A library reaching into that decides for every other user of the
    // same connection.
    return answering(
      () =>
        createClass(
          connection,
          options.headers,
          {
            class_name: config.className as string,
            package_name: config.packageName,
            transport_request: config.transportRequest,
            description: config.description,
            superclass: config.superclass,
            final: config.final,
            create_protected: config.createProtected,
            master_system:
              config.masterSystem ?? this.systemContext.masterSystem,
            // config.responsible is not sent: see create.ts — SAP would record
            // it as the creator, not as the responsible person.
            masterLanguage:
              config.masterLanguage ?? this.systemContext.masterLanguage,
            template_xml: config.classTemplate,
          },
          this.logger,
        ),
      this.results.created,
      options?.analyse,
    );
  }

  /**
   * Read class
   */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case any more. ADT answers a read for a missing class with
    // 200 and an empty body, so absence was never a status to branch on — and
    // whether an empty body *is* absence is the caller's reading, supplied
    // through `analyse`. Returning `undefined` here made every caller guess.
    return answering(
      () =>
        getClassSource(
          connection,
          config.className as string,
          version,
          options,
        ),
      this.results.source,
      options?.analyse,
    );
  }

  /**
   * Update class with full operation chain
   * Always starts with lock
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;

    // **One member, one endpoint: the PUT.** This used to be a window — lock,
    // check, PUT, unlock, check, and an activation on request — six requests
    // behind one call. Every one of them is a member of its own: `lock`,
    // `check`, `unlock`, `activate`, all declared and all callable. Composing
    // them here made a library method out of a sequence that is the caller's,
    // and hid from them which request failed.
    //
    // The lock handle is passed as given, including not at all. Whether an update
    // without one is allowed is ADT's judgement, and it answers it — this library
    // does not stand in front of the server with an opinion of its own.
    return answering(
      () =>
        updateClass(
          connection,
          options.headers,
          options.ifMatch,
          config.className as string,
          source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the class's metadata document — one PUT of `options.source`, as
   * the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'updateMetadata'>,
    config: Partial<IClassConfig>,
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
          CLASS.uri(config.className as string),
          options?.source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
      options?.analyse,
    );
  }

  /**
   * Ask whether the class can be deleted now.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'deletionCheck'>,
    config: Partial<IClassConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          class_name: config.className as string,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete class
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // One member, one endpoint. The approval ADT wants first is `checkDeletion`
    // above — a caller who wants it asks it, and reads what it said. This is the
    // delete, and it leaves the session mode alone.
    return answering(
      () =>
        deleteClass(connection, options.headers, {
          class_name: config.className as string,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /**
   * Check class
   */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    // No parse-and-throw on `has_errors`. The report comes back whatever it
    // says, because a check that finds a syntax error is a check that worked —
    // and throwing cost the findings, the line numbers and the T100 keys.
    // Whether a message means "do not write" is the caller's, through
    // `analyse`; no error strategy ships from this package.
    return answering(
      () =>
        checkClass(
          connection,
          options.headers,
          config.className as string,
          version,
          config.source,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /**
   * Activate test classes (local classes) — one activation POST, read by the
   * `activation` strategy.
   */
  async activateTestClasses<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig> & { testClassName: string },
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    return answering(
      () =>
        activateClassTestClasses(
          this.connection,
          config.className as string,
          config.testClassName,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Version history of the class's `main` include. */
  async getVersions<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E>> {
    return this.includeVersions(config.className as string, 'main', options);
  }
}
