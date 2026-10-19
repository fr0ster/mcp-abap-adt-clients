import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  EnhancementType,
  IEnhancementConfig,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import { AdtEnhancement } from '../../../../core/enhancement/AdtEnhancement';
import { headersOf } from '../../../helpers/adtHeaders';

const parser = new XMLParser({ ignoreAttributes: false });
const enhancedObject = {
  uri: '/host?a="&',
  type: 'PROG/P',
  name: 'HOST<&',
  program: 'PROGRAM<&',
};
function setup() {
  const request = jest
    .fn()
    .mockResolvedValue({ status: 201, data: '', headers: {} });
  const client = new AdtEnhancement({
    makeAdtRequest: request,
  } as unknown as IAbapConnection);
  return { client, request };
}
function config(
  enhancementType: EnhancementType,
): Omit<IEnhancementConfig, 'source'> {
  return {
    enhancementType,
    enhancementName: 'ZENH',
    packageName: '$TMP',
    description: 'Description<&"',
    enhancementSpot: 'SPOT<&"',
    enhancedObject,
    enhancementOption: '\\PR:HOST<&"',
    enhancementMode: 'D',
  };
}
const rows = [
  [
    'enhsxsb',
    'application/vnd.sap.adt.enh.enhs.v2+xml',
    'enhs:objectData',
    'ENHS/XSB',
  ],
  [
    'enhoxhb',
    'application/vnd.sap.adt.enh.enhoxhb.v4+xml',
    'enho:objectData',
    'ENHO/XHB',
  ],
  [
    'enhoxhh',
    'application/vnd.sap.adt.enh.enhoxhh.v3+xml',
    'enho:enhancement',
    'ENHO/XHH',
  ],
] as const;
it.each(
  rows,
)('creates %s using its measured document', async (type, media, root, code) => {
  const { client, request } = setup();
  await client.create(config(type), {
    headers: { accept: media, contentType: media },
  });
  expect(request).toHaveBeenCalledTimes(1);
  const sent = request.mock.calls[0][0];
  expect(sent.url).toBe(`/sap/bc/adt/enhancements/${type}`);
  expect(sent.method).toBe('POST');
  expect(sent.headers).toEqual({ Accept: media, 'Content-Type': media });
  const doc = parser.parse(sent.data)[root];
  expect(doc['@_adtcore:type']).toBe(code);
  expect(doc['@_adtcore:description']).toBe('Description<&"');
  expect(doc['adtcore:packageRef']['@_adtcore:name']).toBe('$TMP');
  const prefix = type === 'enhsxsb' ? 'enhs' : 'enho';
  expect(doc[`@_xmlns:${prefix}`]).toBe(
    `http://www.sap.com/adt/enhancements/${prefix}`,
  );
  if (type === 'enhsxsb') {
    expect(doc['enhs:contentCommon']['@_enhs:toolType']).toBe('BADI_DEF');
    expect(doc['enhs:contentSpecific']['enhs:badiTechnology']).toHaveProperty(
      'enhs:badiDefinitions',
      '',
    );
  } else if (type === 'enhoxhb') {
    expect(doc['@_xmlns:enhcore']).toBe(
      'http://www.sap.com/abapsource/enhancementscore',
    );
    const common = doc['enho:contentCommon'];
    expect(common['@_enho:toolType']).toBe('BADI_IMPL');
    const ref = common['enho:usages']['enhcore:referencedObject'];
    expect(ref['@_enhcore:element_usage']).toBe('EXTO');
    expect(ref['@_enhcore:program_id']).toBe('R3TR');
    expect(ref['enhcore:objectReference']).toEqual({
      '@_adtcore:name': 'SPOT<&"',
      '@_adtcore:type': 'ENHS/XS',
    });
    expect(ref).toHaveProperty('enhcore:mainObjectReference', '');
    expect(doc['enho:contentSpecific']['enho:badiTechnology']).toHaveProperty(
      'enho:badiImplementations',
      '',
    );
  } else {
    expect(doc['enho:contentCommon']).toEqual({
      '@_enho:toolType': 'HOOK_IMPL',
      '@_enho:adjustmentStatus': '',
      '@_enho:upgradeFlag': 'false',
    });
    const hook = doc['enho:contentSpecific']['enho:hookTechnology'];
    expect(hook['@_enho:nextId']).toBe('2');
    expect(hook['enho:enhancedObject']).toEqual({
      '@_adtcore:uri': enhancedObject.uri,
      '@_adtcore:type': enhancedObject.type,
      '@_adtcore:name': enhancedObject.name,
    });
    expect(hook['enho:hookImplementation']).toMatchObject({
      '@_enho:id': '1',
      '@_enho:programname': enhancedObject.program,
      '@_enho:enhmode': 'D',
      '@_enho:full_name': config(type).enhancementOption,
    });
  }
});
it.each(rows)('reads %s metadata with its media type', async (type, media) => {
  const { client, request } = setup();
  await client.readMetadata(config(type));
  expect(request.mock.calls[0][0].headers.Accept).toBe(media);
});
it.each([
  'active',
  'inactive',
] as const)('reads %s source with plain Accept', async (version) => {
  const { client, request } = setup();
  await client.read(config('enhoxhh'), version);
  expect(request.mock.calls[0][0].headers.Accept).toBe('text/plain');
  expect(request.mock.calls[0][0].url).toContain(
    `version=${version === 'inactive' ? 'workingArea' : 'active'}`,
  );
});
it.each([
  'enhoxhb',
  'enhoxhh',
] as const)('creates %s with empty attributes when subtype fields are omitted', async (type) => {
  const { client, request } = setup();
  await client.create(
    {
      enhancementType: type,
      enhancementName: 'ZENH',
      packageName: '$TMP',
    },
    { headers: headersOf(client, 'create') },
  );
  expect(request).toHaveBeenCalledTimes(1);
  const sent = request.mock.calls[0][0];
  expect(sent.method).toBe('POST');
  expect(sent.url).toBe(`/sap/bc/adt/enhancements/${type}`);
  if (type === 'enhoxhb') {
    const doc = parser.parse(sent.data)['enho:objectData'];
    const ref =
      doc['enho:contentCommon']['enho:usages']['enhcore:referencedObject'];
    expect(ref['enhcore:objectReference']).toEqual({
      '@_adtcore:name': '',
      '@_adtcore:type': 'ENHS/XS',
    });
  } else {
    const doc = parser.parse(sent.data)['enho:enhancement'];
    const hook = doc['enho:contentSpecific']['enho:hookTechnology'];
    expect(hook['enho:enhancedObject']).toEqual({
      '@_adtcore:uri': '',
      '@_adtcore:type': '',
      '@_adtcore:name': '',
    });
    expect(hook['enho:hookImplementation']).toMatchObject({
      '@_enho:programname': '',
      '@_enho:enhmode': '',
      '@_enho:full_name': '',
    });
  }
});

