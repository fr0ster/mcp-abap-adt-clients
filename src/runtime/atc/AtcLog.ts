import type {
  IAbapConnection,
  IAdtResponse,
  IAtcLog,
  IGetCheckFailureLogsOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getCheckFailureLogs, getExecutionLog } from './logs';

export class AtcLog implements IAtcLog<string, string> {
  readonly kind = 'atcLog' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getCheckFailureLogs(
    options?: IGetCheckFailureLogsOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getCheckFailureLogs(this.connection, options),
      rawDocument,
    );
  }

  async getExecutionLog(executionId: string): Promise<IAdtResponse<string>> {
    return answering(
      () => getExecutionLog(this.connection, executionId),
      rawDocument,
    );
  }
}
