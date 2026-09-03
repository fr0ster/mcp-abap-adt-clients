import type {
  IAbapConnection,
  IAbapTraceEntry,
  IAbapTraceViews,
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

export class Profiler implements IProfiler {
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
  async list(options?: IProfilerListOptions): Promise<IAbapTraceEntry[]> {
    return parseTraceEntries(await listTraceFiles(this.connection, options));
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
  async delete(traceId: string): Promise<void> {
    await deleteTrace(this.connection, traceId);
  }

  /**
   * The raw response for a view, before anything is made of it.
   *
   * Shared by {@link read} and {@link readWith}, so the two differ in exactly
   * one thing — who turns the document into a value — and cannot drift apart on
   * which URL or which options they send.
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
   * What is inside one trace, read the plain way.
   *
   * The mapping is deliberately plain: document onto the view's type, nothing
   * more. No filtering, no reshaping — those belong to the server, which has
   * endpoints for them, and to the caller, which has {@link readWith}.
   */
  async read<K extends keyof IAbapTraceViews>(
    traceId: string,
    view: K,
    ...args: ViewArgs<IAbapTraceViews, K>
  ): Promise<ViewResult<IAbapTraceViews, K>> {
    const [options] = args;
    const response = await this.viewResponse(traceId, view, options);
    switch (view) {
      case 'hitlist':
        return parseHitList(response) as ViewResult<IAbapTraceViews, K>;
      case 'statements':
        return parseStatements(response) as ViewResult<IAbapTraceViews, K>;
      case 'dbAccesses':
        return parseDbAccesses(response) as ViewResult<IAbapTraceViews, K>;
      default:
        throw new Error(`Unknown trace view: ${String(view)}`);
    }
  }

  /**
   * The same read, parsed by the caller.
   *
   * `parse` receives the response body exactly as it arrived. A consumer whose
   * system answers in a shape the default mapping does not fit passes its own
   * reader and keeps a type — it is not sent back to an untyped response, and
   * this library does not grow a second opinion about somebody else's XML.
   */
  async readWith<K extends keyof IAbapTraceViews, T>(
    parse: (data: unknown) => T,
    traceId: string,
    view: K,
    ...args: ViewArgs<IAbapTraceViews, K>
  ): Promise<T> {
    const [options] = args;
    return parse((await this.viewResponse(traceId, view, options)).data);
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
