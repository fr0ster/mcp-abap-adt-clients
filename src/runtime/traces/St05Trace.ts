import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IResultStrategy,
  ISt05Trace,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
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

export class St05Trace<R extends ISt05TraceResults = typeof st05TraceDocuments>
  implements ISt05Trace<ReturnType<R['state']>, ReturnType<R['directory']>>
{
  readonly kind = 'st05Trace' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = st05TraceDocuments as unknown as R,
  ) {}

  async getState<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['state']>, E>> {
    return answering(
      () => getSt05TraceState(this.connection),
      this.results.state as IResultStrategy<ReturnType<R['state']>>,
      options?.analyse,
    );
  }

  async getDirectory<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['directory']>, E>> {
    return answering(
      () => getSt05TraceDirectory(this.connection),
      this.results.directory as IResultStrategy<ReturnType<R['directory']>>,
      options?.analyse,
    );
  }
}
