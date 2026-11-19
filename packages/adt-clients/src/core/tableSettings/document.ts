/**
 * The settings document a write sends, built from the caller's typed
 * settings (interfaces-adt 30.1.0, decision 49).
 *
 * **Every setting, every time.** SAP writes the whole DD09L row from the
 * document (`CL_TABT_WB_PERSIST->move_adt_to_ddv`, Code on both systems; a
 * field left out read back reset, measured on both), so the contract requires
 * every field, and every one is written here — nothing is defaulted and
 * nothing left out. The element order is the transformation's
 * (`SDDIC_ADT_TTAB`).
 *
 * **`ts:isWritableByAMDP` as given.** The cloud's `move_adt_to_ddv` writes it
 * from the document (Code, cloud), and a cloud PUT without it reset it to
 * `false` (measured): it is written whenever the settings carry it — a cloud
 * write requires it (`ITableSettingsOf<'cloud'>`), an on-premise one refuses
 * it, since nothing maps it there (Code). The serializer reads the fields it
 * writes by name, so nothing else a caller passes reaches the document.
 */

import type {
  ITableSettingsRead,
  ITableTranslation,
} from '@mcp-abap-adt/interfaces-adt';
import { escapeXmlAttr, escapeXmlText } from '../../utils/xml';

const TS = 'http://www.sap.com/dictionary/table/settings';
const ADTCORE = 'http://www.sap.com/adt/core';

/** An element with its text, `<x/>` when empty. */
function element(name: string, value: string): string {
  return value === ''
    ? `<${name}/>`
    : `<${name}>${escapeXmlText(value)}</${name}>`;
}

/**
 * `ts:translation` with its four attributes, in the transformation's order,
 * as the caller gives them — as read. The transformation reads the element
 * inside a `tt:cond` (Code, both systems): an absent element was accepted,
 * one written with an attribute missing was refused, 400 `00/001` with an
 * `XML_PATH` property (measured on both). SAP stores `value` alone
 * (`move_adt_to_ddv`, Code on both).
 */
function translationXml(translation: ITableTranslation): string {
  return (
    '<ts:translation' +
    ` ts:value="${escapeXmlAttr(translation.value)}"` +
    ` ts:isVisible="${String(translation.isVisible)}"` +
    ` ts:isEditable="${String(translation.isEditable)}"` +
    ` ts:granularity="${escapeXmlAttr(translation.granularity)}"/>`
  );
}

/** The `ts:*` elements, in the transformation's order. */
function settingsXml(settings: ITableSettingsRead): string {
  const { buffering } = settings;
  return (
    element('ts:dataClassCategory', settings.dataClassCategory) +
    element('ts:sizeCategory', settings.sizeCategory) +
    '<ts:buffering>' +
    element('ts:allowed', buffering.allowed) +
    element('ts:type', buffering.type) +
    element('ts:areaKeyFields', String(buffering.areaKeyFields)) +
    '</ts:buffering>' +
    element('ts:storageType', settings.storageType) +
    element('ts:sharingType', settings.sharingType) +
    element('ts:loadUnit', settings.loadUnit) +
    translationXml(settings.translation) +
    element('ts:loggingEnabled', String(settings.loggingEnabled)) +
    (settings.isWritableByAMDP === undefined
      ? ''
      : element('ts:isWritableByAMDP', String(settings.isWritableByAMDP)))
  );
}

/** What a document is built from: a write's config, or a patch's merge. */
export interface ITableSettingsDocumentInput {
  readonly tableName: string;
  readonly description: string;
  readonly settings: ITableSettingsRead;
}

/**
 * `ts:tableSettings` for `config`: the table's name as `adtcore:name`, its
 * description as `adtcore:description` (SAP refuses a write without it,
 * SWB_TOOL 019, measured on both), and every setting.
 */
export function tableSettingsDocument(
  config: ITableSettingsDocumentInput,
): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<ts:tableSettings xmlns:ts="${TS}" xmlns:adtcore="${ADTCORE}"` +
    ` adtcore:name="${escapeXmlAttr(config.tableName.toUpperCase())}"` +
    ' adtcore:type="TABL/DTT"' +
    ` adtcore:description="${escapeXmlAttr(config.description)}">` +
    settingsXml(config.settings) +
    '</ts:tableSettings>'
  );
}
