import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtHeaderMap, AdtHeaderValue } from '../headers';
import { aunitRunUri, quotedUri, runIdAfter } from '../scan';

/** A header's value, whether the transport gave a string or a list of them. */
function headerText(value: AdtHeaderValue): string {
  if (Array.isArray(value)) {
    const first: unknown = value[0];
    return value.length ? String(first) : '';
  }
  return typeof value === 'string' ? value : '';
}

/**
 * The id of a started unit-test run, read out of the answer.
 *
 * ADT does not put it in one place: the `Location`, `Content-Location` or
 * `sap-adt-location` header carries it, and the body's `aunit:run@uri` carries
 * it when none of them does. The recorded start (`unittest-run-passing`)
 * answers 201 with an empty body and the id in `Location`, which is why a
 * reading of the body alone finds nothing.
 *
 * Moved from adt-clients, where it was `run`'s default reading; the client now
 * answers the document as it arrived. An answer carrying no id reads as `''` —
 * whether that is a failure is `analyseUnitTestStart`'s question.
 */
export const unitTestRunId: IResultStrategy<string> = (
  answer: IAdtWireResponse,
) => {
  const headers: AdtHeaderMap = answer.headers ?? {};
  const fromHeader =
    headerText(headers.location) ||
    headerText(headers['content-location']) ||
    headerText(headers['sap-adt-location']);
  const inHeader = runIdAfter(fromHeader, '/runs/');
  if (inHeader !== undefined) return inHeader;

  const data = answer.data;
  if (typeof data === 'string') {
    const uri = aunitRunUri(data) ?? quotedUri(data);
    const inBody = runIdAfter(uri ?? '', '/runs/');
    if (inBody !== undefined) return inBody;
  }
  return '';
};
