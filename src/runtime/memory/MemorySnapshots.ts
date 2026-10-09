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
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import type {
  IMemorySnapshots,
  IMemorySnapshotsListOptions,
  ISnapshotChildrenOptions,
  ISnapshotRankingListOptions,
  ISnapshotReferencesOptions,
} from '../debugger/contracts';
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

type Of<
  R extends IMemorySnapshotsResults,
  K extends keyof IMemorySnapshotsResults,
> = ReturnType<R[K]>;

export class MemorySnapshots<
  R extends IMemorySnapshotsResults = typeof memorySnapshotsDocuments,
> implements
    IMemorySnapshots<
      Of<R, 'list'>,
      Of<R, 'snapshot'>,
      Of<R, 'overview'>,
      Of<R, 'rankingList'>,
      Of<R, 'children'>,
      Of<R, 'references'>
    >
{
  readonly kind = 'memorySnapshots' as const;

  constructor(
    private readonly connection: IAbapConnection,
    _logger?: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = memorySnapshotsDocuments as unknown as R,
  ) {}

  private reading<K extends keyof IMemorySnapshotsResults>(
    key: K,
  ): IResultStrategy<Of<R, K>> {
    return this.results[key] as IResultStrategy<Of<R, K>>;
  }

  async list<E extends IAdtError = IAdtError>(
    options?: IMemorySnapshotsListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'list'>, E>> {
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
  ): Promise<IAdtResponse<Of<R, 'snapshot'>, E>> {
    return answering(
      () => getSnapshot(this.connection, snapshotId),
      this.reading('snapshot'),
      options?.analyse,
    );
  }

  async getOverview<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'overview'>, E>> {
    return answering(
      () => getSnapshotOverview(this.connection, snapshotId),
      this.reading('overview'),
      options?.analyse,
    );
  }

  async getRankingList<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: ISnapshotRankingListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'rankingList'>, E>> {
    return answering(
      () => getSnapshotRankingList(this.connection, snapshotId, options),
      this.reading('rankingList'),
      options?.analyse,
    );
  }

  async getChildren<E extends IAdtError = IAdtError>(
    snapshotId: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'children'>, E>> {
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
    options?: ISnapshotReferencesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'references'>, E>> {
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
  ): Promise<IAdtResponse<Of<R, 'overview'>, E>> {
    return answering(
      () => getSnapshotDeltaOverview(this.connection, fromId, toId),
      this.reading('overview'),
      options?.analyse,
    );
  }

  async getDeltaRankingList<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    options?: ISnapshotRankingListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'rankingList'>, E>> {
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
    options?: ISnapshotChildrenOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'children'>, E>> {
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
    options?: ISnapshotReferencesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<Of<R, 'references'>, E>> {
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
