import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IAtcLog,
  IGetCheckFailureLogsOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { getCheckFailureLogs, getExecutionLog } from './logs';

export class AtcLog implements IAtcLog {
  readonly kind = 'atcLog' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getCheckFailureLogs(
    options?: IGetCheckFailureLogsOptions,
  ): Promise<AxiosResponse> {
    return getCheckFailureLogs(this.connection, options);
  }

  async getExecutionLog(executionId: string): Promise<AxiosResponse> {
    return getExecutionLog(this.connection, executionId);
  }
}
