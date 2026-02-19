import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import {
  ClassExecutor,
  type IClassExecutor,
  type IProgramExecutor,
  ProgramExecutor,
} from '../executors';

export class AdtExecutor {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  getClassExecutor(): IClassExecutor {
    return new ClassExecutor(this.connection, this.logger);
  }

  getProgramExecutor(): IProgramExecutor {
    return new ProgramExecutor(this.connection, this.logger);
  }
}
