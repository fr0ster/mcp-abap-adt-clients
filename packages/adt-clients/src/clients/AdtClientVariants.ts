/**
 * The client of each modern release variant, its variant fixed: the
 * factories and members a variant's ADT type table does not serve do not
 * compile on it. The two serve the same APIs and operations today; a
 * consumer names the one its system is, and the declaration stays true when
 * they part. SAP_BASIS 7.40 is `AdtClientLegacy` of
 * `@mcp-abap-adt/adt-clients-legacy`.
 */

import type { ITableSettingsResults } from '@mcp-abap-adt/interfaces-adt';
import {
  AdtTableSettings,
  type TableSettingsValues,
  tableSettingsDocuments,
} from '../core/tableSettings';
import type { ResultValuesOf } from '../utils/resultStrategy';
import { AdtClient } from './AdtClient';
import type { AdtServedBy } from './variant';

/** S/4HANA 2025 on premise — `ADT_TYPES_ONPREM`. */
export class AdtClientOnPrem extends AdtClient<'onprem'> {}

/**
 * ABAP cloud — `ADT_TYPES_CLOUD`. Choosing it is the declaration that the
 * system is a cloud one, and the one runtime use of it: its table settings
 * handler knows the system is a cloud one (`patchMetadata` refuses a read
 * without `ts:isWritableByAMDP`). Its getter overrides the base's, as
 * `AdtClientLegacy` overrides the getters it serves differently.
 */
export class AdtClientCloud extends AdtClient<'cloud'> {
  override getTableSettings(
    this: this & AdtServedBy<'tableSettings'>,
  ): AdtTableSettings<ResultValuesOf<typeof tableSettingsDocuments>, 'cloud'>;
  override getTableSettings<R extends ITableSettingsResults>(
    this: this & AdtServedBy<'tableSettings'>,
    results: R,
  ): AdtTableSettings<ResultValuesOf<R>, 'cloud'>;
  override getTableSettings(
    this: this & AdtServedBy<'tableSettings'>,
    results: ITableSettingsResults = tableSettingsDocuments,
  ): AdtTableSettings<TableSettingsValues, 'cloud'> {
    this.assertConnected();
    return new AdtTableSettings<TableSettingsValues, 'cloud'>(this.connection, {
      logger: this.logger,
      lockRegistry: this.lockRegistry,
      results,
      variant: 'cloud',
    });
  }
}
