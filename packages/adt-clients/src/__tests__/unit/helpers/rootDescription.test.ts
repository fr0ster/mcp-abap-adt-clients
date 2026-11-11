import {
  readRootDescription,
  replaceRootDescription,
} from '../../helpers/rootDescription';

const DOCUMENT =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" ' +
  'xmlns:adtcore="http://www.sap.com/adt/core" ' +
  'adtcore:description="Old root" adtcore:name="ZCL_X">\n' +
  '  <adtcore:packageRef adtcore:description="Nested one" adtcore:name="ZPKG"/>\n' +
  '  <adtcore:other adtcore:description="Nested two"/>\n' +
  '</class:abapClass>\n';

describe('rootDescription', () => {
  it('reads the root element value, not a nested one', () => {
    expect(readRootDescription(DOCUMENT)).toBe('Old root');
  });

  it('changes only the root value and leaves every other byte', () => {
    const patched = replaceRootDescription(DOCUMENT, 'MCP metadata ab12', 'x');
    expect(readRootDescription(patched)).toBe('MCP metadata ab12');
    expect(patched).toBe(DOCUMENT.replace('Old root', 'MCP metadata ab12'));
    expect(patched).toContain('adtcore:description="Nested one"');
    expect(patched).toContain('adtcore:description="Nested two"');
  });

  it('adds the value on the root when the root has none, never on a nested element', () => {
    const nestedOnly =
      '<a:root xmlns:a="urn:a"><a:child adtcore:description="Nested"/></a:root>';
    expect(readRootDescription(nestedOnly)).toBeUndefined();
    expect(replaceRootDescription(nestedOnly, 'v', 'Class')).toBe(
      '<a:root xmlns:a="urn:a" adtcore:description="v"><a:child adtcore:description="Nested"/></a:root>',
    );
  });

  it('adds the value on a fresh transformation, as onprem answers it after activation', () => {
    // Measured on onprem: the create sent adtcore:description, the read-back
    // carries none on the root (only adtcore:descriptionTextLimit).
    const rootTag =
      '<trans:transformation trans:transformationType="XSLTProgram" ' +
      'abapsource:sourceUri="source/main" abapsource:fixPointArithmetic="false" ' +
      'abapsource:activeUnicodeCheck="true" adtcore:responsible="SAPUSER01" ' +
      'adtcore:masterLanguage="EN" adtcore:masterSystem="SYS" ' +
      'adtcore:abapLanguageVersion="standard" adtcore:name="ZAC_XSLT01" ' +
      'adtcore:type="XSLT/VT" adtcore:changedAt="2026-11-11T09:20:02Z" ' +
      'adtcore:version="active" adtcore:createdAt="2026-11-10T21:00:00Z" ' +
      'adtcore:changedBy="SAPUSER01" adtcore:createdBy="SAPUSER01" ' +
      'adtcore:descriptionTextLimit="60" ' +
      'xmlns:trans="http://www.sap.com/adt/transformation" ' +
      'xmlns:abapsource="http://www.sap.com/adt/abapsource" ' +
      'xmlns:adtcore="http://www.sap.com/adt/core"';
    const rest =
      '><atom:link href="source/main" rel="http://www.sap.com/adt/relations/source" ' +
      'type="text/plain" xmlns:atom="http://www.w3.org/2005/Atom"/>' +
      '<adtcore:packageRef adtcore:uri="/sap/bc/adt/packages/zac_test_pkg" ' +
      'adtcore:type="DEVC/K" adtcore:name="ZAC_TEST_PKG"/>' +
      '<abapsource:syntaxConfiguration><abapsource:language>' +
      '<abapsource:version>X</abapsource:version>' +
      '<abapsource:description>Standard ABAP</abapsource:description>' +
      '</abapsource:language></abapsource:syntaxConfiguration>' +
      '</trans:transformation>';
    const fresh = `<?xml version="1.0" encoding="utf-8"?>${rootTag}${rest}`;
    expect(readRootDescription(fresh)).toBeUndefined();
    const patched = replaceRootDescription(fresh, 'MCP metadata ab12', 'x');
    expect(patched).toBe(
      `<?xml version="1.0" encoding="utf-8"?>${rootTag} adtcore:description="MCP metadata ab12"${rest}`,
    );
    expect(readRootDescription(patched)).toBe('MCP metadata ab12');
  });

  it('escapes the value it writes', () => {
    expect(replaceRootDescription('<a:root/>', 'a "b" & <c>', 'x')).toBe(
      '<a:root adtcore:description="a &quot;b&quot; &amp; &lt;c&gt;"/>',
    );
  });

  it('refuses a document that is not XML, naming what', () => {
    expect(() => replaceRootDescription('not xml', 'v', 'Class')).toThrow(
      /^Class: /,
    );
  });

  it('does not take another attribute whose name ends the same way', () => {
    const other = '<a:root x-adtcore:description="no"/>';
    expect(readRootDescription(other)).toBeUndefined();
  });

  it('is not misled by a ">" inside a quoted attribute value', () => {
    const quoted = '<a:root a:note="1 > 0" adtcore:description="D"/>';
    expect(readRootDescription(quoted)).toBe('D');
  });
});
