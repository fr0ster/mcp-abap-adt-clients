/**
 * Configuring a measurement — the executors' half of the trace story.
 *
 * One implementation, delegated to by both executors. It is a class rather than
 * a base class because `ClassExecutor` and `ProgramExecutor` already extend
 * nothing and share no hierarchy; making one for this would be inventing a
 * relationship between a class run and a report run that does not exist.
 *
 * The vocabulary is deliberately kept apart from the reading side: this yields
 * a **request id**, the profiler takes a **trace id**, and the two were easy to
 * confuse while one type carried both.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  IProfilerTraceParameters,
  ITraceScheduling,
} from '@mcp-abap-adt/interfaces';
import type { INamedItem } from '../core/shared/utilResults';
import {
  createTraceParameters,
  extractProfilerIdFromResponse,
  getTraceRequestsByUri,
  listObjectTypes,
  listProcessTypes,
  listTraceRequests,
} from '../runtime/traces/profiler';
import {
  parseNamedItems,
  parseTraceRequests,
} from '../runtime/traces/traceParsing';
import type { ITraceRequestEntry } from '../runtime/traces/types';
import { answering } from '../utils/adtResponse';

export class TraceScheduling
  implements ITraceScheduling<INamedItem[], ITraceRequestEntry[], string>
{
  constructor(private readonly connection: IAbapConnection) {}

  async listObjectTypes(): Promise<IAdtResponse<INamedItem[]>> {
    return answering(
      () => listObjectTypes(this.connection),
      (answer) => parseNamedItems(answer),
    );
  }

  async listProcessTypes(): Promise<IAdtResponse<INamedItem[]>> {
    return answering(
      () => listProcessTypes(this.connection),
      (answer) => parseNamedItems(answer),
    );
  }

  /**
   * What is queued.
   *
   * An empty answer means nothing is scheduled — the runs that fulfil requests
   * consume them — not that the endpoint is dead. That distinction nearly cost
   * this collection its place in the contract.
   */
  async listRequests(): Promise<IAdtResponse<ITraceRequestEntry[]>> {
    return answering(
      () => listTraceRequests(this.connection),
      (answer) => parseTraceRequests(answer),
    );
  }

  async getRequestsByUri(
    uri: string,
  ): Promise<IAdtResponse<ITraceRequestEntry[]>> {
    return answering(
      () => getTraceRequestsByUri(this.connection, uri),
      (answer) => parseTraceRequests(answer),
    );
  }

  /**
   * Configure a measurement, and answer with the request id.
   *
   * The id comes from the response's `Location`, which is the only place it
   * appears: reading the created resource back answers `200` with an **empty
   * body**, measured. So this is not a read-modify-write surface, and a caller
   * that loses the id cannot recover it from the resource.
   */
  async scheduleTrace(
    options?: IProfilerTraceParameters,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => createTraceParameters(this.connection, options),
      (answer) => {
        const id = extractProfilerIdFromResponse(answer);
        if (!id) {
          // A reading that cannot read is this library's own failure. The id
          // appears only in `Location`: reading the created resource back
          // answers 200 with an empty body, measured — so a caller that loses
          // it cannot recover it from the resource.
          throw new Error(
            'Trace scheduling returned no request id: the Location header of ' +
              'the created parameters resource was absent or unparseable.',
          );
        }
        return id;
      },
    );
  }
}
