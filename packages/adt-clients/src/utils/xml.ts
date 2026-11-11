/**
 * The one escaping every XML body this library writes goes through: element
 * text by {@link escapeXmlText}, an attribute value by {@link escapeXmlAttr}.
 * Both work one character at a time — no regular expression. A value that is
 * cut to a length (a description to 60 characters) is cut first and escaped
 * after, so a reference is never cut in two.
 *
 * A conforming XML parser hands its application a literal CR or CR LF as LF
 * (XML 1.0 §2.11), and a literal LF, tab or CR in an attribute value as a
 * space (§3.3.3); written as character references they reach the reader as
 * given.
 */

/** A character's reference, or `undefined` when text writes it as it is. */
function textReference(character: string): string | undefined {
  switch (character) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    case '\r':
      return '&#13;';
    default:
      return undefined;
  }
}

/** A character's reference in an attribute value, either quote delimiting it. */
function attributeReference(character: string): string | undefined {
  switch (character) {
    case '"':
      return '&quot;';
    case "'":
      return '&apos;';
    case '\n':
      return '&#10;';
    case '\t':
      return '&#9;';
    default:
      return textReference(character);
  }
}

function escapeWith(
  value: string,
  reference: (character: string) => string | undefined,
): string {
  let escaped = '';
  for (const character of value) {
    escaped += reference(character) ?? character;
  }
  return escaped;
}

/** Element text: `&`, `<`, `>` and CR (`&#13;`); LF and tab stay as they are. */
export function escapeXmlText(value: string): string {
  return escapeWith(value, textReference);
}

/**
 * An attribute value, delimited by either quote: `&`, `<`, `>`, `"`, `'`, and
 * LF, tab and CR (`&#10;`, `&#9;`, `&#13;`).
 */
export function escapeXmlAttr(value: string): string {
  return escapeWith(value, attributeReference);
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
 * The language a create states: the config's when it gives one, else the
 * client's system context's, else none — one rule for every create. A blank
 * value is no value, so a blank config falls through to the context.
 */
export function createLanguage(
  configured: string | undefined,
  context: string | undefined,
): string | undefined {
  return givenLanguage(configured) ?? givenLanguage(context);
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
