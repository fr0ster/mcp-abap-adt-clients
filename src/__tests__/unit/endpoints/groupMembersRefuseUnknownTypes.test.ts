/**
 * An object type with no address is refused before any request — by the
 * public members, not only by buildObjectUri. Inside `answering` the throw
 * would come back as a resolved `connection` failure, telling the caller to
 * check the network about an argument of theirs.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtUtils } from '../../../core/shared/AdtUtils';

const makeAdtRequest = jest.fn();
const connection = {
  setSessionType: jest.fn(),
  isConnected: () => true,
  makeAdtRequest,
} as unknown as IAbapConnection;
const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as ILogger;

const utils = () => new AdtUtils(connection, logger);
const unknown = [{ name: 'ZX', type: 'ABCD/XY' }];
const untyped = [{ name: 'ZCL_X' }];
const moduleWithoutGroup = [{ name: 'Z_FM', type: 'FUGR/FF' }];

describe('group members refuse an object they cannot address', () => {
  beforeEach(() => makeAdtRequest.mockClear());

  it.each([
    ['activateObjectsGroup', (o: never) => utils().activateObjectsGroup(o)],
    ['checkDeletionGroup', (o: never) => utils().checkDeletionGroup(o)],
    ['deleteObjectsGroup', (o: never) => utils().deleteObjectsGroup(o)],
  ])('%s throws before any request', async (_name, call) => {
    for (const objects of [unknown, untyped, moduleWithoutGroup]) {
      await expect(call(objects as never)).rejects.toThrow();
    }
    expect(makeAdtRequest).not.toHaveBeenCalled();
  });
});
