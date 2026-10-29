/**
 * The request each member of ruling R2 sends — the members the ADT type
 * tables enter as served although no request-shape test pinned them until
 * now: the feature toggle's runtime, the service binding's types and group,
 * a class's `activateTestClasses`, the message's `readMetadata` alias, and
 * the enhancement members of `ENHO/XHB` and `ENHS/XSB` beyond create and
 * metadata. Pinned as they are today: method, address, query, headers, body.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { R2_CALLS } from './r2Calls';

interface Sent {
  method: string;
  url: string;
  params?: unknown;
  headers?: unknown;
  data?: unknown;
}

const EXPECTED: Record<string, Sent[]> = {
  'featureToggle.switchOn': [
    {
      method: 'POST',
      url: '/sap/bc/adt/sfw/featuretoggles/zft_guard/toggle',
      headers: {
        'Content-Type':
          'application/vnd.sap.adt.related.toggle.parameters.v1+asjson',
      },
      data: '{"TOGGLE_PARAMETERS":{"IS_USER_SPECIFIC":false,"STATE":"on","TRANSPORT_REQUEST":"TRKORR01"}}',
    },
  ],
  'featureToggle.switchOff': [
    {
      method: 'POST',
      url: '/sap/bc/adt/sfw/featuretoggles/zft_guard/toggle',
      headers: {
        'Content-Type':
          'application/vnd.sap.adt.related.toggle.parameters.v1+asjson',
      },
      data: '{"TOGGLE_PARAMETERS":{"IS_USER_SPECIFIC":true,"STATE":"off","TRANSPORT_REQUEST":"TRKORR01"}}',
    },
  ],
  'featureToggle.getRuntimeState': [
    {
      method: 'GET',
      url: '/sap/bc/adt/sfw/featuretoggles/zft_guard/states',
      headers: {
        Accept: 'application/vnd.sap.adt.states.v1+asjson',
      },
    },
  ],
  'featureToggle.checkState': [
    {
      method: 'POST',
      url: '/sap/bc/adt/sfw/featuretoggles/zft_guard/check',
      headers: {
        Accept: 'application/vnd.sap.adt.toggle.check.result.v1+asjson',
        'Content-Type':
          'application/vnd.sap.adt.toggle.check.parameters.v1+asjson',
      },
      data: '{"PARAMETERS":{"IS_USER_SPECIFIC":false}}',
    },
  ],
  'featureToggle.readSource': [
    {
      method: 'GET',
      url: '/sap/bc/adt/sfw/featuretoggles/zft_guard/source/main',
      params: {
        version: 'inactive',
      },
      headers: {
        Accept: 'application/vnd.sap.adt.toggle.content.v2+json',
      },
    },
  ],
  'serviceBinding.getServiceBindingTypes': [
    {
      method: 'GET',
      url: '/sap/bc/adt/businessservices/bindings/bindingtypes',
      headers: {
        Accept: 'application/vnd.sap.adt.nameditems.v1+xml, application/xml',
      },
    },
  ],
  'serviceBinding.getServiceGroup': [
    {
      method: 'GET',
      url: '/sap/bc/adt/businessservices/odatav4/ZSB_GUARD?servicename=ZSRV_GUARD&serviceversion=0001&srvdname=ZSD_GUARD',
      headers: {
        Accept:
          'application/vnd.sap.adt.businessservices.odatav4.v1+xml, application/vnd.sap.adt.businessservices.odatav4.v2+xml',
      },
    },
  ],
  'class.activateTestClasses': [
    {
      method: 'POST',
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/vnd.sap.adt.activation+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">\n  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_guard#testclass=LTCL_GUARD" adtcore:name="ZCL_GUARD#LTCL_GUARD"/>\n</adtcore:objectReferences>',
    },
  ],
  'messageClassMessage.readMetadata': [
    {
      method: 'GET',
      url: '/sap/bc/adt/messageclass/zmsg_guard',
      headers: {
        Accept: 'application/vnd.sap.adt.mc.messageclass+xml, application/xml',
      },
    },
  ],
  'enhoxhb.lock': [
    {
      method: 'POST',
      url: '/sap/bc/adt/enhancements/enhoxhb/zenh_guard?_action=LOCK&accessMode=MODIFY',
      headers: {
        Accept:
          'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9',
      },
      data: null,
    },
  ],
  'enhoxhb.unlock': [
    {
      method: 'POST',
      url: '/sap/bc/adt/enhancements/enhoxhb/zenh_guard?_action=UNLOCK&lockHandle=LH',
      data: null,
    },
  ],
  'enhoxhb.activate': [
    {
      method: 'POST',
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/vnd.sap.adt.activation+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">\n  <adtcore:objectReference adtcore:uri="/sap/bc/adt/enhancements/enhoxhb/zenh_guard" adtcore:name="ZENH_GUARD"/>\n</adtcore:objectReferences>',
    },
  ],
  'enhoxhb.check': [
    {
      method: 'POST',
      url: '/sap/bc/adt/checkruns?reporters=abapCheckRun',
      headers: {
        Accept: 'application/vnd.sap.adt.checkmessages+xml',
        'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">\n  <chkrun:checkObject adtcore:uri="/sap/bc/adt/enhancements/enhoxhb/zenh_guard" chkrun:version="workingArea"></chkrun:checkObject>\n</chkrun:checkObjectList>',
    },
  ],
  'enhoxhb.validate': [
    {
      method: 'POST',
      url: '/sap/bc/adt/enhancements/enhoxhb/validation?objname=ZENH_GUARD&objtype=ENHO%2FXHB',
      headers: {
        Accept:
          'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.validation.objectname',
      },
    },
  ],
  'enhoxhb.checkDeletion': [
    {
      method: 'POST',
      url: '/sap/bc/adt/deletion/check',
      headers: {
        Accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">\n  <del:object adtcore:uri="/sap/bc/adt/enhancements/enhoxhb/zenh_guard"/>\n</del:checkRequest>',
    },
  ],
  'enhoxhb.delete': [
    {
      method: 'POST',
      url: '/sap/bc/adt/deletion/delete',
      headers: {
        Accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">\n  <del:object adtcore:uri="/sap/bc/adt/enhancements/enhoxhb/zenh_guard">\n    <del:transportNumber/>\n  </del:object>\n</del:deletionRequest>',
    },
  ],
  'enhoxhb.readTransport': [
    {
      method: 'GET',
      url: '/sap/bc/adt/enhancements/enhoxhb/zenh_guard/transport',
      headers: {
        Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
      },
    },
  ],
  'enhoxhb.getVersions': [
    {
      method: 'GET',
      url: '/sap/bc/adt/enhancements/enhoxhb/zenh_guard/source/main/versions',
      headers: {
        Accept: 'application/atom+xml;type=feed',
      },
    },
  ],
  'enhsxsb.lock': [
    {
      method: 'POST',
      url: '/sap/bc/adt/enhancements/enhsxsb/zenh_guard?_action=LOCK&accessMode=MODIFY',
      headers: {
        Accept:
          'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9',
      },
      data: null,
    },
  ],
  'enhsxsb.unlock': [
    {
      method: 'POST',
      url: '/sap/bc/adt/enhancements/enhsxsb/zenh_guard?_action=UNLOCK&lockHandle=LH',
      data: null,
    },
  ],
  'enhsxsb.activate': [
    {
      method: 'POST',
      url: '/sap/bc/adt/activation?method=activate&preauditRequested=true',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/vnd.sap.adt.activation+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">\n  <adtcore:objectReference adtcore:uri="/sap/bc/adt/enhancements/enhsxsb/zenh_guard" adtcore:name="ZENH_GUARD"/>\n</adtcore:objectReferences>',
    },
  ],
  'enhsxsb.check': [
    {
      method: 'POST',
      url: '/sap/bc/adt/checkruns?reporters=abapCheckRun',
      headers: {
        Accept: 'application/vnd.sap.adt.checkmessages+xml',
        'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">\n  <chkrun:checkObject adtcore:uri="/sap/bc/adt/enhancements/enhsxsb/zenh_guard" chkrun:version="workingArea"></chkrun:checkObject>\n</chkrun:checkObjectList>',
    },
  ],
  'enhsxsb.validate': [
    {
      method: 'POST',
      url: '/sap/bc/adt/enhancements/enhsxsb/validation?objname=ZENH_GUARD&objtype=ENHS%2FXSB',
      headers: {
        Accept:
          'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.validation.objectname',
      },
    },
  ],
  'enhsxsb.checkDeletion': [
    {
      method: 'POST',
      url: '/sap/bc/adt/deletion/check',
      headers: {
        Accept: 'application/vnd.sap.adt.deletion.check.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.check.request.v1+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">\n  <del:object adtcore:uri="/sap/bc/adt/enhancements/enhsxsb/zenh_guard"/>\n</del:checkRequest>',
    },
  ],
  'enhsxsb.delete': [
    {
      method: 'POST',
      url: '/sap/bc/adt/deletion/delete',
      headers: {
        Accept: 'application/vnd.sap.adt.deletion.response.v1+xml',
        'Content-Type': 'application/vnd.sap.adt.deletion.request.v1+xml',
      },
      data: '<?xml version="1.0" encoding="UTF-8"?>\n<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">\n  <del:object adtcore:uri="/sap/bc/adt/enhancements/enhsxsb/zenh_guard">\n    <del:transportNumber/>\n  </del:object>\n</del:deletionRequest>',
    },
  ],
  'enhsxsb.readTransport': [
    {
      method: 'GET',
      url: '/sap/bc/adt/enhancements/enhsxsb/zenh_guard/transport',
      headers: {
        Accept: 'application/vnd.sap.adt.transportorganizer.v1+xml',
      },
    },
  ],
  'enhsxsb.getVersions': [
    {
      method: 'GET',
      url: '/sap/bc/adt/enhancements/enhsxsb/zenh_guard/source/main/versions',
      headers: {
        Accept: 'application/atom+xml;type=feed',
      },
    },
  ],
};

function recordingClient(): { client: AdtClient; sent: Sent[] } {
  const sent: Sent[] = [];
  const connection = {
    isConnected: () => true,
    setSessionType: () => {},
    makeAdtRequest: async (request: Sent) => {
      sent.push({
        method: request.method,
        url: request.url,
        params: request.params,
        headers: request.headers,
        data: request.data,
      });
      return {
        status: 200,
        statusText: 'OK',
        headers: { location: '/x' },
        data: '<x lockHandle="LH"/>',
      };
    },
  } as unknown as IAbapConnection;
  return { client: new AdtClient(connection), sent };
}

describe('the members ruling R2 enters as served send what they sent', () => {
  it('every call has its pinned shape', () => {
    expect(R2_CALLS.map(([label]) => label).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  it.each(R2_CALLS)('%s', async (label, call) => {
    const { client, sent } = recordingClient();
    await call(client);
    expect(sent).toEqual(EXPECTED[label]);
  });
});
