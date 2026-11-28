import type {
  IAbapKeywordDocumentation,
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IKeywordDocumentationOptions,
  IKeywordDocumentationPositionParams,
  IKeywordDocumentationQueryParams,
  IKeywordDocumentationTopicParams,
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
  getKeywordDocumentationPosition,
  getKeywordDocumentationQuery,
  getKeywordDocumentationTopic,
} from './read';

/** One strategy per form of the keyword documentation. */
export interface IKeywordDocumentationResults {
  readonly query: IResultStrategy<unknown>;
  readonly topic: IResultStrategy<unknown>;
  readonly position: IResultStrategy<unknown>;
}

/**
 * The shipped default: every form answers its page as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const keywordDocumentationDocuments = {
  query: rawDocument,
  topic: rawDocument,
  position: rawDocument,
} satisfies IKeywordDocumentationResults;

/** What each slot of the result set answers. */
export type KeywordDocumentationValues = {
  readonly [K in keyof IKeywordDocumentationResults]: unknown;
};

/** Options of a form's call. */
type FormOptions<E extends IAdtError> = IKeywordDocumentationOptions &
  IAdtAnalyseOptions<E>;

/**
 * The ABAP keyword documentation, one member per form, one `GET` each.
 * Measured on ABAP cloud and on premise (2026-11-28): each form answers
 * `200`; a query with no hit answers `200` with a "Not found" page; the topic
 * form is announced by no discovery template, and the documentation's own
 * links use it.
 */
export class KeywordDocumentation<
  T extends KeywordDocumentationValues = ResultValuesOf<
    typeof keywordDocumentationDocuments
  >,
> implements IAbapKeywordDocumentation<T['query'], T['topic'], T['position']>
{
  readonly kind = 'abapKeywordDocumentation' as const;

  private readonly results: ResultStrategiesOf<T>;
  protected readonly logger: ILogger;

  constructor(
    private readonly connection: IAbapConnection,
    options: AdtLoggedOptions<ResultStrategiesOf<T>>,
  ) {
    this.logger = options.logger;
    this.results = options.results;
  }

  query<E extends IAdtError>(
    params: IKeywordDocumentationQueryParams,
    options: FormOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['query'], E | IAdtError>>;
  query(
    params: IKeywordDocumentationQueryParams,
    options?: FormOptions<IAdtError>,
  ): Promise<IAdtResponse<T['query'], IAdtError>>;
  async query<E extends IAdtError = IAdtError>(
    params: IKeywordDocumentationQueryParams,
    options?: FormOptions<E>,
  ): Promise<IAdtResponse<T['query'], E | IAdtError>> {
    return answering(
      () => getKeywordDocumentationQuery(this.connection, params, options),
      this.results.query,
      options?.analyse,
    );
  }

  topic<E extends IAdtError>(
    params: IKeywordDocumentationTopicParams,
    options: FormOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['topic'], E | IAdtError>>;
  topic(
    params: IKeywordDocumentationTopicParams,
    options?: FormOptions<IAdtError>,
  ): Promise<IAdtResponse<T['topic'], IAdtError>>;
  async topic<E extends IAdtError = IAdtError>(
    params: IKeywordDocumentationTopicParams,
    options?: FormOptions<E>,
  ): Promise<IAdtResponse<T['topic'], E | IAdtError>> {
    return answering(
      () => getKeywordDocumentationTopic(this.connection, params, options),
      this.results.topic,
      options?.analyse,
    );
  }

  position<E extends IAdtError>(
    params: IKeywordDocumentationPositionParams,
    options: FormOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['position'], E | IAdtError>>;
  position(
    params: IKeywordDocumentationPositionParams,
    options?: FormOptions<IAdtError>,
  ): Promise<IAdtResponse<T['position'], IAdtError>>;
  async position<E extends IAdtError = IAdtError>(
    params: IKeywordDocumentationPositionParams,
    options?: FormOptions<E>,
  ): Promise<IAdtResponse<T['position'], E | IAdtError>> {
    return answering(
      () => getKeywordDocumentationPosition(this.connection, params, options),
      this.results.position,
      options?.analyse,
    );
  }
}
