/**
 * C5 of #304: the 20 types a legacy system does not have are handed out as
 * handlers whose every operation refuses. Equivalence: each operation answers
 * the same refusal (origin, code and message, snapshotted from the record
 * built by `absentOnLegacy`) and sends no request, and handing one out sends
 * none. Intended change: each is an instance of the modern class and of its
 * `*AbsentLegacy` class, and every public member of the modern class is
 * overridden on it.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

export const ABSENT_GETTERS = [
  'getDomain',
  'getDataElement',
  'getStructure',
  'getTable',
  'getTableSettings',
  'getTextElements',
  'getTableType',
  'getAccessControl',
  'getServiceDefinition',
  'getServiceBinding',
  'getBehaviorDefinition',
  'getBehaviorImplementation',
  'getMetadataExtension',
  'getEnhancement',
  'getAuthorizationField',
  'getFeatureToggle',
  'getTransformation',
  'getScalarFunction',
  'getScalarFunctionImplementation',
  'getAppendStructure',
] as const;

function recording() {
  const sent: string[] = [];
  const connection = {
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (request: { method: string; url: string }) => {
      sent.push(`${request.method} ${request.url}`);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
  } as unknown as IAbapConnection;
  return { connection, sent };
}

type Call = (...args: unknown[]) => Promise<unknown>;

/** The handler a getter answers, untyped: what is on it is the subject. */
function handlerOf(client: AdtClientLegacy, getter: string): object {
  const factory = Reflect.get(client, getter) as () => object;
  return factory.call(client);
}

/** Every function name on the handler's prototype chain, as `absentOnLegacy` listed them. */
function operationsOf(handler: object): string[] {
  const names = new Set<string>();
  for (const own of Object.keys(handler))
    if (typeof Reflect.get(handler, own) === 'function') names.add(own);
  let proto: unknown = Object.getPrototypeOf(handler);
  while (
    typeof proto === 'object' &&
    proto !== null &&
    proto !== Object.prototype
  ) {
    for (const name of Object.getOwnPropertyNames(proto))
      if (
        name !== 'constructor' &&
        typeof Reflect.get(proto, name) === 'function'
      )
        names.add(name);
    proto = Object.getPrototypeOf(proto);
  }
  return [...names].sort();
}

describe('an absent legacy handler refuses every operation, as before', () => {
  it.each(ABSENT_GETTERS)('%s: handing it out sends nothing', (getter) => {
    const { connection, sent } = recording();
    handlerOf(new AdtClientLegacy(connection), getter);
    expect(sent).toEqual([]);
  });

  it.each(ABSENT_GETTERS)(
    '%s: each operation answers the same refusal and sends nothing',
    async (getter) => {
      const { connection, sent } = recording();
      const handler = handlerOf(new AdtClientLegacy(connection), getter);
      const refusals: Record<string, unknown> = {};
      for (const name of operationsOf(handler).filter((n) => !PRIVATE.has(n))) {
        const fn = Reflect.get(handler, name) as Call;
        const answer = (await fn.call(handler)) as {
          ok: boolean;
          getError: () => { origin: string; code: string; message: string };
        };
        expect(answer.ok).toBe(false);
        const { origin, code, message } = answer.getError();
        refusals[name] = { origin, code, message };
      }
      expect(sent).toEqual([]);
      expect({
        objectType: Reflect.get(handler, 'objectType'),
        refusals,
      }).toMatchSnapshot();
    },
  );
});

/**
 * The modern classes' private helpers: the old record refused them too; the
 * subclass keeps them modern (TS2415), reached only from the operations it
 * overrides. Not called here.
 */
const PRIVATE = new Set([
  'name',
  'enhancementType',
  'createParams',
  'deleteParams',
  'switchTo',
  'buildServiceBindingCreateXml',
  'buildTransportCheckXml',
  'buildDeletionXml',
  'publishByServiceType',
  'unpublishByServiceType',
  'bindingTypesRequest',
  'deletionCheckRequest',
  'transportCheckRequest',
  'createRequest',
  'readRequest',
  'updateRequest',
  'deleteRequest',
  'checkRequest',
  'activateRequest',
  'serviceGroupRequest',
]);
