/**
 * The settings document a patch reads, parsed into the typed settings it
 * overlays — the library's own reading, for the patch alone (a caller's
 * reading of `readMetadata` is a strategy's: `tableSettings` in
 * `@mcp-abap-adt/adt-strategies`).
 *
 * **Every setting the write needs, or nothing.** The patch writes the whole
 * document back, and SAP resets a setting the document leaves out
 * (`CL_TABT_WB_PERSIST->move_adt_to_ddv`, Code on both systems; measured on
 * both, 2026-11-19), so an element this reading cannot find is no value it
 * may invent: it answers `undefined`, and the patch writes nothing. Values are
 * read as SAP wrote them — entities and character references decoded, nothing
 * trimmed.
 */

import type { ITableSettingsRead } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';

/** The settings document, read: its description and every setting. */
export interface ITableSettingsDocumentRead {
  readonly description: string;
  readonly settings: ITableSettingsRead;
}

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

function isElement(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function field(node: unknown, key: string): unknown {
  return isElement(node) ? node[key] : undefined;
}

/** An element's text: `''` when empty, `undefined` when absent. */
function text(node: unknown, key: string): string | undefined {
  const value = field(node, key);
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (isElement(value)) {
    const inner = value['#text'];
    return typeof inner === 'string' ? inner : '';
  }
  return undefined;
}

function attribute(node: unknown, key: string): string | undefined {
  const value = field(node, `@_${key}`);
  return typeof value === 'string' ? value : undefined;
}

function flag(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function count(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  for (const character of value) {
    if (character < '0' || character > '9') return undefined;
  }
  return Number(value);
}

/**
 * The settings document's text, read; `undefined` when an element or
 * attribute a write needs is missing or not of its kind.
 */
export function readSettingsDocument(
  xml: string,
): ITableSettingsDocumentRead | undefined {
  const root = field(parser.parse(xml), 'tableSettings');
  const buffering = field(root, 'buffering');
  const translation = field(root, 'translation');
  const description = attribute(root, 'description');
  const dataClassCategory = text(root, 'dataClassCategory');
  const sizeCategory = text(root, 'sizeCategory');
  const allowed = text(buffering, 'allowed');
  const type = text(buffering, 'type');
  const areaKeyFields = count(text(buffering, 'areaKeyFields'));
  const storageType = text(root, 'storageType');
  const sharingType = text(root, 'sharingType');
  const loadUnit = text(root, 'loadUnit');
  const value = attribute(translation, 'value');
  const isVisible = flag(attribute(translation, 'isVisible'));
  const isEditable = flag(attribute(translation, 'isEditable'));
  const granularity = attribute(translation, 'granularity');
  const loggingEnabled = flag(text(root, 'loggingEnabled'));
  const amdpText = text(root, 'isWritableByAMDP');
  const isWritableByAMDP = flag(amdpText);
  if (
    description === undefined ||
    dataClassCategory === undefined ||
    sizeCategory === undefined ||
    allowed === undefined ||
    type === undefined ||
    areaKeyFields === undefined ||
    storageType === undefined ||
    sharingType === undefined ||
    loadUnit === undefined ||
    value === undefined ||
    isVisible === undefined ||
    isEditable === undefined ||
    granularity === undefined ||
    loggingEnabled === undefined ||
    (amdpText !== undefined && isWritableByAMDP === undefined)
  ) {
    return undefined;
  }
  return {
    description,
    settings: {
      dataClassCategory,
      sizeCategory,
      buffering: { allowed, type, areaKeyFields },
      storageType,
      sharingType,
      loadUnit,
      translation: { value, isVisible, isEditable, granularity },
      loggingEnabled,
      ...(isWritableByAMDP === undefined ? {} : { isWritableByAMDP }),
    },
  };
}
