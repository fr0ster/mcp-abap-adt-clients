import type {
  IAbapConnection,
  IAdtWireResponse,
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

  async list(options?: IListCrossTracesOptions): Promise<IAdtWireResponse> {
    return listCrossTraces(this.connection, options);
  }

  async getById(
    traceId: string,
    includeSensitiveData?: boolean,
  ): Promise<IAdtWireResponse> {
    return getCrossTrace(this.connection, traceId, includeSensitiveData);
  }

  async getRecords(traceId: string): Promise<IAdtWireResponse> {
    return getCrossTraceRecords(this.connection, traceId);
  }

  async getRecordContent(
    traceId: string,
    recordNumber: number,
  ): Promise<IAdtWireResponse> {
    return getCrossTraceRecordContent(this.connection, traceId, recordNumber);
  }

  async getActivations(): Promise<IAdtWireResponse> {
    return getCrossTraceActivations(this.connection);
  }
}
