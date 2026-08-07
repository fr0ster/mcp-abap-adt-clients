/**
 * A patch that cannot find its target must say so.
 *
 * Written from a live failure. A full run reported
 * `update FAILED (HTTP 400): The description is missing for ZAC_DOM01` on a
 * domain whose description was in the configuration the whole time. The GET
 * before the PUT had come back empty — which ADT returns with HTTP 200, not an
 * error — so `patchXmlAttribute` had no `adtcore:description` to replace, and
 * `String.replace` handed the body back unchanged without a word. The PUT then
 * shipped without a description and the server rejected it.
 *
 * The varying response time of the ABAP system is the trigger and cannot be
 * fixed here. What these guard is the conversion: a slow read must surface as a
 * read error naming the object, not as a malformed write blamed on the server.
 */
import {
  extractXmlString,
  patchIf,
  patchXmlAttribute,
  patchXmlBlock,
  patchXmlElement,
  patchXmlElementAttribute,
  XmlPatchError,
} from '../../../utils/xmlPatch';

const DOMAIN_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<doma:wbobject xmlns:doma="http://www.sap.com/dictionary/domain" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZAC_DOM01" ' +
  'adtcore:description="old text">' +
  '<doma:typeInformation><doma:datatype>CHAR</doma:datatype>' +
  '<doma:length>5</doma:length></doma:typeInformation>' +
  '</doma:wbobject>';

describe('a patch applies or throws — it never passes the XML through', () => {
  it('patches the attribute when it is there', () => {
    const patched = patchXmlAttribute(
      DOMAIN_XML,
      'adtcore:description',
      'new text',
    );

    expect(patched).toContain('adtcore:description="new text"');
    expect(patched).not.toContain('old text');
  });

  it('throws instead of silently dropping the description', () => {
    // The exact shape that produced the live 400: a body with no description
    // to replace. Before this guard the call returned the input unchanged.
    const withoutDescription = '<doma:wbobject adtcore:name="ZAC_DOM01"/>';

    expect(() =>
      patchXmlAttribute(withoutDescription, 'adtcore:description', 'new text'),
    ).toThrow(XmlPatchError);
  });

  it('names the target it could not find', () => {
    expect(() => patchXmlAttribute('<a/>', 'adtcore:description', 'x')).toThrow(
      /adtcore:description/,
    );
  });

  it.each([
    ['element', () => patchXmlElement('<a/>', 'doma:datatype', 'CHAR')],
    [
      'element attribute',
      () => patchXmlElementAttribute('<a/>', 'pak:super', 'adtcore:name', 'X'),
    ],
    ['block', () => patchXmlBlock('<a/>', 'doma:typeInformation', '<b/>')],
  ])('throws for a missing %s too', (_label, call) => {
    expect(call).toThrow(XmlPatchError);
  });

  it('patches an element that ADT emits empty, rather than refusing it', () => {
    // `<doma:conversionExit/>` is what a domain with no conversion exit
    // actually returns — probed on a live system. The element is there; only
    // its content is not.
    expect(
      patchXmlElement(
        '<x><doma:conversionExit/></x>',
        'doma:conversionExit',
        'ALPHA',
      ),
    ).toContain('<doma:conversionExit>ALPHA</doma:conversionExit>');
  });

  it('leaves patchIf free to skip an absent value', () => {
    // `patchIf` is how a caller says "only if provided". Reaching a patch at
    // all means the change was intended, which is why the patch may throw.
    expect(patchIf(DOMAIN_XML, undefined, () => 'never')).toBe(DOMAIN_XML);
    expect(patchIf(DOMAIN_XML, null, () => 'never')).toBe(DOMAIN_XML);
  });
});

describe('setting an attribute on an element ADT left empty', () => {
  // Both shapes below were read from a live system. Refusing them would forbid
  // ever setting these for the first time — which is why this one patch adds
  // the attribute instead of throwing.
  it('adds a value table to a domain that has none', () => {
    const patched = patchXmlElementAttribute(
      '<doma:wbobject><doma:valueTableRef/></doma:wbobject>',
      'doma:valueTableRef',
      'adtcore:name',
      'ZAC_SHR_VTABL',
    );

    expect(patched).toContain(
      '<doma:valueTableRef adtcore:name="ZAC_SHR_VTABL"/>',
    );
  });

  it('adds a super package to a root package', () => {
    expect(
      patchXmlElementAttribute(
        '<pak:package><pak:superPackage/></pak:package>',
        'pak:superPackage',
        'adtcore:name',
        'ZLOCAL',
      ),
    ).toContain('<pak:superPackage adtcore:name="ZLOCAL"/>');
  });

  it('keeps the attributes the element already had', () => {
    const patched = patchXmlElementAttribute(
      '<pak:superPackage adtcore:uri="/sap/bc/adt/packages/zlocal"/>',
      'pak:superPackage',
      'adtcore:name',
      'ZLOCAL',
    );

    expect(patched).toContain('adtcore:uri="/sap/bc/adt/packages/zlocal"');
    expect(patched).toContain('adtcore:name="ZLOCAL"');
  });

  it('replaces the value when the attribute is already there', () => {
    expect(
      patchXmlElementAttribute(
        '<pak:superPackage adtcore:name="OLD"/>',
        'pak:superPackage',
        'adtcore:name',
        'ZLOCAL',
      ),
    ).toBe('<pak:superPackage adtcore:name="ZLOCAL"/>');
  });

  it('still throws when the element itself is missing', () => {
    // The partial-read case — the one this whole module exists to catch.
    expect(() =>
      patchXmlElementAttribute(
        '<pak:package/>',
        'pak:superPackage',
        'adtcore:name',
        'ZLOCAL',
      ),
    ).toThrow(/<pak:superPackage> is not present/);
  });
});

describe('the body of a read is checked before anything is patched into it', () => {
  it('accepts real XML', () => {
    expect(extractXmlString(DOMAIN_XML, 'domain ZAC_DOM01')).toBe(DOMAIN_XML);
  });

  it('rejects the empty body ADT returns for a not-yet-ready object', () => {
    expect(() => extractXmlString('', 'domain ZAC_DOM01')).toThrow(
      /empty body/,
    );
  });

  it('names the object, so the error says what could not be updated', () => {
    expect(() => extractXmlString('   ', 'domain ZAC_DOM01')).toThrow(
      /domain ZAC_DOM01/,
    );
  });

  it('rejects a non-string body instead of JSON-stringifying it', () => {
    // The old behaviour turned an object into `{"foo":"bar"}` and handed it on
    // as if it were XML: not a match for any patch, one step earlier than the
    // patches themselves.
    expect(() => extractXmlString({ foo: 'bar' }, 'domain ZAC_DOM01')).toThrow(
      XmlPatchError,
    );
    expect(() => extractXmlString(undefined, 'domain ZAC_DOM01')).toThrow(
      /undefined/,
    );
  });

  it('rejects a body that is not XML at all', () => {
    expect(() => extractXmlString('Service Unavailable', 'domain X')).toThrow(
      /not XML/,
    );
  });
});
