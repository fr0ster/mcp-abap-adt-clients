/**
 * Unit test for modifyWhereUsedScope.
 *
 * Uses a fixture captured from a real SAP system, where the attribute order
 * inside <usagereferences:type> is `isDefault isSelected name` (name LAST).
 * The selection logic must be independent of attribute ordering.
 */

import { modifyWhereUsedScope } from '../../../core/shared/whereUsed';

// Real attribute order: isDefault, isSelected, name (name is the LAST attribute).
const SCOPE_XML = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageScopeResult xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:objectIdentifier displayName="ZAC_SHR_BTABL (Database Table)" globalType="TABL/DT"/><usagereferences:grade definitions="false" elements="true" indirectReferences="false"/><usagereferences:objectTypes><usagereferences:type isDefault="true" isSelected="true" name="CLAS/OC"/><usagereferences:type isDefault="true" isSelected="true" name="INTF/OI"/><usagereferences:type isDefault="false" isSelected="false" name="TABL/DS"/><usagereferences:type isDefault="false" isSelected="false" name="TABL/DT"/></usagereferences:objectTypes><usagereferences:payload>BASE64BLOB==</usagereferences:payload></usagereferences:usageScopeResult>`;

/** Extract the set of type names currently selected (isSelected="true"). */
function selectedTypes(xml: string): string[] {
  const selected: string[] = [];
  const tagRe = /<usagereferences:type\b[^>]*\/>/g;
  for (const m of xml.matchAll(tagRe)) {
    const tag = m[0];
    if (/isSelected="true"/.test(tag)) {
      const name = tag.match(/name="([^"]+)"/);
      if (name) selected.push(name[1]);
    }
  }
  return selected;
}

describe('modifyWhereUsedScope (real attribute order: name last)', () => {
  it('enableAll selects every type', () => {
    const result = modifyWhereUsedScope(SCOPE_XML, { enableAll: true });
    expect(selectedTypes(result).sort()).toEqual(
      ['CLAS/OC', 'INTF/OI', 'TABL/DS', 'TABL/DT'].sort(),
    );
  });

  it('enableOnly restricts selection to the given types regardless of attribute order', () => {
    const result = modifyWhereUsedScope(SCOPE_XML, {
      enableOnly: ['TABL/DS', 'TABL/DT'],
    });
    expect(selectedTypes(result).sort()).toEqual(['TABL/DS', 'TABL/DT'].sort());
  });

  it('enable adds a type while keeping existing selections', () => {
    const result = modifyWhereUsedScope(SCOPE_XML, { enable: ['TABL/DS'] });
    expect(selectedTypes(result).sort()).toEqual(
      ['CLAS/OC', 'INTF/OI', 'TABL/DS'].sort(),
    );
  });

  it('disable removes a type while keeping the rest', () => {
    const result = modifyWhereUsedScope(SCOPE_XML, { disable: ['CLAS/OC'] });
    expect(selectedTypes(result).sort()).toEqual(['INTF/OI'].sort());
  });

  it('preserves the opaque payload blob untouched', () => {
    const result = modifyWhereUsedScope(SCOPE_XML, {
      enableOnly: ['TABL/DS'],
    });
    expect(result).toContain(
      '<usagereferences:payload>BASE64BLOB==</usagereferences:payload>',
    );
  });
});
