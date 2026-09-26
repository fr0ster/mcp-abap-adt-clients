import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ClassExecutor,
  classExecutorDocuments,
  type IClassExecutorResults,
} from '../executors/class/ClassExecutor';
import {
  type IProgramExecutorResults,
  ProgramExecutor,
  programExecutorDocuments,
} from '../executors/program/ProgramExecutor';
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

  getClassExecutor<
    R extends IClassExecutorResults = typeof classExecutorDocuments,
  >(results: R = classExecutorDocuments as unknown as R): ClassExecutor<R> {
    return new ClassExecutor<R>(this.connection, this.logger, results);
  }

  getProgramExecutor<
    R extends IProgramExecutorResults = typeof programExecutorDocuments,
  >(results: R = programExecutorDocuments as unknown as R): ProgramExecutor<R> {
    return new ProgramExecutor<R>(this.connection, this.logger, results);
  }
}
