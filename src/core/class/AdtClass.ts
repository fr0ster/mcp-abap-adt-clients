import { withCallTimeout } from '../../utils/callTimeout';
import { beginCriticalSection } from '../../utils/criticalSection';
import { inStatefulSession } from '../shared/capabilities/statefulSession';

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
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { safeErrorMessage } from '../../utils/internalUtils';
import type { LockRegistry } from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { AdtClassMemberBase } from './AdtClassMemberBase';
import { checkClass, checkClassLocalTestClass } from './check';
import { create as createClass } from './create';
import { checkDeletion, deleteClass } from './delete';
import { lockClass } from './lock';
import { getClassSource } from './read';
import {
  activateClassTestClasses,
  updateClassTestInclude,
} from './testclasses';
import { classDocuments, type IClassConfig, type IClassResults } from './types';
import { unlockClass } from './unlock';
import { updateClass } from './update';
import { validateClassName } from './validation';

export class AdtClass<R extends IClassResults = typeof classDocuments>
  extends AdtClassMemberBase<R>
  implements
    IAdtCreatable<IClassConfig, ReturnType<R['created']>>,
    IAdtReadable<IClassConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IClassConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IClassConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IClassConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IClassConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IClassConfig, ReturnType<R['check']>>,
    IAdtActivatable<IClassConfig, ReturnType<R['activation']>>,
    IAdtLockable<IClassConfig>,
    IAdtVersionable<IClassConfig, ObjectVersion[], string>
{
  public readonly objectType: string = 'Class';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: `classDocuments`
    // satisfies the erased bound, which the compiler cannot see through the
    // eight `unknown`s. A cast on a *member* would be the factory lying about
    // what it answers, which is exactly what this shape avoids.
    protected readonly results: R = classDocuments as unknown as R,
  ) {
    super(connection, logger, systemContext, contentTypes, lockRegistry);
  }

  /**
   * Validate class configuration before creation
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Nothing was asked of the server, so there is no answer to describe: a
    // missing required argument is the caller's mistake and it throws.

    return answering(
      () =>
        validateClassName(
          connection,
          config.className as string,
          config.packageName as string,
          config.description,
          config.superclass,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /**
   * Create class with full operation chain
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IClassConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // An object created without a package is the single thing `delete()` cannot
    // undo: the deletion check resolves through the package, so it answers
    // "Object does not exist" while the name stays taken for good, and clearing
    // it is SAP GUI territory. Everywhere else a missing field produces a
    // request the server answers, which is a reading a strategy can take. Here
    // it produces a state with no way out through ADT at all.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: an object created without one cannot be deleted through ADT',
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
          {
            class_name: config.className as string,
            package_name: config.packageName as string,
            transport_request: config.transportRequest,
            description: config.description,
            superclass: config.superclass,
            final: config.final,
            abstract: config.abstract,
            create_protected: config.createProtected,
            master_system:
              config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
            masterLanguage:
              config.masterLanguage ?? this.systemContext.masterLanguage,
            template_xml: config.classTemplate,
          },
          this.logger,
          this.contentTypes,
        ),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /**
   * Read class
   */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
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
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // The source is the caller's, through `options.sourceCode`. This used to
    // fall back to `config.sourceCode` — two channels for one value, where the
    // contract documents one. `config.sourceCode` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const sourceCode = options?.sourceCode;

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
          config.className as string,
          sourceCode as string,
          options?.lockHandle,
          config.transportRequest,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      options?.analyse,
    );
  }

  /**
   * Ask whether the class can be deleted now.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        checkDeletion(connection, {
          class_name: config.className as string,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete class
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // One member, one endpoint. The approval ADT wants first is `checkDeletion`
    // above — a caller who wants it asks it, and reads what it said. This is the
    // delete, and it leaves the session mode alone.
    return answering(
      () =>
        deleteClass(connection, {
          class_name: config.className as string,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /**
   * Check class
   */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
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
          config.className as string,
          version,
          config.sourceCode,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /**
   * Lock test classes (local classes) for modification
   * Uses parent class lock - sufficient for updating testclasses include
   */
  async lockTestClasses(config: Partial<IClassConfig>): Promise<string> {
    // Stateful for the LOCK request alone.
    //
    // This used to say "stay stateful while the lock is held … avoids 423 on
    // older BASIS (#106)", and read the issue wider than it is: what #106
    // requires is that LOCK and UNLOCK themselves run stateful, which they
    // still do. The window between them does not — Eclipse's stateful session
    // carries those two requests and nothing else, and a request that runs
    // inside the session leaves what it takes there.
    // Bound before the closure: `config.className` is a mutable property, so
    // the guard above does not narrow it inside a callback.
    const className = config.className as string;
    return await inStatefulSession(this.connection, () =>
      lockClass(this.connection, className),
    );
  }

  /**
   * Unlock test classes (local classes)
   * Uses parent class unlock
   */
  async unlockTestClasses(
    config: Partial<IClassConfig>,
    lockHandle: string,
  ): Promise<IAdtWireResponse> {
    const className = config.className as string;
    return await inStatefulSession(this.connection, () =>
      unlockClass(this.connection, className, lockHandle),
    );
  }

  /**
   * Check test class code (local class)
   */
  async checkTestClass(
    config: Partial<IClassConfig> & { testClassCode: string },
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<IAdtWireResponse> {
    return await checkClassLocalTestClass(
      this.connection,
      config.className as string,
      config.testClassCode,
      version,
      this.contentTypes?.sourceArtifactContentType(),
    );
  }

  /**
   * Activate test classes (local classes)
   */
  async activateTestClasses(
    config: Partial<IClassConfig> & { testClassName: string },
  ): Promise<IAdtWireResponse> {
    return await activateClassTestClasses(
      this.connection,
      config.className as string,
      config.testClassName,
    );
  }

  async getVersions(
    config: Partial<IClassConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    const name = config.className as string;
    return answering(
      async () => ({
        data: await this.getIncludeVersions(name, 'main'),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as ObjectVersion[],
    );
  }
}
