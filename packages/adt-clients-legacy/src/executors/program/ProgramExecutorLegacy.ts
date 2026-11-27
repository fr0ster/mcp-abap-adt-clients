/**
 * ProgramExecutorLegacy — running a report on legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * `/sap/bc/adt/programs/programrun/{program}` is not advertised by SAP_BASIS
 * 7.40 SP04 and nothing measured it, so `run` and `runWithProfiler` are
 * refused without a request until measured; so are the trace catalogues
 * `…/abaptraces/objecttypes` and `/processtypes`. The trace schedule
 * (`listRequests`, `getRequestsByUri`, `scheduleTrace`) is kept: its
 * collections are advertised and inherited unchanged.
 */

import {
  type AdtPerformedBy,
  ProgramExecutor,
  type ProgramExecutorValues,
  type programExecutorDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
  IProgramExecuteOptions,
  IProgramExecuteWithProfilerOptions,
  IProgramExecutionTarget,
} from '@mcp-abap-adt/interfaces-adt';
import { legacyUnmeasuredRefusal } from '../../core/shared/refusalLegacy';

const PROGRAMRUN = '/sap/bc/adt/programs/programrun';
const OBJECT_TYPES = '/sap/bc/adt/runtime/traces/abaptraces/objecttypes';
const PROCESS_TYPES = '/sap/bc/adt/runtime/traces/abaptraces/processtypes';

export class ProgramExecutorLegacy<
  T extends ProgramExecutorValues = ResultValuesOf<
    typeof programExecutorDocuments
  >,
> extends ProgramExecutor<T, 'basis740'> {
  /** Refused without a request until measured: 7.40 does not advertise `programrun`. */
  override run<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'run'>,
    _target: IProgramExecutionTarget,
    _options: IProgramExecuteOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['run'], E | IAdtError>>;
  override run(
    this: this & AdtPerformedBy<'program', 'run'>,
    _target: IProgramExecutionTarget,
    _options?: IProgramExecuteOptions & IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['run'], IAdtError>>;
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'run'>,
    _target: IProgramExecutionTarget,
    _options?: IProgramExecuteOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E | IAdtError>> {
    return legacyUnmeasuredRefusal<T['run']>('run', PROGRAMRUN);
  }

  /** Refused without a request, for the same reason as `run`. */
  override runWithProfiler<E extends IAdtError>(
    this: this & AdtPerformedBy<'program', 'profile'>,
    _target: IProgramExecutionTarget,
    _options: IProgramExecuteWithProfilerOptions &
      IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['run'], E | IAdtError>>;
  override runWithProfiler(
    this: this & AdtPerformedBy<'program', 'profile'>,
    _target: IProgramExecutionTarget,
    _options: IProgramExecuteWithProfilerOptions &
      IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['run'], IAdtError>>;
  override async runWithProfiler<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'profile'>,
    _target: IProgramExecutionTarget,
    _options: IProgramExecuteWithProfilerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E | IAdtError>> {
    return legacyUnmeasuredRefusal<T['run']>('runWithProfiler', PROGRAMRUN);
  }

  /** Refused until measured: 7.40 does not advertise the catalogue. */
  override listObjectTypes<E extends IAdtError>(
    _options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['types'], E | IAdtError>>;
  override listObjectTypes(
    _options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['types'], IAdtError>>;
  override async listObjectTypes<E extends IAdtError = IAdtError>(
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['types'], E | IAdtError>> {
    return legacyUnmeasuredRefusal<T['types']>('listObjectTypes', OBJECT_TYPES);
  }

  /** Refused until measured: 7.40 does not advertise the catalogue. */
  override listProcessTypes<E extends IAdtError>(
    _options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['types'], E | IAdtError>>;
  override listProcessTypes(
    _options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['types'], IAdtError>>;
  override async listProcessTypes<E extends IAdtError = IAdtError>(
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['types'], E | IAdtError>> {
    return legacyUnmeasuredRefusal<T['types']>(
      'listProcessTypes',
      PROCESS_TYPES,
    );
  }
}
