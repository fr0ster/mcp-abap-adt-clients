/**
 * The shapes an ABAP trace's views come back as.
 *
 * They left `@mcp-abap-adt/interfaces` in 31.0.0 with the other result shapes:
 * `IProfiler<TEntry, TViews>` says a profiler answers *something*, and what
 * that something looks like is this implementation's to name. Every one below
 * was read off a real trace document — see the notes on each.
 */

import type {
  IProfilerTraceDbAccessesOptions,
  IProfilerTraceHitListOptions,
  IProfilerTraceStatementsOptions,
  ITraceEntry,
  ITraceState,
  ITraceView,
} from '@mcp-abap-adt/interfaces';

export interface ITraceProgramRef {
  name: string;
  type: string;
  uri: string;
  context?: string;
  byteCodeOffset?: number;
  /** Present on a statement's calling program: a query URI, not a plain URI. */
  objectReferenceQuery?: string;
}

/**
 * `trc:grossTime` and `trc:traceEventNetTime`.
 *
 * Typed from measurement at last. These were `unknown` in 22.0.0 and 23.0.0
 * because the elements had been seen on every row while their attributes had
 * never been captured — the earlier reads were summarised into a table and the
 * bodies discarded. A raw capture settles it: both carry exactly these two, in
 * both the hit list and the statements, with no variant anywhere in the
 * documents read.
 *
 * The **unit of `time` is not established.** The wire says `time="243"` and
 * nothing about what 243 is; `percentage` is of the trace total, which is what
 * makes a row comparable without knowing the unit. Naming it `timeMicros` would
 * be inventing the one thing the measurement did not give.
 */
export interface ITraceTiming {
  /** `time` — the raw figure, in whatever unit the system reports. */
  time: number;
  /** `percentage` of the trace total. */
  percentage: number;
}

/** One row of the hit list. */
export interface IAbapTraceHitListEntry {
  /** Position in the top-down ordering, which is not `index`. */
  topDownIndex?: number;
  index: number;
  hitCount?: number;
  stackCount?: number;
  recursionDepth?: number;
  description?: string;
  /** What a statement's `hitlistAnchor` refers to. */
  proceduralEntryAnchor?: string;
  callingProgram?: ITraceProgramRef;
  calledProgram?: ITraceProgramRef;
  grossTime?: ITraceTiming;
}

/** `trc:hitlist`. */
export interface IAbapTraceHitList {
  entries: IAbapTraceHitListEntry[];
}

/** One traced statement. */
export interface IAbapTraceStatement {
  id: string;
  index: number;
  callLevel?: number;
  text?: string;
  variable?: string;
  package?: string;
  component?: string;
  componentDescription?: string;
  /** Points at a hit list entry's `proceduralEntryAnchor`. */
  hitlistAnchor?: string;
  isProcedureLike?: boolean;
  callingProgram?: ITraceProgramRef;
  grossTime?: ITraceTiming;
  traceEventNetTime?: ITraceTiming;
}

/** `trc:statements` — the large one. */
export interface IAbapTraceStatements {
  statements: IAbapTraceStatement[];
}

/**
 * `trc:accessTime`. Measured, unlike the other two timing elements.
 *
 * `total` splits into `applicationServer` and `database`, and
 * `ratioOfTraceTotal` says how much of the whole trace this one access was —
 * which is the number that finds the offender without reading every row.
 */
export interface IAbapTraceAccessTime {
  total?: number;
  applicationServer?: number;
  database?: number;
  ratioOfTraceTotal?: number;
}

/** One database access. */
export interface IAbapTraceDbAccess {
  index: number;
  tableName?: string;
  /** The SQL, as the trace recorded it. */
  statement?: string;
  type?: string;
  totalCount?: number;
  /** Served from the buffer rather than the database. */
  bufferedCount?: number;
  accessTime?: IAbapTraceAccessTime;
}

