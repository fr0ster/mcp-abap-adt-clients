import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IApplicationLog,
  IGetApplicationLogObjectOptions,
  IGetApplicationLogSourceOptions,
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
  getApplicationLogObject,
  getApplicationLogSource,
  validateApplicationLogName,
} from './read';

/** One strategy per member of an application-log object. */
export interface IApplicationLogResults {
  readonly object: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
  readonly validation: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const applicationLogDocuments = {
  object: rawDocument,
  source: rawDocument,
  validation: rawDocument,
} satisfies IApplicationLogResults;

/** What each slot of the result set answers. */
export type ApplicationLogValues = {
  readonly [K in keyof IApplicationLogResults]: unknown;
};

export class ApplicationLog<
  T extends ApplicationLogValues = ResultValuesOf<
    typeof applicationLogDocuments
  >,
> implements IApplicationLog<T['object'], T['source'], T['validation']>
{
  readonly kind = 'applicationLog' as const;

  private readonly results: ResultStrategiesOf<T>;
  private readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  async getObject<E extends IAdtError = IAdtError>(
    objectName: string,
    options?: IGetApplicationLogObjectOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['object'], E>> {
    return answering(
      () => getApplicationLogObject(this.connection, objectName, options),
      this.results.object,
      options?.analyse,
    );
  }

  async getSource<E extends IAdtError = IAdtError>(
    objectName: string,
    options?: IGetApplicationLogSourceOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    return answering(
      () => getApplicationLogSource(this.connection, objectName, options),
      this.results.source,
      options?.analyse,
    );
  }

  async validateName<E extends IAdtError = IAdtError>(
    objectName: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E>> {
    return answering(
      () => validateApplicationLogName(this.connection, objectName),
      this.results.validation,
      options?.analyse,
    );
  }
}
