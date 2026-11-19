/**
 * The settings document a write sends, built from the caller's typed
 * settings (interfaces-adt 28.0.0, decision 49).
 *
 * **Every setting, every time.** SAP writes the whole DD09L row from the
 * document (`CL_TABT_WB_PERSIST`, `DDIF_TABT_PUT`), so the contract requires
 * every field, and every one is written here — nothing is defaulted and
 * nothing left out. The element order is the transformation's
 * (`SDDIC_ADT_TTAB`).
 *
 * **Never `ts:isWritableByAMDP`.** The cloud returns it; this contract does
 * not write it (unmeasured, and the on-premise transformation does not define
 * it). The serializer reads the fields it writes by name, so nothing a caller
 * passes beside them reaches the document.
 */

import type {
  ITableSettings,
  ITableSettingsUpdateConfig,
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

/** The `ts:*` elements, in the transformation's order. */
function settingsXml(settings: ITableSettings): string {
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
    `<ts:translation ts:value="${escapeXmlAttr(settings.translation)}"/>` +
    element('ts:loggingEnabled', String(settings.loggingEnabled))
  );
}

/**
 * `ts:tableSettings` for `config`: the table's name as `adtcore:name`, its
 * description as `adtcore:description` (SAP refuses a write without it,
 * SWB_TOOL 019), and every setting.
 */
export function tableSettingsDocument(
  config: ITableSettingsUpdateConfig,
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
