import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FEATURE_TOGGLE_CHECK_RESULT,
  CT_FEATURE_TOGGLE_CHECK_PARAMETERS,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type {
  FeatureToggleState,
  IFeatureToggleCheckStateResult,
} from './types';

function normaliseState(raw: unknown): FeatureToggleState {
  if (raw === 'on' || raw === 'off' || raw === 'undefined') return raw;
  return 'undefined';
}

export async function checkFeatureToggleState(
  connection: IAbapConnection,
  name: string,
  opts?: { userSpecific?: boolean },
): Promise<IFeatureToggleCheckStateResult> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const body = {
    PARAMETERS: { IS_USER_SPECIFIC: Boolean(opts?.userSpecific) },
  };
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/check`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_CHECK_PARAMETERS,
      Accept: ACCEPT_FEATURE_TOGGLE_CHECK_RESULT,
    },
    data: JSON.stringify(body),
  });
  const parsed =
    typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
  const r = parsed?.RESULT ?? {};
  return {
    currentState: normaliseState(r.CURRENT_STATE),
    transportPackage: r.TRANSPORT_PACKAGE || undefined,
    transportUri: r.TRANSPORT_URI || undefined,
    customizingTransportAllowed: Boolean(r.CUSTOMIZING_TRANSPORT_ALLOWED),
  };
}
