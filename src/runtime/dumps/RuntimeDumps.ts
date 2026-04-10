import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IListableRuntimeObject, IRuntimeAnalysisObject } from '../types';
import {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  getRuntimeDumpById,
  type IRuntimeDumpReadOptions,
  type IRuntimeDumpsListOptions,
  listRuntimeDumps,
  listRuntimeDumpsByUser,
} from './read';

export class RuntimeDumps
  implements
    IListableRuntimeObject<AxiosResponse, IRuntimeDumpsListOptions>,
    IRuntimeAnalysisObject
{
  readonly kind = 'runtimeDumps' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IRuntimeDumpsListOptions): Promise<AxiosResponse> {
    return listRuntimeDumps(this.connection, options ?? {});
  }

  async listByUser(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'>,
  ): Promise<AxiosResponse> {
    return listRuntimeDumpsByUser(this.connection, user, options);
  }

  async getById(
    dumpId: string,
    options?: IRuntimeDumpReadOptions,
  ): Promise<AxiosResponse> {
    return getRuntimeDumpById(this.connection, dumpId, options);
  }

  buildIdPrefix(
    datetime: string,
    hostname: string,
    sysid: string,
    instance: string,
  ): string {
    return buildDumpIdPrefix(datetime, hostname, sysid, instance);
  }

  buildUserQuery(user?: string): string | undefined {
    return buildRuntimeDumpsUserQuery(user);
  }
}
