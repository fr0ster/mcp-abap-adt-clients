/**
 * Package create operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreatePackageParams } from './types';

/**
 * Create ABAP package via single ADT POST (no validation or follow-up checks).
 */
export async function createPackage(
  connection: IAbapConnection,
  params: ICreatePackageParams,
): Promise<AxiosResponse> {
  if (!params.package_name) {
    throw new Error('Package name is required');
  }

  const url = `/sap/bc/adt/packages`;

  const escapeXml = (str: string | undefined): string =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // Description is limited to 60 characters in SAP ADT
  const description = escapeXml(
    limitDescription(params.description || params.package_name),
  );
  const packageType = params.package_type || 'development';

  const masterSystem = params.masterSystem;
  const responsibleUser = params.responsible || '';

  // Software component is required for package creation
  if (!params.software_component) {
    throw new Error('Software component is required for package creation');
  }
  const softwareComponentXml = `<pak:softwareComponent pak:name="${escapeXml(params.software_component)}"/>`;

  const transportLayerXml = params.transport_layer
    ? `<pak:transportLayer pak:name="${escapeXml(params.transport_layer)}"/>`
    : '<pak:transportLayer/>';

  const applicationComponentXml = params.application_component
    ? `<pak:applicationComponent pak:name="${escapeXml(params.application_component)}"/>`
    : '<pak:applicationComponent/>';

  const superPackageXml = params.super_package
    ? `<pak:superPackage adtcore:name="${escapeXml(params.super_package)}"/>`
    : '<pak:superPackage/>';

  const responsibleAttr = responsibleUser
    ? ` adtcore:responsible="${escapeXml(responsibleUser)}"`
    : '';
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXml(masterSystem)}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<pak:package xmlns:pak="http://www.sap.com/adt/packages" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${params.package_name}" adtcore:type="DEVC/K" adtcore:version="active" adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${params.package_name}"/>
  <pak:attributes pak:isEncapsulated="false" pak:packageType="${packageType}" pak:recordChanges="${params.record_changes ? 'true' : 'false'}"/>
  ${superPackageXml}
  ${applicationComponentXml}
  <pak:transport>
    ${softwareComponentXml}
    ${transportLayerXml}
  </pak:transport>
  <pak:translation/>
  <pak:useAccesses/>
  <pak:packageInterfaces/>
  <pak:subPackages/>
</pak:package>`;

  const queryParams = params.transport_request
    ? { corrNr: params.transport_request }
    : undefined;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    params: queryParams,
    headers: {
      Accept:
        'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml',
      'Content-Type': 'application/vnd.sap.adt.packages.v2+xml',
    },
  });
}
