/**
 * A description over the limit: what the type's suite writes, and what SAP
 * answers for it.
 *
 * The shipped patches pass a description as given — no truncation, no check
 * of its length — and SAP's answer reaches the caller as it is. What SAP
 * answers depends on the type, and is the same on the cloud and on premise
 * (measured 2026-11-11, ten characters over the limit):
 *
 * - domain, data element, table type, package: `400 ExceptionInvalidData`,
 *   T100 `SWB_TOOL` `018` "The description is too long. Maximum length: 60
 *   characters", the limit as its value, subtype `src_prop_decr_too_long`;
 *   nothing is stored ({@link swbToolTooLong});
 * - function group: `400`, T100 `FUNC_ADT` `103` "Description of <group>
 *   longer than 40 characters.", the group and the limit as its values;
 *   nothing is stored;
 * - message class: the write is accepted, and SAP stores the first 60
 *   characters.
 */
import type { IAdtMessageFailure } from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { expectFailure } from './contract';

/** `text` cut or padded with dots to exactly `length` characters. */
export function descriptionOfLength(text: string, length: number): string {
  return text.padEnd(length, '.').slice(0, length);
}

/**
 * A description ten characters over `limit`, its first `limit` characters
 * unlike any the suites store: a system that kept a truncated one shows it
 * in the read-back.
 */
export function overTheLimit(limit: number): string {
  return descriptionOfLength('Over the limit, passed as given', limit + 10);
}

/** The T100 key of a refusal: its class, number and values. */
export interface IT100Key {
  readonly id: string;
  readonly no: string;
  readonly values: ReadonlyArray<string>;
}

/** The refusal of a domain's, data element's, table type's or package's. */
export function swbToolTooLong(limit: number): IT100Key {
  return { id: 'SWB_TOOL', no: '018', values: [String(limit)] };
}

/** SAP's refusal of a description over the limit: a `400` with `key`. */
export function expectDescriptionRefused(
  answer: IAdtResponse<unknown, IAdtMessageFailure>,
  key: IT100Key,
): void {
  const failure = expectFailure(answer, 'a description over the limit');
  expect(failure.response?.status).toBe(400);
  expect(failure.messages.map((message) => message.t100)).toContainEqual(key);
}
