/**
 * D1 of #304, "what D1 does not require": 29 casts over fields that are no
 * name, source or lock handle (a description, a super package, a binding's
 * service, an enhancement type, a master system, an owner, …). They stay
 * optional; the internal function takes the contract's `string | undefined`
 * and writes its conversion out. For each member the request it sends is the
 * same with the field given and with it absent — the snapshot was written by
 * the code before the change.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

type Answer = { ok: boolean; getError(): { message: string } };
type Member = (config: unknown, options: unknown) => Promise<Answer>;
const headers = { accept: 'application/xml', contentType: 'application/xml' };

/** [getter, member, config, the optional fields to leave out one at a time, options]. */
const CASES: [
  string,
  string,
  Record<string, unknown>,
  string[],
  Record<string, unknown>?,
][] = [
  [
    'getAppendStructure',
    'create',
    {
      appendStructureName: 'ZAPP',
      packageName: 'P',
      baseObject: 'ZTAB',
      description: 'd',
    },
    ['baseObject', 'description'],
  ],
  [
    'getBehaviorDefinition',
    'create',
    {
      name: 'ZBDEF',
      packageName: 'P',
      description: 'd',
      implementationType: 'Managed',
    },
    ['description', 'implementationType'],
  ],
  [
    'getDomain',
    'create',
    { domainName: 'ZDOM', packageName: 'P', description: 'd' },
    ['description'],
  ],
  [
    'getEnhancement',
    'read',
    { enhancementName: 'ZE', enhancementType: 'enhoxhh' },
    ['enhancementType'],
  ],
  [
    'getEnhancement',
    'getVersions',
    { enhancementName: 'ZE', enhancementType: 'enhoxhh' },
    ['enhancementType'],
  ],
  [
    'getEnhancement',
    'validate',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'create',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'readMetadata',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'updateMetadata',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'readTransport',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'update',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'checkDeletion',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'delete',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'activate',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'check',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'lock',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getEnhancement',
    'unlock',
    {
      enhancementName: 'ZE',
      enhancementType: 'enhoxhh',
      packageName: 'P',
      description: 'd',
      enhancementSpot: 'ZSPOT',
    },
    ['enhancementType'],
    { lockHandle: 'L' },
  ],
  [
    'getFeatureToggle',
    'updateMetadata',
    { featureToggleName: 'ZFT', description: 'd', packageName: 'P' },
    ['description', 'packageName'],
    { lockHandle: 'L' },
  ],
  [
    'getFeatureToggle',
    'update',
    { featureToggleName: 'ZFT', source: { rollout: { strategy: 'x' } } },
    ['source'],
    { lockHandle: 'L' },
  ],
  [
    'getFunctionGroup',
    'create',
    { functionGroupName: 'ZFG', packageName: 'P', description: 'd' },
    ['description'],
  ],
  [
    'getFunctionInclude',
    'updateMetadata',
    { functionGroupName: 'ZFG', includeName: 'ZINC', description: 'd' },
    ['description'],
    { lockHandle: 'L' },
  ],
  [
    'getFunctionModule',
    'create',
    {
      functionGroupName: 'ZFG',
      functionModuleName: 'ZFM',
      packageName: 'P',
      description: 'd',
    },
    ['description'],
  ],
  [
    'getInterface',
    'create',
    { interfaceName: 'ZIF', packageName: 'P', description: 'd' },
    ['description'],
  ],
  [
    'getMessageClass',
    'create',
    { name: 'ZMC', packageName: 'P', description: 'd' },
    ['description'],
  ],
  [
    'getMetadataExtension',
    'create',
    { name: 'ZMDE', packageName: 'P', description: 'd' },
    ['description'],
  ],
  [
    'getPackage',
    'validate',
    { packageName: 'ZPKG', superPackage: 'ZSUP', description: 'd' },
    ['superPackage'],
  ],
  [
    'getPackage',
    'create',
    {
      packageName: 'ZPKG',
      superPackage: 'ZSUP',
      description: 'd',
      softwareComponent: 'LOCAL',
    },
    ['superPackage'],
  ],
  [
    'getPackage',
    'updateMetadata',
    { packageName: 'ZPKG', superPackage: 'ZSUP', description: 'd' },
    ['superPackage'],
    { lockHandle: 'L' },
  ],
  [
    'getScalarFunction',
    'create',
    { scalarFunctionName: 'ZSF', packageName: 'P', description: 'd' },
    ['description'],
  ],
  [
    'getScalarFunctionImplementation',
    'create',
    {
      implementationName: 'ZSFI',
      scalarFunctionName: 'ZSF',
      packageName: 'P',
      description: 'd',
    },
    ['description'],
  ],
  [
    'getServiceBinding',
    'create',
    {
      bindingName: 'ZSB',
      packageName: 'P',
      description: 'd',
      serviceName: 'ZS',
      serviceVersion: '0001',
      serviceDefinitionName: 'ZSD',
      bindingVariant: 'ODATA_V4_UI',
    },
    [
      'description',
      'serviceName',
      'serviceVersion',
      'serviceDefinitionName',
      'bindingVariant',
    ],
  ],
  [
    'getStructure',
    'create',
    { structureName: 'ZST', packageName: 'P', description: 'd' },
    ['description'],
  ],
  ['getRequest', 'create', { description: 'd', owner: 'OWNER' }, ['owner']],
];

function harness(clientOptions?: ConstructorParameters<typeof AdtClient>[2]) {
  const sent: IAbapRequestOptions[] = [];
  const connection = {
    makeAdtRequest: async (request: IAbapRequestOptions) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
    getBaseUrl: async () => 'https://example.test',
    getSessionId: () => 'S',
    setSessionType: () => undefined,
    connect: async () => undefined,
  } satisfies IAbapConnection;
  return { client: new AdtClient(connection, undefined, clientOptions), sent };
}

async function requestsOf(
  getter: string,
  member: string,
  config: Record<string, unknown>,
  options: Record<string, unknown> = {},
  clientOptions?: ConstructorParameters<typeof AdtClient>[2],
) {
  const { client, sent } = harness(clientOptions);
  const handler = (
    client as unknown as Record<string, () => Record<string, Member>>
  )[getter]();
  let thrown: string | undefined;
  let failed: string | undefined;
  try {
    const answer = await handler[member].call(handler, config, {
      headers,
      ...options,
    });
    if (!answer.ok) failed = answer.getError().message;
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }
  return {
    thrown,
    failed,
    sent: sent.map(({ method, url, params, data, headers: h }) => ({
      method,
      url,
      params,
      data,
      headers: h,
    })),
  };
}

describe('a member sends the same request with an optional field given or absent', () => {
  for (const [getter, member, config, optional, options] of CASES)
    it(`${getter}().${member}`, async () => {
      const table: Record<string, unknown> = {
        given: await requestsOf(getter, member, config, options),
      };
      for (const field of optional) {
        const { [field]: _left, ...without } = config;
        table[`without ${field}`] = await requestsOf(
          getter,
          member,
          without,
          options,
        );
      }
      expect(table).toMatchSnapshot();
    });

  it('getPackage().create with and without a master system', async () => {
    const config = {
      packageName: 'ZPKG',
      superPackage: 'ZSUP',
      description: 'd',
      softwareComponent: 'LOCAL',
    };
    expect({
      given: await requestsOf(
        'getPackage',
        'create',
        config,
        {},
        { masterSystem: 'SYS' },
      ),
      absent: await requestsOf('getPackage', 'create', config),
    }).toMatchSnapshot();
  });
});
