/**
 * A validation that says no inside a 200.
 *
 * `validate()` asks one question about a name — is it admissible, and is
 * something there already — and the answer arrives two ways. Most types refuse
 * with a failing status, which needs no strategy. Some answer `200` carrying
 * the verdict in the body:
 *
 * ```xml
 * <asx:abap><asx:values><DATA>
 *   <SEVERITY>ERROR</SEVERITY>
 *   <SHORT_TEXT>Data definition ZAC_X already exists</SHORT_TEXT>
 * </DATA></asx:values></asx:abap>
 * ```
 *
 * Measured across seven types: a domain, a structure, a table, a class and a
 * service definition all refuse a taken name with a `400`; a function group and
 * a DDL source answer `200` with `SEVERITY=ERROR`. Only the function group was
 * reading it, so a DDL `validate()` answered "fine" for a name the system had
 * already rejected — and a caller who validates before creating was told to go
 * ahead.
 *
 * Conservative on purpose: a `200` without `<SEVERITY>ERROR</SEVERITY>` stays a
 * success, so this is safe as the default for every type, including those whose
 * validation answers some other shape entirely.
 */

import type {
  AdtNoFailure,
  IAdtError,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { requestOf } from './requestTrace';

/**
 * `Kerberos library not loaded` is what a trial system answers when it cannot
 * reach its own authentication library. It says nothing about the name being
 * validated, and it arrived on validations that were otherwise fine, so it is
 * cleared rather than reported. A consumer who disagrees passes their own
 * `analyse`.
 */
const UNRELATED = /kerberos library not loaded/i;

export const validationRefusal = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  const document = String(answer?.data ?? '');

  if (verdict !== ADT_NO_FAILURE) {
    return UNRELATED.test(`${verdict.message} ${document}`)
      ? ADT_NO_FAILURE
      : verdict;
  }

  if (!/<SEVERITY>ERROR<\/SEVERITY>/.test(document)) return ADT_NO_FAILURE;

  return {
    origin: 'refusal',
    message:
      /<SHORT_TEXT>([^<]+)<\/SHORT_TEXT>/.exec(document)?.[1] ??
      'Validation failed',
    response: answer,
    request: requestOf(answer),
  };
};
