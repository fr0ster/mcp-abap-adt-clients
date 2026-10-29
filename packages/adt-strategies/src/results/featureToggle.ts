import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { field, leafText } from '../parsed';

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

/** The answer's body, parsed. JSON is data from outside the type system. */
function json(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  if (data.trim() === '') return {};
  // Our own reading failing on a document is ours, and it throws — the
  // library runs a result strategy outside its catch for that reason.
  return JSON.parse(data);
}

/** A text field, or `undefined` when it is empty or no text. */
function optionalText(node: unknown, key: string): string | undefined {
  return leafText(field(node, key)) || undefined;
}

/** `getRuntimeState`'s answer, read. */
export const featureToggleRuntimeState: IResultStrategy<
  IFeatureToggleRuntimeState
> = (answer) => {
  const s = field(json(answer.data), 'STATES') ?? {};
  const clientStates = field(s, 'CLIENT_STATES');
  const userStates = field(s, 'USER_STATES');
  return {
    name: String(field(s, 'NAME') ?? ''),
    clientState: state(field(s, 'CLIENT_STATE')),
    userState: state(field(s, 'USER_STATE')),
    clientChangedBy: optionalText(s, 'CLIENT_CHANGED_BY'),
    clientChangedOn: optionalText(s, 'CLIENT_CHANGED_ON'),
    clientStates: Array.isArray(clientStates)
      ? clientStates.map((c: unknown) => ({
          client: String(field(c, 'CLIENT')),
          description: optionalText(c, 'DESCRIPTION'),
          state: state(field(c, 'STATE')),
        }))
      : [],
    userStates: Array.isArray(userStates)
      ? userStates.map((u: unknown) => ({
          user: String(field(u, 'USER')),
          state: state(field(u, 'STATE')),
        }))
      : [],
  };
};

/** `checkState`'s answer, read. */
export const featureToggleCheckState: IResultStrategy<
  IFeatureToggleCheckState
> = (answer) => {
  const r = field(json(answer.data), 'RESULT') ?? {};
  return {
    currentState: state(field(r, 'CURRENT_STATE')),
    transportPackage: optionalText(r, 'TRANSPORT_PACKAGE'),
    transportUri: optionalText(r, 'TRANSPORT_URI'),
    customizingTransportAllowed: Boolean(
      field(r, 'CUSTOMIZING_TRANSPORT_ALLOWED'),
    ),
  };
};
