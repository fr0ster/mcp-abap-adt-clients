/**
 * Unit test for getWhereUsedList type-filtering options.
 *
 * Uses a fake IAbapConnection that returns a captured scope response and
 * records the search request body, so we can assert which object types the
 * search was actually restricted to — without touching a live SAP system.
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getWhereUsedList } from '../../../core/shared/whereUsed';

// Real attribute order from SAP: isDefault, isSelected, name (name LAST).
const SCOPE_XML = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageScopeResult xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:objectIdentifier displayName="ZAC_SHR_BTABL (Database Table)" globalType="TABL/DT"/><usagereferences:grade definitions="false" elements="true" indirectReferences="false"/><usagereferences:objectTypes><usagereferences:type isDefault="true" isSelected="true" name="CLAS/OC"/><usagereferences:type isDefault="true" isSelected="true" name="INTF/OI"/><usagereferences:type isDefault="false" isSelected="false" name="TABL/DS"/><usagereferences:type isDefault="false" isSelected="false" name="TABL/DT"/></usagereferences:objectTypes><usagereferences:payload>BASE64BLOB==</usagereferences:payload></usagereferences:usageScopeResult>`;

const RESULT_XML = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceResult xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences" numberOfResults="0" resultDescription="Found 0"><usagereferences:referencedObjects/></usagereferences:usageReferenceResult>`;

/** Type names selected in a search request body (prefix-agnostic). */
function selectedTypes(xml: string): string[] {
  const selected: string[] = [];
  for (const m of xml.matchAll(/<[A-Za-z][\w-]*:type\b[^>]*\/>/g)) {
    if (/isSelected="true"/.test(m[0])) {
      const name = m[0].match(/name="([^"]+)"/);
      if (name) selected.push(name[1]);
    }
  }
  return selected;
}

/** Same scope payload as SCOPE_XML but bound under a camel-case prefix —
 * mirrors the system-dependent `usageReferences:` alias seen live on S/4. */
const SCOPE_XML_CAMEL = SCOPE_XML.replace(
  /usagereferences/g,
  'usageReferences',
);

function makeFakeConnection(): {
  connection: IAbapConnection;
  searchBodies: string[];
} {
  const searchBodies: string[] = [];
  const connection = {
    makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
      if (options.url.includes('/usageReferences/scope')) {
        return { data: SCOPE_XML, status: 200, headers: {} } as IAdtResponse;
      }
      // Actual search request — record its body.
      searchBodies.push(String(options.data));
      return { data: RESULT_XML, status: 200, headers: {} } as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, searchBodies };
}

