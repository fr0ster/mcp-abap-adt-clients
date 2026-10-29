import type { IServiceResults } from '@mcp-abap-adt/interfaces-adt';
import {
  type DesiredPublicationState,
  type GeneratedServiceType,
  SERVICE_BINDING_VARIANT_MAP,
  type ServiceBindingType,
  type ServiceBindingVariant,
  type ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces-adt';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  DesiredPublicationState,
  GeneratedServiceType,
  ICreateAndGenerateServiceBindingParams,
  ICreateServiceBindingParams,
  IServiceBindingConfig,
  ServiceBindingType,
  ServiceBindingVariant,
  ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces-adt';
export { SERVICE_BINDING_VARIANT_MAP } from '@mcp-abap-adt/interfaces-adt';

export function resolveBindingVariant(variant: ServiceBindingVariant): {
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory: '0' | '1';
  serviceType: GeneratedServiceType;
} {
  return SERVICE_BINDING_VARIANT_MAP[variant];
}

/**
 * The shipped default: every member answers its document as it arrived.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const serviceDocuments = {
  created: rawDocument,
  source: rawDocument,
  metadata: rawDocument,
  check: rawDocument,
  activation: rawDocument,
  validation: rawDocument,
  deletion: rawDocument,
  updated: rawDocument,
  metadataUpdated: rawDocument,
  transport: rawDocument,
  bindingTypes: rawDocument,
  odata: rawDocument,
  publication: rawDocument,
  deletionCheck: rawDocument,
} satisfies IServiceResults;

/**
 * What a publication job needs, which is not the same for the two protocols.
 *
 * **V2 requires the service name and version; V4 does not.** Measured on an ABAP Cloud system,
 * 2026-09-29, on one binding per protocol with a known publication state and a
 * single job each — the only difference being the query string:
 *
 * ```
 * odatav2, no query string : "Local un-publish of service ␠ with version 0000
 *                             failed — Service ZMCP_PRV_SB version ␠ does not exist."
 * odatav2, with it         : 200, SEVERITY OK,
 *                           "service ZMCP_PRV_SB with version 0001 un-published locally"
 * odatav4, no query string : 200, SEVERITY OK
 * ```
 *
 * The blanks in the V2 refusal are the server saying it had nothing to resolve: the
 * body names the target by type (`SCGR`) and name, and for V2 that is not enough.
 * A capture of Eclipse showed no query string and the job answered `SEVERITY OK`,
 * which is where this package dropped the two fields — a measurement from one
 * system, and it did not hold for V2.
 *
 * So the demand lives in the TYPE, per protocol, rather than as an optional field
 * with a throw a caller cannot see. V4 is left exactly as it was measured working:
 * whether it also accepts the query string was never measured, and a change nobody
 * has measured is not an improvement.
 */
export type IServiceBindingPublicationParams =
  | IServiceBindingPublicationV2Params
  | IServiceBindingPublicationV4Params;

/** The fields both protocols need. */
interface IServiceBindingPublicationCommon {
  bindingName: string;
  /**
   * `published` or `unpublished`. `unchanged` is refused: a binding's update
   * *is* its publication, so there is no request that changes nothing.
   */
  desiredPublicationState: DesiredPublicationState;
  /**
   * How long to wait for the publication job, in milliseconds.
   *
   * A publication is the slowest request this library makes — ~135s measured on
   * the ABAP Cloud system, and one unpublish still unsettled after eleven minutes. Absent, the
   * request carries no deadline: it waits for SAP's answer.
   */
  timeout?: number;
}

/** OData V2, where the job resolves the service by name and version. */
export interface IServiceBindingPublicationV2Params
  extends IServiceBindingPublicationCommon {
  serviceType: 'odatav2';
  /**
   * `srvb:services/@srvb:name`. **Required**: without it the job answers a
   * refusal naming an empty service and version `0000`.
   */
  serviceName: string;
  /** `srvb:content/@srvb:version`, e.g. `0001`. Required for the same reason. */
  serviceVersion: string;
}

/** OData V4, where the body alone names the target. */
export interface IServiceBindingPublicationV4Params
  extends IServiceBindingPublicationCommon {
  serviceType: 'odatav4';
}

/**
 * The shapes below describe the argument of the request builders in this
 * module, and they used to be declared in `@mcp-abap-adt/interfaces`. Nobody
 * outside this package ever accepted them — no parameter, field or return
 * anywhere else was typed by one — and being nobody's contract is how 85 of
 * their fields came to be ignored by the very code that took them, for
 * releases, unnoticed. They live here now, beside the function that reads
 * them, which is the only place that can keep them honest. See decision 30 in
 * the interfaces repository.
 */

export interface IActivateServiceBindingParams {
  bindingName: string;
  preauditRequested?: boolean;
}

export interface ICheckServiceBindingParams {
  bindingName: string;
  version?: 'active' | 'inactive';
}

export interface IDeleteServiceBindingParams {
  bindingName: string;
  transportRequest?: string;
}

export interface IGetServiceBindingODataParams {
  objectname: string;
  servicename?: string;
  serviceversion?: string;
  srvdname?: string;
}

export interface IPublishODataV2Params {
  servicename: string;
  serviceversion?: string;
}

export interface IReadServiceBindingParams {
  bindingName: string;
  version?: 'active' | 'inactive';
}

export interface ITransportCheckServiceBindingParams {
  objectName: string;
  packageName: string;
  description?: string;
  operation?: 'I' | 'U' | 'D';
}

export interface IUnpublishODataV2Params {
  servicename: string;
  serviceversion?: string;
}

export interface IUpdateServiceBindingParams {
  bindingName: string;
  desiredPublicationState: DesiredPublicationState;
  serviceType: GeneratedServiceType;
  serviceName: string;
  serviceVersion?: string;
}

export interface IValidateServiceBindingParams {
  objname: string;
  serviceDefinition: string;
  serviceBindingVersion?: string;
  description?: string;
  package?: string;
}
