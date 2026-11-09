/**
 * The activation members, taken from the ADT type tables of
 * `@mcp-abap-adt/interfaces-adt`: every API that a table serves `activate`
 * on, on premise or on the cloud, driven through the capability manifest's
 * factory and configuration. A new API with `activate` is in this list at
 * once; a test over it fails until the manifest can drive it.
 */
import {
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  type AdtApiEntry,
  type AdtApiTable,
  type IAdtCodeFacts,
  type IAdtHeaders,
  type IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import { ACTIVATION_OK, recordingClient } from '../capabilities/behaviourGuard';
import { HANDLERS } from '../capabilities/manifest';

/** What every activation member takes, as these tests call it. */
export interface IActivating {
  activate(
    config: object,
    options: {
      headers: IAdtHeaders;
      preauditRequested?: boolean;
      analyse?: IAnalyse;
    },
  ): Promise<unknown>;
}

/** Whether an entry of a type table serves `activate`. */
function activates(entry: AdtApiEntry<string> | undefined): boolean {
  if (entry === undefined) return false;
  const byCode = Object.values(entry.codes).flatMap(
    (facts: IAdtCodeFacts<string>) => facts.operations,
  );
  const own = entry.operations ?? [];
  return [...own, ...byCode].includes('activate');
}

/** The APIs a type table serves `activate` on. */
const TABLES: AdtApiTable<string>[] = [ADT_TYPES_ONPREM, ADT_TYPES_CLOUD];
export const ACTIVATING_APIS: string[] = [
  ...new Set(
    TABLES.flatMap((table) =>
      Object.entries(table)
        .filter(([, entry]) => activates(entry))
        .map(([api]) => api),
    ),
  ),
].sort();

/**
 * The member of `api`, over a recording connection that answers every
 * activation request with `activationBody`.
 */
export function activatingHandler(
  api: string,
  activationBody: string = ACTIVATION_OK,
) {
  if (!(api in HANDLERS)) throw new Error(`no manifest entry for ${api}`);
  const entry = HANDLERS[api as keyof typeof HANDLERS];
  const { client, calls } = recordingClient(activationBody);
  const handler = entry.factory(client) as unknown as IActivating;
  return { handler, config: entry.config, calls };
}
