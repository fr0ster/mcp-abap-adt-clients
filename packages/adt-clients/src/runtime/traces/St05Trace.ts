import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IResultStrategy,
  ISt05Trace,
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
import { getSt05TraceDirectory, getSt05TraceState } from './st05';

/** One strategy per member of the ST05 trace. */
export interface ISt05TraceResults {
  readonly state: IResultStrategy<unknown>;
  readonly directory: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const st05TraceDocuments = {
  state: rawDocument,
  directory: rawDocument,
} satisfies ISt05TraceResults;

/** What each slot of the result set answers. */
export type St05TraceValues = {
  readonly [K in keyof ISt05TraceResults]: unknown;
};

export class St05Trace<
  T extends St05TraceValues = ResultValuesOf<typeof st05TraceDocuments>,
> implements ISt05Trace<T['state'], T['directory']>
{
  readonly kind = 'st05Trace' as const;

  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  async getState<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['state'], E>> {
    return answering(
      () => getSt05TraceState(this.connection),
      this.results.state,
      options?.analyse,
    );
  }

  async getDirectory<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['directory'], E>> {
    return answering(
      () => getSt05TraceDirectory(this.connection),
      this.results.directory,
      options?.analyse,
    );
  }
}
