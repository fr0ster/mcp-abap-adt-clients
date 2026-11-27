import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { updateFeatureToggle } from '../../../core/featureToggle/update';
import { uploadFeatureToggleSource } from '../../../core/featureToggle/updateSource';
import { updateFunctionGroup } from '../../../core/functionGroup/update';

/**
 * C7 of #304: the lock handle is required where it is sent, so the three
 * writers that dropped an absent handle now always send the handle given —
 * an empty one included, which they used to leave out.
 */
function recorder() {
  const sent: IAbapRequestOptions[] = [];
  const connection: IAbapConnection = {
    makeAdtRequest: async (request) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
    getBaseUrl: async () => '',
    getSessionId: () => null,
    setSessionType: () => undefined,
    connect: async () => undefined,
  };
  return { connection, sent };
}
const headers = { accept: 'a', contentType: 'c' };

describe('a write sends the lock handle it is given', () => {
  it('updateFunctionGroup, an empty handle included', async () => {
    const { connection, sent } = recorder();
    await updateFunctionGroup(
      connection,
      headers,
      undefined,
      { function_group_name: 'ZFG', lock_handle: '' },
      '<doc/>',
    );
    expect(sent[0]?.url).toBe('/sap/bc/adt/functions/groups/zfg?lockHandle=');
  });

  it('updateFeatureToggle, an empty handle included', async () => {
    const { connection, sent } = recorder();
    await updateFeatureToggle(
      connection,
      headers,
      undefined,
      { feature_toggle_name: 'ZFT', package_name: 'P' },
      '',
    );
    expect(sent[0]?.params).toEqual({ lockHandle: '' });
  });

  it('uploadFeatureToggleSource, an empty handle included', async () => {
    const { connection, sent } = recorder();
    await uploadFeatureToggleSource(
      connection,
      headers,
      undefined,
      'ZFT',
      undefined,
      '',
    );
    expect(sent[0]?.params).toEqual({ lockHandle: '' });
  });
});
