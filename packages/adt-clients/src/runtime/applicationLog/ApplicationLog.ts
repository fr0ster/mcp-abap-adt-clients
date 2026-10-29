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
import type { AdtHandlerOptions } from '../../core/shared/handlerOptions';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
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

export class ApplicationLog<
  R extends IApplicationLogResults = typeof applicationLogDocuments,
> implements
    IApplicationLog<
      ReturnType<R['object']>,
      ReturnType<R['source']>,
      ReturnType<R['validation']>
    >
{
  readonly kind = 'applicationLog' as const;

  private readonly results: R;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    options: AdtHandlerOptions<R>,
  ) {
    this.results = options.results;
  }

  async getObject<E extends IAdtError = IAdtError>(
    objectName: string,
    options?: IGetApplicationLogObjectOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['object']>, E>> {
    return answering(
      () => getApplicationLogObject(this.connection, objectName, options),
      this.results.object as IResultStrategy<ReturnType<R['object']>>,
      options?.analyse,
    );
  }

  async getSource<E extends IAdtError = IAdtError>(
    objectName: string,
    options?: IGetApplicationLogSourceOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    return answering(
      () => getApplicationLogSource(this.connection, objectName, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  async validateName<E extends IAdtError = IAdtError>(
    objectName: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    return answering(
      () => validateApplicationLogName(this.connection, objectName),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }
}
