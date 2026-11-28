/**
 * The list of APIs the tables name and this package does not serve yet
 * (`helpers/notYetServed.ts`) holds only APIs with no factory: once one is
 * served, its entry leaves the list, and every exhaustive check over the
 * tables covers it again.
 */
import {
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
} from '@mcp-abap-adt/interfaces-adt';
import { AdtClient } from '../../clients/AdtClient';
import { NOT_YET_SERVED } from '../helpers/notYetServed';
import { recordingClient } from './capabilities/behaviourGuard';

/** `typeGroup` → `getTypeGroup`, the factory's name. */
const factoryOf = (api: string): string =>
  `get${api.charAt(0).toUpperCase()}${api.slice(1)}`;

describe('the APIs not served yet', () => {
  it.each(NOT_YET_SERVED)('%s is in a table', (api) => {
    expect(api in ADT_TYPES_ONPREM || api in ADT_TYPES_CLOUD).toBe(true);
  });

  it.each(NOT_YET_SERVED)('%s has no factory on the client', (api) => {
    const { client } = recordingClient();
    expect(client).toBeInstanceOf(AdtClient);
    expect(
      typeof (client as unknown as Record<string, unknown>)[factoryOf(api)],
    ).toBe('undefined');
  });
});
