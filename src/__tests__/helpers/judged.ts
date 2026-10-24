/**
 * A specific judge, with the exception document read first.
 *
 * adt-strategies' specific judges (`analyseActivation`, `analyseDeletion`,
 * `analyseValidation`, …) each read the one document form their member
 * answers with. An `exc:exception` arriving inside an HTTP 200 is none of
 * those forms, so each of them answers it as "no failure" — a refused
 * activation, deletion or validation then passes as done. `analyseException`
 * reads exactly that document. This runs it first and the specific judges
 * after, so a call that expects success fails on either.
 *
 * adt-strategies offers no composition of its own; this is the test side's.
 */

import {
  analyseException,
  type IAdtMessageFailure,
} from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type IAdtError,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';

export function judged<E extends IAdtError>(
  ...specific: IAnalyse<E>[]
): IAnalyse<IAdtMessageFailure | E> {
  return (verdict, answer) => {
    const first = analyseException(verdict, answer);
    if (first !== ADT_NO_FAILURE) return first;
    for (const judge of specific) {
      const next = judge(verdict, answer);
      if (next !== ADT_NO_FAILURE) return next;
    }
    return ADT_NO_FAILURE;
  };
}
