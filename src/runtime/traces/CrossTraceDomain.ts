import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  ICrossTrace,
  IListCrossTracesOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import {
  getCrossTrace,
  getCrossTraceActivations,
  getCrossTraceRecordContent,
  getCrossTraceRecords,
  listCrossTraces,
} from './crossTrace';

/**
 * One strategy per distinct answer of the cross trace — the keys of the
 * contract's own `ICrossTraceResults` record, which this fills in.
 */
export interface ICrossTraceResultSet {
  readonly list: IResultStrategy<unknown>;
  readonly trace: IResultStrategy<unknown>;
  readonly records: IResultStrategy<unknown>;
  readonly recordContent: IResultStrategy<unknown>;
  readonly activations: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const crossTraceDocuments = {
  list: rawDocument,
  trace: rawDocument,
  records: rawDocument,
  recordContent: rawDocument,
  activations: rawDocument,
} satisfies ICrossTraceResultSet;

export class CrossTrace<
  R extends ICrossTraceResultSet = typeof crossTraceDocuments,
> implements
    ICrossTrace<{
      list: ReturnType<R['list']>;
      trace: ReturnType<R['trace']>;
      records: ReturnType<R['records']>;
      recordContent: ReturnType<R['recordContent']>;
      activations: ReturnType<R['activations']>;
    }>
{
  readonly kind = 'crossTrace' as const;
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = crossTraceDocuments as unknown as R,
  ) {}

  async list<E extends IAdtError = IAdtError>(
    options?: IListCrossTracesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['list']>, E>> {
    return answering(
      () => listCrossTraces(this.connection, options),
      this.results.list as IResultStrategy<ReturnType<R['list']>>,
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    traceId: string,
    includeSensitiveData?: boolean,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['trace']>, E>> {
    return answering(
      () => getCrossTrace(this.connection, traceId, includeSensitiveData),
      this.results.trace as IResultStrategy<ReturnType<R['trace']>>,
      options?.analyse,
    );
  }

  async getRecords<E extends IAdtError = IAdtError>(
    traceId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['records']>, E>> {
    return answering(
      () => getCrossTraceRecords(this.connection, traceId),
      this.results.records as IResultStrategy<ReturnType<R['records']>>,
      options?.analyse,
    );
  }

  async getRecordContent<E extends IAdtError = IAdtError>(
    traceId: string,
    recordNumber: number,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['recordContent']>, E>> {
    return answering(
      () => getCrossTraceRecordContent(this.connection, traceId, recordNumber),
      this.results.recordContent as IResultStrategy<
        ReturnType<R['recordContent']>
      >,
      options?.analyse,
    );
  }

  async getActivations<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activations']>, E>> {
    return answering(
      () => getCrossTraceActivations(this.connection),
      this.results.activations as IResultStrategy<ReturnType<R['activations']>>,
      options?.analyse,
    );
  }
}
