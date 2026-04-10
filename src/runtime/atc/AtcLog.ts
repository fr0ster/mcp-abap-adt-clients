import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getCheckFailureLogs,
  getExecutionLog,
  type IGetCheckFailureLogsOptions,
} from './logs';

export class AtcLog implements IRuntimeAnalysisObject {
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
