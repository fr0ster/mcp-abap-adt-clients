/**
 * AdtTextElements - the text elements of a program, a class or a function
 * group: text symbols, selection texts, list and column headings.
 *
 * Their own resource, `/sap/bc/adt/textelements/{programs|classes|functiongroups}/{name}`,
 * one part per sub-resource, under their own lock (class `TEXT`, which the
 * object's lock does not cover). A write replaces one whole part and lands
 * inactive; one activation naming the object and its text elements
 * activates both — the utilities' `activateObjects`, with
 * `textElementsActivationReferences` below.
 *
 * Every member is one request, and the sequence is the caller's — the
 * library's lock pattern:
 *
 * ```typescript
 * const texts = client.getTextElements({
 *   ...textElementsDocuments,
 *   source: textSymbols, // adt-strategies: the part, read
 * });
 * const object = { objectKind: 'program', objectName: 'ZPROG' } as const;
 * const locked = await texts.lock(object);
 * if (!locked.ok) return locked;
 * const lockHandle = locked.getResult().value;
 * let written = false;
 * let released = false;
 * try {
 *   const read = await texts.read({ ...object, part: 'symbols' });
 *   if (!read.ok) return read;
 *   const { symbols } = read.getResult().value;
 *   const put = await texts.update(
 *     { ...object, part: 'symbols', symbols: [...symbols, added] },
 *     { headers, lockHandle },
 *   );
 *   written = put.ok;
 * } finally {
 *   released = (await texts.unlock(object, lockHandle)).ok;
 * }
 * if (written && released) {
 *   await client.getUtils().activateObjects(
 *     textElementsActivationReferences(object),
 *     true,
 *     { headers: activationHeaders },
 *   );
 * }
 * ```
 */
import {
  AdtObjectErrorCodes,
  type AdtVariant,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtHeaders,
  type IAdtLockable,
  type IAdtResponse,
  type IAdtTextElementsReadable,
  type IAdtTextElementsReadOptions,
  type IAdtTextElementsUpdatable,
  type IAdtTextElementsUpdateOptions,
  type ITextElementsResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant } from '../../clients/variant';
import { answering, answeringExchange } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import {
  createLockTracker,
  failedStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import {
  lockTextElements,
  readTextElementsPart,
  unlockTextElements,
  updateTextElementsPart,
} from './requests';
import type {
  ITextElementsConfig,
  ITextElementsPartConfig,
  ITextElementsUpdateConfig,
  TextElementsObjectKind,
  TextElementsReadVersion,
  textElementsDocuments,
} from './types';

/** What each slot of the result set answers. */
export type TextElementsValues = {
  readonly [K in keyof ITextElementsResults]: unknown;
};

/** The kind and the name an identifying member names. */
type TextElementsObject = Pick<
  ITextElementsConfig,
  'objectKind' | 'objectName'
>;

export class AdtTextElements<
  T extends TextElementsValues = ResultValuesOf<typeof textElementsDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtTextElementsReadable<T['source']>,
    IAdtTextElementsUpdatable<T['updated']>,
    IAdtLockable<ITextElementsConfig, 'objectKind' | 'objectName'>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  /** One tracker per kind, so the release knows the address it unlocks. */
  private readonly lockTrackers: {
    readonly [K in TextElementsObjectKind]: LockTracker;
  };
  public readonly objectType: string = 'TextElements';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'lockRegistry'
    >,
  ) {
    const { logger, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    const trackerOf = (kind: TextElementsObjectKind): LockTracker =>
      createLockTracker(
        lockRegistry,
        `${this.objectType}/${kind}`,
        (name, lockHandle) =>
          unlockTextElements(this.connection, kind, name, lockHandle),
      );
    this.lockTrackers = {
      program: trackerOf('program'),
      class: trackerOf('class'),
      functionGroup: trackerOf('functionGroup'),
    };
  }

  /** Read one part: its text, as the result set reads it. */
  async read<E extends IAdtError = IAdtError>(
    config: ITextElementsPartConfig,
    version?: TextElementsReadVersion,
    options?: IAdtTextElementsReadOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        readTextElementsPart(
          connection,
          config.objectKind,
          config.objectName,
          config.part,
          version,
        ),
      this.results.source,
      options?.analyse,
    );
  }

  /**
   * Write one part, whole, under the caller's lock: one PUT of the body built
   * from `config`.
   *
   * **The whole content, every time.** This is a replace, never a merge: SAP
   * deletes every entry the list leaves out; read, change, write back.
   */
  async update<E extends IAdtError = IAdtError>(
    config: ITextElementsUpdateConfig,
    options: { headers: IAdtHeaders } & IAdtTextElementsUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
    // The type requires a lock handle; an empty one would drop out of the
    // query and send the PUT with no lock at all.
    if (options.lockHandle === '') {
      throw new Error(
        'lockHandle is required for a text elements write: an empty one would send the PUT without a lock',
      );
    }
    const connection = withCallTimeout(this.connection, options.timeout);
    return answering(
      () =>
        updateTextElementsPart(
          connection,
          options.headers,
          options.ifMatch,
          config,
          options.lockHandle,
        ),
      this.results.updated,
      options.analyse,
    );
  }

  /**
   * Lock the object's text elements — one LOCK, its handle read by
   * `lockHandleOf`. A 2xx LOCK answered without a handle is a refusal
   * (`LOCK_FAILED`); a LOCK SAP refused keeps SAP's own classification. The registry follows the wire, before any `analyse`
   * runs: a handle SAP answered with a 2xx status is tracked whatever a
   * caller rules, so `unlockAll()` can release it.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: TextElementsObject,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const { objectKind, objectName } = config;
    return answeringExchange(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockTextElements(this.connection, objectKind, objectName),
        );
        const refused = failedStatus(locked);
        const held = refused ? '' : lockHandleOf(locked);
        if (held) this.lockTrackers[objectKind].track(objectName, held);
        // A LOCK SAP refused keeps SAP's classification (the default verdict
        // of a resolved refusal); only a 2xx answer without a handle is
        // `LOCK_FAILED`.
        return !refused && held === ''
          ? {
              answer: locked,
              failure: {
                origin: 'refusal',
                code: AdtObjectErrorCodes.LOCK_FAILED,
                message: `The LOCK of the text elements of ${objectName} answered no lock handle`,
                response: locked,
              },
            }
          : { answer: locked };
      },
      lockHandleOf,
      options?.analyse,
    );
  }

  /**
   * Unlock the object's text elements. The lock leaves the registry only when
   * the UNLOCK succeeded on the wire (a 2xx status), whatever `analyse` rules.
   */
  async unlock<E extends IAdtError = IAdtError>(
    config: TextElementsObject,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const { objectKind, objectName } = config;
    return answering(
      async () => {
        const unlocked = await inStatefulSession(this.connection, () =>
          unlockTextElements(
            this.connection,
            objectKind,
            objectName,
            lockHandle,
          ),
        );
        if (!failedStatus(unlocked)) {
          this.lockTrackers[objectKind].untrack(objectName);
        }
        return unlocked;
      },
      nothing,
      options?.analyse,
    );
  }
}
