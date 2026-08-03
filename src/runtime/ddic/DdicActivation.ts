import type {
  IAbapConnection,
  IAdtResponse,
  IDdicActivation,
  IGetActivationGraphOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { getActivationGraph } from './activationGraph';

export class DdicActivation implements IDdicActivation {
  readonly kind = 'ddicActivation' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getGraph(options?: IGetActivationGraphOptions): Promise<IAdtResponse> {
    return getActivationGraph(this.connection, options);
  }
}
