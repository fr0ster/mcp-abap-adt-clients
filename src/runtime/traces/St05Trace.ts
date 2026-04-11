import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
  ISt05Trace,
} from '@mcp-abap-adt/interfaces';
import { getSt05TraceDirectory, getSt05TraceState } from './st05';

export class St05Trace implements ISt05Trace {
  readonly kind = 'st05Trace' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getState(): Promise<AxiosResponse> {
    return getSt05TraceState(this.connection);
  }

  async getDirectory(): Promise<AxiosResponse> {
    return getSt05TraceDirectory(this.connection);
  }
}
