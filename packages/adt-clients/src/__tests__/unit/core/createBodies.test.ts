/**
 * What a create writes into its XML attributes, and the language it states.
 *
 * Escaping: every value a create interpolates into an attribute is escaped —
 * the description (after its 60-character cut, so an entity is never cut in
 * two), the object's name, its package and what it refers to, the responsible
 * person and the master system. A value with `&`, `<`, `"` or `'` read back
 * through an XML parser is the value given, and the body stays well-formed.
 *
 * Language (fr0ster/mcp-abap-adt#348): SAP takes a new object's original
 * language from the request's logon language and ignores the body's
 * `adtcore:masterLanguage` (measured on ABAP cloud, 2026-11-04: logon EN
 * with a body in DE made an EN object, and `sap-language: DE` on the POST
 * alone made a DE one). So a create given a language writes it in the body
 * and sends it as `sap-language`, one value; a create given none writes no
 * language attribute and sends no header — SAP then uses the logon language
 * (measured on the cloud: a class body with neither attribute answered 200,
 * and the class read back in the logon language).
 */

import {
  attributeValues,
  CREATES,
  type CreateCase,
  headerOf,
  OTHER_LANGUAGE_CREATES,
  sent,
  wellFormed,
} from './createBodyCases';

const HOSTILE = `R&D <"x"> 'y'`;

/** A value read back from the body, compared without case: some creates upper-case names. */
function readsBack(body: string, value: string): boolean {
  const wanted = value.toUpperCase();
  return attributeValues(body).some((v) => v.toUpperCase() === wanted);
}

describe.each(CREATES.map((c): [string, CreateCase] => [c.label, c]))(
  '%s create escapes what it writes',
  (_label, create) => {
    if (create.description) {
      it('the description', async () => {
        const { body } = await sent(create, { description: HOSTILE });
        expect(wellFormed(body)).toBe(true);
        expect(readsBack(body, HOSTILE)).toBe(true);
      });

      it('a description cut at 60 characters on a character that escapes', async () => {
        // The 60th character is the `<`: escaped before the cut, the entity
        // would be cut to `&l`; escaped after, it is whole.
        const long = `${'a'.repeat(59)}<bcdef`;
        const { body } = await sent(create, { description: long });
        expect(wellFormed(body)).toBe(true);
        expect(readsBack(body, `${'a'.repeat(59)}<`)).toBe(true);
      });
    }

    it('the name and the package', async () => {
      const name = `Z&<"'N`;
      const packageName = `Z&<"'P`;
      const { body } = await sent(create, { name, packageName });
      expect(wellFormed(body)).toBe(true);
      expect(readsBack(body, name)).toBe(true);
      if (!create.noPackage) {
        expect(readsBack(body, packageName)).toBe(true);
      }
    });

    if (create.reference) {
      it('what it refers to', async () => {
        const reference = `Z&<"'R`;
        const { body } = await sent(create, { reference });
        expect(wellFormed(body)).toBe(true);
        expect(readsBack(body, reference)).toBe(true);
      });
    }

    if (create.person) {
      it('the responsible person and the master system', async () => {
        const responsible = `P&<"'U`;
        const masterSystem = `S&<"'Y`;
        const { body } = await sent(create, { responsible, masterSystem });
        expect(wellFormed(body)).toBe(true);
        expect(readsBack(body, masterSystem)).toBe(true);
        if (create.label !== 'class') {
          // A class create sends no responsible (createCarriesResponsible).
          expect(readsBack(body, responsible)).toBe(true);
        }
      });
    }
  },
);

const LANGUAGE_CREATES = [...CREATES, ...OTHER_LANGUAGE_CREATES].filter(
  (c) => c.language,
);

/** The language attributes a body carries, by name. */
function languageAttributes(body: string): string[] {
  const found: string[] = [];
  for (const name of ['adtcore:language=', 'adtcore:masterLanguage=']) {
    let from = body.indexOf(name);
    while (from !== -1) {
      const start = from + name.length + 1;
      found.push(`${name}${body.slice(start, body.indexOf('"', start))}`);
      from = body.indexOf(name, start);
    }
  }
  return found;
}

describe.each(LANGUAGE_CREATES.map((c): [string, CreateCase] => [c.label, c]))(
  '%s create states its language once',
  (_label, create) => {
    it('given a language: in the body and as sap-language, the same value', async () => {
      const { request, body } = await sent(create, { masterLanguage: 'DE' });
      expect(headerOf(request, 'sap-language')).toBe('DE');
      expect(languageAttributes(body)).toEqual([
        'adtcore:language=DE',
        'adtcore:masterLanguage=DE',
      ]);
    });

    it('given none: no language attribute and no header', async () => {
      const { request, body } = await sent(create, {});
      expect(headerOf(request, 'sap-language')).toBeUndefined();
      expect(languageAttributes(body)).toEqual([]);
    });
  },
);
