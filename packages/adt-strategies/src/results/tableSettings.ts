import type {
  IResultStrategy,
  ITableSettingsRead,
  ITableSettingsReadOf,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { field, isElement, leafText } from '../parsed';

/**
 * A table's technical settings (`TABL/DTT`), read from the document
 * `getTableSettings().readMetadata` answers — `ts:tableSettings`, transformation
 * `SDDIC_ADT_TTAB`.
 *
 * **Every setting a write needs, or a throw naming the one missing.** The
 * settings write replaces every DD09L field the transformation maps
 * (`move_adt_to_ddv`, Code on both systems), so a reading that filled an
 * absent element with a value of its own would hand the caller a value SAP
 * never sent, and the write would store it. A text element that is present
 * but empty (`<ts:sharingType/>`) is `''`; an empty boolean or count throws,
 * as one that is not `true`/`false` or not a count; an absent one throws,
 * naming it. Our own reading failing on a document is ours: the library runs
 * a result strategy outside its catch for that reason.
 *
 * Read beside the settings: `version`, and the cloud's `isWritableByAMDP`
 * (absent on premise, whose transformation does not define it, Code), which
 * a write now carries back. `supportsLoggingAssessment`, which both recorded
 * reads carry and the transformation only writes, is not read.
 */

/** The settings document, read. */
export interface ITableSettingsDocument {
  /** `adtcore:name`. */
  name: string;
  /**
   * `adtcore:description`, which a write must carry (SWB_TOOL 019 without
   * it, measured on both).
   */
  description: string;
  /**
   * `adtcore:version`: `active` and `inactive` in the recorded reads; `new`
   * answered right after the table's creation (measured on both).
   */
  version: string;
  settings: ITableSettingsRead;
}

/** {@link ITableSettingsDocument}, and the ETag the read answered. */
export interface ITableSettingsAnswer extends ITableSettingsDocument {
  /** The `ETag` header, for `ifMatch`; `undefined` when the answer had none. */
  etag: string | undefined;
}

// Values are read as SAP wrote them: not trimmed (a translation value or a
// description may begin or end with a space, and a write must send it back as
// it was), and with every reference decoded — the predefined entities and the
// character references (`&#xE9;`), in attributes and in text.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
});

/** A header's value whatever the case of its name (`etag`, `ETag`). */
function headerValue(
  headers: Readonly<Record<string, unknown>> | undefined,
  name: string,
): string | undefined {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (
      key.toLowerCase() === name &&
      typeof value === 'string' &&
      value !== ''
    ) {
      return value;
    }
  }
  return undefined;
}

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
  return {
    ...readTableSettings(typeof answer.data === 'string' ? answer.data : ''),
    etag: headerValue(answer.headers, 'etag'),
  };
};

/**
 * {@link ITableSettingsAnswer} of a cloud read: the settings carry
 * `isWritableByAMDP` as a `boolean`, so they go back to a cloud client's
 * write as they are (`ITableSettingsUpdateConfig<'cloud'>`).
 */
export interface ICloudTableSettingsAnswer
  extends Omit<ITableSettingsAnswer, 'settings'> {
  settings: ITableSettingsReadOf<'cloud'>;
}

/**
 * {@link tableSettings} for a cloud system: a read without
 * `ts:isWritableByAMDP` is an incomplete answer and throws, naming it. The
 * cloud answered it on every read measured, and writes it from the document
 * (`move_adt_to_ddv`, Code); a write built from a read that lacked it would
 * reset it. On premise the element does not exist (Code): read it there with
 * {@link tableSettings}.
 */
export const cloudTableSettings: IResultStrategy<ICloudTableSettingsAnswer> = (
  answer,
) => {
  const read = tableSettings(answer);
  const { isWritableByAMDP, ...settings } = read.settings;
  if (isWritableByAMDP === undefined) {
    throw new Error(
      'ts:tableSettings: ts:isWritableByAMDP is missing — a cloud read answers it',
    );
  }
  return { ...read, settings: { ...settings, isWritableByAMDP } };
};
