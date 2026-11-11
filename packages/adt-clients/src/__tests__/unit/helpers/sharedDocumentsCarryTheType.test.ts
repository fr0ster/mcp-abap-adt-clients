/**
 * A shared domain's update has to put the type IN the document.
 *
 * Written from a defect that shipped silently. `ensureSharedDependency` created
 * a domain — whose POST carries the description, the language and the package
 * reference and nothing else — and then "updated" it with a config holding
 * `datatype` and `length` as loose fields. Since 19.0.0 the update writes
 * `config.document` and merges nothing, so a config without one PUT
 * `undefined`: the shell stayed a shell, the setup announced success, and every
 * shared domain on every system had `<doma:datatype/>` empty. The comment above
 * that call said the update "fills in the type" the whole time.
 *
 * So these assert the one thing that was missing — that what the builders hand
 * back is a document with the configured type actually in it. The shipped
 * patches refuse a document without the element, which the helpers turn into
 * a throw, so a wrong shape is loud rather than silent; the shells below are
 * the shape the server returns.
 */

const {
  dataElementDocumentFor,
  domainDocumentFor,
} = require('../../helpers/test-helper');

/** The create's own answer, as recorded in the corpus: a shell, type empty. */
const DOMAIN_SHELL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<doma:domain adtcore:name="ZAC_SHR_DOMA" adtcore:type="DOMA/DD" ' +
  'adtcore:description="old" xmlns:doma="http://www.sap.com/dictionary/domain" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<adtcore:packageRef adtcore:name="ZADT_BLD_PKG03"/>' +
  '<doma:content><doma:typeInformation>' +
  '<doma:datatype/><doma:length>000000</doma:length>' +
  '<doma:decimals>000000</doma:decimals>' +
  '</doma:typeInformation></doma:content></doma:domain>';

const DTEL_SHELL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<blue:wbobj adtcore:name="ZAC_SHR_DTEL" adtcore:type="DTEL/DE" ' +
  'adtcore:description="old" xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" ' +
  'xmlns:dtel="http://www.sap.com/wbobj/dictionary/dtel">' +
  '<dtel:dataElement><dtel:typeKind/><dtel:typeName/></dtel:dataElement>' +
  '</blue:wbobj>';

describe('the document a shared domain is updated with', () => {
  it('carries the configured data type, not an empty element', () => {
    const document = domainDocumentFor(DOMAIN_SHELL, {
      description: 'Shared test domain',
      datatype: 'NUMC',
      length: 8,
    });

    expect(document).toContain('<doma:datatype>NUMC</doma:datatype>');
    expect(document).not.toContain('<doma:datatype/>');
  });

  it('writes the length as the six digits the server serialises', () => {
    const document = domainDocumentFor(DOMAIN_SHELL, { length: 4 });

    expect(document).toContain('<doma:length>000004</doma:length>');
  });

  it('falls back to CHAR(10) when the configuration names neither', () => {
    const document = domainDocumentFor(DOMAIN_SHELL, {});

    expect(document).toContain('<doma:datatype>CHAR</doma:datatype>');
    expect(document).toContain('<doma:length>000010</doma:length>');
  });

  it('leaves decimals alone when the configuration says nothing', () => {
    const document = domainDocumentFor(DOMAIN_SHELL, { datatype: 'CHAR' });

    expect(document).toContain('<doma:decimals>000000</doma:decimals>');
  });

  it('keeps the description inside what ADT accepts', () => {
    const document = domainDocumentFor(DOMAIN_SHELL, {
      description: 'x'.repeat(200),
    });

    expect(/adtcore:description="(x+)"/.exec(document)?.[1]).toHaveLength(60);
  });
});

