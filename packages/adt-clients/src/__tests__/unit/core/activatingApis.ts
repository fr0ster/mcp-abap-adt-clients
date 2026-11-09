/**
 * The activation members, taken from the ADT type tables of
 * `@mcp-abap-adt/interfaces-adt`: every API that a table serves `activate`
 * on, on premise or on the cloud. Each is driven through its factory, typed
 * as the member these tests call ({@link IActivating}: the compiler checks
 * each handler against it), and the capability manifest's configuration. A
 * new API with `activate` is in the tables' list at once, and the test that
 * compares the two lists fails until a factory is written here.
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
import type { AdtClient } from '../../../clients/AdtClient';
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

/** The APIs a type table serves `activate` on, as the tables name them. */
const TABLES: AdtApiTable<string>[] = [ADT_TYPES_ONPREM, ADT_TYPES_CLOUD];
export const TABLE_ACTIVATING_APIS: string[] = [
  ...new Set(
    TABLES.flatMap((table) =>
      Object.entries(table)
        .filter(([, entry]) => activates(entry))
        .map(([api]) => api),
    ),
  ),
].sort();

/**
 * Each activating API's factory, answering the member as {@link IActivating}.
 * The return type is checked against each handler: no cast.
 */
const ACTIVATING = {
  accessControl: (c: AdtClient): IActivating => c.getAccessControl(),
  appendStructure: (c: AdtClient): IActivating => c.getAppendStructure(),
  authorizationField: (c: AdtClient): IActivating => c.getAuthorizationField(),
  behaviorDefinition: (c: AdtClient): IActivating => c.getBehaviorDefinition(),
  behaviorImplementation: (c: AdtClient): IActivating =>
    c.getBehaviorImplementation(),
  class: (c: AdtClient): IActivating => c.getClass(),
  dataElement: (c: AdtClient): IActivating => c.getDataElement(),
  ddl: (c: AdtClient): IActivating => c.getDdl(),
  domain: (c: AdtClient): IActivating => c.getDomain(),
  enhancement: (c: AdtClient): IActivating => c.getEnhancement(),
  featureToggle: (c: AdtClient): IActivating => c.getFeatureToggle(),
  functionGroup: (c: AdtClient): IActivating => c.getFunctionGroup(),
  functionInclude: (c: AdtClient): IActivating => c.getFunctionInclude(),
  functionModule: (c: AdtClient): IActivating => c.getFunctionModule(),
  include: (c: AdtClient): IActivating => c.getInclude(),
  interface: (c: AdtClient): IActivating => c.getInterface(),
  localDefinitions: (c: AdtClient): IActivating => c.getLocalDefinitions(),
  localMacros: (c: AdtClient): IActivating => c.getLocalMacros(),
  localTestClass: (c: AdtClient): IActivating => c.getLocalTestClass(),
  localTypes: (c: AdtClient): IActivating => c.getLocalTypes(),
  metadataExtension: (c: AdtClient): IActivating => c.getMetadataExtension(),
  program: (c: AdtClient): IActivating => c.getProgram(),
  scalarFunction: (c: AdtClient): IActivating => c.getScalarFunction(),
  scalarFunctionImplementation: (c: AdtClient): IActivating =>
    c.getScalarFunctionImplementation(),
  serviceBinding: (c: AdtClient): IActivating => c.getServiceBinding(),
  serviceDefinition: (c: AdtClient): IActivating => c.getServiceDefinition(),
  structure: (c: AdtClient): IActivating => c.getStructure(),
  table: (c: AdtClient): IActivating => c.getTable(),
  tableType: (c: AdtClient): IActivating => c.getTableType(),
  transformation: (c: AdtClient): IActivating => c.getTransformation(),
};

export type ActivatingApi = keyof typeof ACTIVATING;

function isActivatingApi(name: string): name is ActivatingApi {
  return Object.hasOwn(ACTIVATING, name);
}

/** The APIs this file drives; equal to {@link TABLE_ACTIVATING_APIS}. */
export const ACTIVATING_APIS: ActivatingApi[] = Object.keys(ACTIVATING)
  .filter(isActivatingApi)
  .sort();

/**
 * The member of `api`, over a recording connection that answers every
 * activation request with `activationBody`, with the manifest's config.
 */
export function activatingHandler(
  api: ActivatingApi,
  activationBody: string = ACTIVATION_OK,
) {
  const { client, calls } = recordingClient(activationBody);
  return {
    handler: ACTIVATING[api](client),
    config: HANDLERS[api].config,
    calls,
  };
}
