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

/** Type names selected in a search request body. */
function selectedTypes(xml: string): string[] {
  const selected: string[] = [];
  for (const m of xml.matchAll(/<usagereferences:type\b[^>]*\/>/g)) {
    if (/isSelected="true"/.test(m[0])) {
      const name = m[0].match(/name="([^"]+)"/);
      if (name) selected.push(name[1]);
    }
  }
  return selected;
}

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
});
