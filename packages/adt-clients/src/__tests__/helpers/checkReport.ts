/**
 * What a `check` answered, as the report it is — or the failure it is.
 *
 * A refusal reaches a check two ways: as a returned failure, and as an ADT
 * exception document inside an HTTP 200 (measured: the `S_ABPLNGVS`
 * language-version refusal arrives either way). Both are failures here, with
 * what SAP said. Whether a check can run on a system is the configuration's
 * to say — the case's `enabled` / `available_in` at registration — never
 * something read off a refusal, so neither shape is a skip.
 */

import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { expectResult } from './contract';

/** The `exc:exception` document's type and text, when the body is one. */
export function exceptionDocumentIn(body: string): string | undefined {
  if (!body.includes('exception')) return undefined;
  let parsed: Record<string, unknown>;
  try {
    parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    }).parse(body);
  } catch {
    return undefined;
  }
  const rootKey = Object.keys(parsed).find(
    (key) => key === 'exception' || key.endsWith(':exception'),
  );
  if (!rootKey) return undefined;
  const root = parsed[rootKey] as Record<string, any>;
  const textOf = (node: unknown): string =>
    typeof node === 'string'
      ? node
      : String((node as { '#text'?: unknown })?.['#text'] ?? '');
  const type = String(root?.type?.['@_id'] ?? '');
  const text =
    textOf(root?.localizedMessage) ||
    textOf(root?.message) ||
    body.slice(0, 300);
  return type ? `${type}: ${text}` : text;
}

/**
 * The check report, failing the test on a returned failure and on an
 * exception document inside a success, each with what SAP said.
 *
 * @param answer what `check` answered
 * @param what a label for the call, so a failure names it
 */
export function expectCheckReport(
  answer: IAdtResponse<unknown>,
  what: string,
): string {
  const report = String(expectResult(answer, what) ?? '');
  const refusal = exceptionDocumentIn(report);
  if (refusal !== undefined) {
    throw new Error(`${what} was refused inside a 200: ${refusal}`);
  }
  return report;
}
