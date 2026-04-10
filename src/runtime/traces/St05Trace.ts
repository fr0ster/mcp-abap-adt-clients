import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import { getSt05TraceDirectory, getSt05TraceState } from './st05';

export class St05Trace implements IRuntimeAnalysisObject {
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
