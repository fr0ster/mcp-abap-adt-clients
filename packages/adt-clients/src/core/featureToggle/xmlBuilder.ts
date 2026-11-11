/**
 * XML builder for feature-toggle metadata.
 *
 * The metadata payload is the `blue:blueSource` envelope (same blues v1
 * envelope used by APS IAM auth) with adtcore attributes and a packageRef
 * child. Source body (rollout / toggledPackages / attributes) is JSON
 * handled separately by updateSource.ts.
 */

import { TYPE_CODE } from '../../constants/typeCodes';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateFeatureToggleParams } from './types';

const NS_BLUE = 'http://www.sap.com/wbobj/blue';
const NS_ADTCORE = 'http://www.sap.com/adt/core';
const NS_ABAPSOURCE = 'http://www.sap.com/adt/abapsource';

export function buildFeatureToggleXml(
  params: ICreateFeatureToggleParams,
): string {
  const name = params.feature_toggle_name.toUpperCase();
  const description = params.description ?? '';
  const pkg = params.package_name as string;

  const adtcoreAttrs = [
    `adtcore:name="${escapeXmlAttr(name)}"`,
    `adtcore:type="${TYPE_CODE.featureToggle}"`,
    `adtcore:description="${escapeXmlAttr(description)}"`,
  ];
  if (params.master_system) {
    adtcoreAttrs.push(
      `adtcore:masterSystem="${escapeXmlAttr(params.master_system)}"`,
    );
  }
  if (params.responsible) {
    adtcoreAttrs.push(
      `adtcore:responsible="${escapeXmlAttr(params.responsible)}"`,
    );
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<blue:blueSource xmlns:blue="${NS_BLUE}" xmlns:adtcore="${NS_ADTCORE}" xmlns:abapsource="${NS_ABAPSOURCE}" ` +
    adtcoreAttrs.join(' ') +
    `>` +
    (pkg ? `<adtcore:packageRef adtcore:name="${escapeXmlAttr(pkg)}"/>` : '') +
    `</blue:blueSource>`
  );
}
