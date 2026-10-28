/**
 * What phase 2 of the full run may send, enforced in the tool's own gate
 * (`gate()` in capture.ts): a request whose endpoint `--except` names, `--only`
 * does not select, or phase 1 recorded as unauthorized never reaches the
 * connection — not a member's own request, not a request of its internal
 * chain, not a setup request (a parent object, a lock, an activation). The
 * gate's cleanup sibling is exempt: removing and unlocking what phase 2
 * itself made always runs.
 *
 * The endpoint of a request is its method and path template, the key the
 * corpus rows use (`{name}` for an object's name, `_action` for LOCK and the
 * like). A `--except` / `--only` text names a member of phase 1 (`getX().read`,
 * resolved to the endpoints phase 1 recorded for it) or a part of a path
 * (`/bopf/`); both readings count.
 */

import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { endpointKey, endpointOf, type ISentRequest } from './record';

/** The reason a request is not sent, or `undefined`. */
export type Refusal = (
  request: Pick<IAbapRequestOptions, 'method' | 'url' | 'params'>,
) => string | undefined;

/** Held by the gate: phase 2 sets `current` when it starts. */
export interface IRefusalHolder {
  current?: Refusal;
}

export interface IPhase2Refusal {
  only?: readonly string[] | undefined;
  except?: readonly string[] | undefined;
  /** Phase 1's clients members and the requests each recorded, by `handler.member`. */
  members: ReadonlyMap<string, readonly ISentRequest[]>;
  /** The endpoints of the phase-1 rows marked unauthorized. */
  unauthorized: readonly ISentRequest[];
}

/** The envelope endpoint: its parts are checked one by one, the envelope itself is not a request of a member. */
const ENVELOPE = '/sap/bc/adt/communication/batch';

/** Whether a request is the endpoint `template` names: `{name}` stands for one path segment. */
function matches(
  template: ISentRequest,
  request: ISentRequest,
  realPath: string,
): boolean {
  if (template.method !== request.method) return false;
  if ((template.action ?? '') !== (request.action ?? '')) return false;
  const wanted = template.path.split('/');
  const got = realPath.split('/');
  return (
    wanted.length === got.length &&
    wanted.every(
      (segment, index) =>
        segment === '{name}' ||
        segment.toLowerCase() === (got[index] ?? '').toLowerCase(),
    )
  );
}

export function phase2Refusal(filter: IPhase2Refusal): Refusal {
  const only = filter.only?.length ? filter.only : undefined;
  const except = filter.except ?? [];
  /** The endpoints a text names: those of the members it matches. */
  const endpointsOf = (text: string): ISentRequest[] =>
    [...filter.members]
      .filter(([member]) => member.includes(text))
      .flatMap(([, requests]) => [...requests]);
  const named = (
    text: string,
    request: ISentRequest,
    path: string,
  ): boolean =>
    path.toLowerCase().includes(text.toLowerCase()) ||
    endpointsOf(text).some((endpoint) => matches(endpoint, request, path));
  return (sent) => {
    const path = sent.url.split('?')[0] ?? '';
    if (path === ENVELOPE) return undefined;
    const request = endpointOf(sent.method, sent.url, sent.params, []);
    const refused = filter.unauthorized.find((endpoint) =>
      matches(endpoint, request, path),
    );
    if (refused)
      return `not authorized for this user: ${endpointKey(refused)}`;
    const text = except.find((part) => named(part, request, path));
    if (text !== undefined) return `excluded by --except: ${text}`;
    if (only && !only.some((part) => named(part, request, path)))
      return 'not selected by --only';
    return undefined;
  };
}
