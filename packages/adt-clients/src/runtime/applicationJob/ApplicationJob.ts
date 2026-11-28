import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IApplicationJobCatalog,
  IApplicationJobTemplate,
  IGetApplicationJobOptions,
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
import { getApplicationJobObject, getApplicationJobSource } from './read';

/** One strategy per member of an application job catalog or template. */
export interface IApplicationJobResults {
  readonly object: IResultStrategy<unknown>;
  readonly source: IResultStrategy<unknown>;
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const applicationJobDocuments = {
  object: rawDocument,
  source: rawDocument,
} satisfies IApplicationJobResults;

/** What each slot of the result set answers. */
export type ApplicationJobValues = {
  readonly [K in keyof IApplicationJobResults]: unknown;
};

/**
 * An application job catalog (`SAJC`), read as its definition: the object
 * document (`getObject`) and the source (`getSource`), one `GET` each.
 */
export class ApplicationJobCatalog<
  T extends ApplicationJobValues = ResultValuesOf<
    typeof applicationJobDocuments
  >,
> implements IApplicationJobCatalog<T['object'], T['source']>
{
  readonly kind = 'applicationJobCatalog' as const;

  private readonly results: ResultStrategiesOf<T>;
  protected readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  getObject<E extends IAdtError>(
    name: string,
    options: IGetApplicationJobOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['object'], E | IAdtError>>;
  getObject(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['object'], IAdtError>>;
  async getObject<E extends IAdtError = IAdtError>(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['object'], E | IAdtError>> {
    return answering(
      () => getApplicationJobObject(this.connection, 'catalog', name, options),
      this.results.object,
      options?.analyse,
    );
  }

  getSource<E extends IAdtError>(
    name: string,
    options: IGetApplicationJobOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  getSource(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async getSource<E extends IAdtError = IAdtError>(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    return answering(
      () => getApplicationJobSource(this.connection, 'catalog', name, options),
      this.results.source,
      options?.analyse,
    );
  }
}

/**
 * An application job template (`SAJT`), read as its definition: the object
 * document (`getObject`) and the source (`getSource`), one `GET` each.
 */
export class ApplicationJobTemplate<
  T extends ApplicationJobValues = ResultValuesOf<
    typeof applicationJobDocuments
  >,
> implements IApplicationJobTemplate<T['object'], T['source']>
{
  readonly kind = 'applicationJobTemplate' as const;

  private readonly results: ResultStrategiesOf<T>;
  protected readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  getObject<E extends IAdtError>(
    name: string,
    options: IGetApplicationJobOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['object'], E | IAdtError>>;
  getObject(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['object'], IAdtError>>;
  async getObject<E extends IAdtError = IAdtError>(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['object'], E | IAdtError>> {
    return answering(
      () => getApplicationJobObject(this.connection, 'template', name, options),
      this.results.object,
      options?.analyse,
    );
  }

  getSource<E extends IAdtError>(
    name: string,
    options: IGetApplicationJobOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  getSource(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async getSource<E extends IAdtError = IAdtError>(
    name: string,
    options?: IGetApplicationJobOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    return answering(
      () => getApplicationJobSource(this.connection, 'template', name, options),
      this.results.source,
      options?.analyse,
    );
  }
}
