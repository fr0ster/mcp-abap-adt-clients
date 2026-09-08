import type {
  IAbapConnection,
  IAdtResponse,
  IDdicActivation,
  IGetActivationGraphOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getActivationGraph } from './activationGraph';

export class DdicActivation implements IDdicActivation<string> {
  readonly kind = 'ddicActivation' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getGraph(
    options?: IGetActivationGraphOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getActivationGraph(this.connection, options),
      rawDocument,
    );
  }
}
