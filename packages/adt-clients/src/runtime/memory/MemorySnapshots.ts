/**
 * MemorySnapshots - Domain object for the memory snapshots ADT lists
 *
 * One member per request of `./snapshots.ts`. A snapshot is written by the
 * debugger (`AbapDebugger.createMemorySnapshot`) and read here by the id the
 * list gives it.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IMemorySnapshots,
  IMemorySnapshotsListOptions,
  IResultStrategy,
  ISnapshotChildrenOptions,
  ISnapshotRankingListOptions,
  ISnapshotReferencesOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type {
  AdtHandlerOptions,
  AdtShippedOptions,
} from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import {
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
} from '../../utils/resultStrategy';
import {
  getSnapshot,
  getSnapshotChildren,
  getSnapshotDeltaChildren,
  getSnapshotDeltaOverview,
  getSnapshotDeltaRankingList,
  getSnapshotDeltaReferences,
  getSnapshotOverview,
  getSnapshotRankingList,
  getSnapshotReferences,
  listSnapshots,
} from './snapshots';

/** One strategy per view; a delta is read as the view it is a delta of. */
export interface IMemorySnapshotsResults {
  readonly list: IResultStrategy<unknown>;
  readonly snapshot: IResultStrategy<unknown>;
  readonly overview: IResultStrategy<unknown>;
  readonly rankingList: IResultStrategy<unknown>;
  readonly children: IResultStrategy<unknown>;
  readonly references: IResultStrategy<unknown>;
}

/**
 * The shipped default: every document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const memorySnapshotsDocuments = {
  list: rawDocument,
  snapshot: rawDocument,
  overview: rawDocument,
  rankingList: rawDocument,
  children: rawDocument,
  references: rawDocument,
} satisfies IMemorySnapshotsResults;

/** What each slot of the result set answers. */
export type MemorySnapshotsValues = {
  readonly [K in keyof IMemorySnapshotsResults]: unknown;
};

export class MemorySnapshots<
  T extends MemorySnapshotsValues = ResultValuesOf<
    typeof memorySnapshotsDocuments
  >,
> implements
    IMemorySnapshots<
      T['list'],
      T['snapshot'],
      T['overview'],
      T['rankingList'],
      T['children'],
      T['references']
    >
{
  readonly kind = 'memorySnapshots' as const;

  private readonly results: ResultStrategiesOf<T>;

  /**
   * Memory snapshots with the shipped documents, or with the caller's results.
   * No client hands one out, so this is where the shipped documents are the
   * default, as a getter's are.
   */
  static create(
    connection: IAbapConnection,
    options?: AdtShippedOptions<'logger'>,
  ): MemorySnapshots<ResultValuesOf<typeof memorySnapshotsDocuments>>;
  static create<R extends IMemorySnapshotsResults>(
    connection: IAbapConnection,
    options: AdtHandlerOptions<R, 'logger'>,
  ): MemorySnapshots<ResultValuesOf<R>>;
  static create(
    connection: IAbapConnection,
    options: Partial<AdtHandlerOptions<IMemorySnapshotsResults, 'logger'>> = {},
  ): MemorySnapshots<MemorySnapshotsValues> {
    return new MemorySnapshots<MemorySnapshotsValues>(connection, {
      ...options,
      results: options.results ?? memorySnapshotsDocuments,
    });
  }

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtHandlerOptions<ResultStrategiesOf<T>, 'logger'>,
  ) {
    this.results = options.results;
  }

  private reading<K extends keyof T>(key: K): IResultStrategy<T[K]> {
    return this.results[key];
  }

  async list<E extends IAdtError = IAdtError>(
    options?: IMemorySnapshotsListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E>> {
    return answering(
      () =>
        listSnapshots(this.connection, options?.user, options?.originalUser),
      this.reading('list'),
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['snapshot'], E>> {
    return answering(
      () => getSnapshot(this.connection, snapshotId),
      this.reading('snapshot'),
      options?.analyse,
    );
  }

  async getOverview<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['overview'], E>> {
    return answering(
      () => getSnapshotOverview(this.connection, snapshotId),
      this.reading('overview'),
      options?.analyse,
    );
  }

  async getRankingList<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options: ISnapshotRankingListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['rankingList'], E>> {
    return answering(
      () => getSnapshotRankingList(this.connection, snapshotId, options),
      this.reading('rankingList'),
      options?.analyse,
    );
  }

  async getChildren<E extends IAdtError = IAdtError>(
    snapshotId: string,
    parentKey: string,
    options: ISnapshotChildrenOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['children'], E>> {
    return answering(
      () =>
        getSnapshotChildren(this.connection, snapshotId, parentKey, options),
      this.reading('children'),
      options?.analyse,
    );
  }

  async getReferences<E extends IAdtError = IAdtError>(
    snapshotId: string,
    objectKey: string,
    options: ISnapshotReferencesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['references'], E>> {
    return answering(
      () =>
        getSnapshotReferences(this.connection, snapshotId, objectKey, options),
      this.reading('references'),
      options?.analyse,
    );
  }

  async getDeltaOverview<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['overview'], E>> {
    return answering(
      () => getSnapshotDeltaOverview(this.connection, fromId, toId),
      this.reading('overview'),
      options?.analyse,
    );
  }

  async getDeltaRankingList<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    options: ISnapshotRankingListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['rankingList'], E>> {
    return answering(
      () => getSnapshotDeltaRankingList(this.connection, fromId, toId, options),
      this.reading('rankingList'),
      options?.analyse,
    );
  }

  async getDeltaChildren<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    parentKey: string,
    options: ISnapshotChildrenOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['children'], E>> {
    return answering(
      () =>
        getSnapshotDeltaChildren(
          this.connection,
          fromId,
          toId,
          parentKey,
          options,
        ),
      this.reading('children'),
      options?.analyse,
    );
  }

  async getDeltaReferences<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    objectKey: string,
    options: ISnapshotReferencesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['references'], E>> {
    return answering(
      () =>
        getSnapshotDeltaReferences(
          this.connection,
          fromId,
          toId,
          objectKey,
          options,
        ),
      this.reading('references'),
      options?.analyse,
    );
  }
}
