import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { IListableRuntimeObject } from './types';

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

export interface IMemorySnapshots
  extends IListableRuntimeObject<
    IAdtWireResponse,
    IMemorySnapshotsListOptions,
    'memorySnapshots'
  > {
  getById(snapshotId: string): Promise<IAdtWireResponse>;
  getOverview(snapshotId: string): Promise<IAdtWireResponse>;
  getRankingList(
    snapshotId: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<IAdtWireResponse>;
  getChildren(
    snapshotId: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<IAdtWireResponse>;
  getReferences(
    snapshotId: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<IAdtWireResponse>;
  getDeltaOverview(uri1: string, uri2: string): Promise<IAdtWireResponse>;
  getDeltaRankingList(
    uri1: string,
    uri2: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<IAdtWireResponse>;
  getDeltaChildren(
    uri1: string,
    uri2: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<IAdtWireResponse>;
  getDeltaReferences(
    uri1: string,
    uri2: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<IAdtWireResponse>;
}
