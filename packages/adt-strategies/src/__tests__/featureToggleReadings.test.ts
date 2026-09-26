import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  featureToggleCheckState,
  featureToggleRuntimeState,
} from '../results/featureToggle';

/**
 * The feature-toggle readings moved from adt-clients. No SFW state answer is
 * in the corpus yet, so the documents are built from the field names the
 * client's parser read; they hold the shape, a capture would hold the claim.
 */
const answer = (data: string): IAdtWireResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
});

describe('featureToggleRuntimeState', () => {
  it('reads the states, normalising anything unknown to undefined', () => {
    expect(
      featureToggleRuntimeState(
        answer(
          JSON.stringify({
            STATES: {
              NAME: 'ZFTG',
              CLIENT_STATE: 'on',
              USER_STATE: 'weird',
              CLIENT_STATES: [{ CLIENT: 100, STATE: 'off' }],
              USER_STATES: [{ USER: 'DEV', STATE: 'on' }],
            },
          }),
        ),
      ),
    ).toEqual({
      name: 'ZFTG',
      clientState: 'on',
      userState: 'undefined',
      clientChangedBy: undefined,
      clientChangedOn: undefined,
      clientStates: [{ client: '100', description: undefined, state: 'off' }],
      userStates: [{ user: 'DEV', state: 'on' }],
    });
  });
});

describe('featureToggleCheckState', () => {
  it('reads the current state and the transport it would need', () => {
    expect(
      featureToggleCheckState(
        answer(
          JSON.stringify({
            RESULT: {
              CURRENT_STATE: 'off',
              TRANSPORT_PACKAGE: 'ZPKG',
              CUSTOMIZING_TRANSPORT_ALLOWED: true,
            },
          }),
        ),
      ),
    ).toEqual({
      currentState: 'off',
      transportPackage: 'ZPKG',
      transportUri: undefined,
      customizingTransportAllowed: true,
    });
  });

  it('an empty answer reads as an unknown state, not a throw', () => {
    expect(featureToggleCheckState(answer('')).currentState).toBe('undefined');
  });
});
