import type {
  IAbapConnection,
  IAdtResponse,
  ICrossTrace,
  IListCrossTracesOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  getCrossTrace,
  getCrossTraceActivations,
  getCrossTraceRecordContent,
  getCrossTraceRecords,
  listCrossTraces,
} from './crossTrace';

export class CrossTrace implements ICrossTrace {
  readonly kind = 'crossTrace' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IListCrossTracesOptions): Promise<IAdtResponse> {
    return listCrossTraces(this.connection, options);
  }

  async getById(
    traceId: string,
    includeSensitiveData?: boolean,
  ): Promise<IAdtResponse> {
    return getCrossTrace(this.connection, traceId, includeSensitiveData);
  }

  async getRecords(traceId: string): Promise<IAdtResponse> {
    return getCrossTraceRecords(this.connection, traceId);
  }

  async getRecordContent(
    traceId: string,
    recordNumber: number,
  ): Promise<IAdtResponse> {
    return getCrossTraceRecordContent(this.connection, traceId, recordNumber);
  }

  async getActivations(): Promise<IAdtResponse> {
    return getCrossTraceActivations(this.connection);
  }
}
