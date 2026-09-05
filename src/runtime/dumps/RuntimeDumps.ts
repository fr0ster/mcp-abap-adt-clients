import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  IRuntimeDumpReadOptions,
  IRuntimeDumps,
  IRuntimeDumpsListOptions,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import {
  buildDumpIdPrefix,
  buildRuntimeDumpsUserQuery,
  getRuntimeDumpById,
  listRuntimeDumps,
  listRuntimeDumpsByUser,
} from './read';

export class RuntimeDumps implements IRuntimeDumps<string, string> {
  readonly kind = 'runtimeDumps' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(
    options?: IRuntimeDumpsListOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => listRuntimeDumps(this.connection, options ?? {}),
      rawDocument,
    );
  }

  async listByUser(
    user?: string,
    options?: Omit<IRuntimeDumpsListOptions, 'query'>,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => listRuntimeDumpsByUser(this.connection, user, options),
      rawDocument,
    );
  }

  async getById(
    dumpId: string,
    options?: IRuntimeDumpReadOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getRuntimeDumpById(this.connection, dumpId, options),
      rawDocument,
    );
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