describe('the document a shared data element is updated with', () => {
  it('names the domain it takes its type from', () => {
    const document = dataElementDocumentFor(DTEL_SHELL, {
      type_kind: 'domain',
      domain_name: 'zac_shr_doma',
    });

    expect(document).toContain('<dtel:typeKind>domain</dtel:typeKind>');
    expect(document).toContain('<dtel:typeName>ZAC_SHR_DOMA</dtel:typeName>');
  });

  it('leaves typeName alone for a kind that does not point at a domain', () => {
    const document = dataElementDocumentFor(DTEL_SHELL, {
      type_kind: 'predefinedAbapType',
      domain_name: 'zac_shr_doma',
    });

    expect(document).toContain(
      '<dtel:typeKind>predefinedAbapType</dtel:typeKind>',
    );
    expect(document).toContain('<dtel:typeName/>');
  });

  it('carries a predefined type, its length and decimals as six digits', () => {
    const shell = DTEL_SHELL.replace(
      '</dtel:dataElement>',
      '<dtel:dataType/><dtel:dataTypeLength>000000</dtel:dataTypeLength>' +
        '<dtel:dataTypeDecimals>000000</dtel:dataTypeDecimals></dtel:dataElement>',
    );
    const document = dataElementDocumentFor(shell, {
      type_kind: 'predefinedAbapType',
      data_type: 'char',
      length: 100,
      decimals: 2,
    });

    expect(document).toContain('<dtel:dataType>CHAR</dtel:dataType>');
    expect(document).toContain(
      '<dtel:dataTypeLength>000100</dtel:dataTypeLength>',
    );
    expect(document).toContain(
      '<dtel:dataTypeDecimals>000002</dtel:dataTypeDecimals>',
    );
  });

  it('refuses a document with nowhere to put the predefined type', () => {
    expect(() =>
      dataElementDocumentFor(DTEL_SHELL, {
        type_kind: 'predefinedAbapType',
        data_type: 'CHAR',
      }),
    ).toThrow(/dtel:dataType/);
  });
});

/**
 * The description goes on the object's own element. A shell read in a
 * language the object has no text in carries no root `adtcore:description`,
 * while its `adtcore:packageRef` carries the package's; patching the first
 * `adtcore:description` in the document then rewrote the package reference
 * and left the object without one — the PUT SAP refuses with `400`
 * "The description is missing" (SWB_TOOL 019).
 */
describe('the description of a shell read without one', () => {
  const withoutRootDescription = (shell: string, root: string): string =>
    shell
      .replace(`<${root} `, `<${root} `)
      .replace(' adtcore:description="old"', '')
      .replace(
        '<adtcore:packageRef adtcore:name="ZADT_BLD_PKG03"/>',
        '<adtcore:packageRef adtcore:name="ZADT_BLD_PKG03" adtcore:description="the package"/>',
      );

  it('a data element gets it on blue:wbobj, the package reference keeps its own', () => {
    const shell = withoutRootDescription(
      DTEL_SHELL.replace(
        '<dtel:dataElement>',
        '<adtcore:packageRef adtcore:name="ZADT_BLD_PKG03"/><dtel:dataElement>',
      ),
      'blue:wbobj',
    );
    const document = dataElementDocumentFor(shell, {
      description: 'Group activation test objects',
      type_kind: 'domain',
      domain_name: 'zac_shr_ga_dom',
    });

    expect(document).toMatch(
      /<blue:wbobj [^>]*adtcore:description="Group activation test objects"/,
    );
    expect(document).toContain(
      '<adtcore:packageRef adtcore:name="ZADT_BLD_PKG03" adtcore:description="the package"/>',
    );
  });

  it('a domain gets it on doma:domain, the package reference keeps its own', () => {
    const shell = withoutRootDescription(DOMAIN_SHELL, 'doma:domain');
    const document = domainDocumentFor(shell, {
      description: 'Shared test domain',
    });

    expect(document).toMatch(
      /<doma:domain [^>]*adtcore:description="Shared test domain"/,
    );
    expect(document).toContain(
      '<adtcore:packageRef adtcore:name="ZADT_BLD_PKG03" adtcore:description="the package"/>',
    );
  });
});
