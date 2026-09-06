import { beginCriticalSection } from '../../utils/criticalSection';

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
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { deletionRefusal } from '../../utils/deletionCheck';
import { safeErrorMessage } from '../../utils/internalUtils';
import { validationRefusal } from '../../utils/validationRefusal';
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

export class AdtClass<
    R extends IClassResults<
      unknown,
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
    IAdtCreatable<IClassConfig, ReturnType<R['created']>>,
    IAdtReadable<IClassConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IClassConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<IClassConfig, ReturnType<R['updated']>>,
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
    // Nothing was asked of the server, so there is no answer to describe: a
    // missing required argument is the caller's mistake and it throws.
    if (!config.className) {
      throw new Error('Class name is required for validation');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return answering(
      () =>
        validateClassName(
          this.connection,
          config.className as string,
          config.packageName as string,
          config.description,
          config.superclass,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /**
   * Create class with full operation chain
   */
  async create<E extends IAdtError = IAdtError>(
    config: IClassConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

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
          this.connection,
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
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // No 404 special case any more. ADT answers a read for a missing class with
    // 200 and an empty body, so absence was never a status to branch on — and
    // whether an empty body *is* absence is the caller's reading, supplied
    // through `analyse`. Returning `undefined` here made every caller guess.
    return answering(
      () =>
        getClassSource(
          this.connection,
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
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const sourceCode = options?.sourceCode ?? config.sourceCode;
    if (sourceCode === undefined) {
      throw new Error('Source code is required for update');
    }

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
          this.connection,
          config.className as string,
          sourceCode,
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
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return answering(
      () =>
        checkDeletion(this.connection, {
          class_name: config.className as string,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
    );
  }

  /**
   * Delete class
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    // One member, one endpoint. The approval ADT wants first is `checkDeletion`
    // above — a caller who wants it asks it, and reads what it said. This is the
    // delete, and it leaves the session mode alone.
    return answering(
      () =>
        deleteClass(this.connection, {
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
    if (!config.className) {
      throw new Error('Class name is required');
    }
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    // No parse-and-throw on `has_errors`. A `<msg type="E">` inside a 200 is a
    // refusal, and recognising it is the error strategy's job — done once, on
    // the connection, for every member — rather than this member's, done again
    // and differently. A caller who reads check messages some other way says so
    // through `analyse`.
    return answering(
      () =>
        checkClass(
          this.connection,
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
    if (!config.className) {
      throw new Error('Class name is required');
    }
    // Stay stateful while the lock is held (see lock()); unlockTestClasses()
    // restores stateless. Avoids 423 on older BASIS (#106).
    this.connection.setSessionType('stateful');
    return await lockClass(this.connection, config.className);
  }

  /**
   * Unlock test classes (local classes)
   * Uses parent class unlock
   */
  async unlockTestClasses(
    config: Partial<IClassConfig>,
    lockHandle: string,
  ): Promise<IAdtWireResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    this.connection.setSessionType('stateful');
    const result = await unlockClass(
      this.connection,
      config.className,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return result;
  }

  /**
   * Check test class code (local class)
   */
  async checkTestClass(
    config: Partial<IClassConfig> & { testClassCode: string },
    version: 'active' | 'inactive' = 'inactive',
  ): Promise<IAdtWireResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }
    return await checkClassLocalTestClass(
      this.connection,
      config.className,
      config.testClassCode,
      version,
      this.contentTypes?.sourceArtifactContentType(),
    );
  }

  /**
   * Update test classes (local classes) with full operation chain
   * Always starts with lock of parent class
   */
  async updateTestClasses(
    config: Partial<IClassConfig> & { testClassCode: string },
  ): Promise<IAdtWireResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassCode) {
      throw new Error('Test class code is required');
    }

    let lockHandle: string | undefined;

    // This try is a LOCK…UNLOCK window; a timeout in the middle releases

    // the lock but leaves the work half-done.

    const endCriticalSection = beginCriticalSection(this.connection);

    try {
      // 1. Lock parent class (stateful only for lock)
      // Lock handle from parent class is sufficient for updating testclasses include
      this.logger?.info?.('Step 1: Locking parent class');
      this.connection.setSessionType('stateful');
      lockHandle = await lockClass(this.connection, config.className);
      this.lockTracker.track(config.className, lockHandle);
      this.logger?.info?.('Parent class locked, handle:', lockHandle);

      // 2. Update test classes (uses parent class lock handle)
      this.logger?.info?.('Step 2: Updating test classes');
      const response = await updateClassTestInclude(
        this.connection,
        config.className,
        config.testClassCode,
        lockHandle,
        config.transportRequest,
        this.contentTypes?.sourceArtifactContentType(),
      );

      // 3. Unlock parent class (switch to stateless after unlock)
      this.logger?.info?.('Step 3: Unlocking parent class');
      this.connection.setSessionType('stateful');
      await unlockClass(this.connection, config.className, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(config.className);
      lockHandle = undefined;

      return response;
    } catch (error) {
      // Cleanup: unlock on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking parent class after error');
          this.connection.setSessionType('stateful');
          await unlockClass(this.connection, config.className, lockHandle);
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(config.className);
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock parent class after error:',
            safeErrorMessage(unlockError),
          );
        }
      }
      throw error;
    } finally {
      endCriticalSection();
    }
  }

  /**
   * Activate test classes (local classes)
   */
  async activateTestClasses(
    config: Partial<IClassConfig> & { testClassName: string },
  ): Promise<IAdtWireResponse> {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    if (!config.testClassName) {
      throw new Error('Test class name is required');
    }
    return await activateClassTestClasses(
      this.connection,
      config.className,
      config.testClassName,
    );
  }

  async getVersions(
    config: Partial<IClassConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    if (!config.className) throw new Error('className is required');
    const name = config.className;
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
