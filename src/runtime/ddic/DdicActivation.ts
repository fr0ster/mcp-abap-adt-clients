import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getActivationGraph,
  type IGetActivationGraphOptions,
} from './activationGraph';

export class DdicActivation implements IRuntimeAnalysisObject {
  readonly kind = 'ddicActivation' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getGraph(options?: IGetActivationGraphOptions): Promise<AxiosResponse> {
    return getActivationGraph(this.connection, options);
  }
}
