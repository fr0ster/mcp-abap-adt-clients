import type {
  IAbapConnection,
  IAdtResponse,
  ICrossTrace,
  IListCrossTracesOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import {
  getCrossTrace,
  getCrossTraceActivations,
  getCrossTraceRecordContent,
  getCrossTraceRecords,
  listCrossTraces,
} from './crossTrace';

export class CrossTrace
  implements
    ICrossTrace<{
      list: string;
      trace: string;
      records: string;
      recordContent: string;
      activations: string;
    }>
{
  readonly kind = 'crossTrace' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(options?: IListCrossTracesOptions): Promise<IAdtResponse<string>> {
    return answering(
      () => listCrossTraces(this.connection, options),
      rawDocument,
    );
  }

  async getById(
    traceId: string,
    includeSensitiveData?: boolean,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getCrossTrace(this.connection, traceId, includeSensitiveData),
      rawDocument,
    );
  }

  async getRecords(traceId: string): Promise<IAdtResponse<string>> {
    return answering(
      () => getCrossTraceRecords(this.connection, traceId),
      rawDocument,
    );
  }

  async getRecordContent(
    traceId: string,
    recordNumber: number,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getCrossTraceRecordContent(this.connection, traceId, recordNumber),
      rawDocument,
    );
  }

  async getActivations(): Promise<IAdtResponse<string>> {
    return answering(
      () => getCrossTraceActivations(this.connection),
      rawDocument,
    );
  }
}
