/**
 * Escape a value for safe interpolation into an XML attribute.
 * Covers all five attribute metacharacters (the existing per-module
 * escapers omit the apostrophe; this shared helper does not).
 */
export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
