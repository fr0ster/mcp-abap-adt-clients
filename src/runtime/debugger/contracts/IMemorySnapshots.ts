import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IRuntimeAnalysisObject } from './types';

export interface IMemorySnapshotsListOptions {
  user?: string;
  originalUser?: string;
}

export interface ISnapshotRankingListOptions {
  maxNumberOfObjects?: number;
  excludeAbapType?: string[];
  sortAscending?: boolean;
  sortByColumnName?: string;
  groupByParentType?: boolean;
}

export interface ISnapshotChildrenOptions {
  maxNumberOfObjects?: number;
  sortAscending?: boolean;
  sortByColumnName?: string;
}

export interface ISnapshotReferencesOptions {
  maxNumberOfReferences?: number;
}

/**
 * The memory snapshots ADT lists, one member per request. A snapshot is
 * addressed by the id the list gives it; a memory object inside it by the
 * `key` a ranking list gives it. A delta compares two snapshots: its values
 * are those of `toId`, each with the change from `fromId`.
 */
export interface IMemorySnapshots<
  TList = unknown,
  TSnapshot = unknown,
  TOverview = unknown,
  TRankingList = unknown,
  TChildren = unknown,
  TReferences = unknown,
> extends IRuntimeAnalysisObject<'memorySnapshots'> {
  list<E extends IAdtError = IAdtError>(
    options?: IMemorySnapshotsListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TList, E>>;
  getById<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TSnapshot, E>>;
  getOverview<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TOverview, E>>;
  getRankingList<E extends IAdtError = IAdtError>(
    snapshotId: string,
    options?: ISnapshotRankingListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TRankingList, E>>;
  getChildren<E extends IAdtError = IAdtError>(
    snapshotId: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TChildren, E>>;
  getReferences<E extends IAdtError = IAdtError>(
    snapshotId: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TReferences, E>>;
  getDeltaOverview<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TOverview, E>>;
  getDeltaRankingList<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    options?: ISnapshotRankingListOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TRankingList, E>>;
  getDeltaChildren<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TChildren, E>>;
  getDeltaReferences<E extends IAdtError = IAdtError>(
    fromId: string,
    toId: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<TReferences, E>>;
}
