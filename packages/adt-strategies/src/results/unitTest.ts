import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';

/** A header's value, whether the transport gave a string or a list of them. */
function headerText(value: unknown): string {
  if (Array.isArray(value)) return value.length ? String(value[0]) : '';
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
  const headers = (answer.headers ?? {}) as Record<string, unknown>;
  const fromHeader =
    headerText(headers.location) ||
    headerText(headers['content-location']) ||
    headerText(headers['sap-adt-location']);
  const inHeader = /\/runs\/([^/]+)/.exec(fromHeader);
  if (inHeader) return inHeader[1];

  const data = answer.data;
  if (typeof data === 'string') {
    const uri =
      /<aunit:run[^>]*uri="([^"]+)"/.exec(data)?.[1] ??
      /uri="([^"]+)"/.exec(data)?.[1];
    const inBody = /\/runs\/([^/]+)/.exec(uri ?? '');
    if (inBody) return inBody[1];
  }
  return '';
};