describe('getWhereUsedList type filtering', () => {
  it('enableOnlyTypes restricts the search request to the given types', async () => {
    const { connection, searchBodies } = makeFakeConnection();

    await getWhereUsedList(connection, {
      object_name: 'ZAC_SHR_BTABL',
      object_type: 'table',
      enableOnlyTypes: ['TABL/DS'],
    });

    expect(searchBodies).toHaveLength(1);
    expect(selectedTypes(searchBodies[0]).sort()).toEqual(['TABL/DS']);
  });

  it('disableTypes removes types from the default scope', async () => {
    const { connection, searchBodies } = makeFakeConnection();

    await getWhereUsedList(connection, {
      object_name: 'ZAC_SHR_BTABL',
      object_type: 'table',
      disableTypes: ['CLAS/OC'],
    });

    expect(searchBodies).toHaveLength(1);
    expect(selectedTypes(searchBodies[0]).sort()).toEqual(['INTF/OI']);
  });

  it('applies the type filter when the scope uses a camel-case prefix', async () => {
    const searchBodies: string[] = [];
    const connection = {
      makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
        if (options.url.includes('/usageReferences/scope')) {
          return {
            data: SCOPE_XML_CAMEL,
            status: 200,
            headers: {},
          } as IAdtResponse;
        }
        searchBodies.push(String(options.data));
        return { data: RESULT_XML, status: 200, headers: {} } as IAdtResponse;
      },
    } as unknown as IAbapConnection;

    await getWhereUsedList(connection, {
      object_name: 'ZAC_SHR_BTABL',
      object_type: 'table',
      enableOnlyTypes: ['TABL/DS'],
    });

    expect(searchBodies).toHaveLength(1);
    // The isSelected flip worked despite the camel-case prefix...
    expect(selectedTypes(searchBodies[0]).sort()).toEqual(['TABL/DS']);
    // ...and the re-wrapped <scope> stays namespace-bound (prefix + xmlns kept).
    expect(searchBodies[0]).toContain('<usageReferences:scope');
    expect(searchBodies[0]).toContain(
      'xmlns:usageReferences="http://www.sap.com/adt/ris/usageReferences"',
    );
    expect(searchBodies[0]).not.toContain('usageScopeResult');
  });

  it('does NOT call the /scope sub-resource when no type filter is requested', async () => {
    const urls: string[] = [];
    const searchBodies: string[] = [];
    const connection = {
      makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
        urls.push(options.url);
        searchBodies.push(String(options.data));
        return { data: RESULT_XML, status: 200, headers: {} } as IAdtResponse;
      },
    } as unknown as IAbapConnection;

    await getWhereUsedList(connection, {
      object_name: 'ZAC_SHR_BTABL',
      object_type: 'table',
    });

    // Only the direct /usageReferences search runs — no /scope round-trip — and
    // the body carries no <scope> (SAP applies its default scope).
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain('/usageReferences/scope');
    expect(searchBodies[0]).not.toContain('<usagereferences:scope>');
  });

  it('falls back to an unscoped search when /scope answers 404', async () => {
    const urls: string[] = [];
    const searchBodies: string[] = [];
    const connection = {
      makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
        urls.push(options.url);
        if (options.url.includes('/usageReferences/scope')) {
          // Some S/4 releases do not expose the scope sub-resource.
          const err: any = new Error('Request failed with status code 404');
          err.status = 404;
          throw err;
        }
        searchBodies.push(String(options.data));
        return { data: RESULT_XML, status: 200, headers: {} } as IAdtResponse;
      },
    } as unknown as IAbapConnection;

    const result = await getWhereUsedList(connection, {
      object_name: 'VBAK',
      object_type: 'table',
      enableOnlyTypes: ['TABL/DS'],
    });

    // The search still runs (unscoped) instead of throwing, so the caller can
    // filter references client-side.
    expect(urls.some((u) => u.includes('/usageReferences/scope'))).toBe(true);
    expect(searchBodies).toHaveLength(1);
    expect(searchBodies[0]).not.toContain('<usagereferences:scope>');
    expect(result.totalReferences).toBe(0);
  });

  it('filters references client-side by enableOnlyTypes when /scope is 404', async () => {
    // Unscoped fallback returns a mix of types (as a real S/4 would for a
    // heavily-used base). Only the requested TABL/DS must come back.
    const MIXED = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceResult xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences" xmlns:adtcore="http://www.sap.com/adt/core" numberOfResults="3" resultDescription="Found 3"><usagereferences:referencedObjects><usagereferences:referencedObject uri="/a"><usagereferences:adtObject adtcore:type="CLAS/OC" adtcore:name="CL_FOO"/></usagereferences:referencedObject><usagereferences:referencedObject uri="/b"><usagereferences:adtObject adtcore:type="TABL/DS" adtcore:name="ZAPPEND_VBAK"/></usagereferences:referencedObject><usagereferences:referencedObject uri="/c"><usagereferences:adtObject adtcore:type="PROG/P" adtcore:name="ZREPORT"/></usagereferences:referencedObject></usagereferences:referencedObjects></usagereferences:usageReferenceResult>`;

    const connection = {
      makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
        if (options.url.includes('/usageReferences/scope')) {
          const err: any = new Error('Request failed with status code 404');
          err.status = 404;
          throw err;
        }
        return { data: MIXED, status: 200, headers: {} } as IAdtResponse;
      },
    } as unknown as IAbapConnection;

    const result = await getWhereUsedList(connection, {
      object_name: 'VBAK',
      object_type: 'table',
      enableOnlyTypes: ['TABL/DS'],
    });

    expect(result.references.map((r) => r.type)).toEqual(['TABL/DS']);
    expect(result.references[0].name).toBe('ZAPPEND_VBAK');
    expect(result.totalReferences).toBe(1);
  });

  // The namespace PREFIX bound to http://www.sap.com/adt/ris/usageReferences is
  // system-dependent: some releases emit `usagereferences:` (lower-case), others
  // `usageReferences:` (camel-case, observed live on an S/4 system). The parser
  // must read references regardless of which alias the server chose.
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

  for (const prefix of ['usagereferences', 'usageReferences']) {
    it(`parses the result regardless of the "${prefix}:" namespace prefix`, async () => {
      const connection = {
        makeAdtRequest: async (): Promise<IAdtResponse> =>
          ({
            data: resultWith(prefix),
            status: 200,
            headers: {},
          }) as IAdtResponse,
      } as unknown as IAbapConnection;

      const result = await getWhereUsedList(connection, {
        object_name: 'VBAK',
        object_type: 'table',
      });

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

  it('re-throws non-404 scope errors instead of falling back', async () => {
    const connection = {
      makeAdtRequest: async (options: any): Promise<IAdtResponse> => {
        if (options.url.includes('/usageReferences/scope')) {
          const err: any = new Error('Request failed with status code 500');
          err.status = 500;
          throw err;
        }
        return { data: RESULT_XML, status: 200, headers: {} } as IAdtResponse;
      },
    } as unknown as IAbapConnection;

    await expect(
      getWhereUsedList(connection, {
        object_name: 'VBAK',
        object_type: 'table',
        enableOnlyTypes: ['TABL/DS'],
      }),
    ).rejects.toThrow('500');
  });
});
