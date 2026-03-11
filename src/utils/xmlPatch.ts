/**
 * XML patch utilities for read-modify-write update pattern.
 *
 * Instead of building XML from scratch (which loses unknown fields like abapLanguageVersion),
 * these helpers modify specific values in the original XML string obtained from GET.
 */

/**
 * Replace an XML attribute value.
 * Example: `adtcore:description="old"` → `adtcore:description="new"`
 */
export function patchXmlAttribute(
  xml: string,
  attrName: string,
  newValue: string,
): string {
  const regex = new RegExp(`${attrName}="[^"]*"`);
  return xml.replace(regex, `${attrName}="${escapeXmlAttr(newValue)}"`);
}

/**
 * Replace XML element text content.
 * Handles both `<tag>content</tag>` and self-closing `<tag/>`.
 */
export function patchXmlElement(
  xml: string,
  tagName: string,
  newValue: string,
): string {
  // Match <tag>...</tag> or <tag/> (self-closing)
  const regex = new RegExp(
    `<${tagName}>([^<]*)</${tagName}>|<${tagName}\\s*/>`,
  );
  if (newValue === '' || newValue === undefined) {
    return xml.replace(regex, `<${tagName}/>`);
  }
  return xml.replace(
    regex,
    `<${tagName}>${escapeXmlText(newValue)}</${tagName}>`,
  );
}

/**
 * Replace an XML attribute on a specific element.
 * Example: `<pak:superPackage adtcore:name="OLD"/>` → `<pak:superPackage adtcore:name="NEW"/>`
 */
export function patchXmlElementAttribute(
  xml: string,
  elementTag: string,
  attrName: string,
  newValue: string,
): string {
  const regex = new RegExp(`(<${elementTag}[^>]*?)${attrName}="[^"]*"`);
  return xml.replace(regex, `$1${attrName}="${escapeXmlAttr(newValue)}"`);
}

/**
 * Replace an entire XML block (from opening to closing tag) with new content.
 * Handles both `<tag>...</tag>` (including nested content) and self-closing `<tag/>`.
 */
export function patchXmlBlock(
  xml: string,
  tagName: string,
  newContent: string,
): string {
  const regex = new RegExp(
    `<${tagName}[\\s\\S]*?</${tagName}>|<${tagName}\\s*/>`,
  );
  return xml.replace(regex, newContent);
}

/**
 * Conditionally apply a patch only if value is defined.
 */
export function patchIf<T>(
  xml: string,
  value: T | undefined | null,
  patchFn: (xml: string, val: T) => string,
): string {
  if (value === undefined || value === null) return xml;
  return patchFn(xml, value);
}

/**
 * Extract raw XML string from response data.
 */
export function extractXmlString(data: unknown): string {
  if (typeof data === 'string') return data;
  return JSON.stringify(data);
}

/** Escape special characters for XML attribute values */
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape special characters for XML text content */
function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
