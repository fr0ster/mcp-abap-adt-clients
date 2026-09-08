import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  ISt05Trace,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import { getSt05TraceDirectory, getSt05TraceState } from './st05';

export class St05Trace implements ISt05Trace<string, string> {
  readonly kind = 'st05Trace' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getState(): Promise<IAdtResponse<string>> {
    return answering(() => getSt05TraceState(this.connection), rawDocument);
  }

  async getDirectory(): Promise<IAdtResponse<string>> {
    return answering(() => getSt05TraceDirectory(this.connection), rawDocument);
  }
}
