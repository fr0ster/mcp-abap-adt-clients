/**
 * ClassExecutorLegacy — running a class on legacy SAP systems (SAP_BASIS 7.40, measured on 7.40 SP04).
 *
 * SAP_BASIS 7.40 SP04 has no `IF_OO_ADT_CLASSRUN` and answers
 * `/sap/bc/adt/oo/classrun` with 404 (measured), so `run` and
 * `runWithProfiler` are refused without a request. The trace catalogues
 * `…/abaptraces/objecttypes` and `/processtypes` are not advertised by 7.40
 * and nothing measured them, so they are refused until measured. The trace
 * schedule (`listRequests`, `getRequestsByUri`, `scheduleTrace`) is kept: its
 * collections are advertised and inherited unchanged.
 */

import {
  type AdtPerformedBy,
  ClassExecutor,
  type ClassExecutorValues,
  type classExecutorDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IClassExecuteOptions,
  IClassExecuteWithProfilerOptions,
  IClassExecutionTarget,
} from '@mcp-abap-adt/interfaces-adt';
import {
  legacyRefusal,
  legacyUnmeasuredRefusal,
} from '../../core/shared/refusalLegacy';

const CLASSRUN = '/sap/bc/adt/oo/classrun';
const OBJECT_TYPES = '/sap/bc/adt/runtime/traces/abaptraces/objecttypes';
const PROCESS_TYPES = '/sap/bc/adt/runtime/traces/abaptraces/processtypes';

export class ClassExecutorLegacy<
  T extends ClassExecutorValues = ResultValuesOf<typeof classExecutorDocuments>,
> extends ClassExecutor<T, 'basis740'> {
  /** Refused without a request: 7.40 has no `IF_OO_ADT_CLASSRUN` and no classrun endpoint. */
  override async run<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'run'>,
    _target: IClassExecutionTarget,
    _options?: IClassExecuteOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return legacyRefusal<T['run'], E>('run', CLASSRUN);
  }

  /** Refused without a request, for the same reason as `run`. */
  override async runWithProfiler<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'class', 'profile'>,
    _target: IClassExecutionTarget,
    _options: IClassExecuteWithProfilerOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['run'], E>> {
    return legacyRefusal<T['run'], E>('runWithProfiler', CLASSRUN);
  }

  /** Refused until measured: 7.40 does not advertise the catalogue. */
  override async listObjectTypes<E extends IAdtError = IAdtError>(
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['types'], E>> {
    return legacyUnmeasuredRefusal<T['types'], E>(
      'listObjectTypes',
      OBJECT_TYPES,
    );
  }

  /** Refused until measured: 7.40 does not advertise the catalogue. */
  override async listProcessTypes<E extends IAdtError = IAdtError>(
    _options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['types'], E>> {
    return legacyUnmeasuredRefusal<T['types'], E>(
      'listProcessTypes',
      PROCESS_TYPES,
    );
  }
}
