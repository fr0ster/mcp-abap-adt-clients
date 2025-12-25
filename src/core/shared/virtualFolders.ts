/**
 * Virtual folders operations for ABAP objects
 *
 * Retrieves hierarchical virtual folder contents from ADT information system.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import type { IGetVirtualFoldersContentsParams } from './types';

const VIRTUAL_FOLDERS_NAMESPACE = 'http://www.sap.com/adt/ris/virtualFolders';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildPreselectionXml = (
  preselection?: IGetVirtualFoldersContentsParams['preselection'],
): string => {
  if (!preselection || preselection.length === 0) {
    return '';
  }

  return preselection
    .map((entry) => {
      const valuesXml = entry.values
        .map((value) => `<vfs:value>${escapeXml(value)}</vfs:value>`)
        .join('');
      return `<vfs:preselection facet="${escapeXml(entry.facet)}">${valuesXml}</vfs:preselection>`;
    })
    .join('');
};

const buildFacetOrderXml = (facetOrder: string[]): string => {
  if (facetOrder.length === 0) {
    return '';
  }

  const facetsXml = facetOrder
    .map((facet) => `<vfs:facet>${escapeXml(facet)}</vfs:facet>`)
    .join('');
  return `<vfs:facetorder>${facetsXml}</vfs:facetorder>`;
};

const buildVirtualFoldersRequestXml = (
  params: IGetVirtualFoldersContentsParams,
): string => {
  const objectSearchPattern = escapeXml(params.objectSearchPattern ?? '*');
  const preselectionXml = buildPreselectionXml(params.preselection);
  const facetOrder = params.facetOrder ?? ['package', 'group', 'type'];
  const facetOrderXml = buildFacetOrderXml(facetOrder);

  return `<?xml version="1.0" encoding="UTF-8"?><vfs:virtualFoldersRequest xmlns:vfs="${VIRTUAL_FOLDERS_NAMESPACE}" objectSearchPattern="${objectSearchPattern}">${preselectionXml}${facetOrderXml}</vfs:virtualFoldersRequest>`;
};

/**
 * Fetch virtual folder contents for hierarchical browsing.
 *
 * Endpoint: POST /sap/bc/adt/repository/informationsystem/virtualfolders/contents
 */
export async function getVirtualFoldersContents(
  connection: IAbapConnection,
  params: IGetVirtualFoldersContentsParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/repository/informationsystem/virtualfolders/contents`;

  const queryParams: Record<string, string> = {};
  if (params.withVersions !== undefined) {
    queryParams.withVersions = String(params.withVersions);
  }
  if (params.ignoreShortDescriptions !== undefined) {
    queryParams.ignoreShortDescriptions = String(
      params.ignoreShortDescriptions,
    );
  }

  const xmlBody = buildVirtualFoldersRequestXml(params);

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    data: xmlBody,
    headers: {
      Accept: 'application/vnd.sap.adt.repository.virtualfolders.result.v1+xml',
      'Content-Type':
        'application/vnd.sap.adt.repository.virtualfolders.request.v1+xml',
    },
  });
}
