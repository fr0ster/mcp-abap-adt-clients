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

/**
 * S/4HANA 2025 on premise — `ADT_TYPES_ONPREM`. Its table settings handler
 * is typed for the on-premise kind: the type of its write refuses
 * `isWritableByAMDP` (nothing maps it there, Code); no runtime check.
 */
export class AdtClientOnPrem extends AdtClient<'onprem'> {
  override getTableSettings(
    this: this & AdtServedBy<'tableSettings'>,
  ): AdtTableSettings<ResultValuesOf<typeof tableSettingsDocuments>, 'onprem'>;
  override getTableSettings<R extends ITableSettingsResults>(
    this: this & AdtServedBy<'tableSettings'>,
    results: R,
  ): AdtTableSettings<ResultValuesOf<R>, 'onprem'>;
  override getTableSettings(
    this: this & AdtServedBy<'tableSettings'>,
    results: ITableSettingsResults = tableSettingsDocuments,
  ): AdtTableSettings<TableSettingsValues, 'onprem'> {
    this.assertConnected();
    return new AdtTableSettings<TableSettingsValues, 'onprem'>(
      this.connection,
      { logger: this.logger, lockRegistry: this.lockRegistry, results },
    );
  }
}

/**
 * ABAP cloud — `ADT_TYPES_CLOUD`. Choosing it is the declaration that the
 * system is a cloud one. Its table settings handler is typed for the cloud
 * kind: the type of its write requires `isWritableByAMDP`, which a cloud
 * read answers (`cloudTableSettings` in adt-strategies throws on a read
 * without it). Its getter overrides the base's, as `AdtClientLegacy`
 * overrides the getters it serves differently.
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
    });
  }
}