/** `trc:dbAccesses`. */
export interface IAbapTraceDbAccesses {
  accesses: IAbapTraceDbAccess[];
}

/**
 * A trace as the `abaptraces` feed describes it.
 *
 * {@link ITraceEntry} is what *every* family can say; this is what the ABAP
 * profiler actually sends, and all of it is transcribed from one raw feed —
 * sixty entries, every field present in every one of them, none of it outside
 * `trc:extendedData`.
 *
 * The fields are required because the wire carried them without exception in
 * the sample. That is a claim, and this is where it is recorded so a later
 * system that omits one can be met by relaxing the type rather than by
 * guessing what happened.
 *
 * Units are deliberately not asserted. `runtime` reads `554` and the document
 * says nothing more; `size` reads `8`. Naming them `runtimeMicros` or
 * `sizeBytes` would add precision the measurement does not contain.
 */
export interface IAbapTraceEntry extends ITraceEntry {
  /** `trc:user`. Also available as `atom:author/atom:name`. */
  user: string;
  /** `trc:objectName` — the generated form, e.g. `ZCL_SOMETHING=========CP`. */
  objectName: string;
  /** `trc:state` — `R`/Finished on every entry read. */
  state: ITraceState;
  /** `trc:expiration`. The system deletes traces; this says when. */
  expiresAt: string;

  /** `trc:system` — the three-character system id. */
  system: string;
  /** `trc:client`. A string: a client is a code, and `010` is not `10`. */
  client: string;
  /** `trc:host` — the application server that recorded it. */
  host: string;

  /** `trc:size`. Unit unstated by the document. */
  size: number;
  /** `trc:runtime`, and the three figures it divides into. Unit unstated. */
  runtime: number;
  runtimeABAP: number;
  runtimeSystem: number;
  runtimeDatabase: number;

  /** `trc:isAggregated` — whether the measurement was aggregated. */
  isAggregated: boolean;
  /** `trc:amdpFileSize`. Zero on every entry read; the field is still there. */
  amdpFileSize: number;
}

/**
 * The three views a profiler trace has, mapped to what each answers.
 *
 * `IProfiler<TEntry, TViews>` takes this as a type argument since 31.0.0: the
 * contract says a profiler has views, and this says which and what they hold.
 */
export interface IAbapTraceViews {
  hitlist: ITraceView<IAbapTraceHitList, IProfilerTraceHitListOptions>;
  statements: ITraceView<IAbapTraceStatements, IProfilerTraceStatementsOptions>;
  dbAccesses: ITraceView<IAbapTraceDbAccesses, IProfilerTraceDbAccessesOptions>;
}

/**
 * `trc:executions` — a request's budget and how much of it is spent.
 */
export interface ITraceExecutions {
  /** How many runs this request may measure. */
  maximal?: number;
  /** How many it has measured. */
  completed?: number;
}

/**
 * A scheduled trace request, as the server stores it.
 *
 * Transcribed from a created entry: the identifier, the two catalogue choices
 * echoed back as the same URIs the catalogues hand out, and the link to the
 * trace file once a run has produced one — which is how a scheduled request is
 * connected to the trace it eventually yields.
 *
 * Deliberately no shape for a *submitted* request: the stored entry is
 * measured, the submitted document is not.
 */
export interface ITraceRequestEntry {
  /** `atom:id` — the request's own URI. */
  id: string;
  /** `trc:requestIndex`. */
  index?: number;
  description?: string;
  /** `trc:expires`. A request that is never fulfilled does not live forever. */
  expiresAt?: string;
  isAggregated?: boolean;
  /** `trc:processTypeId`, a URI from `listProcessTypes()`. */
  processTypeId?: string;
  /** `trc:objectTypeId`, a URI from `listObjectTypes()`. */
  objectTypeId?: string;
  /** `trc:executions` — how many runs it may measure, and how many it has. */
  executions?: ITraceExecutions;
  /** The trace this request produced, when it has produced one. */
  traceUri?: string;
}
