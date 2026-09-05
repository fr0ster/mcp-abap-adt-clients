import type {
  IAbapConnection,
  IAdtResponse,
  IAdtWireResponse,
  ILogger,
  IProfiler,
  IProfilerListOptions,
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceParameters,
  IProfilerTraceStatementsOptions,
  ViewArgs,
  ViewResult,
} from '@mcp-abap-adt/interfaces';
import { answering, answeringValue } from '../../utils/adtResponse';
import {
  buildTraceParametersXml,
  createTraceParameters,
  DEFAULT_PROFILER_TRACE_PARAMETERS,
  deleteTrace,
  extractProfilerIdFromResponse,
  getTraceDbAccesses,
  getTraceHitList,
  getTraceRequestsByUri,
  getTraceStatements,
  listObjectTypes,
  listProcessTypes,
  listTraceFiles,
  listTraceRequests,
} from './profiler';
import {
  compareRecordedAt,
  parseDbAccesses,
  parseHitList,
  parseStatements,
  parseTraceEntries,
} from './traceParsing';
import type { IAbapTraceEntry, IAbapTraceViews } from './types';

export class Profiler implements IProfiler<IAbapTraceEntry, IAbapTraceViews> {
  readonly kind = 'profiler' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  /**
   * What traces exist.
   *
   * Parsed, not raw: the contract says a listing yields entries, and there is
   * no escape hatch beside it. A `listTraceFilesResponse()` used to sit here
   * handing back the document — on this class only, where nobody holding
   * `IProfiler` could reach it, which is how the gap hid. The feed is an id and
   * a few identifying fields measured on two systems that agreed; there is
   * nothing in it to read a second way.
   */
  async list(
    options?: IProfilerListOptions,
  ): Promise<IAdtResponse<IAbapTraceEntry[]>> {
    return answering(
      () => listTraceFiles(this.connection, options),
      (answer) => parseTraceEntries(answer),
    );
  }

  /**
   * What is inside one trace.
   *
   * One operation, three views. The result type is the view's own — asking for
   * `hitlist` yields a hit list, and the compiler refuses a view this family
   * does not have.
   */
  /**
   * Remove a trace.
   *
   * `void`: there is nothing to read from a deletion, and the contract says so.
   * What a missing id does is not measured — a `404` would reject here, and a
   * caller that must tolerate one has to catch until somebody measures a repeat.
   */
  async delete(traceId: string): Promise<IAdtResponse<void>> {
    return answering(
      () => deleteTrace(this.connection, traceId),
      () => undefined,
    );
  }

  /**
   * The raw response for a view, before anything is made of it.
   *
   * One place that knows which URL and which options a view sends, so nothing
   * built on top of it can drift from what {@link read} asks for.
   */
  private async viewResponse<K extends keyof IAbapTraceViews>(
    traceId: string,
    view: K,
    options: unknown,
  ): Promise<IAdtWireResponse> {
    switch (view) {
      case 'hitlist':
        return getTraceHitList(
          this.connection,
          traceId,
          options as IProfilerTraceHitListOptions | undefined,
        );
      case 'statements':
        return getTraceStatements(
          this.connection,
          traceId,
          options as IProfilerTraceStatementsOptions | undefined,
        );
      case 'dbAccesses':
        return getTraceDbAccesses(
          this.connection,
          traceId,
          options as IProfilerTraceDbAccessesOptions | undefined,
        );
      default:
        // Unreachable through the typed surface; reachable from JavaScript.
        throw new Error(`Unknown trace view: ${String(view)}`);
    }
  }

  /**
   * What is inside one trace.
   *
   * The mapping is deliberately plain: document onto the view's type, nothing
   * more. No filtering, no reshaping — those belong to the server, which has
   * endpoints for them. A `readWith(parse, …)` sat beside this until 31.0.0,
   * making how far the answer was read a property of which method was called;
   * a consumer who wants another reading implements `IProfiler`, which is
   * generic in what its views answer for exactly that reason.
   */
  async read<K extends keyof IAbapTraceViews>(
    traceId: string,
    view: K,
    ...args: ViewArgs<IAbapTraceViews, K>
  ): Promise<IAdtResponse<ViewResult<IAbapTraceViews, K>>> {
    const [options] = args;
    return answering(
      () => this.viewResponse(traceId, view, options),
      (answer) => {
        switch (view) {
          case 'hitlist':
            return parseHitList(answer) as ViewResult<IAbapTraceViews, K>;
          case 'statements':
            return parseStatements(answer) as ViewResult<IAbapTraceViews, K>;
          case 'dbAccesses':
            return parseDbAccesses(answer) as ViewResult<IAbapTraceViews, K>;
          default:
            // Unreachable through the typed surface; reachable from JavaScript.
            throw new Error(`Unknown trace view: ${String(view)}`);
        }
      },
    );
  }

  buildParametersXml(options?: IProfilerTraceParameters): string {
    return buildTraceParametersXml(options);
  }

  extractIdFromResponse(response: IAdtWireResponse): string | undefined {
    return extractProfilerIdFromResponse(response);
  }

  getDefaultParameters(): Omit<IProfilerTraceParameters, 'description'> {
    return { ...DEFAULT_PROFILER_TRACE_PARAMETERS };
  }
}
