import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IListableRuntimeObject, IRuntimeAnalysisObject } from '../types';
import {
  getCrossTrace,
  getCrossTraceActivations,
  getCrossTraceRecordContent,
  getCrossTraceRecords,
  type IListCrossTracesOptions,
  listCrossTraces,
} from './crossTrace';

export class CrossTrace
  implements
    IListableRuntimeObject<AxiosResponse, IListCrossTracesOptions>,
    IRuntimeAnalysisObject
{
  readonly kind = 'crossTrace' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IListCrossTracesOptions): Promise<AxiosResponse> {
    return listCrossTraces(this.connection, options);
  }

  async getById(
    traceId: string,
    includeSensitiveData?: boolean,
  ): Promise<AxiosResponse> {
    return getCrossTrace(this.connection, traceId, includeSensitiveData);
  }

  async getRecords(traceId: string): Promise<AxiosResponse> {
    return getCrossTraceRecords(this.connection, traceId);
  }

  async getRecordContent(
    traceId: string,
    recordNumber: number,
  ): Promise<AxiosResponse> {
    return getCrossTraceRecordContent(this.connection, traceId, recordNumber);
  }

  async getActivations(): Promise<AxiosResponse> {
    return getCrossTraceActivations(this.connection);
  }
}
