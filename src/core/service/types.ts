import type {
  GeneratedServiceType as GST,
  IResultStrategy,
  IServiceBindingConfig as ISBC,
} from '@mcp-abap-adt/interfaces';
import {
  type DesiredPublicationState,
  type GeneratedServiceType,
  SERVICE_BINDING_VARIANT_MAP,
  type ServiceBindingType,
  type ServiceBindingVariant,
  type ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces';
import { rawDocument } from '../../utils/resultStrategy';

// Types defined in @mcp-abap-adt/interfaces
export type {
  DesiredPublicationState,
  GeneratedServiceType,
  IActivateServiceBindingParams,
  ICheckServiceBindingParams,
  IClassifyServiceBindingParams,
  ICreateAndGenerateServiceBindingParams,
  ICreateAndGenerateServiceBindingParamsLegacy,
  ICreateServiceBindingParams,
  IDeleteServiceBindingParams,
  IGenerateServiceBindingParams,
  IGetServiceBindingODataParams,
  IPublishODataV2Params,
  IReadServiceBindingParams,
  IServiceBindingConfig,
  ITransportCheckServiceBindingParams,
  IUnpublishODataV2Params,
  IUpdateServiceBindingParams,
  IValidateServiceBindingParams,
  ServiceBindingType,
  ServiceBindingVariant,
  ServiceBindingVersion,
} from '@mcp-abap-adt/interfaces';
export { SERVICE_BINDING_VARIANT_MAP } from '@mcp-abap-adt/interfaces';

export function resolveBindingVariant(variant: ServiceBindingVariant): {
  bindingType: ServiceBindingType;
  bindingVersion: ServiceBindingVersion;
  bindingCategory: '0' | '1';
  serviceType: GeneratedServiceType;
} {
  return SERVICE_BINDING_VARIANT_MAP[variant];
}

/**
 * One strategy per member of a service binding implementation.
 *
 * A record rather than fourteen positional type parameters — the fourteenth
 * would be unnameable without spelling the thirteen before it, and a consumer
 * overriding one reading writes the key. `IServiceBindingResults` in the
 * contract names five of these; the rest belong to the capability atoms.
 */
export interface IServiceResults {
  /** What the create answers: the binding's own document. */
  readonly created: IResultStrategy<unknown>;
  /** What a read answers: the binding document, active or inactive. */
  readonly source: IResultStrategy<unknown>;
  /** The same document, read as metadata — a binding has no second resource. */
  readonly metadata: IResultStrategy<unknown>;
  /** What a check run answers: `chkl:messages`, whose `E` entries are the verdict. */
  readonly check: IResultStrategy<unknown>;
  /** What activation answers. */
  readonly activation: IResultStrategy<unknown>;
  /** What the pre-create transport check answers. */
  readonly validation: IResultStrategy<unknown>;
  /** What the deletion answers. */
  readonly deletion: IResultStrategy<unknown>;
  /** What a deletion check answers: `del:checkResponse`. */
  readonly deletionCheck: IResultStrategy<unknown>;
  /** What a publication change answers. */
  readonly updated: IResultStrategy<unknown>;
  /** What the transport check answers. */
  readonly transport: IResultStrategy<unknown>;
  /** The binding types this system offers. */
  readonly bindingTypes: IResultStrategy<unknown>;
  /** What generating the service answers. */
  readonly generation: IResultStrategy<unknown>;
  /** What an OData v2 or v4 read of the binding answers. */
  readonly odata: IResultStrategy<unknown>;
  /** What publishing or withdrawing answers. */
  readonly publication: IResultStrategy<unknown>;
  /** What classifying the binding answers. */
  readonly classification: IResultStrategy<unknown>;
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
  transport: rawDocument,
  bindingTypes: rawDocument,
  generation: rawDocument,
  odata: rawDocument,
  publication: rawDocument,
  classification: rawDocument,
  deletionCheck: rawDocument,
} satisfies IServiceResults;

/**
 * What a publication change needs, as this package currently understands it.
 *
 * Declared **here** rather than in `@mcp-abap-adt/interfaces` on purpose: the
 * shape is still being settled against measured ADT traffic, and a contract
 * moves to the contracts package once it does what it needs to, not before.
 *
 * **The binding and the protocol, and nothing else.** The job is posted with no
 * query string and a body that names the target by type and name, so the
 * service name and version have nowhere to go — they were derived from the
 * binding's own document by a read that made this member two requests, and both
 * the read and the fields went. `serviceType` stays because it selects the
 * endpoint (`odatav2` or `odatav4`), and a caller holding a binding knows it
 * from the variant.
 *
 * There is no `publishODataV2` and no `publishODataV4`: the protocol is a
 * **parameter**, not a method name. Two members that differ only by a value
 * they could have taken as an argument are two names for one endpoint.
 */
/**
 * What a caller must name to change a binding's publication, **in the signature
 * they call**.
 *
 * `Partial<IServiceBindingConfig>` is what `IAdtUpdatable` gives every other
 * type, and for a binding it is too loose in two ways a compiler could catch:
 * `serviceType` is optional there, and `desiredPublicationState` still admits
 * `'unchanged'`. Both compiled and then threw before reaching the wire, which
 * is a demand made where the caller cannot see it.
 */
export type IServiceBindingPublicationConfig = Partial<ISBC> & {
  /** Which binding. Without it there is no object to publish. */
  bindingName: string;
  /** `unchanged` is not one of them: there is no request that changes nothing. */
  desiredPublicationState: 'published' | 'unpublished';
  /** Selects the endpoint, `odatav2` or `odatav4`. */
  serviceType: GST;
};

export interface IServiceBindingPublicationParams {
  bindingName: string;
  /**
   * `published` or `unpublished`. `unchanged` is refused: a binding's update
   * *is* its publication, so there is no request that changes nothing.
   */
  desiredPublicationState: DesiredPublicationState;
  /**
   * Which endpoint the job goes to — `odatav2` or `odatav4`.
   *
   * Required, and required *in the type*: it is the one thing the URL needs
   * that the binding's name does not give, and this package no longer reads the
   * binding to find it out. Optional here with a throw in the implementation
   * would be the same demand made twice, once where a caller cannot see it.
   */
  serviceType: GeneratedServiceType;
  /**
   * How long to wait for the publication job, in milliseconds.
   *
   * A publication is the slowest request this library makes — ~135s measured on
   * a trial, and one unpublish still unsettled after eleven minutes — so the
   * 120s `SAP_TIMEOUT_LONG` default is a floor. `IAdtOperationOptions.timeout`
   * has carried this all along and `update` used to drop it, which left a
   * caller no way to wait longer than the library had decided to.
   */
  timeout?: number;
}

/**
 * What identifies the OData service group a binding publishes.
 *
 * Declared here for the same reason as
 * {@link IServiceBindingPublicationParams}: the shape is being settled against
 * measured traffic before it moves to `@mcp-abap-adt/interfaces`.
 *
 * The difference from `IGetServiceBindingODataParams` there is `serviceType`.
 * The contract has none, so the protocol had to live in the method name —
 * `getODataV2ServiceBinding` and `getODataV4ServiceBinding`, one endpoint under
 * two names differing by a value they could have taken as an argument.
 */
export interface IServiceGroupParams {
  /** The binding, as the URL addresses it. */
  objectname: string;
  /** Which protocol's service group to read. */
  serviceType: GeneratedServiceType;
  servicename?: string;
  serviceversion?: string;
  srvdname?: string;
}
