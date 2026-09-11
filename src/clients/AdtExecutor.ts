import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { ClassExecutor, ProgramExecutor } from '../executors';
import { withRequestTrace } from '../utils/requestTrace';

export class AdtExecutor {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    // Wrapped once, here, where a connection enters the library. The wrapper
    // puts the request back on the answer and reads nothing: what a body means
    // is the caller's, through the `analyse` they pass.
    this.connection = withRequestTrace(connection);
    this.logger = logger;
  }

  getClassExecutor(): ClassExecutor {
    return new ClassExecutor(this.connection, this.logger);
  }

  getProgramExecutor(): ProgramExecutor {
    return new ProgramExecutor(this.connection, this.logger);
  }
}
