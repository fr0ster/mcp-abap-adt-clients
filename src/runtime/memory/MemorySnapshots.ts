import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
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
  type ISnapshotChildrenOptions,
  type ISnapshotRankingListOptions,
  type ISnapshotReferencesOptions,
  listSnapshots,
} from './snapshots';

export class MemorySnapshots implements IRuntimeAnalysisObject {
  readonly kind = 'memorySnapshots' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(user?: string, originalUser?: string): Promise<AxiosResponse> {
    return listSnapshots(this.connection, user, originalUser);
  }

  async getById(snapshotId: string): Promise<AxiosResponse> {
    return getSnapshot(this.connection, snapshotId);
  }

  async getOverview(snapshotId: string): Promise<AxiosResponse> {
    return getSnapshotOverview(this.connection, snapshotId);
  }

  async getRankingList(
    snapshotId: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotRankingList(this.connection, snapshotId, options);
  }

  /**
   * Get children of a parent object in a snapshot.
   *
   * @param snapshotId - Snapshot ID
   * @param parentKey - Parent object key
   * @param options - Children query options
   */
  async getChildren(
    snapshotId: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotChildren(this.connection, snapshotId, parentKey, options);
  }

  /**
   * Get references to an object in a snapshot.
   *
   * @param snapshotId - Snapshot ID
   * @param objectKey - Object key
   * @param options - References query options
   */
  async getReferences(
    snapshotId: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotReferences(
      this.connection,
      snapshotId,
      objectKey,
      options,
    );
  }

  /**
   * Get delta overview between two snapshots.
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   */
  async getDeltaOverview(uri1: string, uri2: string): Promise<AxiosResponse> {
    return getSnapshotDeltaOverview(this.connection, uri1, uri2);
  }

  /**
   * Get delta ranking list between two snapshots.
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @param options - Ranking list options
   */
  async getDeltaRankingList(
    uri1: string,
    uri2: string,
    options?: ISnapshotRankingListOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaRankingList(this.connection, uri1, uri2, options);
  }

  /**
   * Get delta children between two snapshots for a given parent object.
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @param parentKey - Parent object key
   * @param options - Children query options
   */
  async getDeltaChildren(
    uri1: string,
    uri2: string,
    parentKey: string,
    options?: ISnapshotChildrenOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaChildren(
      this.connection,
      uri1,
      uri2,
      parentKey,
      options,
    );
  }

  /**
   * Get delta references between two snapshots for a given object.
   *
   * @param uri1 - URI of first snapshot
   * @param uri2 - URI of second snapshot
   * @param objectKey - Object key
   * @param options - References query options
   */
  async getDeltaReferences(
    uri1: string,
    uri2: string,
    objectKey: string,
    options?: ISnapshotReferencesOptions,
  ): Promise<AxiosResponse> {
    return getSnapshotDeltaReferences(
      this.connection,
      uri1,
      uri2,
      objectKey,
      options,
    );
  }
}
