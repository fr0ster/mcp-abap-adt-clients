import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';

/**
 * Readings of what the SFW state resources answer for a feature toggle.
 *
 * Moved from adt-clients, whose `getRuntimeState` and `checkState` parsed the
 * JSON and normalised every state for every caller. The client answers the
 * documents as they arrived now; a caller who wants these shapes passes them
 * for the `runtimeState` and `checkState` slots. One difference: the old
 * reading fell back to the toggle's name when the document had no `NAME` —
 * a strategy knows only the answer, so it reports what is there.
 */

/** `on`, `off`, or `undefined` for anything else the server writes. */
export type FeatureToggleState = 'on' | 'off' | 'undefined';

/** One client's setting of a toggle. */
export interface IFeatureToggleClientLevel {
  client: string;
  description?: string;
  state: FeatureToggleState;
}

/** One user's setting of a toggle. */
export interface IFeatureToggleUserLevel {
  user: string;
  state: FeatureToggleState;
}

/** What it is set to, for whom, and by whom last. */
export interface IFeatureToggleRuntimeState {
  name: string;
  clientState: FeatureToggleState;
  userState: FeatureToggleState;
  clientChangedBy?: string;
  clientChangedOn?: string;
  clientStates: IFeatureToggleClientLevel[];
  userStates: IFeatureToggleUserLevel[];
}

/** The current state and what a change would need. */
export interface IFeatureToggleCheckState {
  currentState: FeatureToggleState;
  transportPackage?: string;
  transportUri?: string;
  customizingTransportAllowed: boolean;
}

function state(raw: unknown): FeatureToggleState {
  return raw === 'on' || raw === 'off' || raw === 'undefined'
    ? raw
    : 'undefined';
}

function json(data: unknown): any {
  if (typeof data !== 'string') return data;
  if (data.trim() === '') return {};
  // Our own reading failing on a document is ours, and it throws — the
  // library runs a result strategy outside its catch for that reason.
  return JSON.parse(data);
}

/** `getRuntimeState`'s answer, read. */
export const featureToggleRuntimeState: IResultStrategy<
  IFeatureToggleRuntimeState
> = (answer) => {
  const s = json(answer.data)?.STATES ?? {};
  return {
    name: String(s.NAME ?? ''),
    clientState: state(s.CLIENT_STATE),
    userState: state(s.USER_STATE),
    clientChangedBy: s.CLIENT_CHANGED_BY || undefined,
    clientChangedOn: s.CLIENT_CHANGED_ON || undefined,
    clientStates: Array.isArray(s.CLIENT_STATES)
      ? s.CLIENT_STATES.map((c: any) => ({
          client: String(c.CLIENT),
          description: c.DESCRIPTION || undefined,
          state: state(c.STATE),
        }))
      : [],
    userStates: Array.isArray(s.USER_STATES)
      ? s.USER_STATES.map((u: any) => ({
          user: String(u.USER),
          state: state(u.STATE),
        }))
      : [],
  };
};

/** `checkState`'s answer, read. */
export const featureToggleCheckState: IResultStrategy<
  IFeatureToggleCheckState
> = (answer) => {
  const r = json(answer.data)?.RESULT ?? {};
  return {
    currentState: state(r.CURRENT_STATE),
    transportPackage: r.TRANSPORT_PACKAGE || undefined,
    transportUri: r.TRANSPORT_URI || undefined,
    customizingTransportAllowed: Boolean(r.CUSTOMIZING_TRANSPORT_ALLOWED),
  };
};
