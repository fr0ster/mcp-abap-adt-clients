/**
 * A type code read from outside the type system — a test configuration, an
 * ADT answer — checked once against the ADT type tables.
 */
import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  type AdtSourceTypeCode,
  type AdtTypeCode,
} from '@mcp-abap-adt/interfaces-adt';
import type { AdtModernVariant } from '../../clients/variant';
import {
  type AdtActivationCode,
  type AdtMetadataReadCode,
  type AdtSourceReadCode,
  isMetadataReadCode,
  isSourceReadCode,
} from '../../core/shared/codeSets';
import { codeHas } from '../../endpoints/codes';

const CODES: ReadonlySet<string> = new Set(
  [ADT_TYPES_ONPREM, ADT_TYPES_CLOUD, ADT_TYPES_BASIS_740].flatMap((table) =>
    Object.values(table).flatMap((entry) => Object.keys(entry.codes)),
  ),
);

/** Whether `value` is a code of the tables. */
export function isAdtTypeCode(value: string): value is AdtTypeCode {
  return CODES.has(value);
}

/** `value` as a code of the tables; throws for any other text. */
export function adtTypeCode(value: string): AdtTypeCode {
  if (!isAdtTypeCode(value)) {
    throw new Error(`'${value}' is no code of the ADT type tables`);
  }
  return value;
}

/** Whether a table lists `source` for `code`. */
export function isSourceTypeCode(code: AdtTypeCode): code is AdtSourceTypeCode {
  return codeHas(code, 'source');
}

/** `value` as a code `readObjectSource` reads; throws for any other. */
export function sourceReadCode(value: string): AdtSourceReadCode {
  if (!isSourceReadCode(value)) {
    throw new Error(`readObjectSource reads no '${value}'`);
  }
  return value;
}

/** `value` as a code `readObjectMetadata` reads; throws for any other. */
export function metadataReadCode(value: string): AdtMetadataReadCode {
  if (!isMetadataReadCode(value)) {
    throw new Error(`readObjectMetadata reads no '${value}'`);
  }
  return value;
}

/** Whether `code` is one a modern group activation activates. */
function isActivationCode(
  code: AdtTypeCode,
): code is AdtActivationCode<AdtModernVariant> {
  return code !== 'MSAG/NN' && codeHas(code, 'activate');
}

/** `value` as a code a group activation activates; throws for any other. */
export function activationCode(
  value: string,
): AdtActivationCode<AdtModernVariant> {
  const code = adtTypeCode(value);
  if (!isActivationCode(code)) {
    throw new Error(`a group activation activates no '${value}'`);
  }
  return code;
}