it.each(
  rows,
)('writes %s metadata verbatim with its own media type', async (type, media) => {
  const { client, request } = setup();
  const source =
    ' \r\n<?xml version="1.0"?><document attr="&amp;">é</document>\n';
  request.mockResolvedValue({ status: 200, data: source, headers: {} });
  const answer = await client.updateMetadata(
    { ...config(type), transportRequest: 'DEVK900001' },
    {
      headers: { accept: media, contentType: media },
      source,
      lockHandle: 'handle &/+',
    },
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toMatchObject({
    url: `/sap/bc/adt/enhancements/${type}/zenh?lockHandle=handle+%26%2F%2B&corrNr=DEVK900001`,
    method: 'PUT',
    headers: { Accept: media, 'Content-Type': media },
    data: source,
  });
  expect(answer.ok).toBe(true);
  if (answer.ok) expect(answer.getResult().value).toBe(source);
});

it.each(
  rows,
)('passes a %s metadata refusal response to analyse without throwing', async (type) => {
  const { client, request } = setup();
  const response = {
    status: 400,
    data: '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><namespace>SEEF</namespace><type>ExceptionParameterNotFound</type><message lang="EN">Parameter lockHandle could not be found.</message></exc:exception>',
    headers: {},
  };
  request.mockRejectedValue({ response });
  const analyse = jest.fn(analyseException);
  const answer = await client.updateMetadata(config(type), {
    headers: headersOf(client, 'updateMetadata'),
    source: '<document/>',
    analyse,
  });
  expect(answer.ok).toBe(false);
  expect(analyse).toHaveBeenCalledWith(
    expect.objectContaining({ response }),
    response,
  );
});

// The recorded pair is every other check's; 35.0.0's
// application/vnd.sap.adt.checkrun.v1+xml is refused 415, and the
// chkrun:checkRunRequest it sent is refused 400 under the checkobjects type
// (measured on an on-premise system, 2026-10-19).
it('records the check pair every other handler sends', () => {
  const { client } = setup();
  expect(headersOf(client, 'check')).toEqual({
    accept: 'application/vnd.sap.adt.checkmessages+xml',
    contentType: 'application/vnd.sap.adt.checkobjects+xml',
  });
});

it.each([
  ['inactive', 'workingArea'],
  ['active', 'active'],
] as const)('checks %s through a checkObjectList with the caller pair', async (status, version) => {
  const { client, request } = setup();
  await client.check(
    { enhancementType: 'enhoxhb', enhancementName: 'ZENH' },
    status,
    { headers: headersOf(client, 'check') },
  );
  expect(request).toHaveBeenCalledTimes(1);
  const sent = request.mock.calls[0][0];
  expect(sent.method).toBe('POST');
  expect(sent.url).toBe('/sap/bc/adt/checkruns?reporters=abapCheckRun');
  expect(sent.headers).toEqual({
    Accept: 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
  });
  const list = parser.parse(sent.data)['chkrun:checkObjectList'];
  expect(list['chkrun:checkObject']).toEqual({
    '@_adtcore:uri': '/sap/bc/adt/enhancements/enhoxhb/zenh',
    '@_chkrun:version': version,
  });
});

it('sends a source-code plugin source as a base64 artifact of its checkObject', async () => {
  const { client, request } = setup();
  const source = 'ENHANCEMENT 1 ZENH.\nENDENHANCEMENT.';
  await client.check(
    { enhancementType: 'enhoxhh', enhancementName: 'ZENH', source },
    undefined,
    { headers: headersOf(client, 'check') },
  );
  const sent = request.mock.calls[0][0];
  const object = parser.parse(sent.data)['chkrun:checkObjectList'][
    'chkrun:checkObject'
  ];
  expect(object['@_adtcore:uri']).toBe('/sap/bc/adt/enhancements/enhoxhh/zenh');
  expect(object['@_chkrun:version']).toBe('workingArea');
  const artifact = object['chkrun:artifacts']['chkrun:artifact'];
  expect(artifact['@_chkrun:contentType']).toBe('text/plain; charset=utf-8');
  expect(artifact['@_chkrun:uri']).toBe(
    '/sap/bc/adt/enhancements/enhoxhh/zenh/source/main',
  );
  expect(
    Buffer.from(artifact['chkrun:content'], 'base64').toString('utf-8'),
  ).toBe(source);
});
