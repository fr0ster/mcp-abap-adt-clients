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
import type { AdtLoggedOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import {
  type ResultStrategiesOf,
  type ResultValuesOf,
  rawDocument,
} from '../../utils/resultStrategy';
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

/** What each slot of the result set answers. */
export type CrossTraceValues = {
  readonly [K in keyof ICrossTraceResultSet]: unknown;
};

export class CrossTrace<
  T extends CrossTraceValues = ResultValuesOf<typeof crossTraceDocuments>,
> implements
    ICrossTrace<{
      list: T['list'];
      trace: T['trace'];
      records: T['records'];
      recordContent: T['recordContent'];
      activations: T['activations'];
    }>
{
  readonly kind = 'crossTrace' as const;
  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  async list<E extends IAdtError = IAdtError>(
    options?: IListCrossTracesOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['list'], E>> {
    return answering(
      () => listCrossTraces(this.connection, options),
      this.results.list,
      options?.analyse,
    );
  }

  async getById<E extends IAdtError = IAdtError>(
    traceId: string,
    includeSensitiveData?: boolean,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['trace'], E>> {
    return answering(
      () => getCrossTrace(this.connection, traceId, includeSensitiveData),
      this.results.trace,
      options?.analyse,
    );
  }

  async getRecords<E extends IAdtError = IAdtError>(
    traceId: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['records'], E>> {
    return answering(
      () => getCrossTraceRecords(this.connection, traceId),
      this.results.records,
      options?.analyse,
    );
  }

  async getRecordContent<E extends IAdtError = IAdtError>(
    traceId: string,
    recordNumber: number,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['recordContent'], E>> {
    return answering(
      () => getCrossTraceRecordContent(this.connection, traceId, recordNumber),
      this.results.recordContent,
      options?.analyse,
    );
  }

  async getActivations<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['activations'], E>> {
    return answering(
      () => getCrossTraceActivations(this.connection),
      this.results.activations,
      options?.analyse,
    );
  }
}
