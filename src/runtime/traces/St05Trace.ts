import type {
  IAbapConnection,
  IAdtWireResponse,
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

  async getState(): Promise<IAdtWireResponse> {
    return getSt05TraceState(this.connection);
  }

  async getDirectory(): Promise<IAdtWireResponse> {
    return getSt05TraceDirectory(this.connection);
  }
}
