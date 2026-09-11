/**
 * The reading that turns a where-used answer into references.
 *
 * It is not the default — `whereUsed` answers the document, because a reference
 * list drops what a caller may want. This is the shape offered by name, and it
 * replaces the parsing half of `getWhereUsedList`, which left in 19.0.0 because
 * it joined two requests.
 *
 * The other half of that member is not replaced by anything here. Fetching the
 * scope, editing it, deciding what to do when the `scope` sub-resource answers
 * `404` — a caller writes those, over `getWhereUsedScope`,
 * `modifyWhereUsedScope` and `getWhereUsed`.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';
import { whereUsedReferences } from '../../../core/shared/utilResults';

const wire = (data: string): IAdtWireResponse =>
  ({ status: 200, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

// The prefix is system-dependent: some releases emit `usagereferences:`, others
// `usageReferences:` (camel-case, observed live). The reading must not care.
const resultWith = (prefix: string) =>
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<${prefix}:usageReferenceResult xmlns:${prefix}="http://www.sap.com/adt/ris/usageReferences" numberOfResults="2" resultDescription="References for: VBAK">` +
  `<${prefix}:referencedObjects>` +
  `<${prefix}:referencedObject uri="/a" parentUri="/p" isResult="false" usageInformation="gradeDirect">` +
  `<${prefix}:adtObject adtcore:responsible="DEV" adtcore:name="ZAPPEND_VBAK" adtcore:type="TABL/DS" adtcore:description="d" xmlns:adtcore="http://www.sap.com/adt/core">` +
  `<adtcore:packageRef adtcore:name="ZPKG"/></${prefix}:adtObject></${prefix}:referencedObject>` +
  `<${prefix}:referencedObject uri="/b">` +
  `<${prefix}:adtObject adtcore:name="CL_FOO" adtcore:type="CLAS/OC" xmlns:adtcore="http://www.sap.com/adt/core"/>` +
  `</${prefix}:referencedObject></${prefix}:referencedObjects></${prefix}:usageReferenceResult>`;

describe('whereUsedReferences', () => {
  for (const prefix of ['usagereferences', 'usageReferences']) {
    it(`reads the result regardless of the "${prefix}:" namespace prefix`, () => {
      const result = whereUsedReferences(wire(resultWith(prefix)));

      expect(result.totalReferences).toBe(2);
      expect(result.references).toHaveLength(2);
      const append = result.references.find((r) => r.type === 'TABL/DS');
      expect(append?.name).toBe('ZAPPEND_VBAK');
      expect(append?.packageName).toBe('ZPKG');
      expect(append?.responsible).toBe('DEV');
      expect(result.references.map((r) => r.type).sort()).toEqual([
        'CLAS/OC',
        'TABL/DS',
      ]);
    });
  }

  it('skips packages, which are container nodes and not uses', () => {
    const withPackage =
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<u:usageReferenceResult xmlns:u="http://www.sap.com/adt/ris/usageReferences" numberOfResults="1">` +
      `<u:referencedObjects><u:referencedObject uri="/p">` +
      `<u:adtObject adtcore:name="ZPKG" adtcore:type="DEVC/K" xmlns:adtcore="http://www.sap.com/adt/core"/>` +
      `</u:referencedObject></u:referencedObjects></u:usageReferenceResult>`;

    expect(whereUsedReferences(wire(withPackage)).references).toHaveLength(0);
  });

  it('answers an empty reading for a document it does not recognise', () => {
    // Not a judgement about the server: the document did not carry the element
    // this reading reads, and saying so with zero references is what a reading
    // can honestly report. Whether that means anything is the caller's.
    const result = whereUsedReferences(wire('<html>logon</html>'));
    expect(result.totalReferences).toBe(0);
    expect(result.references).toEqual([]);
  });
});
