/**
 * An object type a legacy system does not have is still handed out, and says
 * so through the contract.
 *
 * Decision 11, "The exception: legacy endpoints": every member answers a
 * refusal and sends no request. Until this, the factory threw before any
 * request, so a caller holding `AdtClient` crashed where the modern client
 * returned a handler.
 */
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtClient } from '../../../clients/AdtClient';
import { AdtClientLegacy } from '../../../clients/AdtClientLegacy';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const makeAdtRequest = jest.fn();
const connection = {
  setSessionType: jest.fn(),
  isConnected: () => true,
  makeAdtRequest,
} as unknown as IAbapConnection;

const absent = [
  'getDomain',
  'getDataElement',
  'getStructure',
  'getTable',
  'getTableType',
  'getAccessControl',
  'getServiceDefinition',
  'getServiceBinding',
  'getService',
  'getBehaviorDefinition',
  'getBehaviorImplementation',
  'getMetadataExtension',
  'getEnhancement',
  'getAuthorizationField',
  'getFeatureToggle',
] as const;

type Handler = Record<string, (...args: unknown[]) => Promise<unknown>>;

function handlerOf(client: AdtClient, getter: string): Handler {
  return (client as unknown as Record<string, () => Handler>)[getter]();
}

/** Every callable member, own or inherited — fields included. */
function membersOf(handler: object): string[] {
  const names = new Set<string>();
  for (const [name, value] of Object.entries(handler)) {
    if (typeof value === 'function') names.add(name);
  }
  let proto: object | null = Object.getPrototypeOf(handler);
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      const value = Object.getOwnPropertyDescriptor(proto, name)?.value;
      if (name !== 'constructor' && typeof value === 'function') {
        names.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return [...names].sort();
}

describe('AdtClientLegacy: object types absent on legacy', () => {
  const legacy = new AdtClientLegacy(connection, logger);
  const modern = new AdtClient(connection, logger);

  beforeEach(() => makeAdtRequest.mockClear());

  it.each(absent)('%s is handed out rather than thrown', (getter) => {
    expect(() => handlerOf(legacy, getter)).not.toThrow();
  });

  it.each(absent)("%s carries the modern handler's objectType", (getter) => {
    const legacyType = (handlerOf(legacy, getter) as { objectType?: unknown })
      .objectType;
    expect(typeof legacyType).toBe('string');
    expect(legacyType).toBe(
      (handlerOf(modern, getter) as { objectType?: unknown }).objectType,
    );
  });

  it.each(absent)('%s offers every member the modern handler has', (getter) => {
    expect(membersOf(handlerOf(legacy, getter))).toEqual(
      membersOf(handlerOf(modern, getter)),
    );
  });

  it.each(
    absent,
  )('%s answers a refusal from every member, without a request', async (getter) => {
    const handler = handlerOf(legacy, getter);
    const members = membersOf(handler);
    expect(members.length).toBeGreaterThan(0);

    for (const member of members) {
      const answer = (await handler[member]({})) as {
        ok: boolean;
        getError: () => { origin: string; code: string; message: string };
      };
      expect(answer.ok).toBe(false);
      const error = answer.getError();
      expect(error.origin).toBe('refusal');
      expect(error.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
      expect(error.message).toContain('/sap/bc/adt/');
    }
    expect(makeAdtRequest).not.toHaveBeenCalled();
  });
});
