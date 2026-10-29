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

  it('fails when the root has none, even if a nested element has one', () => {
    const nestedOnly =
      '<a:root xmlns:a="urn:a"><a:child adtcore:description="Nested"/></a:root>';
    expect(readRootDescription(nestedOnly)).toBeUndefined();
    expect(() => replaceRootDescription(nestedOnly, 'v', 'Class')).toThrow(
      /Class: .*no adtcore:description/,
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
