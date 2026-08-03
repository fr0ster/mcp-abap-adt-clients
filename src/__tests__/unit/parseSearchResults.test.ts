/**
 * Unit tests for the quickSearch parser.
 *
 * No SAP required. These pin the two things the parser has to survive: ADT
 * returning the objectReference attributes with or without the `adtcore:`
 * prefix, and a single hit arriving as an object rather than an array (which is
 * how fast-xml-parser represents a one-element list).
 */
import { parseSearchResults } from '../../core/shared/search';

// Captured verbatim from an SAP BTP trial system (quickSearch, query Z*), so
// the shape here is observed rather than imagined. Every attribute carries the
// `adtcore:` prefix, and the third entry has no description at all — which is
// why `description` is normalised to '' rather than left undefined.
const prefixed = `<?xml version="1.0" encoding="utf-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/packages/z" adtcore:type="DEVC/K" adtcore:name="Z" adtcore:packageName="Z" adtcore:description="gcek development"/><adtcore:objectReference adtcore:uri="/sap/bc/adt/vit/wb/object_type/sicftyp/object_name/ZX" adtcore:type="SICF/TYP" adtcore:name="ZX" adtcore:packageName="Z_RAG_PRO1"/></adtcore:objectReferences>`;

const unprefixed = `<?xml version="1.0" encoding="UTF-8"?>
<objectReferences>
  <objectReference uri="/sap/bc/adt/oo/classes/zcl_a" type="CLAS/OC"
    name="ZCL_A" packageName="ZPKG" description="First class"/>
</objectReferences>`;

describe('parseSearchResults', () => {
  it('reads namespace-prefixed attributes', () => {
    const hits = parseSearchResults(prefixed);

    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({
      name: 'Z',
      type: 'DEVC/K',
      description: 'gcek development',
      packageName: 'Z',
      uri: '/sap/bc/adt/packages/z',
    });
  });

  // Not observed on the trial, which prefixes everything. Kept because the
  // parser accepts both and dropping the case would leave that untested.
  it('also reads unprefixed attributes and a single hit', () => {
    const hits = parseSearchResults(unprefixed);

    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('ZCL_A');
    expect(hits[0].type).toBe('CLAS/OC');
  });

  it('reports an absent description as an empty string, not undefined', () => {
    // ISearchResult declares `description: string` — search always answers with
    // one, even when SAP sends no attribute.
    const hits = parseSearchResults(prefixed);

    expect(hits[1].description).toBe('');
    expect(hits[1].packageName).toBe('Z_RAG_PRO1');
  });

  it('drops a reference with no name or no type', () => {
    // Such a hit cannot be acted on: there is nothing to open or read.
    const partial = `<objectReferences>
      <objectReference type="CLAS/OC"/>
      <objectReference name="ZCL_OK" type="CLAS/OC"/>
      <objectReference name="ZCL_NO_TYPE"/>
    </objectReferences>`;

    const hits = parseSearchResults(partial);

    expect(hits.map((h) => h.name)).toEqual(['ZCL_OK']);
  });

  it('returns an empty list for a payload with no references', () => {
    expect(parseSearchResults('<objectReferences/>')).toEqual([]);
    expect(parseSearchResults('<somethingElse/>')).toEqual([]);
  });
});
