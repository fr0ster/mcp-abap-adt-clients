import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_STATES } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { FeatureToggleState, IFeatureToggleRuntimeState } from './types';

function normaliseState(raw: unknown): FeatureToggleState {
  if (raw === 'on' || raw === 'off' || raw === 'undefined') return raw;
  return 'undefined';
}

export async function getFeatureToggleState(
  connection: IAbapConnection,
  name: string,
): Promise<IFeatureToggleRuntimeState> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const resp = await connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/states`,
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_STATES },
  });
  const parsed =
    typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
  const s = parsed?.STATES ?? {};
  return {
    name: String(s.NAME ?? name.toUpperCase()),
    clientState: normaliseState(s.CLIENT_STATE),
    userState: normaliseState(s.USER_STATE),
    clientChangedBy: s.CLIENT_CHANGED_BY || undefined,
    clientChangedOn: s.CLIENT_CHANGED_ON || undefined,
    clientStates: Array.isArray(s.CLIENT_STATES)
      ? s.CLIENT_STATES.map((c: any) => ({
          client: String(c.CLIENT),
          description: c.DESCRIPTION || undefined,
          state: normaliseState(c.STATE),
        }))
      : [],
    userStates: Array.isArray(s.USER_STATES)
      ? s.USER_STATES.map((u: any) => ({
          user: String(u.USER),
          state: normaliseState(u.STATE),
        }))
      : [],
  };
}
