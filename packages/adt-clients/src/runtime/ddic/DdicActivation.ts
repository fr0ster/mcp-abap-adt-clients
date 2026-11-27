import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IDdicActivation,
  IGetActivationGraphOptions,
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
import { getActivationGraph } from './activationGraph';

/** One strategy per member of the DDIC activation graph. */
export interface IDdicActivationResults {
  readonly graph: IResultStrategy<unknown>;
}

/**
 * The shipped default: the graph as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const ddicActivationDocuments = {
  graph: rawDocument,
} satisfies IDdicActivationResults;

/** What each slot of the result set answers. */
export type DdicActivationValues = {
  readonly [K in keyof IDdicActivationResults]: unknown;
};

export class DdicActivation<
  T extends DdicActivationValues = ResultValuesOf<
    typeof ddicActivationDocuments
  >,
> implements IDdicActivation<T['graph']>
{
  readonly kind = 'ddicActivation' as const;

  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  getGraph<E extends IAdtError>(
    options: IGetActivationGraphOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['graph'], E | IAdtError>>;
  getGraph(
    options?: IGetActivationGraphOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['graph'], IAdtError>>;
  async getGraph<E extends IAdtError = IAdtError>(
    options?: IGetActivationGraphOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['graph'], E | IAdtError>> {
    return answering(
      () => getActivationGraph(this.connection, options),
      this.results.graph,
      options?.analyse,
    );
  }
}
