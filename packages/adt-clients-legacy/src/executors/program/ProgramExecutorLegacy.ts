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
  type IProgramExecutorResults,
  ProgramExecutor,
  type programExecutorDocuments,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IProgramExecuteOptions,
  IProgramExecuteWithProfilerOptions,
  IProgramExecutionTarget,
} from '@mcp-abap-adt/interfaces-adt';
import { legacyUnmeasuredRefusal } from '../../core/shared/refusalLegacy';

const PROGRAMRUN = '/sap/bc/adt/programs/programrun';
const OBJECT_TYPES = '/sap/bc/adt/runtime/traces/abaptraces/objecttypes';
const PROCESS_TYPES = '/sap/bc/adt/runtime/traces/abaptraces/processtypes';

export class ProgramExecutorLegacy<
  R extends IProgramExecutorResults = typeof programExecutorDocuments,
> extends ProgramExecutor<R, 'basis740'> {
  /** Refused without a request until measured: 7.40 does not advertise `programrun`. */
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'run'>,
    _target: IProgramExecutionTarget,
    _options?: IProgramExecuteOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return legacyUnmeasuredRefusal<ReturnType<R['run']>, E>('run', PROGRAMRUN);
  }

  /** Refused without a request, for the same reason as `run`. */
  override async runWithProfiler<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'program', 'profile'>,
    _target: IProgramExecutionTarget,
    _options: IProgramExecuteWithProfilerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['run']>, E>> {
    return legacyUnmeasuredRefusal<ReturnType<R['run']>, E>(
      'runWithProfiler',
      PROGRAMRUN,
    );
  }

  /** Refused until measured: 7.40 does not advertise the catalogue. */
  override async listObjectTypes<E extends IAdtError = IAdtError>(
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return legacyUnmeasuredRefusal<ReturnType<R['types']>, E>(
      'listObjectTypes',
      OBJECT_TYPES,
    );
  }

  /** Refused until measured: 7.40 does not advertise the catalogue. */
  override async listProcessTypes<E extends IAdtError = IAdtError>(
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['types']>, E>> {
    return legacyUnmeasuredRefusal<ReturnType<R['types']>, E>(
      'listProcessTypes',
      PROCESS_TYPES,
    );
  }
}
