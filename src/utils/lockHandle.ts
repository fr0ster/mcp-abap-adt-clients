import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import { headerValueToString } from './internalUtils';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // A handle is an opaque token: kept exactly as SAP wrote it.
  parseTagValue: false,
  parseAttributeValue: false,
});

/**
 * The lock handle a LOCK answered.
 *
 * Not a result strategy a caller chooses: `IAdtLockable.lock` answers the
 * handle, a `string`, because `update` and `unlock` must be given it — the
 * contract fixes the shape, so reading it is this implementation's job.
 *
 * Where it is: the `sap-adt-lm-handle` header on a function group, and
 * `asx:abap/asx:values/DATA/LOCK_HANDLE` in the body everywhere else. **An
 * answer carrying neither reads as `''`, not a throw.** Until 23.0.0 every lock
 * function threw "Failed to obtain lock handle" — a sentence about SAP's
 * answer, raised as if the library had failed, which reached the caller as a
 * connection error with the answer gone. Whether a handle-less 200 is a
 * refusal is the caller's `analyse` to say; the answer is in the response.
 */
export const lockHandleOf: IResultStrategy<string> = (
  answer: IAdtWireResponse,
) => {
  const fromHeader = headerValueToString(answer.headers?.['sap-adt-lm-handle']);
  if (fromHeader) return fromHeader;
  if (typeof answer.data !== 'string' || answer.data.trim() === '') return '';
  try {
    const handle = parser.parse(answer.data)?.['asx:abap']?.['asx:values']?.DATA
      ?.LOCK_HANDLE;
    return typeof handle === 'string' ? handle : '';
  } catch {
    return '';
  }
};
