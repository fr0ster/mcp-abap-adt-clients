/**
 * Where the text elements go beside their own members: the where-used
 * address a `PROG/PX` container decides, and the one activation that names
 * the object and its text elements — both as measured on premise
 * (2026-11-19): a function group's text elements are `PROG/PX` under
 * `/textelements/functiongroups/{group}`, and the reference's URI decides.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AdtGroupActivationCode,
  IAdtGroupActivationReference,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../../core/shared/utilResultSet';
import { whereUsedObjectUri } from '../../../../core/shared/whereUsed';
import { textElementsActivationReferences } from '../../../../core/textElements/activation';
import type { ResultValuesOf } from '../../../../utils/resultStrategy';
import { createLibraryLogger } from '../../../helpers/testLogger';

const ANSWERS = path.resolve(__dirname, '../../../../../corpus/adt/answers');

function recording() {
  const requests: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: () => undefined,
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="true" activationExecuted="true" generationExecuted="true"/></chkl:messages>',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, requests };
}

const headers = { accept: 'application/xml', contentType: 'application/xml' };

describe('where-used: PROG/PX names its container', () => {
  it.each([
    ['program', '/sap/bc/adt/textelements/programs/rsparam'],
    ['functionGroup', '/sap/bc/adt/textelements/functiongroups/rsparam'],
  ] as const)('%s → %s', (container, uri) => {
    expect(whereUsedObjectUri('RSPARAM', 'PROG/PX', container)).toBe(uri);
  });

  it('other codes keep their own address', () => {
    expect(whereUsedObjectUri('ZCL_X', 'CLAS/OC')).toBe(
      '/sap/bc/adt/oo/classes/zcl_x',
    );
  });

  it('getWhereUsed asks about the function group text elements address', async () => {
    const { connection, requests } = recording();
    const utils = new AdtUtils<ResultValuesOf<typeof utilDocuments>, 'onprem'>(
      connection,
      {
        logger: createLibraryLogger(),
        results: utilDocuments,
      },
    );
    await utils.getWhereUsed(
      {
        object_name: 'SEUF',
        object_type: 'PROG/PX',
        container: 'functionGroup',
      },
      { headers },
    );
    expect(requests[0]?.url).toBe(
      `/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent('/sap/bc/adt/textelements/functiongroups/seuf')}`,
    );
  });
});

describe('activation: the object with its text elements', () => {
  it('a program: PROG/P and PROG/PX', () => {
    expect(
      textElementsActivationReferences({
        objectKind: 'program',
        objectName: 'ZPROG',
      }),
    ).toEqual([
      {
        name: 'ZPROG',
        type: 'PROG/P',
        uri: '/sap/bc/adt/programs/programs/zprog',
      },
      {
        name: 'ZPROG',
        type: 'PROG/PX',
        uri: '/sap/bc/adt/textelements/programs/zprog',
      },
    ]);
  });

  it('a class: CLAS/OC and CLAS/OCX, on either newer release', () => {
    const refs: IAdtGroupActivationReference<'cloud'>[] =
      textElementsActivationReferences({
        objectKind: 'class',
        objectName: 'ZCL_X',
      });
    expect(refs.map((r) => r.type)).toEqual(['CLAS/OC', 'CLAS/OCX']);
  });

  it('a function group: FUGR/F and PROG/PX under functiongroups, sent as recorded', async () => {
    const { connection, requests } = recording();
    const utils = new AdtUtils<ResultValuesOf<typeof utilDocuments>, 'onprem'>(
      connection,
      {
        logger: createLibraryLogger(),
        results: utilDocuments,
      },
    );
    await utils.activateObjects(
      textElementsActivationReferences({
        objectKind: 'functionGroup',
        objectName: 'ZMCP_TXG4480',
      }),
      true,
      { headers },
    );
    const sent = String(requests[0]?.data);
    expect(sent).toContain(
      'adtcore:uri="/sap/bc/adt/functions/groups/zmcp_txg4480" adtcore:type="FUGR/F" adtcore:name="ZMCP_TXG4480"',
    );
    expect(sent).toContain(
      'adtcore:uri="/sap/bc/adt/textelements/functiongroups/zmcp_txg4480" adtcore:type="PROG/PX" adtcore:name="ZMCP_TXG4480"',
    );
    // The recorded activation that ran: the same two references.
    const recordedBody = JSON.parse(
      fs.readFileSync(
        path.join(
          ANSWERS,
          'activate-group-text-elements-function-group-s4-2025--01-activate.json',
        ),
        'utf8',
      ),
    ).request.body;
    expect(recordedBody).toContain(
      'adtcore:uri="/sap/bc/adt/textelements/functiongroups/zmcp_txg4480" adtcore:type="PROG/PX" adtcore:name="ZMCP_TXG4480"',
    );
  });
});

// Every code the helper sends activates on both newer releases.
type Within<A, B> = [A] extends [B] ? true : false;
const _modern: Within<
  'CLAS/OC' | 'CLAS/OCX' | 'FUGR/F' | 'PROG/PX',
  AdtGroupActivationCode
> = true;
void _modern;
