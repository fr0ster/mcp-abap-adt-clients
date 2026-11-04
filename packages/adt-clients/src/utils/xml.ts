/**
 * Escape a value for safe interpolation into an XML attribute.
 *
 * Covers all five attribute metacharacters, one character at a time — no
 * regular expression. A value that is cut to a length (a description to 60
 * characters) is cut first and escaped after, so an entity is never cut in two.
 */
export function escapeXmlAttr(value: string): string {
  let escaped = '';
  for (const character of value) {
    switch (character) {
      case '&':
        escaped += '&amp;';
        break;
      case '<':
        escaped += '&lt;';
        break;
      case '>':
        escaped += '&gt;';
        break;
      case '"':
        escaped += '&quot;';
        break;
      case "'":
        escaped += '&apos;';
        break;
      default:
        escaped += character;
    }
  }
  return escaped;
}

/**
 * The language a create was given, or `undefined` when it was given none.
 *
 * An empty or blank value is none: SAP then takes the request's logon
 * language, which is what a create without a language means.
 */
export function givenLanguage(
  language: string | undefined,
): string | undefined {
  const trimmed = language?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * A create body's language attributes: `adtcore:language` and
 * `adtcore:masterLanguage`, both the given language, with a leading space —
 * or nothing when no language was given.
 *
 * SAP takes a new object's original language from the request's logon
 * language, not from these attributes (measured on ABAP cloud,
 * 2026-11-04), so a create given a language also sends it as `sap-language`
 * (`createRequestHeaders`). Without a language neither is written and SAP
 * uses the logon language: the cloud answered a class create with neither
 * attribute `200`, and the class read back in the logon language.
 */
export function languageAttributes(language: string | undefined): string {
  const given = givenLanguage(language);
  if (given === undefined) return '';
  const value = escapeXmlAttr(given);
  return ` adtcore:language="${value}" adtcore:masterLanguage="${value}"`;
}
