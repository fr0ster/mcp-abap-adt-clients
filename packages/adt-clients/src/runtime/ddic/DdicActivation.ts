import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IDdicActivation,
  IGetActivationGraphOptions,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtHandlerOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
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

export class DdicActivation<
  R extends IDdicActivationResults = typeof ddicActivationDocuments,
> implements IDdicActivation<ReturnType<R['graph']>>
{
  readonly kind = 'ddicActivation' as const;

  private readonly results: R;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    options: AdtHandlerOptions<R>,
  ) {
    this.results = options.results;
  }

  async getGraph<E extends IAdtError = IAdtError>(
    options?: IGetActivationGraphOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['graph']>, E>> {
    return answering(
      () => getActivationGraph(this.connection, options),
      this.results.graph as IResultStrategy<ReturnType<R['graph']>>,
      options?.analyse,
    );
  }
}
