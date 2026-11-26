/**
 * The enhancement lock datum of #304 (spec section 4, D1): the enhancement's
 * release takes the type it locked with from the lock itself instead of a
 * name-keyed map and a cast. `unlockAll()` on an abandoned lock sends the
 * same release as before, for the enhancement and for every other handler
 * with a tracker. The snapshot was written by the code before the change.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';

const LOCKED = readFileSync(
  join(
    __dirname,
    '../../../../corpus/adt/answers/lock-success--01-lock.body.xml',
  ),
  'utf-8',
);

const NAME = 'ZOBJ';
/** The text elements of a program. */
const TEXT_ELEMENTS = { objectKind: 'program', objectName: NAME };
/** Every name field a handler reads, so each finds its own. */
const CONFIG = Object.fromEntries(
  [
    'accessControlName',
    'appendStructureName',
    'authorizationFieldName',
    'bindingName',
    'className',
    'dataElementName',
    'ddlName',
    'domainName',
    'enhancementName',
    'featureToggleName',
    'functionGroupName',
    'functionModuleName',
    'implementationName',
    'includeName',
    'interfaceName',
    'packageName',
    'programName',
    'scalarFunctionName',
    'serviceDefinitionName',
    'serviceName',
    'structureName',
    'tableName',
    'tableTypeName',
    'transformationName',
    'testClassName',
    'objectName',
    'name',
  ].map((key) => [key, NAME]),
);

const GETTERS = [
  'getAccessControl',
  'getAppendStructure',
  'getAuthorizationField',
  'getBehaviorDefinition',
  'getClass',
  'getDataElement',
  'getDdl',
  'getDomain',
  'getFeatureToggle',
  'getFunctionGroup',
  'getInterface',
  'getMessageClass',
  'getMetadataExtension',
  'getPackage',
  'getProgram',
  'getScalarFunction',
  'getScalarFunctionImplementation',
  'getServiceDefinition',
  'getStructure',
  'getTable',
  'getTableSettings',
  'getTableType',
  'getTextElements',
  'getTransformation',
];

function client() {
  const sent: IAbapRequestOptions[] = [];
  const connection = {
    makeAdtRequest: async (request: IAbapRequestOptions) => {
      sent.push(request);
      const locking =
        String(request.url).includes('_action=LOCK') ||
        JSON.stringify(request.params ?? {}).includes('"LOCK"');
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: locking ? LOCKED : '',
      };
    },
    getBaseUrl: async () => 'https://example.test',
    getSessionId: () => 'S',
    setSessionType: () => undefined,
    connect: async () => undefined,
  } satisfies IAbapConnection;
  return { client: new AdtClient(connection), sent };
}

type Locking = { lock(config: unknown): Promise<{ ok: boolean }> };
const handlerOf = (adt: AdtClient, getter: string): Locking =>
  (adt as unknown as Record<string, (...a: unknown[]) => Locking>)[getter]();

describe('an abandoned lock is released as before', () => {
  it.each(GETTERS)('%s', async (getter) => {
    const { client: adt, sent } = client();
    const locked = await handlerOf(adt, getter).lock(
      getter === 'getTextElements' ? TEXT_ELEMENTS : CONFIG,
    );
    const pending = adt.pendingLocks;
    const before = sent.length;
    const failures = await adt.unlockAll();
    expect({
      locked: locked.ok,
      pending,
      released: sent
        .slice(before)
        .map(({ method, url, params }) => ({ method, url, params })),
      failures: failures.length,
    }).toMatchSnapshot();
  });

  it.each(['badi_implementation', 'enhoxhh', 'enhoxh'])(
    'getEnhancement, type %s',
    async (enhancementType) => {
      const { client: adt, sent } = client();
      const locked = await handlerOf(adt, 'getEnhancement').lock({
        ...CONFIG,
        enhancementType,
      });
      const before = sent.length;
      await adt.unlockAll();
      expect({
        locked: locked.ok,
        released: sent
          .slice(before)
          .map(({ method, url, params }) => ({ method, url, params })),
      }).toMatchSnapshot();
    },
  );
});
