import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
  IRuntimeDumpReadOptions,
  IRuntimeDumps,
  IRuntimeDumpsListOptions,
} from '@mcp-abap-adt/interfaces';
import {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  getRuntimeDumpById,
  listRuntimeDumps,
  listRuntimeDumpsByUser,
} from './read';

export class RuntimeDumps implements IRuntimeDumps {
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
