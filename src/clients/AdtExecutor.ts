import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { ClassExecutor, ProgramExecutor } from '../executors';
import { withRefusalDetection } from '../utils/refusalAware';

export class AdtExecutor {
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    // Wrapped once, here, where a connection enters the library. A refusal SAP
    // sends with a 2xx would otherwise be stored as a result and reported as
    // success — see src/utils/refusalAware.ts for what that measured.
    this.connection = withRefusalDetection(connection);
    this.logger = logger;
  }

  getClassExecutor(): ClassExecutor {
    return new ClassExecutor(this.connection, this.logger);
  }

  getProgramExecutor(): ProgramExecutor {
    return new ProgramExecutor(this.connection, this.logger);
  }
}
