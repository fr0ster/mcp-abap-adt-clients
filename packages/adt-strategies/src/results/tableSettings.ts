import type {
  IResultStrategy,
  ITableSettingsRead,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { field, isElement, leafText } from '../parsed';

/**
 * A table's technical settings (`TABL/DTT`), read from the document
 * `getTableSettings().readMetadata` answers — `ts:tableSettings`, transformation
 * `SDDIC_ADT_TTAB`.
 *
 * **Every setting a write needs, or a throw naming the one missing.** The
 * settings write replaces the whole DD09L row, so a reading that filled an
 * absent element with a value of its own would hand the caller a value SAP
 * never sent, and the write would store it. An element that is present but
 * empty (`<ts:sharingType/>`) is `''`; one that is absent throws, naming it.
 * Our own reading failing on a document is ours: the library runs a result
 * strategy outside its catch for that reason.
 *
 * What only a read returns is read too: `isWritableByAMDP` (the cloud's;
 * absent on premise) on the settings, `version` beside them.
 * `supportsLoggingAssessment`, which SAP computes on every read, is not read.
 */

/** The settings document, read. */
export interface ITableSettingsDocument {
  /** `adtcore:name`. */
  name: string;
  /** `adtcore:description`: the table's short text, which a write must carry. */
  description: string;
  /** `adtcore:version`: `active`, `inactive` or `new`. */
  version: string;
  settings: ITableSettingsRead;
}

/** {@link ITableSettingsDocument}, and the ETag the read answered. */
export interface ITableSettingsAnswer extends ITableSettingsDocument {
  /** The `ETag` header, for `ifMatch`; `undefined` when the answer had none. */
  etag: string | undefined;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

/** A child element's text: `''` when empty, a throw naming it when absent. */
function text(node: unknown, key: string): string {
  const value = field(node, key);
  if (value === undefined || value === null) {
    throw new Error(`ts:tableSettings: ts:${key} is missing`);
  }
  if (isElement(value)) return leafText(field(value, '#text')) ?? '';
  return leafText(value) ?? '';
}

/** An attribute's value: a throw naming it when absent. */
function attribute(node: unknown, key: string, where: string): string {
  const value = leafText(field(node, `@_${key}`));
  if (value === undefined) {
    throw new Error(`ts:tableSettings: ${where}/@${key} is missing`);
  }
  return value;
}

/** `true` / `false`, as the transformation writes an `xsdboolean`. */
function flag(value: string, where: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(
    `ts:tableSettings: ${where} is '${value}', not true or false`,
  );
}

/** A count, as the document writes it. */
function count(value: string, where: string): number {
  const parsed = Number(value);
  if (value.trim() === '' || !Number.isInteger(parsed)) {
    throw new Error(`ts:tableSettings: ${where} is '${value}', not a count`);
  }
  return parsed;
}

/** The settings document's text, read. */
export function readTableSettings(xml: string): ITableSettingsDocument {
  const root = field(parser.parse(xml), 'tableSettings');
  if (!isElement(root)) {
    throw new Error('the answer is no ts:tableSettings document');
  }
  const buffering = field(root, 'buffering');
  if (!isElement(buffering)) {
    throw new Error('ts:tableSettings: ts:buffering is missing');
  }
  const translation = field(root, 'translation');
  if (!isElement(translation)) {
    throw new Error('ts:tableSettings: ts:translation is missing');
  }
  const amdp = field(root, 'isWritableByAMDP');
  const settings: ITableSettingsRead = {
    dataClassCategory: text(root, 'dataClassCategory'),
    sizeCategory: text(root, 'sizeCategory'),
    buffering: {
      allowed: text(buffering, 'allowed'),
      type: text(buffering, 'type'),
      areaKeyFields: count(
        text(buffering, 'areaKeyFields'),
        'ts:buffering/ts:areaKeyFields',
      ),
    },
    storageType: text(root, 'storageType'),
    sharingType: text(root, 'sharingType'),
    loadUnit: text(root, 'loadUnit'),
    translation: {
      value: attribute(translation, 'value', 'ts:translation'),
      isVisible: flag(
        attribute(translation, 'isVisible', 'ts:translation'),
        'ts:translation/@isVisible',
      ),
      isEditable: flag(
        attribute(translation, 'isEditable', 'ts:translation'),
        'ts:translation/@isEditable',
      ),
      granularity: attribute(translation, 'granularity', 'ts:translation'),
    },
    loggingEnabled: flag(text(root, 'loggingEnabled'), 'ts:loggingEnabled'),
    ...(amdp === undefined
      ? {}
      : {
          isWritableByAMDP: flag(
            text(root, 'isWritableByAMDP'),
            'ts:isWritableByAMDP',
          ),
        }),
  };
  return {
    name: attribute(root, 'name', 'ts:tableSettings'),
    description: attribute(root, 'description', 'ts:tableSettings'),
    version: attribute(root, 'version', 'ts:tableSettings'),
    settings,
  };
}

/** `getTableSettings().readMetadata`'s answer, read, with its ETag. */
export const tableSettings: IResultStrategy<ITableSettingsAnswer> = (
  answer,
) => {
  const etag = answer.headers?.etag;
  return {
    ...readTableSettings(typeof answer.data === 'string' ? answer.data : ''),
    etag: typeof etag === 'string' && etag !== '' ? etag : undefined,
  };
};
